# SPRINT 6 REPORT — "Living Office"

**Commit:** `9d28e0e` — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, SPRINT 6
**Date:** 2026-10-01

---

## Shipped

### Frontend — the 3D Diorama comes alive
| What | Detail |
|---|---|
| `DioramaViewer.tsx` (rewrite) | Floating HTML labels per agent zone: name + truncated task line (`✍️ task…` / `idle`) + status dot (green = working, gray = idle). Anchored to the module's OWN dept-label positions — `src/lib/office-diorama/zone-centers.ts` (new) consumes them verbatim, nothing reimplemented. Module source untouched (evidence discipline, no iframe). |
| Camera capture | OrbitControls subclass: the module calls `new OrbitControls(…)` with OUR class, which records `this.object` — camera projected label positions without touching module code. |
| Live data | WS `agentStates` + `/api/v1/hr/roster` poll, throttled to ~2s (no re-render storms). Task text from roster `current_task.title`. **Honesty: `idle` when no running task — never invented.** |
| Interactions | `labels on/off` toggle; label click → `/tasks/[id]` (Sprint 1 detail page) when a task exists. |
| Mobile compact mode | `< 600px` viewport: labels collapse to dot + name (task stays in `title` attr) — kills the 390px label collision seen in acceptance. |
| `next.config.js` | `/office` → `/` redirect REMOVED — the Living Office ships at `/office`. |

### Backend — MUST-FIXes from the audit
| What | Detail |
|---|---|
| `api/src/routes/hr.ts` | `POST /hr/hire` REWRITTEN: ONLY existing `hermes-profiles/<dir>` agents accepted (400 on unknown id, 409 if already active in `hr_agents`), fully DB-backed via `hr_agents`, agentRegistry + fake `performance_score: 100` GONE. Same treatment applied to `/hr/agent-message`, `/hr/bulk-action`, `/hr/agent-task`, `/hr/departments`, `/hr/agents`, `/hr/org-chart` — all DB-backed now. |
| `api/src/ctx.ts`, `standup.ts` | Supporting fixes for the above (typed HR context, standup reads DB roster). |

### Evidence discipline
| What | Detail |
|---|---|
| `docs/evidence/sprint-6/` (new) | 4 screenshots + README: `labels-initial-1440.png`, `labels-live-tasks-1440.png`, `after-assign-sales-1440.png`, `office-390-compact.png`. Method: real Chromium via CDP (isolated profile), `Page.captureScreenshot`, overflow via `scrollWidth` vs `clientWidth`. |
| `docs/evidence/sprint-2/audit-after.json` | Regenerated with a REAL click-probe (green) — replaces the fabricated-looking artifact. |

---

## Acceptance proofs
| Criterion | Result |
|---|---|
| Diorama renders natively (no iframe) + toggles | ✅ `labels-initial-1440.png`: 3D scene + `labels on` + lighting toggles + module zone badges |
| Labels show LIVE task text | ✅ `labels-live-tasks-1440.png`: Social `✍️ @social draft a one-line announcem…`, Research `✍️ research competitor Haldiram for a…` (green dot), Orchestrator `✍️ Onboard client "Vertex Realty"…` |
| Assign → bubble update in seconds | ✅ `POST /api/v1/hr/agent-task` measured **545 ms**; Sales bubble shows the new task within ~7 s (2 s roster poll + 2 s RAF throttle) — `after-assign-sales-1440.png` |
| 390px clean | ✅ `office-390-compact.png`: compact labels (dot + name), no overlap, no horizontal overflow |
| `tsc --noEmit` | ✅ 0 errors (frontend) |
| `next build` | ✅ Compiled successfully, 22/22 static pages, exit 0 |
| Stack left healthy | ✅ dev server restarted post-build (`next build` overwrites `.next` while dev runs), `/office` 200 after restart |

## Debug hooks
- `window.__sprint6debug` was a temporary CDP probe hook — REMOVED from shipped code (final `tsc` 0 errors after removal).

## Deliberately left out
- Label drag + custom anchors (mouse orbit conflicts) → later sprint if wanted.
- 3D task ribbons inside the scene (HTML labels chosen — crisper text, cheaper).

## Next
Sprint 7 per plan — hiring flow via hr_director (Sprint 5 carry-over) + next spec section.
