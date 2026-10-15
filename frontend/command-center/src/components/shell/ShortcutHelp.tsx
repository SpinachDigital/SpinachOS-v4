'use client';

// ShortcutHelp — N3.18 `?` cheat sheet overlay.
// Global: listens for `?` (Shift+/), ignores typing targets and the palette.
// One-time callout lives on the approvals page (it owns the context).

import { useState, useEffect } from 'react';

const GROUPS: { title: string; keys: { kbd: string; desc: string }[] }[] = [
  {
    title: 'Triage (approvals inbox)',
    keys: [
      { kbd: 'j / k', desc: 'Move between cards' },
      { kbd: 'a', desc: 'Approve focused card' },
      { kbd: 'r', desc: 'Reject (inline reason)' },
      { kbd: 's', desc: 'Snooze to tomorrow' },
      { kbd: 'o', desc: 'Open card detail' },
      { kbd: 'x', desc: 'Select for bulk' },
    ],
  },
  {
    title: 'Global',
    keys: [
      { kbd: '⌘K', desc: 'Command palette' },
      { kbd: '/', desc: 'Focus the Jarvis input' },
      { kbd: '?', desc: 'This cheat sheet' },
      { kbd: 'esc', desc: 'Close dialog' },
    ],
  },
];

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e)) return;
      if (document.querySelector('[data-palette-open="true"]')) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      data-shortcut-help-open="true"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      role="dialog" aria-label="Keyboard shortcuts"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 92vw)', maxHeight: '80vh', overflowY: 'auto',
          background: 'var(--card, #fff)', borderRadius: 14,
          border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="t-title" style={{ fontSize: 17, color: 'var(--text)' }}>Keyboard shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="kbd"
            style={{ cursor: 'pointer', background: 'var(--bg-2)' }}
            aria-label="Close"
          >
            esc
          </button>
        </div>
        {GROUPS.map(g => (
          <div key={g.title} style={{ marginBottom: 18 }}>
            <div className="t-mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: 8 }}>
              {g.title}
            </div>
            {g.keys.map(k => (
              <div key={k.kbd} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                <span className="kbd" style={{ minWidth: 56, textAlign: 'center' }}>{k.kbd}</span>
                <span className="t-meta" style={{ fontSize: 13.5, color: 'var(--text)' }}>{k.desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
