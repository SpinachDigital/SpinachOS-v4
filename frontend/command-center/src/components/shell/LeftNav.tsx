'use client';

// LeftNav — sidebar navigation with REAL routing (useRouter).
// BUG FIX: previously onClick only setActive(item.id) — local highlight, never navigated.
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home, FileText, FolderKanban, Bot, Users, UserCircle, Megaphone,
  BarChart3, Box, DollarSign, BookOpen, Settings, Activity, Calendar as CalendarIcon,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// id → actual Next.js route (nav ids match routes 1:1)
const NAV_ITEMS = [
  { id: 'office', route: '/', label: 'Office', sub: '3D Command Center', icon: Home },
  { id: 'approvals', route: '/approvals', label: 'Approvals', sub: 'Review & decide', icon: FileText },
  { id: 'projects', route: '/projects', label: 'Projects', sub: 'Plan. Track. Deliver.', icon: FolderKanban },
  { id: 'clients', route: '/clients', label: 'Clients', sub: 'Relationships & 360', icon: Users },
  { id: 'agents', route: '/agents', label: 'Agents', sub: 'Your digital team', icon: Bot },
  { id: 'chat', route: '/comms', label: 'Chat', sub: 'Channels & threads', icon: MessageSquare },
  { id: 'calendar', route: '/calendar', label: 'Calendar', sub: 'Brain & scheduling', icon: CalendarIcon },
  { id: 'marketing', route: '/marketing', label: 'Marketing', sub: 'Content & campaigns', icon: Megaphone },
  { id: 'insights', route: '/analytics', label: 'Insights', sub: 'Growth & insights', icon: BarChart3 },
  { id: 'settings', route: '/settings', label: 'Settings', sub: 'Workspace', icon: Settings },
];

export default function LeftNav({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState('office');

  // Derive active item from the URL so browser back/forward + ⌘K routes stay in sync
  useEffect(() => {
    const match = [...NAV_ITEMS].sort((a, b) => b.route.length - a.route.length)
      .find((item) => pathname === item.route || pathname.startsWith(item.route + '/'));
    if (match) setActive(match.id);
  }, [pathname]);

  const navigate = (item: (typeof NAV_ITEMS)[number]) => {
    setActive(item.id);
    router.push(item.route);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches && !open) {
      onToggle();
    }
  };

  return (
    <aside
      className="flex flex-col shrink-0 transition-all duration-200"
      style={{
        width: open ? 232 : 60,
        background: '#0E0E0E',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
            <span className="font-bold text-white text-sm">S</span>
          </div>
          {open && (
            <span className="font-bold text-white text-lg tracking-tight">Spinach OS</span>
          )}
        </div>
        {!open && (
          <button 
            onClick={onToggle}
            className="ml-auto text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl py-2.5 px-3 transition-all duration-200",
                isActive
                  ? "bg-teal-500/10 text-white border-l-2 border-teal-500"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
              )}
              style={{ width: open ? '100%' : 'auto' }}
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{
                background: isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)'
              }}>
                <item.icon className="w-5 h-5" style={{ color: isActive ? '#22c55e' : '#9ca3af' }} />
              </span>
              {open && (
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-medium text-sm truncate">{item.label}</span>
                  <span className="text-[11px] text-gray-500 truncate">{item.sub}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle at bottom */}
      <div className="px-4 py-3 border-t border-gray-800 shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {open && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}