'use client';

// Projects — Operate surface (real page). Workflows with 8-step pipeline progress + Leads.
// Data: /api/v1/workflows + /api/v1/leads (auth via apiFetch).
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

interface PipelineStep {
  name: string;
  description?: string;
  agent?: string;
  status: string;
  started_at?: string;
  completed_at?: string;
}

interface Workflow {
  id: string;
  name: string;
  client_id?: string;
  current_step?: string | null;
  progress: number;
  status: string;
  steps_json: PipelineStep[];
  created_at: string;
}

interface Lead {
  id: string;
  company?: string;
  source?: string;
  status?: string;
  created_at: string;
}

// Pipeline step colors
const STEP_ACTIVE = 'var(--green)';
const STEP_DONE = 'var(--green)';
const STEP_TODO = 'var(--card-hover)';

function SegmentedPipeline({ steps }: { steps: PipelineStep[] }) {
  if (!steps || steps.length === 0) return <span className="t-meta" style={{ color: 'var(--text-faint)' }}>No steps</span>;
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div
          key={i}
          title={`${s.name} — ${s.status}`}
          style={{
            width: 22,
            height: 6,
            borderRadius: 3,
            background: s.status === 'completed' ? STEP_DONE : s.status === 'in_progress' ? STEP_ACTIVE : STEP_TODO,
          }}
        />
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [wfRes, leadRes] = await Promise.all([
        apiFetch('http://localhost:4000/api/v1/workflows'),
        apiFetch('http://localhost:4000/api/v1/leads'),
      ]);
      if (wfRes.ok) setWorkflows(await wfRes.json());
      if (leadRes.ok) setLeads(await leadRes.json());
    } catch (e) {
      console.error('Failed to fetch projects data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000); // refresh every 30s
    return () => clearInterval(t);
  }, [fetchAll]);

  const active = workflows.filter(w => w.status === 'active').length;
  const completed = workflows.filter(w => w.status === 'completed').length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Projects</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>Workflows & lead pipeline</p>
        </div>
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2">
            <span className="t-mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{active}</span>
            <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Active</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="t-mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{completed}</span>
            <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Completed</span>
          </span>
          <button onClick={fetchAll} className="btn btn-secondary btn-sm">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="t-mono" style={{ color: 'var(--text-faint)' }}>Loading…</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Workflows */}
          <section>
            <div className="section-head">
              <span className="t-label" style={{ color: 'var(--text-faint)' }}>Workflows</span>
              <span className="t-meta" style={{ color: 'var(--text-faint)' }}>{workflows.length} total</span>
            </div>
            {workflows.length === 0 ? (
              <div className="rounded-xl p-5" style={{ background: 'var(--panel-2)', boxShadow: 'var(--shadow-card)' }}>
                <p className="t-body" style={{ color: 'var(--text-faint)' }}>
                  No workflows yet — say "start pipeline for [client]" in the Office command bar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.slice(0, 20).map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'var(--panel-2)', boxShadow: 'var(--shadow-card)' }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="t-body-md truncate" style={{ color: 'var(--text)' }}>{w.name}</span>
                        <span className={`badge ${w.status === 'completed' ? 'badge-green' : w.status === 'active' ? 'badge-teal' : 'badge-gray'}`}>
                          {w.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <SegmentedPipeline steps={w.steps_json} />
                        <span className="t-mono" style={{ color: 'var(--text-faint)', fontSize: 11 }}>{w.progress}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                        {w.current_step ? `→ ${w.current_step}` : '—'}
                      </div>
                      <div className="feed-time mt-0.5">{new Date(w.created_at).toLocaleDateString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Leads */}
          <section>
            <div className="section-head">
              <span className="t-label" style={{ color: 'var(--text-faint)' }}>Leads</span>
              <span className="t-meta" style={{ color: 'var(--text-faint)' }}>{leads.length} total</span>
            </div>
            {leads.length === 0 ? (
              <div className="rounded-xl p-5" style={{ background: 'var(--panel-2)', boxShadow: 'var(--shadow-card)' }}>
                <p className="t-body" style={{ color: 'var(--text-faint)' }}>
                  No leads yet — run the GitHub/HN scraper scripts to populate.
                </p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--panel-2)', boxShadow: 'var(--shadow-card)' }}>
                {leads.slice(0, 15).map((l, i) => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-2.5"
                    style={{ borderBottom: i < Math.min(leads.length, 15) - 1 ? '1px solid var(--border-hairline)' : 'none' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="t-body-md truncate" style={{ color: 'var(--text)' }}>{l.company || l.id.slice(0, 8)}</span>
                      {l.source && <span className="badge badge-gray">{l.source}</span>}
                    </div>
                    <span className={`badge ${l.status === 'qualified' ? 'badge-green' : l.status === 'rejected' ? 'badge-red' : 'badge-gray'}`}>
                      {l.status || 'new'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
