'use client';

// CommandPalette — N3.17 true ⌘K palette.
// Fuzzy action list: context actions (page-registered) + go-to pages +
// frecency-ranked recents. This is the ACTION palette; the Jarvis chat
// input keeps `/` as its focus key and the TopBar pill stays clickable.
//
// Pages register context actions via registerPaletteActions() on mount.
// Recents are tracked via trackPaletteRecent() (localStorage, frecency).

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

// Module-level registry — pages register on mount, unregister on unmount.
let contextActions: PaletteAction[] = [];
export function registerPaletteActions(actions: PaletteAction[]) {
  contextActions = actions;
  return () => { contextActions = []; };
}

const PAGES: { label: string; href: string; hint: string }[] = [
  { label: 'Go to Approvals — the inbox', href: '/approvals', hint: 'THE INBOX' },
  { label: 'Go to Today', href: '/today', hint: 'overview' },
  { label: 'Go to Next up (nudges)', href: '/nudges', hint: 'nudges' },
  { label: 'Go to Leads', href: '/leads', hint: 'WIN' },
  { label: 'Go to Pipelines', href: '/pipeline', hint: 'DELIVER' },
  { label: 'Go to Grow', href: '/grow', hint: 'GROW' },
  { label: 'Go to Marketing calendar', href: '/marketing/calendar', hint: 'GROW' },
  { label: 'Go to Team', href: '/team', hint: 'agents' },
  { label: 'Go to Tasks', href: '/tasks', hint: 'runs' },
  { label: 'Go to Analytics', href: '/analytics', hint: 'P&L' },
  { label: 'Go to Office chat', href: '/chat', hint: 'Jarvis' },
];

const RECENT_KEY = 'spinach_palette_recents';
interface Recent { href: string; label: string; count: number; at: number }
function readRecents(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export function trackPaletteRecent(href: string, label: string) {
  try {
    const recents = readRecents();
    const i = recents.findIndex(r => r.href === href);
    if (i >= 0) {
      recents[i] = { ...recents[i], count: recents[i].count + 1, at: Date.now() };
    } else {
      recents.push({ href, label, count: 1, at: Date.now() });
    }
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(-20)));
  } catch { /* noop */ }
}

// Simple fuzzy score: matches in order win; earlier + consecutive win more.
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  let qi = 0, score = 0, last = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === last + 1 ? 3 : 1) + (ti < 8 ? 1 : 0);
      last = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

interface Entry { key: string; label: string; hint?: string; section: string; run: () => void; }

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => { setOpen(true); setQuery(''); setCursor(0); };
    window.addEventListener('spinach:open-palette', onOpen);
    return () => window.removeEventListener('spinach:open-palette', onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open ]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    // Context actions first (page-aware ranking).
    for (const a of contextActions) {
      list.push({ key: `act-${a.id}`, label: a.label, hint: a.hint || 'action', section: 'Actions', run: a.run });
    }
    for (const p of PAGES) {
      if (p.href === pathname) continue; // don't offer the page you're on
      list.push({
        key: `go-${p.href}`, label: p.label, hint: p.hint, section: 'Go to',
        run: () => { trackPaletteRecent(p.href, p.label); router.push(p.href); },
      });
    }
    // Recents ranked by frecency (count + recency), excluding current page.
    const recents = readRecents()
      .filter(r => r.href !== pathname)
      .sort((a, b) => (b.count * 2 + b.at / 86400000) - (a.count * 2 + a.at / 86400000))
      .slice(0, 5);
    for (const r of recents) {
      if (list.some(e => e.key === `go-${r.href}`)) continue;
      list.push({
        key: `recent-${r.href}`, label: r.label, hint: 'recent', section: 'Recent',
        run: () => { trackPaletteRecent(r.href, r.label); router.push(r.href); },
      });
    }
    if (!query.trim()) return list;
    return list
      .map(e => ({ e, s: fuzzyScore(query, `${e.label} ${e.hint || ''}`) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.e);
  }, [query, pathname, router, open]);

  const close = useCallback(() => setOpen(false), []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, entries.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = entries[cursor];
      if (entry) { close(); entry.run(); }
    }
  };

  useEffect(() => { setCursor(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastSection = '';
  return (
    <div
      data-palette-open="true"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)',
        display: 'flex', justifyContent: 'center', paddingTop: '12vh',
      }}
      role="dialog" aria-label="Command palette"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)', maxHeight: '60vh', overflow: 'hidden',
          background: 'var(--card, #fff)', borderRadius: 14,
          border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a command or search pages…"
          aria-label="Command palette input"
          style={{
            border: 'none', outline: 'none', padding: '14px 18px', fontSize: 15,
            background: 'transparent', color: 'var(--text)',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        />
        <div ref={listRef} style={{ overflowY: 'auto', padding: '8px' }}>
          {entries.length === 0 && (
            <div className="t-meta" style={{ padding: '16px', color: 'var(--text-faint)', textAlign: 'center' }}>
              No matches. Try another word.
            </div>
          )}
          {entries.map((e, i) => {
            const header = e.section !== lastSection ? e.section : null;
            lastSection = e.section;
            return (
              <div key={e.key}>
                {header && (
                  <div className="t-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', padding: '8px 12px 4px' }}>
                    {header}
                  </div>
                )}
                <button
                  data-idx={i}
                  onClick={() => { close(); e.run(); }}
                  onMouseEnter={() => setCursor(i)}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: i === cursor ? 'var(--bg-2, #f4f4f0)' : 'transparent',
                    color: 'var(--text)', fontSize: 14, textAlign: 'left',
                  }}
                >
                  <span>{e.label}</span>
                  {e.hint && <span className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{e.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="t-mono" style={{ padding: '8px 18px', borderTop: '1px solid var(--border-hairline)', fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 16 }}>
          <span><span className="kbd">↑↓</span> move</span>
          <span><span className="kbd">↵</span> run</span>
          <span><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
