'use client';

// /leads — WIN pipeline (Phase 11, parallel lane; rebuilt against the frozen contract).
// Contract (hermes-phase-11-prompt.md):
//   GET  /api/v1/leads?status= → [{ id, name, email, company, source, status, score, updated_at }]
//   POST /api/v1/leads { name, email, company?, phone?, source? } → 201 { id, status:'new' }
//   POST /api/v1/leads/:id/qualify → 200 { id, score, rationale, card_id }
//   POST /api/v1/leads/:id/draft-outreach → 200 { draft_id, subject, style_score, card_id }
//   POST /api/v1/leads/:id/onboard { playbook_pack_slug } → 200 { lead_id, client_id, pipeline_id, invite_id }
// Stages: new → qualified → outreached → responded → onboarded (+ disqualified/dead).
// Approval gates are law: qualify/draft/outreach go through inbox cards — this UI
// only TRIGGERS them; the founder approves in THE INBOX.

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';
// N1.4: honest-state primitives — named states, never ad-hoc <p> tags.
import { LoadingState, ErrorState, EmptyState } from '@/components/states/AsyncState';
// N2.9: narrative header — every workflow page answers happening/happened/next/who-acts.
import WorkflowHeader from '@/components/workflow/WorkflowHeader';

type Status = 'new' | 'qualified' | 'disqualified' | 'outreached' | 'responded' | 'onboarded' | 'dead';

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  source: string;
  status: Status;
  score?: number | null;
  client_id?: string | null;
  updated_at: string;
  // N2.10 (progressive enhancement): populated by the backend when available
  // (Hermes: N2.10-backend). Renders outreach visibility inline; absent = current behavior.
  latest_outreach?: { draft_body?: string | null; sent_at?: string | null; replied_at?: string | null } | null;
}

const STAGES: { key: Status; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'outreached', label: 'Outreached' },
  { key: 'responded', label: 'Responded' },
  { key: 'onboarded', label: 'Onboarded' },
];

const STALE_DAYS = 7;

const btn: React.CSSProperties = {
  minHeight: 44, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--text)' };
const btnSm: React.CSSProperties = { ...btnGhost, minHeight: 36, padding: '0 12px', fontSize: 13 };
const input: React.CSSProperties = {
  width: '100%', minHeight: 44, padding: '0 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
};

function daysInStage(updatedAt: string) {
  const d = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 864e5);
  return Math.max(0, d);
}

function scoreColor(s?: number | null) {
  if (s == null) return 'var(--muted-foreground)';
  if (s >= 70) return '#16a34a';
  if (s >= 40) return '#d97706';
  return '#dc2626';
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fCompany, setFCompany] = useState('');
  const [csv, setCsv] = useState('');
  const [packSlug, setPackSlug] = useState('client-onboarding');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch('/api/v1/leads');
      if (!r.ok) throw new Error('Could not load leads.');
      setLeads(await r.json());
    } catch (e: any) { setError(e.message || 'Could not load leads.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(path: string, body?: any) {
    const r = await apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request failed.');
    return d;
  }

  async function doAction(key: string, fn: () => Promise<any>, okMsg: string) {
    setBusy(key); setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      await load();
    } catch (e: any) { setNotice(e.message || 'Action failed.'); }
    finally { setBusy(null); }
  }

  const byStatus = (s: Status) => leads.filter((l) => l.status === s);
  const dead = leads.filter((l) => l.status === 'disqualified' || l.status === 'dead');

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>WIN — leads pipeline</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnGhost} onClick={() => { setShowImport((s) => !s); setShowAdd(false); }}>Import</button>
          <button style={btn} onClick={() => { setShowAdd((s) => !s); setShowImport(false); }}>
            {showAdd ? 'Cancel' : '+ Add lead'}
          </button>
        </div>
      </div>

      {/* N2.9: narrative header — computed from the page's own data, no new endpoints. */}
      {!loading && !error && leads.length > 0 && (() => {
        const stale = leads.filter((l) => daysInStage(l.updated_at) >= STALE_DAYS && l.status !== 'onboarded').length;
        const n = (s: Status) => byStatus(s).length;
        return (
          <WorkflowHeader
            happening={`${leads.length} leads in the funnel${stale > 0 ? ` — ${stale} stale over ${STALE_DAYS}d` : ''}`}
            happened={`${n('qualified')} qualified · ${n('outreached')} outreached · ${n('responded')} responded`}
            next={n('new') > 0 ? `${n('new')} new ${n('new') === 1 ? 'needs' : 'need'} qualifying` : 'Funnel is clear — add or import leads'}
            actor="You approve — agents draft the outreach"
          />
        );
      })()}

      {/* UX pass (2026-10-17): priority strip — the 5 leads to act on first
          (highest score, not yet onboarded/dead). Decision support, not a data dump. */}
      {!loading && !error && leads.length > 0 && (() => {
        const actionable = leads
          .filter((l) => l.status !== 'onboarded' && l.status !== 'dead' && l.status !== 'disqualified')
          .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
          .slice(0, 5);
        if (!actionable.length) return null;
        return (
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, background: 'var(--card)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>Act next — top {actionable.length} by score</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {actionable.map((l) => (
                <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                  borderRadius: 99, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 12.5 }}>
                  <strong>{l.company || l.name}</strong>
                  {l.score != null && <span style={{ color: scoreColor(l.score), fontWeight: 700 }}>{l.score}</span>}
                  <span style={{ color: 'var(--muted-foreground)' }}>{l.status}</span>
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {notice && (
        <p style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px',
          background: 'var(--card)', fontSize: 14, margin: '0 0 16px' }}>{notice}</p>
      )}

      {showAdd && (
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20, background: 'var(--card)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input style={{ ...input, flex: '1 1 160px' }} value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Name" maxLength={80} />
            <input style={{ ...input, flex: '1 1 200px' }} value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="Email" maxLength={120} />
            <input style={{ ...input, flex: '1 1 160px' }} value={fCompany} onChange={(e) => setFCompany(e.target.value)} placeholder="Company (optional)" maxLength={80} />
            <button style={btn} disabled={busy === 'add' || !fName.trim() || !fEmail.trim()}
              onClick={() => doAction('add',
                () => post('/api/v1/leads', { name: fName.trim(), email: fEmail.trim(), company: fCompany.trim() || undefined }),
                'Lead added.').then(() => { setFName(''); setFEmail(''); setFCompany(''); setShowAdd(false); })}>
              {busy === 'add' ? 'Adding…' : 'Add'}
            </button>
          </div>
        </section>
      )}

      {showImport && (
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20, background: 'var(--card)' }}>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 8px' }}>
            Paste CSV: <code>name,email,company</code> — one per line, max 200. Duplicates on email are skipped.
          </p>
          <textarea style={{ ...input, minHeight: 110, padding: 12 }} value={csv}
            onChange={(e) => setCsv(e.target.value)} placeholder={'Aarav Sharma,aarav@acme.in,Acme\nMeera Iyer,meera@beta.co,Beta'} />
          <button style={{ ...btn, marginTop: 10 }} disabled={busy === 'import' || !csv.trim()}
            onClick={() => doAction('import', () => post('/api/v1/leads/import', { csv }),
              'Import done — duplicates skipped.').then(() => { setCsv(''); setShowImport(false); })}>
            {busy === 'import' ? 'Importing…' : 'Import leads'}
          </button>
        </section>
      )}

      {loading && <LoadingState label="Loading leads…" rows={5} />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && leads.length === 0 && (
        <EmptyState
          title="No leads yet"
          hint="Add one above or import a list — then qualify, outreach, onboard."
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {STAGES.map((st) => {
          const items = byStatus(st.key);
          return (
            <section key={st.key} style={{ border: '1px solid var(--border)', borderRadius: 12,
              background: 'var(--card)', padding: 12, minHeight: 200 }}>
              <h2 style={{ fontSize: 14, margin: '0 0 10px', display: 'flex', justifyContent: 'space-between' }}>
                {st.label}
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>{loading ? '—' : items.length}</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((l) => {
                  const stale = daysInStage(l.updated_at) >= STALE_DAYS && st.key !== 'onboarded';
                  const k = `act:${l.id}`;
                  return (
                    <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 8,
                      padding: '10px 12px', background: 'var(--background)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{l.company || l.name}</strong>
                        {l.score != null && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(l.score),
                            background: 'color-mix(in srgb, currentColor 12%, transparent)',
                            padding: '2px 8px', borderRadius: 99 }}>
                            {l.score}/100
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 8px' }}>
                        {l.company && l.name !== l.company ? <span style={{ opacity: 0.75 }}>{l.name} · </span> : ''}{l.email} · {l.source}
                        <span style={{ color: stale ? '#d97706' : 'inherit', fontWeight: stale ? 700 : 400 }}>
                          {' '}· {daysInStage(l.updated_at)}d here{stale ? ' — stale' : ''}
                        </span>
                      </div>
                      {/* N2.10: outreach visibility — renders when the backend ships
                          latest_outreach; the funnel shows conversations, not just stages. */}
                      {l.latest_outreach && (l.latest_outreach.sent_at || l.latest_outreach.draft_body) && (
                        <div style={{ fontSize: 12, margin: '0 0 8px', padding: '8px 10px', borderRadius: 6,
                          background: 'var(--panel)', border: '1px solid var(--border-soft)' }}>
                          <span style={{ fontWeight: 600 }}>
                            {l.latest_outreach.replied_at ? 'Replied ✓' : l.latest_outreach.sent_at ? 'Sent — no reply yet' : 'Draft ready'}
                          </span>
                          {l.latest_outreach.sent_at && (
                            <span style={{ color: 'var(--muted-foreground)' }}> · {new Date(l.latest_outreach.sent_at).toLocaleDateString()}</span>
                          )}
                          {l.latest_outreach.draft_body && (
                            <div style={{ color: 'var(--muted-foreground)', marginTop: 4, display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              “{l.latest_outreach.draft_body.slice(0, 120)}{l.latest_outreach.draft_body.length > 120 ? '…' : ''}”
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {l.status === 'new' && (
                          <button style={btnSm} disabled={busy === k}
                            onClick={() => doAction(k, () => post(`/api/v1/leads/${l.id}/qualify`),
                              `Qualify triggered for ${l.name} — check THE INBOX for the score card.`)}>
                            {busy === k ? '…' : 'Qualify'}
                          </button>
                        )}
                        {l.status === 'qualified' && (
                          <button style={btnSm} disabled={busy === k}
                            onClick={() => doAction(k, () => post(`/api/v1/leads/${l.id}/draft-outreach`),
                              `Outreach draft for ${l.name} is in your inbox — approve it there to send.`)}>
                            {busy === k ? '…' : 'Draft outreach'}
                          </button>
                        )}
                        {l.status === 'responded' && (
                          <>
                            <input style={{ ...input, minHeight: 36, fontSize: 13 }} value={packSlug}
                              onChange={(e) => setPackSlug(e.target.value)} placeholder="Search playbooks…"
                              title="Playbook pack to install on onboard" />
                            <button style={btnSm} disabled={busy === k}
                              onClick={() => doAction(k, () => post(`/api/v1/leads/${l.id}/onboard`, { playbook_pack_slug: packSlug }),
                                `${l.name} onboarded — client + pipeline + portal invite created.`)}>
                              {busy === k ? '…' : 'Onboard →'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>—</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {dead.length > 0 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--muted-foreground)', minHeight: 44 }}>
            Disqualified / dead ({dead.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {dead.map((l) => (
              <div key={l.id} style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                {l.name} · {l.company || l.email} · {l.status}
              </div>
            ))}
          </div>
        </details>
      )}

      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 20 }}>
        Qualify and outreach run through inbox approval cards — nothing sends without your approval there.
      </p>
    </main>
  );
}
