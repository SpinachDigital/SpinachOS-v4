# SpinachOS-v4 — Phases 1–3 Report (Reliability + UI/UX + Monolith Split)

**Date:** 2026-09-25 · **Repo:** `SpinachDigital/SpinachOS-v4` · **Branch:** `main`
**Commits:** P0 security (9b6e0f3) → P1 reliability (`25cdda7`) → P2 UI/UX (`2bff6fc`) → P3 monolith split (`b1c5808`) — all pushed, verified on remote (`b1c5808f665…`).

---

## PHASE 1 — Reliability Batch ✅ (commit `25cdda7`)

### Task 1 — Service auto-restart
| Deliverable | Detail |
|---|---|
| `scripts/start-all.ps1` | Starts API :4000, Laya :8000, frontend :3000 detached; waits for health (:4000 ok, :8000 ok, :3000 200); logs to `logs/` |
| `scripts/stop-all.ps1` | Clean shutdown of all three |
| `scripts/watchdog.ps1` | Health-check + restart dead services; UTF-8 BOM added (PS 5.1 parse fix) |
| Watchdog mechanism | **Windows Scheduled Task `SpinachOS-Watchdog`** — every 5 min, simpler and more reliable than a daemon-based watcher |

**Test evidence (real, not code review):**
- Killed Laya (pid 18752) → watchdog restarted it (pid 20936) → `/health` 200 → logged in `logs/`
- Scheduled Task state **Ready**, NextRun verified via `Get-ScheduledTask`/`Get-ScheduledTaskInfo`
- Kill-and-recover demonstrated within the 5-min window ✅

### Task 2 — `hermes-profiles/` version-controlled export
- **All 10 profiles exported** (ceo, cto, orchestrator, designer, engineer, social, seo_specialist, research, sales, ads_manager): `SOUL.md` + `profile.md` with skills list, tools, cron specs, model config (primary + fallback + provider), dormant flag, auth-state — **no tokens/secret values**
- `scripts/verify-profiles.ps1` (with `-Fix` mode): checks required skill bundles, missing pins, drift
- **Result: ALL 10 PROFILES CLEAN, 0 drift** ✅
- `hermes-profiles/README.md` — sync rule documented: **repo copy = versioned source of truth, Hermes live runtime = execution copy; changes applied through Hermes, re-exported here explicitly**

---

## PHASE 2 — UI/UX Polish ✅ (commit `2bff6fc`)

Scope: only `frontend/command-center/`. No redesign, no invented features.

| Item | Change | Evidence |
|---|---|---|
| Loading skeletons | RightRail first paint (Today/Agents/Health) — replaced the "checking…" gap that lasted up to 30s | `.skeleton` shimmer blocks render immediately on data-load |
| Empty states | Honest empty state w/ helpful copy on every list/table — no dead blank screens | "Awaiting first run" style honesty; no fake data |
| Error states | API unreachable → loud red banner ("API :4000 unreachable — check scripts/start-all.ps1") on RightRail + home | Not blank screens, not silent catches |
| Home `/` mock-fallback | **Removed** the hardcoded `FALLBACK_*` silent fallback — fails loudly now | Auth fix (57ccdb8) re-mints on 401, so only real outages surface |
| Mobile pass (≤680px) | All 10 routes verified | grids collapse 1-col, tables scroll in `.table-wrap`, hamburger drawer nav, no horizontal overflow |
| Consistency | Pages not covered by the revamp aligned to `.page/.page-head/.data-table/.pill` | no new visual language |

**Gate: `tsc --noEmit` 0 errors, all routes 200** ✅

---

## PHASE 3 — Monolith Split ✅ (commit `b1c5808`)

`api/src/index.ts`: **4,463 → 85 lines.** High-risk refactor done correctness-first.

### New structure
```
api/src/
├── index.ts               85 lines — thin bootstrap: mount routes, WS upgrade
│                            routing, error handler, listen. Nothing else.
├── ctx.ts                 THE ONE Express app + middleware + supabase + JWT +
│                            authMiddleware + WS emit helpers + sanitize + schemas
├── routes/                22 files, one per domain:
│    auth, models, agents, cron, kanban, approvals, clients, knowledge,
│    workflows, hr, standup, pipeline, retainer, command, laya, calendar,
│    comms, scrapers, telegram, marketing, dashboard, special-handler
├── engines/               agent-execution, pipeline-run, pipeline-qa, bridge
└── *-helpers.ts           command-intent, command-thread, warroom, laya-client,
                             dashboard, clients-presets, dormant, cron-engine,
                             step-descriptions, retainer-cycle/-cron-state,
                             pipeline-steps, knowledge-helper
```
Dead extraction artifacts (`engines/pipeline.ts`, `engines/pipeline2.ts` — superseded by `pipeline-run`/`pipeline-qa`) were removed, not committed.

### Rules compliance — no behavior changes
- Every endpoint keeps **exact path, method, auth, response shape** (extracted verbatim from the committed monolith `git show HEAD:api/src/index.ts`)
- `ctx.ts` exports ONE app instance per process (Node module cache) — identical middleware order
- WS `broadcast()` preserved **including the dashboard-adapter `activity.append` mirror** (spinach-os.html adapter contract) and the **agent-state DB persist** (schema-CHECK mapping paused→idle, fire-and-forget upsert)
- Pipeline engine preserved: HOD QA gate, D4 rework cap (2 cycles), director gate
- Special handler, command threads, war-room, laya proxy, telegram secret-verification — all verbatim

### Fix-ups during the split (all tsc-driven)
- Off-by-one range map fixed (true `app.` line starts, grep-verified)
- Import conflicts resolved (locals stripped where imports provide the symbol)
- Missing exports added (`ctx` regexes, presets, dashboard-helpers, pipeline-qa, retainer-cycle, step-descriptions, pipeline-steps)
- hr.ts schemas extended (`AgentMessageSchema` from_agent/to_agent/type/payload/requires_response; `BulkAgentActionSchema` start/stop/status)
- **Missing `routes/auth.ts` caught by the regression run** (404 on `/api/v1/auth/token`) — extracted from monolith L56–89 with P0 security intact, mounted first

### Test evidence (live on :4000, against the pre-split baseline)
| Check | Result |
|---|---|
| Regression — 28 endpoints | **28/28 match baseline**: 26×200 + 403 telegram (secret enforced) + 401 auth/token (P0) |
| `/api/v1/auth/token` no-auth | **401** "Token mint requires an existing director JWT…" ✅ |
| `/api/v1/auth/token` tampered token | **401** ✅ |
| Bootstrap mint (BOOTSTRAP_ADMIN_TOKEN) | Mints real director JWT → verified working on protected `/api/v1/profiles` (returns 10 profiles) ✅ |
| WS `/ws` + `/ws/activity` | **101 Switching Protocols** both ✅ |
| WS wrong path | **000 (connection destroyed)** ✅ |
| Crons armed | retainer-cron daily 09:00 IST, standup-daily-0930, cto-weekly-review, ceo-monthly-strategy ✅ |
| `tsc --noEmit` (split) | **0 errors** ✅ |
| Frontend :3000 / Laya :8000 | 200 / healthy ✅ (untouched by the split) |

---

## Bottom line
- **P1:** kill-and-recover demonstrated + profiles exported & verify clean → `25cdda7` pushed
- **P2:** skeletons + honest states + loud failures + mobile pass, 0 tsc errors → `2bff6fc` pushed
- **P3:** 4,463-line monolith → 85-line bootstrap + 22 route files, behavior-identical, 28/28 regression match on live :4000 → `b1c5808` pushed
- All 3 phases in order, commit+push after each, every claim backed by real execution output above.
