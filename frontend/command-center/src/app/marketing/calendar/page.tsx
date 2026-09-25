'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';

interface ContentCalendarItem {
  id: string;
  date: string;
  slot_index: number;
  theme: 'politics' | 'cricket' | 'ai' | 'github' | 'quote' | 'gita' | 'custom';
  platform: 'x' | 'linkedin' | 'instagram' | 'threads';
  status: 'planned' | 'drafting' | 'review' | 'approved' | 'scheduled' | 'published' | 'failed';
  content_text?: string;
  media_urls?: string[];
  scheduled_at?: string;
  published_at?: string;
  post_id?: string;
  engagement?: Record<string, number>;
}

const THEME_COLORS: Record<string, string> = {
  politics: 'var(--cat-politics)',
  cricket: 'var(--green)',
  ai: 'var(--cat-ai)',
  github: 'var(--cat-github)',
  quote: 'var(--accent-cyan)',
  gita: 'var(--cat-gita)',
  custom: 'var(--green)',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 9.24-3.308.68-9.24-8.72L.76 23.76l2.58-2.13 7.07 7.58L23.5 12.8l-5.256-5.56 6.88-7.43z"/></svg>,
  linkedin: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.141-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  instagram: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  threads: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z"/></svg>,
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'var(--planned)',
  drafting: 'var(--info)',
  review: 'var(--warn)',
  approved: 'var(--green-bright)',
  scheduled: 'var(--accent-violet)',
  published: 'var(--green-bright)',
  failed: 'var(--danger)',
};

export default function ContentCalendarPage() {
  const { connected } = useWebSocket();
  const [items, setItems] = useState<ContentCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterTheme, setFilterTheme] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:4000/api/v1/marketing/calendar');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error('Failed to fetch calendar:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Design-system tokens (dark-first): all glass.* usages now resolve to the shared theme.
  const glass = {
    bg: 'var(--bg)',
    border: 'var(--border-soft)',
    text: 'var(--text)',
    text2: 'var(--text-faint)',
    text3: 'var(--text-faint)',
  };

  const filteredItems = items.filter(item => {
    if (filterTheme !== 'all' && item.theme !== filterTheme) return false;
    if (filterPlatform !== 'all' && item.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  const getWeekDates = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() - day);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = view === 'week' ? getWeekDates(selectedDate) : [];

  const slotLabels = ['Morning Brief', 'Market Update', 'Deep Dive', 'Community', 'Case Study', 'Thought Leadership', 'Weekend Wrap', 'Personal', 'Team Highlight', 'Experiment'];

  return (
    <div className="flex flex-col h-full" style={{ background: glass.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: glass.border }}>
        <div>
          <h1 className="t-title" style={{ color: glass.text }}>Content Calendar</h1>
          <p className="t-meta mt-0.5" style={{ color: glass.text2 }}>
            {items.length} posts · {items.filter(i => i.status === 'published').length} published · {items.filter(i => i.status === 'scheduled').length} scheduled
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
          <span className="t-mono" style={{ color: glass.text2, fontSize: 12 }}>{connected ? 'Live' : 'Offline'}</span>
          <button onClick={fetchItems} disabled={loading} className="px-3 py-1.5 text-sm rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-5 py-3 border-b" style={{ borderColor: glass.border }}>
        <div className="flex gap-2">
          <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === 'week' ? 'font-medium' : ''}`} style={{ background: view === 'week' ? 'rgba(22, 163, 74, 0.2)' : glass.bg, borderColor: view === 'week' ? 'var(--green)' : glass.border, color: glass.text, border: '1px solid' }}>Week</button>
          <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === 'month' ? 'font-medium' : ''}`} style={{ background: view === 'month' ? 'rgba(22, 163, 74, 0.2)' : glass.bg, borderColor: view === 'month' ? 'var(--green)' : glass.border, color: glass.text, border: '1px solid' }}>Month</button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }} />
          <select value={filterTheme} onChange={e => setFilterTheme(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>
            <option value="all">All Themes</option>
            {['politics', 'cricket', 'ai', 'github', 'quote', 'gita', 'custom'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>
            <option value="all">All Platforms</option>
            {['x', 'linkedin', 'instagram', 'threads'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>
            <option value="all">All Status</option>
            {['planned', 'drafting', 'review', 'approved', 'scheduled', 'published', 'failed'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: glass.text2 }}><div className="t-mono">Loading calendar…</div></div>
        ) : view === 'week' ? (
          <div className="grid grid-cols-7 gap-1" style={{ overflowX: 'auto', minWidth: '980px' }}>
            {weekDates.map((date, dayIdx) => {
              const dayItems = filteredItems.filter(i => i.date === date);
              return (
                <div key={date} className="flex flex-col" style={{ background: glass.bg, border: `1px solid ${glass.border}`, borderRadius: 8, minHeight: 500 }}>
                  <div className="px-3 py-2 border-b" style={{ borderColor: glass.border }}>
                    <div className="t-label" style={{ color: glass.text }}>{new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="t-mono" style={{ color: glass.text2, fontSize: 11 }}>{dayItems.length} posts</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {dayItems.length === 0 ? (
                      <div className="text-center py-8" style={{ color: glass.text3 }}>
                        <div className="t-meta">No posts</div>
                      </div>
                    ) : (
                      dayItems.map(item => (
                        <div key={item.id} className="p-2 rounded-lg border transition-colors" style={{ background: 'rgba(255,255,255,0.02)', borderColor: THEME_COLORS[item.theme] + '40', cursor: 'pointer' }}>
                          <div className="flex items-center gap-2 mb-1">
                            {PLATFORM_ICONS[item.platform]}
                            <span className="t-mono text-xs" style={{ color: THEME_COLORS[item.theme] }}>{slotLabels[item.slot_index] || `Slot ${item.slot_index}`}</span>
                          </div>
                          <div className="text-sm line-clamp-2" style={{ color: glass.text }}>{item.content_text || 'No content'}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: STATUS_COLORS[item.status] + '20', color: STATUS_COLORS[item.status] }}>{item.status}</span>
                            {item.scheduled_at && <span className="t-mono ml-auto text-[10px]" style={{ color: glass.text3 }}>{new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const start = new Date(selectedDate);
              start.setDate(1);
              const end = new Date(start);
              end.setMonth(end.getMonth() + 1);
              end.setDate(0);
              const weeks: Date[][] = [];
              let week: Date[] = [];
              let d = new Date(start);
              // Pad start of month
              for (let i = 0; i < d.getDay(); i++) {
                const prev = new Date(d);
                prev.setDate(d.getDate() - d.getDay() + i);
                week.push(prev);
              }
              while (d <= end) {
                week.push(new Date(d));
                if (week.length === 7) { weeks.push(week); week = []; }
                d.setDate(d.getDate() + 1);
              }
              if (week.length > 0) { while (week.length < 7) { const next = new Date(week[week.length - 1]); next.setDate(next.getDate() + 1); week.push(next); } weeks.push(week); }
              return weeks.map((w, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {w.map((day, di) => {
                    const dateStr = day.toISOString().split('T')[0];
                    const isCurrentMonth = day.getMonth() === new Date(selectedDate).getMonth();
                    const dayItems = filteredItems.filter(i => i.date === dateStr);
                    return (
                      <div key={dateStr} className="flex flex-col" style={{ background: isCurrentMonth ? glass.bg : 'rgba(15,15,15,0.4)', border: `1px solid ${glass.border}`, borderRadius: 8, minHeight: 180 }}>
                        <div className={`px-2 py-1 text-right ${!isCurrentMonth ? 'opacity-30' : ''}`} style={{ color: glass.text2 }}>
                          <span className="t-mono">{day.getDate()}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-1 space-y-1">
                          {dayItems.slice(0, 3).map(item => (
                            <div key={item.id} className="p-1.5 rounded border" style={{ background: THEME_COLORS[item.theme] + '15', borderColor: THEME_COLORS[item.theme] + '40', fontSize: 11 }}>
                              <div className="flex items-center gap-1 mb-0.5">{PLATFORM_ICONS[item.platform]}<span style={{ color: THEME_COLORS[item.theme] }}>{slotLabels[item.slot_index]?.slice(0, 8)}</span></div>
                              <div className="truncate" style={{ color: glass.text }}>{item.content_text?.slice(0, 40)}</div>
                              <span className="px-1 py-0 rounded text-[8px]" style={{ background: STATUS_COLORS[item.status] + '30', color: STATUS_COLORS[item.status] }}>{item.status.slice(0, 3)}</span>
                            </div>
                          ))}
                          {dayItems.length > 3 && <div className="text-center text-[10px]" style={{ color: glass.text3, marginTop: 4 }}>+{dayItems.length - 3} more</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}