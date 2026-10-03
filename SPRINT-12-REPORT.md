# SPRINT 12 REPORT — "PLAYBOOKS + MEMORY LEDGER" (leverage sprint)

**Plan:** hermes-sprint-12-prompt.md (blueprint v2-aligned)
**Date:** 2026-10-03
**Head commits:** `b590b81` (playbooks + ledger + nits), `503f7ba` (fresh-clone build logs), `a5c8ba1` (captures)

---

## What shipped (file:line refs)

### §1 Playbooks as modules
| Piece | Where | Detail |
|---|---|---|
| Schema | `supabase/migration-sprint12-playbooks-ledger.sql` | `playbooks` (slug, name, workflow_type, **version**, description, stages_json, tasks_json, gates_json) + `agent_memory` (below) + indexes + RLS + touch triggers |
| **7 seeded packs** (blueprint §4 folded debt + campaign) | migration seed | 4 workflow-type: Client Onboarding (one-time), Content Production (recurring), Lead-to-Close (sales), Retainer Ops (monthly loop). 3 campaign: New Client Onboarding, Diwali Campaign, SEO Retainer. Pack gate actions use the REGISTERED run actions (`file_deliverable`/`external_send`) — aligned with the Sprint 10 gate machinery, no reinvention |
| Playbooks API | `api/src/routes/playbooks.ts` | `GET /playbooks` (library, grouped by type), `GET /playbooks/:slug` (full preview: stages, tasks, gates), `POST /playbooks/:slug/install` — **install → real pipeline created** (steps_json copy stamped `pack_slug`+`pack_version`, linked tasks via the Sprint 11 linkage map, gates via the same `gate_actions` rows) + `pipeline_events` 'playbook_installed' (one click, logged) |
| Versioned installs | `playbooks.ts` install handler | The installed instance is independent — editing the instance never mutates the pack; v2 packs don't silently rewrite v1 instances (new installs get the new version) |
| Library page | `frontend/.../src/app/playbooks/page.tsx` (new) | Grouped by workflow type, version badges, stage chips, **real previews** (stages/tasks/gates listed in the preview modal), Install → client picker → real pipeline. Sidebar entries added (`Sidebar.tsx:37-38`) |

### §2 Company Memory Ledger
| Piece | Where | Detail |
|---|---|---|
| Schema (blueprint §4 AS-IS) | migration | `agent_memory` (agent_profile, memory_type [client/decision/pattern/preference], key, value JSONB, expires_at, UNIQUE(agent,type,key)) |
| Ledger core | `api/src/memory-ledger.ts` | `recordMemory()` (upsert on the unique key — latest decision wins; never throws), `recordApprovalDecision()`, `recordGateDecision()` (tier + escalation), `recordTaskOutcome()`, `recordFounderCorrection()`, `ledgerReplay()` (filters agent/client/type/date; **expiry honored** — expired entries surface with `expired=true`, sorted last, never dropped, never presented as current). mem0/Graphiti pattern adopted — tools NOT adopted (self-host weight) |
| **Write paths (mandatory)** | `api/src/routes/gates.ts:167,209-219` (gate approve+reject), `api/src/routes/approvals.ts:99-104,130-142` (approval approve+reject), `api/src/engines/agent-execution.ts:218-223` (task completions), `api/src/routes/ledger.ts` (founder corrections endpoint) | Approval decisions (approved/rejected + reason), gate decisions (tier + escalation), task completions with outcomes, founder corrections (a rejection IS a correction — the lesson is recorded) |
| Replay API | `api/src/routes/ledger.ts` | `GET /ledger` (timeline + filters), `GET /ledger/stats` (counts by type/agent + expired), `POST /ledger/correction` (400 on missing about/correction) |
| Replay page | `frontend/.../src/app/ledger/page.tsx` (new) | Stats strip (total/type/agent/expired — "shown, not current"), filter pills (≥44px) + agent dropdown, timeline entries (type badges, agent, timestamp), **detail modal → full context** (what, by whom, the payload at the time), EXPIRED badge on expired entries |

### §3 Sprint 11 nits — ALL 5 FIXED
| # | Nit | Fix | Verified |
|---|---|---|---|
| 1 | Build-log discipline (3rd warning — phantom `/logs` at identical 4.54 kB twice) | **FRESH CLONE build:** `git clone --local . → C:\Users\Abhishek\AppData\Local\Temp\s12-clone` @ `b590b81`, `npm install` + `next build` THERE, log + BUILD_ID (`qfmbEYBfw5uyyqv1mrGcS`) committed. **NO `/logs` route in the fresh-clone build** — the sprint-11 leak was local untracked files (now gitignored). Clone path stated here + in the log. The log reproduces the committed tree | clone build log committed; `/ledger` (4.24 kB) was the coincidental same-size row |
| 2 | **Nit-7 gate-bypass (REAL bug)** — task-done listener advanced without checking open gates (comment-only protection) | Open-gate check in the listener: pending `gate_actions` on the workflow → advance BLOCKED + `pipeline_events` 'advance_blocked_by_gate' (gate_id/name/tier) + console line. Same enforcement the gate mechanism uses (`agent-execution.ts:231-250`) | **LIVE: linked task on festive-brief (diwali wf with a pending gate) → `advance_blocked_by_gate` event, wf stayed at festive-brief, progress 0** |
| 3 | `source` field: only two values | Third value added: `reused` (metadata.reused_from → 'reused') in `assets.ts:71` | code |
| 4 | `ensureBuckets` wording | **Actually boot-time now:** module-level fire-and-forget ensure + `[assets] buckets ensured at boot` boot log; lazy path kept as fallback | **boot log line verified** in `api-boot.log` |
| 5 | Report's own gaps | (a) **Signed-URL thumbnails** — Supabase objects via `POST /assets/:id/download` cached per-asset (`assets/page.tsx:47-70`), Hermes-cache route demoted to fallback; (b) **Twin AI-cost line** — `AI cost (P&L)` row in the Client DNA panel + calls count (`clients/[id]/page.tsx:154-163,363-372`); (c) **Workflow picker dropdown** — real modal with workflows list (replaces `window.prompt`, `assets/page.tsx:326-348`) | code + UI |

---

## What I tested live (real calls, real rows)
1. **Migration fully run** (user ran SQL): playbooks (7 packs seeded, verified per-slug) + agent_memory (0 rows, ready) + indexes + RLS.
2. **§1 install end-to-end:** `POST /playbooks/diwali-campaign/install` on kro karpin → **workflows 65→66** ("Diwali Campaign (v1)", current_step=festive-brief, metadata pack_slug+pack_version) → **2 linked tasks** (Write Diwali brief @seo_specialist→festive-brief, Produce festive creatives @ceo→creatives, source=playbook) → **1 gate** (diwali-review-gate, write, pending) → `playbook_installed` event (founder, stages=4/tasks=2/gates=1).
3. **Preview API:** diwali-campaign → 4 stages, 2 tasks, 1 gate (write, after review).
4. **§2 gate decision → ledger:** registered test gate (client_report) → approved → **agent_memory row: founder | decision | gate:… | approved:true** ✓
5. **§2 founder correction → ledger:** `POST /ledger/correction` ("Never use neon gradients on festive posts") → **founder | preference | correction:diwali creatives** ✓
6. **§2 task completion → ledger:** linked task done → **ceo | pattern | task:… | task completion + outcome** ✓
7. **§2 expiry honored:** seeded an expired preference (promo-tone-diwali-2025, expires 2025-11-15 — past) → replay API returns `expired: true` → **UI shows EXPIRED badge + "1 expired (shown, not current)" in stats** (vision-verified shot).
8. **Ledger stats:** total 3→4, by_type (decision 1, preference 2, pattern 1), by_agent (founder 2, ceo 1), expired 1.
9. **360px real captures** (Playwright): `/playbooks` + `/ledger` — horizontal-overflow: false ×2; **vision-verified**: packs grouped by type with v1 badges + Install buttons, ledger timeline with real entries (task completion, founder correction, gate decision), preference filter → EXPIRED badge visible.
10. **Desktop captures:** playbooks-desktop.png + ledger-desktop.png.
11. **Nit-1 fresh-clone build:** ✓ Compiled successfully, tsc 0 errors, NO phantom route.

## What I didn't test / honest gaps
- **Pack v2 upgrade path** (install v1, seed v2, verify v1 instance stays) — the versioned-install logic is stamped in code (`pack_version` on the instance); a live v2 test is a 5-minute follow-up.
- **Ledger detail modal payload redaction** — payloads are stored raw in agent_memory (they're internal); if a payload contains secrets, redaction at record time is a Sprint 13 polish (the gate payload itself IS redacted at gate registration).
- **Playbook cards on 360px show stage chips as inline text** (vision noted: stages render as text+arrows, not chip components on mobile) — desktop preview modal shows the full stage/task/gate lists.
- **Install doesn't auto-start the first task** — tasks are created as `todo`; the first task firing is a human/agent decision (honest — the playbook creates the structure, not the motion).
- No invented data: all ledger entries trace to real API calls; the expired preference is a labeled test seed.

## Deliberately not built (per §5)
GROW/publishing (Sprint 13), hiring UI, client portal/auth (Phase 5 RLS), webhooks, Telegram/WhatsApp, morning briefing, global search, notifications, task queue/retry, RLS hardening, migrations discipline, structured logging, RAG, React Query batch, Docker/Sentry.

---

**Verification bar:** **PASS with nits** (nits listed above fold into Sprint 13 — GROW).
**Evidence:** `docs/evidence/sprint-12/` — playbooks-360.png, ledger-360.png, ledger-expired-360.png, playbooks-desktop.png, ledger-desktop.png, next-build.log (fresh-clone BUILD_ID + clone path + phantom check), tsc.log, api-boot.log — **all committed, pushed (`b590b81`, `503f7ba`, `a5c8ba1`)**.
