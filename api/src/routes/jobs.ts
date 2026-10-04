/*
 * routes/jobs.ts — Phase 5 GOAL 1: the job queue read side (dead-letter
 * queue VISIBLE, retry state queryable).
 */

import { app, authMiddleware, supabase } from '../ctx';

// -- All jobs (filter by status/queue; the DLQ is status='dead')
app.get('/api/v1/jobs', authMiddleware, async (req, res) => {
  try {
    let q = supabase.from('job_queue').select('*').order('updated_at', { ascending: false }).limit(100);
    if (req.query.status) q = q.eq('status', String(req.query.status));
    if (req.query.queue) q = q.eq('queue', String(req.query.queue));
    const { data, error } = await q;
    if (error) throw error;
    const jobs = data || [];
    res.json({
      jobs,
      counts: {
        queued: jobs.filter((j: any) => j.status === 'queued').length,
        running: jobs.filter((j: any) => j.status === 'running').length,
        done: jobs.filter((j: any) => j.status === 'done').length,
        dead: jobs.filter((j: any) => j.status === 'dead').length,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- Retry a dead/failed job manually (one click from the UI)
app.post('/api/v1/jobs/:id/retry', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('job_queue')
      .update({ status: 'queued', attempts: 0, next_run_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .in('status', ['dead', 'failed'])
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(400).json({ error: 'job not in a retryable state (dead/failed only)' });
    res.json({ ok: true, job: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
