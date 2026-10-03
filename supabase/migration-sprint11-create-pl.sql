-- ============================================================
-- SPRINT 11 — CREATE + P&L: usage_logs + model rates + assets
-- Re-runnable (IF NOT EXISTS everywhere).
--
-- usage_logs:  every AI call logs a row (agent, client, model, tokens, cost,
--              task, timestamp) — blueprint §2.9/§4 folded debt, schema
--              adopted AS-IS + cost_inr + metadata. A call nobody logged is
--              a cost nobody sees.
-- model_rates: per-model rates (USD per 1M in/out tokens) — editable rows,
--              never hardcoded silently. Missing model → default rate.
-- clients.monthly_value: per-client monthly revenue (manual input, honest —
--              never invented/backfilled; nullable).
-- Storage buckets client-assets/deliverables/content (blueprint §2.8) —
--              created via the API (storage API below) or SQL Editor.
-- ============================================================

-- 1. usage_logs (blueprint schema as-is + INR + metadata)
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  agent_profile text not null,
  client_id uuid references public.clients(id) on delete set null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,6),
  cost_inr numeric(10,4),
  task_id uuid references public.tasks(id) on delete set null,
  source text not null default 'agent',     -- agent | omniroute | image_gen | laya
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 2. model_rates (editable — never hardcode silently)
create table if not exists public.model_rates (
  model text primary key,
  usd_per_m_input numeric(10,4) not null,
  usd_per_m_output numeric(10,4) not null,
  inr_per_usd numeric(8,4) not null default 84.0,
  updated_at timestamptz default now()
);

-- 3. per-client monthly revenue (manual, honest)
alter table public.clients add column if not exists monthly_value numeric(12,2);

-- 4. indexes (the P&L queries: per-client + per-agent + per-day)
create index if not exists idx_usage_logs_client on public.usage_logs(client_id, created_at desc);
create index if not exists idx_usage_logs_agent on public.usage_logs(agent_profile, created_at desc);
create index if not exists idx_usage_logs_model on public.usage_logs(model, created_at desc);

-- 5. RLS (service-role bypasses; no anon policies — Phase 5)
alter table public.usage_logs enable row level security;
alter table public.model_rates enable row level security;

-- 6. seed rates (current known models — editable rows, not silent hardcode)
insert into public.model_rates (model, usd_per_m_input, usd_per_m_output, inr_per_usd) values
  ('z-ai/glm-5.3-flash', 0.60, 2.20, 84.0),
  ('glm-4.6', 0.60, 2.20, 84.0),
  ('claude-sonnet-4-5', 3.00, 15.00, 84.0),
  ('gpt-4o-mini', 0.15, 0.60, 84.0),
  ('gpt-4o', 2.50, 8.00, 84.0),
  ('gemini-2.5-flash', 0.30, 1.20, 84.0),
  ('veo-3.1-fast', 6.00, 0.00, 84.0)
on conflict (model) do nothing;
