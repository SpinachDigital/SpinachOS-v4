# Spinach Labs Command Center — Full Redesign Plan (v2)
**Date:** 2026-09-20 · **Status:** Planning → Moodboard → Wireframe → Execute

## 0. User Requirements (verbatim)
> "still not liking the design there is no animation in 3d center also look very static make it look real, create full scene with proper office real desk real wall real cabin real npc etc also redesign everything again. first build a plan a moodboard a wireframe then execute. i have uploaded a reference can we build something like that only. for building this if you want to delegate the task please do but build it nicely and properly"

## 1. Diagnosis — Why v1 Failed
Slop audit of current state: **7/10**
- **No real animation loop** — NPCs have GSAP gestures but the scene reads static; no ambient life (people walking, screens flickering, plants swaying, AC light hum)
- **Primitive geometry** — capsule torsos + box rooms ≠ "real office." No desks, chairs, monitors, cabins with glass, doors, ceilings, props
- **Flat dark stage** — #0F0F0F void with fog; reference is a lit, warm, realistic office
- **Overlay panels ≠ command center** — floating glass chips feel bolted-on, not composed

## 2. Surface Commitment
- **3D scene = Explore + Monitor hybrid** — a *place* you look into (like the reference), with live state encoded in the scene itself
- **UI shell = Command/Inspect** — the data panels, command bar, approvals
- The 3D office IS the product. UI serves it.

## 2b. Reference Analysis (vision_analyze, 2026-09-21)
The uploaded reference (ChatGPT_Image_Sep_21_2026_01_42_16_AM) is a **full Command Center dashboard with an embedded photorealistic 3D office digital twin**:
- **Render style**: Photorealistic 3D architectural visualization — soft shadows, GI, depth of field (like ArchDaily renders)
- **Camera**: High-angle isometric-adjacent "god's eye" view — whole floor visible at once
- **Layout**: Open-plan industrial-modern; grid rows of desks with low-profile partitions; glass-enclosed meeting room (top-right, black metal frames, floor-to-ceiling); lounge area bottom-right
- **Desks**: modular long-table clusters, dual-monitor setups, ergonomic chairs, desk plants/lamps
- **NPCs**: ~25-30 figures, most seated at desks looking at monitors; one walking the central aisle; 4-5 gathered around meeting table
- **Lighting**: cool blue-white ambient on main floor vs warm amber glow in meeting room + lounge — visual hierarchy draws eye to meeting space
- **UI over 3D**: floating semi-transparent dark-glass zone cards (name, agents, people count)
- **Shell**: left sidebar nav (Projects, AI Agents, Team, Clients), top bar (search, user profile "Abhishek Jha, Founder"), right sidebar (AI Agents list + Live Activity feed), bottom footer (project progress bars, output thumbnails, calendar)
- **Palette**: dark mode — #0a0a0a bg, #161616 panels, white text, #a0a0a0 secondary; NOTE: reference uses #2ecc71 neon green — we override with brand #56883E per tokens.json

## 3. The Scene — "Real Office" Spec (per reference)
### Architecture
- **Floor**: wood/laminate planks (warm oak tone) with subtle reflections, not grid helper
- **Walls**: real walls with baseboards, drywall material, warm paint (#E8E4DC range), windows with daylight
- **Ceiling**: present, with recessed lights / AC panels
- **Cabins**: glass-partitioned rooms (CEO, CTO) with aluminum frames — like real offices
- **Open desks**: rows of desks in open areas (Sales, Content, Design, Engineering) — desk, chair, monitor, keyboard each
- **Doors**: real door frames, some open some closed
- **Props**: plants (spinach-green nod), books, coffee mugs, cables, rugs — the stuff that makes it real

### NPCs (8-10)
- Real proportions (~1.75m), stylized-realistic (not cartoon, not uncanny)
- Seated at desks when working (typing animation, screen glow on face)
- Standing/walking when idle (subtle walk cycle between desk and window)
- Speaking: face the camera, hand gestures
- State ring → NPC: idle=green, thinking=amber, working=teal-blue→brand-green pulse, speaking=purple, blocked=red
- **Screen glow**: NPC's monitor shows state color, illuminates them — this is the "alive" tell

### Lighting (the difference between static and real)
- Warm ambient (0xFFF4E0, low intensity) — office ceiling lights
- Cool daylight from windows (0xC8DCE8, directional) — contrast warmth
- Per-desk monitor glow (small point lights, state-colored)
- Soft shadows (PCFSoft, 2048 maps)
- **Animated light flicker**: subtle intensity oscillation on monitors — office feels powered
- Time-of-day tint option (morning/afternoon/evening)

### Camera & Motion
- Start: 3/4 elevated overview (like reference)
- Orbit controls with damping; room-focus transitions via GSAP
- **Idle camera drift**: very slow orbit when user not interacting — the scene breathes
- Enter room → smooth fly-in; exit → return to overview

### Animation Inventory (mandatory, this is the fix)
1. NPC breathing (all states, continuous)
2. NPC blink (random interval)
3. Typing hands when working
4. Walk cycle when moving
5. Screen glow flicker (per monitor)
6. Data ring / hub rotation ( Ops room)
7. Plant sway (very subtle)
8. Camera drift (idle)
9. State transitions (GSAP, 400ms ease)
10. Steam from coffee mugs (tiny particles, 2-3 desks)

## 4. UI Shell Redesign
- **Left nav**: department list with live counts, warm paper bg, hairline dividers, Satoshi type
- **Top bar**: real Spinach Labs reverse logo + status strip (working/blocked/online) + Cmd+K
- **Right panel**: tabs (Agents/Pipeline/Approvals/Logs), warm bg, state dots, density-first rows
- **Command bar**: bottom-center floating pill on 3D view (like Spot/Linear), full-width top on data views
- All panels use the brand token set (already built: globals.css v2)

## 5. Execution — Delegated Build
| Task | Scope | Output |
|------|-------|--------|
| **A. Scene Architecture** | Floor, walls, ceiling, glass cabins, doors, windows | `src/lib/office/scene/Architecture.ts` |
| **B. Furniture & Props** | Desks, chairs, monitors, keyboards, plants, mugs, rugs, books | `src/lib/office/scene/Furniture.ts` |
| **C. NPCs v2** | Real-proportion avatars, seated/standing/walking, screen glow, state anims | `src/lib/office/scene/NPC.ts` |
| **D. Lighting & Motion** | Warm/daylight rig, monitor flicker, camera drift, time-of-day | `src/lib/office/scene/Lighting.ts` |
| **E. Integration** | OfficeScene orchestrator, WS wiring, React canvas, perf pass | `src/lib/office/OfficeScene.ts` |

Parent (me): plan, moodboard, wireframe, merge results, verify in browser, redesign UI shell.

## 6. Verification
- [ ] Scene renders with all architecture + furniture + NPCs
- [ ] Animation inventory (10 items) all running
- [ ] Brand palette throughout (warm white, charcoal, #56883E green only)
- [ ] 60 FPS target, no console errors
- [ ] Camera transitions smooth
- [ ] WS agent states drive NPC states
- [ ] UI shell redesigned (left nav, top bar, right panel, command bar)
