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
  // Laya department → REAL Hermes profile (hermes-profiles/ dir names).
  // §2 CORRECTION: plan rev3 said engineering→engineering, but the real
  // profile dir + bridge TASK_PATH_MAP key is 'engineer'. The startup
  // assertion below fails the boot if any value drifts from a real profile.
  engineering: 'engineer',
  marketing: 'social',
  design: 'designer',
  sales: 'sales',
  content: 'social',
  research: 'research',
  operations: 'orchestrator',
  ops: 'orchestrator',
  ceo: 'ceo',
};

// Real profiles = hermes-profiles/ dir names (source of truth). Used by the
// startup assertion and anywhere we need "is this a dispatchable agent?".
export const REAL_PROFILES = [
  'ads_manager', 'ceo', 'cto', 'designer', 'engineer', 'orchestrator',
  'research', 'sales', 'seo_specialist', 'social',
] as const;

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

// STARTUP ASSERTION: every LAYA_DEPARTMENT_MAP value must be a REAL profile
// (hermes-profiles/ dir). Boot fails loudly if this map drifts stale — the
// "write a LinkedIn post → executeAgentTask('content'…)" class of bug dies here.
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
export function assertLayaMapIntegrity(profilesRoot: string): void {
  let real: string[];
  try {
    real = readdirSync(profilesRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (e: any) {
    throw new Error(`[LAYA-MAP] cannot read profiles root ${profilesRoot}: ${e.message}`);
  }
  const bad = Object.entries(LAYA_DEPARTMENT_MAP).filter(([, p]) => !real.includes(p));
  if (bad.length > 0) {
    throw new Error(
      `[LAYA-MAP] STALE — departments map to non-existent profiles: ${bad.map(([k, v]) => `${k}→${v}`).join(', ')}. ` +
      `Real profiles: ${real.join(', ')}. Fix src/laya-client.ts LAYA_DEPARTMENT_MAP.`
    );
  }
}
