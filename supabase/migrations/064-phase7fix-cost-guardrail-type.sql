-- ============================================================
-- 064 — PHASE 7-FIX: cost_guardrail approval type (atomic drop+add)
-- Approved cost caps raise a low-risk inbox card on breach (FIX 2).
-- Re-runnable; single statement per the Sprint 10/13 pattern.
-- ============================================================
alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'outreach', 'stuck_stage', 'gate', 'publish', 'task_approval',
    'deliverable_approval', 'onboarding', 'invoice',
    'content', 'strategy', 'design',
    'evolution_proposal',  -- Phase 7 GOAL 1: learning-loop inbox cards
    'cost_guardrail'       -- Phase 7-FIX FIX 2: spend-cap breach cards
  ));
