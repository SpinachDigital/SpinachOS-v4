# Spinach OS V5 — Visual & UX Audit Report (2026-09-23)

**Method:** throwaway headless Chrome probe (CDP :9333, own user-data-dir — dodges the Chrome profile lock that blocks browser_exec) + screenshots analyzed visually + DOM hit-tests + live command flow through the real UI input.

## Bugs Found & Fixed

### CRIT-A (UI): Duplicate left sidebars
- `layout.tsx` wraps ALL pages in `AppShell` (LeftNav + TopBar + OpsSidebar) AND `page.tsx` rendered its own inline nav + top bar + right panels → two sidebars side-by-side eating ~35% of screen width.
- **Fix:** `page.tsx` rewritten (592 → ~180 lines) — pure 3D command center; single shell from AppShell; nav uses real routes. WS client + status strip + zone legend + latest-event toast kept as 3D-stage overlays.

### CRIT-B (UX): Command input unclickable
- Floating wrapper had `pointer-events-none` but CommandInput never re-enabled `pointer-events-auto` — the whole command bar ignored clicks/typing.
- **Fix:** root div gets `pointer-events-auto`. Verified by DOM hit-test: INPUT wins at its center (`clickable: true`).

### CRIT-C (Auth): CommandInput dead token
- Read `localStorage.getItem('spinach_token')` — key never set (auth.ts caches under `spinach_token_cache` as JSON) → every UI command 401'd ("Command failed - check connection").
- **Fix:** replaced raw fetch with `apiFetch()` (real minted JWT, auto-refresh on 401). Verified live: "design a new logo" → routed → `design: Task started` → `Executing: design a new logo` in the DOM.

### MAJ-A (3D): Giant overlapping zone labels
- Drei `<Html transform sprite distanceFactor={10}>` billboards scaled inversely with camera distance — the closest label ("RESEARCH") rendered huge, clipped through NPC heads, bled outside the frame.
- **Fix:** 3D billboards removed entirely; replaced with static legend chips in page.tsx (color-coded, state-aware: border/dot brighten when the department is working).

### MAJ-B (3D): Robots clipping the camera near-plane
- Base cam (-14, 3.5, 20) put a desk cluster right in front of the lens; the foreground robot dominated >60% of the canvas.
- **Fix:** raised god-view `(-16, 14, 26)` → look `(0, 0.5, -2)`; research/operations clusters pulled deeper (z 15 → 12), engineering/design (z 8 → 6).

### MIN-A (3D): Pitch-black void skybox
- **Fix:** scene.background #0d1117 + city-glow horizon light (#2a3a5a, 0.35) from behind the walls.

### MIN-B (UX): Command bar contrast + breathing room
- Semi-transparent `bg-gray-900/50` let robots show through the input.
- **Fix:** `bg-gray-950/90 backdrop-blur-md shadow-2xl`, brighter placeholder; bar moved bottom-4 → bottom-8 (24→32px effective).

### MIN-C (3D): Weak floor anchoring
- **Fix:** ContactShadows strengthened (opacity 0.25→0.4, scale 4→7, blur 2.5, follow the moved dept positions).

## Verified After Fixes
- TypeScript: 0 errors (`npx tsc --noEmit`)
- 18/18 routes HTTP 200 (incl. /office, /terminal, /kanban)
- Single left sidebar (AppShell); no giant labels; status strip + legend chips don't collide
- Command input clickable (DOM hit-test) + solid/readable
- Full loop through the real UI: typed "design a new logo" → apiFetch 200 → Laya routed design → WS events → DOM shows `1 working`, `design: Task started`, `Executing: design a new logo`
- Console errors in 6s probe window: 0
- Status strip "0 agents" at rest is correct behavior (states broadcast only during execution); updates to "1 working / 1 agents" when a task runs

## Not Bugs (Confirmed OK)
- XSS payloads in Team Chat display as escaped text (not executed)
- Right sidebar (Today / AI Agents / Live Activity) is the AppShell OpsSidebar — intentional design, scrollable
- Two WebSocket connections (spinach-store + legacy wsStore in OpsSidebar) — redundant but harmless; legacy hook isolated to OpsSidebar

## Remaining Polish (Optional)
- Foreground robots near the command bar edge at 1600×900 — cosmetic framing artifact, improves at taller viewports
- Legacy wsStore could be folded into spinach-store to drop the duplicate socket
- NPC models share one flat yellow material — per-dept tint would differentiate teams visually
