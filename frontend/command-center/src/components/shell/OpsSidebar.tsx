'use client';

// OpsSidebar — Today / AI Agents / Live Activity. Reads the SHARED spinach-store
// (single WebSocket for the whole app — was a second socket via legacy useWebSocket hook).
import { useState } from 'react';
import { useSpinachStore } from '@/store/spinach-store';
import { Calendar, CheckCircle2, Circle } from 'lucide-react';

const SCHEDULE = [
  { time: '10:00', title: 'Review campaign creatives' },
  { time: '11:30', title: 'Client call' },
  { time: '14:00', title: 'Team standup' },
  { time: '16:00', title: 'Check ad performance' },
];

const AGENTS = [
  { id: 'content', label: 'Content' },
  { id: 'research', label: 'Research' },
  { id: 'ad', label: 'Ad' },
  { id: 'design', label: 'Design' },
  { id: 'seo', label: 'SEO' },
  { id: 'outreach', label: 'Outreach' },
];

export default function OpsSidebar() {
  const agentStates = useSpinachStore((s) => s.agentStates);
  const feed = useSpinachStore((s) => s.feed);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const lastFeed = feed.slice(-5).reverse();

  return (
    <aside
      className="shrink-0 flex flex-col overflow-y-auto"
      style={{
        width: 264,
        background: '#0E0E0E',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Today */}
      <section className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="t-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Today</span>
          <Calendar style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="space-y-2">
          {SCHEDULE.map((item, i) => (
            <button
              key={i}
              onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
              className="w-full flex items-center gap-2.5 text-left rounded-md px-2 py-1.5 transition-colors"
              style={{ background: 'transparent', cursor: 'pointer', border: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {done[i] ? (
                <CheckCircle2 style={{ width: 13, height: 13, color: '#56883E', flexShrink: 0 }} />
              ) : (
                <Circle style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              )}
              <span className="flex-1 min-w-0">
                <span
                  className="block truncate"
                  style={{
                    fontSize: 11.5,
                    color: done[i] ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                    textDecoration: done[i] ? 'line-through' : 'none',
                  }}
                >
                  {item.title}
                </span>
                <span className="t-mono" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)' }}>{item.time}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* AI Agents */}
      <section className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="t-label" style={{ color: 'rgba(255,255,255,0.45)' }}>AI Agents</span>
          <span className="badge badge-green" style={{ fontSize: 9.5, padding: '1px 7px' }}>
            {Object.keys(agentStates).length || '—'} online
          </span>
        </div>
        <div className="space-y-1">
          {AGENTS.map((a) => {
            const s = agentStates[a.id];
            const state = s?.state || 'idle';
            const dotClass =
              state === 'working' ? 'dot-teal' :
              state === 'thinking' ? 'dot-amber' :
              state === 'speaking' ? 'dot-purple' :
              state === 'blocked' ? 'dot-red' : 'dot-green';
            return (
              <div key={a.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
                <span className={`dot ${dotClass}`} style={{ width: 6, height: 6 }} />
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{a.label}</span>
                <span className="ml-auto t-mono" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>
                  {s?.activity || 'ready'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Activity */}
      <section className="px-4 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="t-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Activity</span>
          <span className="dot dot-green dot-pulse" style={{ width: 5, height: 5 }} />
        </div>
        <div className="space-y-2.5">
          {lastFeed.length === 0 ? (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
              Waiting for agent events…
            </p>
          ) : (
            lastFeed.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="dot dot-green" style={{ width: 5, height: 5, marginTop: 5 }} />
                <div className="min-w-0">
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{(item as any).message || (item as any).action}</p>
                  <p className="t-mono" style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}