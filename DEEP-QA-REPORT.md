# Spinach OS v4 — Deep QA Report (2026-09-22)
**Role:** Senior QA + DevOps + SRE — full-system break-it testing
**Scope:** Backend, agent system, comms, DB, APIs, WebSocket, frontend, 3D office, workflows, automation

---

## ⚡ FIX ROUND 2 (2026-09-23) — XSS, standup dedupe, JWT, agent loop, sidebar

### FIXED: XSS sanitization on /comms/messages (+ command gateway)
- New `sanitizeText()` in api/src/index.ts: strips HTML tags, `javascript:`/`data:`/`vbscript:` URIs, inline `on*=` handlers; caps length; sanitizes sender_id + mentions array too
- Applied to `POST /comms/messages`, `POST /command` — Telegram bot + all API consumers now get clean text
- **Verified:** `<script>alert(1)</script>hello <img src=x onerror=alert(2)> world javascript:evil()` stored as `'alert(1)hello  world evil()'` — CLEAN ✓

### FIXED: Standup dedupe
- `POST /calendar/standup` now queries existing scheduled standups in a 9AM ±1h window, skips agents that already have one (Set of attendee ids), reports `created`/`skipped` counts
- **Verified:** run 1 → "Standup scheduled for 1 agent(s)"; run 2 → "All 1 agent(s) already have today's standup scheduled (deduped)" ✓

### FIXED: JWT expiry + signature verification (CRITICAL security gap)
- `authMiddleware` previously decoded the payload WITHOUT verifying signature — any base64 blob passed as a token
- Now: `jwt.verify(token, JWT_SECRET)` (HMAC-SHA256, jsonwebtoken lib already in deps) — tampered/expired tokens rejected with `TOKEN_EXPIRED` code
- NEW `POST /api/v1/auth/token { sub, role }` → mints a signed JWT (24h default, `JWT_EXPIRES_IN` env)
- **Verified:** old unsigned token → HTTP 401 ✓; minted token → 200 on protected routes ✓

### FIXED: fake frontend token — the REAL root cause of "Office is offline"
- ALL frontend pages hardcoded `'eyJhbG...CVqI'` (malformed payload → jwt.verify throws → every frontend API call 401'd). My earlier auth-header fix was necessary but not sufficient.
- New `src/lib/auth.ts`: `getAuthToken()` mints via `/api/v1/auth/token`, caches in localStorage with expiry, refreshes 5min before expiry; `apiFetch()` attaches Bearer + retries once on TOKEN_EXPIRED
- Replaced in: page.tsx, comms, approvals, agents, calendar, logs, marketing/calendar, marketing/engagement, CommandGateway — 0 fake tokens remain
- **Verified:** tsc clean; all 17 routes 200

### FIXED: LeftNav sidebar "can't click any tab" (NOT a terminal rendering issue — real bug)
- **Root cause:** line 64 was `onClick={() => setActive(item.id)}` — set local highlight state ONLY, **no `useRouter` anywhere in the file, zero navigation**. Clicking highlighted the item; nothing else happened.
- **Fix:** LeftNav rewritten — every item has a `route` (id → real Next.js path), `navigate()` calls `router.push(item.route)`, active state derived from `usePathname()` (browser back/forward + ⌘K stay in sync), mobile auto-collapse after nav
- 8 nav items pointed at non-existent pages (/projects, /team, /clients, /marketing, /analytics, /assets, /finance, /knowledge) → would have 404'd; built 8 working placeholder pages (brand-styled, "In build" + links to live pages)
- **Verified:** all 17 nav routes serve HTTP 200 ✓; tsc 0 errors ✓

### WIRED: Hermes agent loop for real task execution (THE BIGGEST GAP — now closed)
- NEW Agent Execution Engine in api/src/index.ts:
  - `POST /api/v1/agents/execute { agent, task, source }` — persists task (tasks table, status 'running') → runs the task through the **Hermes OmniRoute gateway (:20128, no key needed locally)** with per-profile model routing (ceo/cto/orchestrator → auto/pro-reasoning, engineering → auto/pro-coding, research → auto/best-reasoning, etc.) + per-profile system prompts (Spinach Digital persona, word limits)
  - LLM runs async → on completion updates task (status 'done', output+model in metadata) → emits `agent_state` (working→idle) + `task_update` + `feed` events
  - Failures: task → 'blocked' (tasks_status_check constraint only allows todo/ready/running/review/done/blocked — 'failed' rejected; error detail in metadata), agent → blocked state, feed event
  - `GET /api/v1/agents/execute/:taskId` — fetch execution result
- **Verified end-to-end:**
  - research agent → real LLM output in ~10s: *"By 2026, AI marketing agencies in India will pivot from basic generative AI adoption to deploying proprietary, multilingual models…"* (model: inclusionai/ling-3.0-flash-fin:free)
  - 3 parallel agents (content + ceo + engineering) → 3/3 completed with real outputs
  - WS events fire: 6 events for a single task (agent_state ×2 working→idle, task_update ×2, feed ×2) ✓
  - Unknown agent → 400 with known-agents list ✓
- The 3D office NPCs now reflect REAL execution: WS agent_state events drive NPC states (working → typing animation → idle)

### Note: tasks_status_check constraint
- `tasks.status` allows only todo/ready/running/review/done/blocked; Supabase MCP timed out twice on the ALTER (known issue) — engine maps in_progress→running, failed→blocked in code. Optional migration kept for later: `ALTER TABLE tasks DROP CONSTRAINT tasks_status_check; ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','ready','running','review','done','blocked','failed','in_progress'));`

---

## 🧪 1. CRITICAL BUGS (all found & FIXED during this audit)

### CRIT-001: Pipeline completion silently fails — every workflow stuck at 88%
- Symptom: `POST /pipeline/advance` (launch) returns `{completed: true, message: "Pipeline completed successfully"}` but DB shows `status=active, progress=88, launch=in_progress` — permanently. 8 test workflows were stuck at 88%.
- Root cause (3-part chain):
  1. `workflows` table has NO `completed_at` column (schema.sql never defined it)
  2. Completion update included `completed_at: new Date()` → PostgREST rejects with PGRST204 ("Could not find the 'completed_at' column")
  3. Handler used `await supabase...update(...)` WITHOUT destructuring `{data, error}` — supabase-js returns errors in the result object (not thrown) when there is no `.select()` chain → error silently swallowed
  4. API responded `completed: true` while the update had failed
- Fix: removed `completed_at` from update payload; added `const { error: completeError } = await ...; if (completeError) throw completeError;` — DB errors never silent again
- Verified: full E2E retest → `FINAL: status=completed, progress=100%, launch=completed` PASS

### CRIT-002: Pipeline steps can be advanced OUT OF ORDER
- Symptom: `advance launch` on a FRESH workflow (strategy pending) SUCCEEDED — marked launch `completed` and strategy `in_progress`. Pipeline logic inverted: any step could be completed first.
- Root cause: `nextPending = findIndex(s.status === 'pending')` searched from index 0 — advancing step N always marked step 0 (first pending) as in_progress. No sequence validation existed.
- Fix:
  - Sequence enforcement: all steps BEFORE the target must be `completed`, else HTTP 409 with detail listing incomplete steps
  - `nextPending = findIndex((s, i) => i > stepIndex && s.status === 'pending')` — next step in ORDER after the completed one
- Verified: `advance launch` on fresh workflow → `PASS: out-of-order rejected (409): Cannot advance "launch" — 7 earlier step(s) not completed: strategy, task_breakdown, ...` PASS

### CRIT-003: Duplicate route — `/api/v1/approvals/pending` declared TWICE
- Symptom: `GET /approvals/pending` returned CLIENTS (not approvals) — the SECOND declaration (line 361) queried `from('clients')` and won (Express uses last-registered handler for same method+path).
- Impact: Approvals page + command gateway `show pending approvals` got client rows instead of pending approvals → approval workflow invisible.
- Fix: removed the duplicate (clients) declaration — the real approvals query at line 304 now serves the route.
- Verified: Created approval → pending shows it → command `approve strategy` approves it → pending back to 0 PASS

---

## 2. MAJOR ISSUES (found & fixed)

| # | Issue | Fix |
|---|-------|-----|
| MAJ-001 | CommandGateway missing auth header (user-reported "Office is offline") | `Authorization: Bearer ${token}` header added (localStorage + fallback JWT) — verified `ok=True action=agent_status` PASS |
| MAJ-002 | `/scraper/runs` table always empty — scripts called `/ingest` directly | `/ingest` now auto-creates a run record when `run_id` not provided — verified: 1 run tracked PASS |
| MAJ-003 | Server restart races (EADDRINUSE x6 during testing) — stale-code server kept serving old routes | Kill-by-PID procedure: netstat lookup → taskkill /F → verify port free → restart → health check |

---

## 3. MINOR ISSUES

| # | Issue | Impact | Recommendation |
|---|-------|--------|----------------|
| 1 | Duplicate standup events (2x Daily Standup, same attendee) — `schedule standup` doesn't dedupe | Calendar noise | Add unique index (date, event_type, attendee) or check-before-insert |
| 2 | Content approvals show `N/A` client_name (`payload_json.client_name` not set on creation) | Cosmetic in queue | Set client_name when creating approvals |
| 3 | `/api/v1/tasks` GET/POST don't exist — kanban cards at `/api/v1/kanban/cards` serve the role | API surface mismatch vs CONTEXT.md docs | Document kanban/cards as the task endpoint or add aliases |
| 4 | `POST /api/v1/daily-standup` requires `job_key` (returns 400 without) | Command gateway standup → internal fetch may 400 | Pass job_key or default it |
| 5 | `agent_states.upsert` in hire command uses `department`/`role` columns not in base schema | Possible silent PGRST204 | Verify schema or move into metadata JSONB |
| 6 | Marketing calendar dates off-by-one (slot dated 2026-09-21 with scheduled_at 2026-09-22T03:30 — UTC vs IST) | Cosmetic | Use IST-offset date boundaries in generate-week |

---

## 4. SECURITY FINDINGS

| # | Test | Result | Severity |
|---|------|--------|----------|
| 1 | No auth header | 401 rejected | good |
| 2 | Invalid token | 401 rejected | good |
| 3 | Malformed JSON body | 500 "Internal server error" (body-parser throws → global handler) — leaks nothing | low |
| 4 | SQL injection (`'; DROP TABLE clients;--` in command) | Accepted as client name — parameterized via Supabase client, injection did NOT execute, table intact post-test | info — safe by parameterization; sanitize input anyway |
| 5 | XSS (`<script>alert(1)</script>` in comms message) | Stored raw — React escapes on render, but API consumers (Telegram bot) would relay raw | MEDIUM — sanitize on input |
| 6 | Invalid enum value (`invalid_metric`) | Accepted — no validation on metric_type | low |
| 7 | Wrong type (string for slot_index int) | 500 raw Postgres error leaked ("invalid input syntax for type integer") | low — generic error messages recommended |
| 8 | JWT weak HMAC + static secret + no expiry | Tokens never expire; secret predictable | MEDIUM — add exp + rotation for production |

---

## 5. WEBSOCKET TESTING

| Test | Result |
|------|--------|
| Connect | ws://localhost:4000/ws connects PASS |
| Event broadcast (start pipeline) | 2 events received: `feed` (Pipeline started) + `agent_state` (ceo working) PASS |
| Multiple clients | API tracks Set of clients; comms/dashboard/3D all connect PASS |
| Query-only commands (agent status) | No broadcast (correct — read-only; but UI relies on it for freshness → polling needed or broadcast on read) |
| Reconnect | 5s retry in wsStore + OfficeScene PASS |

---

## 6. SYSTEM HEALTH SCORE

| System | Score | Notes |
|--------|-------|-------|
| Agent system | 7/10 | Registry + states work; agents don't autonomously execute tasks (mock chat — Hermes loop not wired) |
| Communication | 8/10 | Comms CRUD + WS broadcast + @mentions work; no input sanitization |
| Backend/API | 8.5/10 | 68 routes all functional after fixes; silent-error pattern was systemic (fixed in advance handler) |
| Database | 7.5/10 | 15+ tables live; missing completed_at column; enum validation gaps |
| Frontend UI | 8/10 | 9 routes 200, all components render; 3D canvas needs polish (parked per user) |
| Workflow engine | 9/10 | Sequence enforced, completion persists, approval gates work end-to-end |
| Stability | 7/10 | Server restarts fragile (manual kill needed); WS reconnect solid |

**Overall: 7.9/10**

---

## 7. FAILURE SCENARIOS (what broke, why, impact)

1. All pipelines stuck at 88% — silent PGRST204 on missing column (CRIT-001) — FIXED
2. Steps advanced out of order — no sequence check (CRIT-002) — FIXED with 409
3. Approvals page showed clients — duplicate route (CRIT-003) — FIXED
4. "Office is offline" false negative — missing auth header (MAJ-001) — FIXED
5. Stale server serving old code — restart race (MAJ-003) — kill-by-PID procedure established

---

## 8. FIX PRIORITY

**Fixed first (this audit):** CRIT-001, CRIT-002, CRIT-003, MAJ-001, MAJ-002
**Fix next:** XSS sanitization on message input (security #5), standup dedupe (minor #1), approval client_name (minor #2)
**Improve next:** Wire Hermes agent loop for autonomous task execution (agent system 7/10), JWT expiry + rotation, generic error messages
**Ignore for now:** 3D camera polish (user parked), MSYS curl cosmetics, tasks endpoint aliasing

---

## 9. TEST EVIDENCE
- 68 routes enumerated from source; 40+ live curl tests with full JSON responses (session 2026-09-22 14:55-17:55 UTC)
- Full E2E pipeline: client `4e44cf19` -> 8 in-order steps -> `status=completed, progress=100%, launch=completed` PASS
- Out-of-order: 409 with step list PASS
- WS broadcast: 2 events received PASS
- Live data: 65 leads (39 HN + 15 Maps + 10 GitHub + 1 test), 70 calendar slots, 7 engagement metrics, 12 agents, 5 channels, 3 calendars