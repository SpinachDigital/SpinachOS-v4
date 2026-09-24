/*
 * Spinach OS v6 — Execution Bridge (Part 1 foundation)
 *
 * Three execution paths, one lifecycle emitter — identical WS events regardless
 * of path (frontend never knows the difference, by construction):
 *
 *   1. PROFILE   — real Hermes profile spawn (gateway text call is fallback)
 *   2. SPECIALIST — on-demand bench specialist (gateway call with bench soul)
 *   3. GATEWAY   — tiered text-only call (words-only tasks)
 *
 * Path decision is DATA-DRIVEN via TASK_PATH_MAP — adding a dormant department
 * is a config row, not a code change.
 */

import { execFile } from 'child_process';

// ============================================
// TASK_PATH_MAP — data-driven path decision
// ============================================

export type TaskPath = 'profile' | 'specialist' | 'gateway';

export interface PathRule {
  path: TaskPath;
  profile?: string;      // for 'profile' path
  bench?: string;        // for 'specialist' path
  dormant?: boolean;     // dormant dept — auto-activates on first matching task
  workspace?: boolean;   // task needs the real world (fetch/scrape/spend/deploy)
}

export const TASK_PATH_MAP: Record<string, PathRule> = {
  // Real Hermes profiles (Tier 1 leadership + Tier 2 HODs)
  strategy:    { path: 'profile', profile: 'ceo' },
  architecture:{ path: 'profile', profile: 'cto' },
  breakdown:   { path: 'profile', profile: 'orchestrator' },
  standup:     { path: 'profile', profile: 'orchestrator' },
  code:        { path: 'profile', profile: 'engineer' },
  deploy:      { path: 'profile', profile: 'engineer', workspace: true },
  review_code: { path: 'profile', profile: 'engineer' },
  brand_qa:    { path: 'profile', profile: 'designer' },
  logo:        { path: 'profile', profile: 'designer' },
  content_cal: { path: 'profile', profile: 'social' },
  copy:        { path: 'profile', profile: 'social' },
  seo_check:   { path: 'profile', profile: 'seo_specialist' },
  gmb:         { path: 'profile', profile: 'seo_specialist' },
  competitor:  { path: 'profile', profile: 'research' },
  market:      { path: 'profile', profile: 'research' },
  outreach:    { path: 'profile', profile: 'sales' },
  proposal:    { path: 'profile', profile: 'sales' },
  followup:    { path: 'profile', profile: 'sales' },

  // Dormant department — auto-activates on first matching task/client
  ads_manage:  { path: 'profile', profile: 'ads_manager', dormant: true },
  ads_spend:   { path: 'profile', profile: 'ads_manager', dormant: true, workspace: true },
  ads_creative:{ path: 'specialist', bench: 'paid_media', dormant: true },

  // On-demand bench specialists (Tier 3)
  deck:        { path: 'specialist', bench: 'design' },
  guidelines:  { path: 'specialist', bench: 'design' },
  frontend:    { path: 'specialist', bench: 'engineering' },
  backend:     { path: 'specialist', bench: 'engineering' },
  qa:          { path: 'specialist', bench: 'engineering' },
  automation:  { path: 'specialist', bench: 'engineering' },
  calendar:    { path: 'specialist', bench: 'marketing' },
  community:   { path: 'specialist', bench: 'marketing' },
  tech_seo:    { path: 'specialist', bench: 'seo' },
  sdr:         { path: 'specialist', bench: 'sales' },
  lead_research:{ path: 'specialist', bench: 'research' },
  finance:     { path: 'specialist', bench: 'flat' },
  legal:       { path: 'specialist', bench: 'flat' },
};

// Bench soul template (Part C executive template)
export const BENCH_SOUL_TEMPLATE = (role: string, dept: string, output: string) =>
  `You are a ${role} specialist in Spinach Labs' ${dept} department, reporting to the ${dept} HOD. ` +
  `Produce ${output} to the HOD's QA checklist. If the brief is ambiguous, ask ONE clarifying question — don't guess. ` +
  `If you can't meet the standard, say so and escalate; never ship mediocre quietly.`;

export const BENCH_OUTPUTS: Record<string, { role: string; output: string }> = {
  design:      { role: 'design', output: 'visual specs per the brief' },
  engineering: { role: 'engineer', output: 'working code or concrete implementation steps' },
  marketing:   { role: 'copywriter', output: 'founder-voice copy (Hinglish 70/30, no hype)' },
  paid_media:  { role: 'media buyer', output: 'campaign specs with CPA/ROAS targets' },
  seo:         { role: 'SEO', output: 'white-hat recommendations citing baselines' },
  research:    { role: 'analyst', output: 'sourced findings — every claim has a URL' },
  sales:       { role: 'SDR', output: 'personalized outreach sequences' },
  flat:        { role: 'specialist', output: 'the requested deliverable' },
};

// ============================================
// EXECUTE VIA REAL HERMES PROFILE
// ============================================

const HERMES_EXE = process.env.HERMES_EXE || 'hermes';
const PROFILE_TIMEOUT_MS = parseInt(String(process.env.PROFILE_TIMEOUT_MS)) || 240000; // 4 min

/**
 * Run a task through a REAL Hermes profile (subprocess spawn with --profile flag).
 * This is the "brain wired to body" path — the profile's SOUL.md, memory, and
 * tools are all live. Falls back to gateway call if spawn fails.
 */
export async function runProfileTask(
  profile: string,
  task: string,
): Promise<{ output: string; model: string; via: 'profile' | 'gateway-fallback' }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

  try {
    const output: string = await new Promise((resolve, reject) => {
      // hermes -p <profile> chat -q "<task>" — non-interactive, no PTY needed
      execFile(
        HERMES_EXE,
        ['-p', profile, 'chat', '-q', task],
        { timeout: PROFILE_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err && !stdout) return reject(err);
          const text = String(stdout || '').trim();
          if (!text) return reject(new Error(stderr || 'empty profile output'));
          resolve(text);
        },
      );
    });
    return { output, model: `hermes/${profile}`, via: 'profile' };
  } catch (e: any) {
    // Profile spawn failed (CLI missing, profile missing, timeout) → gateway fallback.
    // P1 Task 5: every fallback is now a recorded event (visible in /models/fallback-log).
    console.error(`[bridge] profile spawn failed for ${profile}:`, e?.message);
    // P1 Task 5: record the fallback BEFORE attempting it — the fallback itself
    // may also fail (dead gateway), and the event must still be in the log.
    recordFallback(`hermes/profile:${profile}`, `omni:${GATEWAY_MODEL_BY_PROFILE[profile] || 'auto/best-fast'}`, `profile spawn failed: ${String(e?.message || 'unknown').slice(0, 120)}`);
    const gw = await runGatewayTask(profile, task);
    return { ...gw, via: 'gateway-fallback' };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// GATEWAY CALL (tiered, words-only + fallback)
// ============================================

// P1 Task 9: default now includes /v1 — the gateway call posts to
// `${OMNIROUTE_URL}/chat/completions`, so without /v1 the default config
// 404s/401s and every fallback silently fails.
const OMNIROUTE_URL = process.env.OMNIROUTE_URL || 'http://localhost:20128/v1';
const AGENT_TASK_TIMEOUT_MS = parseInt(String(process.env.AGENT_TASK_TIMEOUT_MS)) || 60000;

import { breakerFor, breakerAllows, recordFailure, recordSuccess, recordFallback, getBreakerStates, getFallbackLog } from './breaker-telemetry';
export { getBreakerStates, getFallbackLog, recordFallback };
// Import AGENT_MODELS + prompts from the main module's values — re-declared here to
// keep this module self-contained (the main file passes its own fallbacks anyway).
const GATEWAY_MODEL_BY_PROFILE: Record<string, string> = {
  ceo: 'auto/pro-reasoning',
  cto: 'auto/pro-reasoning',
  orchestrator: 'auto/pro-reasoning',
  engineer: 'auto/pro-coding',
  designer: 'auto/best-chat',
  social: 'auto/best-fast',
  seo_specialist: 'auto/best-reasoning',
  research: 'auto/best-reasoning',
  sales: 'auto/best-fast',
  ads_manager: 'auto/pro-reasoning',
};

export const PROFILE_SOULS: Record<string, string> = {
  ceo: 'You are the owner of Spinach Labs. Calm strategist, thinks in quarters not days. Every decision filtered through: does this grow the business or protect it? Never chases vanity metrics. Escalation: only what HODs cannot resolve. Max 200 words.',
  cto: 'You are the systems thinker of Spinach Labs. Hates fragile hacks; every build must survive 100 clients. Reviews engineering output. Mantra: boring technology, exciting results. Blocks anything that creates midnight pages. Max 200 words.',
  orchestrator: 'You are the chief of staff of Spinach Labs. Crisp, deadline-driven, zero fluff. You are the founder\u2019s single front door — he talks to you for reports, status, strategy, or anything unclear; you pull in ceo/cto/HODs as needed and return one clean answer. Routes, doesn\u2019t solve — pushes problems to the right HOD with a deadline. Max 200 words.',
  designer: 'You are the brand guardian of Spinach Labs. Typography-obsessed; nothing leaves the dept that violates a client\u2019s brand DNA. Voice: precise, visual, opinionated. Rule: AI image generation is BANNED for logos and text — code-drawn SVG only. Max 200 words.',
  engineer: 'You are the shipper of Spinach Labs. Clean code, tested, deployed. Reviews every specialist\u2019s code before it merges. Stack opinions allowed, rewrites not — solve the client\u2019s problem, not your curiosity. Owns staging \u2192 production discipline. Max 200 words.',
  social: 'You are the founder\u2019s voice of Spinach Labs. Writes like Abhishek: Hinglish 70/30, builder tone, zero cringe, zero hype. Every post must pass: would the founder actually say this? Owns the content calendar; never auto-posts — everything waits in the approval queue. Max 150 words.',
  ads_manager: 'You are the numbers brain of Spinach Labs. ROAS-obsessed, kills losers fast, scales winners faster. Daily 8 AM: spend check across all active campaigns, flag anomalies >20% CPA drift. Never spends a rupee without a tracking pixel firing. Reports in numbers, not adjectives. Max 150 words.',
  seo_specialist: 'You are the patient compounder of Spinach Labs. White-hat only; plays the long game. Weekly: rankings snapshot, GMB health, review count. Every recommendation cites the baseline it moves. Max 200 words.',
  research: 'You are the evidence desk of Spinach Labs. Source dikhao. No claim without a URL. Weekly opportunity digest (Mon 9 AM) + midweek changes (Wed 10 AM); add per-client competitor watch when a retainer client exists. Max 200 words.',
  sales: 'You are the relationship holder of Spinach Labs. Remembers every lead: last touch, temperature, objection. Follow-up sequences never die silently — they escalate to the founder with context. Never desperate, never pushy; we sell outcomes, not hours. Max 150 words.',
};

async function runGatewayTask(profile: string, task: string): Promise<{ output: string; model: string }> {
  const model = GATEWAY_MODEL_BY_PROFILE[profile] || 'auto/best-fast';
  const soul = PROFILE_SOULS[profile] || BENCH_SOUL_TEMPLATE('specialist', 'operations', 'the requested deliverable');
  const b = breakerFor('omniroute');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TASK_TIMEOUT_MS);
  try {
    if (!breakerAllows(b)) throw new Error('circuit open for provider omniroute (retry after 15 min)');
    const res = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: soul },
          { role: 'user', content: task },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      recordFailure(b);
      throw new Error(`OmniRoute ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const output = data?.choices?.[0]?.message?.content;
    if (!output) { recordFailure(b); throw new Error('OmniRoute returned empty output'); }
    recordSuccess(b);
    return { output: String(output), model: data?.model || model };
  } catch (e: any) {
    if (!String(e?.message || '').includes('circuit open')) recordFailure(b);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// SPECIALIST CALL (bench)
// ============================================

export async function runSpecialistTask(
  bench: string,
  task: string,
): Promise<{ output: string; model: string }> {
  const spec = BENCH_OUTPUTS[bench] || BENCH_OUTPUTS.flat;
  const soul = BENCH_SOUL_TEMPLATE(spec.role, bench, spec.output);
  const model = bench === 'engineering' || bench === 'paid_media' ? 'auto/pro-coding' : 'auto/best-fast';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TASK_TIMEOUT_MS);
  try {
    const res = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: soul },
          { role: 'user', content: task },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OmniRoute ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const output = data?.choices?.[0]?.message?.content;
    if (!output) throw new Error('OmniRoute returned empty output');
    return { output: String(output), model: data?.model || model };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// UNIFIED DISPATCHER — decides path, runs, returns
// ============================================

export interface DispatchResult {
  task_id: string;
  agent: string;
  path: TaskPath;
  via: string;
  model?: string;
}

export function resolvePath(taskKind: string): PathRule {
  if (TASK_PATH_MAP[taskKind]) return TASK_PATH_MAP[taskKind];
  // Prefix match for kinds like 'ads_creative_v2'
  const prefixKey = Object.keys(TASK_PATH_MAP).find(k => taskKind.startsWith(k));
  if (prefixKey) return TASK_PATH_MAP[prefixKey];
  // Default: words-only gateway call
  return { path: 'gateway' };
}

export {
  runGatewayTask,
};
