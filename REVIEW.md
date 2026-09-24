# REVIEW.md — Spinach OS v6 Company Build Critique

**Reviewer:** Hermes (branch session, 2026-09-24)
**Scope:** PARTs B–D of hermes-agency-upgrade-prompt.md + execution bridge + frontend port

---

## Verdict

The plan is sound. The dormant-by-design principle is the single best idea in it —
idle brains are theater, and triggering departments into existence on first matching
client is the correct product behavior. Building it as specified with the changes below.

---

## Your four questions — my calls

### 1. Ten persistent profiles (3 leadership + 7 HOD) — right count?

**Keep 10, but 8 active + 2 warm.** Reasoning per profile:

- `ceo`, `cto`, `orchestrator` — keep always-on. Leadership is cheap (few calls/day)
  and orchestrator is the founder's front door. Non-negotiable.
- `designer`, `engineer`, `social` — keep active. These have continuous workstreams
  (brand QA, code review, content calendar) even with thin client volume.
- `seo_specialist`, `research` — **merge into one `research` profile is tempting**
  (both are monitoring desks), but SEO has client-deliverable output (rankings
  reports, GMB) while research is internal-only. Keep separate — different QA
  standards, different cadences. Both can be *warm* (cron-triggered, no idle process).
- `sales` — keep active. Pipeline memory is the agency's asset.
- `ads_manager` — **dormant from day one**, exactly as specified. The template +
  trigger pattern is right.

**Net: 9 persistent definitions, 8 live at steady state, ads_manager dormant.**
The 10th (hr) stays flat/specialist-served as specified — correct, no volume.

### 2. Bot Mode (@mentions in group chats) vs profile-per-HOD?

**Profile-per-HOD for departments; Bot Mode as the *interface*, not the architecture.**
Reasoning: profiles carry cron/memory/tools (SOUL.md, schedules, brand DNA) — bots
in group chats lose that persistence. But the *founder-facing* interaction should
feel like Bot Mode: he @mentions a department in Comms → message routes to that
HOD's profile → reply lands back in the thread. Best of both: persistent brains,
chat-native interface. Build `hr/agent-message` → HOD profile invocation bridge.

### 3. Execution bridge — cleaner mechanism?

**One dispatcher function, three named paths, identical WS emissions — as specified
in D3.** My refinement: make the path decision *data-driven* (task kind → path map)
rather than if/else chains, so adding a dormant department is a config row, not a
code change:

```
TASK_PATH_MAP = {
  ads_*:        { path: 'profile',   profile: 'ads_manager', dormant: true },
  logo/design:  { path: 'specialist', bench: 'design' },
  code/deploy:  { path: 'profile',   profile: 'engineer' },
  copy/post:    { path: 'specialist', bench: 'marketing' },
  words-only:   { path: 'gateway',   tiered: true },
  real-world:   { path: 'profile',   workspace: true },
}
```

One more refinement: **emit WS events from a single `emitTaskLifecycle()` helper**
that all three paths call — guarantees the frontend never knows the difference
(the plan's requirement) by construction, not discipline.

### 4. Scaling traps missed?

Three found:

1. **`agent_states` is keyed by `profile` (PK)** — the dormant-activation insert of
   a new HOD row works, but concurrent workflows updating the same HOD row will
   thrash (last-write-wins on `activity`). Fix: append-only `agent_state_log`
   for history + the PK table for *current* state only. Cheap, done in build.
2. **RAG at 1000 clients:** pgvector with per-client `client_id` filtering needs a
   composite index `(client_id, created_at)` AND chunk-count caps enforced at query
   time (the 5-8k context budget). If ingestion is unbounded, retrieval degrades
   before storage does. Fix: hard cap 200 chunks/client, auto-prune on 201st.
3. **Retainer auto-run + onboarding storm:** the D2 Day-1 09:00 auto-run for
   growth/scale clients plus 10 concurrent onboards could fire 40+ gateway calls
   in one tick — the 200/min rate limit would 429 mid-onboard. Fix: stagger
   retainer runs by client_id hash (09:00–09:30 window), and onboard steps are
   already sequential per workflow.

---

## What I'd keep (no changes)

- Dormant-by-design + auto-activation trigger + teardown (§B) — as specified
- The 10-step intake→delivery flow with HOD QA + 2-cycle rework cap (§D1, D4)
- Context discipline: 5-8k briefs, summarization ladder, client isolation (§D5)
- The executive bench template with the "one clarifying question" rule (§C)
- SOULs as written (§C) — they're specific, testable, and voice-correct
- Frontend port of spinach-os.html design to :3000 (reference HTML adapter contract
  already bridged on :4000)

## What I'd change (summary)

| # | Change | Why |
|---|--------|-----|
| 1 | 9 persistent profiles (8 live + 1 dormant), not 10 | research/seo kept but warm; hr flat |
| 2 | Bot Mode = Comms interface over profile architecture, not alternative | persistence + chat-native UX |
| 3 | Data-driven TASK_PATH_MAP + single emitTaskLifecycle() | dormant dept = config row; identical WS by construction |
| 4 | agent_state_log (append-only) alongside PK table | last-write-wins thrash at scale |
| 5 | 200-chunk cap/client + composite index in RAG | retrieval degrades before storage |
| 6 | Stagger retainer runs by client hash | 09:00 storm vs 200/min limit |

---

## Build order (agreed, per PART E)

1. **Foundation:** execution bridge (runAgentTask → real profiles), TASK_PATH_MAP,
   emitTaskLifecycle(), agent_state_log
2. **Hierarchy:** SOULs for designer/engineer/seo_specialist/sales + ads_manager
   dormant template; tier/reports_to in registry; Agents tree view
3. **Workflow:** packages table + 4 presets; onboarding endpoint with dormant
   trigger; brand branch (SVG-only rule); retainer loop (staggered)
4. **Knowledge:** pgvector RAG, caps, auto-ingest (deferred if pgvector unavailable —
   JSONB fallback with same API)
5. **Frontend:** port spinach-os.html to :3000 (shell, tabs, KPI, viewport tags,
   panels, right rail) on the existing bridge

Each part: build → verify → report → next.
