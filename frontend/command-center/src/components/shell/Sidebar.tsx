'use client';

// Sidebar — reference .sidebar: brand + nav (label+sub each) + brand-card footer.
// Port of spinach-os.html <aside class="sidebar">.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/auth';

// Inline SVG icons (stroke style, 1.8 width — same paths as the reference)
const I = {
  command: <path d="M3 10.5 12 3l9 7.5" />,
  projects: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  agents: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M8 4h8" /><circle cx="9" cy="13" r="1" fill="currentColor" /><circle cx="15" cy="13" r="1" fill="currentColor" /><path d="M9 16.5h6" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><circle cx="17" cy="9" r="2.6" /><path d="M16 15.2c2.6.3 4.6 1.9 5.3 4.3" /></>,
  clients: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  marketing: <><path d="M3 11v3l4 1 2 5h2l-1.5-5.5L21 18V7L9 10.5 3 11z" /><path d="M9 10.5V4" /></>,
  analytics: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  assets: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 3-3 3 3" /></>,
  finance: <><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M16 13h4v3h-4a1.5 1.5 0 0 1 0-3z" /></>,
  knowledge: <path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13" />,
  approvals: <><path d="M9 12l2 2 4-4" /><rect x="3" y="5" width="18" height="14" rx="3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
};

type NavEntry = { href: string; label: string; sub: string; icon: React.ReactNode };

const NAV: NavEntry[] = [
  { href: '/', label: 'Command Center', sub: 'Overview', icon: I.command },
  { href: '/projects', label: 'Projects', sub: 'Plan. Track. Deliver.', icon: I.projects },
  { href: '/agents', label: 'AI Agents', sub: 'Your Digital Team', icon: I.agents },
  { href: '/team', label: 'Team', sub: 'People & Roles', icon: I.team },
  { href: '/clients', label: 'Clients', sub: 'Relationships', icon: I.clients },
  { href: '/marketing', label: 'Marketing', sub: 'Content & Campaigns', icon: I.marketing },
  { href: '/analytics', label: 'Analytics', sub: 'Growth & Insights', icon: I.analytics },
  { href: '/approvals', label: 'Approvals', sub: 'Director Gate', icon: I.approvals },
  { href: '/assets', label: 'Assets', sub: 'Brand & Library', icon: I.assets },
  { href: '/finance', label: 'Finance', sub: 'Revenue & Costs', icon: I.finance },
  { href: '/knowledge', label: 'Knowledge', sub: 'Docs & SOPs', icon: I.knowledge },
  { href: '/settings', label: 'Settings', sub: 'Workspace', icon: I.settings },
];

export default function Sidebar({ drawerOpen, onNavigate }: { drawerOpen?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    (async () => {
      try {
        const token = await getAuthToken();
        const r = await fetch('/api/v1/approvals/pending', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const j = await r.json();
          if (alive) setPending(Array.isArray(j) ? j.length : (j.count ?? 0));
        }
      } catch { /* offline */ }
    })();
    return () => { alive = false; };
  }, [mounted]);

  return (
    <aside className={`sidebar${drawerOpen ? ' drawer-open' : ''}`}>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo/spinach-labs-logo-primary-reverse.svg" alt="Spinach Labs" />
      </div>
      <nav className="nav">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== '/' && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} className={`nav-item${active ? ' active' : ''}`} onClick={onNavigate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {n.icon}
              </svg>
              <div className="nav-text">
                <b>{n.label}</b>
                <span>{n.sub}</span>
              </div>
              {n.href === '/approvals' && pending > 0 && (
                <span className="pill completed" style={{ marginLeft: 'auto' }}>{pending}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="brand-card">
        <h4>Ideas<br />Systems<br />Impact <span className="dot">●</span></h4>
        <p>A QUIETER, BRIGHTER TOMORROW.</p>
        <div className="ver">v6.0.0 — Company Build</div>
      </div>
    </aside>
  );
}