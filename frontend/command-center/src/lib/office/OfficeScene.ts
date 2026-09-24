// OfficeScene v2: orchestrator — assembles Architecture + Furniture + NPC + Lighting
// Spinach Labs office — digital-twin with full animation loop, day/night modes, theme-aware
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildArchitecture } from './scene/Architecture';
import { buildFurniture } from './scene/Furniture';
import { buildNPCs, Person, DEFAULT_NPC_CONFIG, type NPCBuildConfig } from './scene/NPC';
import { buildLighting, animateCameraDrift, type LightingHandle } from './scene/Lighting';

export type SceneTheme = 'dark' | 'light';

const THEME_BG: Record<SceneTheme, number> = {
  dark: 0x0a0a0a,
  light: 0xe9e6df, // warm white sky behind the office
};

export class OfficeScene {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;
  container!: HTMLElement;
  people: Person[] = [];
  foliages: THREE.Group[] = [];
  lighting!: LightingHandle;
  drift!: ReturnType<typeof animateCameraDrift>;
  animationId: number | null = null;
  ws: WebSocket | null = null;
  disposed = false;
  clock = new THREE.Clock();
  theme: SceneTheme = 'dark';

  constructor(container: HTMLElement) {
    this.container = container;
    this.initThree();
    buildArchitecture(this.scene);

    const { screenMaterials, foliages } = buildFurniture(this.scene);
    this.foliages = foliages;
    this.lighting = buildLighting(this.scene, {
      screenMaterials,
      cabinCenter: { x: 13.5, z: 0.5 },
    });

    this.people = buildNPCs(this.scene, DEFAULT_NPC_CONFIG as NPCBuildConfig);

    this.setupWebSocket();
    this.createZoneBoxes();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEME_BG.dark);
    // NO fog — it was eating the far half of the scene

    const w = this.container.clientWidth || 1200;
    const h = this.container.clientHeight || 700;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    // Cutaway view: camera BELOW the ceiling line (ceiling at y=4) looking down
    // into the office interior — sees desks/NPCs, not the blank roof slab.
    this.camera.position.set(-14, 3.5, 20);
    this.camera.lookAt(0, 0.8, -2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // Polar limits: keep camera ABOVE the floor but BELOW the ceiling line —
    // never looking at the blank roof from above, never under the floor.
    this.controls.maxPolarAngle = Math.PI / 2.1;   // ~86° — near-horizontal max
    this.controls.minPolarAngle = 0.35;            // ~20° from vertical — high but inside
    this.controls.minDistance = 8;
    this.controls.maxDistance = 45;
    this.controls.target.set(0, 0.5, -2);

    window.addEventListener('resize', this.onResize);

    // Camera idle drift (pauses on interaction, never snaps back)
    this.drift = animateCameraDrift(
          this.camera,
          this.controls as unknown as { target: THREE.Vector3; update: () => void; addEventListener?: (ev: string, fn: () => void) => void },
          new THREE.Vector3(-14, 3.5, 20)
        );

        // Department zone click interaction
        this.setupZoneInteraction();
      }

  /** Toggle light/dark scene theme */
  setTheme(theme: SceneTheme) {
    this.theme = theme;
    const bg = THEME_BG[theme];
    (this.scene.background as THREE.Color).setHex(bg);
    // Light mode: bright daylight rig; dark mode: evening mood
    this.lighting.setTimeOfDay(theme === 'light' ? 'day' : 'evening');
    this.renderer.toneMappingExposure = theme === 'light' ? 1.35 : 1.1;
  }

  setupWebSocket() {
    if (this.disposed) return;
    // API WebSocket is on port 4000
    const wsUrl = `ws://localhost:4000/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };
    this.ws.onclose = () => {
      if (!this.disposed) {
        setTimeout(() => this.setupWebSocket(), 5000);
      }
    };
  }

  handleMessage(msg: { event: string; data: Record<string, string> }) {
    if (msg.event === 'agent_state') {
      const person = this.people.find((p) => p.id === msg.data.agent);
      if (person) person.setState(msg.data.state as 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked');
    }
  }

  animate = () => {
    if (this.disposed) return;
    this.animationId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const t = performance.now();

    // Lighting: screen flicker, pendant pulse, ambient breathe
    this.lighting.tick(t);

    // Camera idle drift
    this.drift.tick(t);

    // NPC state anims + blink
    for (const p of this.people) p.update(delta);

    // Foliage sway (very subtle)
    for (let i = 0; i < this.foliages.length; i++) {
      this.foliages[i].rotation.z = Math.sin(t * 0.0004 + i) * 0.02;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** Fly the camera to a person (click-to-focus from UI panel) */
  focusPerson(id: string) {
    const person = this.people.find((p) => p.id === id);
    if (!person) return;
    const target = person.mesh.position.clone();
    const camPos = target.clone().add(new THREE.Vector3(1.5, 1.4, 2.5));
    this.camera.position.copy(camPos);
    this.controls.target.copy(target);
  }

  dispose() {
    this.disposed = true;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.drift.stop();
    window.removeEventListener('click', this.onCanvasClick);
    this.ws?.close();
    for (const p of this.people) p.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    window.removeEventListener('resize', this.onResize);
  }

  private onCanvasClick = (event: MouseEvent) => {
    if (!this.container.contains(event.target as Node)) return;
    this.raycastZone(event);
  };

  private setupZoneInteraction() {
    this.onCanvasClick = this.onCanvasClick.bind(this);
    window.addEventListener('click', this.onCanvasClick);
  }

  private zoneBoxes: THREE.Mesh[] = [];

  private createZoneBoxes() {
    // Create invisible click boxes for each department zone
    const zones = [
      { id: 'ceo', name: 'Strategy & Consulting', bounds: { x: [-18, -10], z: [-8, 4] } },
      { id: 'cto', name: 'Strategy & Consulting', bounds: { x: [-18, -10], z: [-2, 8] } },
      { id: 'content', name: 'Content & Creative', bounds: { x: [-8, 8], z: [-14, -8] } },
      { id: 'sales', name: 'Campaigns & Media', bounds: { x: [8, 18], z: [-14, -8] } },
      { id: 'design', name: 'Web & Tech', bounds: { x: [-18, -10], z: [0, 8] } },
      { id: 'engineering', name: 'Data & Analytics', bounds: { x: [-8, 8], z: [0, 8] } },
    ];

    const mat = new THREE.MeshBasicMaterial({ visible: false });
    for (const zone of zones) {
      const geo = new THREE.BoxGeometry(
        zone.bounds.x[1] - zone.bounds.x[0],
        3,
        zone.bounds.z[1] - zone.bounds.z[0]
      );
      const box = new THREE.Mesh(geo, mat);
      box.position.set(
        (zone.bounds.x[0] + zone.bounds.x[1]) / 2,
        1.5,
        (zone.bounds.z[0] + zone.bounds.z[1]) / 2
      );
      box.userData = { zoneId: zone.id, zoneName: zone.name };
      this.zoneBoxes.push(box);
      this.scene.add(box);
    }
  }

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private raycastZone(event: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.zoneBoxes);

    if (intersects.length > 0) {
      const zone = intersects[0].object.userData;
      this.drift?.markInteraction?.(); // pause drift
      window.dispatchEvent(new CustomEvent('office-zone-click', {
        detail: { zoneId: zone.zoneId, zoneName: zone.zoneName }
      }));
    }
  }
}