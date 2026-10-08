'use client';

// /today — COMPANY OVERVIEW, one screen (Phase 12, parallel lane).
// Contract (hermes-phase-12-prompt.md GOAL 4):
//   GET /api/v1/overview → {
//     today: { approvals_pending, tickets_open, leads_new, content_scheduled },
//     pipelines: [{ id, name, client_name, stage, progress }],
//     inbox_top: [{ id, title, type, triage_score }],
//     win_week: { new_leads, qualified, onboarded },
//     grow_week: { planned, published } }
// Every number traces to a real row and links to its view. Approve inline on
// the top inbox cards (the approval POST is the existing card endpoint).

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

interface Overview {
  today: { approvals_pending: number; tickets_open: number; leads_new: number; content_scheduled: number };
  pipelines: { id: string; name: string; client_name: string; stage: string; progress: number }[];
  inbox_top: { id: string; title: string; type: string; triage_score: number }[];
  win_week: { new_leads: number; qualified: number; onboarded: number };
  grow_week: { planned: number; published: number };
}

const btn: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--text)' };
const btnSm: React.CSSProperties = { ...btn, minHeight: 36, padding: '0 12px', fontSize: 13 };

const STATS: { key: keyof Overview['today']; label: string; href: string }[] = [
  { key: 'approvals_pending', label: 'Approvals pending', href: '/approvals' },
  { key: 'tickets_open', label: 'Open tickets', href: '/portal/tickets' },
  { key: 'leads_new', label: 'New leads', href: '/leads' },
  { key: 'content_scheduled', label: 'Content scheduled', href: '/grow' },
];

export default function TodayPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch('/api/v1/overview');
      if (!r.ok) throw new Error('Could not load the overview.');
      setData(await r.json());
    } catch (e: any) { setError(e.message || 'Could not load the overview.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    setBusy(id); setNotice(null);
    try {
      const r = await apiFetch(`/api/v1/approvals/${id}/approve`, { method: 'POST' });
      if (!r.ok) throw new Error('Approve failed.');
      setNotice('Approved.');
      await load();
    } catch (e: any) { setNotice(e.message || 'Approve failed.'); }
    finally { setBusy(null); }
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Today</h1>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 20px' }}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} — the company at a glance.
      </p>

      {notice && (
        <p style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px',
          background: 'var(--card)', fontSize: 14, margin: '0 0 16px' }}>{notice}</p>
      )}
      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {STATS.map((s) => (
              <Link key={s.key} href={s.href}
                style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px',
                  background: 'var(--card)', textDecoration: 'none', color: 'var(--text)', minHeight: 88,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>{data.today[s.key]}</span>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{s.label} →</span>
              </Link>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            <section>
              <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Top inbox cards</h2>
              {data.inbox_top.length === 0 && (
                <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Inbox zero. The company runs.</p>
              )}
              {data.inbox_top.map((c) => (
                <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 8, background: 'var(--card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {c.type} · score {c.triage_score}
                      </div>
                    </div>
                    <button style={btnSm} disabled={busy === c.id} onClick={() => approve(c.id)}>
                      {busy === c.id ? '…' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
              <Link href="/approvals" style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center',
                textDecoration: 'none', marginTop: 4 }}>Open inbox →</Link>
            </section>

            <section>
              <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>Active pipelines</h2>
              {data.pipelines.length === 0 && (
                <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No active pipelines.</p>
              )}
              {data.pipelines.map((p) => (
                <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 8, background: 'var(--card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <strong>{p.name}</strong>
                    <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{p.client_name}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, p.progress))}%`,
                      borderRadius: 3, background: 'var(--accent)' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
                    {p.stage} · {p.progress}%
                  </div>
                </div>
              ))}
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
            <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--card)' }}>
              <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>WIN this week</h2>
              <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
                <span><strong>{data.win_week.new_leads}</strong> new</span>
                <span><strong>{data.win_week.qualified}</strong> qualified</span>
                <span><strong>{data.win_week.onboarded}</strong> onboarded</span>
              </div>
              <Link href="/leads" style={{ fontSize: 13, color: 'var(--accent)' }}>Leads pipeline →</Link>
            </section>
            <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--card)' }}>
              <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>GROW this week</h2>
              <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
                <span><strong>{data.grow_week.planned}</strong> planned</span>
                <span><strong>{data.grow_week.published}</strong> published</span>
              </div>
              <Link href="/grow" style={{ fontSize: 13, color: 'var(--accent)' }}>Content engine →</Link>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
