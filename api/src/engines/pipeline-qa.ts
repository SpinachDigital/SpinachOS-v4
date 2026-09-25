/*
 * engines/pipeline-qa.ts — Phase 3 monolith split (from index.ts L4020–4052).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
const PORT = process.env.PORT || 4000;

// ============================================================
// PHASE 2 — D1 PIPELINE ENGINE + D4 STATE MACHINE + HOD QA
// Runs a workflow's steps sequentially through the execution bridge:
//   step → agent executes → HOD QA gate (for deliverable steps)
//   → auto-approval creation at 'approve' steps → director gate
//   → done. Rework capped at 2 cycles (D4), then escalate.
// ============================================================

// D4 task state machine
type TaskState = 'queued' | 'assigned' | 'delegated' | 'in_review' | 'approved_HOD' | 'pending_director' | 'done' | 'rework';

// Steps whose output is a deliverable → HOD QA applies. Words-only steps skip QA.
export const QA_GATE_STEPS = new Set(['logo_design', 'guidelines', 'website', 'content', 'design_assets', 'ads_manage', 'monthly_report', 'seo_setup', 'gmb', 'content_creation', 'content_plan']);

// HOD per step (who QA's the output) — matches the v6 hierarchy
export const QA_OWNER: Record<string, string> = {
  logo_design: 'designer', guidelines: 'designer', dna_extract: 'designer',
  website: 'engineer', build: 'engineer',
  content: 'social', content_plan: 'social', content_creation: 'social',
  design_assets: 'designer', ads_manage: 'ads_manager',
  monthly_report: 'research', seo_setup: 'seo_specialist', seo_check: 'seo_specialist', gmb: 'seo_specialist',
  strategy: 'ceo',
};

// In-flight pipeline runners (client_id+workflow → promise) — prevents double-runs
export const runningPipelines = new Set<string>();

/**
 * buildStepPrompt — the D5 brief: task + client DNA + top-5 RAG chunks.
 * Same discipline the retainer loop uses: bounded context, client-isolated.
 */
