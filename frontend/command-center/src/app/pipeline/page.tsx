'use client';

/*
 * /pipeline — Sprint 10 P1: the DELIVER index page (this sprint owns it).
 * Lists every pipeline (workflow) with live status, current step, progress,
 * stuck flags, and deep-links to /pipeline/[id]. Filters that work. Honest
 * empty state. Every number traces to a DB row.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useWebSocketStore } from '@/lib/office/wsStore';
// N2.9: narrative header — happening/happened/next/who-acts.
import WorkflowHeader from '@/components/workflow/WorkflowHeader';

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
  // N2.11 (progressive enhancement): populated by the backend when available
  // (Hermes: N2.11-backend). Renders deal-rotting alerts; absent = current behavior.
  idle_hours?: number | null;
  stuck?: boolean | null;
};

// Stage SLA: past this many idle hours a card is "rotting".
const STAGE_SLA_HOURS = 72;

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
      if (!res.ok) throw new Error('Could not load pipelines. Check your connection and retry.');
      const data = await res.json();
      setRows(data.pipelines || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    void load();
    // Phase 5 GOAL 5: the 10s poll is GONE — the page re-loads when a
    // pipeline_event arrives over the WebSocket (live, no polling).
  }, [load]);

  // WS-driven reload: subscribe to the pipeline version from the WS store.
  const pipelineVersion = useWebSocketStore((s) => s.pipelineVersion);
  const lastVersionRef = useRef(pipelineVersion);
  useEffect(() => {
    if (pipelineVersion !== lastVersionRef.current) {
      lastVersionRef.current = pipelineVersion;
      void load();
    }
  }, [pipelineVersion, load]);

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

      {/* N2.9: narrative header — computed from the page's own data. */}
      {!error && rows !== null && rows.length > 0 && (() => {
        const active = rows.filter((r) => r.status === 'active').length;
        const blocked = rows.filter((r) => r.status === 'blocked').length;
        const done = rows.filter((r) => r.status === 'completed').length;
        return (
          <WorkflowHeader
            happening={`${active} active pipeline${active === 1 ? '' : 's'}${blocked > 0 ? ` — ${blocked} blocked` : ''}`}
            happened={`${done} completed`}
            next={blocked > 0 ? `${blocked} blocked — unblock or approve the gate` : 'No blockers — agents keep advancing'}
            actor="Agents advance — you approve the gates"
          />
        );
      })()}

      <div className="filter-row" role="search">
        <input
          className="filter-input"
          placeholder="Search pipelines, clients, steps…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Search pipelines"
        />
        <div className="pill-group" style={{ display: 'flex', gap: 8 }}>
          {['all', 'active', 'blocked', 'completed'].map((s) => (
            <button
              key={s}
              className={`pill ${statusFilter === s ? 'pill-active' : ''}`}
              onClick={() => setStatusFilter(s)}
              aria-label={`Filter ${s}`}
              style={{
                minHeight: 44,           // Sprint 11 nit 2: ≥44px touch targets
                padding: '10px 16px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="state-error" role="alert">
          Couldn't load pipelines — {error}{' '}
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
        {filtered.map((r) => {
          // N2.11: deal-rotting — idle past the stage SLA turns the card red.
          // Renders only when the backend ships idle_hours/stuck.
          const rotting = r.stuck === true || (r.idle_hours != null && r.idle_hours >= STAGE_SLA_HOURS);
          return (
          <Link key={r.id} href={`/pipeline/${r.id}`} className="card pipeline-card"
            style={rotting ? { borderColor: 'var(--danger)' } : undefined}>
            <div className="card-head">
              <b>{r.name}</b>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {rotting && <span className="pill" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 700 }}>STUCK</span>}
                <span className={`pill ${statusPill(r.status)}`}>{r.status}</span>
              </span>
            </div>
            <div className="card-meta">
              <span>{r.client_name || '—'}</span>
              {/* Sprint 11 nit 3: step counter off-by-one fixed — "step 7/6"
                  on completed pipelines. Cap at total; 0-step workflows show
                  the honest state. */}
              <span> · {r.total_steps === 0 ? 'no steps' : `step ${Math.min(r.completed_steps + 1, r.total_steps)}/${r.total_steps}`}</span>
              {r.current_step && <span> · {r.current_step}</span>}
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={r.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-fill" style={{ width: `${r.progress}%` }} />
            </div>
            <div className="card-foot">
              <span>{r.progress}%</span>
              {/* N2.11: idle time becomes a visual property of the card. */}
              {r.idle_hours != null && r.status === 'active' && (
                <span style={{ color: rotting ? 'var(--danger)' : 'inherit', fontWeight: rotting ? 700 : 400 }}>
                  · idle {r.idle_hours >= 48 ? `${Math.round(r.idle_hours / 24)}d` : `${Math.round(r.idle_hours)}h`}
                </span>
              )}
              <span>{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
