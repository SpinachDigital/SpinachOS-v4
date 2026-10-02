'use client';

/*
 * Sprint 8 §3 — Task live visibility ("pata nahi kya ho raha hai" fix).
 * A live status strip on every task: current step/stage, last activity,
 * which agent is on it. WS-driven (task_lifecycle / task_update events —
 * the exact contract the API already emits) with a 10s poll fallback —
 * matching the pipeline detail page pattern. Max 10s staleness.
 * Honest `idle` when nothing is happening. Never invents.
 */
import { useEffect, useState } from 'react';
import { buildWsUrl } from '@/lib/auth';

type Live = {
  status: string;          // running | done | blocked | idle
  activity: string | null; // current step / last activity text
  agent: string | null;
  at: string | null;       // last event timestamp
  source: 'ws' | 'poll' | 'none';
};

const STALE_MS = 10_000;

export function useTaskLive(taskId: string, initial?: { status: string; assigned_to: string | null; updated_at: string | null }) {
  const [live, setLive] = useState<Live>(() => ({
    status: initial?.status || 'idle',
    activity: null,
    agent: initial?.assigned_to || null,
    at: initial?.updated_at || null,
    source: 'none',
  }));

  // WS: task_lifecycle + task_update for this task
  useEffect(() => {
    if (!taskId) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = () => {
      if (closed) return;
      try { ws = new WebSocket(buildWsUrl('/ws')); } catch { retry = setTimeout(connect, 5000); return; }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const d = msg.data ?? {};
          const ev = msg.event;
          if ((ev === 'task_lifecycle' || ev === 'task_update') && d.task_id === taskId) {
            setLive({
              status: d.status || 'running',
              activity: d.activity || d.details?.activity || null,
              agent: d.agent || null,
              at: d.timestamp || new Date().toISOString(),
              source: 'ws',
            });
          }
        } catch { /* malformed */ }
      };
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 5000); };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };
    connect();
    return () => { closed = true; if (retry) clearTimeout(retry); try { ws?.close(); } catch { /* noop */ } };
  }, [taskId]);

  // Staleness: if the last live event is older than 10s and status is 'running',
  // poll the task detail endpoint (same pattern as the pipeline detail page).
  useEffect(() => {
    if (!taskId) return;
    const t = setInterval(async () => {
      setLive((cur) => {
        if (cur.status !== 'running' || (cur.at && Date.now() - new Date(cur.at).getTime() < STALE_MS)) return cur;
        return { ...cur, source: 'poll' };
      });
      // fire the poll only when stale
      setLive((cur) => {
        if (cur.source !== 'poll') return cur;
        (async () => {
          try {
            const res = await fetch(`/api/v1/tasks/${taskId}`);
            if (res.ok) {
              const detail = await res.json();
              setLive({
                status: detail.task?.status === 'running' ? 'running' : detail.task?.status === 'done' ? 'done' : detail.task?.status === 'blocked' ? 'blocked' : 'idle',
                activity: detail.timeline?.[0]?.detail || null,
                agent: detail.task?.assigned_to || null,
                at: detail.timeline?.[0]?.at || new Date().toISOString(),
                source: 'poll',
              });
            }
          } catch { /* honest: keep last known */ }
        })();
        return { ...cur, source: 'ws' };
      });
    }, STALE_MS);
    return () => clearInterval(t);
  }, [taskId]);

  return live;
}

export function TaskLiveStrip({ taskId, initial }: { taskId: string; initial?: { status: string; assigned_to: string | null; updated_at: string | null } }) {
  const live = useTaskLive(taskId, initial);
  const isLive = live.status === 'running';
  const color = live.status === 'running' ? '#1d4ed8' : live.status === 'done' ? '#15803d' : live.status === 'blocked' ? '#b91c1c' : '#475569';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 14px', borderRadius: 12, marginBottom: 14,
      background: 'var(--bg-2, #fafaf7)', border: '1px solid var(--border-soft, #eee)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, animation: isLive ? 'dotPulse 1.2s ease-in-out infinite' : 'none' }} />
      <span className="t-mono" style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>
        {live.status === 'idle' ? 'idle' : live.status}
      </span>
      <span className="t-meta" style={{ fontSize: 12, color: 'var(--text-dim, #333)', flex: 1, minWidth: 180 }}>
        {live.activity || (isLive ? 'Agent is working — no step data yet' : 'Nothing happening right now')}
      </span>
      <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
        {live.agent ? `@${live.agent}` : 'unassigned'}
        {live.at ? ` · ${new Date(live.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
        {live.source === 'poll' ? ' · polled' : live.source === 'ws' ? ' · live' : ''}
      </span>
    </div>
  );
}

export default TaskLiveStrip;
