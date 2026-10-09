# PHASE 13 — THE CAPSTONE — 5/5 DONE

**Push verification (self-check at top):** pushed `65bcf2d` →
`git ls-remote origin refs/heads/main` = `65bcf2d174fe43c90b2fde8413100dbd0db5e0b0`
== local HEAD ✅.

The blueprint build is complete. Every deferred nit is dead (shipped or
fixed), the dead weight is cut, company memory has a face, a full founder day
runs green end-to-end through real endpoints, and the handbook is the
handover. Spinach OS is done as an internal build.

---

## GOAL 1 — Kill every deferred nit — ✅ (3/3 shipped)

| Nit | Status | Evidence |
|---|---|---|
| Style chip on ApprovalCard | **Shipped** | `ApprovalQueue.tsx` renders `metadata.style_score` as a color-coded chip (≥7 green, 3–6 amber, <3 red). Visible in `360-approvals.png` — "STYLE 10/10" / "STYLE 8/10" chips on every card |
| SMTP transport | **Shipped** | `providers/email.ts` — nodemailer wired behind Resend (key format `host\|port\|user\|pass`, DB-backed, never logged). Probes PASS: unreachable host → honest `provider_error:ECONNREFUSED`; malformed key → honest `provider_error:smtp key malformed`; **never a fake send**. Resend restored as primary after the probe |
| 360px captures | **Shipped** | 4 real captures (360×device, 245KB–693KB, all >50KB): `360-today.png`, `360-leads.png`, `360-approvals.png`, `360-grow.png` — every one vision-verified: stacked, readable, no overlap, no horizontal overflow |

**360px findings (cosmetic, not fixed — logged honestly):** inbox-card titles
truncate at one line; /approvals metrics row clips "Total"; GROW card titles
wrap oddly in the publish queue. None block use; single-line-clamp → two-line
is the known fix if wanted.

## GOAL 2 — Dead-weight audit — ✅

| Page / route | Verdict | Action |
|---|---|---|
| `/comms` page + `routes/comms.ts` | **DEAD** — the page was the ONLY caller of the REST routes; war-room posts go direct to DB via warroom-helpers. Deleted both. | Deleted; redirect `/comms → /chat` |
| `/calendar` page | **DEAD** — unlinked since the marketing-calendar IA; nothing referenced it | Deleted; redirect `/calendar → /marketing` |
| `/evolutions` page | **ALIVE but orphaned** — the learning loop (daily cron) proposes; apply/deny lives here | Sidebar link added (nav fixed, not deleted) |
| `/keokarpin-3d` | ALIVE — middleware subdomain rewrite for the Keo Karpin client | Untouched |
| `/portal`, `/tasks/[id]`, `/clients/[id]`, `/pipeline/[id]`, `/marketing/*` | ALIVE — linked, in use | Untouched |
| 2026-10-02 audit names (`/office /assets /finance /knowledge /terminal`) | Verified: office/finance/knowledge/terminal redirects stand; `/assets` is the real library | No change |

**Audit probe: 34/34 PASS** — 20 sidebar pages 200 · 8 redirects 307 ·
deleted `/api/v1/comms/channels` 404 · client JWT → 401/403 on assets,
overview, email-status · `next build` green after deletion (stale
`.next-prod` types cleared). Script: `api/scripts/phase13-audit-probe.js`.

## GOAL 3 — Company memory gets a face — ✅

- **UI:** `/memory` — parallel-lane patch applied **verbatim** (118-line
  page, contract-frozen reads: search box, client filter, honest empty state,
  ranked cards with kind/scope/content/source). Sidebar entry added.
- **Contract untouched:** `GET /api/v1/knowledge/query` response shape
  unchanged (page reads it as-is).
- **Live-learned bug fixed (migration 071):** the Phase 4 RPC isolation
  treated a NULL client_id as "agency-only" — the founder's unfiltered search
  could see **zero** of the 50 client chunks. 071 flips the predicate:
  no client_id → founder sees ALL; client_id → that client + agency. Applied
  live to the SpinachOS project (HTTP 201). Before: `q=realty` → 0 results.
  After: 2 ranked results ("Intake — Vertex Realty", "Intake — Realty E 4").
- **SECURITY (live-caught gap):** `/knowledge/query` and
  `/knowledge/context` were reachable with client JWTs (200). Both now
  `founderOnly` → **401** on client sessions (probed), founder path intact.
- **Latency law: p95 75ms PASS** (30 reads; min 29, median 39) —
  `docs/evidence/phase-13/latency.md`.
- **Screenshot:** `memory-search.png` (222KB) — search "realty", 2 ranked
  result cards, "2 results · lexical-fallback · 365ms" line, client filter.
- **Note (honest):** engine shows `lexical-fallback` when the embedding
  provider call fails — results still real (tsvector), engine name surfaced
  in the UI. Not a fake.

## GOAL 4 — Founder day-in-the-life shakedown — ✅

`api/scripts/phase13-founder-day.js` — **27/27 green**, one continuous run:

```
01 open /today (273 pending)          15 draft outreach (style 10, bc8c1674)
02 fetch inbox (50 pending)           16 approve outreach card
03-05 approve 3 cards                 17 SEND → sent, msg 01a11f99 (REAL)
06-07 reject 2 cards (reason kept)    18 onboard → client 8e43cfa3, pipeline 59d9b358
08-13 create + qualify 3 leads        19 create advance gate (0e054c30)
14 approve qualification card         20 approve advance gate
                                      21 run gate → stage advanced to discovery
22 reuse asset → GROW draft cc41cdf5  25 schedule post → scheduled
23 generate (style 10)                26 reply to ticket (msg 2e742b89)
24 approve GROW draft card            27 close the day (267 pending, 84 new leads)
```

**Friction log (found → fixed in-phase):**
1. *Draft-before-approve ordering* — the first run drafted outreach before
   approving the qualification card; the API correctly 400'd
   ("cannot draft for status 'qualified-approval-pending'"). Fixed the script
   flow; **API behavior was right** — this is exactly the enforcement the
   golden rule wants.
2. *Wrong gate create fields* — used `title/kind` in the gate body; API
   correctly 400'd (`workflow_id, gate_name, action required`). Fixed.
3. *Ticket insert mismatch* — the script used a `body` column that
   `support_tickets` doesn't have (the portal route files subject + first
   message separately). Fixed to match the real shape.

**Zero API bugs found.** Every friction was the script meeting honest
validation. Dashboard state after the day: `founder-day-today.png` (412KB) —
267 approvals pending, 1 open ticket, 84 new leads, 3 scheduled, 5 inbox
cards with Approve, 6 pipelines with progress bars, WIN week 72/12/6.

## GOAL 5 — The operator's handbook — ✅

`docs/OPERATORS-HANDBOOK.md` (committed) — the daily loop (morning /today →
inbox zero; WIN → DELIVER → GROW), key management (Resend/SMTP/Publora — how
to swap, what happens when a key dies), recovery (Supabase down, API down,
stuck pipeline, failed publish, failed send — where every queue lives), and
the honest limits (no auto-publish, 20 sends/day, no multi-tenancy, no mobile
app, SMTP is a fallback not a promise). Plain English, one idea per sentence,
written for a non-builder.

---

## Evidence — `git show`-retrievable on origin (65bcf2d)

- `docs/evidence/phase-13/tsc-api.log`, `tsc-frontend.log` — tee + PIPESTATUS, `exit: 0` both
- `docs/evidence/phase-13/latency.md` — memory search p95 75ms PASS
- `docs/evidence/phase-13/next-build.log` — fresh clone @ 65bcf2d, BUILD_ID inside, exit 0
- Screenshots (real UI, real data, verifier opens every one):
  `360-today.png` 286KB · `360-leads.png` 651KB · `360-approvals.png` 694KB
  · `360-grow.png` 246KB · `memory-search.png` 222KB · `founder-day-today.png` 412KB
- Scripts committed: `phase13-founder-day.js` (27/27), `phase13-audit-probe.js`
  (34/34), `phase13-smtp-probe.js`, `phase13-360.js`, `phase13-memory-shot.js`,
  `phase13-day-shot.js`

## Migrations

**071** (`071-phase13-rag-founder-sees-all.sql`) — required, applied live via
the Supabase Management API to the **SpinachOS project**
(`snuvnlxlhvwmzqzbffjz`, HTTP 201), file committed in `supabase/migrations/`.
No other migrations needed. (Note: `hermes/config.yaml`'s supabase
`--project-ref` points at a different, INACTIVE project — the live API uses
the SpinachOS ref in `api/.env`; the config ref is worth correcting but was
not touched this phase.)

## WHAT WAS NOT DONE (honest)

- **SMTP positive-path delivery** — no real SMTP credentials exist, so the
  probe exercised the two failure paths (unreachable, malformed) plus the
  wiring. A real SMTP key would exercise sendMail end-to-end; Resend is
  primary and already delivers for real.
- **360px cosmetic truncations** — logged above, not fixed (single-line
  clamps; nothing broken).
- **RAG semantic engine** — embedding provider calls are failing right now,
  so results come via the lexical path with the engine honestly labeled.
  The hybrid code is intact and will fuse when the provider answers.

---

**PHASE 13 — 5/5 DONE.** The internal build is finished. What comes next is
a strategy decision, not a build task.
