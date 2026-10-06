/**
 * api/src/routes/evolutions.ts — Phase 7 GOAL 1+2 routes + daily learning run.
 *
 * Endpoints:
 *   POST /api/v1/evolutions/run         — manual trigger (probe/demo)
 *   GET  /api/v1/evolutions             — list proposals (status filter)
 *   GET  /api/v1/evolutions/preferences — approved preferences (for gateway injection)
 *   POST /api/v1/evolutions/:id/apply   — approve→apply (explicit founder action)
 *   POST /api/v1/evolutions/:id/deny    — deny + suppress (proposal_key unique = law)
 *
 * Daily schedule: 08:30 IST (before the 09:00 retainer run) — cron armed here.
 */
import { app, supabase, authMiddleware } from '../ctx';
import { runLearningLoop } from '../learning-loop';
import { recordApprovalDecision } from '../memory-ledger';
import cron from 'node-cron';



// ---------------- apply / deny (THE INBOX calls these) ----------------

/** Approve → apply. NEVER automatic: this is an explicit founder action,
 *  routed from the evolution_proposal card in the inbox. */
app.post('/api/v1/evolutions/:id/apply', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data: prop, error } = await supabase
      .from('evolution_proposals')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !prop) return res.status(404).json({ error: 'proposal not found' });
    if (prop.status === 'rejected') return res.status(400).json({ error: 'proposal was denied — cannot apply' });
    if (prop.status === 'applied') return res.json({ ok: true, already: true, prop });

    // Apply by type:
    // preference → learned_preferences row (status approved)
    // playbook_fix → payload.version_bump noted; new pack version is GOAL 2's
    //                versioned-diff path (old installs untouched — versioned law)
    // cost_rule    → learned_preferences row (scope agent) — guardrail enforced
    //                by usage logging path reading approved rules
    let applied: any = { type: prop.type };
    if (prop.type === 'preference' || prop.type === 'cost_rule') {
      const p = prop.payload || {};
      const { error: insErr } = await supabase.from('learned_preferences').upsert({
        scope: p.scope || (prop.type === 'cost_rule' ? 'agent' : 'global'),
        client_id: p.client_id || null,
        agent_profile: p.agent || null,
        key: p.key || prop.proposal_key,
        value: p.value || p.rule || {},
        confidence: prop.confidence,
        status: 'approved',
        evidence_refs: prop.evidence,
        proposal_id: prop.id,
      }, { onConflict: 'scope,key,client_id,agent_profile' });
      if (insErr) throw insErr;
      applied.preference_saved = true;
    } else if (prop.type === 'playbook_fix') {
      // Versioned playbook diff — GOAL 2 detail. Mark applied; the pack's
      // next version (v(N+1)) is produced by the playbooks route from payload.
      applied.playbook_fix_marked = true;
    }

    const { error: updErr } = await supabase
      .from('evolution_proposals')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) throw updErr;

    await recordApprovalDecision(supabase, {
      approvalId: id,
      title: prop.title,
      approved: true,
      by: 'founder',
    });
    res.json({ ok: true, applied });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Deny → suppressed FOREVER (proposal_key stays; unique constraint blocks
 *  re-proposal). Nagging is a bug — this is the suppression law. */
app.post('/api/v1/evolutions/:id/deny', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data: prop, error } = await supabase
      .from('evolution_proposals')
      .select('id, proposal_key, title')
      .eq('id', id)
      .single();
    if (error || !prop) return res.status(404).json({ error: 'proposal not found' });

    const { error: updErr } = await supabase
      .from('evolution_proposals')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'applied');
    if (updErr) throw updErr;

    // Any pending inbox card for this proposal is closed (denied, not left dangling)
    await supabase
      .from('approvals')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('metadata->>proposal_id', id)
      .eq('status', 'pending');

    await recordApprovalDecision(supabase, {
      approvalId: id,
      title: prop.title,
      approved: false,
      by: 'founder',
    });
    res.json({ ok: true, suppressed: prop.proposal_key });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- read side ----------------

app.get('/api/v1/evolutions', authMiddleware, async (req: any, res) => {
  try {
    const { status, type } = req.query;
    let q = supabase
      .from('evolution_proposals')
      .select('*')
      .order('proposed_at', { ascending: false })
      .limit(200);
    if (status) q = q.eq('status', String(status));
    if (type) q = q.eq('type', String(type));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Approved preferences for gateway injection (GOAL 2 — prompt text only). */
app.get('/api/v1/evolutions/preferences', authMiddleware, async (req: any, res) => {
  try {
    const { scope, agent, client_id, status } = req.query;
    let q = supabase
      .from('learned_preferences')
      .select('*')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (scope) q = q.eq('scope', String(scope));
    if (agent) q = q.eq('agent_profile', String(agent));
    if (client_id) q = q.eq('client_id', String(client_id));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- manual trigger + daily schedule ----------------

app.post('/api/v1/evolutions/run', authMiddleware, async (req: any, res) => {
  try {
    const result = await runLearningLoop();
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Daily 08:30 IST (03:00 UTC) — cheap read-only mining before the 09:00 retainer run.
let LEARNING_CRON_RUNNING = false;
cron.schedule('0 3 * * *', async () => {
  if (LEARNING_CRON_RUNNING) return;
  LEARNING_CRON_RUNNING = true;
  try {
    await runLearningLoop();
  } catch (e: any) {
    console.error('[learning-cron] failed:', e?.message);
  } finally {
    LEARNING_CRON_RUNNING = false;
  }
});
console.log('[learning-cron] armed: daily 08:30 IST → learning loop mining run');
