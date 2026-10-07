# Phase 8 GOAL 2 — RLS Isolation Adversarial Probe (PASS)

Measured 2026-10-07T08:10Z (script: `api/scripts/phase8-rls-probe.js`, re-runnable; needs API :4000 + 065 migration applied).

```
0. founder token minted (200)
1. clients A=30802d6b… B=bb1200af… (created fresh for the probe)
2. deliverables A=6944ef34… B=574adab1… (metadata.client_review=pending)
3. invites: A=ok B=ok (magic links returned once, hashes stored)
4. sessions: A=200 B=200 (30d, sliding expiry)
5.   A reads B's deliverable → 404  (expect 403/404) ✓ ISOLATION HELD
5b.  A lists deliverables → 200, B rows leaked: false  ✓ NO LEAKAGE
6.   A overview → 200, client_id=A, waiting_on_you=1  ✓ client-scoped
7.   founder session on /portal/* → 401  ✓ (portal is client-only; founder uses founder routes)
7b.  founder /deliverables?client_id=B → 200, rows=1  ✓ override intact
8.   client session on founder /clients → 401  ✓ EXPLICIT REJECTION
9.   reuse of the same invite link → 401  ✓ single-use enforced
10.  garbage token → 401, no info leakage  ✓
11.  A decision on own deliverable → 200  ✓ THE ONE WRITE works (approved → metadata.client_review=accepted, ledger entry + founder feed)
12.  probe rows cleaned (clients/invites/sessions/deliverables)
```

**Chain:** invite (hash-only, 7d, single-use) → redeem (rate-limited 10/min/IP, all failures → same 401) → session (30d sliding) → client-scoped reads (RLS `client_read_own_*` on deliverables/approvals/workflows/pipeline_events + `client_read_own_clients_self` on clients) → THE ONE WRITE (`POST /portal/reviews/:id/decision`, only on `metadata.client_review='pending'`, ledger + feed, never a second inbox).

**Migration:** `supabase/migrations/065-phase8-client-portal.sql` — applied manually (tables + `client_id_claim()` fn + policies). The DO-block `clients` exclusion (PK=`id`, not `client_id`) was the fix — `client_read_own_clients_self` covers the self-read.
