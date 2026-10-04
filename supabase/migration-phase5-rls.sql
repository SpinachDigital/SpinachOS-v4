-- PHASE 5 — GOAL 2: RLS hardening (real row-level policies, zero USING(true))
-- This is security, not the client portal: the portal stays parked, but the
-- DB is secure by default. No anonymous or plain-authenticated direct access
-- to data tables — ALL access rides the backend API (service_role key,
-- server-side only).
--
-- Run AFTER migration-phase5-hardening.sql.
--
-- IMPORTANT: run the DO-block FIRST (Supabase auto-names policies; exact-name
-- drops silently skip otherwise — the Sprint 13 lesson).

-- ============ STEP 1 — drop every permissive policy (any name) ============
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and (qual like '%true%' or with_check like '%true%')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============ STEP 2 — RLS on every data table (idempotent) ============
alter table public.clients            enable row level security;
alter table public.tasks              enable row level security;
alter table public.leads              enable row level security;
alter table public.content            enable row level security;
alter table public.logs               enable row level security;
alter table public.workflows          enable row level security;
alter table public.approvals          enable row level security;
alter table public.agent_states       enable row level security;
alter table public.outreach_drafts    enable row level security;
alter table public.deliverables       enable row level security;
alter table public.usage_logs         enable row level security;
alter table public.agent_memory       enable row level security;
alter table public.playbooks          enable row level security;
alter table public.pipeline_events    enable row level security;
alter table public.gate_actions       enable row level security;
alter table public.marketing_content_calendar enable row level security;
alter table public.job_queue          enable row level security;
alter table public.laya_routing_decisions     enable row level security;
alter table public.provider_keys      enable row level security;
alter table public.department_model_picks     enable row level security;
alter table public.knowledge_chunks   enable row level security;
alter table public.command_threads    enable row level security;
alter table public.thread_messages    enable row level security;
alter table public.agent_state_log    enable row level security;
alter table public.retainer_runs      enable row level security;

-- ============ STEP 3 — real policies: service_role only (backend API) ============
-- THE policy on every data table: the backend (service_role, server-side)
-- has full access; NO anonymous, NO plain-authenticated direct DB access.
-- The founder UI rides the backend API (JWT → service-role server calls),
-- never the anon key against these tables.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (
        'clients','tasks','leads','content','logs','workflows','approvals',
        'agent_states','outreach_drafts','deliverables','usage_logs',
        'agent_memory','playbooks','pipeline_events','gate_actions',
        'marketing_content_calendar','job_queue','laya_routing_decisions',
        'provider_keys','department_model_picks','knowledge_chunks',
        'command_threads','thread_messages','agent_state_log','retainer_runs'
      )
  loop
    execute format(
      'create policy %I on %I for all to service_role using (true) with check (true)',
      'backend_full_access_' || t.tablename, t.tablename
    );
  end loop;
end $$;

-- ============ STEP 4 — verify (run after, paste result back) ============
-- Zero permissive USING(true) on non-service_role roles expected:
-- select tablename, policyname, roles, qual from pg_policies where schemaname='public' order by tablename;
