'use client';

// AppShell — the reference .app grid: sidebar + topbar + tabs + main + right rail.
// Responsive: owns the mobile-drawer state. <=1100px the sidebar becomes an
// overlay drawer (hamburger in TopBar, scrim tap or nav click closes it).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import RightRail from './RightRail';

export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Close the drawer on route change (nav click) and on Escape.
  const close = useCallback(() => setDrawerOpen(false), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className={`app${drawerOpen ? ' drawer-open' : ''}`}>
      <Sidebar drawerOpen={drawerOpen} onNavigate={close} />
      {drawerOpen && <div className="drawer-scrim" onClick={close} aria-hidden />}
      <TopBar onHamburger={() => setDrawerOpen((v) => !v)} />
      {/* Sprint 10 P2: the dead "Overview" tab removed — one tab with no
          handler is dead UI (audit 2026-10-02). The sidebar already labels
          the current route; the tabs row added nothing. */}
      <main className="main">{children}</main>
      <aside className="right">
        <RightRail />
      </aside>
      {/* Phase 0: the canonical command bar lives in the TopBar slot
          (TopBar renders CommandGateway inline) — exactly ONE bar, no
          floating duplicate. */}
    </div>
  );
}
