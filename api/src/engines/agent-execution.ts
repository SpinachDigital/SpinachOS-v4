/*
 * engines/agent-execution.ts — the LLM execution engine (Phase 3 split).
 * From index.ts lines 323–515: AGENT_MODELS, AGENT_SYSTEM_PROMPTS, runAgentTask
 * (breaker-wired), executeAgentTask (persist → dispatch by path → emit),
 * emitTaskLifecycle. No behavior changes.
 */
import {
  supabase, emitAgentState, emitTaskLifecycle,
} from '../ctx';
import { resolvePath, runProfileTask, runSpecialistTask, runGatewayTask } from '../bridge';
import { recordGatewayFailure, recordGatewaySuccess, gatewayBreakerAllows } from '../breaker-telemetry';

export const OMNIROUTE_URL = process.env.OMNIROUTE_URL || 'http://localhost:20128/v1';
export const AGENT_TASK_TIMEOUT_MS = Number(process.env.AGENT_TASK_TIMEOUT_MS || 120000);

export const AGENT_MODELS: Record<string, string> = {
  ceo: 'auto/pro-reasoning',
  cto: 'auto/pro-reasoning',
  orchestrator: 'auto/pro-reasoning',
  research: 'auto/best-reasoning',
  social: 'auto/best-fast',
  sales: 'auto/best-fast',
  seo_specialist: 'auto/best-reasoning',
  engineer: 'auto/pro-coding',
  designer: 'auto/best-chat',
  ops: 'auto/best-fast',
  content: 'auto/best-fast',
  hr: 'auto/best-chat',
};

export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  ceo: 'You are the CEO agent of Spinach Digital. Strategy, packages, final escalation. Max 150 words.',
  cto: 'You are the CTO agent of Spinach Digital. Architecture, engineering standards. Max 150 words.',
  orchestrator: 'You are the Orchestrator of Spinach Digital. Daily coordination, task routing. Max 150 words.',
  research: 'You are the Research agent of Spinach Digital. Sourced findings, every claim has a URL. Max 150 words.',
  social: 'You are the Social agent of Spinach Digital. Founder-voice content (Hinglish 70/30). Max 150 words.',
  sales: 'You are the Sales agent of Spinach Digital. Leads, outreach, follow-ups. Max 150 words.',
  seo_specialist: 'You are the SEO specialist of Spinach Digital. White-hat, baseline-cited. Max 150 words.',
  engineer: 'You are the Engineer of Spinach Digital. Clean, tested code. Max 150 words.',
  designer: 'You are the Designer of Spinach Digital. Brand guardian, SVG-only logos. Max 150 words.',
  ops: 'You are the Ops agent of Spinach Digital. You handle launches, monitoring, and process. Checklist-style, max 150 words.',
};

/** Run a task through the OmniRoute gateway (Hermes model bridge). Returns the model's output text.
 *  P1 Task 4: routed through the same circuit breaker as bridge.ts gateway calls. */
export async function runAgentTask(agent: string, task: string): Promise<{ output: string; model: string }> {
  const model = AGENT_MODELS[agent] || 'auto/best-fast';
  const systemPrompt = AGENT_SYSTEM_PROMPTS[agent] || 'You are a helpful AI company agent. Be concise.';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TASK_TIMEOUT_MS);
  try {
    if (!gatewayBreakerAllows()) throw new Error('circuit open for provider omniroute (retry in ~15 min)');
    const res = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: task },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      recordGatewayFailure();
      throw new Error(`OmniRoute ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const output = data?.choices?.[0]?.message?.content;
    if (!output) { recordGatewayFailure(); throw new Error('OmniRoute returned empty output'); }
    recordGatewaySuccess();
    return { output: String(output), model: data?.model || model };
  } catch (e: any) {
    if (!String(e?.message || '').includes('circuit open')) recordGatewayFailure();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Execute an agent task end-to-end: persist task → dispatch by path → update states → emit events.
 *  v6: path-aware (profile spawn | specialist bench | gateway) via bridge.ts TASK_PATH_MAP.
 *  taskKind: optional hint (strategy/code/logo/ads) — inferred from task text when omitted.
 *  PHASE 3 FIX: inference default is now 'words' → gateway path, NOT 'copy' →
 *  profile-social (a generic command should be a words-only call, not a
 *  random HOD spawn — found during P1 testing). */
export async function executeAgentTask(agent: string, task: string, source: string, taskKind?: string): Promise<string> {
  const t = task.toLowerCase();
  const inferredKind = taskKind ||
    (t.includes('logo') ? 'logo'
      : t.includes('strategy') || t.includes('should we') ? 'strategy'
      : t.includes('website') || t.includes('code') || t.includes('build') || t.includes('fix') ? 'code'
      : t.includes('seo') || t.includes('ranking') || t.includes('gmb') ? 'seo_check'
      : t.includes('competitor') || t.includes('market') ? 'competitor'
      : t.includes('outreach') || t.includes('follow up') || t.includes('proposal') ? 'outreach'
      : t.includes('post') || t.includes('campaign') || t.includes('content') ? 'copy'
      : t.includes('ads') ? 'ads_manage'
      : 'words'); // PHASE 3 FIX: was 'copy' → profile-social; now gateway words-only
  const rule = resolvePath(inferredKind);

  // 1. Persist the task
  // NOTE: tasks.status has a CHECK constraint — allowed: todo, ready, running, review, done, blocked.
  // Agent execution maps: in_progress → 'running', failed → 'blocked' (error detail in metadata).
  const { data: taskRow, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      title: task.slice(0, 120),
      description: task,
      assigned_to: agent,
      status: 'running',
      priority: 2,
      metadata: { source, started_at: new Date().toISOString(), task_kind: inferredKind, path: rule.path },
    })
    .select()
    .single();
  if (taskErr) throw taskErr;

  // 2. Mark agent working + emit (single lifecycle emitter — identical WS for all paths)
  emitTaskLifecycle(taskRow.id, agent, 'running', `Executing: ${task.slice(0, 60)}`, { source, path: rule.path, task_kind: inferredKind });

  // 3. Run the LLM in the background — completion updates DB + emits events
  void (async () => {
    try {
      let output: string, model: string, via: string;
      if (rule.path === 'profile' && rule.profile) {
        const r = await runProfileTask(rule.profile, task);
        output = r.output; model = r.model; via = r.via;
      } else if (rule.path === 'specialist' && rule.bench) {
        const r = await runSpecialistTask(rule.bench, task);
        output = r.output; model = r.model;
        via = `specialist/${rule.bench}`;
      } else {
        const r = await runGatewayTask(agent, task);
        output = r.output; model = r.model;
        via = 'gateway';
      }
      // Failure-sniff the output itself: a profile/gateway call can "succeed"
      // (exit 0) while its text is an error report (e.g. 'Max retries (3)
      // exhausted', 'Rate limited after', 'Final error: HTTP 4xx/5xx').
      // Those must close as blocked, not done — observed: a 404/429-dead run
      // finished 'done' with an error dump as its output.
      const outText = String(output || '');
      const looksLikeError = /max retries \(\d+\) exhausted|rate limited after|final error: http/i.test(outText)
        && outText.length < 4000; // a full deliverable is never this short + matching
      if (looksLikeError) {
        throw new Error(`execution path reported failure: ${outText.slice(0, 200)}`);
      }
      const { data: done, error: upErr } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          progress: 100,
          metadata: { source, model, output, via, completed_at: new Date().toISOString(), task_kind: inferredKind, path: rule.path },
        })
        .eq('id', taskRow.id)
        .select()
        .single();
      if (upErr) throw upErr;
      emitAgentState(agent, 'idle', `Completed: ${task.slice(0, 50)}`);
      emitTaskLifecycle(taskRow.id, agent, 'done', `Completed: ${task.slice(0, 50)}`, { task_id: taskRow.id, model, via });
    } catch (e: any) {
      // Failed runs: mark task blocked + agent blocked, emit for visibility
      // ('failed' not allowed by tasks_status_check — 'blocked' + metadata.error carries the detail)
      const viaAtFailure = rule.path === 'profile' && rule.profile ? `hermes/${rule.profile}`
        : rule.path === 'specialist' && rule.bench ? `specialist/${rule.bench}` : 'gateway';
      await supabase
        .from('tasks')
        .update({
          status: 'blocked',
          metadata: { source, via: viaAtFailure, error: String(e?.message || 'unknown').slice(0, 500), failed_at: new Date().toISOString(), task_kind: inferredKind, path: rule.path },
        })
        .eq('id', taskRow.id);
      emitAgentState(agent, 'blocked', `Failed: ${String(e?.message || '').slice(0, 50)}`);
      emitTaskLifecycle(taskRow.id, agent, 'blocked', `Failed: ${String(e?.message || '').slice(0, 60)}`, { task_id: taskRow.id, error: String(e?.message || '').slice(0, 200) });
    }
  })();

  return taskRow.id;
}
