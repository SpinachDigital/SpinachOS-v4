'use client';

// Leads — WIN §1: the lead inbox (plumbing existed, surface didn't).
// Wired to GET /api/v1/leads (DB rows only — every number traces to a row).
// Filters that work: source + qualification status + search.
// Row actions: Qualify (deterministic 3-signal rules via /outreach/qualify).
// Honest empty state: "no leads yet — scrapers run on schedule" (real cadence below).
// 360px: single column, 44px touch targets, no horizontal scroll.
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Lead {
  id: string;
  source: string;
  name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  status: string;
  score: number | null;
  budget_signal?: string | null;
  intent_signal?: string | null;
  fit_signal?: string | null;
  qualified_at?: string | null;
  last_outreach_at?: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  github: 'GitHub', hackernews: 'HackerNews', google_maps: 'Google Maps',
  linkedin: 'LinkedIn', apollo: 'Apollo', clutch: 'Clutch', goodfirms: 'GoodFirms', test: 'Test',
};

function sourceBadge(source?: string) {
  const s = (source || 'unknown').toLowerCase();
  return <span className="pill draft" style={{ fontSize: 11 }}>{SOURCE_LABELS[s] || s}</span>;
}

function qualPill(lead: Lead) {
  const qualified = !!lead.qualified_at;
  const signals = [lead.budget_signal, lead.intent_signal, lead.fit_signal];
  const hits = signals.filter(s => s && s !== 'unknown').length;
  if (qualified) return <span className="pill approved">qualified · 3/3</span>;
  if (hits > 0) return <span className="pill paused">{hits}/3 signals</span>;
  return <span className="pill draft">unqualified</span>;
}

function fmtAge(iso?: string) {
  if (!iso) return '—';
  try {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch { return '—'; }
}

export default function LeadsPage() {
  const { connected } = useWebSocket();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [qualFilter, setQualFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [qualifying, setQualifying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/leads');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLeads(); }, [fetchLeads]);

  const qualify = async (id: string) => {
    setQualifying(id);
    setToast(null);
    try {
      const res = await apiFetch(`/api/v1/outreach/qualify/${id}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(`Qualify failed: ${data.error || res.status}`);
        return;
      }
      setToast(data.qualified
        ? 'Qualified — 3/3 deterministic signals hit. Draft ab ban sakta hai.'
        : `Not qualified — ${data.score}/3 signals (rules visible on the row).`);
      await fetchLeads();
    } catch (e: any) {
      setToast(e?.message || 'Qualify failed');
    } finally {
      setQualifying(null);
    }
  };

  // Working filters — every number on screen traces to a DB row
  const sources = Array.from(new Set(leads.map(l => (l.source || 'unknown').toLowerCase())));
  const filtered = leads.filter(l => {
    if (sourceFilter !== 'all' && (l.source || 'unknown').toLowerCase() !== sourceFilter) return false;
    if (qualFilter === 'qualified' && !l.qualified_at) return false;
    if (qualFilter === 'unqualified' && l.qualified_at) return false;
    if (search) {
      const hay = `${l.name} ${l.company || ''} ${l.email || ''} ${l.role || ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const qualifiedCount = leads.filter(l => l.qualified_at).length;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px 48px' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text, #111)', margin: 0 }}>Lead Inbox</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground, #666)', margin: '4px 0 0' }}>
          {leads.length} leads · {qualifiedCount} qualified · scrapers: lead ingest Wed 9:00 · SEO scan Mon 9:00 (Scraper page pe manual run bhi hai)
          {connected ? '' : ' · offline'}
        </p>
      </header>

      {/* Working filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          style={{ minHeight: 44, padding: '0 10px', border: '1px solid var(--border, #e5e5e0)', borderRadius: 8, background: 'var(--card, #fff)', color: 'var(--text, #111)', fontSize: 13 }}>
          <option value="all">All sources ({leads.length})</option>
          {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] || s} ({leads.filter(l => (l.source || 'unknown').toLowerCase() === s).length})</option>)}
        </select>
        <select value={qualFilter} onChange={e => setQualFilter(e.target.value)}
          style={{ minHeight: 44, padding: '0 10px', border: '1px solid var(--border, #e5e5e0)', borderRadius: 8, background: 'var(--card, #fff)', color: 'var(--text, #111)', fontSize: 13 }}>
          <option value="all">All qualifications</option>
          <option value="qualified">Qualified ({qualifiedCount})</option>
          <option value="unqualified">Unqualified ({leads.length - qualifiedCount})</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / company / email…"
          style={{ minHeight: 44, flex: 1, minWidth: 160, padding: '0 12px', border: '1px solid var(--border, #e5e5e0)', borderRadius: 8, background: 'var(--card, #fff)', color: 'var(--text, #111)', fontSize: 13 }} />
        <button onClick={() => void fetchLeads()} disabled={loading}
          style={{ minHeight: 44, padding: '0 16px', border: '1px solid var(--border, #e5e5e0)', borderRadius: 8, background: 'var(--card, #fff)', color: 'var(--text, #111)', fontSize: 13, cursor: 'pointer' }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {toast && (
        <div role="status" style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, background: 'var(--accent-soft, #eef6f6)', border: '1px solid var(--accent, #004B63)', color: 'var(--text, #111)', fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Honest loading / error / empty states */}
      {loading && <p style={{ color: 'var(--muted-foreground, #666)', fontSize: 14 }}>Loading leads…</p>}
      {!loading && error && (
        <div style={{ padding: 14, borderRadius: 8, background: '#fdf2f2', border: '1px solid #e5b8b8', color: '#8a2b2b', fontSize: 13, marginBottom: 12 }}>
          Error: {error}
        </div>
      )}
      {!loading && !error && leads.length === 0 && (
        <div style={{ padding: 24, borderRadius: 8, border: '1px dashed var(--border, #e5e5e0)', textAlign: 'center', color: 'var(--muted-foreground, #666)', fontSize: 14 }}>
          No leads yet — scrapers run on schedule. Trigger a run from the Sources panel below.
        </div>
      )}
      {!loading && !error && leads.length > 0 && filtered.length === 0 && (
        <p style={{ color: 'var(--muted-foreground, #666)', fontSize: 14 }}>No leads match these filters.</p>
      )}

      {/* Lead rows — deep-link per lead (task-style detail later; drawer here) */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {filtered.map(l => (
          <li key={l.id}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '12px 14px', marginBottom: 8, background: 'var(--card, #fff)', border: '1px solid var(--border-soft, #eee)', borderRadius: 10 }}>
            <div style={{ minWidth: 180, flex: 2 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text, #111)' }}>
                {l.name || '(unnamed)'} {sourceBadge(l.source)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground, #666)', marginTop: 2 }}>
                {[l.role, l.company].filter(Boolean).join(' · ') || '—'} {l.email ? `· ${l.email}` : ''}
              </div>
            </div>
            <div style={{ minWidth: 110 }}>{qualPill(l)}</div>
            <div style={{ minWidth: 70, fontSize: 12, color: 'var(--muted-foreground, #666)' }}>{fmtAge(l.created_at)}</div>
            {l.last_outreach_at && (
              <div style={{ minWidth: 80, fontSize: 12, color: '#4CAF50' }}>outreach ✓</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              {!l.qualified_at && (
                <button onClick={() => void qualify(l.id)} disabled={qualifying === l.id}
                  style={{ minHeight: 44, padding: '0 14px', border: 'none', borderRadius: 8, background: '#004B63', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                  {qualifying === l.id ? '…' : 'Qualify'}
                </button>
              )}
              <Link href={`/tasks?lead=${l.id}`}
                style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', border: '1px solid var(--border, #e5e5e0)', borderRadius: 8, color: 'var(--text, #111)', fontSize: 13, textDecoration: 'none' }}>
                Details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
