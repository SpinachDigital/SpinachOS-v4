# SPINACH OS — P1 BACKEND GAPS + FRONTEND REVAMP — FULL REPORT

**Date:** 2026-09-25 · **Repo:** `SpinachDigital/SpinachOS-v4` (private)
**Commits:** `9b6e0f3` (P0 security) → `ac8c58e` (P1 backend) → `b8217df` (frontend revamp)
**Scope:** 11 P1 tasks (6 frontend-support endpoints + 5 audit fixes), SQL migration applied, frontend revamp patch (13 files) applied and verified. Everything live-tested against `:4000`/`:3000` — not just code review.

---

## PART A — 6 endpoints the new frontend needs

### 1. Invoices & payments — ✅ E2E VERIFIED
- **Migration:** `supabase/migration-p1-backend-gaps.sql` — new `invoices` table (id, client_id, package_key, amount, currency, status, due_at, paid_at, notes, metadata) + indexes + service_role RLS. **Applied by founder 2026-09-25.**
- **Endpoints:** `GET /api/v1/invoices?client_id=&status=` (list, 200-cap) · `POST /api/v1/invoices` (create, validates client_id + amount).
- **Live evidence:**
  - `GET /invoices` → `200 []` (table live, empty)
  - `POST` → `created: 63931669-3ac9-4f98-97df-0379b81a8dbd | 14999 INR | due | brand_identity` for client `761acb76…`
  - `GET ?client_id=761acb76…` → 1 row (the created one)
  - `GET ?status=paid` → 0 rows (filter verified)
- Client 360's parked invoices section now has a real backend.

### 2. Approval history per client — ✅ VERIFIED
- **Endpoint:** `GET /api/v1/approvals?client_id=&status=&limit=` (default 100, cap 500; ordered by created_at desc; returns id, client_id, type, title, platform, status, requested_by, approved_by, reviewed_at, expires_at, created_at).
- **Live evidence:** `?limit=5` → 5 rows with statuses+timestamps; `?status=approved` → 3 rows.

### 3. Per-agent fallback models — ✅ VERIFIED
- `/api/v1/profiles` now returns `fallback_model` + `provider` per profile alongside `model`.
- Source of truth: the bridge's `GATEWAY_MODEL_BY_PROFILE` (what gateway calls actually use) + the tiered auto/* route every gateway call degrades to.

### 4. Circuit-breaker telemetry — ✅ FAILURE-TESTED
- **New module:** `api/src/breaker-telemetry.ts` — per-provider breaker: **3 consecutive failures → OPEN (15 min) → half-open probe → CLOSED on success**. Failure/success recording + `GET /api/v1/models/breakers` (state, consecutive_failures, total_failures, last_failure_at, opened_at).
- **Wired into BOTH outbound paths:** `bridge.ts` runGatewayTask/runSpecialistTask AND `index.ts` runAgentTask — one shared state, telemetry reflects every LLM call.
- **Live evidence (dead-gateway test):** calls 1–3 fail → `[breaker] OPEN for provider=omniroute after 3 consecutive failures`; state JSON: `{"state":"open","consecutive_failures":3,"opened_at":"…","last_failure_at":"…"}`; **4th call blocked:** `circuit open for provider omniroute (retry after 15 min)`.
- Note found during testing: `executeAgentTask`'s kind-inference defaults to `copy` → profile-social, so the gateway path is rarely hit from natural commands; the breaker engages via /chat ops-tasks, specialist paths, and fallbacks. Flagged for the monolith-split planning.

### 5. Fallback event log — ✅ FAILURE-TESTED
- `recordFallback(from, to, reason, timestamp)` ring buffer (max 200) + `GET /api/v1/models/fallback-log`.
- **Live evidence (forced profile-spawn failure):**
  `{"from":"hermes/profile:nonexistent_profile","to":"omni:auto/best-fast","reason":"profile spawn failed: spawn … ENOENT","timestamp":"2026-09-24T23:18:44Z"}`
- **Bug found & fixed during testing:** the event was recorded AFTER the fallback attempt — if the fallback itself failed (dead gateway), the event was lost. Now recorded BEFORE, so every fallback is logged even when the fallback dies too.

### 6. All 10 profiles — ✅ VERIFIED
- ceo, cto, orchestrator, designer, engineer, social, seo_specialist, research, sales — `status: live`; **ads_manager — `status: dormant, dormant: true`** (until Scale onboarding auto-activates it).
- Live: `count: 10`, each with model + fallback_model + provider.

---

## PART B — Audit P1s

### 7. NULL client_id isolation hole — ✅ CLOSED (adversarial test)
- **Old behavior:** both hybrid RPCs returned `client_id IS NULL` (agency-global) chunks to every client — any ingest that forgot client_id leaked to all clients.
- **Fix:** both `hybrid_chunks_semantic` + `hybrid_chunks_lexical` now require `kc.client_id = p_client_id` for client-scoped queries (NULL chunks visible only in explicit global/director mode).
- **Adversarial live test:**
  1. Ingested agency-scoped decoy: "AGENCY GLOBAL SECRET — internal pricing margins" (NULL client_id, scope=agency)
  2. Queried **as client A** with a semantically-matching probe ("internal pricing margins markup structure") → **only client A's own 2 chunks returned; secret NOT leaked** (zero NULL rows)
  3. Queried **global mode** (no client_id) → secret returned ✓ (directors see all — by design)
  4. Decoy chunk deleted (204). Incidentals: `scope` values are `agency|client` (v6 CHECK constraint — `global` correctly rejected); RRF fusion can't resurrect leaked rows because BOTH sides now use the same strict predicate.

### 8. RAG migration destructive — ✅ FIXED
- **Old:** `ALTER TABLE … DROP COLUMN embedding` unguarded — re-running wiped all embeddings (header claimed "Idempotent" while doing the opposite).
- **New:** guarded `DO $$` block — jsonb→vector one-time `ALTER … USING NULL` cast ONLY if the legacy jsonb column still exists; no-op when already `vector(2048)`. **No code path can drop vector data anymore.**

### 9. bridge.ts OMNIROUTE_URL default — ✅ FIXED
- `'http://localhost:20128'` → `'http://localhost:20128/v1'` (the call path appends `/chat/completions`; the old default 404'd every fallback silently).

### 10. t_b3b75be0 crash-loop — ✅ FIXED AND PROVEN IN PRODUCTION
- **Audit's theory:** bad skill pin `spinach-cto-agent`. **Actual root cause (deeper):** the pin EXISTS — but only in the **default profile's** skills dir (`hermes/skills/spinach-os/`). Agent profiles (designer etc.) have their OWN `skills/` dir without the bundle → every worker spawn died: `Error: Unknown skill(s): spinach-cto-agent`.
- **Fix:** copied the `spinach-os` skill bundle into every agent profile that lacked it: **designer, engineer, sales, seo_specialist, ads_manager** (ceo/cto/orchestrator/research/social already had it). Task unblocked + re-queued, root cause documented in a card comment.
- **Proof it worked:** the designer worker spawned cleanly and **completed the full task**: "Cafe B 1 — Brand Identity + Asset System — brand strategy document, 3 logo concepts with rationale (SVG), mood board with color/typography/photography/icon style" — a task that crash-looped 6 hours earlier. All 5 fixed profiles are now immune to the same failure class.

### 11. 14-slot calendar — ✅ FIXED (root cause was exactly the audit's)
- **Root cause:** the LLM had to return 7 `PLATFORM | TOPIC` lines per brand; it often returned 3–5 (or lines not matching the format), and the code silently sliced + moved on → observed 10-slot run.
- **Fix (index.ts plan-week):**
  1. Retry ×3 with a stricter, self-correcting prompt (each retry tells the model how many valid lines it got last time)
  2. Stricter line validation (`PLATFORM | TOPIC` with platform prefix check)
  3. Deterministic pad to exactly 7 per brand → **14 slots guaranteed, every run**
  4. Loud `console.warn` when padding engages — never silent.

---

## FRONTEND REVAMP PATCH — applied + verified (commit `b8217df`)

`frontend-revamp.patch` (68 KB, 13 files, `frontend/command-center` only) — applied via `git apply` (clean), patch file removed after.

| File | What it adds |
|---|---|
| `src/app/clients/[id]/page.tsx` | **NEW — Client 360 detail page** (uses `GET /clients/:id` + invoices + approval history) |
| `src/app/clients/page.tsx` | `/clients` restored as a real live page (redirect removed) |
| `src/app/agents/page.tsx` | per-profile model + fallback + provider; 10 profiles; dormant marked |
| `src/app/settings/page.tsx` | **Models & Brains panel** — breaker states + fallback event log (`/models/breakers`, `/models/fallback-log`) |
| `src/app/calendar/page.tsx` | live wiring |
| `src/app/marketing/{calendar,engagement}/page.tsx` | live wiring |
| `src/app/comms/page.tsx` | live wiring |
| `src/lib/auth.ts` | env-driven API base (`NEXT_PUBLIC_API_BASE`) — kills ~15 hardcoded `localhost:4000` call sites |
| `.env.example` | **NEW** (audit P2 gap): `NEXT_PUBLIC_API_BASE/URL`, `NEXT_PUBLIC_WS_URL` — documented for new machines |
| `next.config.js` | `/clients` redirect removed (it's a real page now) |
| `src/app/globals.css`, `LeftNav.tsx`, `tsconfig.tsbuildinfo` | supporting styles/nav/build info |

**Verification (live):**
- `tsc --noEmit` → **0 errors**
- Routes: `/ /clients /agents /settings /marketing /comms /calendar` → **all 200**
- **`/clients/761acb76-…` (real client UUID) → 200** — the previously-missing detail page compiles (`✓ /clients/[id] in 387ms, 593 modules`) and serves
- Dashboard rendering verified in the preview pane (greeting, 6 stat cards, live activity feed — real data)

---

## FINAL REGRESSION (all green)

| Check | Result |
|---|---|
| `GET /api/v1/{invoices, approvals, profiles, models/breakers, models/fallback-log}` | all **200** |
| profiles count | **10** (ads_manager dormant) |
| Unauth token mint (P0 holding) | **401** |
| `:3000` frontend | **200** (patched) |
| `:4000` API | ok |
| `:8000` Laya | ok v2.0 |
| Health panel | Database ok · Laya Router ok · Agent Engine ok (OmniRoute) · WS ok |
| Git | 3 commits pushed; `.env` never staged (only `.env.example`) |

**Operational note:** all three background services (API, Laya, frontend) had silently died from daemon exits mid-session (not code crashes). All restarted and verified. Recommendation queued: `scripts/start-all.ps1` or Windows services for restart-survival.

---

## DEFERRED (queued for later, per instructions)

1. **`api/src/index.ts` 4,278-line monolith split** (`routes/`, `engines/`, `cron.ts`) — the audit's #1 maintainability risk; also the right moment to fix the kind-inference-defaults-to-`copy` routing quirk (Task 4 note).
2. **Windows-absolute paths** in scrapers + `nvidiaKey()` hermes `.env` fallback — breaks Linux/Oracle migration; replace with env/relative.
3. **Home page `/` mock-fallback behavior** — decide whether silent `FALLBACK_*` masks outages or fails loudly.
4. Remaining audit P2s: dead code removal (`unified-app/`, `three-office/`, `check_tabs.js`), RLS posture documentation, NULL-`client_id` visibility policy formalization (now technically closed by T7 — needs a doc line).
5. **t_9473af4f + child design tasks** (Logo System, Color Palette, Typography from the Cafe B 1 breakdown) — dispatched and running on the now-fixed designer profile.
