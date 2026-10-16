# NIM Full Catalog Sweep + Rewire — dedicated "os" key

**Date:** 16 Oct 2026 · **Key:** new dedicated NVIDIA key (name: `os`) swapped into spinach `api/.env`, hermes `.env`, and the OmniRoute `NVIDIA NIM` connection (via stdin, never echoed). Old key replaced.
**Gates:** sweep completed on live catalog (81 models), combo v2 live-verified with kill-test failover, real agent task E2E green.

**2-line summary:** 81-model sweep done — 7 winners (200 + non-empty), 3 stable lanes picked: `nemotron-3-super-120b-a12b` (quality, 3.6s), `nemotron-3.5-super-vl-120b-a12b` (fast + coding, 2.7s), plus agy/gemini overflow. `combo/spinach-agents-v2` swapped in after a passing live test; failover kill-test proved lane 2/3 auto-jump; dept picks updated; real orchestrator task completed via the new key on lane 1.

## §0 Key swap — CONFIRMED

| Target | Status |
|---|---|
| `SpinachOS-v4/api/.env` `NVIDIA_API_KEY` | ✅ added (was absent) |
| hermes `.env` `NVIDIA_API_KEY` | ✅ replaced |
| OmniRoute `NVIDIA NIM` connection | ✅ removed + re-added with new key via `--credential-stdin`; gateway PONG 1.5s |
| Key in repo/report/logs | ❌ never — gitignore verified, key only in env files |

## §1 Sweep results (50 chat candidates probed; 31 pre-filtered as non-chat: embed/safety/reward/parse/vision-detector/riva/etc.)

| Model | Status | Latency | Verdict |
|---|---|---|---|
| nvidia/nemotron-3-super-120b-a12b | 200 | 3655ms | **QUALITY WINNER** — big A12B MoE, stable PONG across 5+ probes, code probe clean (`s[::-1]`) |
| nvidia/nemotron-3.5-super-vl-120b-a12b | 200 | 2772ms | **FAST + CODING WINNER** — fastest stable PONG, code probe correct, vision-capable |
| stepfun-ai/step-5-preview | 200 | 4158ms | Runner-up — good PONG + code; kept out (less proven, niche) |
| z-ai/glm-5.3-flash | 200 | 7761ms | Works but slow via gateway; code probe timed out (45s) — out |
| openai/gpt-oss-20b | 200 | 13251ms | Too slow (13s+) — out |
| meta/llama-3.2-11b-vision-instruct | 200 | 2386ms | Small, hallucinated ("Atari" for PONG repeat) — out |
| nvidia/nemotron-3.5-lightning-30b-a3b | 200 | 7234ms | PONG OK but code probe 47s timeout — out |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning | 503/timeout | 30-37s | FLAKY — PONG ok earlier, then 503 + 37s timeout — out |
| nvidia/nemotron-3-ultra-550b-a55b | timeout | 32s+ | 550B too heavy for free tier — out |
| z-ai/glm-5.3 | timeout | 32s+ | Hangs via gateway (works direct) — out |
| deepseek-ai/deepseek-v4.1-flash | timeout | 32s+ | Hangs via gateway — out |
| google/gemma-4-31b-it, meta/llama-3.2-90b, meta/muse-glimmer-30b, nvidia/ising-calibration-1.5-31b, poolside/laguna-xs-2.1 | timeout | 32s+ | Gateway hang — out |
| 25 more (yi-large, jamba, sea-lion, dbrx, gemma-2/3, granite ×3, codellama-70b, llama2-70b, mistral ×5, kimi-k2.6, nemo-12b, cosmos, nemotron-51b/70b/ultra-253b, chatqa, minitron, nemotron-4-340b, nemotron-nano-3-30b, phi-3.5, palmyra ×4, zamba2) | 404 | ~2.2s | Not servable on this key/tier — out |

**Winners: 7 (200+non-empty). Stable lanes: 3.**

## §4 Rewire — CONFIRMED (build → test → swap)

- **New combo first:** `combo/spinach-agents-v2` created, tested live (PONG 3.2s via lane 1) BEFORE switching. Old combo deleted only after the swap.
- **Chain (priority):** 1) `nvidia/nemotron-3-super-120b-a12b` → 2) `nvidia/nemotron-3.5-super-vl-120b-a12b` → 3) `agy/gemini-3.8-flash-high` → 4) `openrouter/openrouter/free`
- **Dept picks (10 rows upserted):** ceo/cto/orchestrator → `combo/spinach-agents-v2`; engineer/research/social/seo_specialist/ads_manager/sales/designer → `nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b` direct (fast lane — quality-sensitive writing stays on lane 1 via the combo)
- Note: 3 early combo calls skipped to lane 2 — cause: `max_tokens:60` truncated reasoning models to "empty", plus transient upstream 503s. With `max_tokens:200` the chain is stable: lane 1 served 3/3 PONG post-restore.

## §5 Verify — CONFIRMED

| Check | Result |
|---|---|
| Lane 1 PONG | ✅ `nemotron-3-super-120b-a12b`, 3.6s / 4.3s / 1.3-2.9s across probes |
| Lane 2 PONG | ✅ `nemotron-3.5-super-vl-120b-a12b`, 2.7s (also served during transient lane-1 skips) |
| Lane 3 PONG | ✅ `agy/gemini-3.8-flash-high`, 4.9s (via failover) |
| **Kill-test failover** | ✅ nvidia conn `--inactive` → combo auto-served by **gemini lane**, PONG 4.9s → NIM reactivated → lane 1 back (PONG) |
| Real agent task E2E | ✅ orchestrator task `7dc3600f` → **done**, `via: gateway, model: nvidia/nemotron-3-super-120b-a12b`, real output on the NEW key |

## Tooling notes (for the next sweep)

- `omniroute` CLI must run WITHOUT `--base-url` for combo commands (the flag breaks route resolution → HTML 404); provider edit/remove NEED it when cwd pollutes env. Combo `create/delete/switch/list` from `~` works.
- The spinach `.env` pollutes omniroute CLI env when cwd is `SpinachOS-v4/api` (JWT_SECRET/PORT warnings) — run omniroute from `~`.
- Gateway accepts unauthenticated calls from localhost — sweep scripts need no key.
