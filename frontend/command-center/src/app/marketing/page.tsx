'use client';

// Marketing — parent page with tabs: Content Calendar | Engagement.
// Lifts the existing full implementations via dynamic import (redirects on their old
// routes point here; module imports are unaffected by redirects).
import { useState } from 'react';
import dynamic from 'next/dynamic';

const CalendarBoard = dynamic(() => import('@/app/marketing/calendar/page').then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => <PanelLoading />,
});
const EngagementBoard = dynamic(() => import('@/app/marketing/engagement/page').then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => <PanelLoading />,
});

function PanelLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="t-mono" style={{ color: 'var(--text-faint)' }}>Loading…</div>
    </div>
  );
}

type Tab = 'calendar' | 'engagement';

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('calendar');

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header — left-aligned + tab row */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="t-title" style={{ color: 'var(--text)' }}>Marketing</h1>
            <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>Content calendar & engagement analytics</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {([
            { id: 'calendar', label: 'Content Calendar' },
            { id: 'engagement', label: 'Engagement' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="btn btn-sm"
              style={{
                background: tab === t.id ? 'var(--text)' : 'var(--panel-2)',
                color: tab === t.id ? 'var(--bg)' : 'var(--text-dim)',
                boxShadow: tab === t.id ? 'none' : 'var(--shadow-card)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — full width */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'calendar' ? <CalendarBoard /> : <EngagementBoard />}
      </div>
    </div>
  );
}
