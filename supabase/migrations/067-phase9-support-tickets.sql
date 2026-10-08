-- Phase 9 GOAL 1 — Support Tickets schema (migration 067)
-- Numbered after 066-phase8-1-client-visible.sql

-- 1. support_tickets
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unread_client boolean not null default false,
  unread_founder boolean not null default true
);

-- 2. ticket_messages
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author text not null check (author in ('client','founder')),
  body text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tickets_client on public.support_tickets(client_id);
create index if not exists idx_tickets_status on public.support_tickets(status);
create index if not exists idx_tickets_updated on public.support_tickets(updated_at desc);
create index if not exists idx_ticket_messages_ticket on public.ticket_messages(ticket_id, created_at);

-- RLS: client sees only own tickets
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

drop policy if exists client_read_own_tickets on public.support_tickets;
create policy client_read_own_tickets on public.support_tickets
  for select to authenticated
  using (client_id = public.client_id_claim());

drop policy if exists client_read_own_ticket_messages on public.ticket_messages;
create policy client_read_own_ticket_messages on public.ticket_messages
  for select to authenticated
  using (
    ticket_id in (
      select id from public.support_tickets where client_id = public.client_id_claim()
    )
  );

-- Founder bypass (service_role already bypasses RLS — no profiles table exists)
-- Explicit policies removed; founder uses service_role key which bypasses RLS.
-- If you need auth-role access, add a profiles table first.

-- Updated_at trigger
create or replace function public.update_tickets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_tickets_updated_at on public.support_tickets;
create trigger set_tickets_updated_at
before update on public.support_tickets
for each row execute function public.update_tickets_updated_at();