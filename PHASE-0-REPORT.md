# PHASE 0 REPORT — Command Bar + Nav Critical Fix

**Commit:** `d2fc46d` (command bar + nav fixes) → `de917ac` (390px topbar fix) — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, PHASE 0
**Date:** 2026-09-26

---

## Shipped

### FRONTEND — exactly ONE command bar (TopBar slot, every page)

| File | Change |
|---|---|
| `components/shell/TopBar.tsx` | Inline command implementation **DELETED** (raw `fetch` that dropped `thread_id` + ignored the response). `CommandGateway` mounted `inline` in the topbar `command-wrap` slot. ⌘K now dispatches `spinach:focus-command` (gateway owns the input). |
| `components/shell/CommandGateway.tsx` | New `inline` prop: compact pill for the topbar slot (no absolute positioning); log panel drops below topbar (`.command-log-inline`); mic/transcript/log shared logic intact; `spinach:focus-command` listener added. |
| `components/shell/AppShell.tsx` | Floating duplicate `CommandGateway` mount **REMOVED**. The bar lives only in TopBar → exactly one bar on every page. |
| `components/shell/Sidebar.tsx` | **Lying entries removed:** Team (`/team`→redirect), Assets, Finance, Knowledge. Routes + IA v3 redirects kept (Sprint 2 audits, Sprint 5 ships real `/team`). |
| `src/app/globals.css` | Phone topbar: grid row `108px → auto` (wrapped 2-row topbar was clipping/overlapping tabs at 390px); `.command-wrap` full-width second row; `.topbar .hamburger` visible ≤680px. |
| Greeting | Fixed by actual hour: 0–4 AM = "Good night" (was "Good morning" at 3 AM), 4–12 morning, 12–17 afternoon, 17–21 evening, 21+ night. |

Dead-code deletions confirmed already gone from earlier phases: `shell/CommandBar.tsx`, `CommandInput.tsx`, `OfficeCanvasMini.tsx` — none exist on disk.

### BACKEND — Laya integrity (§3 Phase 0 bugs)

| File | Change |
|---|---|
| `api/src/laya-client.ts` | `LAYA_DEPARTMENT_MAP` fixed: `design→designer`, `content→social`, `operations/ops→orchestrator`, `ceo→ceo`. **`assertLayaMapIntegrity()`** startup gate: boot fails loudly if any map value is not a real `hermes-profiles/` dir. `REAL_PROFILES` exported. |
| `api/src/routes/laya.ts` | CEO bypass: fake `"CEO Query"` row insert into real `clients` table **DELETED**. CEO queries now dispatch `executeAgentTask('ceo')` without touching client data. Legacy row removed from DB (verified 0 rows after). |
| `api/src/index.ts` | `assertLayaMapIntegrity()` wired into boot. |

### §2 CORRECTIONS (reported, not silently built on)

1. **`engineering→engineering` was wrong in the plan itself.** The real profile dir is `engineer` (`hermes-profiles/engineer/`), and `TASK_PATH_MAP` in the bridge keys on `engineer`. Map is `engineering→engineer`. The startup assertion now enforces this class of bug permanently.
2. `shell/CommandBar.tsx`, `CommandInput.tsx`, `OfficeCanvasMini.tsx` were **already deleted** (Phase C/F of the frontend rebuild) — §2 said they still exist. Nothing to delete.
3. Laya adapter lives at `SpinachOS-v4/laya/main.py` (in-repo), not `~/workspace/laya/`. FastAPI/uvicorn were missing → installed, server brought up on :8000. The "already installed on the founder's PC" claim was half-true (package dir existed, deps missing).

---

## Acceptance Proofs

**Exactly ONE command input (desktop + 390px):**
- puppeteer-core DOM measurement @1440: `{commandBars: 1, commandInputs: 1, lyingLabels: 0, overflowX: false}`
- @390: `{commandBars: 1, overflowX: false, barOverlapsTabs: false, hamburgerVisible: true}`
- Screenshots: `docs/evidence/phase-0/home-1440.png`, `docs/evidence/phase-0/home-390.png` (vision-verified: one topbar pill, no floating pill, no overlap, hamburger present)

**Live clarification round keeps one thread_id + questions rendered (`p0-acceptance.js`):**
```
R1 mode: brainstorm | thread: c44e5e58 | asks questions: yes
R2 mode: brainstorm | same thread: true | ends with delegate prompt: true
R3 mode: delegated  | reply: Plan approved — orchestrator ko de diya. Task #1f781d0d.
```

**Laya routing through the fixed map (live):**
- "write a LinkedIn post" → Laya dept `content` → routed **`social`** task `7e042dd6` (was `executeAgentTask('content')` → nowhere)
- CEO query → routed `ceo` task `3803c062`; `clients` count 62 → 62 (no pollution); `'CEO Query'` rows: 0

**tsc + build:** frontend `tsc --noEmit` 0 errors; `next build` ✓ Compiled successfully; API `tsc` 0 errors.

---

## Deliberately left out

- IA v3 redirect block untouched (Sprint 2 owns the audit; only lying sidebar labels removed)
- `/team` real page (Sprint 5), pipeline pages (Sprint 4), 3D (Sprint 6)
- Brainstorm 2-round cap removal (Sprint 3 owns it — Phase 0 only guarantees thread_id continuity)
- No per-page redesign (Phase 1 is foundation-only)

## Laya decision log sample

| input | department | profile | evidence |
|---|---|---|---|
| "write a LinkedIn post" | content | social | task `7e042dd6` created |
| CEO strategic query | ceo | ceo | task `3803c062`, clients 62→62 |
