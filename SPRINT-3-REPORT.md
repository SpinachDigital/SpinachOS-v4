# SPRINT 3 REPORT — "Think With Me" (Brainstorm v2)

**Commit:** `b804dca` — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, SPRINT 3
**Date:** 2026-09-29/30

---

## Shipped

### 1. 2-round cap killed (`api/src/command-thread.ts`)
- `BRAINSTORM_CAP = 5` — the agent asks genuine clarifying questions until it has what it needs; the safety-cap round must stop and summarize (never infinite, never a dead end).
- **Old bug fixed:** `rounds >= 2` + a non-affirmative answer auto-delegated the plan mid-brainstorm. Now only an affirmative answer ("haan/ok/delegate/…") or reaching the cap delegates.

### 2. RAG-wired SMART defaults (never ask what the system knows)
- `buildRoundContext()` fetches **ACTIVE CLIENTS + PACKAGES + PAST CAMPAIGNS/KNOWLEDGE** (via `hybridRetrieve()` — the one primitive) **before** every question round, injected as `KNOWN CONTEXT`.
- Live result — questions carry data-grounded defaults: *"Budget: Kitna burn? Smart Default: ₹1L testing budget on LinkedIn/Meta targeting Mid-market Founders"*, *"CEO ne high CAC warn kiya tha. Target CAC ₹300-350…?"* (referencing an earlier thread's RAG context).

### 3. No repeated questions
- `extractAskedSlots()` → `thread.metadata.answered` (9 slot types: budget, client, scope, success_metric, timeline, creative, platform, audience, region) + a **HARD RULE** block in the prompt: answered slots must never be re-asked.
- **Tracker precision fix:** only interrogative sentences count — a slot word inside a reason line ("protect 50k budget waste hoga") is not an asked question; the final plan-summary round skips extraction entirely. (Interrogative-only unit-tested offline: R2-style mixed → correct slots, R5-style plan → `[]`.)

### 4. Fast mode (System 1 style — no brainstorm round-trip)
- `fastAnswer()`: "have we posted on X" → calendar lookup ("Haan — calendar me 5 recent slots hain, 0 published. Latest: 2026-09-27 x (planned)…"), "kitne clients hain" → "7 active clients hain" (count query), "what packages" → presets. Direct DB lookup, zero LLM calls.
- Bug fixed: `\bclient\b`/`\bpost\b` missed "clients"/"posted" → `clients?`/`post(ed)?`.

### 5. Every reply carries context
`FOUNDER_PREFS` (Hinglish, direct, no fluff) + thread memory (last 12 messages) + answered-slots block + KNOWN CONTEXT — in every brainstorm prompt.

## Acceptance (live runs)

| Criterion | Result |
|---|---|
| "should we run Diwali ads" → questions contain past data (not generic) | ✅ smart defaults from clients/packages/RAG in every round |
| ≥3 rounds where the topic needs it | ✅ 5 rounds on all 3 acceptance threads (`e7d52fda`, `056a8c44`, `d831df42`) |
| Zero repeated questions | ✅ `REPEATED SLOTS: 0` (assertion in `diwali-thread.json` checks) |
| Ends with plan summary + "Plan ready — delegate karun?" | ✅ agent plan ends with the exact line; "haan" → `mode: delegated` (Tasks `#37857abf`, `#78b20c8f`, `#14015b85`) |
| Screenshot the thread | ✅ `diwali-thread-runs-1440.png` (Task Runs panel, 30 runs, Diwali tasks done) + `diwali-thread.md` (full readable thread) |
| tsc + build clean | ✅ 0 errors both; `next build` ✓ |

## Bugs found & fixed mid-sprint
1. **`max_tokens: 800` truncated the cap-round plan** — R5 reply cut at 97 chars, `finish_reason: length` (reproduced against OmniRoute directly) → 1600 in both bridge call sites.
2. **Next 14 App Router GET route handlers are statically cached** unless `dynamic = 'force-dynamic'` — `/api/auth/session` served a stale 09-26 minted token (exp 09-27) from build cache → UI-wide 401s, TaskRunsPanel stuck at "0 runs" despite 99 tasks with execution metadata. Fixed with `export const dynamic = 'force-dynamic'`; verified: fresh mint (exp next day), API 200, panel 30 runs.
3. Tracker false-positives (7→6 repeats were slot-word mentions in reasons/summaries, not re-asks) → interrogative-only extraction + final-round skip → 0.
4. Carry-overs from Sprint 2 verification: (a) `audit-after.json` regenerated from the real click-probe results (stale yellow grades removed — the old static probe used `getAttribute('onClick')`, which never works with React synthetic events); (b) FALLBACK_STATS 4th card "Brand Assets" → "Agents Online" (matches the live API label).

## Laya decision log sample

| input | route | evidence |
|---|---|---|
| "should we run Diwali ads" | brainstorm (needsBrainstorm: question + irreversible/complex) | 5-round thread, plan + delegate |
| "have we posted on X this week" | fast-answer (direct DB, no LLM) | calendar status returned |
| "kitne clients hain" | fast-answer (direct DB, no LLM) | count returned |

## Evidence files (`docs/evidence/sprint-3/`)
`diwali-thread.json` (thread + messages + machine-checked assertions), `diwali-thread.md` (readable thread), `diwali-thread-runs-1440.png` (Task Runs panel with the delegated plan tasks).

## Next
Sprint 4 → Sprint 7 per plan (pipelines GET + detail page, war-room, social plan/draft/qa/approve, approvals previews, diorama task links, real /team page).
