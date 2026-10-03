# SPRINT 11 REPORT — "CREATE + P&L" (assets library + usage instrumentation + agent/client P&L)

**Plan:** hermes-sprint-11-prompt.md (blueprint v2-aligned)
**Date:** 2026-10-03
**Head commits:** `f2a006f` (backend + nits), `9dd740a` (library + P&L pages + final clean-tree build logs)

---

## What shipped (file:line refs)

### §1 Real assets library
| Piece | Where | Detail |
|---|---|---|
| Buckets (blueprint §2.8 folded debt) | Supabase Storage | `client-assets`, `deliverables`, `content` — private, created via API (`ensureBuckets()` was lazy on first request at sprint-11 time; made actually boot-time in Sprint 12 nit 4) |
| Assets API | `api/src/routes/assets.ts` | `GET /assets` (global library, filter client/type/date, client names joined, `source` upload/filed), `POST /assets/upload` (binary→right bucket via `BUCKET_FOR_KIND`, text→row, **upload without indexing is impossible** — same insert indexes), `GET /assets/:id/download` (signed URL 3600s), `POST /assets/:id/reuse` (copy + `pipeline_events` 'asset_reused' audit — a reuse nobody can see is not a reuse) |
| Library page | `frontend/.../src/app/assets/page.tsx` (new) | Filter pills (≥44px) + client dropdown, **card grid with thumbnails/image-render + type icons** (a library, not a table dump), preview modal (image renders, text previews, unpreviewable → "Preview not available" honestly), Download + Reuse (logged), Upload panel (client+type tags), honest loading/empty/error states |
| Old redirect DELETED | `frontend/.../next.config.js:18` | `/assets → /settings` gone; `/assets` is the real page. Sidebar entry added (`Sidebar.tsx:36`) |

### §2 Agent/client P&L
| Piece | Where | Detail |
|---|---|---|
| Schema (blueprint as-is) | `supabase/migration-sprint11-create-pl.sql` | `usage_logs` (agent_profile, client_id, model, tokens, cost_usd/inr, task_id, source, metadata), `model_rates` (editable rows — 7 models seeded + gemini-3-flash-preview added live), `clients.monthly_value`, 3 indexes, RLS enable |
| Cost computation | `api/src/usage.ts` | `computeCost()` (tokens × model_rates rate; missing rate → cost 0 + `rate_found=false` — the gap is VISIBLE, never silently priced), `logUsage()` (never throws — logging failure can't break the observed call), `pnlRollup()` (per-client margin, per-agent, per-model, totals+unpricedCalls) |
| **Instrumentation — every AI call logs** | `api/src/engines/agent-execution.ts:84` (runAgentTask), `api/src/bridge.ts:215` (runGatewayTask), `api/src/bridge.ts:269` (runSpecialistTask), `api/src/routes/images.ts:70` (image_gen) | Langfuse/OpenLIT pattern adopted (structured usage rows) — tools NOT adopted (self-host weight). `agent_profile` namespaced `gateway:<p>` / `bench:<b>` / `image_gen` |
| P&L API | `api/src/routes/pnl.ts` | `GET /pnl` (full rollup), `POST /pnl/revenue` (manual monthly_value — 400 on invalid, honest), `GET /pnl/unpriced` (the visible gap) |
| P&L page | `frontend/.../src/app/pnl/page.tsx` (new) | Totals strip (₹ + $ + calls + unpriced), per-client rows (AI cost, revenue, margin % — color-coded), **manual revenue modal ("never invented, never backfilled")**, per-agent burn bars (max-relative), per-model rows. Sidebar entry added |

### §3 Sprint 10 nits — ALL 8 FIXED
| # | Nit | Fix | Verified |
|---|---|---|---|
| 1 | Build log from dirty tree; BUILD_ID not in log | Runtime state gitignored (`.gitignore` — JWT cache, .s9/.s10/.s11 pointers, supabase/.temp); commits before build; **final build from 0-dirty clean tree with `BUILD_ID: uULN-XFYbvR1UcC9vZTAe` IN the log** | `git status --porcelain` = 0 before build; log committed |
| 2 | Pipeline pills ~24px | `minHeight: 44, padding 10px 16px` on all filter pills (`pipeline/page.tsx:82-96`) | code |
| 3 | "step 7/6" off-by-one | Cap at total + honest "no steps" for 0-step workflows (`pipeline/page.tsx:125-131`) | code |
| 4 | Reject reason not enforced | 400 on missing/blank reason; `rejection_reason` stored trimmed (`gates.ts:180-191`) | code |
| 5 | TIER_RANK never compared | Cross-gate escalation: new gate's tier vs previously-approved tiers' max on the workflow → `metadata.escalation` flag + event trail detail (`gates.ts:69-113`) | code |
| 6 | Gates render generic | Dedicated Gate ApprovalCard: **risk-tier badge** (read/write/external colored) + **escalation banner** + redacted payload preview (`ApprovalQueue.tsx`); approvals API selects `risk_tier, metadata` | code |
| 7 | No task-done auto-advance | Task→workflow linkage map: `executeAgentTask(..., link)` (workflow_id/step_name/client_id), persisted in task metadata, **preserved on done+failed updates** (was being wiped — found+fixed en route), completion listener advances the linked stage (gate-gated steps not bypassed — only advances when `current_step === step_name`), `pipeline_events` actor=`task:<kind>`; `agents/execute` accepts link params | **LIVE: research→draft auto-advance, actor=task:competitor, progress 33%** |
| 8 | Report/code terminology | `resolved_by` → `approved_by='watcher'` aligned in report; `/logs` redirect-only phrasing; migration comment "both" → "THREE tables" | code |

---

## What I tested live (real calls, real rows)
1. **Migration fully run** (user ran SQL): usage_logs + model_rates (7 rates) + monthly_value + indexes + RLS — verified via API.
2. **§2 end-to-end:** real OmniRoute gateway call (ceo, `gemini-3-flash-preview`, 65+355 tok) → **usage_logs row written** → rate added (editable) → cost recomputed ($0.000223 = ₹0.0187) → **P&L shows totals ₹0.02/$0.0002, 1 call, unpriced 0**.
3. **P&L revenue:** `POST /pnl/revenue` kro karpin ₹15,000/mo → margin 100% rendered (manual, honest — test value).
4. **§1 upload→bucket→indexed:** text upload (Brand Guidelines v1) + binary upload (1x1 PNG → `client-assets/…/1791018661448-logo-mark-test.png` bucket object verified) → deliverables 1→3 rows indexed.
5. **Download:** signed URL returned (Supabase sign URL, 3600s).
6. **Reuse:** copy created + `pipeline_events` 'asset_reused' actor=founder verified.
7. **Library filters:** `?kind=image` returns 1 (correct); full list shows filed + upload sources at sprint-11 time (the `reused` third value was claimed but not in code — added in Sprint 12 nit 3).
8. **Nit 7 live:** linked task on `research` → done → **auto-advance research→draft** (actor=task:competitor, progress 33%, event logged).
9. **360px real captures** (Playwright 1.63 fixed viewport): `/assets` + `/pnl` — horizontal-overflow: false ×2; **vision-verified**: library renders as cards (title, pills, Download/Reuse), P&L shows real numbers (₹0.02 total, ₹15,000/mo, margin 100%, per-client rows).
10. **Build:** final `next build` ✓ Compiled successfully from CLEAN tree, tsc 0 errors — BUILD_ID in the committed log.

## What I didn't test / honest gaps
- **Gemini rate was added live post-log** — the first logged row briefly sat unpriced (rate_found=false → corrected). Future rows price automatically.
- **`/pnl` per-agent bars + per-model rows are below the fold on 360px** (verified present in code + API; vision shot shows the client section) — desktop shot is cosmetic-only later.
- **Library thumbnails for non-image file_url assets** render the type icon (image bytes route serves only the Hermes cache) — Supabase-object thumbnails via signed URL are a small follow-up.
- **Client Twin composition of usage data** (per-client AI cost inside the twin) — the twin read API exists; adding the cost line is a 2-line follow-up for Sprint 12 polish.
- **`upload` UI reuse prompt** uses `window.prompt` for workflow ID — a workflow picker dropdown is a polish nit.
- No invented revenue: kro karpin ₹15,000 is a labeled TEST value; all other clients show "no revenue set".

## Deliberately not built (per §5)
GROW/publishing (Sprint 13), Playbooks + Memory Ledger (Sprint 12), hiring UI, client portal/auth (Phase 5 RLS), webhooks, Telegram/WhatsApp, task queue/retry, RLS hardening, structured logging beyond usage, RAG, React Query batch.

---

**Verification bar:** **PASS with nits** (nits listed above fold into Sprint 12).
**Evidence:** `docs/evidence/sprint-11/` — assets-360.png, pnl-360.png, next-build.log (BUILD_ID), tsc.log, api-tsc.log, api-boot*.log — **all committed from a clean tree, pushed (`f2a006f`, `9dd740a`)**.
