/*
 * routes/pipeline.ts — Phase 3 monolith split (from index.ts L2021–2115).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { closeRetainerCycle } from '../retainer-cycle';

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitAgentState, emitFeed, emitWorkflow, supabase } from '../ctx';
app.post('/api/v1/pipeline/advance', authMiddleware, async (req, res) => {
  try {
    const { workflow_id, step_name } = req.body;
    if (!workflow_id || !step_name) return res.status(400).json({ error: 'workflow_id and step_name required' });

    // 1. Get current workflow
    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflow_id)
      .single();
    if (wfError) throw wfError;

    const steps = workflow.steps_json || [];
    const stepIndex = steps.findIndex((s: any) => s.name === step_name);

    if (stepIndex < 0) return res.status(404).json({ error: 'Step not found' });

    // SEQUENCE ENFORCEMENT: all steps BEFORE this one must be completed
    const earlierIncomplete = steps.slice(0, stepIndex).filter((s: any) => s.status !== 'completed');
    if (earlierIncomplete.length > 0) {
      return res.status(409).json({
        error: 'Steps out of order',
        detail: `Cannot advance "${step_name}" — ${earlierIncomplete.length} earlier step(s) not completed: ${earlierIncomplete.map((s: any) => s.name).join(', ')}`,
      });
    }

    // 2. Mark current step as completed
    const updatedSteps = [...steps];
    updatedSteps[stepIndex].status = 'completed';
    updatedSteps[stepIndex].completed_at = new Date().toISOString();

    // 3. Find next pending step (in ORDER, after the completed one)
    const nextPending = updatedSteps.findIndex((s: any, i: number) => i > stepIndex && s.status === 'pending');

    if (nextPending >= 0) {
      // Mark next step as in_progress
      updatedSteps[nextPending].status = 'in_progress';
      updatedSteps[nextPending].started_at = new Date().toISOString();

      const progress = Math.round((updatedSteps.filter((s: any) => s.status === 'completed').length / updatedSteps.length) * 100);

      await supabase
        .from('workflows')
        .update({ steps_json: updatedSteps, current_step: updatedSteps[nextPending].name, progress })
        .eq('id', workflow_id);

      // Emit workflow update with agent state
      const agentMap: any = {
        ceo: 'CEO', cto: 'CTO', research: 'Research', social: 'Social',
        sales: 'Sales', content: 'Content', design: 'Design', engineering: 'Engineering', ops: 'Ops'
      };
      const agentName = agentMap[updatedSteps[nextPending].agent] || updatedSteps[nextPending].agent;

      emitAgentState(agentName.toLowerCase(), 'working', `Executing: ${updatedSteps[nextPending].description}`);
      emitWorkflow({ id: workflow.id, current_step: updatedSteps[nextPending].name, progress, status: 'active' });

      res.json({ success: true, next_step: updatedSteps[nextPending].name, progress, agent: agentName });
    } else {
      // All steps completed - mark workflow complete
      // NOTE: workflows table has no completed_at column (schema never defined it) —
      // including it caused PGRST204 which was silently ignored (no .select() chain).
      const { error: completeError } = await supabase
        .from('workflows')
        .update({ status: 'completed', progress: 100, current_step: null, steps_json: updatedSteps })
        .eq('id', workflow_id);
      if (completeError) throw completeError;  // surface DB errors — never silent

      emitFeed('orchestrator', 'Pipeline completed', {
        workflow_id,
        client_id: workflow.client_id,
        completed_steps: updatedSteps.length,
      });
      emitAgentState('ceo', 'idle', 'Pipeline complete - ready for new client');

      // D2 RETAINER LOOP — on pipeline completion, if this client is on a monthly
      // package: (a) auto-ingest the final report to RAG, (b) schedule next month's run.
      void closeRetainerCycle(workflow, updatedSteps).catch((e: any) =>
        console.error('[retainer] close cycle failed:', e?.message));

      res.json({ success: true, completed: true, message: 'Pipeline completed successfully' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// PART D2 — RETAINER LOOP (growth/scale, monthly compounding)
// Day-1 09:00 IST auto-run: content_plan → content_creation → design_assets
// → seo_check → (ads_manage for scale) → monthly_report → approve → deliver.
// Previous month's report is RAG context for the next plan.
// ============================================================

// Which packages are monthly retainers
