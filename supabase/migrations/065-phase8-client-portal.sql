-- ============================================================
-- 065 — PHASE 8: CLIENT PORTAL (invite auth + sessions + RLS isolation)
-- Invite-only, token hashes only, RLS client-scoped policies IN the
-- migration (the 064 manual-SQL pattern does not repeat).
-- ============================================================

-- ============ 1. portal_invites ============
create table if not exists public.portal_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null,
  token_hash text not null unique,          -- SHA-256 hex — NEVER the raw token
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  revoked boolean not null default false,
  created_by text not null default 'director',
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_invites_client on public.portal_invites(client_id, created_at desc);
create index if not exists idx_portal_invites_hash on public.portal_invites(token_hash);

-- ============ 2. client_sessions ============
create table if not exists public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,          -- SHA-256 hex of the session token
  expires_at timestamptz not null default (now() + interval '30 days'),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_client_sessions_hash on public.client_sessions(token_hash);
create index if not exists idx_client_sessions_client on public.client_sessions(client_id);

-- ============ 3. deliverables: client-review states (the ONE write) ============
-- pending_client_review → accepted | changes_requested (client decision)
alter table public.deliverables drop constraint if exists deliverables_kind_check;
alter table public.deliverables add constraint deliverables_kind_check
  check (kind in ('file','link','post','image','report'));

-- review status rides metadata.client_review: 'pending' | 'accepted' | 'changes_requested'
create index if not exists idx_deliverables_review on public.deliverables(client_id, (metadata->>'client_review'));

-- ============ 4. RLS: client-scoped isolation (deny by default) ============
-- helper: client_id claim from the client session JWT (set via request context)
create or replace function public.client_id_claim() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'client_id', '')::uuid;
$$;

-- enable RLS on the two new tables
alter table public.portal_invites  enable row level security;
alter table public.client_sessions enable row level security;

-- portal tables: service_role full (the API is the only writer/reader)
drop policy if exists backend_full_access_portal_invites on public.portal_invites;
create policy backend_full_access_portal_invites on public.portal_invites
  for all to service_role using (true) with check (true);
drop policy if exists backend_full_access_client_sessions on public.client_sessions;
create policy backend_full_access_client_sessions on public.client_sessions
  for all to service_role using (true) with check (true);

-- client-visible tables: client role reads ONLY their client_id rows.
-- (The anon/authenticated roles get nothing — deny by default. The API's
-- client-facing queries run as a Supabase client whose JWT carries the
-- client_id claim, so RLS is the enforcement, not the route code.)
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('deliverables','approvals','workflows','pipeline_events')
  loop
    -- drop any prior client-read policy (idempotent re-run)
    execute format('drop policy if exists client_read_own_%I on public.%I', t.tablename, t.tablename);
    execute format(
      'create policy client_read_own_%I on public.%I for select to authenticated
       using (client_id = public.client_id_claim())',
      t.tablename, t.tablename
    );
  end loop;
end $$;

-- clients table: the client can read THEIR OWN client row (name/status for the portal header)
drop policy if exists client_read_own_clients_self on public.clients;
create policy client_read_own_clients_self on public.clients
  for select to authenticated
  using (id = public.client_id_claim());

-- deliverables: client may UPDATE only their own pending_client_review rows
-- (metadata.client_review = 'pending') — the ONE write: approve/request-changes
drop policy if exists client_review_own_deliverables on public.deliverables;
create policy client_review_own_deliverables on public.deliverables
  for update to authenticated
  using (client_id = public.client_id_claim() and metadata->>'client_review' = 'pending')
  with check (client_id = public.client_id_claim());

-- ============ 5. verify (run after, paste result back) ============
-- select tablename, policyname, cmd, roles from pg_policies
--   where schemaname='public' and (policyname like 'client_%' or policyname like 'backend_full_access_portal%');
-- expect: client_read_own_* on deliverables/approvals/workflows/pipeline_events/clients,
--         client_review_own_deliverables (update), backend_full_access_portal_* (service_role)
