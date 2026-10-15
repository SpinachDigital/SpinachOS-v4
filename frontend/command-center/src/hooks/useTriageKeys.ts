'use client';

// useTriageKeys — N3.14 single-key triage for the approvals inbox.
// The page owns: items (visible Decide list), focusedId, and the action
// callbacks. This hook owns: j/k navigation, key dispatch, and the
// "don't fire while typing" guard. `?` is reserved for the cheat sheet
// (handled globally in AppShell) and never reaches here.

import { useEffect, useCallback } from 'react';

export interface TriageActions {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;   // opens inline reason, not instant
  onSnooze: (id: string) => void;
  onOpen: (id: string) => void;      // toggles card detail
  onToggleSelect: (id: string) => void;
  // NOTE: no onUndo — the API has no reopen/undo endpoint, and N1 law
  // forbids a key that promises what it cannot do.
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName?.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    t.isContentEditable
  );
}

// True while the command palette or cheat sheet is open — triage keys
// must not fire underneath them.
function overlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('[data-palette-open="true"], [data-shortcut-help-open="true"]');
}

export function useTriageKeys(
  itemIds: string[],
  focusedId: string | null,
  setFocusedId: (id: string | null) => void,
  actions: TriageActions,
  enabled: boolean,
) {
  const focusIndex = useCallback(
    (dir: 1 | -1) => {
      if (itemIds.length === 0) return;
      const cur = focusedId ? itemIds.indexOf(focusedId) : -1;
      const next = cur === -1 ? (dir === 1 ? 0 : itemIds.length - 1) : (cur + dir + itemIds.length) % itemIds.length;
      const id = itemIds[next];
      setFocusedId(id);
      // Scroll the card into view (centered, no page jump).
      requestAnimationFrame(() => {
        document.querySelector(`[data-approval-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
    [itemIds, focusedId, setFocusedId],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e)) return;
      if (overlayOpen()) return;
      const id = focusedId;
      switch (e.key) {
        case 'j':
          e.preventDefault();
          focusIndex(1);
          break;
        case 'k':
          e.preventDefault();
          focusIndex(-1);
          break;
        case 'a':
          if (id) { e.preventDefault(); actions.onApprove(id); }
          break;
        case 'r':
          if (id) { e.preventDefault(); actions.onReject(id); }
          break;
        case 's':
          if (id) { e.preventDefault(); actions.onSnooze(id); }
          break;
        case 'o':
        case 'Enter':
          if (id) { e.preventDefault(); actions.onOpen(id); }
          break;
        case 'x':
          if (id) { e.preventDefault(); actions.onToggleSelect(id); }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, focusedId, focusIndex, actions]);
}
