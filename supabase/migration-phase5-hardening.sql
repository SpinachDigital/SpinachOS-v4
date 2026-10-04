-- PHASE 5 — HARDENING (ordered migration set, 01–04)
-- All idempotent. GOAL 1 job_queue + GOAL 10 laya_routing_decisions +
-- GOAL 8 byok (provider keys + department model picks).

-- ============ 01 — job_queue (GOAL 1) ============
create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  queue text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_run_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_queue_due_idx
  on public.job_queue (status, next_run_at);
create index if not exists job_queue_queue_idx
  on public.job_queue (queue, status);

-- ============ 02 — laya_routing_decisions (GOAL 10) ============
-- Every routing decision logged with its confidence (fine-tuning data
-- collection the Laya experiment called for).
create table if not exists public.laya_routing_decisions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'single',            -- single | batch
  message text not null,
  department text not null,
  priority text,
  confidence real not null default 0,
  reasoning text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists laya_decisions_dept_idx
  on public.laya_routing_decisions (department, created_at desc);

-- ============ 03 — byok: provider keys (GOAL 8) ============
-- Founder-managed provider credentials. Keys stored server-side ONLY —
-- masked in every API response; never sent to the client bundle.
create table if not exists public.provider_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                          -- gateway | image | embeddings | publora | ...
  label text,
  key_ciphertext text not null,                     -- stored value (server-side only, masked on read)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);

-- ============ 04 — byok: per-department model picks (GOAL 8) ============
-- Which model each department uses for each capability. Empty table =
-- fall back to code defaults (documented in the report) — the picker
-- overrides, it never hardcodes silently.
create table if not exists public.department_model_picks (
  id uuid primary key default gen_random_uuid(),
  department text not null,                         -- ceo | cto | designer | engineer | seo_specialist | ...
  capability text not null,                        -- gateway | image | embeddings
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department, capability)
);
