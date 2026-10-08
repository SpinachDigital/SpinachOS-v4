-- ============================================================
-- PHASE 9 — approvals: support_ticket type + risk_tier column
-- The approvals table's type CHECK predates Phase 9's support tickets.
-- Re-runnable: drop-then-add runs as ONE statement (no 42710 collision).
-- The existing rows keep their types (evidence-preserving — the new check
-- allows the full observed value set + support_ticket).
-- risk_tier column added (Sprint 10's gate_actions has it; approvals never did —
-- Phase 9 triage needs write-tier on client-voice cards).
-- ============================================================

alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'support_ticket',    -- Phase 9: client-voice support tickets (THE INBOX)
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

-- risk_tier on approvals (triage: external > write > read)
alter table public.approvals
  add column if not exists risk_tier text check (risk_tier in ('read','write','external'));