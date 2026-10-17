'use client';

/*
 * /tasks — job runs list (R2.1: the home panel's "View All" target).
 * Single source: the same /api/v1/tasks feed the detail page reads.
 * Honest states: skeleton while loading, real empty state, retry on error.
 * UX pass (2026-10-17): the page promised "job runs & outputs" but showed
 * prompt titles in one gray wash. Now: status pills, human agent names,
 * filter tabs, and the test-noise filter proven in TaskRunsPanel.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

type Task = { id: string; agent?: string; status?: string; title?: string; created_at?: string };

const HUMAN_AGENT: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', orchestrator: 'Orchestrator', engineer: 'Engineering',
  designer: 'Design', social: 'Social', seo_specialist: 'SEO Specialist',
  research: 'Research', sales: 'Sales', ads_manager: 'Ads Manager',
  ops: 'Ops', hr_director: 'HR Director', content: 'Content', hr: 'HR',
  director: 'Director', founder: 'You',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  done: { bg: 'rgba(74,222,128,0.14)', fg: '#4ade80', label: 'done' },
  running: { bg: 'rgba(56,189,248,0.14)', fg: '#38bdf8', label: 'running' },
  blocked: { bg: 'rgba(239,68,68,0.14)', fg: '#ef4444', label: 'blocked' },
  ready: { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', label: 'queued' },
  review: { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', label: 'review' },
};

const isTestTask = (t: Task) =>
  /^\s*(say |reply |reply with |probe |ping|pong|test|debug|sweep)/.test(
    String(t.title || '').toLowerCase()
  );

const TABS = ['all', 'done', 'running', 'blocked'] as const;

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [hideTests, setHideTests] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/tasks?limit=100');
      const j = await res.json();
      setTasks(Array.isArray(j) ? j : (j.tasks || []));
    } catch {
      setError('Connection interrupted — retry in a moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const visible = (tasks || []).filter((t) => {
    if (hideTests && isTestTask(t)) return false;
    if (tab === 'all') return true;
    if (tab === 'running') return t.status === 'running' || t.status === 'ready' || t.status === 'review';
    return t.status === tab;
  });
  const count = (tb: string) =>
    (tasks || []).filter((t) => (hideTests && isTestTask(t) ? false : tb === 'all' ? true : tb === 'running' ? t.status === 'running' || t.status === 'ready' || t.status === 'review' : t.status === tb)).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="sub">{loading ? 'Loading tasks…' : `${visible.length} job runs${hideTests ? ' (test noise hidden)' : ''}`}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0 24px 12px' }}>
        {TABS.map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)}
            style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: tab === tb ? 700 : 500,
              cursor: 'pointer', border: '1px solid ' + (tab === tb ? 'var(--accent, #004B63)' : 'var(--border)'),
              background: tab === tb ? 'var(--accent, #004B63)' : 'transparent',
              color: tab === tb ? '#fff' : 'var(--text-faint)',
            }}>
            {tb} {loading ? '' : `(${count(tb)})`}
          </button>
        ))}
        <button type="button" onClick={() => setHideTests((v) => !v)}
          style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 99, padding: '5px 12px', cursor: 'pointer' }}>
          {hideTests ? 'Show test runs' : 'Hide test runs'}
        </button>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>{error}</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={load}>Retry</button>
          </div>
        )}
        {!error && !loading && visible.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-faint)', padding: '24px 0' }}>
            {tasks && tasks.length > 0 ? 'Nothing in this filter.' : 'No tasks yet — dispatch a command from Chat.'}
          </p>
        )}
        {visible.map((t) => {
          const st = STATUS_STYLE[t.status || ''] || { bg: 'rgba(100,116,139,0.12)', fg: 'var(--text-faint)', label: t.status || 'unknown' };
          return (
            <button
              key={t.id}
              onClick={() => router.push(`/tasks/${t.id}`)}
              className="btn btn-secondary"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title || t.agent || 'Task'}
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
                  padding: '2px 9px', borderRadius: 99, background: st.bg, color: st.fg,
                }}>
                  {st.label}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>
                {t.agent ? `${HUMAN_AGENT[t.agent.toLowerCase()] || t.agent} · ` : ''}
                {fmt(t.created_at)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
