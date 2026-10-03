/*
 * app/assets/page.tsx — Sprint 11 §1: the REAL assets library (Sprint 10's
 * filed deliverables finally have a home). Global library: every asset across
 * all clients — filter by client/type/date, thumbnail-or-icon cards (a
 * library, not a table dump), full preview (image renders, unpreviewable
 * types show "preview not available" honestly), reuse (logged), download.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

type Asset = {
  id: string;
  client_id: string | null;
  client_name?: string | null;
  workflow_id?: string | null;
  title: string;
  kind: string;
  content?: string | null;
  file_url?: string | null;
  version?: number;
  released_by?: string | null;
  released_at?: string | null;
  source?: string;
  created_at: string;
  metadata?: any;
};

const KIND_ICON: Record<string, string> = {
  image: '🖼️', file: '📄', link: '🔗', post: '✏️', report: '📊',
};

const KIND_FILTERS = ['all', 'image', 'file', 'report', 'post'];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  // Sprint 12 nit 5c: a real workflow picker dropdown (replaces window.prompt)
  const [reuseFor, setReuseFor] = useState<Asset | null>(null);
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  // Sprint 12 nit 5a: signed-URL thumbnails — Supabase objects render as real
  // thumbnails (not the Hermes image-cache route). Cached per asset id.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const targets = assets.filter((a) => a.kind === 'image' && a.file_url && !thumbs[a.id]);
    if (targets.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const a of targets.slice(0, 12)) {
        try {
          const res = await apiFetch(`/api/v1/assets/${a.id}/download`, { method: 'POST' });
          if (res.ok) {
            const body = await res.json().catch(() => null);
            if (body?.url) next[a.id] = body.url;
          }
        } catch { /* thumbnail is best-effort — the icon fallback shows */ }
      }
      if (!cancelled && Object.keys(next).length > 0) setThumbs((t) => ({ ...t, ...next }));
    })();
    return () => { cancelled = true; };
  }, [assets, thumbs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kindFilter !== 'all') params.set('kind', kindFilter);
      if (clientFilter) params.set('client_id', clientFilter);
      const res = await apiFetch(`/api/v1/assets?${params.toString()}`);
      const data = res.ok ? await res.json() : [];
      setAssets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [kindFilter, clientFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiFetch('/api/v1/clients')
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch('/api/v1/workflows?limit=100')
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setWorkflows((Array.isArray(d) ? d : []).map((w: any) => ({ id: w.id, name: w.name || w.title || w.id.slice(0, 8) }))))
      .catch(() => {});
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const download = async (a: Asset) => {
    setActionBusy(a.id);
    try {
      const res = await apiFetch(`/api/v1/assets/${a.id}/download`, { method: 'POST' });
      const body = res.ok ? await res.json().catch(() => ({})) : { error: `HTTP ${res.status}` };
      if (body.url) {
        window.open(body.url, '_blank');
        flash(`Downloading "${a.title}"…`);
      } else {
        flash(body.error || 'Download failed');
      }
    } catch (e: any) {
      flash(e?.message || 'Download failed');
    } finally {
      setActionBusy(null);
    }
  };

  const reuse = async (a: Asset, workflowId?: string | null) => {
    const wfId = workflowId || null;
    if (!wfId) return;
    setActionBusy(a.id);
    try {
      await apiFetch(`/api/v1/assets/${a.id}/reuse`, {
        method: 'POST',
        body: JSON.stringify({ workflow_id: wfId, note: 'reused from the library' }),
      });
      flash(`"${a.title}" reused into ${String(wfId).slice(0, 8)}… (logged)`);
      setReuseFor(null);
      void load();
    } catch (e: any) {
      flash(e?.message || 'Reuse failed');
    } finally {
      setActionBusy(null);
    }
  };

  const upload = async (form: { title: string; kind: string; client_id: string; content_text?: string; file?: File | null }) => {
    setActionBusy('upload');
    try {
      const body: any = { title: form.title, kind: form.kind, client_id: form.client_id };
      if (form.file) {
        const buf = await form.file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        body.content_base64 = btoa(binary);
        body.file_name = form.file.name;
      } else {
        body.content_text = form.content_text;
      }
      await apiFetch('/api/v1/assets/upload', { method: 'POST', body: JSON.stringify(body) });
      flash(`"${form.title}" uploaded + indexed`);
      setShowUpload(false);
      void load();
    } catch (e: any) {
      flash(e?.message || 'Upload failed');
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg, transparent)' }}>
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Assets</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            The library — every deliverable and asset across all clients
          </p>
        </div>
        <button onClick={() => setShowUpload((v) => !v)} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>
          {showUpload ? 'Close' : '+ Upload'}
        </button>
      </div>

      {/* Filters — ≥44px touch targets (Sprint 11 nit 2 discipline) */}
      <div className="flex items-center gap-2 px-6 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            aria-label={`Filter ${k}`}
            className="t-mono"
            style={{
              minHeight: 44, padding: '8px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              border: '1px solid ' + (kindFilter === k ? 'var(--accent, #004B63)' : 'var(--border-hairline)'),
              background: kindFilter === k ? 'var(--accent-dim, rgba(0,75,99,0.08))' : 'transparent',
              color: kindFilter === k ? 'var(--accent, #004B63)' : 'var(--text-faint)',
              fontWeight: kindFilter === k ? 700 : 500,
            }}
          >
            {k}
          </button>
        ))}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          aria-label="Filter by client"
          className="t-mono"
          style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, fontSize: 12, border: '1px solid var(--border-hairline)', background: 'var(--card)', color: 'var(--text)' }}
        >
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Upload panel */}
      {showUpload && <UploadPanel onSubmit={upload} busy={actionBusy === 'upload'} clients={clients} />}

      {/* Library grid — thumbnails where previewable, type icons otherwise */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-faint)' }}>
            <span className="t-mono">Loading library…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--red, #b91c1c)' }}>
            <p className="t-meta">{error}</p>
            <button onClick={() => void load()} className="btn btn-secondary btn-sm mt-3" style={{ minHeight: 44 }}>Retry</button>
          </div>
        ) : assets.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', borderRadius: 16, border: '1px solid var(--border-hairline)' }}>
            <p className="t-meta" style={{ color: 'var(--text-faint)' }}>
              No assets{kindFilter !== 'all' ? ` of type "${kindFilter}"` : ''} yet — filed deliverables and uploads land here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {assets.map((a) => (
              <article
                key={a.id}
                onClick={() => setPreview(a)}
                style={{
                  borderRadius: 14, border: '1px solid var(--border-hairline)', background: 'var(--card, #fff)',
                  overflow: 'hidden', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 12px -6px rgba(0,0,0,0.05)',
                }}
              >
                {/* Thumbnail where previewable, type icon otherwise (Sprint 12
                    nit 5a: signed-URL thumbnails for Supabase objects) */}
                <div style={{
                  height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: a.kind === 'image' && a.file_url ? 'var(--bg-2, #fafaf7)' : 'var(--bg-2, #fafaf7)',
                  borderBottom: '1px solid var(--border-hairline)',
                  fontSize: 28,
                }}>
                  {a.kind === 'image' && a.file_url
                    ? <img src={thumbs[a.id] || `/api/v1/images/file/${(a.file_url || '').split('/').pop()}`} alt={a.title} style={{ maxHeight: 84, maxWidth: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <span aria-hidden>{KIND_ICON[a.kind] || '📄'}</span>}
                </div>
                <div style={{ padding: 12 }}>
                  <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', marginBottom: 4 }}>
                    {a.title}
                  </h4>
                  <p className="t-mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                    {a.client_name || '—'} · {a.kind}{a.source === 'upload' ? ' · upload' : ''}{a.version ? ` · v${a.version}` : ''}
                  </p>
                  <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); void download(a); }}
                      disabled={actionBusy === a.id}
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: 44, padding: '6px 10px', fontSize: 11.5 }}
                    >
                      Download
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReuseFor(a); }}
                      disabled={actionBusy === a.id}
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: 44, padding: '6px 10px', fontSize: 11.5 }}
                    >
                      Reuse
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal — honest: image renders, text previews, unpreviewable says so */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card, #fff)', borderRadius: 16, padding: 20, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border-hairline)' }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <h3 className="t-meta" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{preview.title}</h3>
              <button onClick={() => setPreview(null)} className="t-mono" style={{ minHeight: 44, padding: '4px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16 }}>✕</button>
            </div>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
              {preview.client_name || '—'} · {preview.kind} · {preview.source === 'upload' ? 'upload' : 'filed'}{preview.released_by ? ` · released by ${preview.released_by}` : ''}
            </p>
            {preview.kind === 'image' && preview.file_url ? (
              <img src={`/api/v1/images/file/${(preview.file_url || '').split('/').pop()}`} alt={preview.title} style={{ maxWidth: '100%', borderRadius: 10 }} />
            ) : preview.content ? (
              <pre className="t-mono" style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: 'var(--bg-2, #fafaf7)', padding: 12, borderRadius: 10, border: '1px solid var(--border-soft)' }}>{preview.content}</pre>
            ) : preview.file_url ? (
              <p className="t-meta" style={{ color: 'var(--text-faint)', padding: 12, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 10 }}>Preview not available — {preview.kind} renders as a download only.</p>
            ) : (
              <p className="t-meta" style={{ color: 'var(--text-faint)', padding: 12, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 10 }}>Preview not available.</p>
            )}
            <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
              <button onClick={() => void download(preview)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>Download</button>
              <button onClick={() => { setPreview(null); setReuseFor(preview); }} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>Reuse</button>
            </div>
          </div>
        </div>
      )}

      {/* Reuse modal — a real workflow picker dropdown (Sprint 12 nit 5c) */}
      {reuseFor && (
        <div onClick={() => setReuseFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card, #fff)', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', border: '1px solid var(--border-hairline)' }}>
            <h3 className="t-meta" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Reuse "{reuseFor.title}"</h3>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
              Copy this asset into a workflow — one click, logged in the pipeline.
            </p>
            <select
              value=""
              onChange={(e) => { if (e.target.value) void reuse(reuseFor, e.target.value); }}
              aria-label="Target workflow"
              className="t-mono"
              style={{ width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--bg-2)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="">Pick a workflow…</option>
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
              <button onClick={() => setReuseFor(null)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--slate, #0A0A0A)', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 12.5, zIndex: 60, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }} className="t-meta">
          {toast}
        </div>
      )}
    </div>
  );
}

function UploadPanel({ onSubmit, busy, clients }: {
  onSubmit: (f: { title: string; kind: string; client_id: string; content_text?: string; file?: File | null }) => void;
  busy: boolean;
  clients: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('file');
  const [clientId, setClientId] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-hairline)', background: 'var(--bg-2, rgba(0,0,0,0.02))' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset title" aria-label="Asset title" className="t-meta" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--card)', color: 'var(--text)', fontSize: 13 }} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Asset type" className="t-mono" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--card)', color: 'var(--text)', fontSize: 13 }}>
          {['file', 'image', 'link', 'post', 'report'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client" className="t-mono" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--card)', color: 'var(--text)', fontSize: 13 }}>
          <option value="">Client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="File" className="t-mono" style={{ minHeight: 44, fontSize: 12, color: 'var(--text-faint)' }} />
        {!file && (
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste text content" aria-label="Text content" className="t-meta" rows={2} style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--card)', color: 'var(--text)', fontSize: 13 }} />
        )}
      </div>
      <button
        onClick={() => onSubmit({ title, kind, client_id: clientId, content_text: text, file })}
        disabled={busy || !title || !clientId || (!file && !text)}
        className="btn btn-primary btn-sm"
        style={{ minHeight: 44, marginTop: 10 }}
      >
        {busy ? 'Uploading…' : 'Upload + index'}
      </button>
    </div>
  );
}
