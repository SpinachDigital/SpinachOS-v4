/*
 * routes/laya.ts — Phase 3 monolith split (from index.ts L2781–2918).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { LayaDecision, LAYA_DEPARTMENT_MAP } from '../laya-client';
import { app, authMiddleware, emitFeed, emitAgentState, sanitizeText, supabase } from '../ctx';
import { executeAgentTask, AGENT_TASK_TIMEOUT_MS } from '../engines/agent-execution';

// -- imports auto-added by fix-imports (Phase 3)
import { LAYA_URL } from '../laya-client';

const CEO_KEYWORDS = ['should we', 'strategy', 'idea', 'plan', 'evaluate', 'direction', 'vision', 'approve'];

async function callLaya(message: string): Promise<LayaDecision | null> {
  try {
    const res = await fetch(`${LAYA_URL}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      // Fast timeout — Laya is System 1, should respond in <1s
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.department || !data.priority) return null;
    return data as LayaDecision;
  } catch {
    return null; // Laya unavailable — fallback to command routing
  }
}

function isCEOQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return CEO_KEYWORDS.some(kw => lower.includes(kw));
}

// POST /api/v1/laya/route — Laya routing endpoint (can be called directly or via command gateway)
app.post('/api/v1/laya/route', authMiddleware, async (req, res) => {
  try {
    const command = sanitizeText(req.body.command, 2000);
    if (!command) {
      return res.status(400).json({ error: 'Missing command' });
    }

    // Bypass Laya for strategic/CEO queries
    if (isCEOQuery(command)) {
      const { data: client } = await supabase
        .from('clients')
        .insert({ name: 'CEO Query', business_type: 'strategy', status: 'active' })
        .select()
        .single();
      if (client) {
        await supabase
          .from('workflows')
          .insert({
            name: 'ceo_strategy',
            client_id: client.id,
            status: 'active',
            current_step: 'strategy',
            progress: 0,
            steps_json: [
              { name: 'strategy', agent: 'ceo', status: 'in_progress', description: 'Evaluate strategic question' },
            ],
          });
        emitFeed('orchestrator', 'CEO strategy workflow started', { workflow_id: client.id, query: command });
        emitAgentState('ceo', 'working', `Evaluating: ${command.slice(0, 60)}`);
      }
      return res.json({
        ok: true,
        routed: 'ceo',
        priority: 'high',
        message: `Routed to CEO for strategic evaluation: "${command.slice(0, 100)}"`,
      });
    }

    // Call Laya for fast-path routing
    const decision = await callLaya(command);

    if (!decision) {
      // Laya unavailable or invalid response — fallback to command gateway logic
      return res.json({
        ok: false,
        fallback: true,
        message: 'Laya unavailable — use /api/v1/command for full processing',
      });
    }

    const { department, priority } = decision;
    const agent = LAYA_DEPARTMENT_MAP[department.toLowerCase()];

    if (!agent) {
      return res.status(400).json({
        ok: false,
        error: `Unknown department from Laya: ${department}`,
        known: Object.keys(LAYA_DEPARTMENT_MAP),
      });
    }

    // Execute directly via agent execution engine
    const task_id = await executeAgentTask(agent, command, 'laya-routing');

    // Priority handling
    if (priority === 'high') {
      emitFeed('orchestrator', 'High-priority Laya task executed', { agent, task_id, priority });
    }

    res.json({
      ok: true,
      routed: agent,
      priority,
      task_id,
      message: `Routed to ${agent} via Laya (${priority} priority)`,
    });
  } catch (e: any) {
    console.error('Laya routing error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/laya/health — check Laya connectivity
app.get('/api/v1/laya/health', authMiddleware, async (req, res) => {
  const decision = await callLaya('health check');
  res.json({
    laya_connected: !!decision,
    url: LAYA_URL,
  });
});

// ============================================
// CALENDAR / BRAIN SYSTEM
// ============================================
