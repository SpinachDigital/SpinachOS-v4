'use client';

// N2.9 — Workflow narrative header (Client-360 pattern).
// Every workflow page answers four questions in one strip:
//   happening (now) / happened (recent) / next (action needed) / who acts.
// Props are plain strings computed from the page's own data — no new endpoints.

import React from 'react';

export interface WorkflowHeaderProps {
  happening: string;
  happened: string;
  next: string;
  actor: string;
}

const row: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0' };
const label: React.CSSProperties = {
  flexShrink: 0,
  width: 92,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
};
const value: React.CSSProperties = { fontSize: 14, color: 'var(--text)' };

export default function WorkflowHeader({ happening, happened, next, actor }: WorkflowHeaderProps) {
  return (
    <section
      aria-label="Workflow status"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 16,
        background: 'var(--panel)',
      }}
    >
      <div style={row}>
        <span style={label}>Happening</span>
        <span style={value}>{happening}</span>
      </div>
      <div style={row}>
        <span style={label}>Happened</span>
        <span style={value}>{happened}</span>
      </div>
      <div style={row}>
        <span style={label}>Next</span>
        <span style={value}>{next}</span>
      </div>
      <div style={row}>
        <span style={label}>Who acts</span>
        <span style={value}>{actor}</span>
      </div>
    </section>
  );
}
