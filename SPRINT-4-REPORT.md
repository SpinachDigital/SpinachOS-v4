# SPRINT 4 REPORT — "Pipeline End-to-End"

**Commit:** `4c8e907` — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, SPRINT 4
**Date:** 2026-09-30

---

## Shipped

### Backend
| What | Detail |
|---|---|
| `GET /api/v1/pipelines/:id` (new, `routes/pipeline.ts`) | pipeline row (**workflows = the pipeline table** per `schema.sql`; `steps_json` = stages), `stages[]` with computed per-stage status/timestamps, `client_name` join, `history[]` = per-step started/completed trail — **paginated §4** (`limit` default 20, max 100, `offset`). 404 for missing pipelines — no silent 404. |
| `POST /api/v1/pipeline/advance` | **Unchanged** (exact path/method/auth/response shape). Sequence enforcement verified live. |

### Frontend
| What | Detail |
|---|---|
| `/pipeline/[id]/page.tsx` — **real detail page** (was a 48-line placeholder) | `PipelineHeader` + `PipelineSteps` + `StepDetail` **mounted** (unmounted since the Phase 3 rebuild) via a `STEPS_ADAPTER`. Live from the new GET + 10s poll while active. **Advance button** for the current in-progress stage (inline success/error banner — 409 "Steps out of order" surfaces). History section with timestamps + honest empty state. 404 + API-unreachable error states (no fake data). |
| `PipelineHeader.tsx` fixes | **"Mira Road Gym" placeholder KILLED** → `client_name` from the payload; hardcoded `/8` → dynamic `steps.length`; subtitle from `pipeline.name`. |

## Acceptance proofs

| Criterion | Result |
|---|---|
| open client → see stage → advance → history updates, ≤30s | ✅ **measured 1.5s**: `/pipeline/cec644d0` (keo karpin, active, 8 stages) → header `keo karpin · 0% · step 0/8` → click "Advance strategy" → banner "Advanced — next: task_breakdown (CTO, 13%)" → history shows `COMPLETED strategy` + `STARTED task_breakdown — assigned to cto` |
| Screen-recorded evidence | ✅ screenshots `pipeline-detail-1440.png` (vision-verified: real client name, 8 stages + agents, Advance btn), `pipeline-after-advance-1440.png` (success banner + 13% + step 1/8), `pipeline-detail-360.png` (`overflowX: false`) |
| No silent 404 | ✅ `/pipeline/<bad-id>` → honest "Pipeline not found" banner; `/pipeline` (index) intentionally not in nav — reachable only via deep links from Projects/tasks (same pattern as `/kanban`) |
| Sequence enforcement | ✅ advance `content_creation` with `strategy` in-progress → **409** "Steps out of order — strategy, task_breakdown, lead_generation" (workflow reset to pre-test state after) |
| `tsc --noEmit` + `next build` clean | ✅ 0 errors; ✓ compiled + static gen |

## §2 corrections
- None new. Note recorded in-code: the plan's "pipelines" concept maps to the existing `workflows` table (`steps_json` = stages) — no new table invented.

## Deliberately left out
- `/pipeline` index page (nav stays clean — "no placeholders in navigation"; deep links reach detail directly).
- Gantt/calendar view of pipelines → later (not in Sprint 4 scope).
- Retainer loop, war-room → already shipped earlier phases; untouched.

## Laya decision log sample

| input | route | evidence |
|---|---|---|
| "advance strategy" on pipeline page | direct endpoint call (explicit side-effect, founder authority — button, no Laya) | POST advance, 409 guard verified |

## Next
Sprint 5 — HR Department (migrations + watcher + hr.ts rewrite + hr_director profile + real /team page).
