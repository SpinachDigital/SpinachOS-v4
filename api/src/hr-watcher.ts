/*
 * hr-watcher.ts — Sprint 5c: HR Department watcher (5 min, batched + idempotent).
 *
 * Flags (NEVER pauses/stops/reassigns anything by itself):
 *   stuck       (high)   — running task > 4h; message names task + elapsed
 *   overloaded  (medium) — agent with ≥ 3 queued tasks
 *   idle        (low)    — active agent with no activity in 24h
 *   error_spike (high)   — agent with ≥ 3 failed tasks in the last 1h
 * Auto-resolve when the condition clears (resolved_by = 'watcher').
 *
 * Laya drafts the human-readable flag message when available (laya fast path §3);
 * the fallback template is deterministic.
 */
import cron from 'node-cron';
import { supabase } from './ctx';

const HR_WATCHER_RUNNING = { armed: false };

const LAYA_URL = process.env.LAYA_URL || 'http://localhost:8000';

// Laya fast path: draft the flag message (System 1, short). Fallback = template.
async function draftFlagMessage(kind: string, detail: string, fallback: string): Promise<string> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`${LAYA_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `One-line HR flag message (max 18 words, Hinglish OK, direct). Kind: ${kind}. Fact: ${detail}. No fluff, no suggestions.`,
        max_tokens: 60,
        temperature: 0.3,
      }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      const msg = (j.response || j.text || j.output || '').trim();
      if (msg && msg.length <= 220) return msg;
    }
  } catch {
    // Laya down — deterministic fallback
  }
  return fallback;
}

export const runHrWatcherOnce = async (): Promise<{ created: number; resolved: number }> => {
  let created = 0;
  let resolved = 0;
  const now = Date.now();

  // ---- current live state ----
  const { data: states } = await supabase.from('agent_states').select('profile, state, activity, updated_at');
  const { data: agents } = await supabase.from('hr_agents').select('id, status, name');
  const liveStates = new Map((states || []).map(s => [s.profile, s]));
  const activeAgents = new Map((agents || []).filter(a => a.status === 'active').map(a => [a.id, a]));

  // ---- 1. stuck: running tasks > 4h ----
  const fourHoursAgo = new Date(now - 4 * 3600 * 1000).toISOString();
  const { data: stuckTasks } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, metadata, created_at')
    .eq('status', 'running')
    .lt('created_at', fourHoursAgo);
  const stuckByAgent = new Map<string, { taskId: string; title: string; started: string }[]>();
  for (const t of stuckTasks || []) {
    if (!t.assigned_to) continue;
    const started = t.metadata?.started_at || t.created_at;
    if (!stuckByAgent.has(t.assigned_to)) stuckByAgent.set(t.assigned_to, []);
    stuckByAgent.get(t.assigned_to)!.push({ taskId: t.id, title: t.title, started });
  }

  // ---- 2. overloaded: ≥3 queued tasks (status 'ready' assigned) ----
  const { data: queued } = await supabase.from('tasks').select('id, assigned_to').eq('status', 'ready');
  const queueDepth = new Map<string, number>();
  for (const t of queued || []) {
    if (!t.assigned_to) continue;
    queueDepth.set(t.assigned_to, (queueDepth.get(t.assigned_to) || 0) + 1);
  }

  // ---- 3. error_spike: ≥3 failed tasks in 1h (status 'blocked', updated in the hour) ----
  const hourAgo = new Date(now - 3600 * 1000).toISOString();
  const { data: failed } = await supabase
    .from('tasks')
    .select('id, assigned_to, title')
    .eq('status', 'blocked')
    .gte('updated_at', hourAgo);
  const failedByAgent = new Map<string, number>();
  for (const t of failed || []) {
    if (!t.assigned_to) continue;
    failedByAgent.set(t.assigned_to, (failedByAgent.get(t.assigned_to) || 0) + 1);
  }

  // ---- desired flag state per agent ----
  type Desired = { kind: string; severity: 'low' | 'medium' | 'high'; detail: string; fallback: string; taskId?: string };
  const desired = new Map<string, Desired[]>(); // agent_id → flags

  const addFlag = (agentId: string, f: Desired) => {
    if (!desired.has(agentId)) desired.set(agentId, []);
    desired.get(agentId)!.push(f);
  };

  for (const [agentId, items] of Array.from(stuckByAgent.entries())) {
    if (!activeAgents.has(agentId)) continue;
    const first = items[0];
    const elapsed = ((now - new Date(first.started).getTime()) / 3600000).toFixed(1);
    addFlag(agentId, {
      kind: 'stuck', severity: 'high',
      detail: `${items.length} running task(s) > 4h on ${agentId}`,
      fallback: `Stuck: "${String(first.title).slice(0, 60)}" ${elapsed}h se running hai (${agentId}) — check karo.`,
      taskId: first.taskId,
    });
  }

  for (const [agentId, depth] of Array.from(queueDepth.entries())) {
    if (depth < 3 || !activeAgents.has(agentId)) continue;
    addFlag(agentId, {
      kind: 'overloaded', severity: 'medium',
      detail: `${depth} queued tasks on ${agentId}`,
      fallback: `Overloaded: ${agentId} ke queue me ${depth} tasks hain — rebalance socho.`,
    });
  }

  for (const [agentId] of Array.from(activeAgents.keys())) {
    const st = liveStates.get(agentId);
    const lastActivity = st?.updated_at || st?.activity;
    const idleHours = lastActivity ? (now - new Date(lastActivity).getTime()) / 3600000 : 999;
    if (idleHours < 24) continue;
    // only flag idle if the agent isn't already flagged stuck/overloaded
    addFlag(agentId, {
      kind: 'idle', severity: 'low',
      detail: `no activity ${idleHours >= 999 ? 'recorded' : idleHours.toFixed(0) + 'h'} on ${agentId}`,
      fallback: `Idle: ${agentId} me 24h+ se koi activity nahi — active hai par kaam nahi dikha.`,
    });
  }

  for (const [agentId, n] of Array.from(failedByAgent.entries())) {
    if (n < 3 || !activeAgents.has(agentId)) continue;
    addFlag(agentId, {
      kind: 'error_spike', severity: 'high',
      detail: `${n} failed tasks in the last 1h on ${agentId}`,
      fallback: `Error spike: ${agentId} ke ${n} tasks last 1h me fail hue — root cause dekho.`,
    });
  }

  // ---- reconcile: create missing open flags, resolve stale ones ----
  const { data: openFlags } = await supabase
    .from('hr_flags')
    .select('id, agent_id, type, message')
    .is('resolved_at', null);
  const openKey = new Set((openFlags || []).map(f => `${f.agent_id}:${f.type}`));
  const desiredKey = new Set<string>();
  for (const [agentId, flags] of Array.from(desired.entries())) for (const f of flags) desiredKey.add(`${agentId}:${f.kind}`);

  // create missing (idempotent — skip if an open flag of the same type exists)
  for (const [agentId, flags] of Array.from(desired.entries())) {
    for (const f of flags) {
      if (openKey.has(`${agentId}:${f.kind}`)) continue;
      const message = await draftFlagMessage(f.kind, f.detail, f.fallback);
      const { error } = await supabase.from('hr_flags').insert({
        agent_id: agentId, type: f.kind, severity: f.severity, message,
      });
      if (!error) {
        created++;
        // audit trail (watcher action)
        await supabase.from('hr_actions').insert({
          actor: 'watcher', action: 'flag', agent_id: agentId, task_id: f.taskId || null, reason: message,
        });
        console.log(`[hr-watcher] +${f.severity} ${f.kind} → ${agentId}: ${message.slice(0, 80)}`);
      } else if (!/duplicate key/i.test(error.message || '')) {
        console.error(`[hr-watcher] flag insert failed (${agentId}/${f.kind}):`, error.message);
      }
    }
  }

  // auto-resolve when clear (resolved_by = 'watcher')
  for (const f of openFlags || []) {
    if (desiredKey.has(`${f.agent_id}:${f.type}`)) continue;
    const { error } = await supabase
      .from('hr_flags')
      .update({ resolved_at: new Date().toISOString(), resolved_by: 'watcher' })
      .eq('id', f.id)
      .is('resolved_at', null);
    if (!error) {
      resolved++;
      await supabase.from('hr_actions').insert({
        actor: 'watcher', action: 'resolve', agent_id: f.agent_id, reason: `auto-resolved: ${f.type} clear`,
      });
      console.log(`[hr-watcher] resolved ${f.type} → ${f.agent_id}`);
    }
  }

  return { created, resolved };
};


export const startHrWatcher = () => {
  if (HR_WATCHER_RUNNING.armed) return;
  try {
    // 5 min schedule, batched + idempotent
    cron.schedule('*/5 * * * *', async () => {
      try {
        const r = await runHrWatcherOnce();
        if (r.created || r.resolved) console.log(`[hr-watcher] ${new Date().toISOString()} created=${r.created} resolved=${r.resolved}`);
      } catch (e: any) {
        console.error('[hr-watcher] run failed:', e?.message);
      }
    });
    HR_WATCHER_RUNNING.armed = true;
    console.log('[hr-watcher] armed: */5 * * * * — stuck/overloaded/idle/error_spike (flags only, never pauses)');
  } catch (e: any) {
    console.error('[hr-watcher] arm failed:', e?.message);
  }
};
