# N3 · Backend — Execution Report

**Date:** 14–15 Oct 2026 · **Base:** `3b23537` (N2) → **HEAD:** `2acd58a` (ls-remote verified, working tree clean) · **Commits:** `bace3ba`, `8c3ad70`, `2acd58a`
**Gates:** api tsc exit 0, fe tsc exit 0, next build exit 0 (×2). **Live UI:** /approvals renders 161 pending = sidebar badge = queue header, Live indicator, cards with previews (screenshot `n3-approvals.png`, 165KB, opened and read).

**2-line summary:** All four backend items shipped and live-verified: the slot-scheduler + gate + fast-path + generate-week all run on `content_items` (zero legacy code reads), the typed event stream shows the real task sequence (progress → tool_call → done, with timestamps) after a root-caused ring race fix, fresh gate facts change live with the underlying draft, and decisions are fast (reject ~41ms, snooze ~23ms local). Snooze persistence and the agent_events table need two dashboard migrations — Supabase MCP timed out 4×, so the founder runs them.

---

## §0. Carried seam — slot-scheduler re-point — CONFIRMED

**Files:** `api/src/slot-adapter.ts` (new), `routes/grow.ts`, `routes/approvals.ts`, `command-thread.ts`, `routes/marketing.ts` — `bace3ba` + `2acd58a`

- `slot-adapter.ts` gives the legacy slot shape as a VIEW over `content_items` (`toLegacySlot`, `getSlot`) plus a canonical write-patch (`ciUpdate`: content_text→body_text, scheduled_at→scheduled_for, post_id→provider_post_id; status map planned→idea, drafting/review→draft). CHECK constraint probed live: `idea|draft|scheduled|published|failed|approved` are the only legal statuses; the review stage lives in `metadata.review`.
- `grow.ts`: all 19 legacy references re-pointed — generate, submit, decision, dispatchDueSlots, handlePublishJob, status. The X-cron publish path (queue + deny-by-default approval checks) is behavior-identical; only the table and field names changed.
- `approvals.ts` gate: approving a type=publish card schedules the canonical row.
- `command-thread.ts` fast-answer ("have we posted…") reads `content_items`.
- `marketing.ts` generate-week: inserts into `content_items` with `metadata.weekgen_key` dedupe (manual upsert semantics — no unique index exists on metadata).

**Verify (live E2E):** test slot created in `content_items` → `POST /grow/submit/:id` created approval `f56ffea7` → `POST /approvals/:id/approve` → `GET /grow/status/:id` returned `status: scheduled` on the canonical chain. Test rows then deleted (publish mode is LIVE — the test was never allowed to go due). `grep marketing_content_calendar api/src` → zero code references (two comments only). Scheduler armed log: `[grow-scheduler] armed: */60s — … (content_items)`.

## §1. N3.19 — typed agent event stream — CONFIRMED

**Files:** `api/src/agent-events.ts` (new), `routes/events.ts` (new), `engines/agent-execution.ts`, `routes/approvals.ts`

- Contract: `{ type, at, actor, summary, ref? }`, type ∈ `tool_call | progress | approval_requested | approval_decided | error | done`. Emitted at: task start (progress), dispatch (tool_call), completion (done), failure (error), and both gate decision paths (approval_decided, founder as actor).
- `GET /api/v1/threads/:id/events` — bounded (default 100, max 200), newest-first; accepts a task id directly or resolves a thread's tasks via `thread_messages.task_id` and merges.
- Persistence: `agent_events` table (migration below) + an always-available ring on `tasks.metadata.events` (last 50) so the endpoint works before the migration runs.

**Verify (live, real agent task ×3 runs):** final run task `80635b52` returned exactly:
```
progress | 20:22:17 | Started: Reply with exactly: N3 ring race fixed
tool_call | 20:22:17 | Dispatch via profile:engineer
done     | 20:22:37 | Completed via profile (hermes/engineer)
```
**Root cause found and fixed en route (the honest part):** the first two E2E runs lost events — (a) the completion update spread the INSERT-time metadata snapshot, erasing ring events written during the run; (b) ring writes from concurrent emitters raced because the write IIFE invoked at definition time instead of waiting for its turn in the chain. Fixes: completion/error paths flush + fresh-read-merge (`flushAgentEvents`), and ring writes are chain-gated before they start. The three-event sequence above is the post-fix proof.

## §2. N3.20-backend — fresh gate facts at confirm time — CONFIRMED

**File:** `routes/approvals.ts` — `GET /api/v1/approvals/:id/facts`

- Computes live at request time (never cached on the row): publish → current `body_text` + `scheduled_for` + change-detection vs the card's `preview_text`; outreach → current subject/body; lead_qualified → name/company/email/score now; unknown shapes → labeled raw fields (never a dead end). Returns `fresh_facts { headline, details[], cost_estimate }` + `facts_at`.
- **Verify (live change-detection):** card created with slot text "ORIGINAL TEXT v1" → facts showed v1. Draft edited to "CHANGED TEXT v2 — edited after card was created" → re-request returned v2 + "⚠ Draft changed since this card was created — this is the CURRENT text." + fresh `facts_at`. Test rows cleaned.

## §3. N3.10-backend — fast decisions — CONFIRMED

- Decisions persist synchronously; ledger writes, emits, and event-stream appends are all fire-and-forget (`void`), none in the request path. The snooze endpoint is a single-column update.
- **Timings (live):** reject 42.3 / 41.5 / 41.5 ms (3 runs), snooze 23.4 ms — p95 well under the 300ms target locally. Over the Cloudflare tunnel, transport adds ~600–900ms (facts 0.62–2.3s) — that is tunnel overhead, not request-path work; the optimistic frontend (N3.16) is what makes the tunnel feel fast.

## §4. Snooze persistence — CODE SHIPPED, MIGRATION PENDING (founder)

- `POST /api/v1/approvals/:id/snooze` persists `snoozed_until` (default: +24h) and emits `action: 'snoozed'`. While the column doesn't exist it returns an honest **501 with the exact SQL file to run** — verified live (501, 23ms), never a fake ok.
- `GET /api/v1/approvals` selects `*`-equivalent columns and will carry `snoozed_until` automatically once the column exists.
- **`supabase/migration-n3-snooze.sql`** — idempotent (`IF NOT EXISTS`), dashboard-safe: column + partial index.
- **BLOCKER (owner: Abhishek):** Supabase MCP failed 4× ("Connection terminated due to connection timeout"). Run both migrations in the dashboard SQL editor:
  1. `supabase/migration-n3-snooze.sql`
  2. `supabase/migration-n3-agent-events.sql` (agent_events table + indexes + RLS service-role policy)

## Live state after this pass

- API :4000 running final code (scheduler armed on content_items), FE :3000 rebuilt against the fresh API tunnel and verified: **/approvals = 161 pending = sidebar badge = queue header, Live indicator, cards with previews, no raw internals** (`n3-approvals.png` 165KB, opened).
- Fresh tunnels: API `https://newsletter-anti-publication-vessels.trycloudflare.com`, APP `https://managers-initial-antiques-stephanie.trycloudflare.com` (old URLs died mid-pass — the "Couldn't reach the API" screenshot moment was the dead tunnel, fixed by re-arming + rebuild).
- JWT re-minted (previous QA token had expired — that caused the misleading "0 rows" reads; DB was intact throughout: 214 total, 162 pending before cleanup, 161 after the leftover n3 test card was rejected).

## Open items (owner · next step)

| # | Item | Owner | Next step |
|---|---|---|---|
| 1 | `migration-n3-snooze.sql` not run | Abhishek | Dashboard SQL editor (MCP times out) |
| 2 | `migration-n3-agent-events.sql` not run | Abhishek | Same — table becomes the stream's source of truth; ring is the pre-migration fallback |
| 3 | N3 frontend patches (triage keys, split inbox, ⌘K, nudges surface) | assistant | Zip applies on top; fresh facts endpoint is ready for N3.20-frontend progressive enhancement |
| 4 | Tunnel timings are transport-dominated | — | Accept: local p95 is the real signal; N3.16 optimism hides tunnel latency |
