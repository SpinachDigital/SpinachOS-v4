/**
 * api/src/agents/style-lint.ts — Phase 7 GOAL 3: style contract Phase B.
 *
 * lintAgentOutput(text): regex/heuristic ONLY. No LLM calls. Budget <500ms
 * (actual: sub-millisecond — pure string ops). Returns score 0–10 + a
 * violations list, per spec §5 (enforcement loop) + §8 (latency law).
 *
 * Checks (from the STYLE_CONTRACT text, Phase 6):
 *   1. Sentences over 15 words
 *   2. Banned praise adjectives / hedging / throat-clearing phrases
 *   3. Missing 2-line summary on outputs longer than 5 lines
 *   4. Vague quantity words where numbers are expected ("several", "a lot")
 *
 * Usage: runs on every agent output bound for THE INBOX / approval cards.
 * Score renders on the card ("Style 8/10 — 2 long sentences"). On-demand
 * "Tighten" button (score < 6 only) does ONE rewrite pass — user-initiated,
 * never automatic; the original stays in the audit trail.
 */
import { supabase } from '../ctx';

export interface StyleLintResult {
  score: number;          // 0–10
  violations: string[];   // human-readable, shown on the card
  lineCount: number;
}

const BANNED_PRAISE = /\b(amazing|incredible|fantastic|revolutionary|game[- ]changing|seamless|robust|powerful)\b/gi;
const BANNED_HEDGE = /\b(might|perhaps|arguably|it seems|i think|sort of)\b/gi;
const BANNED_OPENERS = /\b(great question|let me|here'?s the thing|as you can see|in this fast[- ]paced world)\b/gi;
const VAGUE_QTY = /\b(several files|much faster|a lot of|many things)\b/gi;

/** Count words in a sentence-stretch. */
const countWords = (s: string): number => (s.trim().match(/\S+/g) || []).length;

/** Pure lint — export for tests + the tighten path's before/after. */
export function lintAgentOutput(text: string): StyleLintResult {
  const violations: string[] = [];
  if (!text || !text.trim()) return { score: 0, violations: ['empty output'], lineCount: 0 };

  const lines = text.split(/\n/).filter(l => l.trim().length);
  const lineCount = lines.length;

  // 1. long sentences — split on . ! ? (crude but deterministic, no LLM)
  const sentences = text.split(/(?<=[.!?])\s+/);
  const longSentences = sentences.filter(s => countWords(s) > 15).length;
  if (longSentences) violations.push(`${longSentences} sentence${longSentences > 1 ? 's' : ''} over 15 words`);

  // 2. banned phrases
  const praise = (text.match(BANNED_PRAISE) || []).length;
  const hedge = (text.match(BANNED_HEDGE) || []).length;
  const openers = (text.match(BANNED_OPENERS) || []).length;
  if (praise) violations.push(`${praise} praise adjective${praise > 1 ? 's' : ''}`);
  if (hedge) violations.push(`${hedge} hedge${hedge > 1 ? 's' : ''}`);
  if (openers) violations.push(`${openers} throat-clearing phrase${openers > 1 ? 's' : ''}`);

  // 3. summary lead on long outputs (>5 lines → first 2 lines must be a summary)
  if (lineCount > 5) {
    const firstTwo = lines.slice(0, 2).join(' ').toLowerCase();
    const looksSummary = /(summary|what i did|did|shipped|state|result)/.test(firstTwo);
    if (!looksSummary) violations.push('missing 2-line summary lead (>5 lines)');
  }

  // 4. vague quantities
  const vague = (text.match(VAGUE_QTY) || []).length;
  if (vague) violations.push(`${vague} vague-quantity phrase${vague > 1 ? 's' : ''}`);

  // Score: start at 10, −1 per violation category, −1 per long sentence (cap)
  let score = 10;
  score -= Math.min(4, praise ? 2 : 0 + hedge ? 1 : 0 + openers ? 1 : 0);
  score -= Math.min(3, longSentences);
  score -= (lineCount > 5 && violations.some(v => v.includes('summary'))) ? 2 : 0;
  score -= Math.min(1, vague);
  score = Math.max(0, Math.min(10, score));

  return { score, violations, lineCount };
}

/** Store the lint score on the approval row (metadata.style) — the card
 *  renders it. Write is fire-and-forget-with-.then (postgrest builders are
 *  LAZY — the Phase 5 lesson; void insert() never fires). */
export function attachStyleLint(approvalId: string, output: string): StyleLintResult {
  const result = lintAgentOutput(output);
  supabase
    .from('approvals')
    .update({ metadata: { style_score: result.score, style_violations: result.violations } })
    .eq('id', approvalId)
    .then(() => undefined, (e: any) => console.error('[style-lint] attach failed:', e?.message));
  return result;
}

/** Weekly average style score per agent (P&L/ops view — style drift visible).
 *  Reads approvals metadata.style_score for the last 7 days. */
export async function weeklyStyleScores(): Promise<Array<{ agent: string; avg_score: number; cards: number }>> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data, error } = await supabase
    .from('approvals')
    .select('requested_by, metadata')
    .gte('created_at', since)
    .limit(1000);
  if (error) return [];
  const byAgent: Record<string, { sum: number; n: number }> = {};
  for (const row of (data || []) as any[]) {
    const s = row?.metadata?.style_score;
    if (typeof s === 'number') {
      const a = row.requested_by || 'unknown';
      byAgent[a] = byAgent[a] || { sum: 0, n: 0 };
      byAgent[a].sum += s; byAgent[a].n++;
    }
  }
  return Object.entries(byAgent).map(([agent, { sum, n }]) => ({
    agent, avg_score: Math.round((sum / n) * 10) / 10, cards: n,
  })).sort((a, b) => a.avg_score - b.avg_score);
}
