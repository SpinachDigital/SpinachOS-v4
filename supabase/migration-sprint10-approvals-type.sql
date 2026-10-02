-- ============================================================
-- SPRINT 10 FIX — approvals_type_check: stuck_stage type allowed
-- The existing approvals table has a CHECK constraint on `type` that
-- predates Sprint 10's stuck-stage attention cards.
-- Re-runnable: drop-then-add runs as ONE statement — a constraint name
-- collision (42710) can't happen, and the add is atomic with the drop.
--
-- 23514 (existing rows violate): the table already holds rows whose `type`
-- predates the original constraint (content/strategy/design — historical
-- feed cards). Legitimate data — the new check must ALLOW them, not delete
-- them (evidence-preserving). Re-create with the full observed value set.
-- ============================================================

alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'outreach',          -- Sprint 9: outreach drafts (ApprovalCards)
    'stuck_stage',       -- Sprint 10 §1: pipeline stuck attention cards
    'gate',              -- Sprint 10 §2: approval gates
    'task_approval',     -- pre-existing
    'deliverable_approval', -- pre-existing
    'onboarding',        -- pre-existing
    'invoice',           -- pre-existing
    'content',           -- historical feed cards (pre-constraint rows)
    'strategy',          -- historical feed cards
    'design'             -- historical feed cards
  ));
