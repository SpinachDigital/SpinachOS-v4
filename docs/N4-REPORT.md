# N4 · BACKEND — Web Push for gate events

**Date:** 15 Oct 2026 · **Base:** `f8cbf30` (N3 fix) → **HEAD:** `94e7fdf` (ls-remote verified, tree clean)
**Gates:** api tsc exit 0. Frontend patch `n4-patch-1.patch` applied FIRST (commit `9422aec`), fe tsc 0, build 0, FE restarted.

**2-line summary:** Web Push infra live: VAPID keys generated (private key only in gitignored `api/.env`), subscribe/unsubscribe/vapid-key/test endpoints up, aur teeno buzz triggers wired (new approval, stuck 72h crossing, @founder mention). Ek honest blocker: `push_subscriptions` migration Supabase MCP se run nahi ho payi (direct-SQL connection timeout — REST fine, DDL path dead) — file ready hai, founder ko dashboard se run karna hai.

## §1 Web Push infrastructure — CONFIRMED (code), subscription store PENDING (migration)

| Piece | Status | Proof |
|---|---|---|
| VAPID keys | ✅ | generated via web-push, written to `api/.env` (gitignored, verified `git check-ignore`); private key never printed to chat, never in repo |
| `GET /api/v1/push/vapid-key` | ✅ LIVE | returns `{"public_key":"BGt_GgQ..."}` (public key is designed to be public) |
| `POST /api/v1/push/subscribe` | ✅ code / ⚠ store | upserts `{endpoint, keys:{p256dh,auth}}` per user; honest 500 with table error until migration runs |
| `POST /api/v1/push/unsubscribe` | ✅ code | deletes by user+endpoint, returns removed count |
| `POST /api/v1/push/test` | ✅ LIVE | `{ok:true,sent:0,failed:0}` with zero subscriptions; fires a real buzz once a subscription exists |
| Dead-subscription cleanup | ✅ | 410/404 from the push service deletes the row (no endless retries) |

## §2 Push triggers — CONFIRMED (wired at the source)

Exactly three events buzz. Nothing else. Every push: title + one line + deep link. No payloads, no secrets.

| Trigger | Where | Deep link | Behavior |
|---|---|---|---|
| New approval lands | `POST /api/v1/approvals` (approvals.ts) | `/approvals?focus=<id>` | fire-and-forget, never blocks the 201 |
| Pipeline crosses 72h idle | `stuck-scanner.ts` (15-min interval, edge-detected) | `/pipeline/<id>` | ONE buzz per crossing; long-stuck stages never re-buzz; recovery resets the edge |
| @founder in office chat | `command-thread.ts` user-message insert | `/chat?thread=<id>` | only `^@founder` prefix; body truncated to 100 chars |

**Live-verified today:** vapid-key 200 · test-push `{sent:0,failed:0}` (no subs yet — honest) · subscribe returns the exact table-missing error until migration. The full arrival test (§ "actual push screenshot") needs the migration + the assistant's Settings toggle (his lane), then `POST /push/test` shows the notification on the device.

## §3 Frontend hookup contract (for the assistant's Settings toggle)

```
GET  /api/v1/push/vapid-key            → { public_key: "<base64url>" }
     (no auth; feed straight into pushManager.subscribe's applicationServerKey,
      URL-safe base64 → Uint8Array conversion required)

POST /api/v1/push/subscribe            (Authorization: Bearer <token>)
     body: { endpoint: "<push service URL>",
             keys: { p256dh: "<b64url>", auth: "<b64url>" } }
     → 200 { ok: true, id: "<uuid>" }

POST /api/v1/push/unsubscribe          (auth)
     body: { endpoint: "<push service URL>" }
     → 200 { ok: true, removed: <n> }

POST /api/v1/push/test                 (auth, no body)
     → 200 { ok: true, sent: <n>, failed: <n> }
```

Push JSON payload: `{ title, body, link }` — service worker should `showNotification(title, { body })` and focus/open `link` on click.

## §4 Founder step (the one blocker)

`supabase/migration-n4-push.sql` — Supabase dashboard SQL editor. Same situation as N3's migrations: the MCP direct-SQL path times out from this machine (4 attempts, `SELECT 1` included), while the REST path (what the API uses) works fine at ~166ms. Until the table exists, subscribe returns an honest 500 naming the missing table; every other piece is live.

## Security notes

- Private VAPID key: `api/.env` only. Never logged, never in a response, never committed.
- Push bodies carry only title + first 100 chars + a route. No approval content, no lead data.
- Subscribe/unsubscribe require a valid JWT (`authMiddleware`).
