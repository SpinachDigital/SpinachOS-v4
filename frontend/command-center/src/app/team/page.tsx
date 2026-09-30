'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface RosterAgent {
  id: string;
  name: string;
  department: string;
  role: string | null;
  specialization: string | null;
  skills: string[];
  status: 'working' | 'idle' | 'paused';
  live_state: string;
  activity: string | null;
  current_task: { id: string; title: string; progress: number } | null;
  queue_depth: number;
  week_completed: number;
  updated_at: string | null;
}

interface Flag {
  id: string;
  agent_id: string;
  type: 'stuck' | 'overloaded' | 'idle' | 'error_spike';
  severity: 'low' | 'medium' | 'high';
  message: string;
  created_at: string;
  hr_agents?: { name: string; department: string; role: string } | null;
}

interface WeeklyStats {
  per_agent: { agent_id: string; name: string; department: string; completed: number; avg_duration_min: number }[];
  departments: { department: string; completed: number; agents: number }[];
  total_completed: number;
}

interface Activity {
  id: string;
  actor: string;
  action: string;
  agent_id: string | null;
  task_id: string | null;
  reason: string | null;
  created_at: string;
}

const SEV_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' };
const SEV_DOT: Record<string, string> = { high: '🔴', medium: '🟠', low: '⚪' };
const STATUS_CHIP: Record<string, { dot: string; label: string }> = {
  working: { dot: '🟢', label: 'working' },
  idle: { dot: '⚪', label: 'idle' },
  paused: { dot: '⏸', label: 'paused' },
};
const FLAG_ICON: Record<string, string> = { stuck: '🧱', overloaded: '📦', idle: '💤', error_spike: '⚡' };

const initials = (name: string) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function TeamPage() {
  const [roster, setRoster] = useState<RosterAgent[] | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [drawer, setDrawer] = useState<RosterAgent | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [r, f, w, a] = await Promise.all([
        fetch('/api/v1/hr/roster?limit=100'),
        fetch('/api/v1/hr/flags?limit=50'),
        fetch('/api/v1/hr/stats/weekly'),
        fetch('/api/v1/hr/activity?limit=20'),
      ]);
      if (!r.ok) { setOffline(true); setLastSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })); setLoading(false); return; }
      const rj = await r.json();
      setRoster(rj.agents || []);
      if (f.ok) setFlags((await f.json()).flags || []);
      if (w.ok) setWeekly(await w.json());
      if (a.ok) setActivity((await a.json()).activity || []);
      setOffline(false);
      setLastSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setOffline(true);
      setLastSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  // 30s refresh while the page is open
  useEffect(() => {
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const act = async (fn: () => Promise<Response>) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) { await fetchAll(); return true; }
      const j = await res.json().catch(() => ({}));
      alert(j.error || `Action failed (${res.status})`);
      return false;
    } catch {
      alert('API unreachable');
      return false;
    } finally { setBusy(false); }
  };

  const pauseAgent = (a: RosterAgent, reason: string) => act(() => fetch(`/api/v1/hr/agents/${a.id}/pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }));
  const resumeAgent = (a: RosterAgent) => act(() => fetch(`/api/v1/hr/agents/${a.id}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }));
  const resolveFlag = (f: Flag) => act(() => fetch(`/api/v1/hr/flags/${f.id}/resolve`, { method: 'POST' }));
  const stopTask = (taskId: string, reason: string) => act(() => fetch(`/api/v1/hr/tasks/${taskId}/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }));
  const reassignTask = (taskId: string, toAgent: string, note: string) => act(() => fetch(`/api/v1/hr/tasks/${taskId}/reassign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to_agent: toAgent, note }) }));

  if (loading) return <div className="p-6" style={{ color: 'var(--text-faint)' }}>Loading team...</div>;

  const departments = Array.from(new Set((roster || []).map(a => a.department))).sort();
  const filtered = (roster || []).filter(a =>
    (deptFilter === 'all' || a.department === deptFilter) &&
    (!search || `${a.name} ${a.role || ''} ${a.department} ${a.specialization || ''}`.toLowerCase().includes(search.toLowerCase()))
  );
  const workingCount = (roster || []).filter(a => a.status === 'working').length;
  const idleCount = (roster || []).filter(a => a.status === 'idle').length;
  const pausedCount = (roster || []).filter(a => a.status === 'paused').length;
  const flaggedCount = (flags || []).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="page-head" style={{ padding: '18px 24px 0' }}>
        <div className="head-text">
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Team</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {offline
              ? `Agents offline — last known state from ${lastSync}`
              : `${roster?.length ?? 0} agents · 🟢 ${workingCount} working · ⚪ ${idleCount} idle · 🔴 ${flaggedCount} flagged · ⏸ ${pausedCount} paused`}
          </p>
        </div>
        <button onClick={fetchAll} className="btn btn-secondary btn-sm">Refresh</button>
      </div>

      <div style={{ padding: '14px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* search + dept filter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, role, dept..."
            className="t-body"
            style={{
              flex: '1 1 220px', minWidth: 0, padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--border-soft)', background: 'var(--panel)', color: 'var(--text)', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setDeptFilter('all')} className="btn btn-sm" style={{
              border: '1px solid ' + (deptFilter === 'all' ? 'var(--accent)' : 'var(--border-soft)'),
              background: deptFilter === 'all' ? 'var(--accent-soft, rgba(0,75,99,0.12))' : 'var(--panel)',
              color: deptFilter === 'all' ? 'var(--accent)' : 'var(--text-dim)',
            }}>All</button>
            {departments.map(d => (
              <button key={d} onClick={() => setDeptFilter(d)} className="btn btn-sm" style={{
                border: '1px solid ' + (deptFilter === d ? 'var(--accent)' : 'var(--border-soft)'),
                background: deptFilter === d ? 'var(--accent-soft, rgba(0,75,99,0.12))' : 'var(--panel)',
                color: deptFilter === d ? 'var(--accent)' : 'var(--text-dim)',
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* flags panel — severity-sorted, one-click actions */}
        {flags && flags.length > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
            <div style={{ fontSize: 11, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 700 }}>⚠ Flags ({flags.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flags.map(f => (
                <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{SEV_DOT[f.severity]} {FLAG_ICON[f.type]}</span>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                      {f.hr_agents?.name || f.agent_id} <span style={{ color: SEV_COLOR[f.severity], fontSize: 10, fontWeight: 700 }}>{f.severity.toUpperCase()} {f.type.replace('_', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{f.message}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button disabled={busy} onClick={() => resolveFlag(f)} className="btn btn-sm btn-secondary">Resolve</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {flags && flags.length === 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--panel)', fontSize: 13, color: 'var(--text-dim)' }}>
            All clear 🎉 — no open flags.
          </div>
        )}

        {/* roster grid */}
        {!roster ? null : filtered.length === 0 ? (
          <div style={{ padding: 18, borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--panel)', fontSize: 13, color: 'var(--text-dim)' }}>
            No agents match{search ? ` "${search}"` : ''}{deptFilter !== 'all' ? ` in ${deptFilter}` : ''}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map(a => {
              const chip = STATUS_CHIP[a.status] || STATUS_CHIP.idle;
              return (
                <button key={a.id} onClick={() => setDrawer(a)} className="t-left" style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid var(--border-soft)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-soft, rgba(0,75,99,0.12))', color: 'var(--accent)', fontSize: 12, fontWeight: 700,
                    }}>{initials(a.name)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.role || a.department} · {a.department}</div>
                    </div>
                    <span style={{ fontSize: 12, flexShrink: 0 }} title={a.status}>{chip.dot}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.current_task ? <>✍️ {a.current_task.title}</> : (a.activity || 'No current task')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(a.queue_depth * 20, 100)}%`, height: '100%',
                        background: a.queue_depth >= 3 ? '#f59e0b' : 'var(--accent)',
                      }} />
                    </div>
                    <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>q{a.queue_depth}</span>
                    <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>✓{a.week_completed}/wk</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* weekly stats — CSS bars, real data */}
        {weekly && weekly.per_agent.length > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--panel)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Weekly stats — {weekly.total_completed} completed (7d)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {weekly.per_agent.filter(p => p.completed > 0).sort((x, y) => y.completed - x.completed).map(p => {
                const max = Math.max(...weekly.per_agent.map(q => q.completed), 1);
                return (
                  <div key={p.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', width: 110, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border-soft)', overflow: 'hidden' }}>
                      <div style={{ width: `${(p.completed / max) * 100}%`, height: '100%', background: 'var(--accent)' }} />
                    </div>
                    <span className="t-mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', flexShrink: 0, width: 74, textAlign: 'right' }}>
                      {p.completed} · {p.avg_duration_min}m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* activity log */}
        {activity && activity.length > 0 && (
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-soft)', background: 'var(--panel)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Activity log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activity.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'baseline' }}>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>{new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{e.action.toUpperCase()}</span>
                  <span style={{ color: 'var(--text-dim)', minWidth: 0 }}>{e.actor}{e.agent_id ? ` → ${e.agent_id}` : ''}{e.reason ? ` — ${e.reason.slice(0, 70)}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* agent drawer */}
      {drawer && (
        <div
          onClick={() => setDrawer(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: 'min(420px, 100%)', height: '100%', overflowY: 'auto',
            background: 'var(--card, var(--panel))', borderLeft: '1px solid var(--border-soft)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-soft, rgba(0,75,99,0.12))', color: 'var(--accent)', fontSize: 13, fontWeight: 700,
                }}>{initials(drawer.name)}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{drawer.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{drawer.role} · {drawer.department}</div>
                </div>
              </div>
              <button onClick={() => setDrawer(null)} className="btn btn-sm btn-secondary">✕</button>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{drawer.specialization || '—'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(drawer.skills || []).map(s => (
                <span key={s} className="t-mono" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border-soft)', color: 'var(--text-dim)' }}>{s}</span>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current task</div>
            {drawer.current_task ? (
              <Link href={`/tasks/${drawer.current_task.id}`} className="t-body" style={{
                display: 'block', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--panel)', color: 'var(--text)', textDecoration: 'none',
              }}>
                ✍️ {drawer.current_task.title}
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border-soft)', overflow: 'hidden' }}>
                  <div style={{ width: `${drawer.current_task.progress}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <div className="t-mono" style={{ marginTop: 4, fontSize: 10, color: 'var(--text-faint)' }}>{drawer.current_task.progress}% — view task →</div>
              </Link>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No current task — idle.</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--panel)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Queue</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{drawer.queue_depth}</div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--panel)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>This week</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{drawer.week_completed}</div>
              </div>
            </div>

            {/* flag history for this agent */}
            <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Flags</div>
            {(flags || []).filter(f => f.agent_id === drawer.id).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No open flags.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(flags || []).filter(f => f.agent_id === drawer.id).map(f => (
                  <div key={f.id} style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                    <span>{SEV_DOT[f.severity]} {FLAG_ICON[f.type]}</span>
                    <span style={{ minWidth: 0 }}>{f.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 10 }}>
              {drawer.status === 'paused' ? (
                <button disabled={busy} onClick={() => { resumeAgent(drawer); setDrawer(null); }} className="btn btn-sm btn-primary" style={{ flex: 1 }}>▶ Resume</button>
              ) : (
                <button disabled={busy} onClick={() => {
                  const reason = window.prompt(`Pause ${drawer.name} — reason?`);
                  if (reason) { pauseAgent(drawer, reason); setDrawer(null); }
                }} className="btn btn-sm btn-secondary" style={{ flex: 1 }}>⏸ Pause (reason)</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
