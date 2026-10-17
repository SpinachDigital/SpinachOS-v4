'use client';

// NudgeList — N3.22 "Next up" surface.
// Renders GET /api/v1/nudges: one suggestion + one-click deep-link action
// per nudge. Never auto-acts. Honest states via the N1 AsyncState primitives.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { LoadingState, ErrorState, EmptyState } from '@/components/states/AsyncState';

export interface Nudge {
  kind: string;
  title: string;
  why?: string;
  severity?: string;
  // Backend shape: { label, type, target }. Accept `href` too (plan shape).
  action?: { label: string; href?: string; target?: string };
  id?: string;
}

const KIND_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  stale_approval: { bg: 'rgba(245,158,11,0.14)', color: '#b45309', label: 'Stale approval' },
  silent_lead: { bg: 'rgba(59,130,246,0.14)', color: '#1d4ed8', label: 'Silent lead' },
  stuck_pipeline: { bg: 'rgba(239,68,68,0.14)', color: '#b91c1c', label: 'Stuck pipeline' },
};

export default function NudgeList({ limit }: { limit?: number }) {
  const [nudges, setNudges] = useState<Nudge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch('/api/v1/nudges');
      if (!r.ok) throw new Error(`Couldn't load nudges (${r.status}).`);
      const data = await r.json();
      setNudges(Array.isArray(data) ? data : (data.nudges ?? []));
    } catch (e: any) {
      setError(e.message || "Couldn't reach the API.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (nudges === null) return <LoadingState label="Checking what needs you…" />;
  // UX pass (2026-10-18): the API returns grouped-then-flat (10 stale, 10
  // silent). A founder should see HIGH first — sort by severity, keep order within.
  const SEV_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...nudges].sort((a, b) =>
    (SEV_RANK[a.severity ?? 'low'] ?? 2) - (SEV_RANK[b.severity ?? 'low'] ?? 2));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  if (shown.length === 0) {
    return <EmptyState title="Nothing stale." hint="No approvals aging, no silent leads, no stuck pipelines. The company runs." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shown.map((n, i) => {
        const style = KIND_STYLE[n.kind] || { bg: 'rgba(100,116,139,0.12)', color: '#475569', label: n.kind };
        const key = n.id || `${n.kind}-${i}`;
        return (
          <div
            key={key}
            style={{
              border: '1px solid var(--border-hairline, #eee)', borderRadius: 12, padding: '12px 14px',
              background: 'var(--card, #fff)', display: 'flex', gap: 12, alignItems: 'center',
            }}
          >
            <span className="t-mono" style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
              background: style.bg, color: style.color,
            }}>
              {style.label}
            </span>
            {n.severity === 'high' && (
              <span title="High severity" style={{ width: 7, height: 7, borderRadius: 99, background: '#ef4444', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-meta" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word' }}>
                {n.title}
              </div>
              {n.why && (
                <div className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                  {n.why}
                </div>
              )}
            </div>
            {(() => {
              const href = n.action?.href || n.action?.target;
              return href ? (
                <Link
                  href={href}
                  style={{
                    flexShrink: 0, minHeight: 36, padding: '0 12px', borderRadius: 8,
                    background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', textDecoration: 'none',
                  }}
                >
                  {n.action!.label || 'Open'}
                </Link>
              ) : null;
            })()}
          </div>
        );
      })}
    </div>
  );
}
