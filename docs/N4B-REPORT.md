# N4b · PUSH FRONTEND — Settings toggle + service worker, live-verified

**Date:** 15 Oct 2026 · **Base:** `f7c498b` → **HEAD:** `9f7867d` (ls-remote verified, tree clean)
**Patch:** `n4-patch-2.patch` applied clean (3 files: `public/push-sw.js`, `settings/page.tsx`, `components/settings/PushToggle.tsx`).
**Gates:** fe tsc 0, next build 0 (live API base), FE restarted.

**2-line summary:** Push toggle live end-to-end: headless Chrome me CDP-granted permission se "Turn on push" ne real FCM subscription banayi aur server ne row save ki; "test push" ne **sent:1, failed:0** — pehli REAL notification FCM ko deliver hui. Poora chain (permission → SW → subscribe → persist → buzz) kaam kar raha hai.

## Live verification (headless Chrome + CDP, app tunnel origin)

| Check | Result |
|---|---|
| `push-sw.js` served | ✅ 200 |
| Settings → Notifications tab | ✅ renders (screenshot `n4b-settings.png`, 128KB) |
| Turn on push | ✅ clicked; SW registered (1 registration); **real FCM endpoint** subscription created |
| Server persistence | ✅ `push_subscriptions` row: `founder@spinachdigital.com` + `fcm.googleapis.com/fcm/send/fSWllzeKOZs…` |
| **Send test → REAL delivery** | ✅ `POST /push/test` → **`{ok:true, sent:1, failed:0}`** (342ms) — FCM accepted the push; `last_used_at` updated to `18:51:40Z` |
| Trigger 1 smoke (new approval → auto buzz) | ✅ approval 201 <1s with fire-and-forget push; smoke card rejected after, queue back to **157** |
| Deep-link handler | ✅ `notificationclick` → focus existing window / `openWindow(link)` (code-read verified) |

## What the service worker does

- `push` event → `showNotification(title, {body, icon, tag:'spinach-gate'})` — repeat buzzes collapse into one via `tag`.
- `notificationclick` → focuses an open app window and navigates to `data.link` (e.g. `/approvals?focus=<id>`), else opens a new window.
- Malformed payloads fall back to honest defaults ("Something needs you.").

## Honest limit

The *visible notification screenshot on a phone* needs a real device with the toggle turned on there — headless Chrome granted permission via CDP and accepted the push at FCM (sent:1 proves the delivery path), but headless has no notification UI to photograph. The founder's phone becomes the third subscription the moment he flips the same toggle on it.

## Report chain

- N4 backend: `docs/N4-REPORT.md` (endpoints + contract + triggers)
- This pass: toggle + SW + first real buzz
- Evidence: `docs/evidence/n4/` (gitignored, local — settings + toggle screenshots)
