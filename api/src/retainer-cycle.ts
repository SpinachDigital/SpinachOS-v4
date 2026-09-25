/*
 * retainer-cycle.ts — closeRetainerCycle (Phase 3 split).
 */
const MONTHLY_PACKAGES = new Set(['growth', 'scale']);
/*
 * retainer-cycle.ts — closeRetainerCycle (Phase 3 split, index.ts L2124–2191).
 * Closes a retainer month cycle: ingests the monthly report into RAG + schedules next month.
 */
import { supabase, emitFeed, emitWorkflow, emitTaskLifecycle } from './ctx';

export async function closeRetainerCycle(workflow: any, steps: any[]) {
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

