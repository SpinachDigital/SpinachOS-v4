-- ============================================================
-- PHASE 10 — approvals: grow_draft type allowed
-- The approvals type CHECK predates Phase 10's GROW drafts.
-- Re-runnable: drop-then-add runs as ONE statement (no 42710 collision).
-- ============================================================

alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'support_ticket',    -- Phase 9: client-voice support tickets (THE INBOX)
    'grow_draft',        -- Phase 10: GROW content drafts (generate → approve → publish)
    'outreach',          -- Sprint 9: outreach drafts (ApprovalCards)
    'stuck_stage',       -- Sprint 10 §1: pipeline stuck attention cards
    'gate',              -- Sprint 10 §2: approval gates
    'task_approval',     -- pre-existing
    'deliverable_approval', -- pre-existing
    'onboarding',        -- pre-existing
    'invoice',           -- pre-existing
    'publish',           -- Sprint 13: content calendar publish approvals
    'content',           -- historical feed cards (pre-constraint rows)
    'strategy',          -- historical feed cards
    'design'             -- historical feed cards
  ));