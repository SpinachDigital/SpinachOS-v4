'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';

interface EngagementMetric {
  platform: string;
  platform_post_id: string;
  metric_type: 'like' | 'retweet' | 'reply' | 'quote' | 'impression' | 'profile_click';
  count: number;
  recorded_at: string;
}

interface PostEngagement {
  platform: string;
  platform_post_id: string;
  content_text?: string;
  media_urls?: string[];
  posted_at: string;
  metrics: Record<string, number>;
  total_engagement: number;
  engagement_rate: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  x: 'var(--brand-x)',
  linkedin: 'var(--brand-linkedin)',
  instagram: 'var(--brand-instagram)',
  threads: 'var(--brand-x)',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 9.24-3.308.68-9.24-8.72L.76 23.76l2.58-2.13 7.07 7.58L23.5 12.8l-5.256-5.56 6.88-7.43z"/></svg>,
  linkedin: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.141-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  instagram: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  threads: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z"/></svg>,
};

const METRIC_COLORS: Record<string, string> = {
  like: 'var(--danger)',
  retweet: 'var(--green-bright)',
  reply: 'var(--info)',
  quote: 'var(--accent-violet)',
  impression: 'var(--accent-cyan)',
  profile_click: 'var(--warn)',
};

const METRIC_LABELS: Record<string, string> = {
  like: 'Likes',
  retweet: 'Retweets',
  reply: 'Replies',
  quote: 'Quotes',
  impression: 'Impressions',
  profile_click: 'Profile Clicks',
};

interface TimeRange {
  label: string;
  days: number;
}

const TIME_RANGES: TimeRange[] = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export default function EngagementAnalyticsPage() {
  const { connected } = useWebSocket();
  const [metrics, setMetrics] = useState<EngagementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>(TIME_RANGES[1]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [view, setView] = useState<'overview' | 'posts' | 'trends'>('overview');

  const fetchMetrics = useCallback(async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - timeRange.days);
      const params = new URLSearchParams({ recorded_at: `gte.${cutoff.toISOString()}` });
      if (selectedPlatform !== 'all') params.set('platform', selectedPlatform);
      const res = await apiFetch(`/api/v1/marketing/engagement?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.error('Failed to fetch engagement:', e);
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedPlatform]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  // Design-system tokens (dark-first): all glass.* usages now resolve to the shared theme.
  const glass = {
    bg: 'var(--bg)',
    border: 'var(--border-soft)',
    text: 'var(--text)',
    text2: 'var(--text-faint)',
    text3: 'var(--text-faint)',
  };

  // Aggregate metrics
  const totalMetrics = metrics.reduce((acc, m) => {
    acc[m.metric_type] = (acc[m.metric_type] || 0) + m.count;
    return acc;
  }, {} as Record<string, number>);

  const totalEngagement = Object.values(totalMetrics).reduce((a, b) => a + b, 0);

  // Platform breakdown
  const platformBreakdown = metrics.reduce((acc, m) => {
    if (!acc[m.platform]) acc[m.platform] = {};
    acc[m.platform][m.metric_type] = (acc[m.platform][m.metric_type] || 0) + m.count;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  // Daily trend
  const dailyTrend = metrics.reduce((acc, m) => {
    const day = m.recorded_at.split('T')[0];
    if (!acc[day]) acc[day] = {};
    acc[day][m.metric_type] = (acc[day][m.metric_type] || 0) + m.count;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const trendDays = Object.keys(dailyTrend).sort().slice(-timeRange.days);

  return (
    <div className="flex flex-col h-full" style={{ background: glass.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: glass.border }}>
        <div>
          <h1 className="t-title" style={{ color: glass.text }}>Engagement Analytics</h1>
          <p className="t-meta mt-0.5" style={{ color: glass.text2 }}>
            {metrics.length} data points · {totalEngagement} total engagement · {timeRange.label}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
          <span className="t-mono" style={{ color: glass.text2, fontSize: 12 }}>{connected ? 'Live' : 'Offline'}</span>
          <button onClick={fetchMetrics} disabled={loading} className="px-3 py-1.5 text-sm rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 px-5 py-3 border-b" style={{ borderColor: glass.border }}>
        <div className="flex gap-2">
          {TIME_RANGES.map(r => (
            <button key={r.label} onClick={() => setTimeRange(r)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${timeRange === r ? 'font-medium' : ''}`} style={{ background: timeRange === r ? 'rgba(22, 163, 74, 0.2)' : glass.bg, borderColor: timeRange === r ? 'var(--green)' : glass.border, color: glass.text, border: '1px solid' }}>{r.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} className="px-3 py-1.5 text-sm rounded-lg border" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>
            <option value="all">All Platforms</option>
            {['x', 'linkedin', 'instagram', 'threads'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <div className="flex gap-2">
            {(['overview', 'posts', 'trends'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === v ? 'font-medium' : ''}`} style={{ background: view === v ? 'rgba(22, 163, 74, 0.2)' : glass.bg, borderColor: view === v ? 'var(--green)' : glass.border, color: glass.text, border: '1px solid' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: glass.text2 }}><div className="t-mono">Loading analytics…</div></div>
        ) : metrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: glass.text2 }}>
            <div className="t-meta mb-2">No engagement data yet</div>
            <div className="t-meta" style={{ fontSize: 12 }}>Post content and check back — metrics populate via webhook/polling</div>
          </div>
        ) : view === 'overview' ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              {[
                { key: 'impression', label: 'Impressions' },
                { key: 'like', label: 'Likes' },
                { key: 'retweet', label: 'Retweets' },
                { key: 'reply', label: 'Replies' },
                { key: 'quote', label: 'Quotes' },
                { key: 'profile_click', label: 'Profile Clicks' },
              ].map(m => (
                <div key={m.key} className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${METRIC_COLORS[m.key]}40` }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: METRIC_COLORS[m.key] + '20' }}>
                      <span style={{ color: METRIC_COLORS[m.key], fontSize: 18 }}>●</span>
                    </div>
                    <div>
                      <div className="t-label" style={{ color: glass.text }}>{m.label}</div>
                      <div className="t-mono text-2xl font-bold" style={{ color: METRIC_COLORS[m.key] }}>{(totalMetrics[m.key] || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Engagement */}
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="t-label" style={{ color: glass.text }}>Total Engagement</div>
                <div className="t-mono text-2xl font-bold" style={{ color: 'var(--green)' }}>{totalEngagement.toLocaleString()}</div>
              </div>
              <div className="flex gap-4">
                {Object.entries(platformBreakdown).map(([platform, data]) => {
                  const pTotal = Object.values(data).reduce((a, b) => a + b, 0);
                  return (
                    <div key={platform} className="flex-1 p-3 rounded-lg" style={{ background: PLATFORM_COLORS[platform] + '15', border: `1px solid ${PLATFORM_COLORS[platform]}40` }}>
                      <div className="flex items-center gap-2 mb-2">
                        {PLATFORM_ICONS[platform]}
                        <span className="t-label" style={{ color: PLATFORM_COLORS[platform] }}>{platform}</span>
                      </div>
                      <div className="t-mono text-xl font-bold" style={{ color: glass.text }}>{pTotal.toLocaleString()}</div>
                      <div className="t-meta" style={{ color: glass.text2 }}>total engagement</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metric Breakdown */}
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(METRIC_COLORS).map(([metric, color]) => (
                <div key={metric} className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${color}40` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color, fontSize: 18 }}>●</span>
                    <span className="t-label" style={{ color: glass.text }}>{METRIC_LABELS[metric]}</span>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
                    {Object.entries(platformBreakdown).map(([platform, data]) => (
                      <div key={platform} className="p-2 rounded" style={{ background: PLATFORM_COLORS[platform] + '15', border: `1px solid ${PLATFORM_COLORS[platform]}30` }}>
                        <div className="flex items-center gap-1 mb-1">
                          {PLATFORM_ICONS[platform]}
                          <span className="t-mono text-xs" style={{ color: PLATFORM_COLORS[platform] }}>{platform}</span>
                        </div>
                        <div className="t-mono text-lg font-bold" style={{ color: color }}>{(data[metric] || 0).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : view === 'posts' ? (
          <div className="space-y-4">
            {/* Top Posts Table */}
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <div className="t-label mb-4" style={{ color: glass.text }}>Top Posts by Engagement</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${glass.border}` }}>
                      <th className="text-left p-3 t-mono text-xs" style={{ color: glass.text2 }}>Post</th>
                      <th className="text-left p-3 t-mono text-xs" style={{ color: glass.text2 }}>Platform</th>
                      <th className="text-right p-3 t-mono text-xs" style={{ color: glass.text2 }}>Impressions</th>
                      <th className="text-right p-3 t-mono text-xs" style={{ color: glass.text2 }}>Likes</th>
                      <th className="text-right p-3 t-mono text-xs" style={{ color: glass.text2 }}>Retweets</th>
                      <th className="text-right p-3 t-mono text-xs" style={{ color: glass.text2 }}>Replies</th>
                      <th className="text-right p-3 t-mono text-xs" style={{ color: glass.text2 }}>Eng. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const postMetrics = metrics.reduce((acc, m) => {
                        const key = `${m.platform}-${m.platform_post_id}`;
                        if (!acc[key]) acc[key] = { platform: m.platform, platform_post_id: m.platform_post_id, metrics: {} };
                        acc[key].metrics[m.metric_type] = (acc[key].metrics[m.metric_type] || 0) + m.count;
                        return acc;
                      }, {} as Record<string, { platform: string; platform_post_id: string; metrics: Record<string, number> }>);

                      return Object.entries(postMetrics)
                        .sort(([, a], [, b]) => {
                          const aTotal = Object.values(a.metrics).reduce((x, y) => x + y, 0);
                          const bTotal = Object.values(b.metrics).reduce((x, y) => x + y, 0);
                          return bTotal - aTotal;
                        })
                        .slice(0, 20)
                        .map(([_, post]) => {
                          const impressions = post.metrics.impression || 0;
                          const likes = post.metrics.like || 0;
                          const retweets = post.metrics.retweet || 0;
                          const replies = post.metrics.reply || 0;
                          const total = impressions + likes + retweets + replies + (post.metrics.quote || 0);
                          const rate = impressions > 0 ? ((total / impressions) * 100).toFixed(2) : '0.00';
                          return (
                            <tr key={`${post.platform}-${post.platform_post_id}`} style={{ borderBottom: `1px solid ${glass.border}` }}>
                              <td className="p-3 t-meta truncate max-w-[200px]" style={{ color: glass.text }}>Post {post.platform_post_id.slice(0, 8)}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {PLATFORM_ICONS[post.platform]}
                                  <span className="t-mono text-xs" style={{ color: PLATFORM_COLORS[post.platform] }}>{post.platform}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right t-mono" style={{ color: glass.text }}>{impressions.toLocaleString()}</td>
                              <td className="p-3 text-right t-mono" style={{ color: 'var(--danger)' }}>{likes.toLocaleString()}</td>
                              <td className="p-3 text-right t-mono" style={{ color: 'var(--green-bright)' }}>{retweets.toLocaleString()}</td>
                              <td className="p-3 text-right t-mono" style={{ color: 'var(--info)' }}>{replies.toLocaleString()}</td>
                              <td className="p-3 text-right t-mono font-medium" style={{ color: 'var(--green)' }}>{rate}%</td>
                            </tr>
                          );
                        })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Trends Chart */}
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <div className="t-label mb-4" style={{ color: glass.text }}>Engagement Trends ({timeRange.label})</div>
              <div className="h-96" style={{ position: 'relative' }}>
                <svg width="100%" height="100%" viewBox="0 0 800 400" style={{ background: 'transparent' }}>
                  <defs>
                    <linearGradient id="gridLines" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={glass.border} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={glass.border} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((y, i) => (
                    <line key={i} x1="60" y1={40 + y * 320} x2="780" y2={40 + y * 320} stroke={glass.border} strokeWidth="0.5" strokeDasharray="4,4" />
                  ))}
                  {/* Y-axis labels */}
                  {[1, 0.75, 0.5, 0.25, 0].map((y, i) => (
                    <text key={i} x="40" y={40 + y * 320} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={glass.text2}>
                      {(Math.max(...metrics.map(m => m.count)) * y).toLocaleString()}
                    </text>
                  ))}
                  {/* Lines for each metric */}
                  {Object.keys(METRIC_COLORS).map((metric, mi) => {
                    const color = METRIC_COLORS[metric];
                    const maxCount = Math.max(...metrics.map(m => m.count), 1);
                    return (
                      <polyline
                        key={metric}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        points={trendDays.map((day, di) => {
                          const count = dailyTrend[day]?.[metric] || 0;
                          const x = 60 + (di / Math.max(trendDays.length - 1, 1)) * 720;
                          const y = 40 + 320 - (count / maxCount) * 320;
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                    );
                  })}
                  {/* Legend */}
                  <g transform="translate(60, 380)">
                    {Object.entries(METRIC_COLORS).map(([metric, color], i) => (
                      <g key={metric} transform={`translate(${i * 130}, 0)`}>
                        <line x1="0" y1="0" x2="20" y2="0" stroke={color} strokeWidth="2.5" />
                        <text x="24" y="4" fontSize="11" fill={glass.text}>{METRIC_LABELS[metric]}</text>
                      </g>
                    ))}
                  </g>
                </svg>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <div className="t-label mb-4" style={{ color: glass.text }}>Daily Breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${glass.border}` }}>
                      <th className="text-left p-3 t-mono text-xs" style={{ color: glass.text2 }}>Date</th>
                      {Object.keys(METRIC_COLORS).map(metric => (
                        <th key={metric} className="text-right p-3 t-mono text-xs" style={{ color: METRIC_COLORS[metric] }}>
                          <span style={{ color: METRIC_COLORS[metric] }}>{METRIC_LABELS[metric]}</span>
                        </th>
                      ))}
                      <th className="text-right p-3 t-mono text-xs" style={{ color: glass.text2 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendDays.slice(-14).reverse().map(day => {
                      const dayData = dailyTrend[day] || {};
                      const total = Object.values(dayData).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={day} style={{ borderBottom: `1px solid ${glass.border}` }}>
                          <td className="p-3 t-mono" style={{ color: glass.text }}>{new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                          {Object.keys(METRIC_COLORS).map(metric => (
                            <td key={metric} className="p-3 text-right t-mono" style={{ color: METRIC_COLORS[metric] }}>
                              {(dayData[metric] || 0).toLocaleString()}
                            </td>
                          ))}
                          <td className="p-3 text-right t-mono font-bold" style={{ color: glass.text }}>{total.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}