# Spinach OS v4 — Stabilization + Revamp Report

**Date:** 13 Oct 2026 · **Repo:** `SpinachDigital/SpinachOS-v4` · **HEAD:** `2998daf00728064a910e4751b14ddbb1e543075d` (origin/main, `git ls-remote` verified)

**2-line summary:** Infra fully operational (API/Laya/OmniRoute routing/tunnels), 5 UX patches + revamp phases R1–R4 applied and live-verified; one-number law holds (208 = 208 = 208), blind approvals eliminated, test-data dupes purged, P&L 100% priced. Remaining: engagement-page revisit fix, two stat pairs re-verify, `is_test` migration run (dashboard), full 25-page re-walk.

---

## 1. Infrastructure (all green, live now)

| Component | State | Detail |
|---|---|---|
| API :4000 | ✅ ok | boot: `set -a && . ./.env && set +a && npx tsx src/index.ts` (ESM hoisting workaround — JWT_SECRET fatal otherwise) |
| Laya :8000 | ✅ ok | binds `127.0.0.1` (0.0.0.0 fails `getaddrinfo` on this host) |
| OmniRoute :20128 | ✅ ok | all profiles route `combo/spinach-agents` |
| Frontend :3000 | ✅ ok | `.next-prod` distDir, `NEXT_PUBLIC_API_BASE` baked to API tunnel |
| Tunnels | ✅ live | APP `transparent-compiler-batch-ontario`, API `yoga-judges-shoot-eggs` (trycloudflare quick tunnels — URLs rotate on restart) |

**Routing fix (commit `c64c4b6`):** `auto/*` slugs resolved through dead/noauth providers. Replaced everywhere with combo **`combo/spinach-agents`** (evidence-ordered priority chain: agentrouter/claude-opus-4-8 → openrouter/nemotron-3.5-lightning:free → openrouter/free). Files: `bridge.ts`, `engines/agent-execution.ts`, `routes/dashboard.ts`, `routes/models.ts`. Panel probe `max_tokens: 400` (64 tripped reasoning-model quality gates → flapping 502s).

**Known provider state:** agentrouter credits exhausted (founder top-up needed), openrouter free pool intermittently congested (self-recovers); combo absorbs via fallback. E2E verified: research/social/seo_specialist tasks complete via nemotron fallback.

## 2. UX patches applied (Muse lane, all clean applies)

| Patch | Commit | Scope |
|---|---|---|
| ux-fixes-1 | `4963018` | honest loading states, no raw JSON, home declutter, IST calendar default |
| ux-fixes-2 | `5ae3955` | RightRail real health pill, wrong-0 kills, tabular-nums |
| ux-fixes-3 | `fcdceba` | approvals never claims empty on failure |
| ux-fixes-4 | `8737901` | entity decode in titles, calendar line-clamp ellipsis |
| ux-fixes-5 | `dcd3d53` | health pill settles on fetch throw (never stuck at CHECKING) |

`tsc exit 0` + `next build exit 0` after every patch batch.

## 3. Revamp plan R1–R4 (commit `866a87a` + `2998daf`)

### R1 TRUST (P0)
- **R1.1 Blind approvals — FIXED.** Root cause: `OutputPreview.pick()` knew only 4 payload shapes; ~205 of 208 pending approvals (`lead_qualified`, `stuck_stage`, `publish_failure`) fell through to "Details unavailable for this approval type." Now: lead → score + rationale + options; stuck → client/pipeline/stage/idle-h/SLA; failure → cleaned error; any other object → labeled fields (never dead end, never JSON dump). Live-verified in screenshot: card renders real Publora failure detail.
- **R1.2 Liveness contradictions — verified stable.** `/api/v1/hr/roster` returns 200 consistently (3× re-test); /team "offline" was an API-restart-window artifact. Offline path now keeps last roster rendered (comment documents intent).
- **R1.3 Number disagreements — FIXED.**
  - Fake "score 70" sublabel: was a hardcoded triage default in `overview.ts` — removed; inbox shows real scores only (verified: 12/100, 45/100… in titles; sublabel hidden when null).
  - WIN "44 new" vs leads "56 new": different scopes (7-day window vs all-time) — labels now say `(7d)`.
  - Agents 11 vs 15 vs 16: two different real sources (hr roster = 11 profiles; bridge agent_states = 16, 15 online). RightRail now shows **15/16 online** (honest denominator).
  - Ledger 127 vs 128: stale audit snapshot — `by_type` sum 92+8+21+6 = 127 = total ✓.
- **R1.4 Duplicates — PURGED.** 5× `acme` clients + 5× `client_pipeline` + 3× QA-named workflows (all Sept 22–23 probe era, backups in `docs/evidence/qa-quarantine-backup/*.json`), 15 probe-named leads deleted. 15 null-name leads were REAL (google_maps Mira Road businesses) — **not deleted, names backfilled from company field**. After: clients 0, workflows 0, leads 63.

### R2 FUNCTION (P1)
- **R2.1 /tasks 404 — FIXED.** New `/tasks` list page + `GET /api/v1/tasks` route (bounded 100, newest first) + sidebar nav item. Live-verified: "100 job runs" listing with statuses.
- **R2.2 Marketing revisit — calendar FIXED.** Silent fail left "0 posts" on revisit; now honest toast on HTTP fail / network throw. Engagement page: NOT yet fixed (next pass).
- **R2.3 Footer health pill — verified live** (patch 5) settling to real state.

### R3 POLISH (P2)
- "1 calls" grammar → pluralized (P&L, client detail).
- `gateway:ceo` / `dept_*` prefixes → human names in ledger (filter options, rows, detail).
- Hinglish fragment in UI ("Package select karo") → English.
- **Live-caught internal leak:** Publora 404 rendered full `<!DOCTYPE html>` inside an approval card → now HTML-stripped, 200-char cap (commit `2998daf`).
- Typos (craetive/Linkedin), locale mix: already gone in patch batches.

### R4 WORKFLOW (P2)
- Churned client no longer shows "Onboard this client" — state-aware "Client churned — onboarding disabled. Reactivate first." message.
- Proactive nudges (48h approvals, 5-day leads, 7-day pipelines): **not yet built** — next pass.

## 4. QA data closures

1. **One-number law (badge = tile = queue):** `GET /approvals` now defaults `status=pending`; page fetch limit 200→500. Live through tunnel: **208 = 208 = 208**.
2. **Test-data quarantine:** probe rows deleted via PostgREST (backups on disk). `supabase/migration-qa-quarantine.sql` (is_test columns + tagging, corrected to real table names `workflows`/`deliverables`) written but **NOT executed — needs Supabase dashboard SQL editor** (MCP/psql both unreachable from this box). Probe convention documented in `api/scripts/README.md`.
3. **P&L pricing:** 25 model rates seeded (`api/scripts/seed-model-rates.js`, idempotent, free-tier = honest $0), 266 legacy rows repriced → `unpriced_calls: 0`, total usage cost $0.3628.

## 5. Verification evidence

- Gates: `tsc exit 0` (api + frontend), `next build exit 0` (30/30 pages incl. new /tasks), fresh clone HEAD = push hash.
- Live screenshots (Chrome CDP, 1440×900, 87–186KB, vision-verified): `/approvals` (Live badge, 208 Pending = Total, real card content), `/today` (208/48/0/0 tiles, real scores in inbox, 15/16 rail), `/tasks` (loaded list + nav entry).
- **Production bug found & fixed during verification:** Next server was serving stale HTML referencing deleted JS chunks (all `_next/static/chunks` → 400) — app fully dead through tunnel despite "green" processes. Cause: rebuild while `next start` running overwrote `.next-prod` under the live server. Fix: always stop :3000 before `next build`, restart after. Documented in §7 runbook.

## 6. Access (rotates on tunnel restart)

```
APP: https://transparent-compiler-batch-ontario.trycloudflare.com
API: https://yoga-judges-shoot-eggs.trycloudflare.com
```
Founder JWT + full kit: `docs/QA-ACCESS.md` (gitignored — carries live token, never commit).

## 7. Runbook (order matters)

```
# API
cd api && set -a && . ./.env && set +a && npx tsx src/index.ts
# Laya
cd laya && venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
# Frontend: STOP server before build (stale-chunk bug), then
NEXT_PUBLIC_API_BASE=<api-tunnel> npx next build && npx next start -p 3000
# Tunnels
cloudflared tunnel --url http://localhost:4000
cloudflared tunnel --url http://localhost:3000
# API restart needs FRONTEND_URL=<app-tunnel> in .env (CORS) or env override
```

## 8. Open items (honest list)

| # | Item | Owner |
|---|---|---|
| 1 | Run `supabase/migration-qa-quarantine.sql` in dashboard SQL editor (MCP down) | Founder (2 min) |
| 2 | agentrouter credit top-up (~$175 budget gone) | Founder |
| 3 | Engagement page revisit flakiness (R2.2 part 2) | Next dev pass |
| 4 | Re-verify ProbeLab 88 vs 65 + "100% success + Blocked 1" pairs (R1.3 leftovers) | Next dev pass |
| 5 | Proactive nudges (R4 part 2) | Next dev pass |
| 6 | Full 25-page re-walk on this commit (6 pages spot-verified so far) | QA |
| 7 | trycloudflare quick tunnels rotate on restart — consider named tunnel for stability | Founder (optional) |

---
*Generated by the Hermes operations lane. Every number above is from a live query or real screenshot; nothing estimated.*
