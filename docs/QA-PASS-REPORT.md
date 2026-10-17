# QA Pass — 10 UX/Health Fixes + Founder Self-Test Report

**Date:** 17 Oct 2026 · **Base:** `6568681` · **Commits:** `20bd8cf` (10 fixes) → `575f30f` (probe stability + combo timeout) · **Status:** all 10 green, live-verified

**2-line summary:** All 10 QA items fixed and verified live — dedupe guards fire (409/422), profiles are DB-driven, redirects work, labels humanized, mobile wraps. Founder-mode self-test found one NEW production bug: the gateway's 15s combo timeout aborted healthy chains under NIM load — fixed with combo `totalTimeoutMs: 30000 / stepTimeoutMs: 18000` + a 20s probe ceiling; health now 8/8 stable with 0 flaps.

---

## §1 The 10 fixes (commit `20bd8cf`)

| # | Item | Root cause | Fix | Verified |
|---|---|---|---|---|
| 1 | Health probe flaps OmniRoute↔unreachable | 5s probe raced the 3.6s reasoning model; later, a frozen single-model probe inherited NIM's intermittent free-tier 500s | Probe the **combo** (`spinach-agents-v2`), `max_tokens: 200`, 20s ceiling | ✅ 8/8 ok, 0 flaps |
| 2 | `/win` `/deliver` `/create` 404 | blueprint-era nav names never mapped | `next.config.js` redirects | ✅ 307 × 3 → `/leads` `/pipeline` `/assets` |
| 3 | Models & Brains shows one combo for all 9 profiles | `/api/v1/profiles` served a hardcoded list, ignoring `department_model_picks` | Route now reads DB picks (defaults: ceo/cto/orchestrator → combo v2, specialists → super-vl); same mapping fixed in `bridge.ts` + `agent-execution.ts` | ✅ live API: 9/9 per-dept models |
| 4 | Duplicate + empty approval cards | ingest had no dedupe or content check | 409 on pending same `type`+`lead_id`; 422 when no rationale/description/text; one-time purge of 106 dupes | ✅ 156 → 50 pending; live 409 + 422 tests |
| 5 | Test/debug prompts in AI Agents rail | TaskRunsPanel showed everything with metadata | filter `^(say|reply|probe|ping|pong|test|debug|sweep)` on command/prompt/title | ✅ 13 test tasks filtered, 87 real shown |
| 6 | Raw HTML entities (`&#x2F;`) in lead titles | `parseInt('x2F', 16)` → NaN — the unescape helper never matched hex entities | Correct radix-slice parse; `unescapeEntities` at ingest + 4 legacy titles cleaned in DB | ✅ 4 titles now real slashes; 0 entities remain |
| 7 | Missing spaces, O-vs-0, age mismatch | JSX whitespace collapse; no slashed-zero; idle formatter dropped the hours part | `{' '}` in assets + settings; `fontVariantNumeric: slashed-zero` on Today tiles; idle shows `9d 8h` (d+h always) | ✅ screenshots: "No assets yet", zeros are digit 0 |
| 8 | Dev labels (scored by, @sales, chars, :8000, bare "s" snooze) | internal slugs leaked to the founder surface | humanizer map: "raised by Sales", "assessed with Opus 4.6 / Gemini 3.8 Flash / Nemotron 3.5", "199 characters", Laya value `local`, Snooze label, expanded bulk tooltip | ✅ desktop + 390px shots |
| 9 | Failed posts: "no reason was recorded" | `/grow/calendar` SELECT omitted the `error` column | column added + render-side HTML-strip to 140 chars | ✅ live API returns the real Publora 404 reason |
| 10 | Phone 390px overflow risk | tab row + callout had no wrap | `flexWrap` on tablist + callout | ✅ headless Chrome 390×844 shot: tabs wrap, no cutoff |

### Files touched (`20bd8cf`, 18 files +180/−75)
API: `routes/dashboard.ts`, `routes/models.ts`, `routes/approvals.ts`, `routes/win-leads.ts`, `routes/grow-calendar.ts`, `engines/agent-execution.ts`, `bridge.ts` · FE: `next.config.js`, `approvals/page.tsx`, `assets/page.tsx`, `grow/page.tsx`, `pipeline/page.tsx`, `settings/page.tsx`, `tasks/[id]/page.tsx`, `today/page.tsx`, `components/ApprovalQueue.tsx`, `components/OutputPreview.tsx`, `components/TaskRunsPanel.tsx`

**Gates:** api tsc 0 · fe tsc 0 · `next build` exit 0 · key-leak grep clean (zero API keys in report/repo — this line is the only occurrence of the prefix pattern, in prose)

---

## §2 Founder-mode self-test (what found the new bug)

Full walkthrough as Abhishek: 14 page screenshots (headless Chrome, 1280×900 + 390×844) + vision checks + live flows.

| Flow | Result |
|---|---|
| Approvals inbox visual | tabs 50/0/0, "raised by Sales", Snooze labeled, no entities/dups/test cards |
| Today tiles | real numbers; zeros render as digit 0 (slashed-zero) |
| Grow failed item | real reason shown (Publora 404), not "no reason" |
| Empty approval ingest | ✅ 422 "no content to review" |
| Duplicate lead approval | ✅ 409 + existing_id |
| Reject with reason | ✅ status → rejected |
| Real orchestrator task | ✅ done via **lane 1** (super-120b), real output |
| PONG test task | ✅ filtered from rail (13 test / 87 real) |
| Redirects ×3 | ✅ all 307 to correct targets |
| Profiles | ✅ 9/9 per-department, ads_manager dormant |
| Health ×8 rounds | ✅ 8/8 `ok | OmniRoute` after final fix |

**Honest output note:** the test orchestrator answered "I do not know what Spinach Digital does" — correct routing, but agents don't carry a company brief in that endpoint's context. (Follow-up candidate: inject company context into agent tasks.)

---

## §3 New bug found & fixed during self-test (commit `575f30f`)

**Symptom:** Agent Engine badge flapped `ok → HTTP 500` during the walkthrough, then `warn unreachable` even with a 20s probe.

**Diagnosis (gateway `call_logs`):**
- NIM free tier throws intermittent `[500] Failed to generate completions` (~250ms) on super-vl — upstream, not the gateway.
- Under load, lane 2 took 11s+, failovers pushed the full chain to **15.3–15.7s** — and the **gateway's own 15s default combo timeout** aborted at exactly 15.0s (`499 Request aborted`). The 20s probe ceiling was irrelevant; the gateway killed the request first.
- Combo failover itself is proven healthy: lane 1 → lane 2 → lane 3 (gemini) all logged 200 in sequence.

**Fix:**
1. Combo `spinach-agents-v2` config (gateway DB): `totalTimeoutMs: 30000`, `stepTimeoutMs: 18000` — CLI has no `combo edit`, so the config JSON was updated directly in `storage.sqlite`.
2. Health probe ceiling raised to 20s (chain p50 3–6s, worst observed 15.7s).

**Result:** probes now complete in 2–4.4s; **8/8 health rounds ok, 0 flaps**; live orchestrator task routed through lane 1.

---

## §4 Server state (end of pass)

| Service | State |
|---|---|
| API :4000 | up, health all ok |
| FE :3000 | up, fresh build |
| Gateway :20128 | up, combo v2 active (super-120b → super-vl → agy/gemini → openrouter/free) |
| Laya :8000 | ok (`local`) |
| Tunnels | APP + API cloudflare, rotating (rebuild FE + `FRONTEND_URL` on rotate) |

**Left deliberately unfixed (tracked, not silent):**
- NIM free-tier 500s / slow lane-2 under load — upstream rate-limit queuing; combo failover absorbs it. Expected to ease in low-traffic hours.
- Agent execute endpoint has no company brief — output was honest but generic (§2 note).
- QA screenshots live in `~/.hermes` cache, not the repo (size); repo carries this report only.

**Key artifacts:** this file; prior context in `docs/NIM-SWEEP-REPORT.md` (routing), `docs/N4-REPORT.md` (inbox infrastructure).
