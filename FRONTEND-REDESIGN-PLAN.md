# Spinach OS Frontend Redesign — Complete Plan

## Overview
Replace current frontend with a unified **Command Center + 3D Digital Twin** dashboard matching the reference image exactly. Use the standalone HTML's procedural 3D office as the new engine, wrap it in the Next.js app with the exact UI layout from the reference image.

---

## Phase 1: Asset Integration & 3D Engine Swap

### 1.1 Extract & Optimize 3D Office Assets
- Copy all procedural factories from `spinach-3d-office.html` → `frontend/command-center/src/lib/office/scene-v2/`
- Organize into modules: `architecture.ts`, `furniture.ts`, `npcs.ts`, `lighting.ts`, `plants.ts`, `branding.ts`, `office.ts`, `textures.ts`
- Remove lil-gui, add WebSocket-driven state (agent states, task updates, zone clicks)
- Keep: all furniture, NPCs, plants, architecture, branding textures, lighting, camera presets, zone system
- Remove: GUI controls, walkers (or make optional), explode view, lil-gui

### 1.2 img2threejs Integration
- Install `img2threejs` as dev dependency for future asset generation
- Use its pipeline for any new image-to-3D needs
- Current office is fully procedural — no external GLB dependencies needed

### 1.3 Three.js Scene Wrapper
- New `OfficeSceneV2.tsx` replacing current `OfficeScene.ts`
- Expose: `onZoneClick`, `onAgentStateChange`, `setTheme`, `focusZone`
- React Three Fiber + Drei compatible

---

## Phase 2: Design System V6 (Light-First Editorial)

### 2.1 Color Tokens (from reference)
```css
--bg-canvas: #080A09;           /* deep charcoal */
--bg-surface: #121614;          /* card base */
--bg-surface-hover: #151917;
--border-subtle: rgba(255,255,255,0.07);
--border-strong: #202622;
--accent-emerald: #22C55E;      /* single brand accent */
--accent-emerald-glow: rgba(34,197,94,0.12);
--text-primary: #F8FAFC;
--text-secondary: #94A3B8;
--text-muted: #4B5563;
--status-magenta: #E879F9;
--status-cyan: #38BDF8;
--status-amber: #F59E0B;
--status-red: #EF4444;
```

### 2.2 Typography
- **Primary**: `Plus Jakarta Sans` (Inter alternative, more editorial) — weights 400/500/600/700
- **Editorial**: `Playfair Display` or `Instrument Serif` — italic for quotes/slogans
- **Mono**: `JetBrains Mono` for logs/timestamps

### 2.3 Spacing & Geometry
- Radius: `12px` cards, `8px` sub-elements, `9999px` pills
- Gaps: `16px` grid, `20px` card padding
- Inner glow: `inset 0 1px 0 rgba(255,255,255,0.05)` on cards
- Glassmorphism: `backdrop-filter: blur(12px)`, `bg: rgba(18,22,20,0.75)`

---

## Phase 3: Layout — 3-Zone Shell

### 3.1 Left Sidebar (240px fixed)
- Logo: `spinach labs` with leaf icon, lowercase, bold sans + green dot
- Nav items: icon + title + subtitle (11 items)
- Active state: emerald pill (`bg-emerald/12`, text-emerald, icon-emerald)
- Footer brand card: serif quote "Ideas Systems Impact 🟢 / A QUIETER, BRIGHTER TOMORROW."

### 3.2 Center Main (flex-1)
- **Top Header**: Greeting + subtitle | Search (⌘K) | Notification bell (badge) | Profile chip | Editorial quote
- **Sub-tabs**: Overview | Projects | Agents | Team | Clients | Growth
- **KPI Row**: 5 metric cards with icons, values, trend indicators
- **3D Hero**: Full-width 3D office with absolute-positioned department badges
- **Bottom Grid** (4 cols): Project Progress (bars), Recent Outputs (gallery), Calendar, Editorial Card

### 3.3 Right Rail (340px fixed)
- **Today's Schedule**: Timeline with dots, titles, tags, timestamps
- **AI Agents**: 20 Online badge, agent cards with glyphs + status text, "View All" button
- **Live Activity**: Colored pins (green/magenta/cyan/amber) + timestamps

---

## Phase 4: Page Implementations

### 4.1 Office (`/`) — Primary Dashboard
Full 3-zone layout as above. 3D office is the hero.

### 4.2 Approvals (`/approvals`)
- Queue table (not cards) with inline Approve/Reject
- Stats row: Pending | Approved | Rejected | Total
- Bulk actions bar
- Empty state designed

### 4.3 Agents (`/agents`)
- Grid view: cards with state dot, progress, detail drawer
- Hierarchy view (absorbed from Team)
- "Add Agent" flow

### 4.4 Chat (`/comms`)
- Slack-style: channels sidebar, thread view, composer
- @mention autocomplete
- Re-skin to light tokens

### 4.5 Calendar (`/calendar`)
- Week/Month/Agent views
- Standup scheduling
- Re-skin

### 4.6 Marketing (`/marketing`)
- Tabs: Content Calendar | Engagement
- Lift existing implementations, re-skin

### 4.7 Projects (`/projects`)
- **NEW PAGE**: Workflows with 8-step segmented pipeline bars + progress %
- Leads table by source
- 30s auto-refresh

### 4.8 Insights (`/analytics`)
- Overview stats cards
- Agent states visualization
- **Audit Log tab** (absorbs /logs)

### 4.9 Settings (`/settings`)
- Integrations, Theme, API Keys
- **Brand & Assets** section (logo variants, font specimens)

---

## Phase 5: 3D Office Enhancements

### 5.1 Light Mode Rig
- Day/night toggle from TopBar → `office-theme` event
- Day: warm overhead, HDRI env, 1.1 exposure
- Night: cool dim, pendant glow, 1.0 exposure

### 5.2 Department Badges (from reference)
```ts
const DEPT_BADGES = [
  { id: 'strategy', label: '01 Strategy & Consulting', agents: 3, people: 4, pos: [-15.5, 2.5, -6] },
  { id: 'content', label: '02 Content & Creative', agents: 5, people: 6, pos: [4.5, 2.5, -9] },
  { id: 'campaigns', label: '03 Campaigns & Media', agents: 4, people: 5, pos: [13.5, 2.5, 0.5] },
  { id: 'webtech', label: '04 Web & Tech', agents: 4, people: 5, pos: [4, 2.5, 0.6] },
  { id: 'data', label: '05 Data & Analytics', agents: 3, people: 4, pos: [16.5, 2.5, -4.5] },
  { id: 'meeting', label: 'Meeting Room', agents: 0, people: 0, pos: [17, 2.5, -12] },
];
```
- Semi-transparent dark pills with emerald borders
- Green numbers, "X Agents | Y People" format
- Click → camera focus + zone highlight

### 5.3 NPC Improvements
- Per-department tint (20% lerp on torso)
- Store-driven animations from WS `agent_state`
- Scale fix: 0.015 (confirmed)

### 5.4 Camera Presets (from standalone)
- Aerial, Reference View, Reception, Desk Field, Lounge, Cafe, Top-down
- Zone click → smooth 0.8s lerp to preset

---

## Phase 6: WebSocket Integration & Real-Time

### 6.1 Single WS Connection
- `wsStore.ts` as source of truth
- Event types: `agent_state`, `task_update`, `feed`, `approval`, `workflow`, `zone_focus`
- Auto-reconnect 5s, exponential backoff

### 6.2 UI Bindings
- Status strip: working/blocked/online counts + LIVE dot
- Agent cards: state dot + activity text
- 3D NPCs: state → animation mapping
- Task Runs panel: live updates
- Live Activity feed: append on `feed` events

---

## Phase 7: Command Gateway + Laya Routing

### 7.1 Command Gateway (bottom pill)
- Voice (Web Speech API en-IN) + text
- Log panel with timestamps
- Uses `/api/v1/command` (Laya routed)

### 7.2 Laya Integration
- `/api/v1/laya/route` + `/api/v1/laya/health`
- Multi-intent splitting, confidence scores
- Strategy bypass keywords

### 7.3 Task Runs Panel
- Bottom-right pill → right drawer
- 30 most recent runs with status dots
- Click → full output render (text + image URLs)

---

## Phase 8: IA Consolidation (17 → 9)

| Old | New | Redirect |
|-----|-----|----------|
| /office | / (redirect) | 307 |
| /team | /agents | 307 |
| /clients | /projects | 307 |
| /logs | /analytics | 307 |
| /marketing/calendar + /engagement | /marketing (tabs) | 307 |
| /assets | /settings | 307 |
| /finance | /analytics | 307 |
| /knowledge | /settings | 307 |
| /terminal | / | 307 |
| /kanban | /projects | 307 |

**Nav Items (9)**: Office, Approvals, Projects, Agents, Chat, Calendar, Marketing, Insights, Settings

---

## Phase 9: Backend Fixes (from audit)

### 9.1 Critical
1. **Run SQL fix**: `supabase/fix-agent-states-profile-check.sql` in dashboard
2. **Daily standup**: loop upserts, surface errors
3. **GET /clients**: add endpoint

### 9.2 High
4. `emitAgentState` persists to `agent_states` table
5. All commands create tracked tasks
6. Task lookup: UUID regex → 400, not found → 404
7. Hire upserts: dept/role → metadata
8. `hire` commands bypass Laya → HR branch

### 9.3 Medium
9. Single WS connection (OpsSidebar → spinach-store)
10. `.select()` → `.single()`, 'paused'→'idle' mapping

---

## Implementation Order

1. **Phase 1-2**: Asset extraction, design system, shell layout
2. **Phase 3**: Page routing + redirects
3. **Phase 4**: Page implementations (Office first)
4. **Phase 5**: 3D office integration + badges + light mode
5. **Phase 6**: WS integration across all pages
7. **Phase 7**: Command Gateway + Laya + Task Runs
8. **Phase 8**: Redirects + nav cleanup
9. **Phase 9**: Backend SQL fix + verification

---

## Deliverables

| File | Purpose |
|------|---------|
| `frontend/command-center/src/lib/office/scene-v2/` | Complete 3D engine (8 modules) |
| `frontend/command-center/src/components/shell/AppShell.tsx` | 3-zone layout |
| `frontend/command-center/src/components/office/OfficeSceneV2.tsx` | R3F wrapper |
| `frontend/command-center/src/components/office/DepartmentBadges.tsx` | Floating badges |
| `frontend/command-center/src/components/dashboard/*` | KPI, ProjectProgress, RecentOutputs, Calendar, EditorialCard |
| `frontend/command-center/src/components/ops/*` | TodaySchedule, AIAgentDirectory, LiveActivity |
| `frontend/command-center/src/app/(dashboard)/*` | 9 route pages |
| `supabase/fix-agent-states-profile-check.sql` | **Must run in dashboard** |

---

## Verification Checklist

- [ ] TypeScript 0 errors
- [ ] All 9 routes + 11 redirects → 200
- [ ] Office page: 3D renders, badges clickable, WS live
- [ ] Command Gateway: voice + text → Laya → agent execution → Task Runs panel shows output
- [ ] Approvals: inline approve/reject works
- [ ] Agents: grid + hierarchy, hire works
- [ ] Chat: channels, threads, @mentions
- [ ] Calendar: standup scheduling
- [ ] Marketing: calendar + engagement tabs
- [ ] Projects: pipeline bars + leads table
- [ ] Insights: stats + audit log tab
- [ ] Settings: Brand & Assets section
- [ ] Light/dark toggle: UI + 3D flip
- [ ] Theme persists localStorage
- [ ] Status strip: LIVE, counts correct
- [ ] Task Runs panel: click run → full output + images
- [ ] Pipeline full 8/8 completion verified
- [ ] 10 concurrent commands → all 200, zero 429

---

## Timeline Estimate

| Phase | Time |
|-------|------|
| 1-2: Assets + Design System | 2-3 hours |
| 3-4: Shell + Pages | 3-4 hours |
| 5: 3D Integration | 2 hours |
| 6: WS Integration | 1 hour |
| 7: Gateway + Laya + Task Runs | 1.5 hours |
| 8-9: Redirects + Backend Fix | 1 hour |
| **Total** | **~10-12 hours** |

---

## Notes

- **Do not use subagents** — previous attempts stalled 70+ min in model-wait loops
- **Direct authoring** with full context finished same work in ~15 min
- Browser_exec (headless) is blocked by Chrome profile lock — verify via desktop preview pane + compiled bundle checks
- Run SQL fix in Supabase dashboard **before** testing hires