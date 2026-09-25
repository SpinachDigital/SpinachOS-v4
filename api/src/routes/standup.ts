/*
 * routes/standup.ts — Phase 3 monolith split (from index.ts L1898–2020).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitAgentState, emitApproval, emitFeed, supabase } from '../ctx';
app.post('/api/v1/daily-standup', authMiddleware, async (req, res) => {
  try {
    const { job_key } = req.body;
    if (!job_key) return res.status(400).json({ error: 'job_key required' });

    // 1. Create daily run record
    const { data: run, error: runError } = await supabase
      .from('daily_runs')
      .insert({ job_key, run_date: new Date().toISOString().split('T')[0], status: 'running' })
      .select()
      .single();
    if (runError) throw runError;

    // 2. Get all active clients with open pipelines
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'active');
    if (clientsError) throw clientsError;

    // 3. For each client, check workflow progress and auto-create approvals where needed
    const approvalsCreated = [];
    for (const client of clients) {
      const { data: workflows, error: workflowsError } = await supabase
        .from('workflows')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (workflowsError) continue;

      for (const workflow of workflows) {
        const steps = workflow.steps_json || [];
        const pendingStep = steps.find(s => s.status === 'pending');
        if (!pendingStep) continue;

        // Auto-create approval for pending approval_review step
        if (pendingStep.agent === 'orchestrator' || pendingStep.name.includes('approval')) {
          const existingApproval = await supabase
            .from('approvals')
            .select('*')
            .eq('client_id', client.id)
            .eq('type', 'strategy')
            .single();

          if (!existingApproval.data) {
            const { data: approval, error: approvalError } = await supabase
              .from('approvals')
              .insert({
                client_id: client.id,
                type: 'strategy',
                title: `Strategy approval for ${client.name}`,
                description: `Review and approve growth strategy for ${client.name}`,
                payload_json: { workflow_id: workflow.id, step: pendingStep.name },
                platform: 'internal',
                status: 'pending',
                requested_by: 'orchestrator',
              })
              .select()
              .single();
            if (approvalError) throw approvalError;
            approvalsCreated.push(approval.data.id);
            emitApproval({ ...approval.data, action: 'created' });
          }
        }

        // Mark step as in_progress if still pending
        const updatedSteps = steps.map(step =>
          step.status === 'pending' && step.name === pendingStep.name
            ? { ...step, status: 'in_progress', started_at: new Date().toISOString() }
            : step
        );

        await supabase
          .from('workflows')
          .update({ steps_json: updatedSteps, progress: 10, current_step: pendingStep.name })
          .eq('id', workflow.id);
      }
    }

    // 4. Emit daily standup feed entry
    emitFeed('orchestrator', 'Daily standup completed', {
      job_key,
      clients_processed: clients.length,
      approvals_created: approvalsCreated.length,
    });

    // 5. Update agent states — SEPARATE upserts (chained .upsert() is invalid supabase-js:
    // only the first executes; the rest no-op silently) + errors surfaced
    const standupStates = [
      { profile: 'ceo', state: 'working', activity: 'Daily standup completed' },
      { profile: 'research', state: 'working', activity: 'Monitoring daily sources' },
      { profile: 'sales', state: 'working', activity: 'Lead generation active' },
      { profile: 'content', state: 'working', activity: 'Drafting content' },
      { profile: 'design', state: 'working', activity: 'Creating assets' },
      { profile: 'engineering', state: 'working', activity: 'Build updates' },
      { profile: 'ops', state: 'working', activity: 'System monitoring' },
    ];
    for (const s of standupStates) {
      const { error: stateErr } = await supabase.from('agent_states').upsert(s);
      if (stateErr) console.error('Standup state upsert failed:', s.profile, stateErr.message);
      emitAgentState(s.profile, s.state, s.activity);
    }

    res.json({ success: true, run, approvals_created: approvalsCreated.length, clients_processed: clients.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/daily-runs', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('daily_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

