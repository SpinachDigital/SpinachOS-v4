/**
 * api/src/learning-loop.ts — Phase 7 GOAL 1: mine → propose → inbox card.
 *
 * THE GOLDEN RULE (law): nothing applies itself. The run only MINES history
 * (read-only) and writes PROPOSALS. Every proposal becomes an approval card
 * (type='evolution_proposal', violet). Approve → applied (GOAL 2). Deny →
 * proposal_key stays in evolution_proposals with status='rejected' — the
 * unique key means the same pattern can NEVER be re-proposed (nagging = bug).
 *
 * Signals (all already collected):
 *   1. approval/rejection rates per card type      (approvals)
 *   2. pipeline stage stalls                        (pipeline_events stuck_flag)
 *   3. usage cost per agent vs rolling average      (usage_logs)
 *   4. founder corrections                          (agent_memory)
 */
import { supabase } from './ctx';

export interface Proposal {
  proposal_key: string;
  type: 'preference' | 'playbook_fix' | 'cost_rule';
  title: string;
  rationale: string;
  confidence: number;      // 0–100, honest
  evidence: any;
  payload: any;           // what applying does
}

/** Proposal keys must be STABLE so deny-suppression works. */
async function isSuppressed(key: string): Promise<boolean> {
  const { data } = await supabase
    .from('evolution_proposals')
    .select('id, status')
    .eq('proposal_key', key)
    .limit(1);
  return Boolean(data && data.length);
}

async function insertProposal(p: Proposal): Promise<any> {
  const { data, error } = await supabase
    .from('evolution_proposals')
    .insert({
      proposal_key: p.proposal_key,
      type: p.type,
      title: p.title,
      rationale: p.rationale,
      confidence: p.confidence,
      evidence: p.evidence,
      payload: p.payload,
      status: 'proposed',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** The proposal → THE INBOX card (violet-tagged). Approve/deny ride the
 *  existing approvals machinery — deny-by-default remains law. */
async function createInboxCard(proposal: any): Promise<void> {
  const { error } = await supabase.from('approvals').insert({
    type: 'evolution_proposal',
    title: `Learn: ${proposal.title}`,
    description: `${proposal.rationale}\n\nConfidence: ${proposal.confidence}%. Evidence: ${JSON.stringify(proposal.evidence)}`,
    status: 'pending',
    risk_tier: 'write',          // applying changes behavior — never 'read'
    metadata: {
      proposal_id: proposal.id,
      proposal_key: proposal.proposal_key,
      proposal_type: proposal.type,
      confidence: proposal.confidence,
      violet: true,               // UI: visually distinct tag
    },
    payload_json: proposal.payload,
  });
  // Card creation failure must not lose the proposal — it stays queryable.
  if (error) console.error('[learning-loop] inbox card failed:', error.message);
}

// ---------------- THE MINERS (read-only, real history only) ----------------

/** 1. Preferences: high-deny patterns on a card type → auto-deny rule proposal. */
async function mineApprovalPatterns(): Promise<Proposal[]> {
  const { data } = await supabase
    .from('approvals')
    .select('type, status, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString())
    .limit(500);
  const out: Proposal[] = [];
  if (!data || data.length < 5) return out;

  const byType: Record<string, { a: number; r: number }> = {};
  for (const row of data as any[]) {
    byType[row.type] = byType[row.type] || { a: 0, r: 0 };
    if (row.status === 'approved') byType[row.type].a++;
    if (row.status === 'rejected') byType[row.type].r++;
  }
  for (const [type, { a, r }] of Object.entries(byType)) {
    const total = a + r;
    if (total >= 5 && r / total >= 0.6) {
      out.push({
        proposal_key: `pref:auto_review_${type}`,
        type: 'preference',
        title: `Auto-flag ${type} cards for stricter review`,
        rationale: `Founder rejected ${r}/${total} ${type} cards in 30 days (${Math.round((r / total) * 100)}%). Proposing a stricter review preference so generation adapts before review.`,
        confidence: Math.min(95, 50 + r * 7),
        evidence: { rejected: r, total, window_days: 30, card_type: type },
        payload: { scope: 'global', key: `review_strictness.${type}`, value: { min_quality: 'strict', reason: 'high historical rejection' } },
      });
    }
  }
  return out;
}

/** 2. Playbook improvements: stages that stall repeatedly across installs.
 *  stuck_flag events carry {sla_hours, idle_hours, approval_id} — the STAGE
 *  lives on the workflow row (current_step), so resolve it there. */
async function mineStuckStages(): Promise<Proposal[]> {
  const { data } = await supabase
    .from('pipeline_events')
    .select('event, workflow_id, detail, created_at')
    .eq('event', 'stuck_flag')
    .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString())
    .limit(400);
  const out: Proposal[] = [];
  if (!data) return out;

  // Resolve stage per event via the workflow's current_step at the time.
  const wfIds = [...new Set((data as any[]).map(r => r.workflow_id).filter(Boolean))];
  const wfStep: Record<string, string> = {};
  if (wfIds.length) {
    const { data: wfs } = await supabase
      .from('workflows')
      .select('id, current_step')
      .in('id', wfIds)
      .limit(200);
    for (const w of wfs || []) wfStep[w.id] = w.current_step || 'unknown';
  }

  const byStage: Record<string, number> = {};
  const byWf: Record<string, Set<string>> = {};
  for (const row of data as any[]) {
    const stage = wfStep[row.workflow_id] || row.detail?.stage || row.detail?.step || 'unknown';
    byStage[stage] = (byStage[stage] || 0) + 1;
    if (row.workflow_id) {
      byWf[stage] = byWf[stage] || new Set();
      byWf[stage].add(row.workflow_id);
    }
  }
  for (const [stage, count] of Object.entries(byStage)) {
    if (count >= 5) {
      const wfCount = byWf[stage]?.size || 0;
      out.push({
        proposal_key: `playbook:split_stage_${stage}`,
        type: 'playbook_fix',
        title: `Split playbook stage "${stage}" — it stalls`,
        rationale: `Stage "${stage}" raised ${count} stuck_flags across ${wfCount} workflows in 30 days. It is likely too coarse — splitting it into 2 smaller tasks would unblock installs faster.`,
        confidence: Math.min(90, 45 + count * 5),
        evidence: { stuck_flags: count, workflows: wfCount, window_days: 30, stage },
        payload: { stage, action: 'split_into_two', version_bump: 'minor' },
      });
    }
  }
  return out;
}

/** 3. Cost outliers: agent spend today vs its own rolling average. */
async function mineCostOutliers(): Promise<Proposal[]> {
  const { data } = await supabase
    .from('usage_logs')
    .select('agent_profile, cost_usd, created_at')
    .gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString())
    .limit(1000);
  const out: Proposal[] = [];
  if (!data || data.length < 10) return out;

  const perAgentDay: Record<string, Record<string, number>> = {};
  for (const row of data as any[]) {
    const day = String(row.created_at || '').slice(0, 10);
    perAgentDay[row.agent_profile] = perAgentDay[row.agent_profile] || {};
    perAgentDay[row.agent_profile][day] = (perAgentDay[row.agent_profile][day] || 0) + (parseFloat(row.cost_usd) || 0);
  }
  for (const [agent, days] of Object.entries(perAgentDay)) {
    const vals = Object.values(days);
    if (vals.length < 4) continue;                 // need a real rolling baseline
    const sorted = [...vals].sort((x, y) => y - x);
    const top = sorted[0];
    const rest = sorted.slice(1);
    const avg = rest.reduce((s, v) => s + v, 0) / rest.length;
    if (avg > 0 && top / avg >= 3) {
      out.push({
        proposal_key: `cost:cap_${agent.replace(/[^a-z0-9_]/gi, '_')}`,
        type: 'cost_rule',
        title: `Cap ${agent} daily spend — outlier detected`,
        rationale: `${agent} spent ${top.toFixed(4)} USD in one day vs its ${avg.toFixed(4)} rolling average (${(top / avg).toFixed(1)}×). Proposing a daily cap + alert so a runaway task can't burn budget.`,
        confidence: Math.min(88, 55 + Math.round(top / avg) * 5),
        evidence: { peak_day_usd: Number(top.toFixed(4)), rolling_avg_usd: Number(avg.toFixed(4)), multiple: Number((top / avg).toFixed(1)), agent },
        payload: { agent, rule: 'daily_cap', cap_usd: Number((avg * 2).toFixed(4)), alert_above_usd: Number((avg * 1.5).toFixed(4)) },
      });
    }
  }
  return out;
}

// ---------------- THE RUN ----------------

export async function runLearningLoop(): Promise<{ mined: number; proposed: number; suppressed: number }> {
  const miners = [mineApprovalPatterns, mineStuckStages, mineCostOutliers];
  let proposed = 0, suppressed = 0, mined = 0;
  for (const mine of miners) {
    let found: Proposal[] = [];
    try { found = await mine(); } catch (e: any) {
      console.error('[learning-loop] miner failed:', e?.message);
      continue;
    }
    mined += found.length;
    for (const p of found) {
      if (await isSuppressed(p.proposal_key)) { suppressed++; continue; }
      try {
        const row = await insertProposal(p);
        await createInboxCard(row);
        proposed++;
      } catch (e: any) {
        // unique-race on proposal_key = already proposed/suppressed — not an error
        if (!/duplicate key|unique/i.test(e?.message || '')) console.error('[learning-loop] insert failed:', e?.message);
      }
    }
  }
  console.log(`[learning-loop] run done: mined=${mined} proposed=${proposed} suppressed=${suppressed}`);
  return { mined, proposed, suppressed };
}
