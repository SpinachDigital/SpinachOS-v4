'use client';

/*
 * /tasks — job runs list (R2.1: the home panel's "View All" target).
 * Single source: the same /api/v1/tasks feed the detail page reads.
 * Honest states: skeleton while loading, real empty state, retry on error.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

type Task = { id: string; agent?: string; status?: string; title?: string; created_at?: string };

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="sub">{loading ? 'Loading tasks…' : `${tasks?.length ?? 0} job runs`}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div style={{ padding: '14px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>{error}</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={load}>Retry</button>
          </div>
        )}
        {!error && !loading && tasks?.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No tasks yet — dispatch a command from Chat.</p>
        )}
        {(tasks || []).map(t => (
          <button
            key={t.id}
            onClick={() => router.push(`/tasks/${t.id}`)}
            className="btn btn-secondary"
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10 }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.title || t.agent || 'Task'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
              {[t.agent, t.status, fmt(t.created_at)].filter(Boolean).join(' · ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
