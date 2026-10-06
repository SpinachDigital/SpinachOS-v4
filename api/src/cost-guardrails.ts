/*
 * cost-guardrails.ts — Phase 7-FIX FIX 2.
 *
 * Approved cost_rule proposals (learned_preferences, key starts 'cost_cap')
 * become LIVE guardrails on the agent-spend path: logUsage checks the cap
 * AFTER computing cost, and on breach logs the trigger to the Company
 * Memory Ledger + raises a low-risk inbox card. 60s in-memory cache so the
 * hot path never blocks on a DB read (same pattern as pref injection).
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { recordApprovalDecision } from './memory-ledger';
import { emitApproval } from './ctx';

type CapRule = { agent: string; cap_usd: number; rule_id: string };

let cache: { rules: CapRule[]; at: number } = { rules: [], at: 0 };
const TTL_MS = 60_000;

async function costCaps(supabase: SupabaseClient): Promise<CapRule[]> {
  if (Date.now() - cache.at < TTL_MS) return cache.rules;
  try {
    const { data } = await supabase
      .from('learned_preferences')
      .select('id, agent_profile, value')
      .eq('status', 'approved')
      .like('key', 'cost_cap%');
    const rules = (data || [])
      .map((r: any) => ({
        agent: r.agent_profile || '*',
        cap_usd: Number(r.value?.cap_usd ?? r.value ?? 0),
        rule_id: r.id,
      }))
      .filter((r: CapRule) => r.cap_usd > 0);
    cache = { rules, at: Date.now() };
    return rules;
  } catch {
    return cache.rules; // stale cache holds on DB error — never break the spend path
  }
}

/** Called by logUsage after cost is computed. Never throws. */
export async function checkCostCap(
  supabase: SupabaseClient,
  agent: string,
  costUsd: number,
  model: string,
): Promise<{ breached: boolean; cap?: number; rule_id?: string }> {
  try {
    const rules = await costCaps(supabase);
    const rule = rules.find(r => r.agent === agent || r.agent === '*');
    if (!rule || costUsd <= rule.cap_usd) return { breached: false };
    const trigger = `[cost-guardrail] BREACH agent=${agent} cost_usd=${costUsd.toFixed(4)} cap_usd=${rule.cap_usd} rule=${rule.rule_id} model=${model} at=${new Date().toISOString()}`;
    console.log(trigger);
    // ledger trigger line (timestamp + agent + rule id live in memory_ledger)
    void recordApprovalDecision(supabase, {
      approvalId: rule.rule_id,
      title: `Cost guardrail breached: @${agent} ${costUsd.toFixed(4)} > ${rule.cap_usd} USD`,
      approved: false,
      by: 'watcher',
      reason: trigger,
    }).then(() => undefined, () => undefined);
    // low-risk inbox card
    void supabase.from('approvals').insert({
      type: 'cost_guardrail',
      title: `AI spend crossed cap — @${agent}`,
      description: `${model} call cost $${costUsd.toFixed(4)}; cap $${rule.cap_usd}. Rule: ${rule.rule_id}`,
      status: 'pending',
      requested_by: 'cost-guardrail',
      payload_json: { agent, cost_usd: costUsd, cap_usd: rule.cap_usd, rule_id: rule.rule_id, model },
    }).then(() => undefined, () => undefined);
    return { breached: true, cap: rule.cap_usd, rule_id: rule.rule_id };
  } catch {
    return { breached: false }; // never break the spend path on guardrail failure
  }
}
