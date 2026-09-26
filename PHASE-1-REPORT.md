# PHASE 1 REPORT — Frontend Rebuild (Foundation, Properly This Time)

**Commit:** `4fdc522` — pushed `main`
**Plan:** hermes-product-plan-v2-full-prompt.md, PHASE 1
**Date:** 2026-09-26

---

## Audit result first (§2 re-verified fresh — no assertion-only claims)

The 09-25 rebuild landed **most** of the design-system work. Fresh grep proved these §2 items were already done:

| §2 claim | Fresh audit | Status |
|---|---|---|
| warm light-theme classes in 10 files | `grep warm- src --include='*.tsx'` → **0** | ✅ already fixed (rebuild Phase A) |
| teal scale wrong in tailwind | `grep teal tailwind.config.ts` → **0** | ✅ already deleted |
| CSS declares Satoshi but font-sans = Inter | tailwind `fontFamily.sans = ['Satoshi', …]`; computed body font = **Satoshi** at 1440 AND 390 (puppeteer) | ✅ already fixed |
| `--teal`/`--ink` alias tokens | `grep --teal:/--ink: globals.css` → **0** | ✅ already collapsed |

## The genuine gaps — FIXED

1. **6 hardcoded hex in `TaskRunsPanel.tsx`** (the file the 09-25 audit's "114 hex" grep missed — it grepped `src/app` + `src/components/shell` only, this file has a status-color map):
   - `running: '#004B63'` → `var(--info)` (that hex was the WRONG teal the plan called out!)
   - `blocked: '#B94A3E'` → `var(--listening)`
   - `review: '#B98A2F'` → `var(--gold)`
   - error icon/label `'#B94A3E'`/`'#D97A6F'` → `var(--listening)`
2. **Two env names → ONE:** `next.config.js` rewrites still read `NEXT_PUBLIC_API_URL` (retired name) → now `NEXT_PUBLIC_API_BASE`. `.env.example` cleaned (URL + WS_URL vars removed). `wsStore.ts` WS URL now derived from the single var (`http→ws`).
3. **Dead-code sweep (module-graph):** wrote a reachability script (entrypoints = Next `page/layout/route/...` files; regex covers `from`/`import()`/`require` incl. `dynamic(() => import(...))`), then confirmed every candidate with exact-specifier grep. Deleted **13 unimported files**:
   `components/{AgentStatusGrid, ControlPanel, DepartmentSidebar, Layout, WorkflowCards}`, `components/dashboard/{ActivityFeed, ApprovalSummary, WorkflowCards}`, `components/shell/{AppShellClient, LeftNav, OpsSidebar, RightPanel}`, `store/useStore`.
   **Kept deliberately:** `components/pipeline/*` (Sprint 4 mounts them — plan says "find them, reported unmounted"), `lib/office-diorama/viewer.d.ts` (type declarations for the diorama lane).

## Grep proofs (the Phase 1 acceptance rule)

```
1. warm-* classes in TSX:          0
2. teal in tailwind.config.ts:     0
3. #[0-9a-fA-F]{6} in TSX:          0   (src/app + src/components)
4. hardcoded localhost:4000:       0   (only env-fallback defaults remain)
5. hardcoded ws://:                 0
6. NEXT_PUBLIC_API_URL leftovers:   0   (one comment noting retirement)
7. --teal / --ink tokens:          0
```

## Build + visual acceptance

- `tsc --noEmit` → **0 errors**; `next build` → ✓ Compiled, 24/24 pages
- puppeteer DOM + screenshots (`docs/evidence/phase-1/`):

| page | width | overflowX | font | commandBars |
|---|---|---|---|---|
| home | 1440 | false | Satoshi | 1 |
| home | 390 | false | Satoshi | 1 |
| clients | 1440 | false | Satoshi | 1 |
| clients | 390 | false | Satoshi | 1 |

- Vision-verified `clients-390.png`: no overflow/cut-off, command bar in topbar, clean single column.

## §2 corrections

- The plan's audit numbers (114 hex, 15 files) describe the state **before** the 09-25 rebuild; on current `main` the real residual was 6 hex in one file + 1 stale env var in next.config.js. Fixed both; everything else verified already-done.

## Deliberately left out (per plan's time-box)

- Per-page redesigns (sprints own their pages), per-page responsive fixes (Sprint 2 gate), 3D (Sprint 6)
- Marketing calendar inline `overflowX/minWidth:980px` → Sprint 2 item 4 ("fix the marketing calendar for real")
- IA v3 redirect audit completion → Sprint 2 item 3
