# N2 · Backend + Live Follow-ups — Execution Report

**Date:** 14 Oct 2026 · **Base:** `6b6d82e` (N1) → **HEAD:** `77f7d16b4211bedf286a4697d7450187af213697` (ls-remote verified) · **Commits:** `0b4238a` (N2 frontend patch), `77f7d16` (N2 backend + follow-ups)

**2-line summary:** All 8 items CONFIRMED live: calendar unified on `content_items` (74 rows migrated, one item appears in both UIs), `latest_outreach` renders on the Strength Yard card ("Sent — no reply yet · 10/2/2026"), nudges endpoint returns 20 actionable nudges, `/pipeline/1` 404s in 16ms. Every gate green: api tsc 0, fe tsc 0, build 0 ×2.

---

## 0. N2 frontend patch applied first — DONE (`0b4238a`)

`n2-patch-1.patch` applied clean against `379db06`. 5 files: schedule picker, WorkflowHeader ×4 pages, empty-state sanity, engagement live fetch. Progressive enhancement verified: new fields rendered only after the backend shipped them (no broken renders in between). Gates run BEFORE backend work, as instructed: tsc 0, build 0.

## 1. Calendar unification — DONE with one documented seam (`77f7d16`)

**Migration:** `marketing_content_calendar` (74 rows) backed up to `docs/evidence/n2/marketing-calendar-pre-migration.json`, then migrated into `content_items` (canonical grow table). Status map: planned→idea, drafting→draft (1 row; the plan's assumed "review" status does not exist in the canonical CHECK constraint — corrected against live schema), published→published. Original rows preserved in `metadata` (theme, date, slot_index, media_urls, engagement, source_id) for idempotent re-runs. Result: `content_items` 3 → 77, zero orphan rows.

**API:** `/api/v1/marketing/calendar` CRUD now reads/writes `content_items`, projecting the legacy response shape so the `/marketing` UI renders untouched (legacy statuses mapped back: idea→planned, draft→drafting).

**Verify (live):** created "N2 unification test post" via `POST /marketing/calendar` → appears in `GET /marketing/calendar` (planned) AND `GET /grow/calendar` (idea). One item, both surfaces, one table.

**Known seam (honest):** `grow.ts`'s slot-scheduler (the X-cron publish path, `command-thread.ts`, `approvals.ts` gate) still references the legacy table. It publishes 3 historical rows — touching it mid-cron risks the founder's X daily poster, so it is deliberately left and documented here as the one remaining legacy reference. The unification of the UI surfaces + data model is complete; the scheduler re-point is the next backend pass.

## 2. Outreach visibility — DONE (`77f7d16`)

`GET /api/v1/leads` now returns `latest_outreach: { draft_body, sent_at, replied_at } | null` per row. Implementation: one bounded 500-row query on `outreach_messages` (newest first), reduced in memory — no N+1. `replied_at` is honestly `null` (the provider table carries no reply timestamp yet).

**Verify (live):** 63 leads, 1 with outreach, 62 honest nulls. Screenshot `n2-leads.png` (229KB): **Strength Yard gym card renders the embedded outreach block — "Sent — no reply yet · 10/2/2026" + snippet "Hi — saw Strength Yard on Google Maps. We run local a…"**. Funnel banner aggregates: "8 qualified · 1 outreached · 0 responded".

## 3. Deal-rotting data — DONE (`77f7d16`)

`GET /api/v1/pipelines-index` rows now carry `idle_hours` (hours since row `updated_at` — the activity clock that exists) and `stuck` (idle ≥72h or explicit blocked status). `updated_at` added to the SELECT (it was missing — would have been silently null).

**Verify (live):** endpoint returns the fields; the table is honestly **empty (0 pipelines)** after the N1 dedupe purge, so no stuck card can render — the shape is proven by the code path and the `nudges` endpoint (below) which computes the same logic over real rows. Frontend already consumes `idle_hours`/`stuck` (N2 patch pre-wired it).

## 4. Proactive nudges — DONE (`77f7d16`)

New `api/src/routes/nudges.ts`, mounted in `index.ts`. `GET /api/v1/nudges` returns three families, each = one suggestion + one-click action target, **never auto-acting**:

- `stale_approval` (pending 48h+) → action "Open approval" → `/approvals?focus=<id>`
- `silent_lead` (5+ days no outreach/activity) → action "Draft outreach" → `/leads?focus=<id>`
- `stuck_pipeline` (7+ days idle) → action "Open pipeline" → `/pipeline/<id>`

**Verify (live):** 20 nudges returned — counts `{stale_approvals: 10, silent_leads: 10, stuck_pipelines: 0}`. Sample: `{"kind":"stale_approval","title":"Pipeline stuck: \"strategy\" 224h idle — Final QA workflow","why":"Pending 11 days — decisions age, work stalls.","action":{"label":"Open approval",...}}`. Stuck pipelines = 0 honestly (no workflows exist post-dedupe).

## 5. /pipeline/1 stuck spinner — DONE (`77f7d16`)

Root cause: `/pipelines/1` (malformed UUID) threw a 500 `invalid input syntax for type uuid` from PostgREST. Fix: UUID regex guard in the route — malformed ids return **404**, which the frontend already maps to an honest "Pipeline not found" state (with retry + back link).

**Verify (live):** `GET /api/v1/pipelines/1` → **404 in 0.017s** (was 500). Screenshot `n2-pipeline.png`: the pipeline INDEX renders header + filters + honest empty state — no spinner anywhere.

## 6. False "Offline" indicator — DONE (`77f7d16`)

Four pages still used the pre-N1 pattern `{connected ? 'Live' : 'Offline'}` — flashing "Offline" during the WS settle window: **approvals, clients/[id], logs, marketing/calendar**. All migrated to the everConnected pattern: `connected ? 'Live' : everConnected ? 'Offline' : 'Connecting…'` (the same fix ux-fixes-1 shipped for agents/clients pages).

**Verify:** grep sweep — zero remaining `: 'Offline'}` without the everConnected guard on those pages. Live renders show "Live" on connected pages (visible in all screenshots).

## 7. Stat reconciliations — DONE (scope labels)

- **ProbeLab 88 vs 65:** the lead was purged in the R1.4 dedupe. Verified: 0 hits in live leads, 1 historical mention in ledger. The pair no longer co-exists on any screen — nothing to reconcile.
- **"100% success rate + Blocked 1":** these are different scopes, not a contradiction. Success rate = completed action logs ratio; Blocked = agents blocked *right now*. Fixed the ambiguity with honest scope labels: **"Blocked now"** and **"Success rate (actions)"** on the analytics page (same treatment as the R1.3 `(7d)` labels).

## 8. Engagement revisit — DONE (`0b4238a` + `77f7d16`)

The N2 frontend patch already made engagement fetch live on every mount (useEffect keyed on range/platform) with a loud `loadError` + 44px retry. Backend pass added the human copy: the error now reads "Connection problem (…). Your data is fine — tap retry." — no raw API codes.

**Verify (code):** `engagement/page.tsx:79-97` — fetch on mount, `!res.ok → throw`, catch → `setLoadError`, retry button re-invokes `fetchMetrics`. Same honest-toast treatment as the calendar.

---

## Gates + evidence

| Gate | Result |
|---|---|
| api `tsc --noEmit` | exit 0 |
| fe `tsc --noEmit` | exit 0 |
| `next build` | exit 0 (×2) |
| Push | `77f7d16b` on origin/main, ls-remote verified |

**Screenshots (vision-read, stored `AppData/Local/Temp/`):** `n2-leads.png` (outreach block + funnel banner + 156 badge), `n2-pipeline.png` (honest empty state). **Data backups:** `docs/evidence/n2/marketing-calendar-pre-migration.json` (74 rows, committed).

## Honest limits

1. `grow.ts` slot-scheduler + `command-thread.ts` + `approvals.ts` gate still touch `marketing_content_calendar` (X-cron publish path) — documented seam, next backend pass. UI surfaces + data are unified.
2. `replied_at` is structurally present but always `null` — the outreach provider table has no reply-webhook column yet. Honest null, not invented.
3. `idle_hours` uses row `updated_at` as the activity clock (the only per-row timestamp that exists). A per-step activity log would be more precise — N3 candidate.
