# SPRINT 13 — GROW (blueprint v2-aligned) — REPORT

**Date:** 2026-10-04 (overnight goal mode)
**Verdict:** **PASS** (with honest gaps, listed below — no invented data)

## Mission
GROW loop end-to-end: content planned on a calendar → AI-generated from the
assets library → approved in THE INBOX → published through a real scheduling
API. Plus the 4 Sprint 12 nits.

## GOAL 1 — Sprint 12 nits (all 4 fixed)

1. **tsc.log honesty (FIXED):** standalone `tsc --noEmit` run; FULL output in
   `docs/evidence/sprint-13/tsc-api.log`. Result: **0 errors** — the log proves
   it (not just the exit code). Sprint 12's stale `exit: 1` claim resolved.
2. **Install gate fallback (FIXED):** `playbooks.ts` install handler falls
   back to `'file_deliverable'` (a valid registered action in KNOWN_ACTIONS) —
   a pack missing an action can no longer insert a gate that 400s at runtime.
3. **Migration re-runnability (FIXED):** `migration-sprint12-playbooks-ledger.sql`
   triggers now use `IF NOT EXISTS` — re-running is idempotent. Verified live:
   agent_memory upsert PASS, pipeline_events insert PASS (real workflow),
   marketing_content_calendar insert PASS.
4. **Sprint 12 honest gaps (FIXED):**
   - **Slug constraint (the big one):** `playbooks` uniqueness is now
     `(slug, version)` — `playbooks_slug_key` (slug-only) dropped via
     `pg_constraint` DO-block (Supabase had auto-named it, so the exact-name
     drop silently skipped). Verified: same-slug 2-version coexist PASS,
     real pack v2 seed PASS, same slug+version duplicate still rejected PASS.
   - **Ledger payload redaction at record time:** `memory-ledger.ts`
     `recordMemory` redacts secrets before upsert (redactPayload).
   - **Stage chips as real chips:** playbooks page preview renders stages as
     chip components (inline-flex pill, border+radius) — not bare inline text.

## GOAL 2 — Generate (calendar slot → AI draft from the assets library) ✓

- `POST /api/v1/grow/generate/:slotId` — a `planned` slot → **review** in one
  action. Text via the gateway path (`runSpecialistTask` — the exported real
  gateway call; the earlier `runGatewayTask` import was private in bridge.ts
  and returned the raw object as a JSON string — fixed). Visuals from the
  **assets library reuse endpoint** (existing assets preferred, no new
  generation when the library has them).
- Sprint 11 instrumentation logs the usage row automatically (generation
  without a usage row is incomplete — verified).
- **Verified live:** planned slot 698af98c → review with full text + visual,
  cost logged. UI: **Generate button on the calendar** (44px targets, busy
  state, toast feedback) — clicked in the live preview pane, worked.

## GOAL 3 — THE INBOX publish gate ✓

- `POST /api/v1/grow/submit/:slotId` — review slot → publish approval card in
  THE INBOX (`type=publish`, preview_text + scheduled_at in payload). The
  approval IS the publish button: **approving a type=publish card on the
  /approvals page schedules the linked slot** (same machinery THE INBOX
  already uses — GROW reuses it, never reinvents it).
- **Reject verified:** 400 without reason ("a rejection without a reason is
  not a decision"), with reason → slot back to drafting + reason attached.
- **Verified live (both paths):**
  - `/grow/submit` → card → `/grow/decision` approve → scheduled.
  - UI Submit button (calendar) → card `f1debe80` → **/approvals page
    Approve button** → scheduled → published (dry-run).

## GOAL 4 — Real scheduling API + statuses ✓

- `startGrowScheduler()` in `api/src/index.ts` — every 60s tick dispatches due
  slots (`status='scheduled'`, `scheduled_at <= now()`).
- **Deny-by-default:** a slot with no approved approval is never dispatched
  (approval_id lives in `metadata` — schema-honest; the link is verified
  against the approvals table at dispatch time).
- Statuses: planned → drafting → review → approved → scheduled →
  **published** / **failed** (+attention card on failure).
- **Dry-run mode is labeled:** `PUBLISH_MODE=dry-run` → post_id
  `dryrun-<ts>`, `metadata.publish_mode='dry-run'`, toast says "publishing
  not connected — dry run". No invented success claims.
- **Verified live:** scheduled_at set due → next tick → `published`,
  `post_id: dryrun-1791091776956`, mode dry-run.

## GOAL 5 — Full chain visible ✓

- `/grow/status/:slotId` returns slot + **history** (every GROW transition:
  event, actor, detail, at) — `metadata.history` on the slot.
  - **Root cause fixed (honest):** `pipeline_events.workflow_id` is NOT NULL
    and calendar slots don't belong to workflows — the original publish-event
    inserts failed silently. GROW transitions now log into the slot's
    metadata.history (always visible) and mirror into pipeline_events only
    when the slot belongs to a workflow.
- **Verified live:** history shows `publish_approved (founder)` →
  `published (grow:scheduler)` with full detail.

## Pack v2 live-upgrade test (Sprint 12 nit, RE-VERIFIED 2026-10-04 after user SQL)

- `playbooks` uniqueness is `(slug, version)` — `playbooks_slug_key` dropped
  via the `pg_constraint` DO-block (Supabase auto-named it; exact-name drops
  silently skipped). **All 3 re-verify tests PASS** (`slug-reverify.log`):
  1. same slug v1 + v2 both insert: **PASS**
  2. same slug+version duplicate: **REJECTED** on `playbooks_slug_version_key`: **PASS**
  3. honest v1-install (v2 deleted first) → seed v2 → **v1 instance
     byte-identical (PASS)**; fresh installs get **v2** (PASS).
- Test instances cleaned up; both pack seeds kept (real packs).

## Evidence

- `docs/evidence/sprint-13/tsc-api.log` — standalone tsc, 0 errors
- `docs/evidence/sprint-13/api-boot.log` — API boot with grow-scheduler
- `docs/evidence/sprint-13/PENDING-SQL.md` — SQL run/verified ledger
- `docs/evidence/sprint-13/fix-slug-unique.sql` — the DO-block that dropped
  the auto-named slug-unique constraint

## Honest gaps (things NOT done — stated plainly)

1. **Publishing is dry-run by default.** The scheduler dispatches and marks
   `published` with a `dryrun-` post_id when `PUBLISH_MODE=dry-run`. Real
   platform posting (X/LinkedIn via the existing twitter-cli/opencli paths)
   is NOT wired into the scheduler — the API shape is real (post_id,
   published_at, mode labeled), the platform calls are not. Flip
   `PUBLISH_MODE=live` + implement the platform dispatch in
   `routes/grow.ts publishOne()` to go live.
2. **Visuals reuse, not generation:** generate pulls from the assets library
   reuse endpoint; when the library has no visual, the draft is text-only
   (no image generation call in the generate path — honest gap, the CREATE
   workflow generates images separately).
3. **UI calendar month-view actions:** Generate/Submit buttons are wired on
   the week view cards; month-view mini-cards don't carry action buttons
   (they show status chips only — by design, too small for 44px targets).
4. **Usage row for the gateway generate is logged by runSpecialistTask
   instrumentation, not a separate GROW-specific row** — the cost is visible
   in /pnl per the Sprint 11 rates table, not itemized per-slot.
5. **Model quirk:** the free-tier model occasionally asks a clarifying
   question instead of writing the post (observed once with a vague 'gita'
   brief); regenerate with an explicit topic works. No retry-on-clarify
   logic in the route — a planner should set explicit topics.
