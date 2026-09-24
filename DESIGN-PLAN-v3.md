# Spinach OS — Full Frontend Redesign Plan (DESIGN-PLAN v3, 2026-09-23)

**Trigger:** "didn't like the ui/ux also there are few nav do samething — please plan the full frontend again"
**Method:** claude-design skill (surface-first doctrine, slop diagnostic) + popular-web-designs (Linear/Notion vocabulary) + visual probe audit of the live app.

---

## 1. DIAGNOSIS — Slop audit of current UI (score: 7/10)

| # | Tell | Where it fires now |
|---|------|--------------------|
| 2 | Generic tech hue | Tailwind default palette (gray-800/900, green-500 #22C55E) everywhere — brand tokens (teal #004B63, #56883E) barely used |
| 3 | Feature-tile grid | 5 equal-weight KPI cards; placeholder pages are icon-tile grids |
| 5 | Unearned blur | backdrop-blur pills floating over 3D with no elevation system |
| 7 | Icon topper | PlaceholderPage: rounded-2xl icon centered above every heading |
| 8 | Center stack | Every placeholder center-stacks; no real composition |
| 9 | Default type | Tailwind font stack; Satoshi self-hosted but not applied globally |
| 10 | Wrong surface | Operate/Monitor pages built as Decide-style centered heroes |
| — | Wrong palette posture | Dark #0B0F0E + neon green contradicts documented taste: warm off-white #FAFAF7 editorial, anti-neon |

**Root causes:** (a) palette never migrated to brand tokens; (b) nav IA never consolidated — 17 items, 8 placeholders, heavy duplication; (c) placeholder pages shipped as honest stubs but never designed.

---

## 2. INFORMATION ARCHITECTURE — 17 → 9 nav items, zero duplication

### Duplication map (what "few nav do same thing" means)
- Analytics ↔ Engagement — both analytics pages ("Analytics & insights" / "Growth & insights")
- Marketing (placeholder) + Content Calendar + Engagement = 3 items for one concept
- Calendar (scheduling) ↔ Content Calendar = 2 calendars
- / (Command Center) ↔ /office = same 3D view twice
- Team Chat ↔ Team = confusingly similar
- Logs nav ↔ right-panel LIVE ACTIVITY = duplicate concept
- Terminal, Kanban = debug tools in main nav

### New IA (9 items)
| Nav | Route | Content | Absorbs |
|-----|-------|---------|---------|
| Office | / | 3D command center (hero) | /office (redirect) |
| Approvals | /approvals | Approval queue (Operate surface) | — |
| Agents | /agents | Agent grid + People section | Team |
| Chat | /comms | Slack-style channels | — |
| Calendar | /calendar | Week/Month/Agent scheduling | — |
| Marketing | /marketing | Tabs: Content Calendar \| Engagement | both old pages |
| Projects | /projects | Workflows (8-step pipeline) + Leads + scraper runs | — |
| Insights | /analytics | Overview cards + charts + Audit Log tab | Analytics + Logs |
| Settings | /settings | Integrations, Theme, API keys, Brand & Assets | Assets |

**Removed from nav:** Team (→Agents), Clients (future CRM, out), Finance (→Insights later, out), Knowledge (out), Terminal (out), Kanban (out), Logs (→Insights audit tab), Content Calendar + Engagement (→Marketing tabs), /office route (redirect → /).
**Rule:** every nav item renders real content or a designed honest empty state — no "coming soon".

---

## 3. DESIGN SYSTEM v6 — brand-true, light-first editorial

**Surface commitment:** Office route = **Monitor/Command** surface (glanceable density, no marketing framing). All other routes = **Operate** surfaces (action affordances, left-aligned headers, no centered heroes).

### Palette (light default, dark optional toggle)
| Token | Light | Dark |
|-------|-------|------|
| --bg | #FAFAF7 warm off-white | #0A0A0A slate |
| --surface | #FFFFFF | #141414 |
| --surface-2 | #F3F2EE | #1A1A1A |
| --ink | #0F0F0F | #F7F6F1 |
| --ink-muted | #6B6B66 | #A3A39C |
| --border | rgba(15,15,15,0.08) hairline | rgba(255,255,255,0.08) |
| --accent (interactive) | #004B63 teal | #4DA8C7 teal-light |
| --brand (status/dot only) | #56883E spinach | #7FB35F |
| --danger / --warn / --ok | #C4453B / #B98A2F / #56883E | lighter variants |
| --scrim (over 3D) | rgba(250,250,247,0.9) | rgba(10,10,10,0.85) |

**Rules:** one accent (teal) for all interactive elements; green is brand dot/status only, never fills/buttons; no gradients, no neon, no glassmorphism without the scrim + elevation pair.

### Type
- **Satoshi** (Regular/Medium/Bold/Black) — self-hosted, applied globally: `body { font-family: 'Satoshi', ... }`
- **IBM Plex Mono** for logs/timestamps/kbd only
- Scale (Monitor density): 13px base, 12px panel, 11px label-caps, 15px page-title-sm, 20px page-title
- Hierarchy via weight + spacing before boxes/icons/color

### Space / shape / elevation
- Radii: 8 (inputs, chips), 12 (cards), 16 (modals)
- Spacing rhythm: 4/8/12/16/24/32
- Shadows (warm-tinted, soft): `0 1px 2px rgba(20,15,10,0.06)`, `0 8px 24px rgba(20,15,10,0.10)` — never glow
- Focus: 2px teal ring + offset; hit targets ≥ 44px... (desktop: ≥32px acceptable, mobile 44px)

### Motion posture
- 150–200ms ease-out on nav/panel/hover transitions
- Page enter: fade + 8px rise (Framer Motion), 250ms, once
- Live events: dot pulse only — no sliding tickers
- `prefers-reduced-motion`: all of the above off

---

## 4. LAYOUT ARCHITECTURE — one shell, route-per-page

- **Single AppShell** (already in layout.tsx): LeftNav (9 items, 220px, collapses to 56px icon rail, real routing) + TopBar (breadcrumb + ⌘K search + live status dot + profile) + content + OpsSidebar.
- **OpsSidebar** (Today / AI Agents / Live Activity) renders ONLY on Office route — other pages use full width.
- **Office route:** full-bleed 3D + minimal overlays (status strip, legend chips, command bar bottom-8, latest-event toast). No second nav, no panels over 3D.
- **Other routes:** max-w-6xl content column on --bg; page header pattern = left-aligned title + action row (no center stack, no icon topper).
- **⌘K palette:** 9 commands matching new IA; fuzzy filter; Enter routes.
- **Nav ids = routes 1:1**; active state derived from pathname (browser back/forward stays in sync).

---

## 5. PAGE-BY-PAGE SPECS

### 5.1 Office (/) — Monitor/Command
- Keep 3D scene (desks, NPCs, CEO cabin, posters, plants — current geometry is sound)
- Overlays re-skinned to v6: status strip + legend chips use --scrim light variant in light mode
- Light-mode 3D: port day rig from legacy Lighting.ts (warm daylight, bright exposure)
- Command bar: solid --surface, hairline border, teal focus ring
- Zone click → camera focus (exists) + matching legend chip highlights (exists)

### 5.2 Approvals (/approvals) — Operate
- Queue TABLE (not cards): Item | Department | Age | Actions (Approve/Reject inline buttons)
- Bulk bar appears when rows selected; counts row (Pending/Approved/Rejected/Total) as inline text, not monument stats
- Honest empty state: "No pending approvals — your team is running clean"

### 5.3 Agents (/agents) — Monitor + Operate
- Agent cards grid (2 cols): state dot, name, current task, progress bar; click → detail drawer
- People section below (absorbed Team): humans, roles, hire action
- Live WS states (exists)

### 5.4 Chat (/comms) — Operate
- Keep Slack structure (channels sidebar, thread, composer); re-skin light
- Channel list: unread dot in --brand green; composer teal send button

### 5.5 Calendar (/calendar) — Monitor
- Keep Week/Month/Agent views + standup scheduling; re-skin light; today column tinted --surface-2

### 5.6 Marketing (/marketing) — NEW parent page
- Tabs: Content Calendar | Engagement (lift existing drag-resize calendar + charts components)
- Platform filter chips; overview cards as inline stats row

### 5.7 Projects (/projects) — NEW real page
- Workflows table: name, 8-step pipeline progress (segmented bar), status, created
- Leads table below: source (GitHub/HN/Maps), company, status; scraper run history
- Data from /api/v1/workflows + /api/v1/leads

### 5.8 Insights (/analytics) — NEW
- Overview cards + platform breakdown charts (lift from engagement)
- Audit Log tab (lift from logs page — filterable feed, mono timestamps)

### 5.9 Settings (/settings) — Configure
- Keep Integrations/Theme/API Keys/Advanced; add Brand & Assets section (logo variants preview, font specimens)
- Light theme toggle stays (sun/moon)

---

## 6. 3D OFFICE — keep geometry, fix posture
- Camera: keep raised god-view (-16, 14, 26) → (0, 0.5, -2); polar clamps stay
- Light mode rig: warm daylight + exposure up (port from legacy)
- NPC per-department tint (subtle, muted) — differentiates teams
- No new fog, no neon, no giant labels (static legend chips stay)

---

## 7. BUILD SEQUENCE
- **Phase A — IA + shell:** new LeftNav (9 items), TopBar breadcrumb, ⌘K update, /office + /terminal + /kanban redirects/removal, kill duplicate nav ids
- **Phase B — Design system v6:** globals.css rewrite (light-first brand tokens, Satoshi global, component classes re-skinned, hairline borders, warm shadows)
- **Phase C — Page re-skins:** Approvals, Agents (+People), Chat, Calendar, Settings (+Brand)
- **Phase D — New pages:** Marketing parent (tabs), Projects real, Insights (+audit tab)
- **Phase E — 3D light mode + overlay re-skin**
- **Phase F — QA:** tsc, 9 routes 200, WS loop, command flow through real input, CDP probe screenshots (light + dark)

## 8. VERIFICATION
- `npx tsc --noEmit` clean after each phase
- 9/9 routes HTTP 200; old routes redirect (no 404)
- Command flow: typed command → apiFetch 200 → Laya routed → WS events in DOM
- Visual: throwaway Chrome probe screenshots at 1600×900, light + dark, compared against this spec
- Slop re-audit: compositional tells (3, 8, 10) must be 0 before done

## Decisions
- **No Agency delegation** — subagents stalled 70+ min in model-wait loops twice before; direct authoring completed the same work in ~15 min. Skills + direct writes is the proven path.
- **Light-first** — documented taste (Kinfolk/Hermès/Monocle warm off-white) beats the V5 dark spec; dark stays as toggle.
- **Teal as the single interactive accent** — green demoted to brand dot/status only (brand rule from tokens.json: dot/tittle only).
