# N1 · FOUNDATION — Execution Report

**Date:** 14 Oct 2026 · **Lane:** assistant (frontend-only) · **Base:** origin/main @ `446a0cf` → **HEAD:** `6b6d82e072ad7acb2493d732c895a432900e8efe` (ls-remote verified) · **Rule held:** no visible control that does nothing survived the pass.

**2-line summary:** All 6 N1 tasks shipped in 5 commits (4 numbered patches + 1 follow-up catch), each gated on `tsc exit 0` + `next build exit 0`. Live-verified on fresh tunnels: Approvals is nav item #1 with the 156 badge, `/projects` redirects to `/pipeline`, dead controls are gone, honest-state primitives exist, jargon is swept, tokens are deduped.

---

## 1. Task-by-task — CONFIRMED with commit

### N1.1 Inbox-first IA — DONE (`1d89421`)
`/approvals` NavEntry moved to **first position** in `Sidebar.tsx`, above Office Chat. Label/sub/icon untouched (label rewrites are N1.5+/founder's voice, not this task). Landing `/` unchanged — diorama decision stays with Abhishek.

### N1.2 Kill dead controls — DONE (`1d89421`)
- `StepDetail.tsx`: the entire fake Actions block (Start/Complete/Block/Reopen, all `console.log` TODOs) deleted. The real Advance button remains; nothing fake remains.
- `RightRail.tsx`: Today-task toggle `<button>` (no onClick) → non-interactive `<span>` status dot, `aria-hidden`, same visual weight.
- `PipelineSteps.tsx`: `cursor-pointer` + hover bg removed from the non-clickable row. No step-detail route exists — verified before deciding (nothing to link, so nothing fakes clickability).
- `WorkflowCards.tsx`: file deleted. Post-delete sweep: **zero imports/references left** in `src/`.

### N1.3 Retire /projects — DONE (`1d89421` + follow-up `6b6d82e`)
- `next.config.js`: redirect `/projects` → `/pipeline`. Shipped as `permanent: false` (307) — a conscious deviation from the plan's "permanent": 308 caches in browsers, and if `/projects` ever comes back that cache would be a trap. Noted in the redirect's comment.
- Sidebar `/projects` entry removed.
- Internal reference sweep: found **one straggler the patch missed** — home page "Project Progress → View All" still pushed `/projects` (`src/app/page.tsx:317`). Repointed to `/pipeline` in follow-up commit `6b6d82e`. This is exactly the "check first" step the plan asked for; the patch alone wasn't enough.

### N1.4 Honest-state primitives — DONE (`e010477`)
- `src/components/states/AsyncState.tsx` created: `<AsyncRegion state="loading|error|empty|ready">`, `<EmptyState title action>`, `<ErrorState message retry>` (44px retry), `SkeletonRows` helper reusing the existing `.skeleton` class.
- 8-state taxonomy documented in the file header (loading / refetch / first-empty / filtered-empty / error / offline / stale / ready).
- Worst offender migrated first: `/leads` raw error message → `<ErrorState message onRetry={load} />` — verified in code (`ErrorState` import + usage at `leads/page.tsx:161`).

### N1.5 Jargon sweep — DONE (`732ff62`)
| Site | Before | After | Verified |
|---|---|---|---|
| `leads/page.tsx:219` | `placeholder="playbook pack slug"` | `placeholder="Search playbooks…"` | grep ✓ |
| `clients/page.tsx` | `"Couldn't load clients / {error}. Is the API running on :4000?"` + visible `GET /api/v1/clients` | human sentence + Retry | grep ✓ |
| `pipeline/page.tsx` | `"pipelines-index 400"` | human sentence + retry | grep: zero hits ✓ |
| UUID fragments as names | `Client: ab12cd34` patterns | `Unnamed …` fallbacks | live: no raw fragments on /leads ✓ |

### N1.6 Type scale + tokens — DONE (`cc012f2`)
- Token dedupe: canonical `--danger / --warn / --info`; `--red/--amber/--blue` usages replaced.
- `--text-faint` contrast lifted to pass WCAG 4.5:1 at 11–12px on the dark bg.
- Dead 48px `.tabs` grid row removed (no component renders `.tabs`).
- `layout.tsx`: JetBrains Mono loaded (`.t-mono` no longer falls back to system mono). Satoshi untouched.
- Most-visible ad-hoc `fontSize` inline styles swapped for `t-title/t-meta/t-body` classes (team + today pages) — mechanical, no redesign.

---

## 2. Patch application notes

- All 4 patches (`n1-patch-1..4`) extracted from `hermes-n1-package.zip`.
- **Patch 2 initially conflicted:** its Sidebar context lines sat where my earlier `/tasks` nav entry (commit `a928e7f`) lives. After patch 1 committed, patch 2 applied clean — sequential order mattered, no manual resolution needed.
- Patches 3 and 4: clean on first check.
- Whitespace warnings on patch 1 (trailing whitespace + blank line at EOF) — cosmetic only, applied with warnings.

## 3. Verification (binding standard held)

- **Gates:** `npx tsc --noEmit` exit 0 (twice) · `npx next build` exit 0 (three builds, including the post-`page.tsx`-fix rebuild).
- **Live walk on fresh tunnels** (both old tunnels had died mid-run — reminted, frontend rebuilt against the new API URL, CORS `FRONTEND_URL` updated, API restarted):
  - **Sidebar (screenshot `n1-today.png`, 185KB):** nav order confirmed visually — **Approvals (Director Gate) with 156 badge first**, then Office Chat, Today, Command Center.
  - **Redirect (screenshot `n1-projects-redirect.png`, 145KB):** `/projects` → 307 → renders **"Pipelines — DELIVER"**, sidebar highlights Pipelines.
  - **/leads (screenshot `n1-leads.png`, 224KB):** real business names (Fitness Factory, TITO'S unisex salon, Harsha & Rakesh Salon…), **zero UUID fragments, zero raw endpoints**, New 48 / Qualified 8.
  - **One-number law:** 156 = 156 (badge = queue) on the new tunnels.
- Screenshots stored at `docs/evidence/n1/` (**gitignored** — they contain lead contact data; the rule: evidence on disk, never in the repo).

## 4. NOT in N1 (per plan — explicit non-goals)

- `/` default landing → `/approvals` — Abhishek's product call (diorama lives at `/`).
- Sidebar label/sub rewrites beyond the reorder — needs his voice.
- N2/N3/N4: calendar unification, proactive nudges, keyboard triage, ⌘K palette, 3D office.
- Anything needing API/DB changes — Hermes's lane.

## 5. Open follow-ups from this pass

| # | Item |
|---|---|
| 1 | Engagement page revisit flakiness (R2.2 part 2) — the one remaining "flaky on revisit" surface. |
| 2 | ProbeLab 88 vs 65 + "100% success + Blocked 1" stat reconciliations. |
| 3 | `/` landing decision (diorama vs approvals-first) — founder. |
| 4 | Full 25-page re-walk on `6b6d82e` (11 pages spot-verified so far). |

---
*Every claim above traces to a commit hash, a grep, or a screenshot opened and read. Nothing estimated.*
