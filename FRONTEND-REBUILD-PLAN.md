# SpinachOS-v4 Frontend Rebuild — Phases A→G (in order, commit+push after each)

## Phase A — Design system unification
- [ ] A1. Delete 'warm' color scale from tailwind.config.ts; migrate all warm-* classes in 10 files to dark tokens (warm-50/100 → var(--panel)/var(--card), warm-600/700 → var(--text-dim), warm-900 → var(--text))
- [ ] A2. Delete 'teal' scale from tailwind.config.ts; teal-* usages → green tokens
- [ ] A3. Dedupe tokens: keep --green drop --teal; keep --text drop --ink; DELETE compat aliases (--bg-page, --bg-panel, --bg-elevated, --bg-hover, --ink-2/3/4, --border-hairline/standard/strong) — migrate usages to canonical names
- [ ] A4. fontFamily.sans = Satoshi (drop Inter)
- [ ] A5. Radius scale 8/12/16px (sm:8 md:12 lg:16 xl:20)
- [ ] A6. 114 hardcoded hex in TSX → CSS vars; grep zero after
- [ ] A7. Verify pages: no light flash, no font switch, no radius mismatch. Commit + push.

## Phase B — API client unification
- [ ] B1. One env var NEXT_PUBLIC_API_BASE; migrate NEXT_PUBLIC_API_URL refs (next.config.js, app/api/auth/session/route.ts:17, lib/office/wsStore.ts:57)
- [ ] B2. 15 hardcoded http://localhost:4000 files → apiFetch() relative paths; grep zero after
- [ ] B3. buildWsUrl() helper in lib; comms/page.tsx:108 + app/page.tsx:140 + wsStore use it
- [ ] B4. Verify: fake API_BASE → no localhost:4000 requests. Commit + push.

## Phase C — One canonical command bar
- [ ] C1. Base = CommandGateway.tsx; delete src/components/CommandBar.tsx + shell/CommandBar.tsx (grep confirm no imports first)
- [ ] C2. Thread persistence: thread_id → localStorage 'spinach_thread_id' → include in next command body
- [ ] C3. Context chip: "Discussing • Brainstorm Round 1/2" + ✕ reset
- [ ] C4. Global mount in AppShell.tsx; remove app/page.tsx CommandInput; delete CommandInput.tsx
- [ ] C5. Response handling for all backend modes (fast/brainstorm/delegated/special)
- [ ] C6. Backend: dedupe duplicate app.post('/api/v1/command'); word-boundary on yes-regex; test "have we..." → NO delegate
- [ ] C7. Live tests T1–T5 with evidence. Commit + push.

## Phase D — Responsive completion
- [ ] D1. 3 pages grid-cols-* → .grid-2/.grid-3 or sm:/md: breakpoints
- [ ] D2. All <table> inside .table-wrap
- [ ] D3. Touch targets ≥44px below 680px (Approve/Reject test first)
- [ ] D4. Mobile nav hamburger on every page
- [ ] D5. TopBar wrap at 680px: command bar full-width, greeting truncate
- [ ] D6. Device test 360/768/1440 — 6+ page screenshots. Commit + push.

## Phase E — Motion + interaction polish
- [ ] E1. :focus-visible global (3px solid rgba(22,163,74,.35), offset 2)
- [ ] E2. Motion tokens --ease; card hover; button active; tab fade 150ms; page enter fade-up 250ms
- [ ] E3. Command bar micro-interactions
- [ ] E4. prefers-reduced-motion respected by new animations
- [ ] E5. Stat cards delta/trend only when data available. Commit + push.

## Phase F — Dead code removal
- [ ] F1. Delete unified-app/ (whole dir)
- [ ] F2. Delete frontend/three-office/
- [ ] F3. Delete check_tabs.js if at repo root
- [ ] F4. tsc + build verify. Commit + push.

## Phase G — 3D office diorama (native, no iframe)
- [ ] G1. npm i three (0.160.0)
- [ ] G2. office-diorama/src/ → frontend/command-center/src/lib/office-diorama/
- [ ] G3. components/three/DioramaViewer.tsx (client, StrictMode-safe dispose)
- [ ] G4. Live agent states via WS feed → viewer.setAgentStates()
- [ ] G5. onZoneClick → command bar prefill
- [ ] G6. app/office/page.tsx swap; delete old OfficeScene/lib/office code
- [ ] G7. Lighting toggle day/evening/night (default evening)
- [ ] G8. Verify render/orbit/WS beacons/prefill/no WebGL warnings. Commit + push + report.
