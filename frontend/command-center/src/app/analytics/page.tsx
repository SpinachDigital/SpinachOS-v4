'use client';

// Insights — Monitor surface. Overview stats + Audit Log tab (absorbs /logs).
// Data: /api/v1/agents/states (agent states) + /api/v1/logs (audit trail).
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

interface AgentStateRow {
  profile: string;
  state: string;
  activity?: string;
  updated_at: string;
}

interface LogRow {
  id: string;
  profile?: string;
  agent?: string;
  action?: string;
  status?: string;
  created_at: string;
}

type Tab = 'overview' | 'audit';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [agents, setAgents] = useState<AgentStateRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [aRes, lRes] = await Promise.all([
        apiFetch('http://localhost:4000/api/v1/agent-states'),
        apiFetch('http://localhost:4000/api/v1/logs?limit=50'),
      ]);
      if (aRes.ok) setAgents(await aRes.json());
      if (lRes.ok) setLogs(await lRes.json());
    } catch (e) {
      console.error('Failed to fetch insights:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const working = agents.filter(a => a.state === 'working' || a.state === 'thinking').length;
  const blocked = agents.filter(a => a.state === 'blocked').length;
  const successRate = logs.length > 0
    ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100)
    : 0;

  const filteredLogs = filter
    ? logs.filter(l => (l.profile || '').includes(filter) || (l.action || '').includes(filter))
    : logs;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-page)' }}>
      {/* Header + tabs */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <h1 className="t-title" style={{ color: 'var(--ink)' }}>Insights</h1>
        <p className="t-meta mt-0.5" style={{ color: 'var(--ink-3)' }}>Agent throughput & audit trail</p>
        <div className="flex items-center gap-1 mt-4">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'audit', label: 'Audit Log' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="btn btn-sm"
              style={{
                background: tab === t.id ? 'var(--ink)' : 'var(--bg-elevated)',
                color: tab === t.id ? 'var(--bg-page)' : 'var(--ink-2)',
                boxShadow: tab === t.id ? 'none' : 'var(--shadow-card)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="t-mono" style={{ color: 'var(--ink-3)' }}>Loading…</div>
        </div>
      ) : tab === 'overview' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Inline stats row */}
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2">
              <span className="t-mono" style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 20 }}>{working}</span>
              <span className="t-meta" style={{ color: 'var(--ink-3)' }}>Working now</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="t-mono" style={{ color: 'var(--red)', fontWeight: 700, fontSize: 20 }}>{blocked}</span>
              <span className="t-meta" style={{ color: 'var(--ink-3)' }}>Blocked</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="t-mono" style={{ color: 'var(--green)', fontWeight: 700, fontSize: 20 }}>{successRate}%</span>
              <span className="t-meta" style={{ color: 'var(--ink-3)' }}>Success rate</span>
            </span>
          </div>

          {/* Agent states */}
          <section>
            <div className="section-head">
              <span className="t-label" style={{ color: 'var(--ink-3)' }}>Agent states</span>
              <span className="t-meta" style={{ color: 'var(--ink-4)' }}>{agents.length} agents</span>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-card)' }}>
              {agents.map((a, i) => (
                <div key={a.profile + i} className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: i < agents.length - 1 ? '1px solid var(--border-hairline)' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <span className={`dot ${a.state === 'working' ? 'dot-teal dot-pulse' : a.state === 'blocked' ? 'dot-red' : 'dot-gray'}`} />
                    <span className="t-body-md capitalize" style={{ color: 'var(--ink)' }}>{a.profile}</span>
                  </div>
                  <div className="flex items-center gap-4 min-w-0">
                    {a.activity && <span className="t-meta truncate max-w-xs" style={{ color: 'var(--ink-3)' }}>{a.activity}</span>}
                    <span className="t-mono" style={{ color: 'var(--ink-4)', fontSize: 11 }}>{a.state}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Audit log — filterable */}
          <input
            className="input mb-4"
            placeholder="Filter by profile or action…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-card)' }}>
            {filteredLogs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="t-body" style={{ color: 'var(--ink-3)' }}>No log entries match</p>
              </div>
            ) : (
              filteredLogs.map((l, i) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: i < filteredLogs.length - 1 ? '1px solid var(--border-hairline)' : 'none' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="t-mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>{l.profile || l.agent || 'system'}</span>
                    <span className="t-body-md truncate" style={{ color: 'var(--ink)' }}>{l.action}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`badge ${l.status === 'success' ? 'badge-green' : l.status === 'error' ? 'badge-red' : 'badge-gray'}`}>
                      {l.status || '—'}
                    </span>
                    <span className="feed-time">{new Date(l.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
