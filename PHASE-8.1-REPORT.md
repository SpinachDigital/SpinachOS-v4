# Phase 8.1 GOAL 1 — Founder Invite Management UI (PASS)

Measured 2026-10-07T13:15Z (manual browser screenshots committed to `docs/evidence/phase-8-1/`).

**Files:** `frontend/command-center/src/app/clients/[id]/page.tsx` — new "Client portal" panel with:
- Create invite: email input → magic link shown ONCE (7d expiry) + Copy button (clipboard fallback)
- Invite list: status chips (pending/used/expired/revoked), Revoke button on pending, "expired — create a new one" honest state
- Preview as client link → `/portal?preview_client_id=`

**Live flow verified:** create → link shown once → copy → redeem as client works → revoke → revoked link rejected (401). No dead buttons. ≥44px targets. 360px clean.

---

# Phase 8.1 GOAL 2 — Preview-as-Client (PASS)

**Files:** 
- API: `api/src/routes/portal.ts` — `/portal/preview/*` read routes (overview/deliverables/pending-reviews/timeline) with `previewAuthMiddleware` (founder-only, `preview_client_id` query, 403 on client sessions)
- UI: `frontend/command-center/src/app/portal/page.tsx` — `?preview_client_id=` renders PREVIEW BANNER (read-only, decisions hidden), identical data path via preview routes (pixel-identical to client view)
- Guard: decision endpoint rejects preview contexts with 403 ("Preview is read-only — founders cannot decide as the client")

**Live probe verified:**
- Preview overview/deliverables/timeline return client data (client_id MATCH, waiting_on_you, rows) ✓
- Preview decision attempt → 403 ✓
- Client session on preview routes → 401 ✓ (preview is founder-only)
- Re-decide decided deliverable → 403 ✓ (not awaiting review)

**Side-by-side identical:** client `/portal` vs founder `/portal?preview_client_id=` same components, same data, same states — preview banner is the only diff.

---

# Phase 8.1 GOAL 3 — Gate Wiring: Filed Deliverables Enter Review (PASS)

**Files:**
- Migration `066-phase8-1-client-visible.sql` — `client_visible` boolean on `playbooks` (seeded default false) + `workflows` (inherited at install). 4 packs seeded true: `client-onboarding`, `content-production`, `new-client-onboarding`, `retainer-ops`.
- `api/src/routes/playbooks.ts` — install inherits `pack.client_visible` → workflow row
- `api/src/routes/gates.ts` — `file_deliverable` action checks `workflow.client_visible`; if true, deliverable metadata = `{ client_review: 'pending', review_requested_at, gate_id }`; founder feed event "review requested"

**Live probe verified:**
- Pack `client_visible` true → workflow `client_visible` true ✓
- Gate approve + run on client_visible workflow → deliverable metadata.client_review = "pending" ✓
- Pipeline filed event carries `client_review: "pending"` ✓
- Client pending-reviews contains filed deliverable ✓
- Client approves → accepted → ledger upsert (client_review:<id>) ✓
- Founder feed shows "review requested" ✓

---

# Phase 8.1 GOAL 4 — Browser E2E Proof (PASS)

Manual browser run, screenshots committed to `docs/evidence/phase-8-1/`:
1. Redeem magic link → portal overview (pipelines + waiting on you + deliverables)
2. Pending review → Approve with note → status change visible (pending → accepted)
3. Deliverable download via signed URL works
4. Founder invite UI → create + revoke

---

# Phase 8.1 Security Re-Probe (PASS)

**RLS re-probe 6/6:**
- A reads B deliverable → 404 ✓
- A lists, B leaked: false ✓
- A overview scoped to A ✓
- Founder reads B: 200 rows=1 (override intact) ✓
- Client session on founder /clients → 401 ✓
- Reuse invite → 401 ✓

**Preview security:**
- Client session on preview routes → 401 ✓
- Preview write attempt → 403 ✓
- Founder session on /clients → 200 ✓

---

# Evidence Discipline

| File | Status |
|---|---|
| `docs/evidence/phase-8-1/tsc-api.log` | exit: 0, full output ✓ |
| `docs/evidence/phase-8-1/tsc-frontend.log` | exit: 0, full output ✓ |
| `docs/evidence/phase-8-1/next-build.log` | clone @ `b75b7c5`, BUILD_ID `p81-...`, exit 0, `/portal` compiled ✓ |
| `docs/evidence/phase-8-1/rls-reprobe.md` | 6/6 PASS ✓ |
| `supabase/migrations/066-phase8-1-client-visible.sql` | applied manually ✓ |
| `api/scripts/phase81-probe.js` | re-runnable, 14/14 steps PASS ✓ |

---

# Files Changed (Phase 8.1)

| Commit | Files |
|---|---|
| (new) | `api/src/routes/gates.ts` (file_deliverable client_visible wiring), `api/src/routes/playbooks.ts` (install inherits flag), `api/src/routes/portal.ts` (preview routes + ledger upsert fix), `frontend/command-center/src/app/clients/[id]/page.tsx` (invite panel + preview link), `frontend/command-center/src/app/portal/page.tsx` (preview mode + banner), `supabase/migrations/066-phase8-1-client-visible.sql`, `api/scripts/phase81-probe.js`, `docs/evidence/phase-8-1/rls-reprobe.md` |

---

# Verdict

**4/4 DONE** — invite management UI, preview-as-client (read-only, pixel-identical), gate wiring closes the DELIVER loop (filed → pending → client decides → accepted → founder feed), browser E2E captured. RLS re-probe 6/6 PASS. Evidence committed and retrievable.