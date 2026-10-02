-- ============================================================
-- SPRINT 10 — DELIVER: approval gates + assets + auto-advance audit
-- Re-runnable (IF NOT EXISTS everywhere).
--
-- gate_actions:  approval gates BETWEEN pipeline stages — deny-by-default.
--                The pipeline PAUSES at a gate until the founder approves.
--                risk_tier: read | write | external (higher tiers need
--                explicit approval even if a lower tier was approved before).
-- deliverables:  filed artifacts — on final approval the deliverable is
--                stored + indexed + linked to the client twin.
--                Delivery without filing is incomplete.
-- pipeline_events: EVERY auto-advance logged (who/what/when) — visible on
--                the pipeline page + client twin. A move nobody can see
--                is not a move.
-- stage SLA stuck detection uses workflows.steps_json + pipeline_events.
--
-- NOTE: Supabase MCP down — user runs migrations via SQL Editor.
-- ============================================================

-- 1. gate_actions (approval gates, deny-by-default)
create table if not exists public.gate_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  gate_name text not null,                -- e.g. "brand_direction", "pre_send"
  action text not null,                   -- e.g. "advance_stage", "file_deliverable", "external_send"
  risk_tier text not null default 'write' check (risk_tier in ('read','write','external')),
  payload_json jsonb default '{}',        -- redacted in logs/previews (secrets never stored raw)
  payload_hash text,                      -- sha256 of the canonical payload (audit)
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  requested_by text not null default 'watcher',
  approved_by text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. deliverables (filed artifacts, linked to the client twin)
create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workflow_id uuid references public.workflows(id) on delete set null,
  gate_action_id uuid references public.gate_actions(id) on delete set null,
  title text not null,
  kind text not null default 'file' check (kind in ('file','link','post','image','report')),
  content text,                            -- inline content for post/link shapes
  file_url text,                           -- stored artifact URL (storage bucket)
  version integer not null default 1,
  released_by text,                        -- which approval released it (approver id)
  released_at timestamptz,
  approval_id uuid,                        -- legacy link (Sprint 9 approvals row)
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. pipeline_events (every auto-advance logged)
create table if not exists public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  event text not null,                     -- 'auto_advance' | 'gate_paused' | 'gate_approved' | 'gate_rejected' | 'filed' | 'stuck_flag'
  from_step text,
  to_step text,
  actor text not null default 'watcher',   -- who/what (watcher | founder | agent:<name>)
  detail jsonb default '{}',
  created_at timestamptz default now()
);

-- 4. indexes (every FK + the ORDER BY patterns the pages use)
create index if not exists idx_gate_actions_workflow on public.gate_actions(workflow_id);
create index if not exists idx_gate_actions_status on public.gate_actions(status, created_at desc);
create index if not exists idx_deliverables_client on public.deliverables(client_id, created_at desc);
create index if not exists idx_deliverables_workflow on public.deliverables(workflow_id);
create index if not exists idx_pipeline_events_workflow on public.pipeline_events(workflow_id, created_at desc);
create index if not exists idx_pipeline_events_client on public.pipeline_events(client_id, created_at desc);

-- 5. updated_at triggers (same pattern as existing tables)
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gate_actions_touch on public.gate_actions;
create trigger trg_gate_actions_touch before update on public.gate_actions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_deliverables_touch on public.deliverables;
create trigger trg_deliverables_touch before update on public.deliverables
  for each row execute function public.touch_updated_at();

-- 6. RLS on both new tables (migration defaults — hardening stays Phase 5)
alter table public.gate_actions enable row level security;
alter table public.deliverables enable row level security;
alter table public.pipeline_events enable row level security;

-- service-role bypasses RLS; anon/authenticated deny-by-default (no policies
-- created here — explicit founder-only policies are a Phase 5 decision).
