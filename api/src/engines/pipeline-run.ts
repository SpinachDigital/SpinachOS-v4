/*
 * engines/pipeline-run.ts — Phase 3 monolith split (from index.ts L4053–4275).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
async function buildStepPrompt(workflow: any, step: any, client: any): Promise<string> {
  let ragCtx = '';
  if (client?.id) {
    // Phase 4: hybrid retrieval (semantic + lexical, RRF) keyed to the step —
    // the one retrieval primitive, client-isolated. Lexical-only path deleted.
    const chunks = await hybridRetrieve(`${step.name} ${step.description || ''} ${client?.goal || ''}`, client.id, 5);
    ragCtx = (chunks || []).map((c: any) => `[${c.kind}] ${c.title}: ${String(c.content).slice(0, 400)}`).join('\n---\n');
  }
  const pkg = (client?.metadata as any)?.package_key || 'unknown';
  const hasLogo = (client?.metadata as any)?.has_logo;
  return `CLIENT: ${client?.name || 'Unknown'} (${pkg} package${hasLogo !== undefined ? `, has_logo=${hasLogo}` : ''}).
GOAL: ${client?.goal || 'n/a'}.
BRAND BRANCH: ${hasLogo ? 'Client has a logo — extract DNA from it, match its style.' : 'No logo — code-drawn SVG only, create fresh DNA.'}
${ragCtx ? `KNOWLEDGE:\n${ragCtx}` : 'No prior knowledge chunks.'}

WORKFLOW: ${workflow.name} — you are executing ONE step: "${step.name}" (${step.description || step.name}).
Produce the deliverable for this step only. Concise, complete, no placeholders.`;
}

/**
 * runHodQa — HOD QA gate (D1 step 6): the HOD reviews the step output against
 * their department standard. Returns { verdict: 'approved_HOD' | 'rework', notes }.
 * Rework loops capped at 2 (D4) by the caller.
 */
async function runHodQa(stepName: string, client: any, stepOutput: string): Promise<{ verdict: 'approved_HOD' | 'rework'; notes: string }> {
  const hod = QA_OWNER[stepName];
  if (!hod) return { verdict: 'approved_HOD', notes: 'no QA owner — auto-pass' };

  const qaPrompt = `You are the ${hod} HOD doing QA review of a deliverable produced for client "${client?.name}".
STEP: ${stepName}. Check it against department standards${hod === 'designer' ? ' (brand DNA match, spacing, hierarchy — SVG-only for logos)' : hod === 'engineer' ? ' (clean, tested, deployable)' : ''}.
DELIVERABLE:
"""
${String(stepOutput).slice(0, 3000)}
"""
Reply with EXACTLY one line, first word APPROVED or REWORK:
- APPROVED if it meets the standard (add one sentence why)
- REWORK if it violates the standard (add what must change)`;
  const { output } = await runGatewayTask(hod, qaPrompt);
  const text = String(output || '').trim();
  const approved = /^APPROVED/i.test(text);
  return { verdict: approved ? 'approved_HOD' : 'rework', notes: text.slice(0, 400) };
}

/**
 * runPipeline — executes a workflow end-to-end through the bridge.
 * For each step: dispatch (bridge) → QA gate if deliverable → rework (max 2)
 * → at 'approve' step create a director approval and PAUSE the pipeline
 * (nothing publishes/delivers without it). 'deliver' runs only post-approval.
 */
async function runPipeline(workflowId: string): Promise<{ completed: boolean; pausedAt: string | null; error?: string }> {
  const runKey = `wf:${workflowId}`;
  if (runningPipelines.has(runKey)) return { completed: false, pausedAt: null, error: 'already running' };
  runningPipelines.add(runKey);
  try {
    const { data: workflow, error } = await supabase.from('workflows').select('*').eq('id', workflowId).single();
    if (error || !workflow) return { completed: false, pausedAt: null, error: 'workflow not found' };
    if (workflow.status === 'completed' || workflow.status === 'paused') {
      return { completed: workflow.status === 'completed', pausedAt: workflow.status === 'paused' ? workflow.current_step : null };
    }

    let { data: client } = client_id_exists(workflow)
      ? await supabase.from('clients').select('*').eq('id', workflow.client_id).maybeSingle()
      : { data: null as any };

    let steps: any[] = Array.isArray(workflow.steps_json) ? [...workflow.steps_json] : [];

    // resume: skip steps already completed
    let idx = steps.findIndex(s => s.status !== 'completed');
    if (idx < 0) idx = steps.length;

    while (idx < steps.length) {
      const step = steps[idx];
      emitAgentState(step.agent, 'working', `${step.name} — ${workflow.name}`);
      emitFeed('orchestrator', 'PIPELINE_STEP', { workflow: workflow.name, step: step.name, agent: step.agent });
      void warRoomPost(workflow.id, workflow.name, step.agent, `Delegating step "${step.name}" — brief sent, executing.`, { step: step.name });
      emitWorkflow({ id: workflow.id, current_step: step.name, status: 'active' });

      // ---- the 'approve' step: create director approval and PAUSE ----
      if (step.name === 'approve') {
        const { data: approval, error: apErr } = await supabase.from('approvals').insert({
          client_id: workflow.client_id || null,
          type: mapApprovalType(workflow, steps),
          title: `Pipeline approval: ${workflow.name}`,
          description: `Director gate for workflow "${workflow.name}". Approving unblocks delivery.`,
          payload_json: {
            workflow_id: workflow.id,
            completed_steps: steps.filter(s => s.status === 'completed').map(s => s.name),
            step_outputs: collectStepOutputs(steps),
          },
          status: 'pending',
          requested_by: 'orchestrator',
          metadata: { workflow_id: workflow.id, phase2: true },
        }).select().single();
        if (apErr) throw new Error(`approval insert failed: ${apErr.message}`);
        emitApproval({ ...approval, action: 'created' });
        emitFeed('orchestrator', 'PIPELINE_PAUSED', { workflow: workflow.name, reason: 'awaiting director approval', approval_id: approval.id });
        void warRoomPost(workflow.id, workflow.name, 'orchestrator', 'Pipeline paused — director approval needed before delivery.', { approval_id: approval.id });
        await persistSteps(workflowId, steps, step.name, 'paused');
        return { completed: false, pausedAt: 'approve' };
      }

      // ---- normal step: execute via bridge ----
      const prompt = await buildStepPrompt(workflow, step, client);
      let output = '';
      let reworkCount = 0;
      let qaVerdict: 'approved_HOD' | 'rework' = 'approved_HOD';
      let qaNotes = '';

      while (true) {
        const kind = stepKindFor(step.name);
        output = await dispatchStep(step, prompt + (reworkCount > 0 ? `\n\nREWORK #${reworkCount} — previous attempt failed QA: ${qaNotes}. Fix and resubmit.` : ''), client);
        if (!QA_GATE_STEPS.has(step.name)) { break; }
        const qa = await runHodQa(step.name, client, output);
        qaVerdict = qa.verdict; qaNotes = qa.notes;
        if (qaVerdict === 'approved_HOD') { break; }
        reworkCount++;
        emitFeed(QA_OWNER[step.name] || 'orchestrator', 'QA_REWORK', { workflow: workflow.name, step: step.name, cycle: reworkCount, notes: qaNotes.slice(0, 200) });
        void warRoomPost(workflow.id, workflow.name, QA_OWNER[step.name] || 'orchestrator', `QA REWORK on "${step.name}" (cycle ${reworkCount}): ${qaNotes.slice(0, 150)}`, { step: step.name, qa: 'rework' });
        if (reworkCount >= 2) {
          // D4: escalate after 2 failed cycles — move to orchestrator, log, continue
          emitFeed('orchestrator', 'QA_ESCALATED', { workflow: workflow.name, step: step.name, reason: 'rework cap (2) exceeded' });
          break;
        }
      }

      steps[idx] = { ...step, status: 'completed', completed_at: new Date().toISOString(), output: String(output).slice(0, 8000), qa_verdict: qaVerdict, qa_notes: qaNotes.slice(0, 500), rework_cycles: reworkCount };

      // ingest approved deliverables to RAG (client-scoped) — D1 step 10 LEARN
      if (client?.id && output && QA_GATE_STEPS.has(step.name) && qaVerdict === 'approved_HOD') {
        void supabase.from('knowledge_chunks').insert({
          client_id: client.id, scope: 'client', kind: 'asset',
          title: `${step.name} — ${client.name}`,
          content: String(output).slice(0, 6000),
          source: `workflow:${workflow.id}`,
          metadata: { workflow_id: workflow.id, step: step.name },
        }).then(({ error: rErr }) => { if (rErr) console.error('[pipeline] RAG ingest failed:', rErr.message); });
      }

      // persist after every step (crash-safe)
      const progress = Math.round((steps.filter(s => s.status === 'completed').length / steps.length) * 100);
      await persistSteps(workflowId, steps, steps[idx + 1]?.name || null, 'active', progress);
      idx++;
    }

    // all steps done
    await persistSteps(workflowId, steps, null, 'completed', 100);
    emitFeed('orchestrator', 'PIPELINE_COMPLETED', { workflow: workflow.name, steps: steps.length });
    void warRoomPost(workflow.id, workflow.name, 'orchestrator', `Pipeline completed — ${steps.length} steps delivered.`, { final: true });
    emitWorkflow({ id: workflow.id, status: 'completed', progress: 100 });
    void closeRetainerCycle(workflow, steps).catch((e: any) => console.error('[pipeline] retainer close failed:', e?.message));
    return { completed: true, pausedAt: null };
  } catch (e: any) {
    console.error('[pipeline] run failed:', e?.message);
    return { completed: false, pausedAt: null, error: e?.message };
  } finally {
    runningPipelines.delete(runKey);
  }
}

// helpers for runPipeline
function client_id_exists(wf: any): boolean { return !!wf.client_id; }
function mapApprovalType(workflow: any, steps: any[]): 'content' | 'design' | 'code' | 'strategy' {
  const name = String(workflow.name || '').toLowerCase();
  if (name.includes('brand') || steps.some(s => s.name.includes('logo') || s.name.includes('guidelines'))) return 'design';
  if (name.includes('launch') || steps.some(s => s.name === 'website')) return 'code';
  if (name.includes('growth') || name.includes('scale')) return 'content';
  return 'strategy';
}
function collectStepOutputs(steps: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of steps) if (s.status === 'completed' && s.output) out[s.name] = String(s.output).slice(0, 1500);
  return out;
}
async function persistSteps(workflowId: string, steps: any[], currentStep: string | null, status: string, progress?: number) {
  const pct = progress ?? Math.round((steps.filter(s => s.status === 'completed').length / Math.max(steps.length, 1)) * 100);
  const { error } = await supabase.from('workflows')
    .update({ steps_json: steps, current_step: currentStep, status, progress: pct })
    .eq('id', workflowId);
  if (error) console.error('[pipeline] persist failed:', error.message);
}
function stepKindFor(stepName: string): string {
  const map: Record<string, string> = {
    logo_design: 'logo', guidelines: 'guidelines', dna_extract: 'brand_qa',
    website: 'code', build: 'code', strategy: 'strategy',
    content: 'copy', content_plan: 'content_cal', content_creation: 'copy',
    design_assets: 'logo', ads_manage: 'ads_manage', monthly_report: 'market',
    seo_setup: 'seo_check', seo_check: 'seo_check', gmb: 'gmb',
    intake: 'breakdown', classify: 'breakdown', hod_qa: 'brand_qa', deliver: 'copy',
  };
  return map[stepName] || 'copy';
}
async function dispatchStep(step: any, prompt: string, client: any): Promise<string> {
  // route via the SAME data-driven path map the rest of the system uses
  const rule = resolvePath(stepKindFor(step.name));
  try {
    if (rule.path === 'profile' && rule.profile) {
      const r = await runProfileTask(rule.profile, prompt);
      return r.output;
    }
    if (rule.path === 'specialist' && rule.bench) {
      const r = await runSpecialistTask(rule.bench, prompt);
      return r.output;
    }
    const r = await runGatewayTask(step.agent || 'orchestrator', prompt);
    return r.output;
  } catch (e: any) {
    return `[step failed: ${e?.message}]`;
  }
}

// ============================================================
// PHASE 4 PART 4 — SOCIAL AUTOMATION (two brands, founder-gated)
// One engine, two voices: spinach (company, "we") + abhishek (personal,
// first-person Hinglish). NOTHING posts without founder approval —
// automation ends at 'scheduled-ready'; publish is his tap.
// ============================================================

const BRAND_VOICES: Record<string, string> = {
  spinach: `You write for SPINACH LABS (company account). Voice: agency positioning, confident but not hype-y, always "we" — never first-person singular. Pillars: Thinking, Systems, People, Impact. Plain, concrete, no buzzwords.`,
  abhishek: `You write as ABHISHEK JHA (founder's personal account). Voice: builder journey, first-person, Hinglish 70/30 (natural Roman-script Hindi mixed with English), zero cringe, zero hype. Pillars: building, lessons, systems, behind-scenes. Would the founder actually say this out loud? If not, rewrite.`,
};

// POST /api/v1/social/plan-week — generate a 7-day calendar for both brands (14 slots)
