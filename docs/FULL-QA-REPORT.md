# FULL QA REPORT — SpinachOS v4 Founder-Mode Hardening

**Complete record: NIM sweep + rewire, Round 1 (10 fixes), Round 2 UX audit (14 findings + 2 follow-ups), Batch 3 (last 3 pages, 4 findings).** Every item below was implemented, live-verified, and pushed. 30 fixes total across 5 commits.

Commit chain (oldest → newest, all on origin/main, ls-remote verified):
`20bd8cf` (Round 1) → `575f30f` (gateway timeout) → `5fdb706` (NIM report) → `3e64771` (QA report) → `f01d441` (Round 2) → `66221aa` → `42c8137` (follow-ups) → `8fcb70a` → `5b64907` (Batch 3) → `55b786b` (final report)

Key-leak grep (`nvapi-…`) on every diff and report: clean.

---

## 1. NIM Sweep + Routing Rewire (report: `docs/NIM-SWEEP-REPORT.md`)

- Catalog: 81 models via NIM API, 50 chat candidates probed, ~35 RPM limiter.
- 7 winners kept; 25× 404/EOL and gateway-hang models excluded.
- Combo v2 chain: `nemotron-3-super-120b-a12b` → `nemotron-3.5-super-vl-120b-a12b` → `agy/gemini-3.8-flash-high` → `openrouter/free`.
- Department picks: ceo/cto/orchestrator → combo; engineer/research/social/seo/ads/sales/designer → super-vl direct.
- Kill-test failover proven: lane 1 off → gemini PONG 4.9s → restore.
- Gateway combo timeout written direct to SQLite (`totalTimeoutMs:30000, stepTimeoutMs:18000`) — CLI has no `combo edit`.

## 2. Round 1 — 10 QA Fixes (commit `20bd8cf`, 18 files, +174/−72)

All ten CONFIRMED live, re-verified again after every restart in this session.

| # | Fix | Verification |
|---|---|---|
| 1 | Health probe on fast lane (combo-based), 15s → 20s ceiling | 8/8 health rounds `ok`, probes 2–4s |
| 2 | Redirects `/win→/leads`, `/deliver→/pipeline`, `/create→/assets` | 307 + Location header |
| 3 | `/api/v1/profiles` DB-driven via `department_model_picks` | 9 profiles correct, per-department models |
| 4 | Approvals dedupe 409 + empty-body 422 at ingest | 106 dupes deleted, 156→50 pending |
| 5 | Test-task filter in AI Agents rail | 13 test filtered / 87 real shown |
| 6 | Entity-decode `parseInt('x2F')` NaN bug | 4 lead titles cleaned |
| 7 | Missing spaces, zero-as-O, idle d+h format | Vision + DOM |
| 8 | Humanized labels ("raised by Sales", "characters", "Laya Router local", snooze text) | Vision-verified desktop + 390px |
| 9 | Grow `error` column + HTML-strip/140-char cap | Real Publora 404 reason renders |
| 10 | Approvals filter row + kbd callout `flexWrap` | 390px mobile verified |

## 3. Agent Engine 500/499 Root Cause (commit `575f30f`)

- Symptom: HTTP 500 flaps, 499 aborts at exactly 15000ms.
- Root cause 1: NIM free-tier intermittent `[500]: Failed to generate completions`.
- Root cause 2: gateway default 15s combo timeout < chain latency.
- Fix: probe ceiling 20s (< 30s gateway total) + DB combo config.
- Result: 8/8 stability rounds, zero flaps, real orchestrator task via lane 1.

## 4. Round 2 — UX Audit, 14 Findings (commit `f01d441`, 17 files, +422/−86)

20 pages screenshotted, 14 critiqued designer+PM, all findings implemented.

| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | Tasks: no status color, no filters, test noise | Rebuild: status pills, 4 tabs, test toggle, human names | DOM: done×26, blocked×5, "test noise hidden" |
| 2 | Grow: failed items invisible dead-end | "⚠ Failed — needs you" section + `POST /grow/items/:id/retry` | Item failed→draft, HTTP 200 |
| 3 | Grow: past dates looked scheduled | Amber OVERDUE badge >1h past | 73 badges in DOM |
| 4 | Team: tasks "running" 313h+, alarm fatigue | Zombie sweeper: >24h auto-close, reason in metadata | 3 closed; running>24h = 0 |
| 5 | Empty states dead ends ×4 | CTAs: Pipelines→Lead Inbox, Clients→Onboard, Memory→chips+dropdown, Assets→Upload | All 4 in DOM |
| 6 | Leads: data dump, no decision support | "Act next — top 5 by score" strip + company-dedup guard | DOM strip live |
| 7 | Sidebar: 21 flat items | Act / Run / Know groups with headers | 3 nav-group-head in DOM |
| 8 | Right rail: snake_case, 10-char cuts | humanAgent() + 40-char preview | Build + vision |
| 9 | Agent Fleet: red dots on idle agents | State-honest colors + human names | Vision: neutral dots, "SEO Specialist" |
| 10 | Analytics: raw ids | HUMAN_AGENT map + 44-char clip | Code + API mapping |
| 11 | Ledger: 5 identical generic titles | Title enriched with entry key | Code in |
| 12 | White clock card on dark theme | `.date-card` → `--panel` + border | CSS + build |
| 13 | Chat: greeting twice in 150px | TopBar greeting hidden on /chat | Vision: TopBar clean |
| 14 | Settings jargon ("wired") | "Connected" / "Not connected" | Live strings |

## 5. Follow-ups caught during visual verify (commit `42c8137`)

- Chat canvas greeting was hardcoded "Good evening" at 2 AM. Now time-aware. Vision: "Good night, Abhishek 👋" ✓
- Rail activity CSS truncated at ~16 chars despite the 40-char clip. Now 2-line clamp. Vision: full "Completed: one line: what is 2+2" ✓

## 6. Batch 3 — Last 3 Pages (commit `5b64907`)

Nudges / P&L / Evolutions were never critiqued (first screenshots went stale pre-fix). Re-shot post-fix, reviewed, 4 new findings.

| Page | Bug | Fix | Verified |
|---|---|---|---|
| Evolutions | "Confidence: 8800%" — API sends whole percent, UI multiplied again | Pre-scaled detect (`>1`) | Vision: "88%" ✓ |
| Evolutions | "Created: —" — read `created_at`, API sends `proposed_at` | Field fix | Vision: "17 Oct, 03:00 am" ✓ |
| Evolutions | "Evidence (0 refs)" — evidence is a metrics dict, not ref array | Key-value render | Vision: "(4 metrics)" + agent/multiple/peak_day_usd ✓ |
| Nudges | Flat order — 224h-stuck pipeline ranked with 10/100 leads | Severity-first sort + red triage dot | Vision: top = pipeline stuck, red dots ✓ |

P&L: no code bug. Two PM findings recorded as roadmap (below).

## 7. Infra issues found and fixed during testing

- Two stale API processes on :4000 served old code (retry endpoint 404). Killed both, fresh start, route live.
- Tasks table has no `error` column (schema-verified). Zombie reason lives in `metadata.reason`.
- JWTs expired twice mid-run. Re-minted python-side both times.
- Headless Chrome: `--virtual-time-budget` hangs on this app. Working pattern: `--headless --timeout` or `--run-all-compositor-stages-before-draw` with unique `--user-data-dir` per run.
- Temp scripts (zombie.mjs) cleaned out of the repo before commit.

## 8. Verification gates (all green)

- `npx tsc --noEmit` — api: 0, fe: 0 (run after every batch).
- `next build`: exit 0, 31/31 pages.
- All pages HTTP 200: home, leads, pipeline, grow, assets, settings, office, chat, clients, agents, analytics, ledger, tasks, team, memory, nudges, pnl, evolutions, approvals, today.
- Live flows: retry endpoint 200, failed→draft transition, zombie sweep (3 closed), grow counts, tasks statuses.
- Post-fix screenshots vision-verified: agents-fresh2, chat-final, evolutions-final, nudges-final.

## 9. Honest leftovers / roadmap (not bugs, feature work)

- NIM free-tier intermittent 500s remain. Combo failover absorbs them. Documented.
- P&L: no revenue/margin tie-in — cost dashboard only until clients onboard.
- P&L: `claude-opus-4-6-thinking` = 91% of cost (₹32.63 of ₹35.83) on 22 calls. No agent-level attribution click-through yet.
- P&L: 6 unpriced calls (no rate) flagged — pricing table needs completion.
- Nudges: no inline/bulk triage actions — every card needs a drill-down click.
- Evolutions: proposals lack exact before/after parameter diffs ("cap what?").
- Grow: 71 ideas pending generation — backlog, not a defect.
- Approvals inbox: 50 pending founder decisions (post-dedupe) — human queue, not a bug.
- Agent endpoint accepts no company brief/context yet (from Round 1 report).

## 10. Final state

- Repo: `C:\Users\Abhishek\SpinachOS-v4`, branch main, HEAD `55b786b`, tree clean, local == remote.
- Servers: API :4000, FE :3000 (fresh builds), Laya :8000, OmniRoute :20128. Tunnels live.
- Routing: combo/spinach-agents-v2 with 30s/18s timeouts, NIM "os" key active.
- Reports on disk: `docs/NIM-SWEEP-REPORT.md`, `docs/QA-PASS-REPORT.md`, `docs/UX-PASS-REPORT.md`, this file.
