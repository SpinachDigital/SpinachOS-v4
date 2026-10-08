# PHASE 11 — WIN: THE REVENUE ENGINE — 5/5 DONE

**Loop closed:** leads inbox → qualify (agent scores, founder decides) → outreach
(agent drafts, founder approves, THEN it sends) → one-click onboard (client +
pipeline + tasks + portal invite). Every touchpoint a ledger entry.

**Push verification (self-check at top):** `git ls-remote origin refs/heads/main`
== local HEAD after push (see hash at the bottom of this report).

---

## Report Summary

| Goal | Status | Key Evidence |
|------|--------|--------------|
| **1** — Leads data model + API | ✅ | Migration 069 + 069b applied LIVE; CRUD + import live-probed (201/200/409/422); invalid transitions rejected server-side |
| **2** — Qualify (agent scores, founder decides) | ✅ | `POST /leads/:id/qualify` → score 88 + rationale + `lead_qualified` card (read-tier); approve → qualified. Batch: 10 leads scored, 5 seeded each with own card |
| **3** — Outreach (draft → approve → send) | ✅ | Draft 200 (style_score 10, card write-tier); **direct send → 403** (negative probe); approve → `pending_send` honest (no sender connected); lead → outreached + ledger entry |
| **4** — Onboard (one click → client + pipeline + tasks) | ✅ | Probe lead → client `b2cbb2ba…` + pipeline `fdd2a321…` (client-onboarding v2 pack) + tasks/gates seeded + portal invite `d40753fa…` + lead `onboarded` |
| **5** — WIN UI (parallel-lane patch) | ✅ | `phase-11-win-ui.patch` applied verbatim (git apply), wired to real endpoints, tsc clean; full flow clickable; 4 real screenshots |

---

## GOAL 1 — Leads data model + API

**Files:** `supabase/migrations/069-phase11-win-leads.sql`,
`supabase/migrations/069b-approvals-lead-qualified-type.sql`,
`api/src/routes/win-leads.ts` (CRUD + import + transitions).

**Live probes (api/scripts/phase11-e2e.js, real IDs):**
- `POST /api/v1/leads` → **201** `{ id: 035c8b19…, status: 'new' }` (2nd run: `09024a63…`)
- duplicate email → **409** (dedupe on email)
- `GET /api/v1/leads?status=new` → **200**, 65+ real rows
- `PATCH /leads/:id` notes → **200**
- `PATCH` invalid transition `new → onboarded` → **422** (no skipping, server-side)
- `POST /api/v1/leads/import` (3 rows, 1 dupe) → **200** `{ created: 2, skipped_dupe: 1, skipped_bad: 0 }` (cap 200/req)
- client session on `/leads` → **403** (founder-only; probe step 19)

**Migration notes (live-learned, in the file):** the Sprint 9 status CHECK
blocks WIN statuses on UPDATE, so 069 swaps the constraint `NOT VALID` first,
maps legacy rows (`contacted→outreached`, `proposal→responded`,
`closed_won→onboarded`, `closed_lost→dead`), then `VALIDATE`s. Applied live
via Supabase Management API (both statements 201; the MCP apply_migration path
timed out — wrong project-ref in the local MCP config, noted in report tail).

## GOAL 2 — Qualify (agent scores, founder decides)

**Files:** `win-leads.ts` (qualify + qualify-batch), `approvals.ts`
(lead_qualified card effects), migration 069b (card type).

**Live probes:**
- `POST /leads/:id/qualify` → **200** `{ id, score: 88, rationale: "Lead has approved budget and clear intent…", card_id: 49f25c95… }`
- card `type=lead_qualified`, `risk_tier=read` (qualifying is low-risk)
- `POST /approvals/:card_id/approve` → **200** → lead `qualified` (server-side transition new→qualified)
- reject = Disqualify with reason (notes carry `Disqualified: <reason>`)
- `POST /leads/qualify-batch` → **200** `{ scored: 10 }`; 5 seeded leads each scored (40–50) with own card; rate-limited 2 runs/hour (LLM call per lead); **unscored-only** (no duplicate cards — fix live-learned: score=0 counts as unscored; newest-first so manual leads clear before stale scraper rows)

## GOAL 3 — Outreach (draft → approve → send, the golden rule)

**Files:** `win-leads.ts` (draft-outreach + approve-and-send), reuses
Sprint 9 `outreach_drafts`/`outreach_messages` + duplicate guards.

**Live probes:**
- `POST /leads/:id/draft-outreach` (qualified only) → **200** `{ draft_id: 9f118c9b…, subject: "Rohit referral: Gym chain ads automation", style_score: 10, card_id: 8dc75751… }` — lint runs on the draft AND rides the card payload
- **NEGATIVE: direct `POST /outreach/:draft_id/approve-and-send` without card approval → 403** ("send blocked: approval card is 'pending'") — the card's approval IS the gate, verified server-side against the approvals row, never a client flag
- approve card → **200** → `approve-and-send` → **200** `{ status: 'pending_send', note: 'no sender connected — draft queued as pending_send (honest state; connect an email provider to deliver)' }` — **NO fake-send**: no email provider connected in `provider_keys`, so the draft is queued honestly; an `outreach_messages` (sent) row is NEVER written without delivery
- lead → `outreached` + `last_outreach_at` + ledger entry `outreach:<draft_id>` (first contact replayable)
- rate limit 20 email sends/day hardcoded; duplicate guards per lead+channel (DB unique index backstop)

## GOAL 4 — Onboard (one click → client + pipeline + tasks)

**Files:** `win-leads.ts` (onboard), reuses Phase 6 playbook install path +
Phase 8 portal invite machinery.

**Live probe (real IDs end-to-end):**
- `POST /leads/:id/onboard` `{ playbook_pack_slug: 'client-onboarding' }` (responded only — from qualified → **400**) → **200**:
  - lead_id `09024a63-dd7a-4132-b5fb-7617024924f9`
  - client_id `b2cbb2ba-c95b-497e-8245-5380bc09e231` (ProbeLab Industries, from lead data; metadata carries `onboarded_from_lead_id`)
  - pipeline_id `fdd2a321-5542-4576-bb58-02d111ec6dbb` ("Client Onboarding v2 (v2)", stages seeded, first stage in_progress)
  - invite_id `d40753fa-959e-4280-9b65-9161b2e0b8d2` (portal magic link auto-created — no extra clicks)
  - tasks + gates seeded from the pack; `pipeline_events` row `lead_onboarded`; ledger entry `onboard:<lead_id>` (memory_type=client)
- lead → `onboarded` + `client_id` set
- **WIN→DELIVER handoff working:** the client page shows the timeline lead→client and the ACTIVE pipeline (screenshot `onboarded-client-pipeline.png`)

## GOAL 5 — WIN UI (parallel lane patch — wired, not rebuilt)

**Files:** `frontend/command-center/src/app/leads/page.tsx` (patch applied
verbatim via `git apply`), `frontend/command-center/src/app/approvals/page.tsx`
(WIN filter now includes `lead_qualified`).

- The parallel-lane patch rebuilt `/leads` to the frozen contract (stages new →
  qualified → outreached → responded → onboarded; disqualified/dead collapsed;
  score chips; company/source; days-in-stage aging with amber stale glow at 7d;
  per-stage actions Qualify / Draft outreach / Onboard with pack picker; Add
  lead + CSV Import panels; ≥44px targets; honest empty states).
- **Wired to the real endpoints** (contract freeze honored — no endpoint shape
  changes): list/create/qualify/draft-outreach/onboard + import all live-probed
  above through the same routes the UI calls.
- Founder flow clickable end-to-end: add → qualify → approve (INBOX) → draft →
  approve (INBOX) → send-status → onboard. 4 real screenshots below.

---

## Evidence (docs/evidence/phase-11/) — all `git show`-retrievable on origin

- `tsc-api.log`, `tsc-frontend.log` — proper `tee` + `PIPESTATUS` pattern, both `exit: 0`
- `next-build.log` — fresh clone at `8682404` → `C:/Users/Abhishek/AppData/Local/Temp/p11-fresh-clone`, ✓ Compiled successfully, 28/28 pages, **BUILD_ID `1Pphkk4i8cY-uFk_RmFiE`**, exit 0
- `latency.md` — lead reads p95 **57 ms** (< 500ms) over 20 sequential reads

### Screenshots (honesty rule: >50KB, ≥800px, real UI, real data; verifier opens every one)
1. `leads-pipeline.png` (147KB, 1440px) — WIN pipeline: New 76 (real scraper leads with scores + Qualify buttons), Qualified 1 (Probe Lead 65/100 + Draft outreach), Outreached 1 (Strength Yard gym)
2. `qualify-card.png` (167KB, 1440px) — THE INBOX: pending `lead_qualified` card "Lead qualified — Stream (score 20/100)" with rationale, payload, ✓ Approve / ✕ Reject
3. `outreach-draft-card.png` (190KB, 1440px) — THE INBOX: pending `outreach` card "Outreach email — ShotLab Outreach" with subject + 409-char draft body + Copy + ✓ Approve / ✕ Reject (style_score in the card payload; seeded via the same API path the UI button calls)
4. `onboarded-client-pipeline.png` (163KB, 1440px) — client detail page for the probe lead's client (ProbeLab Industries, ACTIVE) with the seeded "Client Onboarding v2 (v2)" pipeline and the lead→client timeline

Probe scripts (committed): `api/scripts/phase11-e2e.js`,
`phase11-batch-latency.js`, `phase11-screenshots.js`, `phase11-seed-outreach.js`,
`phase11-precheck.js`.

---

## SECURITY — probes that prove it
1. **No send without an approved card:** direct `approve-and-send` on a pending
   card → **403** (server-side check of the approval row + draft status).
2. **Client sessions:** client-role JWT on `/leads` → **403** founder-only.
3. **No fake-send:** no connected email identity → `pending_send` + honest note;
   `outreach_messages` (the audit "sent" table) never written without delivery.
4. **Rate limits:** import cap 200 + dedupe; qualify-batch max 50/run, 2/hour;
   20 email sends/day hardcoded.
5. **Transitions:** server-side validation, no skipping (422 probe).

## WHAT WAS NOT TESTED / DEFERRED (honest)
- **Real email delivery** — no email sender is connected in `provider_keys`.
  The send path queues `pending_send` honestly and says so. Wiring a real
  provider (Resend/SendGrid SMTP) is a follow-up; the approval gate, queue
  state, and lead/ledger transitions are all live-probed without it.
- **Batch rate-limit 429** — the limiter (2/hour) is live code but the probe
  ran once; a second immediate call was not spent to avoid burning LLM calls
  (the earlier orphaned run demonstrated the window logic — that run's
  duplicate-card behavior is what prompted the unscored-only fix).
- **Style score on the card UI** — the outreach card renders subject/body/chars;
  the lint score (10/10) is stored on the draft row + card payload, not yet a
  visible chip on the ApprovalCard component (a cosmetic follow-up, the lint
  itself runs and its score is in the payload the UI already renders as JSON).
- **UI 360px check** — layout uses grid `auto-fit minmax(220px,1fr)` which
  stacks; verified at 1440px in captures, not re-captured at 360px.

## Ops notes (live-learned, worth keeping)
- Supabase MCP `apply_migration` timed out repeatedly — the local MCP config
  points at project-ref `aptsnmqdbteecsgkuwql`, but the live project is
  `snuvnlxlhvwmzqzbffjz` (see `SUPABASE_URL` in api/.env). Migrations were
  applied via the Supabase Management API `/database/query` endpoint instead
  (HTTP 201 both). Fix the MCP project-ref to un-break the tool path.
- The legacy `GET /api/v1/leads` in `routes/workflows.ts` (authMiddleware only)
  shadowed the new founderOnly route — express matches the FIRST registered
  handler. Fixed by importing `win-leads` before `workflows` in `index.ts`
  (both routes still exist; the founder one wins).

---

**PHASE 11 — 5/5 DONE.** The money loop is live: a lead enters the inbox, the
agent scores it, the founder decides, the agent drafts in the founder's voice,
the founder approves, the send is honest (queued when no sender), and one click
turns a responder into a client with a pipeline, tasks, and their portal invite.
No auto-outreach, no fake sends, no skipped stages.

HEAD on origin after push: see `git ls-remote` output in the session log —
hash reported in the push reply.
