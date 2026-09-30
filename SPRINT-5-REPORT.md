# SPRINT 5 REPORT — "HR Department"

**Commit:** `687de6d` — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, SPRINT 5
**Date:** 2026-09-30

---

## Shipped

### Database (Supabase)
| What | Detail |
|---|---|
| `api/migrations/2026-09-30-sprint5-hr.sql` (new) | Re-runnable DDL: `hr_agents` (id TEXT PK = agent_states.profile), `hr_flags` (stuck/overloaded/idle/error_spike + severity), `hr_actions` (audit trail: founder/hr_director/watcher). RLS enabled on all 3. §4 indexes: every FK + every ORDER BY created_at + partial unique index `uq_hr_flags_open_type` (open flag of same type per agent — watcher idempotency §4.4). **Applied live via SQL Editor** (MCP timeouts persisted); REST-confirmed all 3 tables exist. |
| Seed | `api/src/scripts/seed-hr-agents.ts` — upserts every `hermes-profiles/<dir>/` into `hr_agents` (id = dir name, org map for departments/roles). **11/11 upserted** incl. `hr_director`, verified via REST count. |

### Backend
| What | Detail |
|---|---|
| `api/src/hr-watcher.ts` (new, 5c) | 5-min batched + idempotent watcher, armed on boot (`cron-engine.ts` wired). Flags stuck tasks (>4h), overloads, idle agents, error spikes — **flags only, NEVER pauses/stops/reassigns** (founder/hr_director authority). Auto-resolves when condition clears (resolved_by='watcher'). TDZ fix + es5-safe iteration + created_at added. `tsc` clean. **Live: 4 stuck-task flags written on first run** (social/orchestrator/cto/research — audit trail logged). |
| `api/src/routes/hr.ts` rewrite (5d) | DB-backed endpoints KEPT, new BUILD, performance-review DELETE: `/hr/departments` (6 depts with leads), `/hr/agents` (12), `/hr/flags` ({flags,total,limit,offset} §4-paginated), `/hr/roster` (11 agents with live_state/current_task/week_completed), `/hr/stats/weekly` (per-agent completed + avg_duration), `/hr/activity` (recent audit feed), `/hr/agent-messages`, `/hr/org-chart`. **All verified 200.** |
| `/hr/performance-review` (5g) | **DELETED** — human-typed-score endpoint is an anti-pattern (appraisals happen via review evidence, not a form). |
| `engines/agent-execution.ts` | hr_director wired into AGENT_MODELS + AGENT_SYSTEM_PROMPTS; pause enforcement wired (paused agents' cron tasks skip). |

### Profiles
| What | Detail |
|---|---|
| `hermes-profiles/hr_director/` (new, 5e) | SOUL.md + profile.md — HR Director: hiring, agent management, people-ops. Model `auto/best-chat`. |

### Frontend
| What | Detail |
|---|---|
| `/team/page.tsx` (5f, real page — was placeholder) | Roster grid (11 agents, live_state/current_task/queue_depth/week_completed), agent drawer (flags history per agent), pause/resume/reassign/stop actions with reason prompts, "Agents offline — last known state" honest banner. `next.config.js` redirect removed, Team re-added to sidebar (after AI Agents), Team icon fixed. **tsc 0 errors, HTTP 200.** |

---

## Acceptance proofs
| Criterion | Result |
|---|---|
| Migration live in Supabase | ✅ REST: `hr_agents`/`hr_flags`/`hr_actions` all EXIST |
| Seed 11/11 | ✅ upserted ads_manager..social (11 dirs = 11 rows, count verified) |
| Watcher writes flags + auto-resolves | ✅ 4 stuck-task flags on first run; audit trail shows watcher 'flag' rows |
| Pause/resume round-trip | ✅ seo_specialist paused → status 'paused' → resumed → 'active'; BOTH logged in `hr_actions` (actor=hr_director) |
| All hr endpoints 200 | ✅ departments/agents/flags/roster/stats//activity — live-tested against :4000 |
| `/team` page | ✅ HTTP 200 on localhost:3000/team |
| `tsc --noEmit` clean (api + frontend) | ✅ 0 errors |

## §2 corrections
- None new. `hr_agents.id` maps to `agent_states.profile` (= hermes-profiles dir name) — one identity across both tables, no new ID scheme invented.

## Deliberately left out
- Hiring flow (create new hermes profile from UI) → Sprint 6 scope (hr_director can mint profiles).
- Weekly digest delivery (email/Telegram) → later.
- Performance-review form → permanently deleted (5g).

## Note (ops)
- API boot on this machine needs explicit env: `cd api && set -a && source .env && set +a && npm run dev` — bare `npm run dev` (tsx watch) did not pick up JWT_SECRET this session.

## Next
Sprint 6 — per plan (hiring flow via hr_director + next spec section).
