# SPRINT 1 REPORT — "Show Me The Work"

**Commit:** `3af845b` — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, SPRINT 1
**Date:** 2026-09-26

---

## Discovery FIRST (the plan's opening question — answered with live evidence)

**"For a completed 'write a LinkedIn post' task, where exactly is the post text?"**

→ **Buried inside `tasks.metadata.output` (JSONB)** — the raw Hermes profile-run terminal dump, 8,816 chars: warnings ("Unknown toolsets"), tool-call diffs (write_file trace), the deliverable wrapped inside a `╭─ ☤ Hermes ─╮ … ╰────╯` result panel, and a session trailer ("Resume this session with: …"). The `content` table (the other candidate) has **0 rows**. There was **no `task_outputs` table** — agents' deliverables were never first-class data.

Also observed live: task `b4544df0` correctly closed **blocked** when NVIDIA NIM returned 429 (failure-sniff works); the 09-26 rate-limit window was real, not a bug.

## Shipped

### Backend
| File | What |
|---|---|
| `api/migrations/2026-09-26-sprint1-task-outputs.sql` | `task_outputs` table: `id UUID PK, task_id FK CASCADE, kind text\|image\|file\|link (CHECK), title, body TEXT, meta JSONB, created_at` + **index `(task_id, created_at DESC)`** (§4.2) + RLS. Re-runnable (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Applied via Supabase **Management API** (MCP connection timed out — reported, workaround used). |
| `api/src/deliverable-extract.ts` | `extractDeliverable()`: text **inside** the `╭─ ☤ Hermes ─╮…╰╯` result panel = the deliverable; strips ANSI (real ESC bytes AND literal `\u001b` text — both exist in stored outputs); link/image kinds; conservative fallback = full raw output (`extracted:false`). Never empty, never faked. |
| `api/src/engines/agent-execution.ts` | On task completion → insert `task_outputs` row (best-effort; never fails the task). |
| `api/src/routes/tasks.ts` | `GET /api/v1/tasks/:id` → task + timeline + `outputs[]`; `GET /api/v1/outputs` → paginated (§4: `limit` default 20 max 100, `offset`), joined with `tasks`. No backfill (per plan). |
| `api/src/routes/special-handler.ts` | "Show me the work" retrieval intents: `show me the linkedin post` / `ceo ne kya banaya` / `post dikhao` / `what did social make` → direct DB lookup, **no LLM round-trip, no new task dispatch**. Regex guard: creation verbs (write/draft/create/banao/likho…) NEVER match. **14/14 unit tests** on the matcher. |
| `api/src/routes/dashboard.ts` | `/api/outputs` bridge: empty `content`-table source → real `task_outputs` join. |

### Frontend
| File | What |
|---|---|
| `src/app/tasks/[id]/page.tsx` | Task detail: status header (pill + @agent + created), **Timeline** (created/started/completed/failed), **Outputs formatted by kind** — a post renders like a post (avatar row, @handle, char count, body, **Copy button**), never a JSON dump. Honest "No outputs yet — agent is working" empty state + failure-detail panel. 15s auto-refresh while running. (Next 14: `useParams`, not `use()`.) |
| `src/app/page.tsx` | **Fake data killed** (plan rule #2): `OUTPUT_FALLBACK` (`Post copy/SEO brief/Logo SVG/Deck page`) and `ASSET_FALLBACK` (`Brand Kit/Deck v1/Logo Suite/…`) grids DELETED → real `/api/outputs` + `/api/assets` feeds with honest empty states. |
| `src/components/TaskRunsPanel.tsx` | "Open task detail →" link per task (routes to `/tasks/[id]`). |

## Acceptance proofs

- **A1** — delegate "…LinkedIn post…" → task `93757998` **done** → `task_outputs` row created → task page shows the actual post (**vision-verified** `task-detail-1440.png`: DONE pill, @social, timeline CREATED+COMPLETED, deliverable card with body + 839-char count). Deliverable text reachable **within 2 clicks** (Recent Jobs → Open task detail), Copy button present (DOM-measured).
- **A2** — task detail shows timeline + output (screenshot above; `hasTimeline/hasOutputs` sections in DOM).
- **A3** — no-output task (`b4544df0`, blocked) shows **"No outputs yet"** honestly (`task-no-outputs-1440.png`).
- **Command bar** — `"show me the linkedin post"` → `mode: show_output`, returns latest deliverable + task_id, **no dispatch** (first version had a null-vs-false sentinel bug — dispatched wrongly once; fixed + re-tested). `"ceo ne kya banaya"` → deliverable for ceo. `"banao ek short post"` → still dispatches (guard holds).
- **Live data** — 5 `task_outputs` rows now exist from real runs, incl. Hindi deliverable "AI पर शॉर्ट पोस्ट" (2 post options + hashtags) with `extracted:true`, zero ANSI noise (unit-tested against the real raw output).
- **Build** — `tsc --noEmit` 0 errors; `next build` ✓ 24/24. Home @1440/@390 + task pages: `overflowX: false`.

## §2 corrections

- None new this sprint. (Prior corrections already reported: Laya map, Laya adapter location, profile name `engineer`.)

## Deliberately left out

- No backfill of historical `metadata.output` into `task_outputs` (plan: "wire the write path on task completion (no backfill)").
- Approvals deliverable previews → **Sprint 7**.
- Diorama label → task detail link → **Sprint 6**.

## Laya decision log sample

| input | department | route | evidence |
|---|---|---|---|
| "show me the linkedin post" | — (System-1-style direct lookup, not routed) | task_outputs query | deliverable returned, 0 dispatch |
| "banao ek short post about AI" | content→social | dispatch task `72b905f3` | done + output row |

## Evidence files (`docs/evidence/sprint-1/`)

`home-1440.png` (real outputs feed), `home-390.png`, `task-detail-1440.png` (full deliverable render), `task-detail-390.png`, `task-no-outputs-1440.png` (A3 honest empty state).
