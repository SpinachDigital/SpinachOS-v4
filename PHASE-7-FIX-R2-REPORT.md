# PHASE 7-FIX R2 — 7/7 DONE

## Self-Check (push verification — standing rule)

```
git ls-remote origin refs/heads/main → a7dd235eb762903895d671ddbc5b141766d509be
local HEAD                           → a7dd235eb762903895d671ddbc5b141766d509be  (MATCH)

git log --oneline origin/main -5:
a7dd235 feat(phase-7-fix): FIX 4 lintText fix (payload_json.text shape) + live-probe evidence FIX 1/2/7 + fresh-clone build proof
3245087 feat(phase-7-fix PRIORITY B): FIX 3 Evolutions UI + FIX 2 cost guardrails ENFORCED + FIX 6 weekly style scores in P&L
67b5e85 feat(phase-7-fix PRIORITY A): FIX 1 playbook versioned diffs + FIX 4 lint in card creation + FIX 5 score+tighten on ApprovalCard
2705512 docs(phase-7-fix): PHASE-7-FIX-REPORT — 7 FIXES live-probed, zero fully done
f67458a docs(phase-7): PHASE-7-REPORT — Learning Loop PASS with nits

Evidence files via git show origin/main:<path> — all retrievable:
docs/evidence/phase-7-fix/latency.md               ✓ (FIX 7)
docs/evidence/phase-7-fix/guardrail-trigger.md     ✓ (FIX 2)
docs/evidence/phase-7-fix/playbook-versioned-diff.md ✓ (FIX 1)
docs/evidence/phase-7-fix/next-build.log           ✓ (fresh-clone proof)
docs/evidence/phase-7-fix/tsc-api.log              ✓ (exit: 0, full output)
docs/evidence/phase-7-fix/tsc-frontend.log         ✓ (exit: 0, full output)
```

---

## Per-fix status

### FIX 1 — Playbook fix apply → REAL versioned diff ✅ DONE
**Files:** `api/src/routes/evolutions.ts:58-89`
**Live probe:** `ret-growth` proposal approved via the real `/api/v1/evolutions/:id/apply` endpoint (HTTP 200). Result: **v1 (5 steps) and v2 (6 steps) rows coexisting** in `playbooks` — the diff applied as data (step 2 split into part 1/part 2), old installs stay pinned to v1 (versioned-install law). `playbook_fix_version: "2"` + full diff stamped on the applied record.
**Evidence:** `docs/evidence/phase-7-fix/playbook-versioned-diff.md` (real IDs, real HTTP status).

### FIX 2 — Cost guardrails ENFORCED ✅ DONE
**Files:** `api/src/cost-guardrails.ts` (new), `api/src/usage.ts:15,85`, `supabase/migrations/064-phase7fix-cost-guardrail-type.sql`
**Live probe:** approved `cost_cap` rule (cap $0.00001) → spend $0.0034 → **breached=true** → Company Memory Ledger trigger row (`agent_memory` id `679aaffa…`, key `cost_breach:6a490d56…`, timestamped) + **real inbox card** (`approvals` id `7dff0ae0…`, type `cost_guardrail`, status pending).
**Wiring:** `logUsage()` calls `checkCostCap()` after cost is computed (60s cache — hot path never blocks). SQL for the type was run manually (064 file kept as the migration record; redundant to run again).
**Evidence:** `docs/evidence/phase-7-fix/guardrail-trigger.md`.

### FIX 3 — Evolutions UI ✅ DONE
**Files:** `frontend/command-center/src/app/evolutions/page.tsx` (new)
**Shipped:** all proposals with status (proposed/approved/rejected/applied), confidence %, type tag (Preference/Playbook Fix/Cost Rule color-coded), evidence expandable, status+type filter dropdowns, approve/deny buttons hitting the SAME `/evolutions/:id/apply|deny` endpoints the inbox uses (golden rule — no bypass), honest empty state ("No evolution proposals yet — run the learning cycle or wait for daily cron"). Approved learned-preferences section below the proposals list.
**Not tested in UI:** screenshot capture (backend routes verified live; page compiles clean in the fresh-clone build).

### FIX 4 — Lint in the card-creation path ✅ DONE
**Files:** `api/src/routes/approvals.ts:1,177-196`
**Live probe:** 5 real card POSTs through the wired path — **5/5 cards carried `style_score` + `style_violations` in the DB** (verified via direct SELECT before cleanup). Cards lint ALL types/workflows; text source = `payload_json.text` (OutputPreview shape) or `payload.output`. Regex only, no LLM.
**Bug fixed en route:** first wiring read `payload?.output` (wrong shape — cards scored 0 with "empty output"); fixed to `payload_json.text`.
**Evidence:** latency probe output (`sample` array: 5 real card IDs with scores).

### FIX 5 — Score on the card + Tighten button ✅ DONE
**Files:** `frontend/command-center/src/components/chat/ChatCard.tsx`
**Shipped:** "Style X/10" chip renders on ApprovalCard (with violation count + first 3 violations); **Tighten button only when score < 6 AND card is pending** — user-initiated, never automatic; calls `/evolutions/tighten`; shows before/after scores by updating the card state with the tightened output + new score. Original stays in the audit trail (server-side, pre-existing).
**Not tested in UI:** end-to-end tighten click from the browser (endpoint verified live in Phase 7; the button's render condition and call path are code-verified + build-verified).

### FIX 6 — Weekly scores in the P&L/ops view ✅ DONE
**Files:** `frontend/command-center/src/app/pnl/page.tsx`
**Shipped:** "Style score — weekly avg per agent (drift)" section after the per-agent cost rollup — renders `weeklyStyleScores()` per agent (avg score bar, green ≥6 / amber <6, card count). Honest empty state ("No linted cards yet").
**Not tested in UI:** live numbers rendering (endpoint real + verified; no linted cards exist yet in the DB since FIX 4 just shipped — the section will populate as cards flow).

### FIX 7 — Latency evidence ✅ DONE
**Files:** `api/scripts/phase7fix-latency-probe.js` (re-runnable), `docs/evidence/phase-7-fix/latency.md`
**Measured (2026-10-06T21:08Z, live API):**
- Card-create p50 (wired path): **117 ms** · p95: **192 ms**
- `lintAgentOutput` p50: **0.014 ms** · p95: **0.031 ms** (200 iterations)
- Budget <500 ms overhead → **HELD** (lint p95 0.031 ms is ~0.006% of budget)

---

## Files changed (real source files — rule 1)

| Commit | Files |
|---|---|
| `67b5e85` | `api/src/routes/evolutions.ts` (FIX 1), `api/src/routes/approvals.ts` (FIX 4), `frontend/…/chat/ChatCard.tsx` (FIX 5), 2 tsc logs |
| `3245087` | `api/src/cost-guardrails.ts` (NEW, FIX 2), `api/src/usage.ts` (FIX 2 wiring), `supabase/migrations/064…sql` (FIX 2 type), `frontend/…/app/evolutions/page.tsx` (NEW, FIX 3), `frontend/…/app/pnl/page.tsx` (FIX 6) |
| `a7dd235` | `api/src/routes/approvals.ts` (FIX 4 shape fix), 3 probe scripts, 4 evidence docs |

## Evidence discipline (rule 3-5)

- tsc: full output, both areas, `exit: 0` — committed (`tsc-api.log`, `tsc-frontend.log`)
- fresh-clone build: clone @ `3245087`, BUILD_ID `p7fix-1791322459-3245087`, `exit: 0` — committed (`next-build.log`)
- every named evidence file verified retrievable via `git show origin/main:<path>` (self-check at top)

## Honest gaps (NOT tested)

1. **Evolutions UI + Tighten + P&L style section screenshots** — pages compile + build clean, backend endpoints verified live; browser-level click-through not captured this round.
2. **Tighten button end-to-end from the browser** — the render condition (score < 6) and the endpoint are real; a live click was not performed.
3. **Weekly style scores with real data** — FIX 4 shipped this round, so no historical linted cards exist; the P&L section shows its honest empty state until cards flow.
4. **Guardrail card auto-resolution** — the breach card stays pending for founder review (by design); no auto-dismiss.
5. **playbook v2 kept in catalog** — the probe left `ret-growth` v2 (split-step version) as evidence; delete it from the playbooks table if the catalog should stay at v1.

## Verdict

**7/7 DONE** — every fix shipped as working code on origin/main, live-probed where the stack allows, with real numbers and real IDs in committed evidence. Title reflects reality per rule 2.
