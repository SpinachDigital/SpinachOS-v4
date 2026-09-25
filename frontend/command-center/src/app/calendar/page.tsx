'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';

export default function CalendarPage() {
  const { connected, feed } = useWebSocket();
  const [events, setEvents] = useState<any[]>([]);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month' | 'agent'>('week');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const [calsRes, eventsRes] = await Promise.all([
        apiFetch('http://localhost:4000/api/v1/calendar/calendars'),
        apiFetch('http://localhost:4000/api/v1/calendar/events'),
      ]);
      if (calsRes.ok) {
        const data = await calsRes.json();
        setCalendars(data);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data);
      }
    } catch (e) {
      console.error('Failed to fetch calendar:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // React to feed events
  useEffect(() => {
    const calEvent = feed.find(f => f.action?.includes('Calendar') || f.action?.includes('standup'));
    if (calEvent) fetchData();
  }, [feed, fetchData]);

  const handleScheduleStandup = async () => {
    try {
      const res = await apiFetch('http://localhost:4000/api/v1/calendar/standup', { method: 'POST' });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error('Standup scheduling failed:', e);
    }
  };

  // Design-system tokens (dark-first): all glass.* usages now resolve to the shared theme.
  const glass = {
    bg: 'var(--bg)',
    border: 'var(--border-soft)',
    text: 'var(--text)',
    text2: 'var(--text-faint)',
  };

  // Filter events by agent
  const filteredEvents = selectedAgent === 'all' 
    ? events 
    : events.filter(e => e.attendees?.some((a: any) => a.id === selectedAgent));

  const agentList = [...new Set(events.flatMap(e => e.attendees?.map((a: any) => a.id) || []))];

  return (
    <div className="flex flex-col h-full" style={{ background: glass.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: glass.border }}>
        <div>
          <h1 className="t-title" style={{ color: glass.text }}>Brain / Calendar</h1>
          <p className="t-meta mt-0.5" style={{ color: glass.text2 }}>
            {calendars.length} calendars · {events.length} events · {agentList.length} agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
          <span className="t-mono" style={{ color: glass.text2, fontSize: 12 }}>
            {connected ? 'Live' : 'Offline'}
          </span>
          <button
            onClick={handleScheduleStandup}
            className="px-3 py-1.5 text-sm rounded-lg bg-spinach-500/20 text-spinach-400 border border-spinach-500/30 hover:bg-spinach-500/30 transition-colors"
            style={{ cursor: 'pointer' }}
          >
            Schedule Standup
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            style={{
              background: glass.bg,
              borderColor: glass.border,
              color: glass.text,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* View + Agent filter */}
      <div className="flex flex-wrap gap-3 px-5 py-3 border-b" style={{ borderColor: glass.border }}>
        <div className="flex gap-2">
          {(['week', 'month', 'agent'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === v ? 'font-medium' : ''}`}
              style={{
                background: view === v ? 'rgba(22, 163, 74, 0.2)' : glass.bg,
                borderColor: view === v ? 'var(--green)' : glass.border,
                color: glass.text,
                border: '1px solid',
              }}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="t-meta" style={{ color: glass.text2, fontSize: 12 }}>Agent:</span>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}
          >
            <option value="all">All Agents</option>
            {agentList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: glass.text2 }}>
            <div className="t-mono">Loading calendar…</div>
          </div>
        ) : view === 'agent' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agentList.map(agent => (
              <div key={agent} className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="t-label" style={{ color: glass.text }}>{agent.toUpperCase()}</h3>
                  <span className="t-mono" style={{ color: glass.text2 }}>
                    {events.filter(e => e.attendees?.some((a: any) => a.id === agent)).length} events
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {events
                    .filter(e => e.attendees?.some((a: any) => a.id === agent))
                    .slice(0, 10)
                    .map(event => (
                      <div key={event.id} className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${glass.border}` }}>
                        <div className="font-medium" style={{ color: glass.text }}>{event.title}</div>
                        <div className="t-meta" style={{ color: glass.text2, fontSize: 11 }}>
                          {new Date(event.start_time).toLocaleString()}
                        </div>
                        {event.description && <div className="t-meta mt-1" style={{ color: glass.text2, fontSize: 11 }}>{event.description}</div>}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64" style={{ color: glass.text2 }}>
                <div className="t-meta mb-2">No events found</div>
                <div className="t-meta" style={{ fontSize: 12 }}>Create calendars and events to get started (run migrations in Supabase)</div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.slice(0, 20).map(event => (
                  <div key={event.id} className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium" style={{ color: glass.text }}>{event.title}</h4>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(22, 163, 74, 0.2)', color: 'var(--green)' }}>
                        {event.event_type || 'event'}
                      </span>
                    </div>
                    {event.description && <p className="t-meta mb-2" style={{ color: glass.text2, fontSize: 12 }}>{event.description}</p>}
                    <div className="flex items-center gap-2 text-xs" style={{ color: glass.text2 }}>
                      <span>{new Date(event.start_time).toLocaleDateString()}</span>
                      <span>{new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>→</span>
                      <span>{new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {event.attendees.map((a: any) => (
                          <span key={a.id} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent-indigo)' }}>
                            {a.id}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3 pt-2 border-t" style={{ borderColor: glass.border }}>
                      <button className="flex-1 px-2 py-1 text-xs rounded border transition-colors" style={{ borderColor: glass.border, color: glass.text, background: glass.bg }}>Edit</button>
                      <button className="flex-1 px-2 py-1 text-xs rounded border transition-colors" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}