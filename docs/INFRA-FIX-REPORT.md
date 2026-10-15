# INFRA FIX — API unreachable from browser (15 Oct)

**2-line summary:** Root cause was a stale `FRONTEND_URL` in `api/.env` (CORS allowed the dead APP tunnel, so every browser fetch was blocked) plus Laya :8000 being down (DEGRADED health). Both fixed — API restarted with the live APP origin, Laya re-armed; /approvals and /today now load fully over the public tunnels with matching numbers (160 = 160 = 160 = 160).

## Checks (prompt order)

| # | Check | Result |
|---|---|---|
| 1 | API alive locally | 200 `/health` — alive |
| 2 | Laya :8000 | **000 — DOWN** (root cause #2) |
| 3 | cloudflared | 2 processes; API `anderson-vid-record-boulevard`, APP `dated-campbell-ensemble-blacks` |
| 4 | `FRONTEND_URL` in api/.env | **`photographers-butter-holidays-ann` — STALE (dead tunnel; root cause #1)** |
| 5 | Baked API URL in FE build | `anderson-vid-record-boulevard` — matches live API tunnel ✓ (no rebuild needed) |

## Fix applied

1. `api/.env`: `FRONTEND_URL` → `https://dated-campbell-ensemble-blacks.trycloudflare.com` (ctx.ts pushes it into the CORS allow-list at boot).
2. API restarted (ESM env workaround: `set -a && . ./.env`) — CORS list now carries the live APP origin.
3. Laya restarted on 127.0.0.1:8000 (uvicorn, `laya/main:app`) — health `{"status":"ok","version":"2.0"}`.
4. No frontend rebuild needed — build #5 confirmed the baked API base was already the live tunnel.

No product code changed. Infra-only fix.

## Verification (live, via the public APP tunnel)

- **CORS preflight from the live APP origin:** OPTIONS → **204** ✓ (was the blocker).
- **Browser-like GET with Origin header:** → **200** ✓.
- **API health (local + tunnel):** `ok` — db ok (75ms), queue ok, embeddings ok. **Laya ok** — no more DEGRADED inputs.
- **/approvals** (`infra-approvals.png`, 182KB, opened): cards with previews render, **160 Pending = 160 Total = sidebar badge 160 = queue badge "160 pending"**, green **Live** dot, zero "Couldn't reach the API".
- **/today** (`infra-today.png`, 187KB, opened): all four tiles load real values — **160 approvals pending, 0 open tickets, 48 new leads, 0 content scheduled**; inbox cards render; no red "Failed to fetch" anywhere.

## The 161 vs 160 badge question

Resolved — not a bug. DB says **160 pending now**; 3 approvals were decided in the last 24h (one between my last report and this check). The 161 in the N3 report was correct at write time. One number, one source, and it agrees everywhere today: DB = sidebar badge = KPI bar = queue header = /today tile = **160**.

## Current live state

- APP: https://dated-campbell-ensemble-blacks.trycloudflare.com
- API: https://anderson-vid-record-boulevard.trycloudflare.com
- API :4000, FE :3000, Laya :8000 — all up, `persist_on_release` so they survive the session.
- Evidence: `docs/evidence/infra/` (gitignored — real lead data in the shots).

## Standing note

Tunnels rotate on every re-arm. When they do, two things must follow within the same pass: (1) `FRONTEND_URL` in `api/.env` → new APP URL + API restart, (2) FE rebuild only if the API URL changed (it's baked at build time). This exact drift is what broke today — the re-arm updated the FE build but not the API's CORS list.
