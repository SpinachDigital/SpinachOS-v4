# SPRINT 8 REPORT — Command Center Chat (blueprint v2-aligned)

**Scope:** chat surface + task visibility + task chat + image-gen wiring + Laya fixes + build fix + §9 carryovers + UX polish. WIN/DELIVER/CREATE NOT started (§10).

## Shipped (file:line refs)

| § | Piece | Files | What |
|---|---|---|---|
| 1 | Chat hero | `frontend/command-center/src/app/chat/page.tsx` (new, ~430L) | Chat-first surface: greeting, 5 suggestion chips (every chip triggers a REAL flow — approvals/team chips navigate, pipeline/think chips prefill the composer), recent threads rail (persisted, relative timestamps), ONE command bar (composer uses the same `/api/v1/command` + thread persistence as CommandGateway — no second gateway). Honest empty states (no fake threads/messages). |
| 2 | Thread UI + inline cards | `frontend/command-center/src/components/chat/ChatCard.tsx` (new) | Message list (user teal right / agent left bubbles), thread persistence across reload. Generic card system: `ChatCard` dispatches by kind — TaskCard, DeliverableCard (reuses Sprint 7 `OutputPreview`), ApprovalCard (full preview + inline approve/reject + rejection-reason input, 44px targets). Same object as the queue (same mutation + audit trail + reviewed_at). Every card deep-links to its full page. |
| 3 | Task live visibility | `frontend/command-center/src/components/chat/TaskLiveStrip.tsx` (new) + `src/app/tasks/[id]/page.tsx:155` | Live strip on every task: status, current activity, agent, timestamp. WS-driven (`task_lifecycle`/`task_update` — the API's existing contract) with 10s staleness poll fallback (pipeline-detail pattern). Honest `idle` — "Nothing happening right now". |
| 4 | Task-scoped chat | `frontend/command-center/src/components/chat/TaskChat.tsx` (new) + `src/app/tasks/[id]/page.tsx:196` | Every task page gets its own thread: context = that task only (`task_scope` in the command body), thread persists on the task (`spinach_task_thread_<id>`), survives reload. Same gateway intents. |
| 5 | Voice | `src/app/chat/page.tsx` (mic + transcript) | Web Speech API mic drives the SAME composer → same gateway intents (what you can type, you can say). Transcript visible in-chat. |
| 6 | Image-gen wiring | `api/src/routes/images.ts` (new) + `api/src/index.ts:45` | **Real endpoint located + documented:** the Hermes `image_gen` plugin (provider `openai-codex`, model `gpt-image-2-medium`, verified generating a real PNG). `GET /api/v1/images/file/:name` serves the Hermes image cache (traversal-guarded); `POST /api/v1/images/generate` records generations as task_outputs (kind=image) when task_id given. OmniRoute's `/v1/images/generations` exists but has no codex credentials ("No credentials for image provider: codex") — NOT duplicated, NOT faked. |
| 7 | Laya fixes | `laya/main.py:110-125` (+ `requirements.txt`: httpx) | Word-boundary department matching (`\b`-wrapped, multi-word keywords keep substring semantics) — 6/6 tests pass ("postpone" no longer false-positives). Blocking `urllib` → async `httpx.AsyncClient` in `llm_fallback_classify` (event loop no longer stalls). Department map semantics untouched (Phase 0). |
| 9.1 | reviewed_at fix | `src/components/ApprovalQueue.tsx:185` | Decided cards now render `reviewed_at` (interface + render). |
| 9.3 | Build fix | `next.config.js:6-9` | `distDir` split: production → `.next-prod`, dev keeps `.next`. `next build` ran GREEN (24/24 pages, 0 errors) while the dev server stayed up — the Sprint 7 CSS-404 collision is structurally impossible now. |
| 9.4 | tsbuildinfo | removed from git + `.gitignore` | `frontend/command-center/tsconfig.tsbuildinfo` no longer tracked. |
| 9.5 | Preview branches | `docs/evidence/sprint-8/output-preview-*.png` | All four OutputPreview shapes proven with REAL payloads: text (post render), image (2 srcs: direct URL + local images-route PNG), link (GitHub URL), file (📎 + Download button + href). |
| 8 | UX polish | all new surfaces | Design-token styling only (no new token system), 44px targets on every interactive element, honest loading/empty/error states (no blank screens), 360px clean, one clear nav (Office Chat added at top of Sidebar). |

## UI event contract (§2 — for Sprint 9)

```
TaskCard       { id, title, status, current_step?, agent?, progress?, updated_at? }
               → deep link /tasks/[id]; rendered from task_id in gateway replies
                 (fast mode now RETURNS task_id — was missing, fixed) and
                 WS task_lifecycle/task_update events
DeliverableCard { id, kind: 'text'|'image'|'link'|'file', payload, agent?, task_id? }
               → payload shapes = OutputPreview.pick(): {text, platform?} | {url} |
                 {file_path, url?}; deep link /tasks/[task_id]
ApprovalCard   { id, type, title, description?, platform?, status, requested_by?,
                 payload_json, created_at?, reviewed_at? }
               → deep link /approvals; inline POST /api/v1/approvals/:id/approve|reject
                 (SAME mutation + audit trail + reviewed_at as the queue)
```

Sprint 9 must standardize all 11 agent profiles to emit these shapes. Where a profile doesn't emit yet, cards show honest "no live data" — never fakes.

## What I tested live (evidence: docs/evidence/sprint-8/)

| Claim | Evidence file | Proof |
|---|---|---|
| Chat hero desktop | `chat-hero-desktop.png` | Greeting, chips, threads rail with real threads, composer, bubbles readable. Vision-verified. |
| Chat hero **real** 360px | `chat-hero-360.png` (500px actual — Chrome min-width; measured + noted) | Threads rail collapses, no overflow. Vision-verified. |
| Thread with inline cards | `chat-inline-task-card.png` | Fast dispatch → task_id returned → TaskCard inline in chat → "Open task" click → `/tasks/70daf34d…` (deep link verified). |
| Task-scoped chat | `task-chat-thread.png` | Message + reply in the task's own thread, persisted (`24ea134a`), context = task only. |
| Task "currently happening" | `task-live-and-chat.png` | Live strip: "DONE · Nothing happening right now · @social · 01:53 am" (honest idle). |
| reviewed_at fix | `approvals-desktop.png` (sprint-7) | Decided cards show reviewed time. |
| `next build` green | build-sprint8.log → `.next-prod/` created, dev server up throughout | 24/24 pages, 0 errors. |
| Preview branches (all 4) | `output-preview-branches.png` + `output-preview-file-branch.png` | text/image/link/file — file branch shows 📎 + Download with real href. |
| Laya word boundaries | `laya-word-boundary-test.py` (6/6 OK) + live `/decide`: "postpone the launch" → marketing 0.95, "fix the postpone bug" → engineering 0.95 | |
| Image-gen real | `image_generate` → real PNG (1.1MB, PNG magic ✓) served via `/api/v1/images/file/` 200 | provider openai-codex, model gpt-image-2-medium. |

## Sprint 7 evidence corrections

- `approvals-360.png` / `approvals-360-actions.png` — **retaken at real 360×740** (device emulation + clip; verified single-column, buttons 44px, no overflow). Stale 1440px/500px shots deleted.
- `approvals-360-card.png` — deleted (superseded).

## Honest gaps

1. **Voice TTS replies not built** — mic + transcript done; spoken replies (§5 "TTS replies") deferred to Sprint 9.
2. **chat-hero-360.png is 500px actual** (Chrome enforces min window width) — the approvals 360 shots are real 360×740; the chat one needs a headless capture for exact 360.
3. **"User Safety: safe" leak** — one task-chat reply rendered safety-filter metadata instead of content; needs investigation (gateway reply extraction).
4. **Agent task events** — TaskCard's `current_step` shows "no live step data" until Sprint 9 standardizes profile emission.
5. Test approvals seeded for evidence (4 branch-test cards) were left in DB (harmless test data, deletable via admin).

## What NOT built (§10 — untouched)

No hiring UI, no new pages outside chat/tasks/approvals, no new agents/integrations, no publishing wiring, no WhatsApp/Telegram, no client portal, no webhooks, no Docker, no iframes, diorama module source untouched. Phase 5 items (task queue/retry, RLS, migrations, structured logging, RAG, React Query) not sneaked in.

## Next (Sprint 9 — per standing bar)

WIN: leads inbox + outreach + onboarding button + profile Schema v2 + cron registration. Nits from this sprint fold in (voice TTS, safety-leak fix, chat-360 headless capture).
