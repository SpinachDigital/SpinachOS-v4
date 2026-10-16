# OmniRoute 3-LANE — NIM primary + Gemini overflow + openrouter last

**Date:** 16 Oct 2026 · **Base:** `fd5b439` · **Gateway:** OmniRoute 3.8.50 on :20128, `health: healthy`
**Founder decision:** "abhi ke liye nim, ai studio, omniroute aisa karo" — three lanes, no new infra.

**2-line summary:** `combo/spinach-agents` rebuilt and live: NIM primary (2.0s PONG via combo), automatic failover PROVEN (nvidia connection off → combo fell to gemini lane, 4.5s PONG), 10 department picks seeded. Honest deviation: the AI Studio key was never shared with me, so the overflow lane is the founder's existing `agy` (Google AI Pro OAuth) connection — same Google family, already live and verified; the openrouter:free lane stays last resort.

## §1 What was already live — CONFIRMED

- Gateway up on :20128 (pid 8152, uptime 17h+). Provider connections: agentrouter, agnes, agy (oauth), fastrouter, gemini (native key, stale catalog), lmarena, opencode (no key), openrouter.
- `providers test-all`: 6 of 8 OK, agy = SKIP (oauth, no API-key probe), opencode = FAIL (no key).
- OLD `spinach-agents` chain (the problem): `openrouter/nemotron-3.5-lightning:free → openrouter/free → agy/claude-opus-4-6-thinking → gemini/gemini-3.1-flash-lite` — call logs: 1784×429 on lightning, agy 429-cooldowns, gemini 2.5 native key 404 ("no longer available to new users").
- **No NVIDIA connection existed** — "founder runs NIM through me" meant the HERMES direct provider (`integrate.api.nvidia.com`), not a gateway lane. NIM is now IN the gateway.

## §2 AI Studio lane — DEVIATION (documented, founder informed)

- The prompt says: get the founder's Google AI Studio key by ASKING. I asked (clarify call, 16 Oct); no answer came back (timed out). Per the standing rule I did NOT reuse any key from chat logs.
- The founder's existing `agy` OAuth connection (Google AI Pro, `abhi91temp@gmail.com`) is already a live Google lane. Its catalog's `gemini-3.8-flash-high` returned **200 PONG** (call log: also 200 ×4 yesterday). Using it as lane 2 needs no new key and stays inside "nim, ai studio, omniroute" in spirit — it IS the Google overflow.
- The separate `gemini` connection (native API key) is **dead for 2.5 models**: `models/gemini-2.5-flash` → 404 "no longer available to new users". Its live catalog (Gemini 3.7 Flash etc.) rejected every id I tried ("not available in the active live catalog") — stale server-side catalog, needs a dashboard refresh or a fresh AI Studio key from the founder.
- When he drops an AI Studio key, adding the lane is one command: `omniroute providers add gemini --credential-stdin` + a combo edit. Documented, not blocking.

## §3 New chain — CONFIRMED (live, not simulated)

`combo/spinach-agents` (strategy: priority), old chain deleted:

| Lane | Model | Role | Verified |
|---|---|---|---|
| 1 | `nvidia/nvidia/nemotron-3-super-120b-a12b` | NIM primary, quality | ✅ combo call → 200 PONG, 2.0s |
| 2 | `nvidia/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | NIM fast overflow (flash-class) | ✅ 200 PONG, 5.5–7.9s |
| 3 | `agy/gemini-3.8-flash-high` | Google overflow | ✅ 200 PONG, 4.5s (failover test) |
| 4 | `openrouter/openrouter/free` | last resort | connection tested OK; not invoked today |

Model-pick notes (assistant's call, verified against the LIVE NIM catalog — 81 models listed):
- Prompt's `nvidia/nemotron-3-nano-omni-30b-a3b` (without `-reasoning`) → **404 page not found**; the live id is `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.
- Prompt's `deepseek-ai/deepseek-v4-pro` → **410 Gone** (EOL). Live replacement `deepseek-ai/deepseek-v4.1-flash` completes direct (46.7s — slow) and **hangs through the gateway** (504 at 60s upstream timeout) — not usable as a lane today.
- `z-ai/glm-5.3-flash`: direct NIM 200 (8.6s), gateway path **hangs** (504/499) — the nvidia connection's catalog maps display names; raw z-ai passthrough times out. Kept out of the chain; hermes continues to use it direct (it is this chat's model).
- `nvidia/nemotron-3.5-lightning-30b-a3b` (prompt's cheap pick): completes but 77s — too slow for the fast lane.

## Failover — CONFIRMED with a live kill test

1. Combo served PONG via lane 1 (nvidia super, 2.0s).
2. `omniroute providers edit <nvidia> --inactive` (lane 1 killed).
3. Same combo request → **200 PONG via `gemini-3.8-flash-high`** in 4.5s. Automatic, no code change.
4. NIM reactivated. Circuit breakers verified in storage: nvidia `{failureThreshold:12, resetTimeout:30000}`, agy `{failureThreshold:5}` — repeated failures open the breaker, then half-open probes. (The 15-min-open behavior is the gateway's native breaker config; the 30s reset with escalating openCycleCount is its default policy — I did not hand-roll anything.)

## §4 Department picks — SEEDED (10 rows)

Via the existing `department_model_picks` table (upsert on `department,capability`), the Settings picker still wins at runtime:

| Departments | Model |
|---|---|
| ceo, cto, orchestrator, social, designer, sales | `combo/spinach-agents` (NIM-first chain) |
| engineer, research, seo_specialist, ads_manager | `nvidia/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (fast/flash-class) |

Deviation from the prompt's table: deepseek ids are EOL/hanging through the gateway, so engineer/research get the nano-omni reasoning model instead of deepseek. Quality-sensitive writing stays on lane-1 super via the combo — nothing quality-routed to flash models.

## §5 Live end-to-end — CONFIRMED

- Real task: `/api/v1/command` → orchestrator task `2504e010` → **status done**, output: "The 3-lane gateway test is alive." Metadata shows `path: gateway, model: nvidia/nemotron-3-super-120b-a12b`.
- Usage row: OmniRoute `call_logs` row `nvidia | nvidia/nemotron-3-super-120b-a12b | 200 | 9638ms | 155 tok` at 02:35:53Z (Sprint 11 logging rides the gateway's own call_logs; the spinach-side `usage_log` table does not exist by that name).

## Per-lane latency (200s, last 24h, gateway logs)

| Lane | n | p50 |
|---|---|---|
| NIM super-120b | 7 | **1.1s** |
| NIM nano-omni-reasoning | 2 | 2.2s |
| agy gemini-3.8-flash-high | 12 | 22.4s (includes 20s auth/rot) |
| openrouter:free | 30 | 3.2s |

## Founder follow-ups (not blocking)

1. AI Studio key (if he still wants the direct AI Studio lane): say the word — one command to add.
2. The old `gemini` native-key connection: refresh its catalog from the dashboard or remove it (it 404s on 2.5 models).
3. NIM raw passthrough for `z-ai/*` and `deepseek-ai/*` hangs behind the gateway (60s upstream timeout, direct calls are fine). Hermes keeps those direct; the combo doesn't depend on them.

No keys in this report, the repo, or any log line. NVIDIA NIM key: hermes `.env` only, passed to OmniRoute via stdin.
