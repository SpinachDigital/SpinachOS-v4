/**
 * api/src/inbox-triage.ts — Phase 6 GOAL 3: smart priority score for
 * approval cards (inbox-zero must survive scale).
 *
 * Score = risk tier (external > write > read) + blocking status (is a
 * pipeline stage stalled waiting on this?) + age/SLA + type weight
 * (client-delivery > internal). BLOCKING cards float to the top.
 *
 * Pure sync scoring — no LLM, no async — scores recompute on every list
 * fetch (new card, age crossing SLA, pipeline unblocked → fresh sort).
 */
import { supabase } from './ctx';

export interface TriageCard {
  id: string;
  type: string;
  title: string;
  status: string;
  risk_tier?: string | null;
  client_id?: string | null;
  created_at?: string | null;
  metadata?: any;
  // computed:
  triage_score?: number;
  triage_reasons?: string[];
  blocking?: boolean;
}

const TIER_WEIGHT: Record<string, number> = { external: 40, write: 25, read: 10 };
const TYPE_WEIGHT: Record<string, number> = {
  // client-delivery > internal (Phase 6 prompt §GOAL 3)
  publish: 25, outreach: 20, gate: 20, deliverable_approval: 18, onboarding: 18,
  invoice: 15, task_approval: 12, stuck_stage: 12, content: 8, strategy: 6, design: 6,
};
const SLA_HOURS = 24; // age/SLA: a card older than a day weighs more

/** Which workflow stage (if any) is BLOCKED on this approval?
 *  An approval blocks a pipeline when its gate row is pending on a
 *  workflow whose current_step matches the gate's after_step. */
async function blockingWorkflowIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    // Pending gates → their workflows
    const { data: gates } = await supabase
      .from('gate_actions')
      .select('workflow_id')
      .eq('status', 'pending')
      .limit(200);
    for (const g of gates || []) if (g.workflow_id) ids.add(g.workflow_id);
    // Stuck-stage attention cards → their workflows
    const { data: stuck } = await supabase
      .from('approvals')
      .select('metadata')
      .eq('type', 'stuck_stage')
      .eq('status', 'pending')
      .limit(200);
    for (const s of stuck || []) {
      const wid = s?.metadata?.workflow_id;
      if (wid) ids.add(wid);
    }
  } catch { /* triage must never break the inbox */ }
  return ids;
}

export async function scoreCards(cards: TriageCard[]): Promise<TriageCard[]> {
  const blockedWf = await blockingWorkflowIds();

  const now = Date.now();
  for (const c of cards) {
    const reasons: string[] = [];
    let score = 0;

    // 1. Risk tier
    const tier = String(c.risk_tier || '').toLowerCase();
    const tierW = TIER_WEIGHT[tier] ?? 0;
    if (tierW) { score += tierW; reasons.push(`risk:${tier} +${tierW}`); }

    // 2. Blocking status — a workflow is stalled waiting on this card's family
    const wfId = c.metadata?.workflow_id || (c.metadata?.gate ? c.metadata.gate.workflow_id : null);
    const isBlocking = Boolean(
      (c.type === 'gate' || c.type === 'stuck_stage') &&
      (wfId ? blockedWf.has(wfId) : c.type === 'gate')
    );
    if (isBlocking) { score += 35; reasons.push('blocking +35'); }

    // 3. Age / SLA
    if (c.created_at) {
      const ageH = (now - new Date(c.created_at).getTime()) / 3_600_000;
      if (ageH > SLA_HOURS) {
        const over = Math.min(20, Math.round(ageH / SLA_HOURS) * 5);
        score += over; reasons.push(`age>${SLA_HOURS}h +${over}`);
      } else if (ageH > SLA_HOURS / 2) {
        score += 5; reasons.push('age>12h +5');
      }
    }

    // 4. Type weight (client-delivery > internal)
    const tw = TYPE_WEIGHT[c.type] ?? 5;
    score += tw; reasons.push(`type:${c.type} +${tw}`);

    // 5. Client-linked cards outrank internal ones
    if (c.client_id) { score += 8; reasons.push('client-linked +8'); }

    c.blocking = isBlocking;
    c.triage_score = score;
    c.triage_reasons = reasons;
  }

  // BLOCKING first, then score desc, then oldest first (stable tiebreak)
  return cards.sort((a, b) =>
    Number(b.blocking) - Number(a.blocking) ||
    (b.triage_score || 0) - (a.triage_score || 0) ||
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );
}
