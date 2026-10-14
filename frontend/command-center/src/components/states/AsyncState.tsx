'use client';

// N1.4 — Honest-state primitives.
// Every data region in the app must be in a NAMED state. The taxonomy:
//   loading | refetching | first-empty | filtered-empty |
//   error | offline | stale | ready
// A region in an unnamed state is a lie waiting to happen (wrong zeroes,
// stuck spinners, silent failures). Use these instead of ad-hoc <p> tags.

import React from 'react';

const box: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 32,
  textAlign: 'center',
};

const title: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: '0 0 6px' };
const hint: React.CSSProperties = { color: 'var(--muted-foreground)', fontSize: 14, margin: 0 };

const retryBtn: React.CSSProperties = {
  marginTop: 14,
  minHeight: 44,
  padding: '0 22px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

/** Loading — skeleton rows shaped like the result, never a bare spinner. */
export function LoadingState({ label = 'Loading…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} style={{ display: 'grid', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Error — human sentence + a retry that actually retries. Never a dead end. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" style={box}>
      <p style={title}>Something didn&rsquo;t load</p>
      <p style={hint}>{message}</p>
      <button type="button" style={retryBtn} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** Empty — first-use: what goes here + the one action that fills it. */
export function EmptyState({
  title: t,
  hint: h,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={box}>
      <p style={title}>{t}</p>
      <p style={hint}>{h}</p>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

/** Offline — distinct from server error. The app, not the data, is unreachable. */
export function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" style={box}>
      <p style={title}>You&rsquo;re offline</p>
      <p style={hint}>Check your connection — nothing was lost, this will retry.</p>
      <button type="button" style={retryBtn} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
