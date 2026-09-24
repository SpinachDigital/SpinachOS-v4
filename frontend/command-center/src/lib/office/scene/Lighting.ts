// Lighting: office rig with screen flicker + camera drift — Spinach Labs office v2
// Day mode (default): bright, clearly visible scene. Night mode: moody reference look.
import * as THREE from 'three';

const AMBER = 0xc9a86a;
const SCREEN_BLUE = 0xbfd4e6;

export interface LightingOpts {
  screenMaterials?: THREE.MeshStandardMaterial[];
  cabinCenter?: { x: number; z: number };
}

export interface LightingHandle {
  tick: (t: number) => void;
  setTimeOfDay: (mode: 'day' | 'evening' | 'night') => void;
}

/** Full lighting build — returns tick + time-of-day control */
export function buildLighting(scene: THREE.Scene, opts: LightingOpts = {}): LightingHandle {
  // 1. Ambient — bright enough to see the whole scene
  const ambient = new THREE.AmbientLight(0xf4f1ea, 0.9);
  scene.add(ambient);

  // 2. Hemisphere — sky light fill
  const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x3a352c, 0.7);
  scene.add(hemi);

  // 3. Track spotlights: 3 tracks × 5 spots (only 4 cast shadows for perf)
  const spots: THREE.SpotLight[] = [];
  let shadowCount = 0;
  for (const z of [-8, 0, 8]) {
    for (let i = 0; i < 5; i++) {
      const spot = new THREE.SpotLight(0xfff4e0, 50, 18, 0.6, 0.5);
      spot.position.set(-14 + i * 7, 3.9, z);
      spot.target.position.set(-14 + i * 7, 0, z);
      scene.add(spot.target);
      if (shadowCount < 4) {
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0005;
        shadowCount++;
      }
      spots.push(spot);
      scene.add(spot);
    }
  }

  // 4. Big soft directional — the "window daylight" (main scene readability)
  const daylight = new THREE.DirectionalLight(0xffffff, 1.6);
  daylight.position.set(-10, 25, 15);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.camera.near = 1;
  daylight.shadow.camera.far = 80;
  daylight.shadow.camera.left = -28;
  daylight.shadow.camera.right = 28;
  daylight.shadow.camera.top = 28;
  daylight.shadow.camera.bottom = -28;
  scene.add(daylight);

  // 5. Meeting room pendant (warm) + fill
  const cabin = opts.cabinCenter ?? { x: 13.5, z: 0.5 };
  const pendant = new THREE.PointLight(AMBER, 30, 12);
  pendant.position.set(cabin.x, 3.1, cabin.z);
  scene.add(pendant);
  const pendantFill = new THREE.PointLight(0xe0b060, 12, 10);
  pendantFill.position.set(cabin.x - 1.5, 2.6, cabin.z + 1);
  scene.add(pendantFill);

  // 6. Lounge warm light
  const lounge = new THREE.PointLight(AMBER, 14, 9);
  lounge.position.set(16, 2, 9);
  scene.add(lounge);

  // 7. Baseboard glow accents (cheap, no shadows)
  for (const [x, z] of [
    [12.2, 0.5], // cabin left base
    [0, -14.6],  // back windows center base
    [-3, 9.5],   // data zone base
  ] as const) {
    const glow = new THREE.PointLight(AMBER, 3, 5);
    glow.position.set(x, 0.15, z);
    scene.add(glow);
  }

  // 8. Screen spill lights — blue-white glow onto NPC faces
  const screenMaterials = opts.screenMaterials ?? [];
  const screenPhases = screenMaterials.map(() => Math.random() * Math.PI * 2);
  const spillCount = Math.min(8, screenMaterials.length);
  for (let i = 0; i < spillCount; i++) {
    const spill = new THREE.PointLight(SCREEN_BLUE, 2, 2.5);
    spill.position.set(-14 + (i % 5) * 7 + 1, 1.2, [-8, 0, 8][i % 3] + 0.6);
    scene.add(spill);
  }

  // Time-of-day presets (physical light units — three r155+ uses candela-ish)
  const presets = {
    day: { ambient: 0.9, hemi: 0.7, day: 1.6, spot: 50, pendant: 30, city: 0.2, screenBoost: 0.0, exposure: 1.25 },
    evening: { ambient: 0.55, hemi: 0.4, day: 0.7, spot: 80, pendant: 45, city: 0.5, screenBoost: 0.05, exposure: 1.1 },
    night: { ambient: 0.18, hemi: 0.15, day: 0.0, spot: 110, pendant: 60, city: 0.9, screenBoost: 0.15, exposure: 0.95 },
  };
  let currentMode: keyof typeof presets = 'day';

  const applyMode = (mode: keyof typeof presets) => {
    currentMode = mode;
    const p = presets[mode];
    ambient.intensity = p.ambient;
    hemi.intensity = p.hemi;
    daylight.intensity = p.day;
    daylight.visible = p.day > 0;
    for (const s of spots) s.intensity = p.spot;
    pendant.intensity = p.pendant;
    pendantFill.intensity = p.pendant * 0.4;
    cityLight.intensity = p.city;
  };

  // 9. Window city-glow
  const cityLight = new THREE.DirectionalLight(0x3a4a5c, 0.2);
  cityLight.position.set(0, 6, -20);
  cityLight.target.position.set(0, 0, 0);
  scene.add(cityLight.target);
  scene.add(cityLight);

  applyMode('day');

  const handle: LightingHandle = {
    tick(t: number) {
      const p = presets[currentMode];
      // Screen flicker: sin + per-material phase (cheap)
      for (let i = 0; i < screenMaterials.length; i++) {
        screenMaterials[i].emissiveIntensity =
          0.9 + p.screenBoost + Math.sin(t * 0.0018 + screenPhases[i]) * 0.12;
      }
      // Pendant gentle pulse
      pendant.intensity = p.pendant + Math.sin(t * 0.0012) * p.pendant * 0.08;
      // Ambient breathe
      ambient.intensity = p.ambient + Math.sin(t * 0.0009) * p.ambient * 0.04;
    },
    setTimeOfDay(mode) {
      applyMode(mode);
    },
  };

  return handle;
}

/** Idle camera drift — engages ONLY after 10s of true no-interaction idle.
 *  NEVER overrides user orbit: while interacting (or within 10s of the last
 *  interaction) it does nothing at all, so your angle stays exactly where you
 *  left the drag. Drifts around the CURRENT position, never snaps back to base. */
export function animateCameraDrift(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void; addEventListener?: (ev: string, fn: () => void) => void },
  _basePos: THREE.Vector3
): { tick: (t: number) => void; stop: () => void; markInteraction: () => void } {
  let stopped = false;
  let lastInteraction = performance.now(); // start in "recently used" so drift waits
  let interactive = false;

  if (controls.addEventListener) {
    controls.addEventListener('start', () => {
      interactive = true;
      lastInteraction = performance.now();
    });
    controls.addEventListener('end', () => {
      interactive = false;
      lastInteraction = performance.now();
    });
  }

  const IDLE_MS = 10000;

  return {
    markInteraction() {
      lastInteraction = performance.now();
    },
    tick(t: number) {
      if (stopped) return;
      // Do NOTHING unless the user has been idle 10s — never fight their orbit
      if (interactive || performance.now() - lastInteraction < IDLE_MS) return;

      // Ultra-slow continuous orbit around the CURRENT position
      const angle = Math.atan2(camera.position.x, camera.position.z);
      const radius = Math.hypot(camera.position.x, camera.position.z);
      const y = camera.position.y;
      const newAngle = angle + 0.00004; // ~0.04 rad/s — barely perceptible
      camera.position.set(Math.sin(newAngle) * radius, y + Math.sin(t * 0.000017) * 0.008, Math.cos(newAngle) * radius);
      camera.lookAt(controls.target);
      controls.update();
    },
    stop() {
      stopped = true;
    },
  };
}