# SPRINT 9 REPORT — "WIN" (lead inbox + approval-gated outreach + onboarding)

**Plan:** hermes-sprint-9-prompt.md (blueprint v2-aligned)
**Date:** 2026-10-02
**Commits:** `dcf1c7b` (feat sprint-9) + `db4531c` (hr-watcher fix) + docs (this report) — pushed `main`, origin verified

---

## Shipped

### Database (Supabase)
| What | Detail |
|---|---|
| `supabase/migration-sprint9-win.sql` (new) | `outreach_drafts` (lead+channel+qualification JSONB+approval_id, status: draft→pending_approval→approved/rejected→sent), `outreach_messages` (audit trail: sent_by, approved_by, sent_at, provider_message_id), leads qualification columns (budget_signal/intent_signal/fit_signal/qualified_at/last_outreach_at), §4 indexes (every FK + ORDER BY), **unique index `uq_outreach_msgs_lead_channel`** (duplicate guard at DB level), RLS on both. **Applied via SQL Editor** (Supabase MCP down this session — 5 connection timeouts; REST-confirmed all tables/columns live). |
| WIN crons registered | `/api/v1/cron/jobs` now lists: SEO opportunities scan (Mon 9:00, seo_specialist), X daily drafts (daily 14:00, social), lead ingest via scrapers (Wed 9:00, sales) — visible cadence, enabled: true. |

### Backend
| What | Detail |
|---|---|
| `api/src/routes/outreach.ts` (new, §2) | **SAFE, approval-gated:** `POST /outreach/qualify/:leadId` (deterministic 3-signal rules — budget/intent/fit keyword hits stored on the row, NO black-box scoring), `POST /outreach/draft` (400 unless all 3 signals hit; 409 duplicate guard — active draft OR sent message per lead+channel), `POST /outreach/drafts/:id/queue` (**rate limits HARDCODED**: email 20/day, linkedin 10, threads 5, x 5 — 429 when exceeded; creates the ApprovalCard = THE INBOX gate), `POST /outreach/send/:draftId` (**403 unless draft approved AND approval row approved** — nothing sends without founder approval, ever; duplicate guard at send time), `GET /outreach/messages` (audit trail). Route mounted `index.ts`. Delivery = manual copy (ToS-clean — no browser/CDP automation, no gray paths). |
| `api/src/routes/approvals.ts` | **Bug fixed:** approve/reject now sync the linked outreach draft (was stuck `pending_approval` → send blocked forever). Rejection reason stored on the approval + draft. |
| `api/src/ctx.ts` (§4 Schema v2) | `emitTaskUpdate` emits the FULL Sprint-8 TaskCard contract: `{id, title, status, current_step, progress, updated_at}`. |
| `api/src/engines/agent-execution.ts` | running event carries `title` + `current_step` — inline cards show real live data ("no live step data" only when truly absent). |
| `api/src/command-intent.ts` + `command-thread.ts` (§7.4 + §5) | `stripSafetyLeak()` — strips gateway "User Safety: safe"-style metadata from replies. **Adapter abstention:** Laya confidence < 0.6 → LLM fallback via brainstorm thread instead of guessing a department. |
| `api/src/laya-client.ts` | `LayaDecision.confidence?` added. |

### Laya (`laya/main.py`, §5 — NOT real-Laya adoption)
| Fix | Detail |
|---|---|
| hr department added | hr commands fell through to operations→orchestrator (×3 measured confusion). `hr` dept → `hr_director` profile. |
| sales keywords + tie-break | "outreach post"/"sales post" went marketing (×6 measured). Explicit sales-intent keywords (outreach/cold email/lead gen/prospect/pitch/quota) win the tie BEFORE content-creation verbs. |
| strategy tie-break + weak-leader override | ceo→marketing confusion (×2): explicit strategy words in a tie OR a single weak (1-hit) leader ("what is our growth strategy") → strategy. |
| abstention rule | 0 strong keyword match + confidence < 0.6 → LLM fallback instead of the old `engineering, 0.3` guess. |

### Frontend
| What | Detail |
|---|---|
| `/leads/page.tsx` (new, §1) | **The lead inbox:** lead list (source badge, qualification pill `qualified · 3/3` / `n/3 signals` / `unqualified`, age, outreach ✓ marker), working filters (source + qualification + search — counts trace to DB rows), Qualify button per row (deterministic rules → toast), honest empty state ("No leads yet — scrapers: lead ingest Wed 9:00 · SEO scan Mon 9:00"), 44px targets, 360px single-column. Sidebar nav entry: **Lead Inbox — WIN — qualify & outreach**. |
| `clients/[id]/page.tsx` (§3) | **Onboarding button** where it belongs (client detail, after deal won): package select (4 presets with ₹ pricing) → Onboard → **whole-chain confirmation** (pipeline deep-link, step 1 in_progress, kickoff line, dormant-trigger note when scale) — no silent success. Honest error state (400 unknown package etc.). |
| `OutputPreview.tsx` (§2) | Outreach draft shape renders like a message: subject bold + body pre-wrap + channel label (Email/Threads added). Not a JSON dump. |
| `CommandGateway.tsx` (§7.3) | **TTS replies:** speechSynthesis speak-back (markdown-stripped, en-IN, rate 1.02), default ON, speaker toggle button (44px-equivalent 30px icon button with aria-label + title) — voice drives the same gateway, transcript visible in log. |

---

## Acceptance proofs (evidence in `docs/evidence/sprint-9/`)
| Criterion | Result | Evidence |
|---|---|---|
| Lead inbox (desktop + real mobile) | ✅ 66 leads, working filters, qualify flow | `leads-inbox-desktop.png` (1184×900), `leads-inbox-mobile-500.png` (500×645) — vision-verified single-column, no overflow |
| Outreach draft → approval card → sent log (full chain) | ✅ **run twice end-to-end** | `outreach-full-chain.txt` (9-step chain with all gates), `outreach-card-desktop.png` (1184×900, card + full message preview + Approve/Reject), `outreach-card-mobile.png` (500×800), `outreach-card-mobile-actions.png` (500×645, buttons ~65px uncut) |
| Send-gating (nothing sends without approval) | ✅ 403 pre-approval, 409 duplicate, 429 rate limit — all live-tested | `outreach-full-chain.txt` |
| Onboarding button → created pipeline | ✅ UI click → POST /onboard 201 → workflows rows (07:19 + 07:23, active, intake) → confirmation render | `onboarding-chain.txt`, `onboarding-confirmed.png` (1184×900) |
| Cron schedule visible | ✅ 3 WIN crons in /cron/jobs | verified live (curl) |
| Laya confusion fixes (before/after) | ✅ 17/18 direct + abstain live | `laya-confusion-fixes.txt`, `laya-live-decides.txt`, `laya-abstain-live.txt` |
| tsc clean | ✅ api files + frontend 0 errors | `tsc-sprint9-api-files.log` |
| `next build` green | ✅ Compiled successfully → `.next-prod` (BUILD_ID `Ks7Oczi9yIusDeljbWdPA`), dev `.next` untouched | `next-build-sprint9.log` |

---

## §2 corrections
- `outreach_drafts.leads` join on `.single()` doesn't resolve relations → queue endpoint fetches lead name explicitly (title showed the short id before).
- Approve/reject must sync the linked draft (same-object rule) — the send gate was otherwise unreachable.

## Bugs found + fixed en route
- `use(params)` crashed the Client 360 page ("unsupported type passed to use()") — pages-router params is a plain object; reverted to `const { id } = params`. Dev restart cleared the stale compile cache.
- Em-dash mojibake in the seeded test card (curl escaping) — fixed the data; API code was clean.

## Honest gaps
- **Real-360px capture:** this Chrome build's headless min-width is 500px and `setDeviceMetricsOverride` flaps under Next.js dev HMR. Mobile evidence shipped at **500×645/800** (true width in the filename, per §11 rule) — the mobile layout itself (single column, no overflow, 44px targets) is verified at 500px; a true-360 capture needs a device emulator or Playwright's fixed viewport.
- Onboarding ran twice (two real clicks during a crashed probe + retry) — War Room Demo Co has 2 duplicate `Brand Identity` workflows in DB (7:19, 7:23). Harmless test data; not cleaned to preserve the evidence trail.
- Voice: push-to-talk/continuous-mode refinement (mic + transcript + TTS replies all work).
- Lead "Details" deep-links to `/tasks?lead=<id>` (task page filter) — a dedicated lead-detail page is later-phase.
- Laya measured accuracy re-run on the 70-command set not repeated (top confusions fixed + verified individually; full re-measure folds into Sprint 10).

## Infrastructure incidents resolved (during sprint, post-report)
| Incident | Root cause | Fix | Verification |
|---|---|---|---|
| CTO worker crash loop (6 crashes, runs 1–6) | **Stale orphaned gateway** (PID 8032, 10/1 boot, parent dead) spawned workers without `HERMES_BIN` → `ModuleNotFoundError: No module named 'hermes_cli'` (worker python = tools python, cwd = task workspace, `hermes_cli` not importable there). | `setx HERMES_BIN` (venv `hermes.exe` — resolver checks `HERMES_BIN` before `find_spec`, cwd-independent) + orphaned gateway killed (safe — live gateway was 27768/8184) + manual `hermes kanban dispatch` pass. | Resolver self-test: `resolved argv: [.../venv/Scripts/hermes.exe]` ✓ → run 7 **COMPLETED** (4m): "Decomposed Design System & Component Library for War Room Demo Co into 5 child tasks with full dependencies." Task `t_bd557029` done. |
| hr-watcher FK crash (API process died, exit 1) | Idle loop destructure-on-strings: `for (const [agentId] of Array.from(activeAgents.keys()))` — `keys()` yields strings, destructure took the first **character** (`"sales"` → `s`) → `liveStates.get("s")` → undefined → idle 999h → `hr_flags` insert with single-letter id → FK violation (`hr_flags_agent_id_fkey`). Log showed exactly the 11 first letters (s/a/c/d/e/h/o/r). | `for (const agentId of Array.from(activeAgents.keys()))` — full id (commit `db4531c`). | API restart 09:04:49 → cron first run 09:05:00 inserted **8 idle flags with full agent ids**, zero violations; second run 09:14:59 idempotent; run-once probe `created=0 resolved=0`. Evidence: `docs/evidence/sprint-6/hr-watcher-fix-verify.txt`. |

## Deliberately not built (per §8)
DELIVER/Client Twin (Sprint 10), CREATE, GROW/publishing (Sprint 13), hiring UI, client portal, webhooks, Telegram/WhatsApp, task queue/retry (pg-boss later), RLS hardening beyond migration defaults, RAG embeddings.

## Next
Sprint 10 — DELIVER (pipeline auto-advance + Client Twin + deny-by-default approval gateway).
