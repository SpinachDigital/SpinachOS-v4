-- Phase 10 GOAL 1 — Content Calendar schema (migration 068)
-- Numbered after 067b-approvals-support-ticket-type.sql

-- 1. content_items
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_text text,
  channel text not null check (channel in ('x','linkedin','instagram','blog')),
  scheduled_for timestamptz,
  status text not null default 'idea' check (status in ('idea','draft','in_review','approved','scheduled','published','failed')),
  provider_post_id text,
  published_at timestamptz,
  error text,
  created_by text not null default 'founder' check (created_by in ('laya','founder')),
  client_id uuid references public.clients(id) on delete set null,
  style_score smallint, -- 0-10 from lint
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_content_items_client on public.content_items(client_id);
create index if not exists idx_content_items_status on public.content_items(status);
create index if not exists idx_content_items_scheduled on public.content_items(scheduled_for);
create index if not exists idx_content_items_channel on public.content_items(channel);
create index if not exists idx_content_items_created on public.content_items(created_at desc);

-- RLS: founder sees all (service_role bypasses), no client access
alter table public.content_items enable row level security;

drop policy if exists founder_all_content_items on public.content_items;
create policy founder_all_content_items on public.content_items
  for all to authenticated
  using (true)
  with check (true);

-- Updated_at trigger
create or replace function public.update_content_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_content_items_updated_at on public.content_items;
create trigger set_content_items_updated_at
before update on public.content_items
for each row execute function public.update_content_items_updated_at();