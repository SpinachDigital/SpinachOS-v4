-- =====================================================================
-- PHASE 7 GOAL 1 — Learning Loop schema
-- learned_preferences + evolution_proposals + suppression law.
--
-- THE GOLDEN RULE (law): nothing applies itself. Every proposal lands in
-- THE INBOX as type='evolution_proposal'. Deny → suppressed forever
-- (unique on (proposal_key) — re-proposing the same pattern is a bug).
--
-- Idempotent: create if not exists + drop/add constraint atomically.
-- =====================================================================

-- 1. Learned preferences (applied behavior rules, scoped)
create table if not exists public.learned_preferences (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'client', 'agent')),
  client_id uuid references public.clients(id) on delete cascade,
  agent_profile text,
  key text not null,                       -- e.g. 'image_style.auto_deny_ai_stock'
  value jsonb not null,                    -- the rule payload
  confidence numeric(5,2) not null,        -- 0–100 honest confidence
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'expired')),
  evidence_refs jsonb default '[]',        -- counts, dates, example ids behind it
  proposal_id uuid,                        -- originating evolution_proposals.id
  created_at timestamptz default now(),
  updated_at timestamptz default now()
  -- NOTE: uniqueness is enforced by the expression index below (Postgres
  -- table-level UNIQUE constraints can't take coalesce() expressions).
);

-- Unique per (scope, key, client, agent) — NULL-safe via coalesce.
create unique index if not exists uq_learned_prefs
  on public.learned_preferences
  (scope, key, coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(agent_profile, ''));

-- 2. Evolution proposals (what the system wants to change — inbox cards)
create table if not exists public.evolution_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_key text not null unique,        -- stable dedupe key; deny writes here → suppression
  type text not null check (type in ('preference', 'playbook_fix', 'cost_rule')),
  title text not null,
  rationale text not null,
  confidence numeric(5,2) not null,         -- honest 0–100
  evidence jsonb not null default '{}',     -- counts, dates, examples
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'applied')),
  proposed_at timestamptz default now(),
  decided_at timestamptz,
  applied_at timestamptz,
  payload jsonb not null default '{}'      -- what applying actually does (rule/pack diff)
);

create index if not exists idx_evolution_status on public.evolution_proposals(status, proposed_at desc);
create index if not exists idx_prefs_scope on public.learned_preferences(scope, status);

-- 3. approvals type check: evolution_proposal allowed (violet-tagged inbox card)
--    Atomic drop+add (Sprint 10/13 pattern — one statement, re-runnable).
alter table public.approvals
  drop constraint if exists approvals_type_check,
  add constraint approvals_type_check
  check (type in (
    'outreach', 'stuck_stage', 'gate', 'publish', 'task_approval',
    'deliverable_approval', 'onboarding', 'invoice',
    'content', 'strategy', 'design',
    'evolution_proposal'   -- Phase 7 GOAL 1: learning-loop inbox cards
  ));

-- 4. agent_memory type: evolution link (decisions about proposals)
alter table public.agent_memory
  drop constraint if exists agent_memory_memory_type_check;
alter table public.agent_memory
  add constraint agent_memory_memory_type_check
  check (memory_type in ('client', 'decision', 'pattern', 'preference', 'evolution'));
