"use client";

// TaskRunsPanel — Task Runs viewer: recent agent-execution tasks with expandable FULL OUTPUT.
// Solves "where do I see the result?" — every task's final output (LLM text, model, timing,
// error) is fetched from /api/v1/agents/execute/:taskId and rendered here as markdown-ish text.
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';
import { ChevronDown, ChevronRight, RefreshCw, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface TaskRow {
  id: string;
  title?: string;
  description?: string;
  assigned_to?: string;
  status: string;
  progress?: number;
  metadata?: {
    source?: string;
    model?: string;
    output?: string;
    error?: string;
    started_at?: string;
    completed_at?: string;
    failed_at?: string;
    action?: string;
    reply?: string;
  };
  created_at: string;
}

const STATE_DOT: Record<string, string> = {
  done: 'var(--green)',
  running: '#004B63',
  blocked: '#B94A3E',
  review: '#B98A2F',
  todo: 'rgba(255,255,255,0.3)',
  ready: 'rgba(255,255,255,0.3)',
};

export default function TaskRunsPanel({ onClose }: { onClose?: () => void }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [outputCache, setOutputCache] = useState<Record<string, TaskRow>>({});

  const fetchTasks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/kanban/cards');
      if (res.ok) {
        const data = await res.json();
        // Only agent-execution tasks (they carry metadata.source/model/output)
        const runs = (Array.isArray(data) ? data : []).filter((t: TaskRow) =>
          t.metadata && (t.metadata.source || t.metadata.model || t.metadata.output || t.metadata.error)
        ).slice(0, 30);
        setTasks(runs);
      }
    } catch (e) {
      console.error('Failed to fetch task runs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const t = setInterval(fetchTasks, 15000);
    return () => clearInterval(t);
  }, [fetchTasks]);

  // Expand → fetch the full task (output lives in metadata.output)
  const toggle = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!outputCache[id]) {
      try {
        const res = await apiFetch(`/api/v1/agents/execute/${id}`);
        if (res.ok) {
          const full = await res.json();
          setOutputCache((c) => ({ ...c, [id]: full }));
        }
      } catch (e) {
        console.error('Failed to fetch task output:', e);
      }
    }
  };

  const fmtTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <aside
      className="fixed right-0 top-14 bottom-0 z-40 flex flex-col w-96 max-w-full"
      style={{ background: 'var(--bg)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <span className="t-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Task Runs</span>
          <div className="t-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            {tasks.length} runs · click for full output
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTasks} className="p-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }} aria-label="Refresh">
            <RefreshCw style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.5)' }} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }} aria-label="Close">
              <X style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.5)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />
          </div>
        ) : tasks.length === 0 ? (
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, padding: '12px 4px' }}>
            No task runs yet — give the office a command and completed outputs will appear here.
          </p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => {
              const isExpanded = expanded === t.id;
              const full = outputCache[t.id];
              const dot = STATE_DOT[t.status] || 'rgba(255,255,255,0.3)';
              const output = full?.metadata?.output || t.metadata?.output;
              const error = full?.metadata?.error || t.metadata?.error;
              return (
                <div key={t.id} className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <button
                    onClick={() => toggle(t.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                    style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
                  >
                    {isExpanded
                      ? <ChevronDown style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                      : <ChevronRight style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />}
                    <span className="dot" style={{ width: 6, height: 6, background: dot, flexShrink: 0 }} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                        {t.title || t.description?.slice(0, 60) || t.id.slice(0, 8)}
                      </span>
                      <span className="t-mono block" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>
                        {t.assigned_to || '—'} · {t.status} · {fmtTime(t.metadata?.completed_at || t.metadata?.failed_at || t.created_at)}
                        {t.metadata?.model ? ` · ${t.metadata.model}` : ''}
                      </span>
                    </span>
                    {t.status === 'done' && <CheckCircle2 style={{ width: 12, height: 12, color: 'var(--green)', flexShrink: 0 }} />}
                    {t.status === 'blocked' && <AlertTriangle style={{ width: 12, height: 12, color: '#B94A3E', flexShrink: 0 }} />}
                    {t.status === 'running' && <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: '#004B63', flexShrink: 0 }} />}
                  </button>

                  {/* Expanded: FULL OUTPUT */}
                  {isExpanded && (
                    <div className="px-3 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {error ? (
                        <div className="mt-2 rounded-md p-2.5" style={{ background: 'rgba(185,74,62,0.12)' }}>
                          <span className="t-label" style={{ fontSize: 9, color: '#D97A6F' }}>Error</span>
                          <p className="t-mono mt-1" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap' }}>{error}</p>
                        </div>
                      ) : output ? (
                        <div className="mt-2 rounded-md p-2.5" style={{ background: 'rgba(22, 163, 74, 0.08)' }}>
                          <div className="flex items-center justify-between">
                            <span className="t-label" style={{ fontSize: 9, color: 'var(--green)' }}>Output</span>
                            <span className="t-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{full?.metadata?.model || ''}</span>
                          </div>
                          <p className="mt-1.5" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                            {output}
                          </p>
                        </div>
                      ) : t.metadata?.reply ? (
                        <div className="mt-2 rounded-md p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <span className="t-label" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Result</span>
                          <p className="mt-1" style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-wrap' }}>{t.metadata.reply}</p>
                        </div>
                      ) : (
                        <p className="mt-2 t-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          {t.status === 'running' ? 'Executing — output appears when the agent finishes…' : 'No output recorded'}
                        </p>
                      )}
                      {/* Timing */}
                      <div className="t-mono mt-2" style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                        started {fmtTime(t.metadata?.started_at || t.created_at)} · finished {fmtTime(t.metadata?.completed_at || t.metadata?.failed_at)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
