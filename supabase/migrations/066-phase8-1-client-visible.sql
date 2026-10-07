-- ============================================================
-- 066 — PHASE 8.1: client_visible flag on workflows + playbooks
-- DECISION NOTE (3 lines, per GOAL 3): the client-visibility flag lives on
-- BOTH tables — playbooks carry it as a seeded default (a pack is or isn't
-- client-facing), and the INSTALLED workflow inherits it at install time so
-- the gate reads ONE table (workflows) at file time. The gate wiring
-- (file_deliverable) stamps metadata.client_review='pending' only when
-- the installed workflow's client_visible flag is true.
-- ============================================================

-- 1. playbooks: seeded default (existing packs default to false — the
--    onboarding/content packs become client-visible via a data update below)
alter table public.playbooks add column if not exists client_visible boolean not null default false;

-- 2. workflows: the installed instance's flag (inherited at install)
alter table public.workflows add column if not exists client_visible boolean not null default false;

-- 3. data defaults: the agency-real client-facing packs ARE client-visible
--    (their deliverables are things the client reviews: first deliverable,
--    content review, monthly report, welcome kit)
update public.playbooks set client_visible = true
  where slug in ('client-onboarding', 'content-production', 'new-client-onboarding', 'retainer-ops');

-- 4. existing installed instances of those packs inherit the flag
update public.workflows w set client_visible = true
  from public.playbooks p
  where w.metadata->>'pack_slug' = p.slug and p.client_visible = true;

-- 5. verify (run after, paste result back):
-- select slug, client_visible from public.playbooks where client_visible;
-- select id, name, client_visible from public.workflows where client_visible;
