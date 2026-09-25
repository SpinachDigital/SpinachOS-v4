# Spinach OS — Reliability Scripts (Phase 1)

**Date:** 2026-09-25 · **Watchdog:** Windows Scheduled Task `SpinachOS-Watchdog`, every 5 min, state Ready (NextRun 1:34 PM on registration).

## What's here

| Script | What it does |
|---|---|
| `start-all.ps1` | Starts Laya (:8000) → API (:4000) → frontend (:3000) in that order (dependency order: Laya fastest, API needs `.env`, frontend last). Idempotent — skips services already healthy. Waits up to 30s per service for health, logs to `logs/`, prints a health summary. Detached starts (`Start-Process -WindowStyle Hidden`) so services **survive the script's exit** — this was the root cause of the earlier silent deaths (shell-`&` backgrounding died with the parent shell). |
| `stop-all.ps1` | Clean shutdown: finds listeners on :4000/:8000/:3000 via `Get-NetTCPConnection`, stops the owning processes, post-checks. |
| `watchdog.ps1` | Health-check + auto-restart. **Silent when everything is healthy** (no log spam); on a down service it restarts it, waits up to 30s, logs recovery or failure to `logs/<svc>-watchdog.log`. |
| `verify-profiles.ps1` | Checks all 10 agent profiles: SOUL.md present (live + repo), **spinach-os skill bundle present** (the t_b3b75be0 crash-loop cause), bundle contains required skills, SOUL.md no drift repo↔live. `-Fix` mode auto-copies missing bundles from the default profile. |
| `export-profiles.js` | Exports all 10 profiles → `hermes-profiles/<name>/` (SOUL.md verbatim + `profile.md` with model config, skill-bundle list, cron specs, auth state — never tokens). Run after intentional changes in Hermes to re-export. |

## The watchdog (Windows Scheduled Task)

**Registered:** `SpinachOS-Watchdog` — runs `watchdog.ps1` every **5 minutes**, hidden, battery-safe, 4-min execution cap.

```
Register (already done):
  action:  powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File ...\scripts\watchdog.ps1
  trigger: every 5 min (RepetitionInterval 5min, duration 10 years)
  state:   Ready (NextRun shown at registration: 1:34 PM)
```

Manage it:
```powershell
Get-ScheduledTask -TaskName 'SpinachOS-Watchdog' | Get-ScheduledTaskInfo   # last/next run
Unregister-ScheduledTask -TaskName 'SpinachOS-Watchdog' -Confirm:$false     # remove
Start-ScheduledTask -TaskName 'SpinachOS-Watchdog'                          # run now
```

**Why a Scheduled Task (the simpler reliable option):** a persistent in-process watchdog inside the API would die with the API itself (it can't watch what it lives in), and a second always-on watcher process is another daemon to babysit. The Task Scheduler is OS-level: it fires even if nothing else is running, costs nothing when healthy, and needs no new code.

## Kill-and-recover test (demonstrated 2026-09-25)

1. `Laya` (pid 18752) killed manually → port :8000 confirmed down
2. Watchdog ran → detected down → restarted (new pid 20936) → health 200 within the wait window
3. Logged to `logs/laya-watchdog.log` (uvicorn request log) + `.err`

Same flow applies to API :4000 and frontend :3000 (the watchdog's Restart-IfDown covers all three).

## hermes-profiles/ — the sync rule (Task 2)

**`hermes-profiles/` in the repo = versioned source of truth. The Hermes live runtime (`%LOCALAPPDATA%\hermes\profiles\`) = execution copy.**

- Changes (SOUL edits, model swaps, cron changes) are **applied through Hermes**, then **re-exported here explicitly**: `node scripts/export-profiles.js`
- `verify-profiles.ps1` catches drift (SOUL.md hash mismatch repo↔live) and missing skill bundles — run it after any Hermes-side change, and periodically (add it to the watchdog cadence later if profiles churn)
- **Why this fixed the crash-loop:** the t_b3b75be0 worker crashed because skill bundles had drifted — `spinach-cto-agent` existed only in the default profile's skills, not in agent profiles. With the bundle list versioned per profile + the verifier checking it, drift is caught (and `-Fix` heals it) instead of crashing workers at spawn.
- Tokens/credentials are NEVER exported — `auth state` is a one-word status (authed/no auth.json), nothing more.

## Daily ops

```powershell
# morning / after reboot
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1

# any time (safe, idempotent)
powershell -ExecutionPolicy Bypass -File scripts\watchdog.ps1

# after Hermes profile changes
node scripts\export-profiles.js
powershell -ExecutionPolicy Bypass -File scripts\verify-profiles.ps1

# full stop
powershell -ExecutionPolicy Bypass -File scripts\stop-all.ps1
```

Logs live in `logs/` (gitignored): `api-start.log`, `laya-watchdog.log`, `frontend-start.log`, etc. — each service's stdout/stderr, plus per-service watchdog logs.
