/*
 * app/playbooks/page.tsx — Sprint 12 §1: the Playbook library (workflow-type
 * packs as installable modules — stop rebuilding, start reusing). Browse
 * packs, preview contents (stages, tasks, gates it will create — real
 * previews, not just names), Install → creates a real pipeline (one click,
 * logged). 44px targets, honest states, clean 360px.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

type Pack = {
  id: string; slug: string; name: string; workflow_type: string;
  version: number; description: string | null;
  stages_json?: any[]; tasks_json?: any[]; gates_json?: any[];
};

const TYPE_LABEL: Record<string, string> = {
  onboarding: 'One-time', content: 'Recurring', sales: 'Sales', retainer: 'Monthly loop',
};

export default function PlaybooksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Pack | null>(null);
  const [installFor, setInstallFor] = useState<Pack | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/playbooks');
      const data = res.ok ? await res.json() : [];
      setPacks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiFetch('/api/v1/clients')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openPreview = async (p: Pack) => {
    // Full preview from the API (stages, tasks, gates) — not just the row.
    try {
      const res = await apiFetch(`/api/v1/playbooks/${p.slug}`);
      if (res.ok) { setPreview(await res.json()); return; }
    } catch { /* fall back to the list row */ }
    setPreview(p);
  };

  const install = async () => {
    if (!installFor || !clientId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/playbooks/${installFor.slug}/install`, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId }),
      });
      const body = res.ok ? await res.json().catch(() => ({})) : { error: `HTTP ${res.status}` };
      if (res.ok && body.ok) {
        flash(`"${installFor.name}" installed — pipeline created (${body.tasks_created} tasks, ${body.gates_created} gates, logged)`);
        setInstallFor(null);
        setPreview(null);
      } else {
        flash(body.error || 'Install failed');
      }
    } catch (e: any) {
      flash(e?.message || 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg, transparent)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Playbooks</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Workflows as installable modules — preview, install, and the pipeline builds itself
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* Library — grouped by workflow type */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-faint)' }}>
            <span className="t-mono">Loading playbooks…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--red, #b91c1c)' }}>
            <p className="t-meta">{error}</p>
            <button onClick={() => void load()} className="btn btn-secondary btn-sm mt-3" style={{ minHeight: 44 }}>Retry</button>
          </div>
        ) : packs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', borderRadius: 16, border: '1px solid var(--border-hairline)' }}>
            <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No playbooks yet — packs land here when seeded.</p>
          </div>
        ) : (
          ['onboarding', 'content', 'sales', 'retainer'].map((t) => {
            const group = packs.filter((p) => p.workflow_type === t);
            if (group.length === 0) return null;
            return (
              <section key={t} style={{ marginBottom: 24 }}>
                <h2 className="t-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 10 }}>
                  {t} · {TYPE_LABEL[t]}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {group.map((p) => (
                    <article
                      key={p.id}
                      onClick={() => void openPreview(p)}
                      style={{
                        borderRadius: 14, border: '1px solid var(--border-hairline)', background: 'var(--card, #fff)',
                        padding: 16, cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 12px -6px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                        <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.name}</h4>
                        <span className="t-mono" style={{ padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'var(--bg-2)', color: 'var(--text-faint)' }}>v{p.version}</span>
                      </div>
                      <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.45, marginBottom: 10 }}>
                        {p.description || '—'}
                      </p>
                      {/* Real preview inline: stages the pack will create */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {(p.stages_json || (p as any).stages || []).slice(0, 4).map((s: any, i: number) => (
                          <span key={i} className="t-mono" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border-hairline)', color: 'var(--text-dim, #333)' }}>
                            {typeof s === 'string' ? s : s.name}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setInstallFor(p); }}
                        className="btn btn-primary btn-sm"
                        style={{ minHeight: 44, marginTop: 12, width: '100%' }}
                      >
                        Install →
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* Preview modal — stages, tasks, gates it will create */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card, #fff)', borderRadius: 16, padding: 20, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border-hairline)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <h3 className="t-meta" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{preview.name} <span className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>v{preview.version}</span></h3>
              <button onClick={() => setPreview(null)} className="t-mono" style={{ minHeight: 44, padding: '4px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16 }}>✕</button>
            </div>
            <p className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 14 }}>{preview.description}</p>

            <h4 className="t-mono" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 6 }}>Stages it will create</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              {(preview.stages_json || []).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)', width: 16 }}>{i + 1}.</span>
                  <span className="t-meta" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                  <span className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>— {s.description}</span>
                </div>
              ))}
            </div>

            <h4 className="t-mono" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 6 }}>Tasks it will create</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              {(preview.tasks_json || []).length === 0 ? (
                <span className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)' }}>None</span>
              ) : (preview.tasks_json || []).map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="t-mono" style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--text-faint)' }}>@{t.agent}</span>
                  <span className="t-meta" style={{ fontSize: 12.5, color: 'var(--text)' }}>{t.name}</span>
                  {t.step_name && <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>({t.step_name})</span>}
                </div>
              ))}
            </div>

            <h4 className="t-mono" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 6 }}>Approval gates</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {(preview.gates_json || []).length === 0 ? (
                <span className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)' }}>None</span>
              ) : (preview.gates_json || []).map((g: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="t-mono" style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: 'rgba(245,158,11,0.16)', color: '#b45309', fontWeight: 700 }}>{g.risk_tier} risk</span>
                  <span className="t-meta" style={{ fontSize: 12.5, color: 'var(--text)' }}>{g.name}</span>
                  {g.after_step && <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>after {g.after_step}</span>}
                </div>
              ))}
            </div>

            <button
              onClick={() => { setInstallFor(preview); }}
              disabled={busy}
              className="btn btn-primary btn-sm"
              style={{ minHeight: 44, width: '100%' }}
            >
              {busy ? 'Installing…' : 'Install → creates a real pipeline'}
            </button>
          </div>
        </div>
      )}

      {/* Install modal — client picker */}
      {installFor && (
        <div onClick={() => setInstallFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card, #fff)', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', border: '1px solid var(--border-hairline)' }}>
            <h3 className="t-meta" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Install "{installFor.name}"</h3>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
              Creates a real pipeline + tasks + gates for a client — one click, logged.
            </p>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="Client"
              className="t-mono"
              style={{ width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--bg-2)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="">Pick a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
              <button onClick={() => setInstallFor(null)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void install()} disabled={busy || !clientId} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>
                {busy ? 'Installing…' : 'Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--slate, #0A0A0A)', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 12.5, zIndex: 70, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }} className="t-meta">
          {toast}
        </div>
      )}
    </div>
  );
}
