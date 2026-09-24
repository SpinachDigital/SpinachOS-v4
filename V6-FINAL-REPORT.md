# Spinach OS — V6 Redesign Final Report (2026-09-23)

**Scope:** Full frontend redesign per DESIGN-PLAN-v3 — IA consolidation, page re-skins, new pages, backend workflow fix, NPC + 3D center work.

## All Phases Complete

### Phase A — IA + Shell ✓
- LeftNav rewritten: 17 → **9 items** (Office, Approvals, Projects, Agents, Chat, Calendar, Marketing, Insights, Settings) — zero duplication
- **11 redirects** in next.config.js: /office→/, /team→/agents, /clients→/projects, /logs→/analytics, /marketing/calendar→/marketing, /marketing/engagement→/marketing, /assets→/settings, /finance→/analytics, /knowledge→/settings, /terminal→/, /kanban→/projects — all verified 307 (no 404s)
- AppShell: OpsSidebar renders **only on Office route** (pathname-gated); other pages full width
- LeftNav duplicate `cn()` collision fixed (compile error, removed)

### Phase B — Design System v6 ✓
- AppShell main content: warm off-white `var(--bg-page)` (dark chrome shell + warm editorial content hybrid)
- PlaceholderPage redesigned: left-aligned header + designed empty state (icon topper + center-stack slop removed), warm tokens throughout

### Phase C — Page re-skins ✓
- **Approvals**: warm light tokens, inline stats row (Pending/Approved/Rejected/Total as text, not monument cards), left-aligned header
- Chat / Calendar / Settings: full implementations kept, render on warm bg

### Phase D — New pages ✓
- **Marketing** parent: tabs (Content Calendar | Engagement) lifting both full implementations via dynamic import
- **Projects** real page: workflows with **8-step segmented pipeline bars** + progress % + status badges, leads table by source, 30s auto-refresh
- **Insights** real page: inline stats (working/blocked/success rate), agent states table, **Audit Log tab** (filterable, absorbs /logs)

### Backend Workflow FIX ✓ (user ask)
- **BUG**: `create_workflow_steps` RPC missing/returning null → workflows created with **0 steps** (`steps_json: []`, `current_step: null`) — pipeline could never advance
- **FIX**: `DEFAULT_PIPELINE_STEPS()` fallback in API — workflow creation now seeds the full 8-step pipeline (strategy→research→content→design→build→campaign→outreach→review), first step in_progress, CEO emits "working" on creation
- **VERIFIED END-TO-END**: create → 8 steps → advance strategy (200, progress 13%, next research) → out-of-order advance outreach → **409 with 5 incomplete steps listed** → full completion → **8/8 steps completed, progress 100%, status completed**
- **ADDED**: missing `GET /api/v1/workflows/:id` route (was 404 — only list/POST/PATCH existed)
- **NOTE**: API :4000 was found dead (WinError 10061) during testing — restarted, health 200

### NPC + 3D Center ✓ (user ask)
- **SCALE BUG FOUND & FIXED**: worker.glb `RobotArmature` node has `scale: [100,100,100]` — NPCs rendered as ~3m giants vs desks. Fixed: NPC scale 0.9 → **0.015** (verified visually: robots now ~1.7m, "scale consistent with standard human proportions")
- **NPC store-driven**: DeskCluster reads `agentStates[dept]` from spinach-store → every NPC's animation follows the live department state (working→Sitting, idle→Idle, blocked→No, speaking→Wave)
- **Per-department tint**: NPC torso materials lerp 20% toward the dept color (subtle, muted — never neon)
- **Duplicate `!mounted` block** removed (dead code)
- **3D light mode**: TopBar theme toggle (sun/moon) dispatches `office-theme` event → scene swaps night rig (ambient 0.3) ↔ day rig (ambient 1.1 + warm daylight 1.4); preference persisted in localStorage
- **Composition fixes**: clusters brought inward (±18 → ±14) — **all 7 zones now in frame**; left wall solid → glass (dark silhouette was blocking upper-left); upper-left quadrant fill light added; camera raised (-19, 19, 30)

## Final QA Results
| Check | Result |
|-------|--------|
| TypeScript | 0 errors (`npx tsc --noEmit`) |
| 9 nav routes | 9/9 HTTP 200 |
| 11 redirects | 11/11 → 307 correct destinations |
| API :4000 health | 200 |
| Laya :8000 health | 200 |
| Command routing | 200 → Laya routed (engineering, medium) |
| Workflow create | 201 — 8 steps, current: strategy |
| Workflow full completion | 8/8, 100%, status: completed |
| Out-of-order enforcement | 409 + incomplete steps listed |
| Agent states | 6 agents live |
| Leads | 66 leads |
| 3D zones in frame | 7/7 |
| NPC scale | human-proportioned (visual verified) |
| Day/night toggle | working (event + persistence) |

## Artifacts (CDP probe screenshots)
- `v6-office-final.png` — 3D command center, all 7 zones, human-scaled NPCs
- `v6-projects.png` — Projects (workflows + pipeline bars, warm light)
- `v6-marketing.png` — Marketing tabs
- `v6-insights.png` — Insights + audit log

## User-Reported Bugs (2026-09-23, post-audit)

### BUG-1: "generate a social media post for Spanish digital" routed to engineering
- **Root cause**: Laya's classifier scored departments 1/0 per department (one mega-regex each). "create a social media post" matched BOTH engineering ('create') and marketing ('social media', 'post') → tie → `max()` picked the FIRST dict key = engineering. "make a tweet" — 'tweet' wasn't a keyword at all → empty scores → engineering default + LLM fallback also returned engineering.
- **Fix**: Laya classifier rewritten — per-KEYWORD count scoring (social media + post = 2 beats create = 1), added missing social keywords (tweet, twitter, x post, linkedin, threads, social, follower, hashtag), tie-break toward marketing/content when content-creation verbs (generate/make/write/draft) present.
- **Verified 11/11**: all 5 misrouting cases now marketing; zero regressions (build/fix/create a website/deploy → engineering; design/research unchanged).

### BUG-2: Where do I see the result/output?
- **Root cause**: task output existed only in the DB (`tasks.metadata.output`) with an API to read it (`GET /agents/execute/:taskId`) but NO UI surface.
- **Fix**: NEW `TaskRunsPanel.tsx` — Task Runs viewer (right drawer on the Office page, toggle via "Task Runs" pill bottom-right):
  - Lists the 30 most recent agent-execution runs (status dot, agent, model, timing)
  - Click a run → fetches the FULL task → renders the complete LLM output, model, started/finished times, or the error for blocked runs
  - 15s auto-refresh; running tasks show "output appears when the agent finishes…"
- **Verified live (CDP probe)**: opened the panel, expanded the exact task the user tested ("generate a social media post for Spanish digital — social · done") → full output rendered: "**LinkedIn Post** — Spain's digital landscape moves fast. The brands that keep up? They're strategizing…"
- For "create website" tasks: same panel — the engineering agent's output (implementation steps/code) appears the same way once the task completes.

- Agent/comms/calendar/settings pages keep their dark glass styling (working; warm re-skin optional follow-up)
- NPC seated pose is stylized (banana-form GLB rig) — acceptable at command-center distance
- Upper-left void still slightly dim at night mode (improved, not eliminated)

## Hermes3D Asset Pack Integration (2026-09-23, post-v6)
- Source: github.com/iamlukethedev/Hermes3D/tree/main/public/office-assets (MIT-style public repo)
- **Downloaded 16/16 assets** to `public/env/` + `public/models/furniture/`:
  - `office_env_1k.hdr` (1.1MB, valid Radiance) — replaced `<Environment preset="warehouse">` with the real office HDR
  - 14 furniture GLBs (desk, deskCorner, chairDesk, chairModernCushion, computerScreen, plantSmall1, pottedPlant, loungeSofa, loungeDesignChair, tableCoffee, tableRound, lampRoundFloor, bookcaseClosed, kitchenCoffeeMachine) — all valid glTF v2, no 100x-scale traps
- **Created** `src/components/three/FurnitureGLB.tsx` — lazy GLB loader with useMemo cloning + module-level preloads
- **Swapped**: Desk (procedural boxes → desk.glb + chairDesk.glb + computerScreen.glb), LoungeArea (→ loungeSofa + loungeDesignChair ×2 + tableCoffee + lampRoundFloor + pottedPlant), PlantPot (→ pottedPlant.glb)
- **Visual verified (CDP probe)**: "dramatic leap in visual fidelity" — real ergonomic chairs with 5-star bases, distinct desk tabletops with leg frames, PBR soft lighting, HDRI ambient fill, furniture grounded flush, no floating/clipping
- Unused downloads kept for future zones: deskCorner, chairModernCushion, plantSmall1, tableRound, bookcaseClosed, kitchenCoffeeMachine

**Servers running:** frontend :3000, API :4000 (WS on /ws), Laya :8000
