'use client';

/*
 * Sprint 8 §2 — Inline card system for chat (surface, not page).
 * Generic + extensible: one ChatCard dispatches by object kind — task,
 * deliverable, approval — each renderable inline and deep-linked to its
 * full page. Sprint 9 will standardize agent emission of these shapes;
 * where data is missing, cards show honest "no live data", never fakes.
 *
 * UI EVENT CONTRACT (the exact shapes these cards consume):
 *
 *  TaskCard      { id, title, status, current_step?, agent?, progress?, updated_at? }
 *                — deep link: /tasks/[id]
 *  DeliverableCard { id, kind: 'text'|'image'|'link'|'file', payload, agent?, task_id? }
 *                — payload shapes match OutputPreview's pick(): {text, platform},
 *                  {url}, {file_path}; deep link: /tasks/[task_id] when present
 *  ApprovalCard  { id, type, title, description?, platform?, status,
 *                  requested_by?, payload_json, created_at?, reviewed_at? }
 *                — deep link: /approvals ; approve/reject inline POST
 *                  /api/v1/approvals/:id/approve|reject (same mutation +
 *                  audit trail + reviewed_at as the queue)
 */
import { useState, useCallback } from 'react';
import Link from 'next/link';
import OutputPreview from '@/components/OutputPreview';
import { apiFetch } from '@/lib/auth';

const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#b45309' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#15803d' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
  changes_requested: { bg: 'rgba(245,158,11,0.15)', color: '#b45309' },
  expired: { bg: 'rgba(100,116,139,0.12)', color: '#475569' },
  todo: { bg: 'rgba(100,116,139,0.12)', color: '#475569' },
  ready: { bg: 'rgba(100,116,139,0.12)', color: '#475569' },
  running: { bg: 'rgba(59,130,246,0.14)', color: '#1d4ed8' },
  in_progress: { bg: 'rgba(59,130,246,0.14)', color: '#1d4ed8' },
  review: { bg: 'rgba(168,85,247,0.14)', color: '#7e22ce' },
  blocked: { bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
  done: { bg: 'rgba(34,197,94,0.15)', color: '#15803d' },
};

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

function Pill({ status }: { status: string }) {
  const s = STATUS_PILL[status] || STATUS_PILL.todo;
  return (
    <span className="t-mono" style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

const CARD_SHELL: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border-hairline, #eee)',
  background: 'var(--card, #fff)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 12px -6px rgba(0,0,0,0.06)',
  padding: 14,
  margin: '8px 0',
};

// ---------- TaskCard ----------
export function TaskCard({ obj }: { obj: any }) {
  const hasData = obj && obj.id;
  return (
    <div style={CARD_SHELL}>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
        <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', margin: 0, wordBreak: 'break-word' }}>
          {hasData ? obj.title : 'Task'}
        </h4>
        {hasData && <Pill status={obj.status || 'unknown'} />}
      </div>
      {hasData ? (
        <>
          <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            {obj.agent ? `@${obj.agent}` : 'unassigned'}
            {obj.current_step ? ` · ${obj.current_step}` : ' · no live step data'}
            {` · ${fmtTime(obj.updated_at || obj.created_at)}`}
          </p>
          {typeof obj.progress === 'number' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, borderRadius: 99, background: 'var(--border-soft, #eee)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, obj.progress)}%`, borderRadius: 99, background: '#004B63', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
          <Link href={`/tasks/${obj.id}`} className="t-meta" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#004B63', textDecoration: 'none', minHeight: 24, padding: '2px 0' }}>
            Open task →
          </Link>
        </>
      ) : (
        <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>No live data for this task yet — the agent profile doesn't emit task events yet.</p>
      )}
    </div>
  );
}

// ---------- DeliverableCard ----------
export function DeliverableCard({ obj }: { obj: any }) {
  const hasData = obj && (obj.payload != null);
  return (
    <div style={CARD_SHELL}>
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: 8 }}>
        <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', margin: 0 }}>
          {obj.kind === 'image' ? '🖼️ Deliverable — image' : obj.kind === 'file' ? '📎 Deliverable — file' : obj.kind === 'link' ? '🔗 Deliverable — link' : '📝 Deliverable'}
        </h4>
        {obj.agent && <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>@{obj.agent}</span>}
      </div>
      {hasData ? (
        <OutputPreview payload={obj.payload} agent={obj.agent} kind={obj.kind} />
      ) : (
        <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>No deliverable attached yet.</p>
      )}
      {obj.task_id && (
        <Link href={`/tasks/${obj.task_id}`} className="t-meta" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#004B63', textDecoration: 'none', minHeight: 24, padding: '2px 0' }}>
          Open task →
        </Link>
      )}
    </div>
  );
}

// ---------- ApprovalCard (inline approve/reject — same object as the queue) ----------
export function ApprovalCard({ obj }: { obj: any }) {
  const [state, setState] = useState<any>(obj);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const isPending = state?.status === 'pending';

  const act = useCallback(async (action: 'approve' | 'reject') => {
    setBusy(action);
    try {
      const body: Record<string, unknown> = {};
      if (action === 'reject' && reason.trim()) body.reason = reason.trim();
      const res = await apiFetch(`/api/v1/approvals/${state.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        const updated = await res.json();
        setState((s: any) => ({ ...s, ...updated, status: action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }));
        setShowReason(false);
      }
    } catch { /* honest error stays on the card */ } finally { setBusy(null); }
  }, [state?.id, reason]);

  if (!state?.id) {
    return (
      <div style={CARD_SHELL}>
        <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>No approval data.</p>
      </div>
    );
  }

  return (
    <div style={{ ...CARD_SHELL, borderColor: isPending ? 'rgba(245,158,11,0.35)' : 'var(--border-hairline, #eee)' }}>
      <div className="flex items-start justify-between gap-2" style={{ marginBottom: 8 }}>
        <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', margin: 0, wordBreak: 'break-word' }}>{state.title}</h4>
        <Pill status={state.status} />
      </div>
      <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
        {state.type || 'approval'}
        {state.requested_by ? ` · requested by @${state.requested_by}` : ''}
        {state.platform ? ` · ${state.platform}` : ''}
      </p>

      {/* full preview in-card — same OutputPreview as the queue */}
      <div style={{ padding: 10, borderRadius: 10, margin: '10px 0', background: 'var(--bg-2, #fafaf7)', border: '1px solid var(--border-soft, #eee)' }}>
        <OutputPreview payload={state.payload_json} agent={state.requested_by} kind={state.type} title={state.title} />
      </div>

      {isPending ? (
        <>
          {showReason && (
            <div style={{ marginBottom: 8 }}>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Rejection reason (optional)…"
                className="t-meta"
                style={{ width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-soft, #ddd)', background: 'var(--bg, #fff)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => act('approve')}
              disabled={busy !== null}
              style={{ flex: 1, padding: '10px 12px', minHeight: 44, borderRadius: 10, background: '#004B63', color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== 'approve' ? 0.6 : 1 }}
            >
              {busy === 'approve' ? 'Approving…' : '✓ Approve'}
            </button>
            <button
              onClick={() => (showReason && reason.trim() ? act('reject') : setShowReason(true))}
              disabled={busy !== null}
              style={{ flex: 1, padding: '10px 12px', minHeight: 44, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#b91c1c', fontSize: 13.5, fontWeight: 600, border: '1px solid rgba(239,68,68,0.25)', cursor: busy ? 'wait' : 'pointer', opacity: busy && busy !== 'reject' ? 0.6 : 1 }}
            >
              {busy === 'reject' ? 'Rejecting…' : showReason ? '✕ Confirm reject' : '✕ Reject'}
            </button>
          </div>
        </>
      ) : (
        <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '10px 0 0' }}>
          Reviewed {fmtTime(state.reviewed_at)}
        </p>
      )}

      <Link href="/approvals" className="t-meta" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#004B63', textDecoration: 'none', minHeight: 24, padding: '2px 0' }}>
        Open approvals →
      </Link>
    </div>
  );
}

// ---------- generic dispatcher ----------
export function ChatCard({ kind, obj }: { kind: 'task' | 'deliverable' | 'approval'; obj: any }) {
  if (kind === 'task') return <TaskCard obj={obj} />;
  if (kind === 'deliverable') return <DeliverableCard obj={obj} />;
  return <ApprovalCard obj={obj} />;
}

export default ChatCard;
