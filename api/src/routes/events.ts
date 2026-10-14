/*
 * routes/events.ts — N3 §1 read side: the typed agent event stream.
 * GET /api/v1/threads/:id/events — bounded, newest-first.
 * :id is a task id (the execution unit) — task-scoped events carry the full
 * sequence: started → tool calls → approval requested → decided → done.
 * A command-thread id is accepted too: its linked tasks are resolved via
 * thread_messages.task_id, and events from all of them are merged.
 */
import { app, authMiddleware, supabase } from '../ctx';
import { readTaskEvents } from '../agent-events';

app.get('/api/v1/threads/:id/events', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit)) || 100, 200);
    // direct task id?
    const { data: task } = await supabase.from('tasks').select('id').eq('id', id).single();
    if (task) {
      const events = await readTaskEvents(id, limit);
      return res.json({ events, count: events.length, scope: 'task' });
    }
    // thread id → resolve its tasks
    const { data: msgs } = await supabase
      .from('thread_messages')
      .select('task_id')
      .eq('thread_id', id)
      .not('task_id', 'is', null)
      .limit(50);
    const taskIds = [...new Set((msgs || []).map((m: any) => m.task_id).filter(Boolean))];
    if (taskIds.length === 0) {
      return res.json({ events: [], count: 0, scope: 'thread', note: 'no linked tasks for this thread' });
    }
    const merged = (await Promise.all(taskIds.map((tid: string) => readTaskEvents(tid, limit))))
      .flat()
      .sort((a: any, b: any) => (a.at < b.at ? 1 : -1))
      .slice(0, limit);
    return res.json({ events: merged, count: merged.length, scope: 'thread' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
