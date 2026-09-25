/*
 * src/command-intent.ts — Phase 3 monolith split (index.ts L2298–2317).
 * No behavior changes.
 */
export const IRREVERSIBLE = ['spend', 'publish', 'delete', 'send', 'outreach', 'client delivery', 'launch', 'ads for', 'campaign for'];
export const COMPLEX_SIGNALS = ['should we', 'what if', 'how about', 'help me decide', 'brainstorm', 'restructure', 'pivot'];

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
