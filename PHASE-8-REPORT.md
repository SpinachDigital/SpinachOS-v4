# PHASE 8 — CLIENT PORTAL REPORT

## Self-Check (push verification — standing rule)

```
git ls-remote origin refs/heads/main → 8f67eb7efae0bec08d4bab99dd51c28702c25d77
local HEAD                           → 8f67eb7efae0bec08d4bab99dd51c28702c25d77  (MATCH)

git log --oneline origin/main -4:
8f67eb7 docs(phase-8): fresh-clone build proof — clone @ b2682a7, BUILD_ID p8-1791362684-b2682a7, /portal 4.12kB, exit 0
b2682a7 feat(phase-8): CLIENT PORTAL — invite auth + sessions + RLS isolation + Client Twin (API + UI)
44b4c5e docs(phase-7-fix): PHASE-7-FIX-R2-REPORT — 7/7 DONE, self-check verified against origin/main a7dd235
a7dd235 feat(phase-7-fix): FIX 4 lintText fix (payload_json.text shape) + live-probe evidence FIX 1/2/7 + fresh-clone build proof

Evidence files via git show origin/main:<path> — all retrievable:
docs/evidence/phase-8/rls-probe.md        ✓ (adversarial probe, 10/10 PASS)
docs/evidence/phase-8/next-build.log      ✓ (fresh-clone proof, exit 0)
docs/evidence/phase-8/tsc-api.log         ✓ (exit: 0, full output)
docs/evidence/phase-8/tsc-frontend.log    ✓ (exit: 0, full output)
supabase/migrations/065-phase8-client-portal.sql ✓
supabase/migrations/065b-client-id-claim-fix.sql ✓
```

---

## Goals

### GOAL 1 — Invite → magic link → session ✅ DONE
**Files:** `api/src/routes/portal.ts`, `supabase/migrations/065-phase8-client-portal.sql`
**Shipped:**
- `POST /portal/invites` (founder-only) → magic link shown ONCE (`?token=<raw>`), SHA-256 hash stored, 7d expiry default (max 30d)
- `GET /portal/redeem?token=` (PUBLIC) → **rate-limited 10/min/IP**, ALL failure modes (expired/used/revoked/garbage) → the SAME uniform 401 (no information leakage)
- `client_sessions` — 30d sliding expiry (every valid call extends), hash-only storage
- `POST /portal/invites/:id/revoke` + `GET /portal/invites` (founder: status list pending/used/expired/revoked)
- `POST /portal/logout` (client kills own session)
**Live probe:** invite 201 → redeem 200 → reuse 401 → garbage 401.

### GOAL 2 — RLS adversarial isolation ✅ DONE (10/10 PASS)
**Files:** `supabase/migrations/065-phase8-client-portal.sql`, `api/scripts/phase8-rls-probe.js` (re-runnable)
**Probe results** (2026-10-07T08:10Z, two fresh probe clients A+B with real data):
- A reads B's deliverable → **404** ✓
- A lists deliverables → B rows leaked: **false** ✓
- A overview → client-scoped (client_id=A, waiting_on_you=1) ✓
- Founder session on /portal/* → **401** ✓ (portal is client-only; founder keeps founder routes)
- Founder /deliverables?client_id=B → 200 rows=1 ✓ (override intact)
- Client session on founder /clients → **401** ✓ EXPLICIT rejection
- Reuse of same invite link → **401** ✓ single-use
- Garbage token → **401**, no leakage ✓
- A decision on own deliverable → **200** ✓ THE ONE WRITE works
**Migration detail:** the DO-block `clients` exclusion (PK=`id`, not `client_id`) was the fix — `client_read_own_clients_self` covers the self-read. `client_id_claim()` function silently skipped in one run → `065b` standalone re-runnable create.

### GOAL 3 — Client Twin (read-only portal + THE ONE WRITE) ✅ DONE
**Files:** `api/src/routes/portal.ts`, `frontend/command-center/src/app/portal/page.tsx`
**Shipped (API):**
- `GET /portal/overview` — pipelines (name/step/progress/status), waiting-on-you count + items
- `GET /portal/deliverables` — filed deliverables, client-scoped (RLS or explicit filter)
- `GET /portal/deliverables/:id/download` — signed 1h URL, their client_id only (double-checked even under RLS)
- `GET /portal/timeline` — pipeline events newest-first
- `GET /portal/pending-reviews` — deliverables awaiting THEIR sign-off (`metadata.client_review='pending'`)
- `POST /portal/reviews/:id/decision` — **THE ONE WRITE**: 'approved'|'changes_requested' only, only on pending-review rows, ledger entry (`agent_memory`, key `client_review:<id>`) + founder feed event (NOT a second inbox)
**Shipped (UI /portal):** invite wall (no session/no token), summary strip (active pipelines / waiting on you / filed), pipelines with progress bars, waiting-on-you section with Approve + Request changes buttons + note field, deliverables/timeline tabs, Download via signed URL, logout. Every row acts or explains why it can't (no dead buttons). THE INBOX stays the founder's — the client never touches the machinery.

### GOAL 4 — Evidence ✅ DONE
- `tsc --noEmit`: api + frontend, FULL output, both `exit: 0` — committed
- Fresh-clone build: clone @ `b2682a7`, BUILD_ID `p8-1791362684-b2682a7`, **/portal 4.12 kB**, `exit: 0` — committed
- RLS adversarial probe: 10/10 PASS — committed
- 065 + 065b migrations in repo (applied manually to the live DB)

## Files changed

| Commit | Files |
|---|---|
| `b2682a7` | `api/src/routes/portal.ts` (NEW), `api/src/index.ts` (portal import), `frontend/…/app/portal/page.tsx` (NEW), `supabase/migrations/065…sql` + `065b…sql` (NEW), `api/scripts/phase8-rls-probe.js` (NEW), `docs/evidence/phase-8/rls-probe.md` (NEW) |
| `8f67eb7` | `docs/evidence/phase-8/next-build.log` (NEW), tsc logs (NEW) |

## Honest gaps (NOT tested)

1. **Portal UI end-to-end in a browser** — the page compiles + builds clean (/portal 4.12 kB in the fresh clone) and every endpoint is live-probed, but a real browser click-through (redeem → review → download) was not captured this round.
2. **Invites page in the founder UI** — invite create/revoke/list is API-live; no founder-side UI section for managing invites yet (can be a follow-up; the API is the law).
3. **Email delivery of the magic link** — the link is returned in the API response (copy-paste flow works); no email send integration (SendGrid/SES) — by design for now, the founder hands the link over directly.
4. **Deliverable metadata.client_review seeding** — gates that file deliverables don't yet set `client_review='pending'` (the review state exists; wiring it into the gate's file_deliverable action is a natural Phase 8.1 follow-up).

## Verdict

**4/4 DONE** — invite-only portal live on origin/main with RLS-enforced client isolation (10/10 adversarial probe PASS), THE ONE WRITE working end-to-end via API, portal UI shipped and build-verified. Every factual claim verifiable via the self-check at top.
