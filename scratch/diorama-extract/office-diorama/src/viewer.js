/* Spinach Labs 3D office — embeddable viewer module (no iframe).
 *
 * Usage (React):
 *   import * as THREE from 'three';
 *   import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
 *   import { createOfficeViewer } from './office-diorama/src/viewer.js';
 *
 *   const viewer = createOfficeViewer(containerRef.current, {
 *     THREE, OrbitControls,
 *     lighting: 'evening',
 *     onZoneClick: (zoneId, label) => console.log('zone', zoneId),
 *   });
 *   viewer.setAgentStates({ engineering: 'active', social: 'busy', designer: 'idle' });
 *   ...
 *   viewer.dispose(); // on unmount
 *
 * Agent states: 'active' | 'busy' | 'idle' | 'offline'
 * Zone ids: shell, reception, ceo-cabin, research-cabin, lounge, engineering,
 *           marketing, design, operations, clients, cafe
 */
import { buildOffice } from './office.js';

const PRESETS = {
  'aerial':    { p: [36, 32, 42],  t: [0, 0, -2] },
  'overview':  { p: [-17, 3.8, 15], t: [10, 1, -10] },
  'reception': { p: [-6, 3.2, 19],  t: [-16, 1.4, 11] },
  'desks':     { p: [4, 2.6, 13],   t: [4, 1, 0.5] },
  'lounge':    { p: [-1, 3.2, 10.5], t: [-8, 1, 3] },
  'cafe':      { p: [13, 3.2, 13],  t: [21, 1.2, 7] },
  'topdown':   { p: [0, 58, 0.1],   t: [0, 0, 0] },
};

// Spinach OS agent -> diorama zone
const AGENT_ZONES = {
  engineering:  'engineering',
  social:       'marketing',
  designer:     'design',
  orchestrator: 'operations',
  ceo:          'ceo-cabin',
  research:     'research-cabin',
  sales:        'clients',
};

const STATE_COLORS = {
  active:  0x22c55e,  // green pulse
  busy:    0xf59e0b,  // amber slow pulse
  idle:    0x6b7280,  // grey dim static
  offline: 0x1a1a1a,  // near-invisible
};

export function createOfficeViewer(container, options = {}) {
  const THREE = options.THREE;
  const OrbitControls = options.OrbitControls;
  if (!THREE || !OrbitControls) {
    throw new Error('createOfficeViewer: pass { THREE, OrbitControls } in options');
  }
  const onZoneClick = options.onZoneClick || null;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1420);
  scene.fog = new THREE.Fog(0x0e1420, 80, 160);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.maxDistance = 120;
  if (options.autoRotate) controls.autoRotate = true;

  const office = buildOffice();
  scene.add(office.root);

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7f70, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
  sun.position.set(24, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 90;
  scene.add(sun);
  const pendantLights = [];
  for (const [x, z] of [[4, 0.6], [4, 4.6], [13.5, 2.6], [4.5, -11], [-14.5, 12.3], [21, 7]]) {
    const pl = new THREE.PointLight(0xffd9a0, 12, 14, 1.8);
    pl.position.set(x, 3.3, z);
    scene.add(pl); pendantLights.push(pl);
  }

  /* ---------- agent-state beacons ---------- */
  // One glowing ring per agent zone, laid on the floor at zone center.
  const beacons = {}; // agent -> { mesh, state }
  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();
  for (const [agent, zoneId] of Object.entries(AGENT_ZONES)) {
    const zg = office.zones[zoneId];
    if (!zg) continue;
    tmpBox.setFromObject(zg).getCenter(tmpCenter);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.5, 48),
      new THREE.MeshBasicMaterial({
        color: STATE_COLORS.idle, transparent: true, opacity: 0.55,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(tmpCenter.x, 0.03, tmpCenter.z);
    ring.userData.agent = agent;
    ring.userData.zoneId = zoneId;
    scene.add(ring);
    // soft inner disc
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 48),
      new THREE.MeshBasicMaterial({
        color: STATE_COLORS.idle, transparent: true, opacity: 0.14,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(tmpCenter.x, 0.025, tmpCenter.z);
    scene.add(disc);
    beacons[agent] = { ring, disc, state: 'idle', phase: Math.random() * Math.PI * 2 };
  }

  function setAgentStates(states) {
    for (const [agent, st] of Object.entries(states || {})) {
      const b = beacons[agent];
      if (!b || !STATE_COLORS[st]) continue;
      b.state = st;
      const c = STATE_COLORS[st];
      b.ring.material.color.setHex(c);
      b.disc.material.color.setHex(c);
      const vis = st !== 'offline';
      b.ring.visible = vis;
      b.disc.visible = vis;
    }
  }

  /* ---------- lighting presets ---------- */
  let lightingMode = 'day';
  function setLighting(mode) { // 'day' | 'evening' | 'night'
    lightingMode = mode;
    if (mode === 'day') {
      sun.intensity = 1.6; hemi.intensity = 0.75;
      scene.background.set(0xdfe7ec); scene.fog.color.set(0xdfe7ec);
      pendantLights.forEach(l => l.intensity = 12);
      renderer.toneMappingExposure = 1.1;
    } else if (mode === 'evening') {
      sun.intensity = 0.25; hemi.intensity = 0.3;
      scene.background.set(0x0e1420); scene.fog.color.set(0x0e1420);
      pendantLights.forEach(l => l.intensity = 30);
      renderer.toneMappingExposure = 1.0;
    } else { // night
      sun.intensity = 0.05; hemi.intensity = 0.12;
      scene.background.set(0x05080f); scene.fog.color.set(0x05080f);
      pendantLights.forEach(l => l.intensity = 42);
      renderer.toneMappingExposure = 0.95;
    }
  }

  /* ---------- camera presets ---------- */
  function setPreset(name) {
    const pr = PRESETS[name];
    if (!pr) return;
    camera.position.set(...pr.p);
    controls.target.set(...pr.t);
    controls.update();
  }

  /* ---------- zone click ---------- */
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function findZone(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.zone) return o.userData.zone;
      if (o.userData && o.userData.isZone) return o.userData.id;
      o = o.parent;
    }
    return null;
  }
  function onClick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(office.root.children, true);
    if (!hits.length || !onZoneClick) return;
    const zoneId = findZone(hits[0].object);
    if (zoneId) {
      const zg = office.zones[zoneId];
      onZoneClick(zoneId, zg ? zg.userData.label : zoneId);
    }
  }
  renderer.domElement.addEventListener('click', onClick);

  /* ---------- sizing ---------- */
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* ---------- animation ---------- */
  const clock = new THREE.Clock();
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    // floating dept labels
    office.labels.forEach((l, i) => {
      l.position.y = (l.userData.baseY || 3.5) + Math.sin(t * 1.2 + i) * 0.15;
    });
    // walkers
    for (const w of office.walkers) {
      const pts = w.pts;
      const a = pts[w.seg], b = pts[(w.seg + 1) % pts.length];
      const segLen = a.distanceTo(b);
      w.t += (w.speed * 0.016) / segLen;
      if (w.t >= 1) { w.t = 0; w.seg = (w.seg + 1) % pts.length; continue; }
      w.g.position.lerpVectors(a, b, w.t);
      const dir = b.clone().sub(a).normalize();
      w.g.rotation.y = Math.atan2(dir.x, dir.z);
      w.g.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
    }
    // beacon pulses
    for (const b of Object.values(beacons)) {
      if (b.state === 'active') {
        const s = 1 + Math.sin(t * 3 + b.phase) * 0.12;
        b.ring.scale.set(s, s, 1);
        b.ring.material.opacity = 0.55 + Math.sin(t * 3 + b.phase) * 0.2;
      } else if (b.state === 'busy') {
        const s = 1 + Math.sin(t * 1.2 + b.phase) * 0.06;
        b.ring.scale.set(s, s, 1);
        b.ring.material.opacity = 0.45;
      } else {
        b.ring.scale.set(1, 1, 1);
        b.ring.material.opacity = b.state === 'idle' ? 0.3 : 0.0;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  /* ---------- init ---------- */
  setLighting(options.lighting || 'evening');
  setPreset(options.preset || 'aerial');
  if (options.showLabels === false) office.labels.forEach(l => { l.visible = false; });
  if (options.walkers === false && office.zones.walkers) office.zones.walkers.visible = false;
  resize();
  animate();

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.domElement.removeEventListener('click', onClick);
    controls.dispose();
    scene.traverse(o => {
      if (o.isMesh) {
        o.geometry && o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
            m.map && m.map.dispose();
            m.dispose();
          });
        }
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return {
    setAgentStates,
    setLighting,
    setPreset,
    setZoneVisible(zone, v) { if (office.zones[zone]) office.zones[zone].visible = v; },
    listZones() { return Object.keys(office.zones); },
    listAgents() { return Object.keys(beacons); },
    dispose,
  };
}

export { PRESETS, AGENT_ZONES };
