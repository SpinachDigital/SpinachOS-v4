/*
 * src/command-intent.ts — Phase 3 monolith split (index.ts L2298–2317).
 * No behavior changes.
 */
export const IRREVERSIBLE = ['spend', 'publish', 'delete', 'send', 'outreach', 'client delivery', 'launch', 'ads for', 'campaign for'];
export const COMPLEX_SIGNALS = ['should we', 'what if', 'how about', 'help me decide', 'brainstorm', 'restructure', 'pivot'];

/**
 * Sprint 9 §7.4 — strip gateway/filter metadata leakage from model output.
 * The OmniRoute gateway sometimes echoes its own safety-filter metadata
 * ("User Safety: safe", "Safety: pass" preamble lines) as the first line of
 * the reply; the chat surface then renders filter metadata instead of
 * content. Strip leading metadata lines + surrounding blank space.
 */
export function stripSafetyLeak(text: string): string {
  let out = String(text || '');
  // Strip leading "User Safety: safe"-style lines (case-insensitive, allow
  // "Safety: pass|safe|ok|yes" / "Content Safety: ..." variants).
  out = out.replace(/^\s*user\s+safety\s*[:\-]\s*\w+\s*\n?/i, '');
  out = out.replace(/^\s*content\s+safety\s*[:\-]\s*\w+\s*\n?/i, '');
  out = out.replace(/^\s*safety\s*[:\-]\s*(safe|pass|ok|okay|yes|clean)\s*\n?/i, '');
  return out.trim();
}

export function needsBrainstorm(command: string, layaConfidence: number | undefined): boolean {
  const t = command.toLowerCase();
  if (layaConfidence !== undefined && layaConfidence < 0.6) return true;
  if (IRREVERSIBLE.some(v => t.includes(v))) return true;
  if (COMPLEX_SIGNALS.some(v => t.includes(v))) return true;
  // Status QUESTIONS are discussion, not dispatch — "have we posted..." must never
  // delegate. Question openers (have we/did we/what's/kya) and question marks route
  // to the brainstorm thread where the founder gets an answer, not a task.
  if (/^(have we|did we|has the|did the|what's|whats|kya hum|kya)\b/.test(t)) return true;
  if (/\?\s*$/.test(command)) return true;
  return false;
}

// The founder-facing reply from a dispatched task (Hinglish register)
export function dispatchReply(agent: string, taskId: string): string {
  return `Samajh gaya — ${agent} ko de diya. Task #${taskId.slice(0, 8)} chal raha hai, output aane par dikh jayega.`;
}

/**
 * handleCommandThread — the two-way engine behind POST /api/v1/command.
 * Returns { thread_id, reply } so the caller can stream the reply over WS.
 */
