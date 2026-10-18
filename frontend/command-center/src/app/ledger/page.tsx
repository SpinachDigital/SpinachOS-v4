/*
 * app/ledger/page.tsx — Sprint 12 §2: the Company Memory Ledger replay view.
 * Timeline filterable by agent / type / date. Click an entry → full context
 * (what was decided, by whom, the payload at the time). Expiry HONORED —
 * expired entries show as expired, not as truth. 44px targets, clean 360px.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

type Entry = {
  id: string; agent_profile: string; memory_type: string; key: string;
  value: any; expires_at: string | null; expired?: boolean; created_at: string;
};

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  client: { bg: 'rgba(0,75,99,0.10)', color: '#004B63' },
  decision: { bg: 'rgba(76,175,80,0.14)', color: '#2e7d32' },
  pattern: { bg: 'rgba(100,116,139,0.14)', color: '#475569' },
  preference: { bg: 'rgba(245,158,11,0.16)', color: '#b45309' },
};

// Blank titles used to render as an empty line above "@agent · date".
// Fall back to an honest label instead of a blank row.
const entryTitle = (e: Entry): string => {
  const t = e.value?.title ?? e.value?.what ?? e.key;
  const base = typeof t === 'string' && t.trim() ? t : '';
  // UX pass (2026-10-17): bare event names ("task completion", "pattern")
  // are meaningless in a list — enrich with the entry key / task subject.
  const GENERIC = /^(task completion|pattern|event|note|update)$/i;
  if (!base || GENERIC.test(base.trim())) {
    let k = typeof e.key === 'string' && e.key.trim() && !GENERIC.test(e.key.trim()) ? e.key.trim() : '';
    // Founder retest (2026-10-18): raw task UUIDs read as machine noise.
    // "task:2614705b-…" -> "run 2614705b" — short, still traceable.
    k = k.replace(/^task:\s?([0-9a-f]{8})[0-9a-f-]*$/i, 'run $1');
    return k ? `${base || 'Event'} — ${k}` : (base || 'Untitled entry');
  }
  return base;
};

// Probe/test rows sometimes carry garbage timestamps. Anything more than
// 24h in the future is a data error — say so, keep the raw value in the
// title attribute for debugging.
const FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const entryDate = (iso: string | null | undefined): { text: string; raw: string } => {
  const raw = iso ?? '';
  const ms = new Date(raw).getTime();
  if (!raw || Number.isNaN(ms) || ms - Date.now() > FUTURE_SKEW_MS) {
    return { text: 'Date unavailable', raw };
  }
  return { text: new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), raw };
};

// R3: raw internal prefixes ("gateway:ceo", "dept_research") → human names.
const humanAgent = (a: string): string =>
  a.replace(/^gateway:/, '').replace(/^dept_/, '').replace(/\b\w/g, (c) => c.toUpperCase());

export default function LedgerPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [detail, setDetail] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (agentFilter) params.set('agent', agentFilter);
      params.set('limit', '300');
      const res = await apiFetch(`/api/v1/ledger?${params.toString()}`);
      const data = res.ok ? await res.json() : [];
      setEntries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, agentFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiFetch('/api/v1/ledger/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setStats(d);
        if (d?.by_agent) setAgents(Object.keys(d.by_agent));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg, transparent)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Memory Ledger</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Every decision, approval, and correction — replayable
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* Stats strip — inline text, not monument cards */}
      <div className="flex items-center gap-6 px-6 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{stats?.total ?? '—'}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>entries</span>
        </span>
        {stats?.by_type && Object.entries(stats.by_type).map(([t, n]) => (
          <span key={t} className="flex items-center gap-2">
            <span className="t-mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>{String(n)}</span>
            <span className="t-meta" style={{ color: 'var(--text-faint)' }}>{t}</span>
          </span>
        ))}
        {(stats?.expired ?? 0) > 0 && (
          <span className="flex items-center gap-2">
            <span className="t-mono" style={{ color: 'var(--text-faint)', fontWeight: 700, fontSize: 13 }}>{stats.expired}</span>
            <span className="t-meta" style={{ color: 'var(--text-faint)' }}>expired (shown, not current)</span>
          </span>
        )}
      </div>

      {/* Filters — ≥44px targets */}
      <div className="flex items-center gap-2 px-6 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        {['all', 'decision', 'pattern', 'preference', 'client'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            aria-label={`Filter ${t}`}
            className="t-mono"
            style={{
              minHeight: 44, padding: '8px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              border: '1px solid ' + (typeFilter === t ? 'var(--accent, #004B63)' : 'var(--border-hairline)'),
              background: typeFilter === t ? 'var(--accent-dim, rgba(0,75,99,0.08))' : 'transparent',
              color: typeFilter === t ? 'var(--accent, #004B63)' : 'var(--text-faint)',
              fontWeight: typeFilter === t ? 700 : 500,
            }}
          >
            {t}
          </button>
        ))}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          aria-label="Filter by agent"
          className="t-mono"
          style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, fontSize: 12, border: '1px solid var(--border-hairline)', background: 'var(--card)', color: 'var(--text)' }}
        >
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{humanAgent(a)}</option>)}
        </select>
      </div>

      {/* Replay timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-faint)' }}>
            <span className="t-mono">Loading ledger…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--red, #b91c1c)' }}>
            <p className="t-meta">{error}</p>
            <button onClick={() => void load()} className="btn btn-secondary btn-sm mt-3" style={{ minHeight: 44 }}>Retry</button>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', borderRadius: 16, border: '1px solid var(--border-hairline)' }}>
            <p className="t-meta" style={{ color: 'var(--text-faint)' }}>
              No entries{typeFilter !== 'all' ? ` of type "${typeFilter}"` : ''} yet — decisions, approvals, and corrections land here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((e) => {
              const ts = TYPE_STYLE[e.memory_type] || TYPE_STYLE.pattern;
              const title = entryTitle(e);
              const when = entryDate(e.created_at);
              return (
                <article
                  key={e.id}
                  onClick={() => setDetail(e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-hairline)',
                    background: 'var(--card, #fff)', cursor: 'pointer',
                    opacity: e.expired ? 0.65 : 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <span className="t-mono" style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em', background: ts.bg, color: ts.color,
                    flexShrink: 0,
                  }}>
                    {e.memory_type}
                  </span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p className="t-meta" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', wordBreak: 'break-word' }}>
                      {title}
                    </p>
                    <p className="t-mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }} title={when.raw || undefined}>
                      @{humanAgent(e.agent_profile)} · {when.text}
                    </p>
                  </div>
                  {e.expired && (
                    <span className="t-mono" style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'var(--bg-2)', color: 'var(--text-faint)', flexShrink: 0 }}>
                      EXPIRED
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal — full context: what, by whom, the payload at the time */}
      {detail && (() => {
        const mTitle = entryTitle(detail);
        const mWhen = entryDate(detail.created_at);
        return (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card, #fff)', borderRadius: 16, padding: 20, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border-hairline)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <h3 className="t-meta" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                {mTitle}
                {detail.expired && <span className="t-mono" style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'var(--bg-2)', color: 'var(--text-faint)' }}>EXPIRED</span>}
              </h3>
              <button onClick={() => setDetail(null)} className="t-mono" style={{ minHeight: 44, padding: '4px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16 }}>✕</button>
            </div>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }} title={mWhen.raw || undefined}>
              @{humanAgent(detail.agent_profile)} · {detail.memory_type} · decided {mWhen.text}
              {detail.expires_at && ` · expires ${new Date(detail.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`}
            </p>
            <pre className="t-mono" style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: 'var(--bg-2, #fafaf7)', padding: 12, borderRadius: 10, border: '1px solid var(--border-soft)' }}>
              {JSON.stringify(detail.value, null, 2)}
            </pre>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
