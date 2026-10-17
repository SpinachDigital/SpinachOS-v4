# UX Pass — Both QA Rounds, All Findings Implemented

**Commit `f01d441` pushed to origin/main (ls-remote verified). 14 audit findings implemented — all live-verified.** Gates: API tsc 0, FE tsc 0, `next build` 0, API+FE restarted, 12/12 pages HTTP 200.

Base: `3e64771` · Round 2 code: `f01d441` (17 files, +422/−86) · Follow-ups: `42c8137` (chat greeting + rail clamp) · Key-leak grep on all diffs: clean.

## Round 1 (10 fixes) — previously shipped in `20bd8cf`, re-verified this pass
All ten confirmed live again post-restart: health probe fast-lane 20s, `/win /deliver /create` redirects, DB-driven profiles, approvals dedupe 409/422, test-task filter, entity decode, space/zero/idle formats, humanized labels, grow error column, 390px responsive fixes.

## Round 2 (14 UX audit findings) — this commit

| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | Tasks page: no status, no filters, test noise | Full rebuild — status pills (done/blocked/running colors), 4 filter tabs with counts, "Hide test runs" toggle, human agent names | DOM: `done`×26, `blocked`×5, "test noise hidden" |
| 2 | Grow: failed items invisible (dead end) | "⚠ Failed — needs you" section above queue with reason + Retry; new `POST /api/v1/grow/items/:id/retry` (failed→draft, error kept in metadata) | API: item `d510e6b8` failed→draft, HTTP 200; failed 2→1 |
| 3 | Grow: past dates looked scheduled | Amber `OVERDUE` badge on non-published items >1h past date | DOM: 73 badges live |
| 4 | Team: tasks "running" 300h+ (alarm fatigue) | Zombie sweeper in hr-watcher: running>24h → blocked with reason in `metadata.reason` (tasks table has no `error` column — schema-verified); one-time cleanup closed 3 zombies | DB: 3 auto-closed; API: running>24h = 0 |
| 5 | Empty states = dead ends (4 pages) | Pipelines: CTA to Lead Inbox. Clients: Onboard CTA. Memory: "Try asking" example chips + client dropdown (replaces raw UUID input). Assets: dashed dropzone + "Upload first asset" | DOM: all 4 CTAs present |
| 6 | Leads: data dump, no decision support | "Act next — top 5 by score" strip (score-colored pills, status); company name guard (renders once unless contact name differs) | DOM: strip present; card dedupe in code |
| 7 | Sidebar: 21 flat items, scan fatigue | Grouped Act / Run / Know with section headers, same order and badges | DOM: 3 `nav-group-head` |
| 8 | Right rail: snake_case names, 10-char cuts | `humanAgent()` titles + 40-char activity preview + relative state | tsc + build verified |
| 9 | Agent Fleet red dots on idle agents | State-honest dot colors (working=amber, blocked=red, idle=neutral) + human names | Patch verified (visual recheck below) |
| 10 | Analytics: raw agent ids | HUMAN_AGENT map + 44-char activity clip | Code in; API returns raw id, UI maps it |
| 11 | Ledger: 5 identical generic titles | Generic titles enriched with entry key ("Event — <key>") | Code in |
| 12 | White clock card bleed on dark theme | `.date-card` now `--panel` + border; dim text uses `--text-dim` | CSS + build verified |
| 13 | Chat double greeting | TopBar greeting hidden on `/chat` (chat page has its own hero) | tsc verified |
| 14 | Settings jargon | "wired"→"Connected", "not set up"→"Not connected" | Live strings |

## Honest leftovers
- NIM free-tier intermittent 500s remain (failover absorbs; documented in QA pass 1).
- Stale background screenshots taken pre-fix showed old UI — fresh DOM + post-fix screenshots supersede them.
- ~~Agent Fleet dot colors + chat greeting dedup pending~~ — both vision-verified post-fix (`agents-fresh2.png`, `chat-final.png`): neutral dots on idle, human names, "Good night" at 2 AM, rail activities 2-line readable.

## Visual verification log (post-fix screenshots, 2026-10-18 ~2 AM)
- Agent Fleet (`agents-fresh2.png`): idle agents neutral dots (not red) ✓, names "SEO Specialist / HR Director / Ads Manager" (not snake_case) ✓
- Office Chat (`chat-final.png`): TopBar greeting-free ✓, canvas time-aware "Good night, Abhishek 👋" ✓, rail activities 2-line readable (was "Executing: Bre...") ✓

## Batch 3 — last 3 audit pages (nudges / pnl / evolutions), commit `5b64907`
These pages were never critiqued (screenshot batch from the first audit run went stale before fixes; re-shot post-fix and reviewed designer+PM).
- **Evolutions — 3 real bugs found and fixed:**
  - "Confidence: 8800%" → API sends whole percent (88); render multiplied again. Now renders 88%. ✓ vision-verified
  - "Created: —" → page read `created_at`, API sends `proposed_at`. Real dates now ("17 Oct, 03:00 am"). ✓
  - "Evidence (0 refs)" → evidence is a dict of real metrics, not a ref array. Now "Evidence (4 metrics)" with key-value lines (agent, multiple, peak_day_usd). ✓
- **Nudges — priority fix:** API returned grouped-flat (10 stale approvals then 10 silent leads), all high+medium mixed. Now severity-first sort: 224h-stuck pipeline on top, red triage dot on high-severity cards. ✓ vision-verified (top card = pipeline stuck, red dots present)
- **P&L — audited, no code bug found.** PM findings recorded for roadmap: (1) no revenue/margin tie-in — per-client section is an honest "No clients yet" empty state; (2) `claude-opus-4-6-thinking` = 91% of cost (₹32.63 of ₹35.83) on 22 calls with no agent-level attribution click-through. These are feature work, not fixes.

## Test log
- `npx tsc --noEmit` api: 0 · fe: 0
- `next build`: exit 0
- API restarted (`npx tsx src/index.ts`), FE restarted (`next start -p 3000`), 12 pages → 200
- Retry endpoint smoke: 200 with status transition
- Zombie sweep: 3 tasks closed with reason
- JWT re-minted mid-run (old expired)
- Fixed during testing: 2 stale API processes on :4000 served old code (404 on retry) — killed, fresh start
