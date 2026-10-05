# Migration Order — SpinachOS-v4 (Phase 5, GOAL 3)

Ordered, idempotent. A fresh database builds top-to-bottom with zero manual steps
(`node supabase/migrations/run.js` with `DATABASE_URL`, or SQL Editor in this order).
Legacy drift files (sprint-era) live in `supabase/*.sql` — the canonical set is below.

| # | File | Creates / changes |
|---|------|-------------------|
| 000 | `000-schema.sql` | Core: clients, leads, tasks, workflows, agent_states, approvals, usage_logs base |
| 010 | `010-fix-tasks-assigned-to.sql` | tasks.assigned_to fix |
| 011 | `011-fix-agent-states-profile-check.sql` | agent_states profile CHECK fix |
| 020 | `020-p1-backend-gaps.sql` | P1 backend gap tables |
| 030 | `030-v4-extended.sql` | v4 extensions |
| 031 | `031-v6-hierarchy.sql` | task hierarchy |
| 032 | `032-v6-retainer.sql` | retainer cycle |
| 040 | `040-phase4-rag.sql` | knowledge_chunks + pgvector |
| 041 | `041-phase4-comms-social.sql` | content_calendar + comms |
| 050 | `050-sprint9-win.sql` | outreach_drafts, outreach_messages, leads qualification cols |
| 051 | `051-sprint10-deliver.sql` | gate_actions, deliverables, pipeline_events |
| 052 | `052-sprint10-approvals-type.sql` | approvals type CHECK (stuck_stage + historical types) |
| 053 | `053-sprint11-create-pl.sql` | usage_logs cost cols, model_rates, clients.monthly_value |
| 054 | `054-sprint12-playbooks-ledger.sql` | agent_memory, playbooks (+ idempotent triggers) |
| 055 | `055-sprint13-publish-type.sql` | approvals type += publish |
| 060 | `060-phase5-hardening.sql` | job_queue, laya_routing_decisions, provider_keys, department_model_picks |
| 061 | `061-phase5-rls.sql` | RLS hardening — DROP all USING(true); service_role-only policies |

Notes:
- 054's pack uniqueness is `(slug, version)` (composite — Supabase auto-named constraint dropped via pg_constraint DO-block).
- 061 is LAST by design: after it, only the backend (service_role) reads/writes data tables.
- Sprint-era files (`supabase/migration-sprint*.sql`) are historical records of what was applied via SQL Editor; the `migrations/` set above is the canonical build path for a fresh DB.
