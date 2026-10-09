'use client';

// /memory — COMPANY MEMORY SEARCH (Phase 13, parallel lane).
// Contract (hermes-phase-13-prompt.md GOAL 3):
//   GET /api/v1/knowledge/query?q=<text>&client_id=<uuid|all>&limit=10
//   → { query, client_id, engine, chunks: [{ id, client_id, scope, kind,
//       title, content, source, created_at }], total, ms }
// The endpoint shape is frozen — this page only reads it.

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

interface Chunk {
  id: string; client_id: string | null; scope: string; kind: string;
  title: string | null; content: string; source: string | null; created_at: string;
}
interface Result { query: string; engine: string; chunks: Chunk[]; total: number; ms: number }

const btn: React.CSSProperties = {
  minHeight: 44, padding: '0 20px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const input: React.CSSProperties = {
  minHeight: 44, flex: 1, borderRadius: 8, border: '1px solid var(--border)',
  padding: '0 14px', fontSize: 15, background: 'var(--background)', color: 'var(--text)',
};

export default function MemoryPage() {
  const [q, setQ] = useState('');
  const [clientId, setClientId] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true); setError(null); setSearched(true);
    try {
      const params = new URLSearchParams({ q: query, limit: '10' });
      if (clientId.trim()) params.set('client_id', clientId.trim());
      const r = await apiFetch(`/api/v1/knowledge/query?${params.toString()}`);
      if (!r.ok) throw new Error('Search failed.');
      setData(await r.json());
    } catch (e: any) { setError(e.message || 'Search failed.'); }
    finally { setLoading(false); }
  }, [q, clientId]);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Company memory</h1>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 20px' }}>
        Semantic search over everything the company has learned — deliverables, decisions, client DNA.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          style={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
          placeholder="Ask the company's memory…"
          aria-label="Search company memory"
        />
        <button style={btn} onClick={search} disabled={loading || !q.trim()}>
          {loading ? '…' : 'Search'}
        </button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <input
          style={{ ...input, minHeight: 40, fontSize: 13, maxWidth: 340 }}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Client ID filter (optional)"
          aria-label="Filter by client ID"
        />
      </div>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {data && (
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 12px' }}>
          {data.total} result{data.total === 1 ? '' : 's'} · {data.engine} · {data.ms}ms
        </p>
      )}

      {searched && !loading && data && data.chunks.length === 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24,
          background: 'var(--card)', textAlign: 'center' }}>
          <p style={{ fontSize: 15, margin: '0 0 6px' }}>No memories yet for this.</p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
            Approve deliverables and they'll land here — the memory grows as the company works.
          </p>
        </div>
      )}

      {data?.chunks.map((c) => (
        <article key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 10,
          padding: '12px 16px', marginBottom: 10, background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <strong style={{ fontSize: 14 }}>{c.title || c.kind}</strong>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
              {c.kind}{c.scope ? ` · ${c.scope}` : ''}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 6px',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {c.content}
          </p>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {c.source && <span>{c.source} · </span>}
            {new Date(c.created_at).toLocaleDateString()}
          </div>
        </article>
      ))}
    </main>
  );
}
