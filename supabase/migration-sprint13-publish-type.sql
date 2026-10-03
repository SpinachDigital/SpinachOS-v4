-- SPRINT 13 — approvals_type_check: publish type allowed (GOAL 3)
-- Same ATOMIC single-statement pattern as Sprint 10 (drop+add in ONE alter —
-- never two separate statements).
alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'outreach',          -- Sprint 9: outreach drafts (ApprovalCards)
    'stuck_stage',       -- Sprint 10 §1: pipeline stuck attention cards
    'gate',              -- Sprint 10 §2: approval gates
    'publish',           -- Sprint 13 GOAL 3: the publish gate in THE INBOX
    'task_approval',     -- pre-existing
    'deliverable_approval', -- pre-existing
    'onboarding',        -- pre-existing
    'invoice',           -- pre-existing
    'content',           -- historical feed cards (pre-constraint rows)
    'strategy',          -- historical feed cards
    'design'             -- historical feed cards
  ));
