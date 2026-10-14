/*
 * routes/nudges.ts — N2 §4: proactive nudges.
 * GET /api/v1/nudges — three families, one endpoint:
 *   - approvals pending 48h+        → suggest Approve/Reject (action: open approval)
 *   - leads silent 5+ days          → suggest re-outreach (action: draft outreach)
 *   - pipelines stuck 7+ days       → suggest reassign/unblock (action: open pipeline)
 * Every nudge = one suggestion + one-click action. The founder decides; the
 * system NEVER auto-acts. Bounded queries only; p95 law applies.
 */
import { app, authMiddleware, supabase } from '../ctx';

app.get('/api/v1/nudges', authMiddleware, async (_req, res) => {
  try {
    const now = Date.now();
    const H = 3_600_000; // one hour

    // ---- family 1: approvals pending 48h+ (bounded 50, oldest first) ----
    const { data: staleApprovals } = await supabase
      .from('approvals')
      .select('id, title, type, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200);
    const approvalNudges = (staleApprovals || [])
      .filter((a: any) => (now - new Date(a.created_at).getTime()) / H >= 48)
      .slice(0, 10)
      .map((a: any) => ({
        kind: 'stale_approval',
        severity: 'high',
        title: a.title,
        why: `Pending ${Math.floor((now - new Date(a.created_at).getTime()) / (24 * H))} days — decisions age, work stalls.`,
        action: { label: 'Open approval', type: 'open', target: `/approvals?focus=${a.id}` },
      }));

    // ---- family 2: leads silent 5+ days (no outreach, or last outreach 5d+ old) ----
    const { data: silentLeads } = await supabase
      .from('leads')
      .select('id, name, status, updated_at, last_outreach_at')
      .in('status', ['new', 'qualified', 'outreached'])
      .order('updated_at', { ascending: true })
      .limit(200);
    const { data: sent } = await supabase
      .from('outreach_messages')
      .select('lead_id, sent_at')
      .order('sent_at', { ascending: false })
      .limit(500);
    const lastSent = new Map<string, string>();
    for (const m of sent || []) if (!lastSent.has(m.lead_id)) lastSent.set(m.lead_id, m.sent_at);
    const leadNudges = (silentLeads || [])
      .filter((l: any) => {
        const clock = l.last_outreach_at || lastSent.get(l.id) || l.updated_at;
        return clock && (now - new Date(clock).getTime()) / (24 * H) >= 5;
      })
      .slice(0, 10)
      .map((l: any) => ({
        kind: 'silent_lead',
        severity: 'medium',
        title: `Lead silent: ${l.name}`,
        why: `No activity for 5+ days — a quiet lead is a cooling lead.`,
        action: { label: 'Draft outreach', type: 'open', target: `/leads?focus=${l.id}` },
      }));

    // ---- family 3: pipelines stuck 7+ days ----
    const { data: stuckWorkflows } = await supabase
      .from('workflows')
      .select('id, name, status, current_step, updated_at')
      .neq('status', 'completed')
      .order('updated_at', { ascending: true })
      .limit(200);
    const pipelineNudges = (stuckWorkflows || [])
      .filter((w: any) => {
        const clock = w.updated_at ? new Date(w.updated_at).getTime() : NaN;
        return Number.isFinite(clock) && (now - clock) / (24 * H) >= 7;
      })
      .slice(0, 10)
      .map((w: any) => ({
        kind: 'stuck_pipeline',
        severity: 'high',
        title: `Pipeline idle: ${w.name} (${w.current_step || '—'})`,
        why: `No movement for 7+ days — reassign or unblock the stage.`,
        action: { label: 'Open pipeline', type: 'open', target: `/pipeline/${w.id}` },
      }));

    res.json({
      nudges: [...approvalNudges, ...leadNudges, ...pipelineNudges],
      counts: { stale_approvals: approvalNudges.length, silent_leads: leadNudges.length, stuck_pipelines: pipelineNudges.length },
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
