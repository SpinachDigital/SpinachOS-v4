/**
 * api/src/routes/evolutions.ts — Phase 7 GOAL 1+2 routes + daily learning run.
 *
 * Endpoints:
 *   POST /api/v1/evolutions/run         — manual trigger (probe/demo)
 *   GET  /api/v1/evolutions             — list proposals (status filter)
 *   GET  /api/v1/evolutions/preferences — approved preferences (for gateway injection)
 *   POST /api/v1/evolutions/:id/apply   — approve→apply (explicit founder action)
 *   POST /api/v1/evolutions/:id/deny    — deny + suppress (proposal_key unique = law)
 *
 * Daily schedule: 08:30 IST (before the 09:00 retainer run) — cron armed here.
 */
import { app, supabase, authMiddleware } from '../ctx';
import { runLearningLoop } from '../learning-loop';
import { recordApprovalDecision } from '../memory-ledger';
import cron from 'node-cron';



// ---------------- apply / deny (THE INBOX calls these) ----------------

/** Approve → apply. NEVER automatic: this is an explicit founder action,
 *  routed from the evolution_proposal card in the inbox. */
app.post('/api/v1/evolutions/:id/apply', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data: prop, error } = await supabase
      .from('evolution_proposals')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !prop) return res.status(404).json({ error: 'proposal not found' });
    if (prop.status === 'rejected') return res.status(400).json({ error: 'proposal was denied — cannot apply' });
    if (prop.status === 'applied') return res.json({ ok: true, already: true, prop });

    // Apply by type:
    // preference → learned_preferences row (status approved)
    // playbook_fix → payload.version_bump noted; new pack version is GOAL 2's
    //                versioned-diff path (old installs untouched — versioned law)
    // cost_rule    → learned_preferences row (scope agent) — guardrail enforced
    //                by usage logging path reading approved rules
    let applied: any = { type: prop.type };
    if (prop.type === 'preference' || prop.type === 'cost_rule') {
      const p = prop.payload || {};
      const { error: insErr } = await supabase.from('learned_preferences').upsert({
        scope: p.scope || (prop.type === 'cost_rule' ? 'agent' : 'global'),
        client_id: p.client_id || null,
        agent_profile: p.agent || null,
        key: p.key || prop.proposal_key,
        value: p.value || p.rule || {},
        confidence: prop.confidence,
        status: 'approved',
        evidence_refs: prop.evidence,
        proposal_id: prop.id,
      }, { onConflict: 'scope,key,client_id,agent_profile' });
      if (insErr) throw insErr;
      applied.preference_saved = true;
    } else if (prop.type === 'playbook_fix') {
      // Versioned playbook diff — GOAL 2 detail. Create actual v(N+1) version row
      // from payload diff data, mark old installs untouched (v(N)), new installs get v(N+1).
      const p = prop.payload || {};
      const version = p.new_version || (prop.version_bump ? String(Number(prop.version) + 1) : '1');
      const diffSteps = p.changed_steps || [];
      const diffTasks = p.changed_tasks || [];
      const diffGates = p.changed_gates || [];

      // Upsert new version row
      const { error: upsertErr } = await supabase
        .from('playbooks')
        .upsert({
          slug: p.slug || prop.slug,
          version: version,
          workflow_type: p.workflow_type || prop.workflow_type,
          description: p.description || prop.description,
          stages_json: p.new_steps || [],
          tasks_json: p.new_tasks || [],
          gates_json: p.new_gates || [],
          metadata: JSON.stringify({
            playbook_fix_id: prop.id,
            old_version: prop.version,
            new_version: version,
            changed_steps: diffSteps,
            changed_tasks: diffTasks,
            changed_gates: diffGates
          })
        }, { onConflict: 'slug,version' });

      if (upsertErr) throw upsertErr;

      applied.playbook_fix_version = version;
      applied.playbook_fix_diff = JSON.stringify({
        old_version: prop.version,
        new_version: version,
        changed_steps: diffSteps,
        changed_tasks: diffTasks,
        changed_gates: diffGates
        });
    }

    const { error: updErr } = await supabase
      .from('evolution_proposals')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) throw updErr;

    await recordApprovalDecision(supabase, {
      approvalId: id,
      title: prop.title,
      approved: true,
      by: 'founder',
    });
    res.json({ ok: true, applied });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Deny → suppressed FOREVER (proposal_key stays; unique constraint blocks
 *  re-proposal). Nagging is a bug — this is the suppression law. */
app.post('/api/v1/evolutions/:id/deny', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data: prop, error } = await supabase
      .from('evolution_proposals')
      .select('id, proposal_key, title')
      .eq('id', id)
      .single();
    if (error || !prop) return res.status(404).json({ error: 'proposal not found' });

    const { error: updErr } = await supabase
      .from('evolution_proposals')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'applied');
    if (updErr) throw updErr;

    // Any pending inbox card for this proposal is closed (denied, not left dangling)
    await supabase
      .from('approvals')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('metadata->>proposal_id', id)
      .eq('status', 'pending');

    await recordApprovalDecision(supabase, {
      approvalId: id,
      title: prop.title,
      approved: false,
      by: 'founder',
    });
    res.json({ ok: true, suppressed: prop.proposal_key });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- read side ----------------

app.get('/api/v1/evolutions', authMiddleware, async (req: any, res) => {
  try {
    const { status, type } = req.query;
    let q = supabase
      .from('evolution_proposals')
      .select('*')
      .order('proposed_at', { ascending: false })
      .limit(200);
    if (status) q = q.eq('status', String(status));
    if (type) q = q.eq('type', String(type));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Approved preferences for gateway injection (GOAL 2 — prompt text only). */
app.get('/api/v1/evolutions/preferences', authMiddleware, async (req: any, res) => {
  try {
    const { scope, agent, client_id, status } = req.query;
    let q = supabase
      .from('learned_preferences')
      .select('*')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (scope) q = q.eq('scope', String(scope));
    if (agent) q = q.eq('agent_profile', String(agent));
    if (client_id) q = q.eq('client_id', String(client_id));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- manual trigger + daily schedule ----------------

app.post('/api/v1/evolutions/run', authMiddleware, async (req: any, res) => {
  try {
    const result = await runLearningLoop();
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Daily 08:30 IST (03:00 UTC) — cheap read-only mining before the 09:00 retainer run.
let LEARNING_CRON_RUNNING = false;
cron.schedule('0 3 * * *', async () => {
  if (LEARNING_CRON_RUNNING) return;
  LEARNING_CRON_RUNNING = true;
  try {
    await runLearningLoop();
  } catch (e: any) {
    console.error('[learning-cron] failed:', e?.message);
  } finally {
    LEARNING_CRON_RUNNING = false;
  }
});
console.log('[learning-cron] armed: daily 08:30 IST → learning loop mining run');

// ---------------- Phase 7 GOAL 2: Laya training-data export ----------------
// JSONL dump of laya_routing_decisions joined with outcomes (was the routed
// task approved/rejected downstream?). One row per decision, training-ready.
// GET /api/v1/evolutions/laya-export?days=30 → application/x-ndjson
app.get('/api/v1/evolutions/laya-export', authMiddleware, async (req: any, res) => {
  try {
    const days = Math.min(parseInt(String(req.query.days || '30'), 10) || 30, 180);
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data: decisions, error } = await supabase
      .from('laya_routing_decisions')
      .select('id, source, message, department, priority, confidence, reasoning, latency_ms, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (error) return res.status(500).json({ error: error.message });

    // Outcome enrichment: was the downstream task approved? Join via
    // approvals where the payload references the routed task/message.
    const msgs = (decisions || []).map((d: any) => d.message);
    let outcomeByMsg: Record<string, { status: string; type: string }> = {};
    if (msgs.length) {
      const { data: appr } = await supabase
        .from('approvals')
        .select('title, type, status')
        .gte('created_at', since)
        .limit(2000);
      for (const a of (appr || []) as any[]) {
        if (a.title) outcomeByMsg[a.title] = { status: a.status, type: a.type };
      }
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    for (const d of (decisions || []) as any[]) {
      const outcome = outcomeByMsg[d.message] || null;
      res.write(JSON.stringify({
        text: d.message,
        department: d.department,
        priority: d.priority,
        confidence: d.confidence,
        reasoning: d.reasoning,
        latency_ms: d.latency_ms,
        source: d.source,
        outcome_status: outcome?.status || 'unknown',
        outcome_type: outcome?.type || null,
        decided_at: d.created_at,
      }) + '\n');
    }
    res.end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- Phase 7 GOAL 3: style lint + tighten ----------------
import { lintAgentOutput, weeklyStyleScores } from '../agents/style-lint';
import { styleBlockFor } from '../agents/style-contract';

/** Lint any text (probe endpoint — the real path runs inside approval-card
 *  creation). Zero LLM, regex only. */
app.post('/api/v1/evolutions/style-lint', authMiddleware, async (req: any, res) => {
  try {
    const { text } = req.body || {};
    if (typeof text !== 'string') return res.status(400).json({ error: 'text (string) required' });
    const t0 = Date.now();
    const result = lintAgentOutput(text);
    res.json({ ...result, lint_ms: Date.now() - t0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Weekly average style score per agent (P&L/ops view — style drift visible). */
app.get('/api/v1/evolutions/style-weekly', authMiddleware, async (req: any, res) => {
  try {
    const scores = await weeklyStyleScores();
    res.json(scores);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** Tighten — ONE user-initiated rewrite pass. NEVER automatic. The rewrite
 *  is logged: original text + lint-before stay in the audit trail
 *  (memory ledger), and the tightened text is returned (caller swaps the
 *  card payload explicitly). Score < 6 required for the button to exist. */
app.post('/api/v1/evolutions/tighten', authMiddleware, async (req: any, res) => {
  try {
    const { text, agent, approval_id } = req.body || {};
    if (typeof text !== 'string') return res.status(400).json({ error: 'text (string) required' });
    const before = lintAgentOutput(text);
    if (before.score >= 6) {
      return res.status(400).json({ error: `tighten only offered below score 6 (current: ${before.score})` });
    }

    // Single rewrite pass via the gateway with a tighten-focused prompt.
    const { runProfileTask } = await import('../bridge');
    const tierBlock = styleBlockFor(agent || 'engineer');
    const tightened = await runProfileTask(agent || 'engineer',
      `Rewrite the following text so it complies with the style contract below. Keep every fact. Return ONLY the rewritten text.\n\nSTYLE CONTRACT:${tierBlock}\n\nTEXT:\n${text}`);

    const after = lintAgentOutput(tightened.output);

    // Audit trail: original + both scores land in the memory ledger.
    const { recordMemory } = await import('../memory-ledger');
    await recordMemory(supabase, {
      agent_profile: agent || 'engineer',
      memory_type: 'decision',
      key: `tighten:${approval_id || 'adhoc'}:${Date.now()}`,
      value: {
        what: 'style tighten (user-initiated)', original: text.slice(0, 2000),
        score_before: before.score, score_after: after.score,
        violations_before: before.violations, approval_id: approval_id || null,
      },
    });

    res.json({
      ok: true,
      before: { score: before.score, violations: before.violations },
      after: { score: after.score, violations: after.violations },
      text: tightened.output,
      model: tightened.model,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
