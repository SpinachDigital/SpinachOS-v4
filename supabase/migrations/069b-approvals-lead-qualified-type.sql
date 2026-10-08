-- ============================================================
-- PHASE 11 — approvals: lead_qualified card type (GOAL 2)
--
-- The approvals type CHECK predates Phase 11's lead qualification
-- cards. lead_qualified is READ-tier (qualifying is low-risk; the
-- founder Approve/Disqualify on the card is the decision).
-- outreach_draft cards ride the existing 'outreach' type (Sprint 9).
--
-- Re-runnable: drop-then-add in ONE statement (no 42710 collision).
-- ============================================================

alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'lead_qualified',    -- Phase 11: agent qualify score → Approve/Disqualify
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
