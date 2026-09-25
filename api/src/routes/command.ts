/*
 * routes/command.ts — Phase 3 monolith split (from index.ts L2298–2512 + L2513–2780).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, broadcast, emitAgentState, emitApproval, emitFeed, emitTaskUpdate, sanitizeText, supabase } from '../ctx';
import { runGatewayTask } from '../bridge';
import { executeAgentTask } from '../engines/agent-execution';
import { COMPLEX_SIGNALS, IRREVERSIBLE, dispatchReply, needsBrainstorm } from '../command-intent';
import { delegatePlan, handleCommandThread } from '../command-thread';
import { ensureWorkflowChannel, warRoomPost } from '../warroom-helpers';
import { specialCommandHandler } from './special-handler';
import { LAYA_DEPARTMENT_MAP, callLaya } from '../laya-client';


// The founder-facing reply from a dispatched task (Hinglish register)

/**
 * handleCommandThread — the two-way engine behind POST /api/v1/command.
 * Returns { thread_id, reply } so the caller can stream the reply over WS.
 */

/** After a "yes" to the plan: delegate the plan via the bridge, close thread. */

// POST /api/v1/command — now two-way: returns { thread_id, reply, mode }
app.post('/api/v1/command', authMiddleware, async (req, res) => {
  try {
    const command = sanitizeText(req.body.command, 2000);
    const threadId = req.body.thread_id ? sanitizeText(req.body.thread_id, 50) : undefined;
    if (!command) return res.status(400).json({ error: 'Missing command' });
    // Special commands (pipeline/onboard/approval/hire/standup) run their
    // dedicated branches FIRST — they must never fall through to the Laya
    // fast path (observed: a typo'd pipeline intent went to sales→social and
    // died on NVIDIA rate limits with the task closed 'done').
    const special = await specialCommandHandler(command, req.headers.authorization);
    if (special) return res.json(special);
    const r = await handleCommandThread(command, threadId || undefined);
    res.json({ ok: true, ...r, action: r.mode === 'fast' ? 'dispatched' : r.mode });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/threads — list threads (most recent first)
app.get('/api/v1/threads', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('command_threads')
    .select('*').order('updated_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/v1/threads/:id/messages — one thread's messages
app.get('/api/v1/threads/:id/messages', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('thread_messages')
    .select('*').eq('thread_id', req.params.id).order('created_at', { ascending: true }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ============================================================
// PHASE 4 PART 3 — WAR-ROOM (live per-workflow comms + task states)
// Delegation chatter posts to per-workflow channels; war-room aggregates
// task states + messages + outputs in one screen.
// ============================================================

/** Ensure a workflow channel exists (kind='workflow'), return its id. */

/**
 * warRoomPost — coordination-level message to the workflow channel.
 * Called by the pipeline engine on delegation/QA/decision events.
 */

// Wire the pipeline engine to post coordination chatter
// (wrap the original emitFeed calls for PIPELINE_STEP / QA_REWORK / PIPELINE_PAUSED / COMPLETED)
const origEmitFeed = emitFeed;

// GET /api/v1/warroom/:workflowId — the one-screen view: workflow + steps + messages
app.get('/api/v1/warroom/:workflowId', authMiddleware, async (req, res) => {
  const wfId = req.params.workflowId;
  const { data: wf, error: wfErr } = await supabase.from('workflows').select('*').eq('id', wfId).single();
  if (wfErr || !wf) return res.status(404).json({ error: 'workflow not found' });

  // channel + messages
  let messages: any[] = [];
  const { data: ch } = await supabase.from('channels').select('id, display_name').eq('workflow_id', wfId).maybeSingle();
  if (ch) {
    const { data: msgs } = await supabase.from('messages')
      .select('*').eq('channel_id', ch.id).order('created_at', { ascending: true }).limit(100);
    messages = msgs || [];
  }

  // live tasks for this workflow (via metadata linkage or title match)
  const { data: tasks } = await supabase.from('tasks')
    .select('id, title, status, assigned_to, created_at')
    .or(`metadata->>workflow_id.eq.${wfId},title.ilike.%${String(wf.name).slice(0, 30)}%`)
    .order('created_at', { ascending: false }).limit(20);

  res.json({
    workflow: { id: wf.id, name: wf.name, status: wf.status, progress: wf.progress, current_step: wf.current_step },
    steps: (wf.steps_json || []).map((s: any) => ({
      name: s.name, status: s.status, agent: s.agent,
      qa_verdict: s.qa_verdict || null, rework_cycles: s.rework_cycles || 0,
      output_excerpt: s.output ? String(s.output).slice(0, 200) : null,
      completed_at: s.completed_at || null,
    })),
    messages,
    tasks: tasks || [],
  });
});
app.post('/api/v1/command', authMiddleware, async (req, res) => {
  try {
    // XSS/injection sanitization on free-text command input
    const command = sanitizeText(req.body.command, 2000);
    const source = sanitizeText(req.body.source, 50) || 'api';
    if (!command) {
      return res.status(400).json({ error: 'Missing command' });
    }

    // PHASE 4: the two-way thread engine handles dispatch/brainstorm first.
    // Special commands (pipeline/approval/standup/status) still run their
    // dedicated branches below via specialCommandHandler.
    const special = await specialCommandHandler(command, req.headers.authorization);
    if (special) return res.json(special);

    const r = await handleCommandThread(command, req.body.thread_id);
    res.json({ ok: true, ...r, action: r.mode === 'fast' ? 'laya_routed' : r.mode });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * specialCommandHandler — the domain branches from the old one-way gateway,
 * preserved as first-class operations (they act, not discuss). Returns null
 * when the command isn't special → falls through to the thread engine.
 */

// ============================================
// LAYA ROUTING CONTROLLER — System 1 fast path
// ============================================
