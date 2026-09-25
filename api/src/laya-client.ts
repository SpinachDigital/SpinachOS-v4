/*
 * src/laya-client.ts — Phase 3 monolith split (index.ts L2781–2824).
 * No behavior changes.
 */
export const LAYA_URL = process.env.LAYA_URL || 'http://localhost:8000';

export interface LayaDecision {
  department: string;
  priority: 'high' | 'medium' | 'low';
}

export const LAYA_DEPARTMENT_MAP: Record<string, string> = {
  engineering: 'engineering',
  marketing: 'social',
  design: 'design',
  sales: 'sales',
  content: 'content',
  research: 'research',
  operations: 'ops',
  ops: 'ops',
};

export const CEO_KEYWORDS = ['should we', 'strategy', 'idea', 'plan', 'evaluate', 'direction', 'vision', 'approve'];

export async function callLaya(message: string): Promise<LayaDecision | null> {
  try {
    const res = await fetch(`${LAYA_URL}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      // Fast timeout — Laya is System 1, should respond in <1s
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.department || !data.priority) return null;
    return data as LayaDecision;
  } catch {
    return null; // Laya unavailable — fallback to command routing
  }
}

export function isCEOQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return CEO_KEYWORDS.some(kw => lower.includes(kw));
}

// POST /api/v1/laya/route — Laya routing endpoint (can be called directly or via command gateway)
