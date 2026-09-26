# SPRINT 2 REPORT — "No Dead Ends"

**Commits (pushed):** `0cc2584` (sprint) + `c2b2eca` (scratch cleanup) — `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, SPRINT 2
**Date:** 2026-09-27

---

## Per-page audit (real production data, click-tested @1440 + @360)

| Route | Label | Grade | Evidence |
|---|---|---|---|
| `/` | Command Center | 🟢 green | `home-1440.png`, `home-360.png` |
| `/projects` | Projects | 🟢 green | `projects-1440.png`, `projects-360.png` |
| `/agents` | AI Agents | 🟢 green | `agents-1440.png`, `agents-360.png` |
| `/clients` | Clients | 🟢 green | `clients-1440.png`, `clients-360.png` |
| `/marketing` | Marketing | 🟢 green (after fix) | `marketing-calendar-BEFORE-768.png` → `marketing-calendar-AFTER-360.png` / `-AFTER-1440.png` |
| `/analytics` | Analytics | 🟢 green | `analytics-1440.png`, `analytics-360.png` |
| `/approvals` | Approvals | 🟢 green | `approvals-1440.png`, `approvals-360.png` |
| `/settings` | Settings | 🟢 green | `settings-1440.png`, `settings-360.png` |

**Zero red. Zero yellow remaining. Zero dead sidebar links. Zero 360px overflows.** (Audit JSON: `audit-before.json` / `audit-after.json`.)

## Fixes shipped

### 1. Marketing calendar — genuinely responsive (hack killed)
- **Before:** `.week-grid { overflow-x: auto }` + `@media ≥768px { min-width: 980px }` — a 980px table in a phone-sized box, side-scroll.
- **After:** desktop = fluid 7-col `minmax(0,1fr)` grid; `<768px` = single-column stacked day cards with **full slot labels** (the `slice(0,8)` truncation removed on mobile), 5 posts/day + "+N more".
- **Tablet dead zone (real-content overflow, found during audit):** `≤1100px` `.app` grid used bare `1fr` (= `minmax(auto,1fr)`) — the 200px topbar-icons + user-chip forced the whole page to 809px at 768. Fixed: `minmax(0,1fr)` + `.topbar { flex-wrap, min-width:0 }`.
- **Measured:** 360/768/820/1440 → `overflowX: false` on all. Vision-verified AFTER-360: stacked cards, date+weekday labels, full slot names.

### 2. Dead buttons wired (10)
Click-probe (actual clicks → URL change): home 5× "View All" (Jobs/Progress → `/projects`, Assets → `/settings`, Outputs → `/marketing`), RightRail "View All Agents" + 2 chevrons (`/agents`, `/settings`), home mini-cal chevron (`/marketing`). "Task Runs" = panel toggle (DOM-verified open). **9 NAV ✓ + 1 toggle ✓ = 0 dead.**

### 3. Duplicates merged (projects vs kanban)
`/projects` = canonical (real workflows board + lead pipeline, `/api/v1/workflows` + `/api/v1/leads`). `/kanban` was an 18-line "coming soon" stub → **deleted**; route survives as `next.config` redirect `/kanban → /projects` (no 404, unlisted, one nav entry).

### 4. IA v3 redirect audit complete
All 8 sidebar entries live-verified: label = destination, no silent redirects. Redirect map (office/team/logs/finance/knowledge/terminal/kanban/marketing-subpages) unchanged and correct.

### 5. §4 scale rules — backend pagination
| Endpoint | Before | After |
|---|---|---|
| `GET /api/v1/clients` | unbounded `SELECT *` | `limit` 20 default/100 max + `offset` (`.range()`) |
| `GET /api/v1/workflows` | unbounded | same |
| `GET /api/v1/marketing/calendar` | default 200 | default 20, max 100 + `offset`; frontend requests explicit `?limit=100` for its window |

Live-verified: `clients?limit=2` → 2 rows; `limit=200` → capped to all (60 existing); `offset=2` works; `calendar?limit=10` → 10.

### 6. Sprint 1 carry-overs
- **"Agents Working" → "Tasks Running"** — frontend no longer renames the API's label (home stat card + fallback stats).
- **keo karpin duplicate deleted** — 1 row remains (`70bc3210`); verified 0 dangling `client_id` references across `workflows` (63), `invoices`, `leads` (66), `events`, `calendars`, `marketing_content_calendar` (70). Keeper retains its 2 workflows.

## Acceptance

| Criterion | Result |
|---|---|
| Zero dead sidebar links | ✅ click-probe 10/10 |
| Zero 360px overflows (audited pages) | ✅ 8/8 `overflowX:false`, plus 768/820 |
| `tsc --noEmit` + `next build` clean | ✅ 0 errors, ✓ compiled + static gen |
| Calendar genuinely responsive | ✅ hack removed, stacked mobile, fluid desktop, BEFORE/AFTER evidence |
| Long lists paginated §4 | ✅ 3 endpoints bounded + live-tested |

## Notes / honest caveats
- The static audit script's "dead button" flags were false positives (React synthetic events don't render as DOM `onClick` attributes) — replaced with a real click-probe; all wired.
- Dev-server had stale `.next` chunks (404s) after config edits — fixed by cache clear + restart; production build verified clean after.

## Next
Sprint 3 — "Think With Me" (Brainstorm v2): kill the 2-round cap (safety 5), RAG-wired SMART defaults, never repeat answered questions, plan summary + "Plan ready — delegate karun?".
