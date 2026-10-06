-- =====================================================================
-- PHASE 6 GOAL 2 — Packages become playbooks (the money goal)
-- Product catalog v1: 7 packages (4 one-time + 3 retainers) as VERSIONED
-- PLAYBOOKS + 10 à la carte items as add-on task templates (metadata).
--
-- Idempotent: uses the (slug, version) composite unique — re-running just
-- no-ops (on conflict do nothing). Existing packs (workflow-type v1/v2,
-- campaign packs) stay untouched.
--
-- PRICES ARE REAL (public site lineup, Phase 6 prompt §GOAL 2):
--   ONE-TIME: Brand Identity ₹14,999 · Digital Launch ₹19,999 ·
--             AI Chat Agent ₹12,999 · Workflow System ₹24,999
--   RETAINERS: Growth ₹14,999/mo · Scale ₹24,999/mo · Agent Care ₹7,999/mo
--   À LA CARTE: 10 items (₹4,999–₹19,999) — stored as playbook entries with
--             workflow_type='addon', referenced by add-ons in the designer.
-- =====================================================================

-- ---------- helper: playbooks already have (slug, version) unique ----------

-- ============ ONE-TIME PACKAGES (workflow_type='package') ============

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('pkg-brand-identity', 'Brand Identity', 'package', 1,
 'Logo + brand system. 3 concepts, refinement, guidelines + tone/DNA, deck, mini website, on-page SEO, GMB hygiene, 1 launch video. ₹14,999 one-time.',
 '[{"name":"concept","description":"3 logo concepts, code-drawn SVG"},{"name":"refinement","description":"Founder picks, 2 revision rounds"},{"name":"guidelines","description":"Usage guidelines + tone of voice + brand DNA doc"},{"name":"deck","description":"Brand deck (10 slides)"},{"name":"mini_site","description":"1-page mini website"},{"name":"seo","description":"On-page SEO setup"},{"name":"gmb","description":"GMB hygiene pass"},{"name":"launch_video","description":"1 launch video (30s)"}]',
 '[{"name":"3 logo concepts","agent":"designer","step_name":"concept"},{"name":"refine chosen concept","agent":"designer","step_name":"refinement"},{"name":"brand guidelines + DNA","agent":"designer","step_name":"guidelines"},{"name":"brand deck","agent":"designer","step_name":"deck"},{"name":"mini website","agent":"engineer","step_name":"mini_site"},{"name":"on-page SEO","agent":"seo_specialist","step_name":"seo"},{"name":"GMB hygiene","agent":"seo_specialist","step_name":"gmb"},{"name":"launch video","agent":"social","step_name":"launch_video"}]',
 '[{"name":"Concept approval","action":"file_deliverable","risk_tier":"read","after_step":"concept"},{"name":"Deck approval","action":"file_deliverable","risk_tier":"read","after_step":"deck"},{"name":"Launch approval","action":"external_send","risk_tier":"external","after_step":"launch_video"}]',
 '{"price_inr":14999,"billing":"one_time","package_key":"brand_identity"}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('pkg-digital-launch', 'Digital Launch', 'package', 1,
 '8-page site + copy + responsive + SEO + WhatsApp + analytics + QA + launch. ₹19,999 one-time.',
 '[{"name":"site","description":"8-page website build"},{"name":"copy","description":"Full page copy"},{"name":"responsive","description":"Mobile/tablet pass"},{"name":"seo","description":"On-page SEO + schema"},{"name":"whatsapp","description":"WhatsApp click-to-chat wiring"},{"name":"analytics","description":"GA4 + events"},{"name":"qa","description":"QA pass (all pages)"},{"name":"launch","description":"DNS + deploy + announcement"}]',
 '[{"name":"8-page site","agent":"engineer","step_name":"site"},{"name":"page copy","agent":"social","step_name":"copy"},{"name":"responsive pass","agent":"engineer","step_name":"responsive"},{"name":"SEO setup","agent":"seo_specialist","step_name":"seo"},{"name":"WhatsApp wiring","agent":"engineer","step_name":"whatsapp"},{"name":"analytics setup","agent":"engineer","step_name":"analytics"},{"name":"QA pass","agent":"cto","step_name":"qa"},{"name":"launch","agent":"orchestrator","step_name":"launch"}]',
 '[{"name":"Site approval","action":"file_deliverable","risk_tier":"read","after_step":"site"},{"name":"Launch approval","action":"external_send","risk_tier":"external","after_step":"launch"}]',
 '{"price_inr":19999,"billing":"one_time","package_key":"digital_launch"}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('pkg-ai-chat-agent', 'AI Chat Agent', 'package', 1,
 'WhatsApp + website bot, trained on the business, lead capture, CRM, human handoff. ₹12,999 one-time.',
 '[{"name":"bot_setup","description":"WhatsApp + website bot scaffold"},{"name":"training","description":"Trained on business docs (RAG ingest)"},{"name":"lead_capture","description":"Lead capture wiring"},{"name":"crm","description":"CRM integration"},{"name":"handoff","description":"Human handoff rules"},{"name":"qa","description":"Test conversations QA"}]',
 '[{"name":"bot scaffold","agent":"engineer","step_name":"bot_setup"},{"name":"train on business docs","agent":"engineer","step_name":"training"},{"name":"lead capture","agent":"engineer","step_name":"lead_capture"},{"name":"CRM integration","agent":"engineer","step_name":"crm"},{"name":"handoff rules","agent":"cto","step_name":"handoff"},{"name":"conversation QA","agent":"cto","step_name":"qa"}]',
 '[{"name":"Bot approval","action":"file_deliverable","risk_tier":"read","after_step":"bot_setup"},{"name":"Handoff approval","action":"file_deliverable","risk_tier":"write","after_step":"handoff"}]',
 '{"price_inr":12999,"billing":"one_time","package_key":"ai_chat_agent"}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('pkg-workflow-system', 'Workflow System', 'package', 1,
 '3 custom AI workflows + CRM + 30-day support. ₹24,999 one-time.',
 '[{"name":"discovery","description":"Workflow discovery (3 candidate flows)"},{"name":"build_1","description":"Workflow 1 build"},{"name":"build_2","description":"Workflow 2 build"},{"name":"build_3","description":"Workflow 3 build"},{"name":"crm","description":"CRM integration"},{"name":"support","description":"30-day support window"}]',
 '[{"name":"discovery doc","agent":"cto","step_name":"discovery"},{"name":"build workflow 1","agent":"engineer","step_name":"build_1"},{"name":"build workflow 2","agent":"engineer","step_name":"build_2"},{"name":"build workflow 3","agent":"engineer","step_name":"build_3"},{"name":"CRM integration","agent":"engineer","step_name":"crm"},{"name":"support log setup","agent":"cto","step_name":"support"}]',
 '[{"name":"Discovery approval","action":"file_deliverable","risk_tier":"read","after_step":"discovery"},{"name":"Final approval","action":"file_deliverable","risk_tier":"write","after_step":"build_3"}]',
 '{"price_inr":24999,"billing":"one_time","package_key":"workflow_system"}')
on conflict (slug, version) do nothing;

-- ============ RETAINERS (workflow_type='retainer') ============

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('ret-growth', 'Growth Retainer', 'retainer', 1,
 '12 posts + 4 reels monthly, approval-gated calendar, 2 SEO blogs, GMB, monthly report. ₹14,999/mo.',
 '[{"name":"calendar","description":"Monthly content calendar (12 posts + 4 reels)"},{"name":"production","description":"Posts + reels production"},{"name":"seo_blogs","description":"2 SEO blogs"},{"name":"gmb","description":"GMB posts"},{"name":"report","description":"Monthly report"}]',
 '[{"name":"content calendar","agent":"social","step_name":"calendar"},{"name":"12 posts","agent":"social","step_name":"production"},{"name":"4 reels","agent":"social","step_name":"production"},{"name":"2 SEO blogs","agent":"seo_specialist","step_name":"seo_blogs"},{"name":"GMB posts","agent":"seo_specialist","step_name":"gmb"},{"name":"monthly report","agent":"seo_specialist","step_name":"report"}]',
 '[{"name":"Calendar approval","action":"file_deliverable","risk_tier":"read","after_step":"calendar"},{"name":"Report approval","action":"file_deliverable","risk_tier":"read","after_step":"report"}]',
 '{"price_inr":14999,"billing":"monthly","package_key":"growth","cycle_days":30}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('ret-scale', 'Scale Retainer', 'retainer', 1,
 'Growth + Meta/Google ads management, 8 creatives, landing page, weekly reports, WhatsApp automation, priority queue. ₹24,999/mo.',
 '[{"name":"calendar","description":"Monthly calendar (Growth included)"},{"name":"ads","description":"Meta + Google ads management"},{"name":"creatives","description":"8 ad creatives"},{"name":"landing","description":"Monthly landing page"},{"name":"whatsapp","description":"WhatsApp automation upkeep"},{"name":"report","description":"Weekly reports"}]',
 '[{"name":"content calendar","agent":"social","step_name":"calendar"},{"name":"ads management","agent":"ads_manager","step_name":"ads"},{"name":"8 creatives","agent":"designer","step_name":"creatives"},{"name":"landing page","agent":"engineer","step_name":"landing"},{"name":"WhatsApp automation","agent":"engineer","step_name":"whatsapp"},{"name":"weekly reports","agent":"ads_manager","step_name":"report"}]',
 '[{"name":"Calendar approval","action":"file_deliverable","risk_tier":"read","after_step":"calendar"},{"name":"Ads spend approval","action":"external_send","risk_tier":"external","after_step":"ads"},{"name":"Report approval","action":"file_deliverable","risk_tier":"read","after_step":"report"}]',
 '{"price_inr":24999,"billing":"monthly","package_key":"scale","cycle_days":30}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('ret-agent-care', 'Agent Care Retainer', 'retainer', 1,
 'Bot monitoring, retraining, monthly report, priority fixes. ₹7,999/mo.',
 '[{"name":"monitor","description":"Bot health monitoring"},{"name":"retrain","description":"Monthly retraining pass"},{"name":"fixes","description":"Priority fixes queue"},{"name":"report","description":"Monthly report"}]',
 '[{"name":"health check","agent":"cto","step_name":"monitor"},{"name":"retraining pass","agent":"engineer","step_name":"retrain"},{"name":"priority fixes","agent":"engineer","step_name":"fixes"},{"name":"monthly report","agent":"cto","step_name":"report"}]',
 '[{"name":"Report approval","action":"file_deliverable","risk_tier":"read","after_step":"report"}]',
 '{"price_inr":7999,"billing":"monthly","package_key":"agent_care","cycle_days":30}')
on conflict (slug, version) do nothing;

-- ============ À LA CARTE ADD-ONS (workflow_type='addon') ============
-- Attachable to any install via the Package Designer (add-ons array).

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-logo-refresh', 'Logo Refresh', 'addon', 1, 'Logo refresh. ₹4,999.', '[{"name":"refresh","description":"Logo refresh (2 options)"}]', '[{"name":"logo refresh","agent":"designer","step_name":"refresh"}]', '[]', '{"price_inr":4999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-landing-page', 'Landing Page', 'addon', 1, 'Single landing page. ₹7,999.', '[{"name":"landing","description":"1 landing page build"}]', '[{"name":"landing page","agent":"engineer","step_name":"landing"}]', '[{"name":"Page approval","action":"file_deliverable","risk_tier":"read","after_step":"landing"}]', '{"price_inr":7999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-seo-audit', 'SEO Audit + Fix', 'addon', 1, 'SEO audit + fixes. ₹5,999.', '[{"name":"audit","description":"Full SEO audit"},{"name":"fix","description":"Audit fixes applied"}]', '[{"name":"SEO audit","agent":"seo_specialist","step_name":"audit"},{"name":"audit fixes","agent":"engineer","step_name":"fix"}]', '[{"name":"Audit approval","action":"file_deliverable","risk_tier":"read","after_step":"audit"}]', '{"price_inr":5999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-social-starter', 'Social Starter Pack', 'addon', 1, '10 posts. ₹4,999.', '[{"name":"pack","description":"10 posts production"}]', '[{"name":"10 posts","agent":"social","step_name":"pack"}]', '[{"name":"Pack approval","action":"file_deliverable","risk_tier":"read","after_step":"pack"}]', '{"price_inr":4999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-reels-pack', 'Reels Pack ×4', 'addon', 1, '4 reels. ₹6,999.', '[{"name":"reels","description":"4 reels production"}]', '[{"name":"4 reels","agent":"social","step_name":"reels"}]', '[{"name":"Reels approval","action":"file_deliverable","risk_tier":"read","after_step":"reels"}]', '{"price_inr":6999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-ad-campaign', 'Ad Campaign Setup', 'addon', 1, 'Campaign setup. ₹7,999.', '[{"name":"campaign","description":"Ad campaign setup"}]', '[{"name":"campaign setup","agent":"ads_manager","step_name":"campaign"}]', '[{"name":"Campaign approval","action":"external_send","risk_tier":"external","after_step":"campaign"}]', '{"price_inr":7999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-brand-deck', 'Brand Deck', 'addon', 1, 'Brand deck. ₹4,999.', '[{"name":"deck","description":"Brand deck (10 slides)"}]', '[{"name":"brand deck","agent":"designer","step_name":"deck"}]', '[{"name":"Deck approval","action":"file_deliverable","risk_tier":"read","after_step":"deck"}]', '{"price_inr":4999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-extra-workflow', 'Extra AI Workflow', 'addon', 1, '1 extra AI workflow. ₹6,999.', '[{"name":"workflow","description":"1 extra AI workflow build"}]', '[{"name":"workflow build","agent":"engineer","step_name":"workflow"}]', '[{"name":"Workflow approval","action":"file_deliverable","risk_tier":"write","after_step":"workflow"}]', '{"price_inr":6999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-voice-agent', 'AI Voice Agent Setup', 'addon', 1, 'Voice agent setup. ₹19,999.', '[{"name":"voice","description":"AI voice agent setup"}]', '[{"name":"voice agent","agent":"engineer","step_name":"voice"}]', '[{"name":"Voice approval","action":"file_deliverable","risk_tier":"write","after_step":"voice"}]', '{"price_inr":19999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

insert into public.playbooks (slug, name, workflow_type, version, description, stages_json, tasks_json, gates_json, metadata)
values
('addon-crm-integration', 'CRM Integration', 'addon', 1, 'CRM integration. ₹7,999.', '[{"name":"crm","description":"CRM integration"}]', '[{"name":"CRM integration","agent":"engineer","step_name":"crm"}]', '[{"name":"CRM approval","action":"file_deliverable","risk_tier":"write","after_step":"crm"}]', '{"price_inr":7999,"billing":"one_time","addon":true}')
on conflict (slug, version) do nothing;

-- ============ clients.package_booked (P&L revenue feeds from the package) ============
alter table public.clients
  add column if not exists package_slug text,
  add column if not exists package_price_inr integer,
  add column if not exists package_billing text default 'one_time';
