'use client';

/*
 * ApprovalQueue — Sprint 7 "Approvals that show the work".
 * Deliverable PREVIEWS render in-card (OutputPreview: post like a post,
 * image renders, file downloads) — never a raw JSON dump.
 * Warm light tokens (design v6 vars) — old dead dark-* classes removed.
 * One-tap approve/reject, mobile-first: 44px touch targets, 360px clean.
 */
import React, { useState } from 'react';
import {
  FileText, MessageSquare, Megaphone, DollarSign,
  Cpu, Palette, Code, Check, X, Clock, AlertCircle, ChevronDown,
} from 'lucide-react';
import OutputPreview from '@/components/OutputPreview';
import FreshFacts from '@/components/approvals/FreshFacts';

interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  platform?: string;
  status: string;
  client_id?: string;
  requested_by?: string;
  payload_json?: any;
  created_at?: string;
  reviewed_at?: string;
  // Phase 6 GOAL 3 — triage fields (from /api/v1/approvals?triage=1)
  risk_tier?: string;  metadata?: any;
  triage_score?: number;
  triage_reasons?: string[];
  blocking?: boolean;
}

// Backend sometimes double-escapes titles ("&#x2F;" instead of "/").
// Decode entities once so cards never show raw "&#x2F;" text.
const decodeEntities = (s: string): string => {
  if (!s || !s.includes('&')) return s;
  try {
    const el = document.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  } catch {
    return s;
  }
};

// MISS 2 fix (frontend guard): legacy rows may still carry raw provider HTML
// in description. Strip tags + collapse whitespace before rendering. This is
// defense in depth — the API now cleans at insert time (providers/publishing.cleanError).
const cleanDesc = (s: string): string => {
  if (!s) return s;
  if (!s.includes('<')) return s;
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || s;
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; tint: string; label: string }> = {
  content: { icon: <FileText className="w-4 h-4" />, tint: 'rgba(99,102,241,0.14)', label: 'Content' },
  outreach: { icon: <MessageSquare className="w-4 h-4" />, tint: 'rgba(59,130,246,0.14)', label: 'Outreach' },
  campaign: { icon: <Megaphone className="w-4 h-4" />, tint: 'rgba(236,72,153,0.14)', label: 'Campaign' },
  spend: { icon: <DollarSign className="w-4 h-4" />, tint: 'rgba(245,158,11,0.16)', label: 'Spend' },
  strategy: { icon: <Cpu className="w-4 h-4" />, tint: 'rgba(168,85,247,0.14)', label: 'Strategy' },
  design: { icon: <Palette className="w-4 h-4" />, tint: 'rgba(6,182,212,0.14)', label: 'Design' },
  code: { icon: <Code className="w-4 h-4" />, tint: 'rgba(16,185,129,0.14)', label: 'Code' },
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending: { background: 'rgba(245,158,11,0.15)', color: '#b45309' },
  approved: { background: 'rgba(34,197,94,0.15)', color: '#15803d' },
  rejected: { background: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
  changes_requested: { background: 'rgba(245,158,11,0.15)', color: '#b45309' },
  expired: { background: 'rgba(100,116,139,0.12)', color: '#475569' },
};

interface ApprovalQueueProps {
  approvals: ApprovalItem[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onSnooze?: (id: string) => void;
  actionPending?: string | null;
  // Phase 6 GOAL 3 — bulk + selection (explicit select → confirm, no silent bulk)
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  // N3.14 — keyboard triage: focused card ring + click-to-focus
  focusedId?: string | null;
  onFocusCard?: (id: string) => void;
  // N3.14 — `o` toggles the expanded detail view
  expandedId?: string | null;
  onToggleExpand?: (id: string) => void;
  // N3.14 — `r` opens an inline reason field on the card (not a modal)
  reasonForId?: string | null;
  onReasonSubmit?: (id: string, reason: string) => void;
  onReasonCancel?: () => void;
  // N3.16 — visible rollback: id -> error message, with retry
  failed?: Record<string, string>;
  onRetry?: (id: string) => void;
  // N3 — show kbd hints + snooze only on the Decide tab
  showTriage?: boolean;
}

export function ApprovalQueue({
  approvals, onApprove, onReject, onSnooze, actionPending, selected, onToggleSelect,
  focusedId, onFocusCard, expandedId, onToggleExpand,
  reasonForId, onReasonSubmit, onReasonCancel,
  failed, onRetry, showTriage,
}: ApprovalQueueProps) {
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const selCount = selected?.size || 0;
  const [reasonText, setReasonText] = useState('');

  // Reset the reason draft whenever a different card's field opens.
  React.useEffect(() => { setReasonText(''); }, [reasonForId]);

  return (
    <section className="animate-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="t-title" style={{ fontSize: 16, color: 'var(--text)' }}>Approval Queue</h2>
        {pendingApprovals.length > 0 && (
          <span className="t-mono" style={{
            padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: 'rgba(245,158,11,0.15)', color: '#b45309',
          }}>
            {pendingApprovals.length} pending
          </span>
        )}
      </div>

      {approvals.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center', borderRadius: 16,
          background: 'var(--bg-2, transparent)', border: '1px solid var(--border-hairline, #eee)',
        }}>
          <AlertCircle style={{ width: 40, height: 40, margin: '0 auto 12px', color: 'var(--text-faint)', opacity: 0.4 }} />
          <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No approvals needed</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {approvals.map((approval) => {
            const config = TYPE_CONFIG[approval.type] || { icon: <FileText className="w-4 h-4" />, tint: 'rgba(100,116,139,0.14)', label: approval.type };
            const isPending = approval.status === 'pending';
            // Sprint 11 nit 6 — dedicated Gate ApprovalCard: gates (type='gate')
            // get a risk-tier badge + escalation flag + redacted payload
            // preview. No longer a generic approval row.
            const isGate = approval.type === 'gate';
            // Phase 13 GOAL 1: style-score chip — the lint score rides the card
            // payload (metadata.style_score, attachStyleLint). Render it visible.
            const styleScore = (approval as any).metadata?.style_score ?? (approval as any).payload_json?.style_score ?? null;
            const gateTier = isGate ? (approval as any).risk_tier || (approval as any).payload_json?.risk_tier || null : null;
            const gateEscalation = isGate && ((approval as any).metadata?.escalation || (approval as any).payload_json?.escalation);
            const TIER_STYLE: Record<string, { bg: string; color: string }> = {
              read: { bg: 'rgba(100,116,139,0.14)', color: '#475569' },
              write: { bg: 'rgba(245,158,11,0.16)', color: '#b45309' },
              external: { bg: 'rgba(239,68,68,0.16)', color: '#b91c1c' },
            };
            const tierStyle = gateTier ? (TIER_STYLE[gateTier] || TIER_STYLE.write) : null;
            const isFocused = showTriage && focusedId === approval.id;
            const isExpanded = expandedId === approval.id;
            const showReason = reasonForId === approval.id;
            const failMsg = failed?.[approval.id];

            return (
              <article
                key={approval.id}
                data-approval-id={approval.id}
                tabIndex={showTriage && isPending ? 0 : undefined}
                onClick={() => { if (showTriage && isPending) onFocusCard?.(approval.id); }}
                onFocus={() => { if (showTriage && isPending) onFocusCard?.(approval.id); }}
                style={{
                  borderRadius: 16, padding: 16, border: '1px solid var(--border-hairline, #eee)',
                  background: 'var(--card, #fff)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  borderColor: isFocused ? 'var(--accent)' : isPending ? 'rgba(245,158,11,0.35)' : 'var(--border-hairline, #eee)',
                  boxShadow: isFocused
                    ? '0 0 0 2px var(--accent), 0 4px 12px -6px rgba(0,0,0,0.06)'
                    : '0 1px 2px rgba(0,0,0,0.03), 0 4px 12px -6px rgba(0,0,0,0.06)',
                  outline: 'none',
                  cursor: showTriage && isPending ? 'pointer' : undefined,
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: config.tint, color: 'var(--text-dim, #333)',
                  }}>
                    {config.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: 2 }}>
                      <h4 className="t-meta" style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, wordBreak: 'break-word' }}>
                        {decodeEntities(approval.title)}
                      </h4>
                      <span className="t-mono" style={{
                        padding: '1px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
                        ...(STATUS_STYLE[approval.status] || STATUS_STYLE.pending),
                      }}>
                        {approval.status}
                      </span>
                    </div>
                    <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                      {config.label}
                      {approval.requested_by && ` · requested by @${approval.requested_by}`}
                    </p>
                    {isGate && tierStyle && (
                      <div className="flex items-center gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                        {/* Sprint 11 nit 6: risk-tier badge — read/write/external */}
                        <span className="t-mono" style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: tierStyle.bg, color: tierStyle.color,
                        }}>
                          {gateTier} risk
                        </span>
                        {gateEscalation && (
                          <span className="t-mono" style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: 'rgba(239,68,68,0.16)', color: '#b91c1c',
                          }}>
                            tier escalation — {gateTier} never approved before on this workflow
                          </span>
                        )}
                      </div>
                    )}
                    {styleScore != null && (
                      <div className="flex items-center gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                        {/* Phase 13 GOAL 1: style-score chip — lint score on the card */}
                        <span className="t-mono" style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: styleScore >= 7 ? 'rgba(76,175,80,0.16)' : styleScore >= 3 ? 'rgba(245,158,11,0.16)' : 'rgba(239,68,68,0.14)',
                          color: styleScore >= 7 ? '#2E7D32' : styleScore >= 3 ? '#b45309' : '#b91c1c',
                        }}>
                          style {styleScore}/10
                        </span>
                      </div>
                    )}
                    {approval.platform && (
                      <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Platform: {approval.platform}</p>
                    )}
                  </div>
                  {isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 2 }}>
                      {showTriage && onToggleSelect && (
                        <button
                          title="Select for bulk (x)"
                          aria-pressed={selected?.has(approval.id)}
                          onClick={(e) => { e.stopPropagation(); onToggleSelect(approval.id); }}
                          style={{
                            width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                            border: `1.5px solid ${selected?.has(approval.id) ? 'var(--accent)' : 'var(--border-hairline, #ccc)'}`,
                            background: selected?.has(approval.id) ? 'var(--accent)' : 'transparent',
                            color: '#fff', fontSize: 12, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                        >
                          {selected?.has(approval.id) ? '✓' : ''}
                        </button>
                      )}
                      <Clock style={{ width: 16, height: 16, color: '#b45309' }} />
                    </div>
                  )}
                </div>

                {approval.description && (
                  <p className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                    {cleanDesc(decodeEntities(approval.description))}
                  </p>
                )}

                {/* In-card deliverable preview — Sprint 1 pattern, never a JSON dump */}
                <div style={{
                  padding: 12, borderRadius: 12, marginBottom: 12,
                  background: 'var(--bg-2, #fafaf7)', border: '1px solid var(--border-soft, #eee)',
                }}>
                  <OutputPreview
                    payload={approval.payload_json}
                    agent={approval.requested_by}
                    kind={approval.type}
                    title={approval.title}
                  />
                </div>

                {/* One-tap actions — 44px touch targets */}
                <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border-soft, #eee)' }}>
                  {isPending ? (
                    <>
                      <button
                        className="flex-1"
                        style={{
                          padding: '10px 12px', minHeight: 44, borderRadius: 10,
                          background: '#004B63', color: '#fff', fontSize: 13.5, fontWeight: 600,
                          border: 'none', cursor: actionPending === approval.id ? 'wait' : 'pointer',
                          opacity: actionPending === approval.id ? 0.7 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        onClick={(e) => { e.stopPropagation(); onApprove?.(approval.id); }}
                        disabled={actionPending === approval.id}
                      >
                        <Check className="w-4 h-4" />
                        {actionPending === approval.id ? 'Approving…' : 'Approve'}
                        {showTriage && <span className="kbd" style={{ marginLeft: 4 }}>a</span>}
                      </button>
                      <button
                        className="flex-1"
                        style={{
                          padding: '10px 12px', minHeight: 44, borderRadius: 10,
                          background: 'rgba(239,68,68,0.1)', color: '#b91c1c', fontSize: 13.5, fontWeight: 600,
                          border: '1px solid rgba(239,68,68,0.25)', cursor: actionPending === approval.id ? 'wait' : 'pointer',
                          opacity: actionPending === approval.id ? 0.7 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // If the reason field is already open for this card,
                          // the input owns the flow — don't re-trigger.
                          if (reasonForId !== approval.id) onReject?.(approval.id);
                        }}
                        disabled={actionPending === approval.id}
                      >
                        <X className="w-4 h-4" />
                        {actionPending === approval.id ? 'Rejecting…' : 'Reject'}
                        {showTriage && <span className="kbd" style={{ marginLeft: 4 }}>r</span>}
                      </button>
                      {onSnooze && (
                        <button
                          title="Snooze to tomorrow (s)"
                          style={{
                            padding: '10px 12px', minHeight: 44, borderRadius: 10,
                            background: 'transparent', color: 'var(--text-faint)', fontSize: 13.5, fontWeight: 600,
                            border: '1px solid var(--border-hairline, #eee)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                          onClick={(e) => { e.stopPropagation(); onSnooze(approval.id); }}
                        >
                          <Clock className="w-4 h-4" />
                          {showTriage && <span className="kbd">s</span>}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                      Reviewed {approval.reviewed_at ? new Date(approval.reviewed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </div>
                  )}
                </div>

                {/* N3.16 visible rollback — the card returned with an honest error */}
                {failMsg && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span className="t-meta" style={{ fontSize: 12.5, color: '#b91c1c', flex: 1 }}>
                      Couldn't save that decision: {failMsg} The card is back — nothing was lost.
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetry?.(approval.id); }}
                      style={{
                        minHeight: 36, padding: '0 12px', borderRadius: 8, border: 'none',
                        background: '#b91c1c', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* N3.14 `r` — inline reason field on the card, not a modal */}
                {showReason && (
                  <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && reasonText.trim()) onReasonSubmit?.(approval.id, reasonText.trim());
                        if (e.key === 'Escape') { setReasonText(''); onReasonCancel?.(); }
                      }}
                      placeholder="Why reject? (Enter to confirm, Esc to cancel)"
                      aria-label="Rejection reason"
                      style={{
                        width: '100%', minHeight: 44, padding: '0 12px', borderRadius: 10,
                        border: '1px solid var(--accent)', fontSize: 13.5,
                        background: 'var(--bg, #fff)', color: 'var(--text)', outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => { if (reasonText.trim()) onReasonSubmit?.(approval.id, reasonText.trim()); }}
                        disabled={!reasonText.trim()}
                        style={{
                          minHeight: 40, padding: '0 14px', borderRadius: 8, border: 'none',
                          background: '#b91c1c', color: '#fff', fontSize: 13, fontWeight: 600,
                          cursor: reasonText.trim() ? 'pointer' : 'not-allowed',
                          opacity: reasonText.trim() ? 1 : 0.5,
                        }}
                      >
                        Reject with reason
                      </button>
                      <button
                        onClick={() => { setReasonText(''); onReasonCancel?.(); }}
                        style={{
                          minHeight: 40, padding: '0 14px', borderRadius: 8,
                          border: '1px solid var(--border-hairline, #eee)',
                          background: 'transparent', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        Cancel <span className="kbd">esc</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* N3.14 `o` — expanded detail: fresh facts at confirm time */}
                {showTriage && isPending && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(approval.id); }}
                    className="t-meta"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 8,
                      fontSize: 12.5, color: 'var(--text-faint)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" style={{ transform: isExpanded ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                    {isExpanded ? 'Less' : 'Details'} {showTriage && <span className="kbd">o</span>}
                  </button>
                )}
                {isExpanded && (
                  <div onClick={e => e.stopPropagation()}>
                    <FreshFacts approvalId={approval.id} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ApprovalQueue;
