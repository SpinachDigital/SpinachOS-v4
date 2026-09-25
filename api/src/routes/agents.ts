/*
 * routes/agents.ts — Phase 3 monolith split (from index.ts L516–626).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, AgentLoadSchema, AgentSearchSchema, authMiddleware, sanitizeText, supabase } from '../ctx';
import { AGENT_MODELS, executeAgentTask } from '../engines/agent-execution';
app.post('/api/v1/agents/execute', authMiddleware, async (req, res) => {
  try {
    const agent = sanitizeText(req.body.agent, 50).toLowerCase();
    const task = sanitizeText(req.body.task, 4000);
    const source = sanitizeText(req.body.source, 50) || 'api';
    if (!agent || !task) {
      return res.status(400).json({ error: 'agent and task required' });
    }
    if (!AGENT_MODELS[agent]) {
      return res.status(400).json({ error: `Unknown agent "${agent}"`, known: Object.keys(AGENT_MODELS) });
    }
    const task_id = await executeAgentTask(agent, task, source);
    res.status(202).json({
      ok: true,
      task_id,
      agent,
      status: 'running',
      message: `Task accepted — ${agent} executing via OmniRoute (${AGENT_MODELS[agent]}). WS events follow on completion.`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/agents/execute/:taskId — fetch a task's execution result (output/model/error)
app.get('/api/v1/agents/execute/:taskId', authMiddleware, async (req, res) => {
  try {
    const id = req.params.taskId;
    // Full UUID required — Postgres uuid column rejects short IDs with an opaque cast error
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({
        error: 'Invalid task id — full UUID required (get it from the tasks list / kanban/cards)',
        got: id,
      });
    }
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Task not found', id });
      }
      throw error;
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// AGENT ROSTER PROXY
// ============================================
app.post('/api/v1/agents/search', authMiddleware, async (req, res) => {
  const parse = AgentSearchSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    // Proxy to Hermes agency_agents_search tool
    // For now return mock data
    res.json({
      success: true,
      query: parse.data.query,
      count: 0,
      results: [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/agents/load', authMiddleware, async (req, res) => {
  const parse = AgentLoadSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    // Proxy to Hermes agency_agents_load tool
    res.json({
      success: true,
      agent: { slug: parse.data.slug, name: parse.data.slug },
      prompt: `Specialist prompt for ${parse.data.slug} on task: ${parse.data.task}`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// CRON
// ============================================
// ---- REAL in-process scheduler (D2 retainer loop) ----
// Day-1 09:00 IST daily: POST /retainer/run-due fires for any due runs.
// node-cron interprets '0 9 * * *' in server local time — API runs on IST host.
import cron from 'node-cron';
let RETAINER_CRON_RUNNING = false;

// A4 idle-brain crons (Phase 1 acceptance): orchestrator standup (weekday 9:30 AM),
// cto weekly tech review (Mon 10:00), ceo monthly strategy (1st of month 11:00).
// All fire real bridge tasks — the brains actually run.
const WAKE_BRAINS: Array<{ id: string; schedule: string; agent: string; task: string }> = [
  { id: 'standup-daily-0930', schedule: '30 9 * * 1-5', agent: 'orchestrator',
    task: 'Daily standup: list yesterday\'s completed runs, today\'s active pipelines, and any blockers. One tight report.' },
  { id: 'cto-weekly-review', schedule: '0 10 * * 1', agent: 'cto',
    task: 'Weekly tech review: audit system health, flag anything fragile that would break at 100 clients, propose one boring fix.' },
  { id: 'ceo-monthly-strategy', schedule: '0 11 1 * *', agent: 'ceo',
    task: 'Monthly strategy: review package mix and pipeline throughput; recommend where to grow and where to protect. Max 200 words.' },
];
const WAKE_CRON_STATES: Record<string, boolean> = {};
