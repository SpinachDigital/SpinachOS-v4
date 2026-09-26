/*
 * routes/tasks.ts — Sprint 1 "Show me the work".
 * GET /api/v1/tasks/:id  → task + timeline (lifecycle events) + outputs[]
 * GET /api/v1/outputs    → recent deliverables, paginated per §4 (limit default 20, max 100, offset cursor)
 * Auth: authMiddleware (P0 lockdown). No unbounded queries: every select bounded.
 */
import { app, authMiddleware, supabase } from '../ctx';

// GET /api/v1/tasks/:id — task + timeline + outputs
app.get('/api/v1/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!task) return res.status(404).json({ error: 'task not found' });

    // timeline: task metadata already carries started/completed/failed marks;
    // lifecycle rows come from logs (task_id-scoped, bounded 50)
    const { data: outputs } = await supabase
      .from('task_outputs')
      .select('id, kind, title, body, meta, created_at')
      .eq('task_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    const timeline = [
      task.created_at ? { at: task.created_at, event: 'created', detail: `Task created — assigned to ${task.assigned_to || 'unassigned'}` } : null,
      task.metadata?.started_at ? { at: task.metadata.started_at, event: 'started', detail: `Execution started (${task.metadata.source || 'api'})` } : null,
      task.metadata?.completed_at ? { at: task.metadata.completed_at, event: 'completed', detail: `Completed via ${task.metadata.via || 'gateway'} · ${task.metadata.model || ''}` } : null,
      task.metadata?.failed_at ? { at: task.metadata.failed_at, event: 'failed', detail: String(task.metadata.error || 'execution failed') } : null,
    ].filter(Boolean);

    res.json({ task, timeline, outputs: outputs || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/outputs — recent deliverables across all tasks (paginated §4)
app.get('/api/v1/outputs', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const { data, error } = await supabase
      .from('task_outputs')
      .select('id, task_id, kind, title, body, meta, created_at, tasks(title, assigned_to, status)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
