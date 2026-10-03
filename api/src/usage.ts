/*
 * usage.ts — Sprint 11 §2: usage_logs instrumentation + cost computation.
 *
 * Every AI call in the system logs a usage row — OmniRoute dispatches, image
 * generation, agent task runs. A call nobody logged is a cost nobody sees.
 *
 * Cost = tokens × per-model rate (model_rates table — editable rows, never
 * hardcoded silently; missing model → the default rate row is used and the
 * gap is visible in the P&L).
 *
 * Pattern adopted from Langfuse/OpenLIT (structured usage logging) — the
 * tools themselves are NOT adopted (self-host weight violates minimal-setup).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type UsageSource = 'agent' | 'omniroute' | 'image_gen' | 'laya';

export type UsageInput = {
  agent_profile: string;
  client_id?: string | null;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  task_id?: string | null;
  source?: UsageSource;
  metadata?: Record<string, unknown>;
};

/**
 * Compute cost from tokens × the model's rate (model_rates table). Returns
 * (cost_usd, cost_inr, rate_found). Missing model → the DEFAULT rate
 * (usd_per_m 0 = free-visible, rate_found=false so the P&L shows the gap).
 */
export async function computeCost(
  supabase: SupabaseClient,
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): Promise<{ costUsd: number; costInr: number; rateFound: boolean }> {
  const { data: rate } = await supabase
    .from('model_rates')
    .select('usd_per_m_input, usd_per_m_output, inr_per_usd')
    .eq('model', model)
    .maybeSingle();

  const inM = Number(inputTokens || 0);
  const outM = Number(outputTokens || 0);
  if (!rate) {
    // Missing rate → cost 0 but rateFound=false — the P&L shows "no rate for
    // this model" instead of silently pricing it at zero forever.
    return { costUsd: 0, costInr: 0, rateFound: false };
  }
  const costUsd = (inM / 1_000_000) * Number(rate.usd_per_m_input) + (outM / 1_000_000) * Number(rate.usd_per_m_output);
  const costInr = costUsd * Number(rate.inr_per_usd || 84);
  return { costUsd, costInr, rateFound: true };
}

/**
 * Log one usage row. Never throws — a logging failure must not break the
 * AI call it observes; the caller's log records the gap.
 */
export async function logUsage(supabase: SupabaseClient, u: UsageInput): Promise<{ logged: boolean; id?: string; rateFound?: boolean }> {
  try {
    const { costUsd, costInr, rateFound } = await computeCost(supabase, u.model, u.input_tokens, u.output_tokens);
    const { data, error } = await supabase.from('usage_logs').insert({
      agent_profile: u.agent_profile,
      client_id: u.client_id || null,
      model: u.model,
      input_tokens: u.input_tokens ?? null,
      output_tokens: u.output_tokens ?? null,
      cost_usd: costUsd ? Number(costUsd.toFixed(6)) : 0,
      cost_inr: costInr ? Number(costInr.toFixed(4)) : 0,
      task_id: u.task_id || null,
      source: u.source || 'agent',
      metadata: { ...(u.metadata || {}), rate_found: rateFound },
    }).select('id').single();
    if (error) {
      console.error('[usage] insert failed:', error.message);
      return { logged: false };
    }
    return { logged: true, id: data?.id, rateFound };
  } catch (e: any) {
    console.error('[usage] log failed:', e?.message);
    return { logged: false };
  }
}

/**
 * P&L rollups — the /pnl page payload (one clear page, observability not
 * accounting): per-client (AI cost vs monthly_value → margin), per-agent
 * cost rollup, per-model breakdown. Every number traces to a usage_logs row.
 */
export async function pnlRollup(supabase: SupabaseClient): Promise<{
  clients: any[]; agents: any[]; models: any[]; totals: { costUsd: number; costInr: number; calls: number; unpricedCalls: number };
}> {
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('agent_profile, client_id, model, input_tokens, output_tokens, cost_usd, cost_inr, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  const all = logs || [];
  const { data: clients } = await supabase.from('clients').select('id, name, monthly_value, status');

  // per-client
  const byClient = new Map<string, { costInr: number; calls: number }>();
  for (const l of all) {
    if (!l.client_id) continue;
    const cur = byClient.get(l.client_id) || { costInr: 0, calls: 0 };
    cur.costInr += Number(l.cost_inr || 0);
    cur.calls += 1;
    byClient.set(l.client_id, cur);
  }
  const clientRows = (clients || []).map((c: any) => {
    const u = byClient.get(c.id) || { costInr: 0, calls: 0 };
    const revenue = c.monthly_value == null ? null : Number(c.monthly_value);
    const margin = revenue == null ? null : revenue > 0 ? ((revenue - u.costInr) / revenue) * 100 : null;
    return { client_id: c.id, name: c.name, status: c.status, ai_cost_inr: Number(u.costInr.toFixed(2)), calls: u.calls, monthly_value: revenue, margin_pct: margin == null ? null : Number(margin.toFixed(1)) };
  });

  // per-agent
  const byAgent = new Map<string, { costInr: number; calls: number; tokens: number }>();
  for (const l of all) {
    const cur = byAgent.get(l.agent_profile) || { costInr: 0, calls: 0, tokens: 0 };
    cur.costInr += Number(l.cost_inr || 0);
    cur.calls += 1;
    cur.tokens += Number(l.input_tokens || 0) + Number(l.output_tokens || 0);
    byAgent.set(l.agent_profile, cur);
  }
  const agentRows = Array.from(byAgent.entries())
    .map(([agent, u]) => ({ agent_profile: agent, ai_cost_inr: Number(u.costInr.toFixed(2)), calls: u.calls, tokens: u.tokens }))
    .sort((a, b) => b.ai_cost_inr - a.ai_cost_inr);

  // per-model
  const byModel = new Map<string, { costInr: number; calls: number; tokens: number }>();
  let unpriced = 0;
  for (const l of all) {
    const cur = byModel.get(l.model) || { costInr: 0, calls: 0, tokens: 0 };
    cur.costInr += Number(l.cost_inr || 0);
    cur.calls += 1;
    cur.tokens += Number(l.input_tokens || 0) + Number(l.output_tokens || 0);
    byModel.set(l.model, cur);
    if (l.metadata?.rate_found === false) unpriced += 1;
  }
  const modelRows = Array.from(byModel.entries())
    .map(([model, u]) => ({ model, ai_cost_inr: Number(u.costInr.toFixed(2)), calls: u.calls, tokens: u.tokens }))
    .sort((a, b) => b.ai_cost_inr - a.ai_cost_inr);

  const totals = {
    costUsd: Number(all.reduce((s, l) => s + Number(l.cost_usd || 0), 0).toFixed(4)),
    costInr: Number(all.reduce((s, l) => s + Number(l.cost_inr || 0), 0).toFixed(2)),
    calls: all.length,
    unpricedCalls: unpriced,
  };

  return { clients: clientRows, agents: agentRows, models: modelRows, totals };
}
