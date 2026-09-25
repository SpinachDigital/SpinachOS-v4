# AUTH-401 INCIDENT + FIX — FULL REPORT

**Date:** 2026-09-25 · **Repo:** `SpinachDigital/SpinachOS-v4`
**Commits:** `9b6e0f3` (P0 lockdown) → `c0b113b` (server-side session mint) → `57ccdb8` (TOKEN_INVALID + re-mint on any 401)
**Symptom seen twice by the founder:** Settings → Models & Brains → "Agent models" card showing **"Couldn't load profiles: API 401"** with "0 of 10 known profiles" fallback text, while the page header still said **● Live**.

---

## 1. WHAT WAS HAPPENING — the full chain

### Background: the P0 security lockdown (commit `9b6e0f3`)
The deep audit found that `POST /api/v1/auth/token` would mint a **director JWT for anyone** — no credential check — which effectively opened all ~78 "protected" endpoints. The P0 fix locked it down properly:
- Mint now requires an existing valid director JWT (or a one-time `BOOTSTRAP_ADMIN_TOKEN` env value, logged loudly on use)
- `JWT_SECRET` rotated (killing the leaked scraper token)
- No more hardcoded fallback secret; API refuses to start without the env

**The intended consequence:** unsigned callers can no longer mint. **The unintended consequence:** the frontend WAS one of those unsigned callers.

### Failure chain in the browser
1. Frontend's `lib/auth.ts` minted directly from the browser: `POST :4000/api/v1/auth/token` with just `{sub:'director'}` — no credentials
2. After the lockdown this returns **401**
3. `apiFetch` had exactly one recovery path: re-mint **only** if the 401 body carried `code: 'TOKEN_EXPIRED'`
4. A locked-endpoint 401 has no such code → **no re-mint, no retry**
5. Every `/api/v1/*` call in the UI failed with 401 → panels showed error text while unauthenticated `/api/*` bridge endpoints (right-rail widgets) kept working — hence the confusing "Live badge but 401 inside"

### Second layer: the zombie cache
After the first fix shipped, the 401 **still** appeared. Reason: the browser's `localStorage` held a token minted **before the JWT_SECRET rotation**. The API rejects it with a *plain* `{error:'Invalid token'}` — again **no `code`** — so even the new mint path never engaged. The stale token was reused on every call, forever.

**Root cause, stated plainly:** the auth client assumed "401 means expired" and only had one recovery path for one 401 flavor, while the P0 work introduced two new 401 flavors (endpoint-locked, stale-signature) the client never learned about.

---

## 2. WHAT WE DID — the two-stage fix

### Stage 1 — server-side session mint (commit `c0b113b`)
The bootstrap secret must never ship to the browser (it would let anyone mint director JWTs). So the mint moved behind the frontend server:

```
Browser ── GET /api/auth/session ──▶ Next.js server route
                                        │ holds API_BOOTSTRAP_TOKEN server-side
                                        │ (frontend .env.local — gitignored, verified)
                                        ▼
                                   POST :4000/api/v1/auth/token (with bootstrap)
                                        ◀── 24h director JWT
Browser ◀── short-lived JWT only ─────┘
```

- New file: `frontend/command-center/src/app/api/auth/session/route.ts` — server-only, caches the JWT with a 5-min expiry margin, secret never enters the JS bundle
- `lib/auth.ts` `mintToken()` now calls `/api/auth/session` instead of the locked API directly
- `API_BOOTSTRAP_TOKEN` set in `frontend/command-center/.env.local`; `.gitignore`'s `.env.*` rule confirmed to exclude it (`git check-ignore` verified)

### Stage 2 — kill the zombie cache (commit `57ccdb8`)
- **API side:** invalid-token 401s now return a distinguishable code:
  `{ "error": "Invalid token", "code": "TOKEN_INVALID" }`
- **Client side:** `apiFetch` re-mints on **ANY 401** — expired (`TOKEN_EXPIRED`), stale/invalid (`TOKEN_INVALID`), or even an unparseable body — drops the localStorage cache, mints fresh through the session route, retries exactly once. No 401 flavor can wedge the client anymore.

---

## 3. TEST EVIDENCE (live against :4000/:3000)

| Test | Result |
|---|---|
| `GET :3000/api/auth/session` | returns valid JWT (199 chars) |
| Fresh minted JWT → `GET :4000/api/v1/profiles` | **200**, 10 profiles with `fallback_model` + `provider`, ads_manager `dormant` |
| Token signed with the ROTATED-AWAY secret → profiles | `{"error":"Invalid token","code":"TOKEN_INVALID"}` — exactly the new distinguishable code |
| Unauthenticated mint (`{"sub":"attacker"}`) | **401** — the P0 lockdown still fully holding |
| `tsc --noEmit` (API + frontend) | 0 errors |
| `.env.local` committed? | No — git-ignored, verified |
| Pages live | `/settings` 200, `/clients/[id]` 200 |

**One manual step for the founder:** hard-reload the dashboard (Ctrl+Shift+R) once — the first `apiFetch` sees the 401 from the stale token, silently re-mints, and the Models & Brains table fills with all 10 profiles.

---

## 4. SECURITY POSTURE — after both fixes

- Bootstrap secret lives in exactly two places: `api/.env` (API process) and `frontend/command-center/.env.local` (Next server process). Both gitignored; never in any commit; never in browser-reachable code.
- Browser holds only a short-lived (24h) director JWT — same trust boundary as the original design, now with a locked mint.
- Every P0 control re-verified after this work: unauth mint 401, leaked scraper token dead, webhook secret enforced, startup crash without JWT_SECRET.

---

## 5. LESSON LOGGED

> When tightening an auth server, enumerate every 401 flavor your clients can hit and give each one a machine-readable code. A client with a single recovery path for a single flavor will loop forever on the flavors you forgot. (Here: endpoint-locked + stale-signature both lacked codes; the fix — code on every flavor + re-mint on any 401 with exactly one retry — is the pattern to copy.)
