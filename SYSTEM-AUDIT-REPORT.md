# Spinach OS — Full System Audit Report (2026-09-23)

**Role:** Systems Architect + Backend Engineer + QA Lead
**Method:** full route inventory (27 GET endpoints), E2E workflow tests (5 commands through User→API→Laya→Agent→Execution→DB→UI), connection validation, event/state consistency audit, performance test (sequential + 10 simultaneous), UI sync verification via CDP probe.

---

## 1. SYSTEM AUDIT

### Scope verified
- **Backend**: 1 file (`api/src/index.ts`, ~2,490 lines), Express + ws + Supabase + JWT + Zod
- **Routes**: 27 GET + ~20 POST/PATCH/DELETE endpoints — all enumerated and tested
- **Workflows**: command → Laya → agent → OmniRoute → tasks table → WS events
- **Database**: Supabase (snuvnlxlhvwmzqzbffjz), 23+ tables
- **Real-time**: WS on /ws, 6 event types (feed, agent_state, task_update, approval, workflow, message)
- **Frontend bindings**: spinach-store (single WS), OpsSidebar, Office 3D NPCs

---

## 2. ISSUES FOUND (with severity)

| # | Severity | Issue | Impact |
|---|----------|-------|--------|
| 1 | **CRITICAL** | `agent_states_profile_check` DB constraint blocks dynamic profiles — **every hire silently failed** (command, Telegram /hire, /api/v1/hr/hire all wrote 0 rows; reply claimed success) | Hired agents never existed; roster untracked |
| 2 | **CRITICAL** | Chained `.upsert().upsert(...)` in daily-standup — invalid supabase-js (only first executes, rest silently no-op) → **500 "upsert is not a function"** | Standup never updated agent states |
| 3 | **HIGH** | `GET /api/v1/clients` missing (only POST + GET /:id existed) → 404 | Clients list unreachable |
| 4 | **HIGH** | `emitAgentState` broadcast WS but **never persisted to agent_states table** → DB states stale (e.g. research "working" since 09-20), restart loses state | UI/DB showed stale reality |
| 5 | **HIGH** | Non-Laya commands (pipeline/approvals/hire/standup) **created no tracked task** — only Laya-routed ones did | ~half of all commands untracked |
| 6 | **MEDIUM** | Task lookup by short ID → opaque 500 (Postgres uuid cast error, no helpful message) | UX friction |
| 7 | **MEDIUM** | Command-hire/Telegram-hire upserts included `department`/`role` as columns (don't exist) → PGRST204 swallowed | Silent partial hire |
| 8 | **MEDIUM** | `hire` commands were Laya-routed as DESIGN TASKS (Laya saw "designer/design" keywords) instead of hitting the HR branch | Hires became design work |
| 9 | **MEDIUM** | Two WebSocket connections (spinach-store + legacy wsStore in OpsSidebar) | Wasteful, split-brain states |
| 10 | **LOW** | Approval insert `.select()` without `.single()` → TS2339 (array indexed as object) | Type unsafety |
| 11 | **LOW** | 'paused' state written to agent_states violates the state CHECK (idle/thinking/working/speaking/blocked only) | Upsert silently failed |
| 12 | **LOW** | API found dead twice during audit (EADDRINUSE crash loops, orphaned process owning :4000) | Server reliability |

---

## 3. FIXES APPLIED

1. **`supabase/fix-agent-states-profile-check.sql`** (NEW — needs 1 run in Supabase SQL Editor): drops the blocking constraint, adds a softer guard allowing core profiles + `dept_`-prefixed hired agents
2. **Daily-standup chained upserts** → loop of separate upserts with errors surfaced + emitAgentState per profile — **verified 200, 9 agents working**
3. **`GET /api/v1/clients`** added (list + status filter) — **verified 200, 40 clients**
4. **`emitAgentState` now persists** to agent_states (fire-and-forget, errors logged) — DB stays fresh, restart-safe; 'paused'→'idle' mapped per schema CHECK
5. **Command task tracking**: every non-Laya command now inserts a tracked task (id, status 'done', metadata: action/reply/workflow_id) + emitTaskUpdate — **verified: approval cmd, standup cmd, laya cmd all return task_id**
6. **Task lookup**: UUID regex validation → 400 with helpful message (was opaque 500); PGRST116 → 404
7. **Hire upserts** (command + Telegram): department/role → metadata, errors surfaced; hr/hire returns warning on persist failure (no silent partial hire)
8. **`hire` added to Laya bypass** — HR branch handles roster management — **verified action=hire**
9. **OpsSidebar → shared spinach-store** (single WebSocket for whole app), feed item shape updated
10. Approval insert `.single()` added

---

## 4. ARCHITECTURE OVERVIEW (updated)

```
User (UI command bar / voice / ⌘K / Telegram)
  ↓ POST /api/v1/command (JWT via apiFetch → /auth/token, XSS-sanitized)
  ↓ bypass check: pipeline | approval | strategic | hire → direct handlers
  ↓ else → Laya :8000/decide (2s timeout, System 1)
      → department + priority + confidence
      → LAYA_DEPARTMENT_MAP → agent
      → executeAgentTask():
          1. tasks.insert (status running, CHECK-safe)
          2. emitAgentState → WS + agent_states TABLE persist
          3. OmniRoute /chat/completions (per-profile model, 120s timeout)
          4. background: done → tasks.update + WS events
                       error → blocked + metadata.error + WS events
  ↓ every non-Laya command ALSO tracked as a task (orchestrator, status done)
  ↓ WS broadcast: feed / agent_state / task_update / approval / workflow / message
  ↓ Frontend: single spinach-store WS (auto-reconnect 5s) → status strip, OpsSidebar,
    Live Activity, Agents panel, System Logs, 3D NPC animations
```

---

## 5. WORKFLOW VALIDATION RESULTS

### E2E: 5/5 commands PASSED
| Command | Laya | API routed | Task in DB | Final status |
|---------|------|-----------|------------|--------------|
| build landing page | engineering/medium (0.95) | engineering ✓ | ✓ tracked | **done** (output: YES, gemini-3.1-pro-low) |
| run instagram campaign | marketing/medium (0.95) | social ✓ | ✓ tracked | **done** |
| design logo | design/medium (0.95) | design ✓ | ✓ tracked | **done** |
| research competitors | research/medium (0.95) | research ✓ | ✓ tracked | **done** |
| ASAP fix bug | engineering/**high** (0.95) | engineering ✓ | ✓ tracked | **done** |

### Route tests: 27/27 GET endpoints 200 (after clients fix)
### Pipeline: create → 8 steps → advance → 409 out-of-order → full completion 8/8 100%
### Performance: routing avg 323ms (max 815ms cold); **10 simultaneous commands: 10×200 in 688ms wall, zero 429s**
### UI sync (CDP probe): task fired → status strip "1 working", Live Activity full trace, Agents panel "1 online" — single socket

---

## 6. KNOWN LIMITATIONS

1. **`fix-agent-states-profile-check.sql` must run once in Supabase SQL Editor** (MCP times out; dashboard SQL works) — until then, hr/hire returns a warning and hired agents live in the in-memory registry only (lost on API restart)
2. Agent registry (12 leads + hires) is in-memory — restart resets; production should persist to a table
3. Profiles/cron/kanban-boards endpoints return static mocks (documented "in production" comments)
4. Rate limit 200 req/min per IP — heavy parallel UI could 429 (none seen at 10 concurrent)
5. API has no typecheck gate (no tsconfig.json in api/; tsx runs without tsc) — 4 pre-existing module-import type errors exist (TS1259/1192, runtime-safe under tsx)
6. NPC seated pose is stylized (worker.glb rig) — acceptable at command-center distance

---

## 7. RECOMMENDATIONS FOR NEXT PHASE

1. **Run the SQL fix** (`supabase/fix-agent-states-profile-check.sql`) — one paste in Supabase dashboard, unblocks persistent hires
2. **Persist the agent registry** to a `hr_agents` table (restore on boot) — kills the restart-amnesia limitation
3. **Real Hermes cron integration** for profiles/cron endpoints (replace mocks with actual Hermes store queries)
4. **Kill-by-name restart script** (`restart.sh`) — the audit hit EADDRINUSE crash loops twice from racing restarts
5. **Add tsconfig.json to api/** with esModuleInterop — makes `npx tsc -p tsconfig.json --noEmit` a real gate
6. **Warm re-skin** of agents/comms/calendar/settings pages (still dark glass; working)
7. **Load test at 50+ concurrent** — rate limit tuning if the UI ever bursts

---

**Servers running:** frontend :3000, API :4000 (PID fresh, all fixes), Laya :8000
**Files changed:** api/src/index.ts (~10 fixes), 1 new SQL file, OpsSidebar.tsx (single socket)
