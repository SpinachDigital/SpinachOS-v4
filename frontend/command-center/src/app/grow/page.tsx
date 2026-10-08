'use client';

// Phase 10 GOAL 4 — GROW UI: the content calendar (/grow).
// Month/week calendar with items as chips (color by status), click → detail
// drawer (body, score, channel, schedule time, actions), "New idea" button,
// publish queue (approved + scheduled), history (published/failed with
// provider links or dry-run notes). Builds to the GOAL 1+3 contract freeze.

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

const STATUS_COLORS: Record<string, string> = {
  idea: 'var(--muted-foreground)',
  draft: '#C9A86A',
  in_review: '#5B8DEF',
  approved: '#4CAF50',
  scheduled: '#004B63',
  published: '#2E7D32',
  failed: '#C0392B',
};

interface GrowItem {
  id: string;
  title: string;
  body_text: string | null;
  channel: string;
  status: string;
  scheduled_for: string | null;
  provider_post_id: string | null;
  published_at: string | null;
  style_score: number | null;
  error: string | null;
}

export default function GrowPage() {
  const [items, setItems] = useState<GrowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GrowItem | null>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newChannel, setNewChannel] = useState('x');
  const [newBody, setNewBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/grow/calendar');
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error('Failed to fetch GROW calendar:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const refresh = async () => { await fetchData(); setSelected(s => (selected ? items.find(i => i.id === selected.id) || selected : null)); };

  const act = async (path: string, okMsg: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch(path, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice(data?.error || `Failed (${res.status})`);
      else setNotice(data?.dry_run ? data.note || okMsg : okMsg);
      await refresh();
    } catch (e: any) {
      setNotice(e?.message || 'Request failed');
    } finally { setBusy(false); }
  };

  const createIdea = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/v1/grow/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), channel: newChannel, body_text: newBody.trim() || undefined }),
      });
      if (res.ok) { setShowNewIdea(false); setNewTitle(''); setNewBody(''); await fetchData(); }
      else { const d = await res.json().catch(() => ({})); setNotice(d?.error || `Failed (${res.status})`); }
    } finally { setBusy(false); }
  };

  const deleteItem = async (id: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/grow/items/${id}`, { method: 'DELETE' });
      if (res.ok) { setSelected(null); await fetchData(); }
      else { const d = await res.json().catch(() => ({})); setNotice(d?.error || `Failed (${res.status})`); }
    } finally { setBusy(false); }
  };

  const queue = items.filter(i => i.status === 'approved' || i.status === 'scheduled');
  const history = items.filter(i => i.status === 'published' || i.status === 'failed');
  const byStatus = (s: string) => items.filter(i => i.status === s);

  return (
    <div style={{ padding: '24px', color: 'var(--foreground)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>GROW — Content Engine</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
            Calendar → generate → approve → publish → track. Nothing publishes without a founder-approved card.
          </p>
        </div>
        <button
          onClick={() => setShowNewIdea(true)}
          style={{ minHeight: 44, padding: '0 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer' }}
        >
          + New idea
        </button>
      </div>

      {notice && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 13 }}>
          {notice}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Loading calendar…</p>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'left' }}>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
            Empty calendar — invite the first idea. Create a content item, generate a draft, approve it from THE INBOX, publish.
          </p>
        </div>
      ) : (
        <>
          {/* Calendar: items as chips, grouped by status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
            {['idea', 'draft', 'in_review', 'approved', 'scheduled', 'published', 'failed'].map(status => {
              const group = byStatus(status);
              if (group.length === 0) return null;
              return (
                <div key={status} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status], display: 'inline-block' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{status}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{group.length}</span>
                  </div>
                  {group.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6, borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', minHeight: 44 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                        {item.channel}{item.style_score != null ? ` · style ${item.style_score}/10` : ''}{item.scheduled_for ? ` · ${new Date(item.scheduled_for).toLocaleString()}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Publish queue */}
          {queue.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Publish queue</h2>
              {queue.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 6, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title} <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>({item.channel} · {item.status})</span></div>
                    {item.scheduled_for && <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>due {new Date(item.scheduled_for).toLocaleString()}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {item.status === 'approved' && (
                      <button disabled={busy} onClick={() => act(`/api/v1/grow/items/${item.id}/publish`, 'Published')} style={{ minHeight: 36, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>Publish</button>
                    )}
                    <button disabled={busy} onClick={() => setSelected(item)} style={{ minHeight: 36, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer' }}>Open</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>History</h2>
              {history.map(item => (
                <div key={item.id} style={{ padding: '10px 14px', marginBottom: 6, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    <span style={{ color: STATUS_COLORS[item.status] }}>●</span> {item.title} <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>({item.channel})</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    {item.status === 'published'
                      ? `${item.published_at ? new Date(item.published_at).toLocaleString() : ''} · post ${item.provider_post_id?.startsWith('dryrun-') ? 'dry-run (no provider connected)' : item.provider_post_id}`
                      : `failed: ${item.error || 'unknown error'}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--card)', borderLeft: '1px solid var(--border)', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{selected.title}</h3>
              <button onClick={() => setSelected(null)} style={{ minHeight: 32, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
              {selected.channel} · {selected.status}{selected.style_score != null ? ` · style ${selected.style_score}/10` : ''}
              {selected.scheduled_for ? ` · due ${new Date(selected.scheduled_for).toLocaleString()}` : ''}
            </div>
            {selected.body_text && (
              <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-soft)', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                {selected.body_text}
              </div>
            )}
            {selected.error && (
              <div style={{ padding: 12, borderRadius: 8, border: '1px solid #C0392B', fontSize: 12, color: '#C0392B', marginBottom: 12 }}>
                {selected.error}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['idea', 'draft'].includes(selected.status) && (
                <>
                  <button disabled={busy} onClick={() => act(`/api/v1/grow/items/${selected.id}/generate`, 'Draft generated — card in THE INBOX')} style={{ minHeight: 44, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer' }}>Generate</button>
                  <button disabled={busy} onClick={() => deleteItem(selected.id)} style={{ minHeight: 44, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#C0392B', cursor: 'pointer' }}>Delete</button>
                </>
              )}
              {selected.status === 'approved' && (
                <button disabled={busy} onClick={() => act(`/api/v1/grow/items/${selected.id}/publish`, 'Published')} style={{ minHeight: 44, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>Publish now</button>
              )}
              {['published', 'failed', 'scheduled'].includes(selected.status) && (
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', alignSelf: 'center' }}>
                  {selected.status === 'published' ? 'Published — see history for the provider link.' : selected.status === 'scheduled' ? 'Scheduled — the scheduler publishes when due.' : 'Failed — fix and regenerate as a new idea.'}
                </span>
              )}
            </div>
            {selected.provider_post_id && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted-foreground)' }}>
                Provider post id: {selected.provider_post_id.startsWith('dryrun-') ? 'dry-run (no provider connected)' : selected.provider_post_id}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New idea modal */}
      {showNewIdea && (
        <div onClick={() => setShowNewIdea(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, maxWidth: '92vw', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>New idea</h3>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title"
              style={{ width: '100%', minHeight: 44, padding: '0 12px', marginBottom: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 14, boxSizing: 'border-box' }}
            />
            <select
              value={newChannel}
              onChange={e => setNewChannel(e.target.value)}
              style={{ width: '100%', minHeight: 44, padding: '0 12px', marginBottom: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 14, boxSizing: 'border-box' }}
            >
              <option value="x">X / Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="blog">Blog</option>
            </select>
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Initial thought (optional — generate fills the draft)"
              rows={4}
              style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewIdea(false)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button disabled={busy || !newTitle.trim()} onClick={createIdea} style={{ minHeight: 44, padding: '0 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff', cursor: newTitle.trim() ? 'pointer' : 'not-allowed' }}>Create idea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}