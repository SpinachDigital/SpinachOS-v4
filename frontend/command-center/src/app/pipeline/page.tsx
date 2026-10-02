'use client';

/*
 * /pipeline — Sprint 10 P1: the DELIVER index page (this sprint owns it).
 * Lists every pipeline (workflow) with live status, current step, progress,
 * stuck flags, and deep-links to /pipeline/[id]. Filters that work. Honest
 * empty state. Every number traces to a DB row.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

type PipelineRow = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  progress: number;
  current_step: string | null;
  total_steps: number;
  completed_steps: number;
  created_at: string;
};

const statusPill = (s: string) => {
  const map: Record<string, string> = {
    active: 'pill-ok',
    completed: 'pill-dim',
    blocked: 'pill-warn',
  };
  return map[s] || 'pill-dim';
};

export default function PipelineIndexPage() {
  const [rows, setRows] = useState<PipelineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetch('/api/v1/pipelines-index');
      if (!res.ok) throw new Error(`pipelines-index ${res.status}`);
      const data = await res.json();
      setRows(data.pipelines || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10_000); // max 10s staleness
    return () => clearInterval(id);
  }, [load]);

  const filtered = (rows || []).filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.client_name || '').toLowerCase().includes(q) || (r.current_step || '').toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Pipelines — DELIVER</h1>
          <p>Auto-advance on real events · approval gates between stages · stuck stages surface in THE INBOX</p>
        </div>
      </header>

      <div className="filter-row" role="search">
        <input
          className="filter-input"
          placeholder="Search pipelines, clients, steps…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search pipelines"
        />
        <div className="pill-group">
          {['all', 'active', 'blocked', 'completed'].map((s) => (
            <button
              key={s}
              className={`pill ${statusFilter === s ? 'pill-active' : ''}`}
              onClick={() => setStatusFilter(s)}
              aria-label={`Filter ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="state-error" role="alert">
          Pipelines load failed: {error} — retry kar raha hoon…{' '}
          <button className="btn btn-sm" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {!error && rows === null && <div className="state-loading">Loading pipelines…</div>}

      {!error && rows !== null && filtered.length === 0 && (
        <div className="state-empty">
          {rows.length === 0
            ? 'No pipelines yet — onboard a client (Client 360 → Onboard) ya Win flow se pipeline banega.'
            : 'No pipelines match this filter — filter clear karo.'}
        </div>
      )}

      <div className="card-list">
        {filtered.map((r) => (
          <Link key={r.id} href={`/pipeline/${r.id}`} className="card pipeline-card">
            <div className="card-head">
              <b>{r.name}</b>
              <span className={`pill ${statusPill(r.status)}`}>{r.status}</span>
            </div>
            <div className="card-meta">
              <span>{r.client_name || '—'}</span>
              <span> · step {r.completed_steps + 1}/{r.total_steps}</span>
              {r.current_step && <span> · {r.current_step}</span>}
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={r.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-fill" style={{ width: `${r.progress}%` }} />
            </div>
            <div className="card-foot">
              <span>{r.progress}%</span>
              <span>{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
