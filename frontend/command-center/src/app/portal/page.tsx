'use client';

// /portal — CLIENT PORTAL (Phase 8). NOT the founder UI — the client never
// sees THE INBOX, agents, or P&L. Invite-only: ?token=... → redeem → session
// (localStorage) → read-only portal + THE ONE WRITE (approve/request-changes
// on deliverables sent for their review). No dead buttons — every row acts
// or explains why it can't.
//
// Phase 8.1 GOAL 2: PREVIEW-AS-CLIENT — /portal?preview_client_id=<uuid> with
// a FOUNDER session renders EXACTLY what that client sees (same components,
// same data path via /portal/preview/* routes). Preview is READ-ONLY: the
// decision buttons are hidden and the write endpoint 403s preview contexts.

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const SESSION_KEY = 'spinach_portal_session';

interface PortalSession {
  token: string;
  client_id: string;
  client_name: string;
  expires_at: string;
}

interface Overview {
  client_id: string;
  client_name: string;
  pipelines: { id: string; name: string; step: string; progress: number; status: string }[];
  active_count: number;
  waiting_on_you: number;
  waiting_on_you_items: { id: string; title: string; version: number }[];
}

interface Deliverable {
  id: string;
  client_id: string;
  title: string;
  kind: string;
  file_url: string | null;
  version: number;
  released_at: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

interface TimelineEvent {
  id: string;
  workflow_id: string;
  event: string;
  from_step: string | null;
  to_step: string | null;
  actor: string;
  detail: Record<string, any>;
  created_at: string;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function statusPill(status?: string) {
  const s = (status || '').toLowerCase();
  const cls: Record<string, string> = {
    active: 'pill approved',
    completed: 'pill completed',
    paused: 'pill paused',
    failed: 'pill draft',
    cancelled: 'pill archived',
  };
  return <span className={cls[s] || 'pill draft'}>{s}</span>;
}

export default function PortalPage() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'deliverables' | 'timeline'>('deliverables');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [note, setNote] = useState('');
  // Phase 8.1 GOAL 2: preview-as-client state
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ---- boot: check session cache, then ?token= redeem ----
  useEffect(() => {
    (async () => {
      // Phase 8.1 GOAL 2: ?preview_client_id= → founder preview mode (checked FIRST)
      const params = new URLSearchParams(window.location.search);
      const pid = params.get('preview_client_id');
      if (pid) {
        setPreviewClientId(pid);
        setBooting(false);
        return; // preview path loads below with the founder session
      }
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as PortalSession;
          if (cached.token && new Date(cached.expires_at) > new Date()) {
            setSession(cached);
            setBooting(false);
            return;
          }
        }
      } catch {
        /* fall through to redeem */
      }
      // ?token=... → redeem through the API (rate-limited, single-use)
      const token = params.get('token');
      if (!token) {
        setBooting(false);
        return; // no token, no session → the invite wall renders
      }
      try {
        const r = await fetch(`${API_BASE}/api/v1/portal/redeem?token=${encodeURIComponent(token)}`);
        const d = await r.json();
        if (!r.ok) {
          setRedeemError(d.error || 'Invalid invite');
        } else {
          const s: PortalSession = { token: d.token, client_id: d.client_id, client_name: d.client_name, expires_at: d.expires_at };
          localStorage.setItem(SESSION_KEY, JSON.stringify(s));
          setSession(s);
          // clean the token from the URL (it's single-use — nothing to leak)
          window.history.replaceState({}, '', '/portal');
        }
      } catch {
        setRedeemError('Portal API unreachable — is the backend running?');
      }
      setBooting(false);
    })();
  }, []);

  // ---- data load (client-scoped: every query rides the session JWT) ----
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const H = { Authorization: `Bearer ${session.token}` };
    try {
      const [ov, dl, tl] = await Promise.all([
        fetch(`${API_BASE}/api/v1/portal/overview`, { headers: H }),
        fetch(`${API_BASE}/api/v1/portal/deliverables`, { headers: H }),
        fetch(`${API_BASE}/api/v1/portal/timeline`, { headers: H }),
      ]);
      if (ov.status === 401) {
        // session died (revoked server-side) → back to the invite wall
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        return;
      }
      if (ov.ok) setOverview(await ov.json());
      if (dl.ok) setDeliverables((await dl.json()).deliverables || []);
      if (tl.ok) setTimeline((await tl.json()).events || []);
      if (!ov.ok || !dl.ok || !tl.ok) setError('Some portal data failed to load — retry or contact the studio.');
    } catch {
      setError('Portal API unreachable — is the backend running?');
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  // ---- Phase 8.1 GOAL 2: preview load (founder session + preview routes) ----
  const loadPreview = useCallback(async () => {
    if (!previewClientId) return;
    setLoading(true);
    setError(null);
    try {
      const H = { Authorization: `Bearer preview` }; // replaced below by real founder JWT
      // founder JWT comes from the same session-mint path the UI uses
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) { setPreviewError('Founder session required — log into the command center first.'); setLoading(false); return; }
      const { token } = await sessionRes.json();
      const fH = { Authorization: `Bearer ${token}` };
      const q = `preview_client_id=${encodeURIComponent(previewClientId)}`;
      const [ov, dl, tl] = await Promise.all([
        fetch(`${API_BASE}/api/v1/portal/preview/overview?${q}`, { headers: fH }),
        fetch(`${API_BASE}/api/v1/portal/preview/deliverables?${q}`, { headers: fH }),
        fetch(`${API_BASE}/api/v1/portal/preview/timeline?${q}`, { headers: fH }),
      ]);
      if (ov.status === 401 || ov.status === 403) { setPreviewError('Founder session invalid — log into the command center first.'); setLoading(false); return; }
      if (ov.ok) setOverview(await ov.json());
      if (dl.ok) setDeliverables((await dl.json()).deliverables || []);
      if (tl.ok) setTimeline((await tl.json()).events || []);
      if (!ov.ok || !dl.ok || !tl.ok) setError('Some preview data failed to load — retry.');
    } catch {
      setPreviewError('Portal API unreachable — is the backend running?');
    }
    setLoading(false);
  }, [previewClientId]);

  useEffect(() => {
    if (previewClientId) loadPreview();
  }, [previewClientId, loadPreview]);

  // ---- THE ONE WRITE: approve / request-changes on a pending review ----
  const decide = async (id: string, decision: 'approved' | 'changes_requested') => {
    if (!session) return;
    setDeciding(id);
    try {
      const r = await fetch(`${API_BASE}/api/v1/portal/reviews/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ decision, note: note || null }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || 'decision failed');
      } else {
        setNote('');
        await load(); // refresh — the review leaves pending
      }
    } catch {
      alert('Portal API unreachable');
    }
    setDeciding(null);
  };

  // ---- download via signed URL (their client_id only) ----
  const download = async (d: Deliverable) => {
    if (!session) return;
    if (!d.file_url) {
      alert(d.kind === 'link' ? 'This deliverable is a link — open it from the source.' : 'Text deliverables have no file download.');
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/v1/portal/deliverables/${d.id}/download`, { headers: { Authorization: `Bearer ${session.token}` } });
      const j = await r.json();
      if (r.ok && j.url) window.open(j.url, '_blank');
      else alert(j.error || 'download failed');
    } catch {
      alert('Portal API unreachable');
    }
  };

  const logout = () => {
    if (session) {
      fetch(`${API_BASE}/api/v1/portal/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } }).catch(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setOverview(null);
    setDeliverables([]);
    setTimeline([]);
  };

  // ---- boot screen ----
  if (booting) {
    return <main style={{ padding: 40 }}>Loading portal…</main>;
  }

  // ---- Phase 8.1 GOAL 2: PREVIEW BANNER (founder sees what the client sees) ----
  if (previewClientId) {
    const pending = deliverables.filter((d) => d.metadata?.client_review === 'pending');
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '10px 14px', marginBottom: 16, background: 'var(--accent, #004B63)', color: '#fff', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13 }}>
            <b>PREVIEW MODE</b> — viewing exactly what the client sees. Read-only: decisions are blocked (the write endpoint rejects preview sessions).
          </div>
          <a href={`/clients/${previewClientId}`} style={{ color: '#fff', fontSize: 13, textDecoration: 'underline', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            ← Back to Client 360
          </a>
        </div>
        {previewError && (
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--muted-foreground)', marginBottom: 12 }}>
            {previewError}
          </div>
        )}
        {/* header (identical to the client's) */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>{overview?.client_name || 'Client Portal'}</h1>
          <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Preview of the client's portal view</span>
        </div>
        {/* summary strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px', padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Active pipelines</div>
            <div style={{ fontSize: 26, fontWeight: 600 }}>{overview?.active_count ?? '—'}</div>
          </div>
          <div style={{ flex: '1 1 160px', padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Waiting on you</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: (overview?.waiting_on_you || 0) > 0 ? 'var(--accent)' : undefined }}>
              {overview?.waiting_on_you ?? '—'}
            </div>
          </div>
          <div style={{ flex: '1 1 160px', padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Deliverables filed</div>
            <div style={{ fontSize: 26, fontWeight: 600 }}>{deliverables.length}</div>
          </div>
        </div>
        {/* pipelines (identical) */}
        <h2 style={{ fontSize: 15, margin: '16px 0 8px' }}>Pipelines</h2>
        {(overview?.pipelines || []).length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No pipelines yet — the client's project is being set up.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            {(overview?.pipelines || []).map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>step: {p.step || '—'}</div>
                </div>
                <div style={{ width: 140, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${p.progress || 0}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <span style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{p.progress || 0}%</span>
                {statusPill(p.status)}
              </div>
            ))}
          </div>
        )}
        {/* waiting on you — READ-ONLY in preview: no decision buttons */}
        <h2 style={{ fontSize: 15, margin: '16px 0 8px' }}>Waiting on you</h2>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Nothing needs the client's sign-off right now.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            {pending.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{d.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 8 }}>v{d.version} · filed {fmtDate(d.released_at)}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>decisions hidden in preview</span>
              </div>
            ))}
          </div>
        )}
        {/* deliverables (identical, no download clicks in preview) */}
        <h2 style={{ fontSize: 15, margin: '16px 0 8px' }}>Deliverables</h2>
        {deliverables.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No deliverables filed yet.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {deliverables.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {d.kind} · v{d.version} · {fmtDate(d.created_at)}
                    {d.metadata?.client_review === 'accepted' && ' · accepted'}
                    {d.metadata?.client_review === 'changes_requested' && ' · changes requested'}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{d.file_url ? 'download in client view' : 'view'}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    );
  }

  // ---- invite wall: no session, no token ----
  if (!session) {
    return (
      <main style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Client Portal</h1>
        <p style={{ color: 'var(--muted-foreground)', marginBottom: 16 }}>
          This portal is invite-only. Ask the studio for your magic link.
        </p>
        {redeemError && (
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--muted-foreground)' }}>
            {redeemError} — the link may be expired, already used, or revoked. Ask for a fresh one.
          </div>
        )}
      </main>
    );
  }

  // ---- the portal ----
  const pending = deliverables.filter((d) => d.metadata?.client_review === 'pending');

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>{overview?.client_name || 'Client Portal'}</h1>
          <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>
            Session valid till {fmtDate(session.expires_at)}
          </span>
        </div>
        <button onClick={logout} style={{ padding: '6px 14px' }}>Log out</button>
      </div>

      {/* summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Active pipelines</div>
          <div style={{ fontSize: 26, fontWeight: 600 }}>{overview?.active_count ?? '—'}</div>
        </div>
        <div style={{ flex: '1 1 160px', padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Waiting on you</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: (overview?.waiting_on_you || 0) > 0 ? 'var(--accent)' : undefined }}>
            {overview?.waiting_on_you ?? '—'}
          </div>
        </div>
        <div style={{ flex: '1 1 160px', padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Deliverables filed</div>
          <div style={{ fontSize: 26, fontWeight: 600 }}>{deliverables.length}</div>
        </div>
      </div>

      {/* pipelines */}
      <h2 style={{ fontSize: 15, margin: '16px 0 8px' }}>Pipelines</h2>
      {(overview?.pipelines || []).length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No pipelines yet — your project is being set up.</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          {(overview?.pipelines || []).map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>step: {p.step || '—'}</div>
              </div>
              <div style={{ width: 140, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${p.progress || 0}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{p.progress || 0}%</span>
              {statusPill(p.status)}
            </div>
          ))}
        </div>
      )}

      {/* waiting on you — THE ONE WRITE lives here */}
      <h2 style={{ fontSize: 15, margin: '16px 0 8px' }}>Waiting on you</h2>
      {pending.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Nothing needs your sign-off right now.</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          {pending.map((d) => (
            <div key={d.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{d.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 8 }}>v{d.version} · filed {fmtDate(d.released_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => decide(d.id, 'approved')}
                  disabled={deciding === d.id}
                  style={{ padding: '5px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6 }}
                >
                  {deciding === d.id ? '…' : 'Approve'}
                </button>
                <button
                  onClick={() => decide(d.id, 'changes_requested')}
                  disabled={deciding === d.id}
                  style={{ padding: '5px 14px' }}
                >
                  Request changes
                </button>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  style={{ flex: '1 1 200px', padding: '5px 10px', fontSize: 13 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* tabs: deliverables | timeline */}
      <div style={{ display: 'flex', gap: 8, margin: '20px 0 8px' }}>
        <button onClick={() => setTab('deliverables')} style={{ padding: '6px 14px', fontWeight: tab === 'deliverables' ? 600 : 400 }}>
          Deliverables
        </button>
        <button onClick={() => setTab('timeline')} style={{ padding: '6px 14px', fontWeight: tab === 'timeline' ? 600 : 400 }}>
          Timeline
        </button>
      </div>

      {error && <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      {tab === 'deliverables' ? (
        deliverables.length === 0 ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No deliverables filed yet.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {deliverables.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {d.kind} · v{d.version} · {fmtDate(d.created_at)}
                    {d.metadata?.client_review === 'accepted' && ' · accepted'}
                    {d.metadata?.client_review === 'changes_requested' && ' · changes requested'}
                  </div>
                </div>
                <button onClick={() => download(d)} style={{ padding: '4px 12px', fontSize: 13 }}>
                  {d.file_url ? 'Download' : 'View'}
                </button>
              </div>
            ))}
          </div>
        )
      ) : timeline.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No project events yet.</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {timeline.map((e) => (
            <div key={e.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>{e.event}</span>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{fmtDate(e.created_at)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {e.from_step || '—'} → {e.to_step || '—'} · by {e.actor}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
