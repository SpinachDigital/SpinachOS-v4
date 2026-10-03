/*
 * memory-ledger.ts — Sprint 12 §2: Company Memory Ledger (blueprint §3.5).
 * Every decision, approval, gate outcome, and founder correction is recorded
 * — a decision nobody recorded is a decision nobody can replay.
 *
 * Schema: agent_memory (blueprint §4 as-is) — agent, type
 * [client/decision/pattern/preference], key, value, expiry.
 * Pattern adopted from mem0/Graphiti (typed memories + expiry + replay) —
 * the tools themselves are NOT adopted (self-host weight).
 *
 * Write paths (mandatory): approval decisions (approved/rejected + reason),
 * gate decisions (approved/rejected + tier + escalation), task completions
 * with notable outcomes, founder corrections. All best-effort — a logging
 * failure must not break the decision it records.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { redactPayload } from './routes/gates';

export type MemoryType = 'client' | 'decision' | 'pattern' | 'preference';

export type MemoryInput = {
  agent_profile: string;
  memory_type: MemoryType;
  key: string;
  value: Record<string, unknown>;
  expires_at?: string | null;
};

/**
 * Record one ledger entry (upsert on the UNIQUE(agent, type, key) — the
 * latest decision for a key wins, prior context stays in the payload).
 * Never throws.
 */
export async function recordMemory(supabase: SupabaseClient, m: MemoryInput): Promise<boolean> {
  try {
    // Sprint 13 nit 4: redact secrets at record time — a password/token in a
    // payload never reaches the ledger raw (same REDACT_KEYS as gate payloads).
    const { error } = await supabase.from('agent_memory').upsert(
      {
        agent_profile: m.agent_profile,
        memory_type: m.memory_type,
        key: m.key,
        value: redactPayload(m.value),
        expires_at: m.expires_at || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_profile,memory_type,key' },
    );
    if (error) {
      console.error('[ledger] record failed:', error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error('[ledger] record failed:', e?.message);
    return false;
  }
}

/** Convenience wrappers — the mandatory write paths, named for the caller. */

/** An approval decision (approved/rejected + reason). */
export const recordApprovalDecision = (
  supabase: SupabaseClient,
  opts: { approvalId: string; title: string; approved: boolean; by: string; reason?: string | null; clientId?: string | null },
) =>
  recordMemory(supabase, {
    agent_profile: opts.by,
    memory_type: 'decision',
    key: `approval:${opts.approvalId}`,
    value: {
      what: 'approval decision', title: opts.title, approved: opts.approved,
      by: opts.by, reason: opts.reason || null, client_id: opts.clientId || null,
      decided_at: new Date().toISOString(),
    },
  });

/** A gate decision (approved/rejected + tier + escalation). */
export const recordGateDecision = (
  supabase: SupabaseClient,
  opts: { gateId: string; gateName: string; approved: boolean; tier: string; escalation?: boolean; by: string; clientId?: string | null },
) =>
  recordMemory(supabase, {
    agent_profile: opts.by,
    memory_type: 'decision',
    key: `gate:${opts.gateId}`,
    value: {
      what: 'gate decision', gate_name: opts.gateName, approved: opts.approved,
      risk_tier: opts.tier, escalation: opts.escalation || false, by: opts.by,
      client_id: opts.clientId || null, decided_at: new Date().toISOString(),
    },
  });

/** A task completion with a notable outcome. */
export const recordTaskOutcome = (
  supabase: SupabaseClient,
  opts: { taskId: string; agent: string; task: string; outcome: string; workflowId?: string | null; model?: string | null },
) =>
  recordMemory(supabase, {
    agent_profile: opts.agent,
    memory_type: 'pattern',
    key: `task:${opts.taskId}`,
    value: {
      what: 'task completion', task: opts.task.slice(0, 200), outcome: opts.outcome.slice(0, 500),
      workflow_id: opts.workflowId || null, model: opts.model || null,
      completed_at: new Date().toISOString(),
    },
  });

/** A founder correction — when the founder overrides/rejects, the lesson is recorded. */
export const recordFounderCorrection = (
  supabase: SupabaseClient,
  opts: { about: string; correction: string; referenceId?: string | null },
) =>
  recordMemory(supabase, {
    agent_profile: 'founder',
    memory_type: 'preference',
    key: `correction:${opts.about}`.slice(0, 200),
    value: {
      what: 'founder correction', about: opts.about, correction: opts.correction.slice(0, 500),
      reference_id: opts.referenceId || null, recorded_at: new Date().toISOString(),
    },
  });

/**
 * Ledger replay — filterable by agent/client/type/date. Expired entries are
 * HONORED: they surface with expired=true (shown as expired, not as truth) —
 * never silently dropped, never presented as current.
 */
export async function ledgerReplay(
  supabase: SupabaseClient,
  filters: { agent?: string; clientId?: string; type?: string; since?: string; limit?: number } = {},
): Promise<{ entries: any[] }> {
  let query = supabase
    .from('agent_memory')
    .select('id, agent_profile, memory_type, key, value, expires_at, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit || 200, 1000));
  if (filters.agent) query = query.eq('agent_profile', filters.agent);
  if (filters.type) query = query.eq('memory_type', filters.type);
  if (filters.since) query = query.gte('created_at', filters.since);
  if (filters.clientId) query = query.eq('value->>client_id', filters.clientId);
  const { data, error } = await query;
  if (error) throw error;

  const now = new Date().toISOString();
  const entries = (data || []).map((e: any) => ({
    ...e,
    expired: !!(e.expires_at && e.expires_at < now),
  }));
  // Expired sink to the bottom of the replay (current truth first) but stay
  // visible — expiry honored, not hidden.
  entries.sort((a: any, b: any) => Number(a.expired) - Number(b.expired));
  return { entries };
}
