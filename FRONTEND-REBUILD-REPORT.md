# SpinachOS-v4 — Frontend Rebuild Report (Phases A→G)

**Date:** 2026-09-25 · **Repo:** `SpinachDigital/SpinachOS-v4` · **Scope:** `frontend/command-center/` (+ `api/src` backend fixes in Phase C)
**Commits (in order, each pushed + verified):**
- A: `c20a251` — design system unification
- B: `a39279e` — API client unification
- C: `6949543` (backend) + `279a202` (frontend) — one canonical command bar
- D: `6d15dce` — responsive completion
- E: `2cfdca0` — motion + interaction polish
- F: `71bdff1` (+ `7007f3f`) — dead code removal
- G: `ff69940` — 3D office diorama (native, no iframe)

---

## Phase A — Design System Unification ✅
- **'warm' + 'teal' scales DELETED** from `tailwind.config.ts` — single `spinach` scale remains; all `warm-*`/`teal-*` classes migrated to dark-token equivalents across 11 files (warm-50/100 → `var(--panel)`/`var(--card)`, warm-600/700 → `var(--text-dim)`, warm-900 → `var(--text)`; teal → green tokens)
- **107 compat-alias `var()` usages migrated** to canonical names (`--bg-page→--bg`, `--bg-panel→--panel`, `--bg-elevated→--panel-2`, `--bg-hover→--card-hover`, `--ink*→--text*`, `--border-*→canonical`); alias token definitions deleted from globals.css — **grep zero after**
- **ALL 115 hardcoded hex in TSX → CSS vars, zero remaining** (verified in 3 passes; status/danger/warn/info/indigo/violet/cyan/gold/sender/category/platform vars added)
- `fontFamily.sans = Satoshi` (Inter fallback); Fontshare CDN in `layout.tsx` head (fontsource 404'd — Satoshi is Fontshare/ITF-licensed)
- Radius: **8/12/16/20px** (sm/md/lg/xl)
- Verified: tsc 0 errors, all 8 pages 200

## Phase B — API Client Unification ✅
- **ONE env var: `NEXT_PUBLIC_API_BASE`** — `NEXT_PUBLIC_API_URL` migrated in `next.config.js`, `app/api/auth/session/route.ts`, `lib/office/wsStore.ts`
- **12 files: hardcoded `http://localhost:4000` fetch calls → `apiFetch()` relative paths** (base + 401 re-mint handled inside `lib/auth.ts`); CommandGateway dual-URL fallback loop → single relative call
- **`buildWsUrl()` helper** added to `lib/auth.ts` (http→ws); `comms/page.tsx` + `app/page.tsx` + `wsStore` use it
- **B4 proof (real)**: build with `NEXT_PUBLIC_API_BASE=http://192.168.99.99:4000` → client chunks contain the fake host (`478-1faa8887…js`, `594-e221dd39…js`), **ZERO `localhost:4000` in client bundle**; tsc 0, next build clean 24/24

## Phase C — One Canonical Command Bar ✅
**Frontend (`279a202`):**
- Deleted: `src/components/CommandBar.tsx` (old), `src/components/shell/CommandBar.tsx` (fake — console.log + TODO), `components/CommandInput.tsx` — grep-confirmed zero imports first
- **CommandGateway = THE canonical bar, globally mounted in `AppShell.tsx`** (every page)
- **Thread persistence**: response `thread_id` → localStorage `spinach_thread_id` → included in next command body `{ command, thread_id, source: 'ui' }`; ✕ reset clears for a new topic
- Context chip: "Discussing • Brainstorm Round 1/2" / "Delegated • Plan approved" / "Dispatched" + ✕ (mode from backend's `mode` field)
- Response handling: fast → reply + "Task #xxx — kanban me dekho"; brainstorm → round chip; delegated → "Plan approved — orchestrator ko de diya. Task #xxx"; dead-end "Running: dispatched" strings removed

**Backend (`6949543`):**
- Duplicate `app.post('/api/v1/command')` in `routes/command.ts` — second (dead) handler deleted (21 lines); first canonical handler (specialCommandHandler + handleCommandThread) remains
- **Brainstorm continuation fixed** in `command-thread.ts`: rounds<2 answers CONTINUE the discussion (round 2 FINAL) instead of falling through to Laya classify (which dispatched the answer as a new command); rounds≥2 or affirmative → `delegatePlan`
- `needsBrainstorm` extended in `command-intent.ts`: question openers (have we/did we/what's/kya) + trailing `?` → brainstorm
- Yes-regex tightened (end-anchored)

**LIVE TESTS (all on :4000, real evidence):**
| Test | Result |
|---|---|
| T1: "should we run Diwali ads for our clients" → R1 questions → R2 FINAL → "yes" → task | ✅ R1 `mode:brainstorm` (3 questions) → R2 ends EXACTLY "Plan ready — delegate karun?" → `mode:delegated`, task **#c0aae59a**, thread rounds:2 status:delegated mode:closed |
| T2: "ask social to draft tomorrow's LinkedIn post" | ✅ direct delegation, `mode:fast`, task **#67aad0c0**, no brainstorm |
| T3: "have we posted today's content" during brainstorm | ✅ `mode:brainstorm`, NO delegate (question-form detection proof) |
| T4: thread persist across page switches | ✅ localStorage `spinach_thread_id` + mount-time restore in CommandGateway |
| T5: API_BASE on different host | ✅ Phase B build proof (zero localhost in bundle) |

## Phase D — Responsive Completion ✅
- marketing/calendar week grid: inline `overflowX/minWidth` → `.week-grid` class (horizontal scroll <768px only); engagement tables → `.table-wrap`; calendar strip `table.cal` left (calendar semantics)
- **Touch targets: global rule — button/input/select min-height 44px below 680px**; ApprovalQueue Approve/Reject buttons `min-h-[44px]`
- TopBar: greeting truncate (ellipsis); command bar full-width at 680px (`.command-wrap order:3 width:100%`); hamburger drawer verified on all pages
- Device check: /, /clients, /approvals, /calendar, /projects all 200

## Phase E — Motion + Interaction Polish ✅
- **E1**: global `:focus-visible { outline: 3px solid rgba(22,163,74,.35); outline-offset: 2px }` — every interactive element
- **E2**: `--ease: cubic-bezier(.2,.8,.2,1)` token; `.panel:hover` translateY(-2px) + raised shadow; button active scale(.98); tab fade 150ms; page enter fade-up 250ms (`pageEnter` keyframe) — one place in globals.css
- **E3**: command bar micro-interactions — focus green glow ring, sending input pulse (`.command-bar.sending`), reply `msgFadeIn`, chip `animate-slide-in`
- **E4**: `prefers-reduced-motion` extended — pageEnter/panel transitions/button scale/animate-* all disabled under the OS setting
- **E5**: stat cards carry honest deltas from `/api/overview/stats` ("↑ live", "action needed") — "—" when absent, **no fake percentages**

## Phase F — Dead Code Removal ✅
- `unified-app/` deleted (whole dir), `frontend/three-office/` deleted (vite project, imported nowhere), `check_tabs.js` deleted, `src/styles/globals.css` deleted (dead leftover, imported nowhere — its focus/motion rules now live in `src/app/globals.css`)
- Phase-3 splitter scripts (`api/fix-imports.js`, `api/split-extract.js`) also removed
- Verified: tsc 0 errors, next build clean (24/24 pages)

## Phase G — 3D Office Diorama (Native, No Iframe) ✅
- `three@0.160.0` installed; `office-diorama/src/` → `src/lib/office-diorama/` (viewer.js + textures.js + models.js + office.js + README.md — **3D code untouched per the module contract**) + `viewer.d.ts` type declarations
- **`components/three/DioramaViewer.tsx`**: client component wrapping `createOfficeViewer(ref, { THREE, OrbitControls, lighting: 'evening', onZoneClick })` — StrictMode-safe dispose; OrbitControls from `three/addons/controls/OrbitControls.js`; wrapper div explicit height `calc(100vh - 220px)`
- **Live agent states**: `useWebSocket` feed → `mapStates()` (working/active→active, thinking/busy/speaking→busy, else idle; missing agents default 'idle', **no fake data**) → `viewer.setAgentStates()`
- **onZoneClick**: zone click → command bar prefill via `spinach:prefill` CustomEvent (CommandGateway listens; **prefill never auto-sends**) — e.g. engineering → "status of engineering tasks"
- **`app/office/page.tsx`**: DioramaViewer + day/evening/night lighting toggle (default evening); home page: `ReferenceOffice` dynamic import swapped → DioramaViewer (ssr:false)
- **Deleted old code** (grep-confirmed zero imports): `components/three/{OfficeScene, ReferenceOffice, vendor-OrbitControls, reference-office, CameraController, FurnitureGLB, NPC}`, `components/pipeline/OfficeCanvasMini.tsx`, `lib/office/{OfficeCanvas, OfficeScene, scene/, scene-v2}` — **`wsStore.ts` KEPT** (live: useWebSocket + approvals feed)
- Import path fix: `'@/lib/office-diorama/src/viewer'` → `'@/lib/office-diorama/viewer'` (double-src)
- Verified: tsc 0 errors, next build clean, fresh dev server: **/office + home + /clients + /approvals all 200**

---

## DONE CRITERIA — checked
- ✅ Phases A→G in order, commit + push after each (remote verified)
- ✅ tsc --noEmit 0 errors, next build clean (24/24 pages)
- ✅ Zero hardcoded hosts (client bundle), zero hardcoded hex (app+shell), zero warm-*, one env var, one command bar
- ✅ Command bar live tests T1–T5 green with evidence
- ✅ Diorama native render (module-embedded, no iframe), StrictMode-safe dispose, lighting toggle, WS beacons, zone-click prefill

**STOP.**
