-- ============================================================
-- PHASE 11 — WIN: the revenue engine. Leads data model.
--
-- The leads table EXISTS (000-schema, Sprint 9 qualification cols in
-- 050) but its status CHECK is Sprint 9's sales-CRM set
-- ('new','contacted','qualified','proposal','closed_won','closed_lost').
-- Phase 11's WIN pipeline (blueprint §3.2) is:
--   new → qualified → outreached → responded → onboarded
--   (+ disqualified / dead side-states)
--
-- This migration:
--   1. swaps the leads status CHECK to the WIN set (NOT VALID first)
--   2. maps legacy rows to the WIN statuses, then VALIDATEs
--   3. adds the Phase 11 columns (score 0-100 agent-assessed, notes)
--   4. indexes on status, email (status one exists — keep)
--
-- ORDER MATTERS (live-learned): the old CHECK blocks any update that
-- sets a WIN status (e.g. contacted → outreached violates the Sprint 9
-- set). So: swap as NOT VALID first, THEN map legacy rows, THEN
-- VALIDATE. One pass, no window without a status constraint.
--
-- Re-runnable: drop-then-add in ONE statement (no 42710 collision).
-- ============================================================

-- 1. swap the status CHECK to the WIN set, NOT VALID (legacy rows mapped next)
alter table public.leads
  drop constraint if exists leads_status_check,
  add constraint leads_status_check
  check (status in ('new','qualified','disqualified','outreached','responded','onboarded','dead'))
  not valid;

-- 2. map retired Sprint 9 statuses to the WIN pipeline
--    contacted → outreached (outreach sent), proposal → responded,
--    closed_won → onboarded, closed_lost → dead.
update public.leads
   set status = case status
     when 'contacted' then 'outreached'
     when 'proposal' then 'responded'
     when 'closed_won' then 'onboarded'
     when 'closed_lost' then 'dead'
     else status end
 where status in ('contacted','proposal','closed_won','closed_lost');

-- 3. VALIDATE — every row now satisfies the WIN set (fails loudly if not)
alter table public.leads validate constraint leads_status_check;

-- 4. Phase 11 columns
alter table public.leads
  add column if not exists score integer check (score between 0 and 100),
  add column if not exists notes text;

-- 4. source CHECK (import/referral/inbound/manual — the Phase 11 set)
--    NOTE: Sprint 9 sources (github, apollo, clutch…) exist in live rows.
--    The source column stays TEXT NOT NULL (no new CHECK) — the API
--    validates source for NEW rows; old scraper rows pass through.
--    (A CHECK would break the existing scraper ingest paths.)

-- 5. indexes (status + email per the Phase 11 spec; both already exist
--    from 000-schema — idempotent re-assert)
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_email on public.leads(email);

-- 6. outreach_drafts: Phase 11 adds style_score (the lint runs on every
--    agent draft — score on the draft AND the card).
alter table public.outreach_drafts
  add column if not exists style_score integer;

-- 7. RLS: already on outreach_drafts (050). leads stays service-role
--    only (no direct client access — clients get 401 on all WIN
--    endpoints; the API is the only writer).
alter table public.leads enable row level security;
