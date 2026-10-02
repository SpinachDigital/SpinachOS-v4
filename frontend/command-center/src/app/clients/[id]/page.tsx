'use client';

// Client 360 — everything about one client on a single screen.
//   GET /api/v1/invoices?client_id=     → invoices (P1 Task 1)
//   GET /api/v1/approvals?client_id=     → full approval history (P1 Task 2)
// Data:
//   GET /api/v1/clients/:id            → { client, tasks, leads, content, workflows, approvals }
//   GET /api/v1/knowledge/context/:id  → { package, brand_branch, knowledge_chunks } (DNA card)
//   GET /api/v1/retainer/schedule      → filtered by client_id (retainer section)
//   GET /api/v1/packages              → package detail lookup
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Props {
  params: { id: string };
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function statusPill(status?: string) {
  const s = (status || 'pending').toLowerCase();
  if (['active', 'approved', 'completed', 'done'].includes(s)) return <span className="pill approved">{s}</span>;
  if (['paused', 'pending', 'in_progress', 'running', 'qa'].includes(s)) return <span className="pill pending">{s}</span>;
  if (['failed', 'rejected', 'blocked', 'archived'].includes(s)) return <span className="pill rejected">{s}</span>;
  return <span className="pill draft">{s}</span>;
}

interface TimelineEvent {
  time: string;
  title: string;
  meta: string;
  kind: 'task' | 'approval' | 'workflow' | 'content' | 'lead';
}

const KIND_DOT: Record<TimelineEvent['kind'], string> = {
  task: '',
  approval: 'amber',
  workflow: 'blue',
  content: 'gray',
  lead: '',
};

export default function Client360Page({ params }: Props) {
  const { id } = params;
  const { connected } = useWebSocket();
  const [ctx, setCtx] = useState<any>(null);
  const [dna, setDna] = useState<any>(null);
  const [retainer, setRetainer] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [filedAssets, setFiledAssets] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sprint 9 §3: onboarding — the API (POST /api/v1/onboard) is real but had no
  // UI action. Button lives here (client detail, after deal won): package select
  // → onboard → pipeline created + kickoff visible + confirmation.
  const [onboardPkg, setOnboardPkg] = useState<string>('');
  const [onboarding, setOnboarding] = useState(false);
  const [onboardResult, setOnboardResult] = useState<any>(null);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  const runOnboard = async () => {
    if (!onboardPkg) { setOnboardError('Pehle package select karo.'); return; }
    setOnboarding(true);
    setOnboardError(null);
    setOnboardResult(null);
    try {
      const c = ctx?.client || {};
      const res = await apiFetch('/api/v1/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: c.name || 'Client', package_key: onboardPkg,
          has_logo: !!(c.metadata?.has_logo), industry: c.business_type || undefined,
          location: c.location || undefined, contact: c.metadata?.contact_person || undefined,
          email: c.metadata?.email || undefined, goal: c.goal || undefined,
          intake_notes: `Onboarded from Client 360 (client ${id}) after deal won.`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setOnboardError(data.error || `API ${res.status}`); return; }
      setOnboardResult(data); // whole chain observable: client + workflow + dormant + next
    } catch (e: any) {
      setOnboardError(e?.message || 'Onboard failed');
    } finally {
      setOnboarding(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ctxRes, dnaRes, retRes, pkgRes, invRes, apprRes, filedRes] = await Promise.all([
        apiFetch(`/api/v1/clients/${id}`),
        apiFetch(`/api/v1/knowledge/context/${id}`),
        apiFetch('/api/v1/retainer/schedule'),
        apiFetch('/api/v1/packages'),
        apiFetch(`/api/v1/invoices?client_id=${id}`),          // P1 Task 1
        apiFetch(`/api/v1/approvals?client_id=${id}&limit=50`), // P1 Task 2
        apiFetch(`/api/v1/deliverables?client_id=${id}`),       // Sprint 10 §4: filed assets
      ]);
      if (!ctxRes.ok) throw new Error(`client context: API ${ctxRes.status}`);
      const ctxData = await ctxRes.json();
      if (!ctxData || !ctxData.client) throw new Error('client not found');
      setCtx(ctxData);
      if (dnaRes.ok) setDna(await dnaRes.json());
      if (retRes.ok) {
        const all = await retRes.json();
        setRetainer((Array.isArray(all) ? all : []).filter((r: any) => r.client_id === id));
      }
      if (pkgRes.ok) {
        const p = await pkgRes.json();
        setPackages(Array.isArray(p) ? p : []);
      }
      if (invRes.ok) {
        const inv = await invRes.json();
        setInvoices(Array.isArray(inv) ? inv : []);
      }
      if (apprRes.ok) {
        const hist = await apprRes.json();
        setApprovalHistory(Array.isArray(hist) ? hist : []);
      }
      // Sprint 10 §4: filed assets (approved-gate deliverables) — the twin's
      // assets panel reads the deliverables table, not the legacy content array.
      if (filedRes && filedRes.ok) {
        const filed = await filedRes.json();
        setFiledAssets(Array.isArray(filed) ? filed : []);
      } else {
        setFiledAssets([]); // endpoint missing → honest empty, never fake
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="page">
        <div className="page-head"><div><div className="skeleton" style={{ height: 26, width: 260 }} /><div className="skeleton" style={{ height: 14, width: 180, marginTop: 8 }} /></div></div>
        <div className="page-body">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="page">
        <div className="page-body">
          <div className="empty-state">
            <h3>Couldn't load this client</h3>
            <p>{error || 'Unknown error'}. The client may have been archived, or the API is unreachable.</p>
            <Link href="/clients" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', marginTop: 12 }}>
              ← Back to clients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const client = ctx.client || {};
  const tasks: any[] = ctx.tasks || [];
  const leads: any[] = ctx.leads || [];
  const content: any[] = ctx.content || [];
  const workflows: any[] = ctx.workflows || [];
  const approvals: any[] = ctx.approvals || [];

  const pkgKey: string | null = client.metadata?.package_key || dna?.package || null;
  const pkg = packages.find((p: any) => p.key === pkgKey || p.package_key === pkgKey || p.name === pkgKey);

  // ---- timeline: merge everything, newest first ----
  const timeline: TimelineEvent[] = [
    ...tasks.map((t: any) => ({
      time: t.created_at, kind: 'task' as const,
      title: t.title || t.kind || 'Task',
      meta: `Task · ${t.status || 'pending'}${t.assigned_to ? ` · ${t.assigned_to}` : ''}`,
    })),
    ...approvals.map((a: any) => ({
      time: a.created_at, kind: 'approval' as const,
      title: a.title || a.type || 'Approval',
      meta: `Approval · ${a.status || 'pending'}`,
    })),
    ...workflows.map((w: any) => ({
      time: w.created_at, kind: 'workflow' as const,
      title: w.name || w.workflow_name || 'Workflow',
      meta: `Pipeline · ${w.status || 'pending'}`,
    })),
    ...content.map((c: any) => ({
      time: c.created_at, kind: 'content' as const,
      title: c.title || 'Deliverable',
      meta: `Deliverable · ${c.kind || c.type || 'content'}`,
    })),
    ...leads.map((l: any) => ({
      time: l.created_at, kind: 'lead' as const,
      title: l.name || l.company || 'Lead',
      meta: 'Lead',
    })),
  ]
    .filter((e) => e.time)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const activeWorkflows = workflows.filter((w: any) =>
    ['active', 'in_progress', 'running'].includes((w.status || '').toLowerCase()));
  const pastWorkflows = workflows.filter((w: any) =>
    !['active', 'in_progress', 'running'].includes((w.status || '').toLowerCase()));

  const chunks: any[] = dna?.knowledge_chunks || [];

  return (
    <div className="page">
      {/* ---------- header ---------- */}
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1>{client.name}</h1>
            {statusPill(client.status)}
            {pkgKey && <span className="badge badge-green">{pkgKey.replace(/_/g, ' ')}</span>}
          </div>
          <p className="sub">
            {[client.business_type, client.location].filter(Boolean).join(' · ') || 'Client'}
            {client.goal ? ` — ${client.goal}` : ''}
          </p>
        </div>
        <div className="actions">
          <span className="live-badge">
            <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <Link href="/clients" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            ← All clients
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}>Refresh</button>
        </div>
      </div>

      <div className="page-body">
        {/* ---------- Sprint 9 §3: ONBOARDING (after deal won) ---------- */}
        {!onboardResult && (
          <div style={{ padding: 14, marginBottom: 14, background: 'var(--card, #fff)', border: '1px solid var(--border-soft, #eee)', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text, #111)', marginBottom: 4 }}>Onboard this client</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground, #666)', marginBottom: 10 }}>
              Deal won? Package select karo — pipeline auto-create + orchestrator kickoff (whole chain observable).
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={onboardPkg} onChange={(e) => setOnboardPkg(e.target.value)}
                style={{ minHeight: 44, padding: '0 10px', border: '1px solid var(--border, #e5e5e0)', borderRadius: 8, background: 'var(--card, #fff)', color: 'var(--text, #111)', fontSize: 13 }}>
                <option value="">Select package…</option>
                {packages.map((p: any) => (
                  <option key={p.key} value={p.key}>{p.name} — ₹{p.price_inr}/{p.billing === 'monthly' ? 'mo' : 'one-time'}</option>
                ))}
              </select>
              <button onClick={() => void runOnboard()} disabled={onboarding || !onboardPkg}
                style={{ minHeight: 44, padding: '0 18px', border: 'none', borderRadius: 8, background: '#004B63', color: '#fff', fontSize: 13, cursor: onboarding || !onboardPkg ? 'not-allowed' : 'pointer', opacity: onboarding || !onboardPkg ? 0.6 : 1 }}>
                {onboarding ? 'Onboarding…' : 'Onboard'}
              </button>
            </div>
            {onboardError && (
              <div role="alert" style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fdf2f2', border: '1px solid #e5b8b8', color: '#8a2b2b', fontSize: 12 }}>
                {onboardError}
              </div>
            )}
          </div>
        )}
        {onboardResult && (
          <div role="status" style={{ padding: 14, marginBottom: 14, background: '#f2fbf4', border: '1px solid #b8e0c2', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1c5c34', marginBottom: 6 }}>✓ Onboarded — {onboardResult.client?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text, #111)', lineHeight: 1.7 }}>
              Pipeline: <Link href={`/pipeline/${onboardResult.workflow?.id || ''}`} style={{ color: '#004B63' }}>{onboardResult.workflow?.name || onboardResult.workflow?.id?.slice(0, 8) || '—'}</Link>
              {' '}· step 1 in_progress · kickoff: {onboardResult.next || 'orchestrator planning'}
              {onboardResult.dormant_trigger?.triggered ? ' · ads_manager provisioned (scale)' : ''}
            </div>
          </div>
        )}

        {/* ---------- stat strip ---------- */}
        <div className="grid-4">
          {[
            { n: tasks.length, l: 'Tasks' },
            { n: workflows.length, l: 'Pipelines' },
            { n: approvals.length, l: 'Pending approvals' },
            { n: content.length, l: 'Deliverables' },
          ].map((s) => (
            <div key={s.l} className="stat-card" style={{ padding: 14 }}>
              <div className="num" style={{ fontSize: 26 }}>{s.n}</div>
              <div className="lbl">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* ---------- timeline ---------- */}
          <div className="panel">
            <div className="panel-head"><h3>Timeline</h3></div>
            {timeline.length === 0 ? (
              <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                No activity recorded for this client yet.
              </div>
            ) : (
              <div className="timeline">
                {timeline.slice(0, 20).map((e, i) => (
                  <div key={i} className="tl-item">
                    <span className={`tl-dot ${KIND_DOT[e.kind]}`} />
                    <div className="tl-title">{e.title}</div>
                    <div className="tl-meta">{e.meta} · {fmtDateTime(e.time)}</div>
                  </div>
                ))}
              </div>
            )}
            {timeline.length > 20 && (
              <div className="t-meta" style={{ color: 'var(--text-faint)', marginTop: 8 }}>
                Showing latest 20 of {timeline.length} events.
              </div>
            )}
          </div>

          {/* ---------- client DNA / RAG ---------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>Client DNA</h3>
              {dna?.retrieval && <span className="badge badge-gray">{dna.retrieval}</span>}
            </div>
            {chunks.length === 0 ? (
              <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                No knowledge ingested for this client yet. Ingest brand docs, briefs, or past
                work via the Knowledge page to build their DNA.
              </div>
            ) : (
              <div className="kv">
                {dna?.brand_branch && (
                  <div className="kv-row"><span className="k">Brand branch</span><span className="v">{dna.brand_branch}</span></div>
                )}
                {chunks.map((c: any) => (
                  <div key={c.id} className="kv-row">
                    <span className="k">{c.kind || 'chunk'}</span>
                    <span className="v" style={{ fontWeight: 400, textAlign: 'left', maxWidth: '70%' }}>
                      <b style={{ fontWeight: 600 }}>{c.title || 'Untitled'}</b>
                      {c.content && <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{String(c.content).slice(0, 120)}…</div>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- pipelines ---------- */}
        <div className="panel">
          <div className="panel-head"><h3>Pipelines</h3></div>
          {workflows.length === 0 ? (
            <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
              No pipelines for this client yet. Onboarding starts one automatically.
            </div>
          ) : (
            <>
              {activeWorkflows.length > 0 && (
                <>
                  <div className="section-title">Current</div>
                  <div className="table-wrap" style={{ marginBottom: 14 }}>
                    <table className="data-table">
                      <thead><tr><th>Pipeline</th><th>Status</th><th>Started</th></tr></thead>
                      <tbody>
                        {activeWorkflows.map((w: any) => (
                          <tr key={w.id}>
                            <td><span className="cell-main">{w.name || w.workflow_name || 'Pipeline'}</span></td>
                            <td>{statusPill(w.status)}</td>
                            <td className="cell-dim">{fmtDate(w.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {pastWorkflows.length > 0 && (
                <>
                  <div className="section-title">History</div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Pipeline</th><th>Status</th><th>Started</th></tr></thead>
                      <tbody>
                        {pastWorkflows.map((w: any) => (
                          <tr key={w.id}>
                            <td><span className="cell-main">{w.name || w.workflow_name || 'Pipeline'}</span></td>
                            <td>{statusPill(w.status)}</td>
                            <td className="cell-dim">{fmtDate(w.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ---------- deliverables: FILED assets (Sprint 10 §4) + pipeline content ---------- */}
        <div className="panel">
          <div className="panel-head"><h3>Deliverables & assets</h3></div>
          {/* FILED deliverables (approved-gate filed, released_by/version) */}
          {filedAssets && filedAssets.length > 0 && (
            <>
              <div className="section-title">Filed (approved gates)</div>
              <div className="table-wrap" style={{ marginBottom: 14 }}>
                <table className="data-table">
                  <thead><tr><th>Deliverable</th><th>Kind</th><th>Version</th><th>Released</th></tr></thead>
                  <tbody>
                    {filedAssets.map((d: any) => (
                      <tr key={d.id}>
                        <td><span className="cell-main">{d.title}</span>{d.file_url && <a href={d.file_url} className="link" style={{ marginLeft: 8 }}>file →</a>}</td>
                        <td className="cell-dim">{d.kind}</td>
                        <td className="cell-dim">v{d.version}</td>
                        <td className="cell-dim">{d.released_by ? `${d.released_by} · ${fmtDate(d.released_at)}` : fmtDate(d.released_at || d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {content.length === 0 && (!filedAssets || filedAssets.length === 0) ? (
            <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
              No deliverables yet — they are filed here after the gate approves (version + released_by logged).
            </div>
          ) : content.length > 0 ? (
            <>
              <div className="section-title">Pipeline content</div>
              <div className="grid-3">
                {content.map((c: any) => (
                  <div key={c.id} className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.title || 'Untitled'}</div>
                    <div className="t-meta" style={{ color: 'var(--text-faint)', marginTop: 4 }}>
                      {c.kind || c.type || 'content'} · {fmtDate(c.created_at)}
                    </div>
                    <div style={{ marginTop: 8 }}>{statusPill(c.status)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* ---------- approvals: pending queue + full history (P1 Task 2) ---------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>Approvals</h3>
              <Link href="/approvals" className="link">Review queue →</Link>
            </div>
            {approvals.length === 0 && approvalHistory.length === 0 ? (
              <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                Nothing waiting on you for this client.
              </div>
            ) : (
              <div className="kv">
                {approvals.map((a: any) => (
                  <div key={`p-${a.id}`} className="kv-row">
                    <span className="k" style={{ maxWidth: '60%' }}>{a.title || a.type || 'Approval'}</span>
                    <span className="v">{statusPill(a.status)}</span>
                  </div>
                ))}
                {approvalHistory
                  .filter((a: any) => a.status !== 'pending')
                  .slice(0, 10)
                  .map((a: any) => (
                    <div key={`h-${a.id}`} className="kv-row">
                      <span className="k" style={{ maxWidth: '60%' }}>
                        {a.title || a.type || 'Approval'}
                        <div className="t-meta" style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                          {a.approved_by ? `by ${a.approved_by} · ` : ''}{fmtDateTime(a.reviewed_at || a.created_at)}
                        </div>
                      </span>
                      <span className="v">{statusPill(a.status)}</span>
                    </div>
                  ))}
              </div>
            )}
            {approvalHistory.length > 10 && (
              <div className="t-meta" style={{ color: 'var(--text-faint)', marginTop: 8 }}>
                Showing latest 10 of {approvalHistory.length} historical approvals.
              </div>
            )}
          </div>

          {/* ---------- package & billing: real invoices (P1 Task 1) ---------- */}
          <div className="panel">
            <div className="panel-head"><h3>Package & billing</h3></div>
            {pkg ? (
              <div className="kv">
                <div className="kv-row"><span className="k">Package</span><span className="v">{pkg.name || pkgKey}</span></div>
                {pkg.price != null && <div className="kv-row"><span className="k">Price</span><span className="v">₹{Number(pkg.price).toLocaleString('en-IN')}</span></div>}
                {pkg.billing && <div className="kv-row"><span className="k">Billing</span><span className="v">{pkg.billing}</span></div>}
                {pkg.description && <div className="kv-row"><span className="k">Includes</span><span className="v" style={{ fontWeight: 400, maxWidth: '60%' }}>{String(pkg.description).slice(0, 140)}</span></div>}
              </div>
            ) : (
              <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                {pkgKey ? `Package "${pkgKey}" not found in the packages table.` : 'No package assigned to this client yet.'}
              </div>
            )}

            <div className="section-title" style={{ marginTop: 16 }}>Invoices</div>
            {invoices.length === 0 ? (
              <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                No invoices raised for this client yet.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Invoice</th><th>Package</th><th>Amount</th><th>Status</th><th>Due</th><th>Paid</th></tr></thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td className="t-mono">{String(inv.id).slice(0, 8)}</td>
                        <td className="cell-dim">{inv.package_key ? String(inv.package_key).replace(/_/g, ' ') : '—'}</td>
                        <td><span className="cell-main">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</span> <span className="cell-dim">{inv.currency}</span></td>
                        <td>{statusPill(inv.status)}</td>
                        <td className="cell-dim">{fmtDate(inv.due_at)}</td>
                        <td className="cell-dim">{fmtDate(inv.paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ---------- retainer ---------- */}
        <div className="panel">
          <div className="panel-head"><h3>Retainer schedule</h3></div>
          {retainer.length === 0 ? (
            <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
              No retainer runs scheduled for this client.
              {pkgKey && /retainer|scale/i.test(pkgKey) ? ' This package is retainer-type — start one from the API when ready.' : ''}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Month</th><th>Package</th><th>Status</th><th>Next run</th><th>Started</th></tr></thead>
                <tbody>
                  {retainer.map((r: any) => (
                    <tr key={r.id}>
                      <td><span className="cell-main">Month {r.month_number ?? '—'}</span></td>
                      <td>{r.package_key || '—'}</td>
                      <td>{statusPill(r.status)}</td>
                      <td className="cell-dim">{fmtDate(r.next_run_at)}</td>
                      <td className="cell-dim">{fmtDate(r.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
