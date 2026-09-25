# Spinach Office Diorama — embeddable module

Procedural 3D Spinach Labs office (141 components: reception, CEO cabin, research,
lounge, engineering, marketing, design, operations, clients room, cafe, plants,
NPC staff, walkers, pendant lighting). Zero image assets — everything is code.

**No iframe.** Import it as a native ES module inside the Next.js app.

## Install (Hermes)

```bash
cd frontend/command-center
npm i three
# copy this whole office-diorama/ dir to src/lib/office-diorama/
```

## React wrapper (Hermes writes this)

```tsx
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOfficeViewer } from '@/lib/office-diorama/src/viewer';

export default function DioramaViewer({ agentStates, onZoneClick }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const v = createOfficeViewer(ref.current!, {
      THREE, OrbitControls,
      lighting: 'evening',          // 'day' | 'evening' | 'night'
      onZoneClick,                 // (zoneId, label) => void
    });
    viewerRef.current = v;
    return () => v.dispose();      // strict-mode safe
  }, []);

  useEffect(() => {
    viewerRef.current?.setAgentStates(agentStates);
  }, [agentStates]);

  return <div ref={ref} className="w-full h-full" />;
}
```

Wire `agentStates` from the existing WS feed (`useWebSocket` → agentStates):
map `active/busy/idle/offline` per agent key:
`engineering, social, designer, orchestrator, ceo, research, sales`.
Unknown keys are ignored.

## API

`createOfficeViewer(container, options)` → viewer

| method | description |
|---|---|
| `setAgentStates({ engineering: 'active', ... })` | color/pulse the zone beacons |
| `setLighting('day' \| 'evening' \| 'night')` | lighting preset |
| `setPreset('aerial' \| 'overview' \| 'reception' \| 'desks' \| 'lounge' \| 'cafe' \| 'topdown')` | camera preset |
| `setZoneVisible(zoneId, bool)` | show/hide a zone |
| `listZones()` | zone ids |
| `listAgents()` | agents with beacons |
| `dispose()` | cancel RAF, remove listeners, free GPU memory |

Options: `{ THREE, OrbitControls, lighting, preset, showLabels, walkers, autoRotate, onZoneClick }`.

## Notes

- `src/textures.js`, `src/models.js`, `src/office.js` are the original procedural
  sources (unchanged). `src/viewer.js` is the embeddable entry (replaces the old
  single-file `main.js`, no lil-gui, no globals).
- Renderer sizes to the container via ResizeObserver. Give the wrapper div an
  explicit height (e.g. `h-[600px]`).
- Beacons: glowing floor rings at each agent zone center. active = green pulse,
  busy = amber slow pulse, idle = grey dim, offline = hidden.
