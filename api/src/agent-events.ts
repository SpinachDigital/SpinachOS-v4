/*
 * src/agent-events.ts — N3 §1: the typed agent event stream.
 *
 * Contract (binding for the frontend): every event is
 *   { type, at, actor, summary, ref? }
 * type ∈ tool_call | progress | approval_requested | approval_decided
 *      | error | done
 *
 * Write path: agent_events table (migration-n3-agent-events.sql) — best
 * effort, never throws into the caller's flow. While the founder hasn't run
 * the migration yet, events still land in tasks.metadata.events (bounded
 * ring, last 50) so GET /api/v1/tasks/:id/events works from day one.
 *
 * Read path: GET /api/v1/threads/:id/events — bounded, newest-first. `:id`
 * accepts a task id, a thread id, or a thread's task reference; the route
 * lives in routes/events.ts.
 */
import { supabase } from './ctx';

export type AgentEventType =
  | 'tool_call' | 'progress' | 'approval_requested'
  | 'approval_decided' | 'error' | 'done';

export type AgentEvent = {
  type: AgentEventType;
  at: string;
  actor: string;
  summary: string;
  ref?: Record<string, unknown> | null;
};

const RING = 50;

/**
 * Ring append serialization — read-modify-write on tasks.metadata is racy
 * when several events fire in the same tick (observed: tool_call + progress
 * overwrote each other). A per-process chain makes appends atomic-ish;
 * Supabase row-level races across processes stay impossible here (one API).
 */
let _ringChain: Promise<void> = Promise.resolve();

/**
 * Emit one typed event. Fire-and-forget by design: an observability write
 * must never fail the work it observes.
 */
export async function emitAgentEvent(
  type: AgentEventType,
  actor: string,
  summary: string,
  opts: { taskId?: string | null; threadId?: string | null; ref?: Record<string, unknown> | null } = {},
): Promise<void> {
  const at = new Date().toISOString();
  const ev: AgentEvent = { type, at, actor, summary, ref: opts.ref ?? null };
  // The write STARTS only when its turn comes in the chain — defining the
  // async fn is not enough; invoking it would race the previous write's
  // read-modify-write window (observed: lost tool_call/progress events).
  const write = async () => {
    // 1) the typed table (best effort — may not exist until the migration runs)
    try {
      await supabase.from('agent_events').insert({
        type, actor, summary, ref: opts.ref ?? null,
        task_id: opts.taskId || null, thread_id: opts.threadId || null,
      });
    } catch { /* migration pending — the ring below still records it */ }
    // 2) the always-available ring on tasks.metadata.events
    if (opts.taskId) {
      try {
        const { data: t } = await supabase.from('tasks').select('metadata').eq('id', opts.taskId).single();
        const ring = [...(((t?.metadata as any)?.events) || []), ev].slice(-RING);
        await supabase.from('tasks').update({
          metadata: { ...((t?.metadata as any) || {}), events: ring },
        }).eq('id', opts.taskId);
      } catch (e: any) {
        console.error('[agent-events] ring write failed:', e?.message);
      }
    }
  };
  const turn = _ringChain.then(write).catch(() => { /* never reject the chain */ });
  _ringChain = turn;
  await turn;
}

/**
 * Await every in-flight ring write. The completion/error metadata merge in
 * agent-execution MUST call this before its fresh-read, otherwise a still
 * in-flight emit's ring append lands after the merge and is lost.
 */
export async function flushAgentEvents(): Promise<void> {
  await _ringChain.catch(() => { /* the chain never rejects */ });
}

/** Read a bounded, newest-first event list for a task (the queryable path). */
export async function readTaskEvents(taskId: string, limit = 100): Promise<AgentEvent[]> {
  try {
    const { data, error } = await supabase
      .from('agent_events')
      .select('type, created_at, actor, summary, ref')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200));
    if (!error && data) {
      return data.map((r: any) => ({ type: r.type, at: r.created_at, actor: r.actor, summary: r.summary, ref: r.ref }));
    }
  } catch { /* table pending */ }
  // fallback: the metadata ring (oldest→newest stored; reverse for newest-first)
  const { data: t } = await supabase.from('tasks').select('metadata').eq('id', taskId).single();
  const ring = ((t?.metadata as any)?.events) || [];
  return [...ring].reverse().slice(0, Math.min(limit, 200));
}
