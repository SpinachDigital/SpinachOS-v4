'use client';

// /tasks/[id] — Sprint 1 "Show me the work" task detail view.
// Status header + step timeline + OUTPUTS (formatted by kind — a LinkedIn post
// renders like a post: avatar row, body, char count, copy button — never a
// JSON dump). Honest "no outputs yet" state. No fake data.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

type Output = {
  id: string; kind: 'text' | 'image' | 'file' | 'link';
  title: string | null; body: string | null;
  meta: Record<string, unknown>; created_at: string;
};
type Task = {
  id: string; title: string; status: string; progress: number;
  assigned_to: string | null; metadata: Record<string, any>; created_at: string;
};
type Detail = { task: Task; timeline: { at: string; event: string; detail: string }[]; outputs: Output[] };

const STATUS_PILL: Record<string, string> = {
  done: 'done', running: 'running', in_progress: 'running', blocked: 'blocked', review: 'review', todo: 'todo', ready: 'todo',
};

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

// LinkedIn-style post preview — the deliverable renders like the real thing.
function OutputCard({ out, agent }: { out: Output; agent?: string }) {
  const [copied, setCopied] = useState(false);
  const body = out.body || '';
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [body]);

  return (
    <div className="panel output-card" style={{ marginBottom: 14 }}>
      <div className="panel-head">
        <h3>
          {out.kind === 'link' ? '🔗 Link' : out.kind === 'image' ? '🖼️ Image' : out.kind === 'file' ? '📎 File' : '📝 Deliverable'}
        </h3>
        <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{fmtTime(out.created_at)}</span>
      </div>

      {out.kind === 'link' ? (
        <a href={body} target="_blank" rel="noreferrer" className="t-meta" style={{ color: 'var(--green-bright)', wordBreak: 'break-all' }}>{body}</a>
      ) : out.kind === 'image' ? (
        <img src={body} alt={out.title || 'output'} style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--border-soft)' }} />
      ) : (
        <>
          {/* avatar row — renders like a social post, not a JSON dump */}
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <div className="avatar" style={{ width: 34, height: 34, fontSize: 12, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-dim)', color: 'var(--green-bright)', fontWeight: 700 }}>
              {(agent || 'SD').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="t-meta" style={{ fontSize: 12.5, fontWeight: 600 }}>{agent ? `@${agent}` : 'Spinach Digital'}</div>
              <div className="t-mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{body.length.toLocaleString('en-IN')} chars</div>
            </div>
          </div>
          <p className="t-meta" style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{body}</p>
          <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
            {typeof out.meta.model === 'string' && (
              <span className="t-mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{String(out.meta.model)}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TaskDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/tasks/${id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.status === 404 ? 'Task not found' : `API ${res.status}` }));
        throw new Error(j.error || `API ${res.status}`);
      }
      setDetail(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !detail) {
    return (
      <div className="page">
        <div className="page-head"><div className="skeleton" style={{ height: 24, width: 300 }} /></div>
        <div className="page-body">
          <div className="skeleton" style={{ height: 60, marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="page">
        <div className="page-head"><h1>Task</h1></div>
        <div className="page-body">
          <div className="empty-state"><h3>Task unavailable</h3><p>{error}</p></div>
        </div>
      </div>
    );
  }

  const t = detail!.task;
  const isRunning = t.status === 'running' || t.status === 'in_progress';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ maxWidth: 640, lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>{t.title}</h1>
          <p className="sub">
            <span className={`pill ${STATUS_PILL[t.status] || 'draft'}`}>{t.status}</span>
            {' · '}{t.assigned_to ? `@${t.assigned_to}` : 'unassigned'}{' · created '}{fmtTime(t.created_at)}
          </p>
        </div>
        <div className="actions">
          {isRunning && <span className="live-badge"><span className="dot dot-green dot-pulse" />live — auto-refresh 15s</span>}
        </div>
      </div>

      <div className="page-body">
        {/* timeline */}
        <div className="section-title">Timeline</div>
        <div className="panel" style={{ padding: 14 }}>
          {detail!.timeline.length === 0 ? (
            <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No lifecycle events recorded.</p>
          ) : (
            detail!.timeline.map((e, i) => (
              <div key={i} className="flex items-baseline gap-3" style={{ padding: '7px 0', borderBottom: i < detail!.timeline.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)', minWidth: 92 }}>{fmtTime(e.at)}</span>
                <span className={`pill ${e.event === 'failed' ? 'blocked' : e.event === 'completed' ? 'done' : 'draft'}`} style={{ minWidth: 76, textAlign: 'center' }}>{e.event}</span>
                <span className="t-meta" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{e.detail}</span>
              </div>
            ))
          )}
        </div>

        {/* outputs */}
        <div className="section-title">Outputs</div>
        {detail!.outputs.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <h3>{isRunning ? 'No outputs yet — agent is working' : 'No outputs yet'}</h3>
              <p>{isRunning ? 'The deliverable appears here the moment the agent finishes.' : 'This task completed without a recorded deliverable.'}</p>
            </div>
          </div>
        ) : (
          detail!.outputs.map((o) => <OutputCard key={o.id} out={o} agent={t.assigned_to || undefined} />)
        )}

        {/* failure detail — honest, visible */}
        {t.metadata?.error && (
          <>
            <div className="section-title">Failure detail</div>
            <div className="panel" style={{ background: 'var(--danger-soft)', borderColor: 'rgba(239,68,68,0.25)' }}>
              <p className="t-mono" style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>{String(t.metadata.error).slice(0, 2000)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
