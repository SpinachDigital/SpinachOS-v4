/*
 * routes/retainer.ts — Phase 3 monolith split (from index.ts L2116–2297).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { app, authMiddleware, supabase, emitFeed, emitAgentState, emitWorkflow } from '../ctx';
import { executeAgentTask } from '../engines/agent-execution';
import { STEP_DESCRIPTIONS } from '../step-descriptions';

// -- imports auto-added by fix-imports (Phase 3)
import { hybridRetrieve } from '../knowledge-helper';
import { PACKAGE_PRESETS } from '../clients-presets';
const MONTHLY_PACKAGES = new Set(['growth', 'scale']);

/**
 * Called when a retainer client's monthly pipeline completes:
 *  1. Ingest the monthly_report step output to RAG (kind=report, client-scoped)
 *     — this IS the compounding: month-2's plan pulls it as context.
 *  2. Insert/advance the retainer_runs row: month_number+1, next_run_at = +30 days.
 */
async function closeRetainerCycle(workflow: any, steps: any[]) {
  const clientId = workflow?.client_id;
  if (!clientId) return { ingested: false, reason: 'no client on workflow' };

  const { data: client } = await supabase.from('clients').select('id, name, metadata').eq('id', clientId).maybeSingle();
  const pkg = (client?.metadata as any)?.package_key;
  if (!client || !MONTHLY_PACKAGES.has(pkg)) return { ingested: false, reason: `not a monthly retainer (${pkg})` };

  // 1. Find the monthly_report step output (if the step ran through the bridge it
  //    produced a task; fall back to the workflow's own step data)
  const reportStep = steps.find((s: any) => s.name === 'monthly_report');
  let reportText = reportStep?.output || reportStep?.summary || null;
  if (!reportText) {
    // pull the most recent completed monthly_report task for this client
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title, description, metadata, completed_at')
      .eq('client_id', clientId)
      .ilike('title', '%monthly%report%')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    reportText = task?.metadata?.output || task?.description || null;
  }

  // 2. Ingest to RAG (client-scoped, kind=report) — the month-1 → month-2 bridge
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (reportText) {
    const { error: ragErr } = await supabase.from('knowledge_chunks').insert({
      client_id: clientId,
      scope: 'client',
      kind: 'report',
      title: `Monthly report — ${monthLabel} (${client.name})`,
      content: typeof reportText === 'string' ? reportText : JSON.stringify(reportText),
      source: `workflow:${workflow.id}`,
      metadata: { workflow_id: workflow.id, package: pkg, month: monthLabel },
    });
    if (ragErr) console.error('[retainer] RAG ingest failed:', ragErr.message);
  }

  // 3. Advance the retainer_runs row (create on first completion)
  const { data: run } = await supabase
    .from('retainer_runs')
    .select('id, month_number')
    .eq('client_id', clientId)
    .order('month_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextMonth = (run?.month_number || 0) + 1;
  const nextRunAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: runErr } = await supabase.from('retainer_runs').upsert({
    client_id: clientId,
    package_key: pkg,
    month_number: nextMonth,
    next_run_at: nextRunAt,
    status: 'scheduled',
    last_workflow_id: workflow.id,
  }, { onConflict: 'client_id,month_number' });
  if (runErr) console.error('[retainer] run row failed:', runErr.message);

  emitFeed('orchestrator', 'RETAINER_SCHEDULED', { client: client.name, next_month: nextMonth, next_run_at: nextRunAt });
  return { ingested: !!reportText, next_month: nextMonth, next_run_at: nextRunAt };
}

/**
 * Start a retainer month run for a client — builds the brief from RAG (previous
 * month's report included — the compounding), creates the workflow, dispatches step 1.
 */
async function startRetainerRun(clientId: string, triggeredBy: string) {
  const { data: client } = await supabase.from('clients').select('id, name, metadata, status').eq('id', clientId).maybeSingle();
  if (!client || client.status !== 'active') return { started: false, reason: 'client not active' };
  const pkg = (client.metadata as any)?.package_key;
  if (!MONTHLY_PACKAGES.has(pkg)) return { started: false, reason: `not monthly (${pkg})` };

  // prevent double-start: any non-completed retainer workflow for this client?
  const { data: existing } = await supabase
    .from('workflows')
    .select('id, name, status')
    .eq('client_id', clientId)
    .neq('status', 'completed')
    .ilike('name', `%Month%`)
    .maybeSingle();
  if (existing) return { started: false, reason: `run already in flight: ${existing.name}` };

  // D5 brief: client + package + branch + top-5 chunks (month-1 report among them).
  // Phase 4: hybrid retrieval keyed to "monthly content plan" — semantically finds
  // the previous monthly report even without keyword overlap.
  const chunks = await hybridRetrieve(`monthly report content plan performance ${client?.name || ''}`, clientId, 5);

  const { data: runRow } = await supabase.from('retainer_runs').select('month_number').eq('client_id', clientId).order('month_number', { ascending: false }).limit(1).maybeSingle();
  const monthNumber = (runRow?.month_number || 1);
  const prevReport = (chunks || []).find((c: any) => c.kind === 'report');

  const preset = PACKAGE_PRESETS[pkg];
  const steps = preset.steps.map((s: any, i: number) => ({
    ...s,
    description: STEP_DESCRIPTIONS[s.name] || s.name.replace(/_/g, ' '),
    status: i === 0 ? 'in_progress' : 'pending',
    started_at: i === 0 ? new Date().toISOString() : null,
  }));
  const wfName = `${preset.name} — ${client.name} — Month ${monthNumber}`;
  const { data: workflow, error: wfErr } = await supabase.from('workflows').insert({
    name: wfName,
    client_id: clientId,
    current_step: steps[0]?.name || null,
    steps_json: steps,
    metadata: { package_key: pkg, retainer_month: monthNumber, has_previous_report: !!prevReport },
  }).select().single();
  if (wfErr) return { started: false, reason: `workflow insert failed: ${wfErr.message}` };

  // Mark run row as running
  await supabase.from('retainer_runs').update({ status: 'running', workflow_id: workflow.id, started_at: new Date().toISOString() })
    .eq('client_id', clientId).eq('month_number', monthNumber);

  emitWorkflow(workflow);
  emitAgentState('orchestrator', 'working', `Month ${monthNumber} retainer: ${client.name}`);
  emitFeed('orchestrator', 'RETAINER_RUN', { client: client.name, month: monthNumber, references_prev_report: !!prevReport });

  // Step 1 via the bridge — brief includes the previous report (compounding)
  const ragCtx = (chunks || []).map((c: any) => `[${c.kind}] ${c.title}: ${String(c.content).slice(0, 400)}`).join('\n---\n');
  const brief = `Client: ${client.name} (${pkg} retainer, month ${monthNumber}).
${prevReport ? `LAST MONTH'S REPORT (build on this — do not repeat it):\n${String(prevReport.content).slice(0, 2000)}` : 'No previous report — first cycle.'}
Knowledge chunks:
${ragCtx}
Task: produce this month's content plan.`;
  executeAgentTask('social', brief, `retainer-m${monthNumber}`, 'content_plan')
    .catch((e: any) => console.error('[retainer] step-1 dispatch failed:', e?.message));

  return { started: true, workflow: wfName, month: monthNumber, references_prev_report: !!prevReport };
}

// POST /api/v1/retainer/run-due — cron/manual trigger: start all due retainer runs
app.post('/api/v1/retainer/run-due', authMiddleware, async (_req, res) => {
  const { data: due } = await supabase
    .from('retainer_runs')
    .select('id, client_id, month_number, next_run_at')
    .eq('status', 'scheduled')
    .lte('next_run_at', new Date().toISOString());
  if (!due || due.length === 0) return res.json({ started: 0, reason: 'no due runs' });

  const results = [];
  for (const run of due) {
    const r = await startRetainerRun(run.client_id, 'retainer-cron');
    results.push({ client_id: run.client_id, month: run.month_number, ...r });
  }
  res.json({ started: results.filter(r => r.started).length, results });
});

// POST /api/v1/retainer/:clientId/start — manual month-start for one client
app.post('/api/v1/retainer/:clientId/start', authMiddleware, async (req, res) => {
  const r = await startRetainerRun(req.params.clientId, 'manual');
  if (!r.started) return res.status(409).json(r);
  res.status(201).json(r);
});

// GET /api/v1/retainer/schedule — the retainer calendar view
app.get('/api/v1/retainer/schedule', authMiddleware, async (_req, res) => {
  const { data, error } = await supabase
    .from('retainer_runs')
    .select('id, client_id, package_key, month_number, status, next_run_at, started_at')
    .order('next_run_at', { ascending: true });
  if (error) return res.status(500).json({ error: `schedule failed: ${error.message} (retainer_runs table is created by migration-v6-retainer.sql)` });
  res.json(data || []);
});

// ============================================================
// PHASE 4 PART 2 — TWO-WAY COMMAND BAR (threads, brainstorm, visible replies)
// Every command opens/extends a thread. Fast path: dispatch + visible
// confirmation. Brainstorm: conversation with orchestrator/HOD, 2-round cap,
// then "Plan ready — delegate karun?" → yes delegates via the bridge.
// ============================================================

// Irreversible/complex verbs → brainstorm mode regardless of Laya confidence
