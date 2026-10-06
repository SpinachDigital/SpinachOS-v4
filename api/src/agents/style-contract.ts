/**
 * api/src/agents/style-contract.ts — Phase 6 GOAL 1, Phase A.
 *
 * Spec: agent-output-style-system-spec.md §1–§2 + §7 Phase A + §8 latency law.
 * (Spec file not present in repo/Downloads at implementation time — the
 * contract text below implements the rules as stated in the Phase 6 prompt,
 * verbatim from the prompt's §GOAL 1. Documented in the report.)
 *
 * LAWS (§8): prompt text ONLY. No LLM calls, no async work, no network —
 * zero latency impact on any render path. Injection happens at prompt
 * build time in the gateway (bridge.ts), which already runs before the
 * model call.
 */

export type StyleTier = 'T0' | 'T1' | 'T2';

/** The core contract — exact rules, plain direct English. */
export const STYLE_CONTRACT = `OUTPUT STYLE CONTRACT — follow exactly.

Write plain, direct English. One idea per sentence. Keep sentences under 15 words.
Say the important thing first.

Do not use praise adjectives (amazing, incredible, fantastic, revolutionary, game-changing, seamless, robust, powerful).
Do not hedge (might, perhaps, arguably, it seems, I think, sort of).
Do not throat-clear (Great question, Let me, Here's the thing, As you can see, In this fast-paced world).
Give numbers instead of adjectives. 3 files changed. 2 errors fixed. 12 seconds. Not "several files", not "much faster".
Use the active voice. Name the actor. "The watcher inserted 8 flags", not "flags were inserted".

If the output is longer than 5 lines, start with a 2-line summary of what you did and what it means.
Aim for Simplified Technical English vocabulary — keep ~80% of words in everyday technical use.
Never invent data, metrics, or steps. If you did not do it, say so.
End with the state: what works now, what is left.`;

/** T1 adds one "why it matters" line for leadership/client-facing drafts. */
export const T1_ADDENDUM = `After the summary, add ONE line: why this matters to the reader (the decision it unblocks or the risk it retires). Keep it under 20 words.`;

/** T2 keeps the voice but the banned-phrase filter stays on. */
export const T2_ADDENDUM = `Voice and personality are allowed — keep the brand voice. The banned-phrase and no-invented-data rules still apply to every sentence.`;

/** Tier config per agent profile. Default = T0 (STRICT). */
export const AGENT_TIER: Record<string, StyleTier> = {
  // T0 STRICT — ops, P&L, pipeline, scheduler: contract verbatim
  engineer: 'T0', seo_specialist: 'T0', ads_manager: 'T0', hr_director: 'T0',
  orchestrator: 'T0', research: 'T0', designer: 'T0', sales: 'T0', social: 'T0',

  // T1 BALANCED — CEO summaries, reports, client drafts (+ why-it-matters)
  ceo: 'T1', cto: 'T1',

  // T2 EXPRESSIVE — GROW content: voice allowed, filter on
  // (grow content is produced via the social/marketing paths)
};

/** GROW content path tier (calendar/generate outputs). */
export const GROW_TIER: StyleTier = 'T2';

/**
 * Build the style block for an agent profile. Pure function, zero I/O (§8).
 * GROW content path: pass tierOverride='T2' explicitly.
 */
export function styleBlockFor(agent: string, tierOverride?: StyleTier): string {
  const tier = tierOverride ?? AGENT_TIER[agent] ?? 'T0';
  const lines = [`\n\n---\n[STYLE TIER ${tier}]`];
  lines.push(STYLE_CONTRACT);
  if (tier === 'T1') lines.push(T1_ADDENDUM);
  if (tier === 'T2') lines.push(T2_ADDENDUM);
  return lines.join('\n');
}
