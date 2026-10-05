/*
 * routes/laya.ts — Phase 3 monolith split (from index.ts L2781–2918).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { LayaDecision, LAYA_DEPARTMENT_MAP } from '../laya-client';
import { app, authMiddleware, emitFeed, emitAgentState, sanitizeText, supabase } from '../ctx';
import { executeAgentTask, AGENT_TASK_TIMEOUT_MS } from '../engines/agent-execution';

// Phase 5 GOAL 10 fix (2026-10-05): postgrest-js builders are LAZY —
// `void supabase.from(...).insert(...)` NEVER fires the HTTP request.
// Every routing decision must be AWAITED, else the confidence log
// silently loses rows (found via live probe: batch rows never landed).
async function logDecision(row: Record<string, unknown>) {
  try {
    await supabase.from('laya_routing_decisions').insert(row);
  } catch (e: any) {
    console.error('[laya] decision-log insert failed:', e?.message);
  }
}

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

    // Bypass Laya for strategic/CEO queries.
    // §3 BUG FIX: this branch used to INSERT a fake "CEO Query" row into the
    // real `clients` table (client-data pollution). Strategic queries are
    // routed WITHOUT touching client data — just dispatch the CEO task.
    if (isCEOQuery(command)) {
      const taskId = await executeAgentTask('ceo', command, 'laya:ceo-route');
      emitFeed('orchestrator', 'CEO strategy task started', { task_id: taskId, query: command.slice(0, 100) });
      emitAgentState('ceo', 'working', `Evaluating: ${command.slice(0, 60)}`);
      return res.json({
        ok: true,
        routed: 'ceo',
        priority: 'high',
        task_id: taskId,
        message: `Routed to CEO for strategic evaluation: "${command.slice(0, 100)}"`,
      });
    }

    // Call Laya for fast-path routing
    const decision = await callLaya(command);

    if (!decision) {
      // Laya unavailable or invalid response — fallback to command gateway logic
      // Phase 5 GOAL 10: the fallback is LOGGED (confidence 0, source 'single')
      // — a decision nobody recorded is a decision nobody can fine-tune on.
      void logDecision({
        source: 'single', message: command.slice(0, 2000), department: 'fallback',
        priority: 'low', confidence: 0, reasoning: 'laya unavailable/invalid — command gateway fallback', latency_ms: null,
      });
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

    // Phase 5 GOAL 10: the routing decision is LOGGED with its confidence
    // (fine-tuning data collection the Laya experiment called for).
    void logDecision({
      source: 'single', message: command.slice(0, 2000), department: department.toLowerCase(),
      priority, confidence: decision.confidence ?? 0, reasoning: (decision as any).reasoning || null, latency_ms: null,
    });

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

// Phase 5 GOAL 10 — /batch-decide: batch routing with confidence logging.
// Every decision logged (source 'batch', latency, confidence) — the
// fine-tuning data collection the Laya experiment called for.
app.post('/api/v1/laya/batch-decide', authMiddleware, async (req, res) => {
  try {
    const messages: string[] = (Array.isArray(req.body?.messages) ? req.body.messages : [])
      .map((m: unknown) => sanitizeText(String(m), 2000))
      .filter(Boolean);
    if (messages.length === 0) return res.status(400).json({ error: 'messages[] required' });
    if (messages.length > 50) return res.status(400).json({ error: 'max 50 messages per batch' });

    const started = Date.now();
    const results = [];
    for (const message of messages) {
      const t0 = Date.now();
      const decision = await callLaya(message);
      const latency = Date.now() - t0;
      if (!decision) {
        // Fallback logged (confidence 0) — visible, not silent.
        await logDecision({
          source: 'batch', message, department: 'fallback',
          priority: 'low', confidence: 0, reasoning: 'laya unavailable/invalid', latency_ms: latency,
        });
        results.push({ message: message.slice(0, 80), routed: null, fallback: true, confidence: 0, latency_ms: latency });
        continue;
      }
      const agent = LAYA_DEPARTMENT_MAP[decision.department.toLowerCase()] || null;
      await logDecision({
        source: 'batch', message, department: decision.department.toLowerCase(),
        priority: decision.priority, confidence: decision.confidence ?? 0,
        reasoning: (decision as any).reasoning || null, latency_ms: latency,
      });
      results.push({
        message: message.slice(0, 80), routed: agent, department: decision.department,
        priority: decision.priority, confidence: decision.confidence ?? 0, latency_ms: latency,
        ...(agent ? {} : { error: `unknown department '${decision.department}'` }),
      });
    }
    const withConfidence = results.filter((r) => !r.fallback);
    const avgConfidence = withConfidence.length
      ? Math.round((withConfidence.reduce((a, r) => a + (r.confidence || 0), 0) / withConfidence.length) * 100) / 100
      : 0;
    res.json({
      ok: true, count: results.length, avg_confidence: avgConfidence,
      total_ms: Date.now() - started, results,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/laya/decisions — the confidence log (queryable)
app.get('/api/v1/laya/decisions', authMiddleware, async (req, res) => {
  try {
    let q = supabase.from('laya_routing_decisions').select('*').order('created_at', { ascending: false }).limit(100);
    if (req.query.department) q = q.eq('department', String(req.query.department));
    if (req.query.source) q = q.eq('source', String(req.query.source));
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];
    const withConf = rows.filter((r: any) => r.department !== 'fallback');
    res.json({
      decisions: rows,
      stats: {
        count: rows.length,
        fallbacks: rows.length - withConf.length,
        avg_confidence: withConf.length ? Math.round((withConf.reduce((a: number, r: any) => a + (r.confidence || 0), 0) / withConf.length) * 100) / 100 : 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// CALENDAR / BRAIN SYSTEM
// ============================================
