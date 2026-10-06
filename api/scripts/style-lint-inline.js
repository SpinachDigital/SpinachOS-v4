// Inline copy of lintAgentOutput from api/src/agents/style-lint.ts (regex-only core)
const BANNED_PRAISE = /\b(amazing|incredible|fantastic|revolutionary|game[- ]changing|seamless|robust|powerful)\b/gi;
const BANNED_HEDGE = /\b(might|perhaps|arguably|it seems|i think|sort of)\b/gi;
const BANNED_OPENERS = /\b(great question|let me|here'?s the thing|as you can see|in this fast[- ]paced world)\b/gi;
const VAGUE_QTY = /\b(several files|much faster|a lot of|many things)\b/gi;
function lintAgentOutput(text) {
  const violations = [];
  const sentences = String(text || '').split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 15).length;
  if (longSentences > 0) violations.push(`${longSentences} long sentence(s) over 15 words`);
  const praise = (String(text || '').match(BANNED_PRAISE) || []).length;
  if (praise) violations.push(`${praise} banned praise adjective(s)`);
  const hedge = (String(text || '').match(BANNED_HEDGE) || []).length;
  if (hedge) violations.push(`${hedge} hedging phrase(s)`);
  const openers = (String(text || '').match(BANNED_OPENERS) || []).length;
  if (openers) violations.push(`${openers} throat-clearing opener(s)`);
  const vague = (String(text || '').match(VAGUE_QTY) || []).length;
  if (vague) violations.push(`${vague} vague quantity phrase(s)`);
  const lines = String(text || '').split('\n').length;
  if (lines > 5 && !/\n/.test(String(text || '').slice(0, 200))) violations.push('missing 2-line summary lead');
  const score = Math.max(0, 10 - longSentences - praise - hedge - openers - vague);
  return { score, violations, lineCount: lines };
}
module.exports = { lintAgentOutput };
