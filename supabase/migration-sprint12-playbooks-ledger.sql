-- SPRINT 12 — PLAYBOOKS + MEMORY LEDGER (blueprint v2-aligned)
-- Run in Supabase SQL Editor (Supabase MCP is down — user runs SQL).
--
-- 1. agent_memory (blueprint §4 folded debt — the doc's schema AS-IS:
--    agent, type [client/decision/pattern/preference], key, value, expiry)
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_profile text not null,
  memory_type text not null check (memory_type in ('client', 'decision', 'pattern', 'preference')),
  key text not null,
  value jsonb not null,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(agent_profile, memory_type, key)
);

-- 2. playbooks — workflow-type packs as VERSIONED DATA (seeded definitions,
--    not code branches). Installing v1 then upgrading the pack to v2 must
--    not silently rewrite existing instances: new installs get the new
--    version; existing instances stay unless explicitly migrated.
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  workflow_type text not null,            -- onboarding | content | sales | retainer
  version integer not null default 1,
  description text,
  stages_json jsonb not null,             -- [{ name, description }]
  tasks_json jsonb not null default '[]', -- [{ name, agent, step_name, description }]
  gates_json jsonb not null default '[]', -- [{ name, action, risk_tier, after_step }]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. indexes (ledger replay: agent/client/type/date; playbook browse)
create index if not exists idx_agent_memory_agent on public.agent_memory(agent_profile, created_at desc);
create index if not exists idx_agent_memory_client on public.agent_memory((value->>'client_id'), created_at desc);
create index if not exists idx_agent_memory_type on public.agent_memory(memory_type, created_at desc);
create index if not exists idx_playbooks_type on public.playbooks(workflow_type, version desc);

-- 4. RLS (service-role bypasses; no anon policies — Phase 5)
alter table public.agent_memory enable row level security;
alter table public.playbooks enable row level security;

-- 5. seed the 4 workflow-type packs (blueprint §4 folded debt) + 3 campaign
--    packs (agency-real). Versioned data — editable rows, not code.
insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json) values
  -- workflow-type packs
  ('client-onboarding', 'Client Onboarding', 'onboarding', 1,
   'One-time: lead closed → client live. Kickoff → brand DNA → kickoff call → first deliverable.',
   '[{"name":"kickoff","description":"Kickoff meeting + requirements"},{"name":"brand-dna","description":"Brand voice + DNA captured"},{"name":"kickoff-call","description":"Official kickoff call"},{"name":"first-deliverable","description":"First deliverable approved"}]',
   '[{"name":"Capture brand DNA","agent":"cto","step_name":"brand-dna"},{"name":"Prepare kickoff brief","agent":"ceo","step_name":"kickoff"}]',
   '[{"name":"first-deliverable-gate","action":"file_deliverable","risk_tier":"write","after_step":"first-deliverable"}]'),
  ('content-production', 'Content Production', 'content', 1,
   'Recurring: brief → draft → review → schedule. The CREATE loop for a client.',
   '[{"name":"brief","description":"Content brief + angle"},{"name":"draft","description":"Draft produced"},{"name":"review","description":"Founder review gate"},{"name":"schedule","description":"Scheduled to platform"}]',
   '[{"name":"Write content brief","agent":"seo_specialist","step_name":"brief"},{"name":"Produce draft","agent":"ceo","step_name":"draft"}]',
   '[{"name":"content-review-gate","action":"file_deliverable","risk_tier":"write","after_step":"review"}]'),
  ('lead-to-close', 'Lead-to-Close', 'sales', 1,
   'Sales: qualify → outreach → negotiate → close. The WIN loop.',
   '[{"name":"qualify","description":"Lead qualified (score + fit)"},{"name":"outreach","description":"Outreach sent (approved)"},{"name":"negotiate","description":"Proposal + negotiation"},{"name":"close","description":"Closed — won or lost"}]',
   '[{"name":"Qualify lead","agent":"sales","step_name":"qualify"},{"name":"Draft outreach","agent":"sales","step_name":"outreach"}]',
   '[{"name":"outreach-gate","action":"external_send","risk_tier":"external","after_step":"outreach"}]'),
  ('retainer-ops', 'Retainer Ops', 'retainer', 1,
   'Monthly loop: plan → execute → report → invoice. Ongoing retainer clients.',
   '[{"name":"plan","description":"Monthly plan from retainer scope"},{"name":"execute","description":"Execute the month''s work"},{"name":"report","description":"Monthly report drafted"},{"name":"invoice","description":"Invoice raised"}]',
   '[{"name":"Draft monthly plan","agent":"ceo","step_name":"plan"},{"name":"Draft monthly report","agent":"ceo","step_name":"report"}]',
   '[{"name":"monthly-report-gate","action":"file_deliverable","risk_tier":"write","after_step":"report"}]'),
  -- campaign packs (concrete, agency-real)
  ('new-client-onboarding', 'New Client Onboarding', 'onboarding', 1,
   'Concrete onboarding campaign: the full client-onboarding pack + welcome asset set.',
   '[{"name":"kickoff","description":"Kickoff + requirements"},{"name":"brand-dna","description":"Brand DNA + welcome assets"},{"name":"welcome-kit","description":"Welcome kit delivered"},{"name":"first-deliverable","description":"First deliverable approved"}]',
   '[{"name":"Capture brand DNA","agent":"cto","step_name":"brand-dna"},{"name":"Build welcome kit","agent":"ceo","step_name":"welcome-kit"}]',
   '[{"name":"welcome-gate","action":"file_deliverable","risk_tier":"write","after_step":"welcome-kit"}]'),
  ('diwali-campaign', 'Diwali Campaign', 'content', 1,
   'Diwali seasonal campaign: festive creatives + offers + posting calendar.',
   '[{"name":"festive-brief","description":"Diwali angle + offers"},{"name":"creatives","description":"Festive creatives produced"},{"name":"review","description":"Founder review"},{"name":"publish-calendar","description":"Posting calendar set"}]',
   '[{"name":"Write Diwali brief","agent":"seo_specialist","step_name":"festive-brief"},{"name":"Produce festive creatives","agent":"ceo","step_name":"creatives"}]',
   '[{"name":"diwali-review-gate","action":"file_deliverable","risk_tier":"write","after_step":"review"}]'),
  ('seo-retainer', 'SEO Retainer', 'retainer', 1,
   'SEO retainer: audits + on-page + monthly reporting loop.',
   '[{"name":"audit","description":"SEO audit"},{"name":"on-page","description":"On-page fixes"},{"name":"report","description":"Monthly SEO report"},{"name":"invoice","description":"Invoice raised"}]',
   '[{"name":"Run SEO audit","agent":"seo_specialist","step_name":"audit"},{"name":"Apply on-page fixes","agent":"seo_specialist","step_name":"on-page"}]',
   '[{"name":"seo-report-gate","action":"file_deliverable","risk_tier":"write","after_step":"report"}]');

-- 6. touch trigger on playbooks (updated_at)
create trigger trg_playbooks_touch before update on public.playbooks
  for each row execute function public.touch_updated_at();
create trigger trg_agent_memory_touch before update on public.agent_memory
  for each row execute function public.touch_updated_at();
