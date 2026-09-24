# 3D Office Fixes + Live Department Interaction — Plan

## Current Issues
1. **Camera still seeing roof** — Despite position change, the drift's `basePos` (-16,9,22) may still be treated as "base" by legacy code paths, or the polar limits aren't enforced correctly.
2. **No live department click** — Zone tags are visual only; need click-to-focus with live WS data overlay.
3. **Blank walls/floors** — Plain colored MeshStandardMaterial; needs architectural realism (concrete texture, wall baseboards, window frames, floor planks, carpet tiles).
4. **No live data binding** — NPC states driven by WS `agent_state` but department panels don't show task details.

---

## Fix Plan (ordered by impact)

### 1. Camera Hard Lock (today)
- **Remove basePos entirely** from drift — drift only orbits current position, never references base.
- **Enforce polar limits in OrbitControls** as hard min/max (already added: minPolarAngle 0.35, maxPolarAngle ~1.49 rad). Verify they're not being overridden.
- **Remove ceiling from view frustum** — the ceiling mesh at y=4 is opaque; either make it semi-transparent from below, or cull it when camera.y < 5.
- **Camera start**: (-14, 7, 20) → lookAt(0, 0.8, -2). Lower, closer, wider view of the floor plate.

### 2. Department Click → Live Panel (today)
- **Raycast on click** in OfficeScene: intersect invisible department zone boxes → get zone id.
- **Emit custom event** `office-zone-click` with `{ zoneId, agentIds[] }`.
- **Page listens** → opens right panel with live agent list + current task + recent activity from WS feed filtered by agent.
- **Highlight** zone with a subtle glow ring while panel open.

### 3. Architectural Materials (today)
- **Floor**: Polished concrete procedural (noise + subtle color variation) OR tiled carpet tiles (dark grey, 0.6×0.6m) with slight height variation.
- **Walls**: Concrete texture (procedural) + baseboard trim (0.15m high, dark charcoal) + chair rail line.
- **Windows**: Framed mullions (already), glass with subtle reflectivity + city cubemap reflection.
- **Ceiling**: Keep but make **transparent from below** (side: THREE.BackSide, opacity 0.3) so camera inside never hits black slab.
- **Partitions**: Low fabric dividers between desk clusters (0.04m thick, 1.2m high, muted fabric color).
- **Desk tops**: Wood veneer procedural (anisotropic highlight).

### 4. Live Department Data Binding (next)
- **API contract**: `/api/v1/department/:id/status` → `{ agents: [{ id, state, currentTask, progress }], tasks: [...], recentActivity: [...] }`
- **Mock fallback** (if API down): derive from `agentStates` + `feed` filtered by department agent IDs.
- **Right panel** shows: agent cards (name, state, current task, progress bar), task list, recent activity.

---

## Execution Order
| Step | File(s) | Description |
|------|---------|-------------|
| 1 | `Lighting.ts` | Remove basePos from drift; add `markInteraction` called from click handler |
| 2 | `OfficeScene.ts` | Camera start pos (-14,7,20); polar limits; ceiling BackSide transparent; raycast click → event |
| 3 | `Architecture.ts` | Floor procedural; walls baseboard/chair-rail; ceiling BackSide + low opacity; window mullions refined; partition dividers |
| 4 | `page.tsx` | Right panel shows live department data; click zone → panel opens with agent/task list |
| 4 | `CommandGateway.tsx` | Already has voice/text — keep as-is |

---

## Acceptance Criteria
- [ ] Camera starts inside the office (y≈7), looking at desks — **no roof visible** even when dragging up
- [ ] Polar limits enforced: can't tilt up into roof, can't go under floor
- [ ] Click a department zone → right panel opens with live agent cards + current task
- [ ] Floor has visible texture/planks; walls have baseboards; windows have frames; ceiling invisible from inside
- [ ] Drift never snaps back; only orbits after 10s true idle

---

Shall I start with Step 1 (camera hard lock + drift fix) + Step 3 (materials)?