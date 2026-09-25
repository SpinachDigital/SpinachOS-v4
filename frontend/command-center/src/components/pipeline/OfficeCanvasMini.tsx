import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

// We'll reuse the same NPCConfig and RoomConfig from the OfficeScene, but we'll define a simplified version here
// for the mini version. In a real app, we might share these types via a shared file.

type NPCState = 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';

interface NPCConfig {
  profile: string;
  room: string;
  position: THREE.Vector3;
  rotation: number;
  personality: string;
}

interface RoomConfig {
  id: string;
  name: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: number;
  npcProfile: string;
}

// Room configurations (same as in OfficeScene)
const ROOMS: RoomConfig[] = [
  { id: 'ceo-room', name: 'CEO Room', position: new THREE.Vector3(-15, 0, 0), size: new THREE.Vector3(10, 4, 10), color: 0x1a1a2e, npcProfile: 'ceo' },
  { id: 'cto-room', name: 'CTO Room', position: new THREE.Vector3(15, 0, 0), size: new THREE.Vector3(10, 4, 10), color: 0x16213e, npcProfile: 'cto' },
  { id: 'sales-room', name: 'Sales Room', position: new THREE.Vector3(0, 0, -15), size: new THREE.Vector3(12, 4, 8), color: 0x0f3460, npcProfile: 'sales' },
  { id: 'content-studio', name: 'Content Studio', position: new THREE.Vector3(-12, 0, 12), size: new THREE.Vector3(8, 4, 8), color: 0x1a1a2e, npcProfile: 'content' },
  { id: 'design-studio', name: 'Design Studio', position: new THREE.Vector3(12, 0, 12), size: new THREE.Vector3(8, 4, 8), color: 0x16213e, npcProfile: 'design' },
  { id: 'engineering-lab', name: 'Engineering Lab', position: new THREE.Vector3(0, 0, 15), size: new THREE.Vector3(12, 4, 8), color: 0x0f3460, npcProfile: 'engineering' },
  { id: 'ops-room', name: 'Ops Control', position: new THREE.Vector3(0, 0, 0), size: new THREE.Vector3(14, 4, 14), color: 0x1a1a2e, npcProfile: 'ops' },
];

// NPC configurations (same as in OfficeScene)
const NPC_CONFIGS: NPCConfig[] = [
  { profile: 'ceo', room: 'ceo-room', position: new THREE.Vector3(-15, 1, 0), rotation: 0, personality: 'calm-strategist' },
  { profile: 'cto', room: 'cto-room', position: new THREE.Vector3(15, 1, 0), rotation: Math.PI, personality: 'focused-planner' },
  { profile: 'sales', room: 'sales-room', position: new THREE.Vector3(0, 1, -15), rotation: Math.PI / 2, personality: 'active-scanner' },
  { profile: 'content', room: 'content-studio', position: new THREE.Vector3(-12, 1, 12), rotation: -Math.PI / 4, personality: 'writer' },
  { profile: 'design', room: 'design-studio', position: new THREE.Vector3(12, 1, 12), rotation: Math.PI / 4, personality: 'sketcher' },
  { profile: 'engineering', room: 'engineering-lab', position: new THREE.Vector3(0, 1, 15), rotation: Math.PI, personality: 'builder' },
  { profile: 'ops', room: 'ops-room', position: new THREE.Vector3(2, 1, 2), rotation: -Math.PI / 2, personality: 'monitor' },
];

// Simplified OfficeScene for the mini version
class MiniOfficeScene {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  controls!: OrbitControls;
  rooms: Map<string, THREE.Group> = new Map();
  npcs: Map<string, NPCAvatar> = new Map();
  animationId: number | null = null;
  ws: WebSocket | null = null;

  constructor(container: HTMLElement) {
    this.initThree(container);
    this.createOffice();
    this.createNPCs();
    this.setupWebSocket();
    this.animate();
  }

  initThree(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
    this.scene.fog = new THREE.Fog(0x0a0a0a, 20, 60);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    // Disable panning and zooming for the mini version? We'll leave it enabled for now.

    // Lights
    this.setupLights();

    // Resize
    window.addEventListener('resize', () => this.onResize(container));
  }

  setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x222222, 0.5);
    this.scene.add(ambient);

    // Main directional (moonlight)
    const mainLight = new THREE.DirectionalLight(0x444455, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    this.scene.add(mainLight);

    // Spinach green accent lights
    const accentColor = new THREE.Color(0x56883E);
    ROOMS.forEach((room, i) => {
      const light = new THREE.PointLight(accentColor, 0.2, 10, 2);
      light.position.copy(room.position).add(new THREE.Vector3(0, 3, 0));
      this.scene.add(light);
    });
  }

  createOffice() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50, 50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d0d0d,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid lines on floor (optional, can be removed for performance)
    const gridHelper = new THREE.GridHelper(50, 50, 0x1a1a2e, 0x0f0f0f);
    this.scene.add(gridHelper);

    // Rooms
    ROOMS.forEach((roomConfig) => {
      const room = this.createRoom(roomConfig);
      room.position.copy(roomConfig.position);
      this.scene.add(room);
      this.rooms.set(roomConfig.id, room);
    });

    // We'll skip creating corridors and central hub for the mini version to keep it simple and focused on the NPCs.
  }

  createRoom(config: RoomConfig): THREE.Group {
    const group = new THREE.Group();
    const { size, color } = config;

    // Floor
    const floorGeo = new THREE.BoxGeometry(size.x, 0.1, size.z);
    const floorMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    group.add(floor);

    // Walls (simplified: just four walls, no doorways)
    const wallHeight = size.y;
    const wallThickness = 0.2;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(1.3),
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });

    const walls = [
      { pos: new THREE.Vector3(0, wallHeight / 2, -size.z / 2), rot: 0 }, // front
      { pos: new THREE.Vector3(0, wallHeight / 2, size.z / 2), rot: Math.PI }, // back
      { pos: new THREE.Vector3(-size.x / 2, wallHeight / 2, 0), rot: Math.PI / 2 }, // left
      { pos: new THREE.Vector3(size.x / 2, wallHeight / 2, 0), rot: -Math.PI / 2 }, // right
    ];

    walls.forEach((wall) => {
      const wallGeo = new THREE.BoxGeometry(size.x, wallHeight, wallThickness);
      const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
      wallMesh.position.copy(wall.pos);
      wallMesh.rotation.y = wall.rot;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
    });

    // Room label (optional, can be removed for performance)
    const label = this.createRoomLabel(config.name);
    label.position.set(0, size.y + 0.3, 0);
    group.add(label);

    return group;
  }

  createRoomLabel(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'var(--green)';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 64, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 0.75, 1);
    sprite.renderOrder = 1;
    return sprite;
  }

  createNPCs() {
    NPC_CONFIGS.forEach((config) => {
      const npc = new NPCAvatar(config, this.scene);
      this.npcs.set(config.profile, npc);
    });
  }

  setupWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => console.log('Mini Office WS connected');
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleWebSocketMessage(msg);
      } catch (e) {
        console.error('Mini Office WS parse error:', e);
      }
    };
    this.ws.onerror = (e) => console.error('Mini Office WS error:', e);
    this.ws.onclose = () => {
      console.log('Mini Office WS closed, reconnecting in 5s...');
      setTimeout(() => this.setupWebSocket(), 5000);
    };
  }

  handleWebSocketMessage(msg: any) {
    switch (msg.event) {
      case 'agent_state':
        const npc = this.npcs.get(msg.data.agent);
        if (npc) npc.setState(msg.data.state, msg.data.activity);
        break;
      // We ignore other messages for the mini version to keep it lightweight
    }
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Animate NPCs
    this.npcs.forEach((npc) => npc.update());

    // Controls
    this.controls.update();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  onResize(container: HTMLElement) {
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.ws?.close();
    this.renderer.dispose();
    this.controls.dispose();
  }
}

// We'll reuse the same NPCAvatar class from the OfficeScene, but we'll define a simplified version here if needed.
// For now, we'll just copy the NPCAvatar class from the OfficeScene (same as before) but we can make it simpler if desired.
// However, to avoid duplication, we'll note that in a real app we would share this class.
// For the purpose of this task, we'll include a simplified version of NPCAvatar that is lighter.

class NPCAvatar {
  profile: string;
  room: string;
  personality: string;
  state: NPCState = 'idle';
  activity: string = 'Waiting...';
  mesh: THREE.Group;
  scene: THREE.Scene;
  idleAnimation: gsap.core.Timeline | null = null;
  activityLabel: THREE.Sprite | null = null;
  stateIndicator: THREE.Mesh | null = null;
  eyes: THREE.Mesh[] = [];
  accentRing: THREE.Mesh | null = null;
  leftArm!: THREE.Mesh;
  rightArm!: THREE.Mesh;
  labelCanvas!: HTMLCanvasElement;
  labelCtx!: CanvasRenderingContext2D;

  constructor(config: NPCConfig, scene: THREE.Scene) {
    this.profile = config.profile;
    this.room = config.room;
    this.personality = config.personality;
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.mesh.position.copy(config.position);
    this.mesh.rotation.y = config.rotation;
    this.createAvatar();
    this.createStateIndicator();
    this.createActivityLabel();
    this.startIdleAnimation();
    scene.add(this.mesh);
  }

  createAvatar() {
    // Simplified avatar: just a capsule for body and a sphere for head
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.6,
      metalness: 0.1,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x56883E,
      roughness: 0.3,
      metalness: 0.5,
      emissive: new THREE.Color(0x56883E),
      emissiveIntensity: 0.2,
    });

    // Torso
    const torsoGeo = new THREE.CapsuleGeometry(0.3, 1.0, 8, 16);
    const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
    torso.position.y = 1.0;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const head = new THREE.Mesh(headGeo, bodyMaterial);
    head.position.y = 1.8;
    head.castShadow = true;
    this.mesh.add(head);

    // Eyes (simple)
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x56883E, transparent: true, opacity: 0.8 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 1.85, 0.2);
    this.mesh.add(leftEye);
    this.eyes.push(leftEye);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.08;
    this.mesh.add(rightEye);
    this.eyes.push(rightEye);

    // Shoulders (simple)
    const shoulderGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const leftShoulder = new THREE.Mesh(shoulderGeo, bodyMaterial);
    leftShoulder.position.set(-0.35, 1.3, 0);
    leftShoulder.scale.set(1, 0.5, 1);
    this.mesh.add(leftShoulder);
    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.x = 0.35;
    this.mesh.add(rightShoulder);

    // Arms (simple)
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.6, 6, 12);
    this.leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    this.leftArm.position.set(-0.25, 1.0, 0);
    this.leftArm.rotation.z = 0.15;
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    this.rightArm.position.set(0.25, 1.0, 0);
    this.rightArm.rotation.z = -0.15;
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Accent line on torso
    const accentGeo = new THREE.RingGeometry(0.32, 0.35, 12);
    const accent = new THREE.Mesh(accentGeo, accentMaterial);
    accent.position.set(0, 1.1, 0.33);
    accent.rotation.x = -Math.PI / 2;
    this.mesh.add(accent);
    this.accentRing = accent;
  }

  createStateIndicator() {
    const geo = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x56883E,
      transparent: true,
      opacity: 0.8
    });
    this.stateIndicator = new THREE.Mesh(geo, mat);
    this.stateIndicator.position.set(0, 2.2, 0);
    this.mesh.add(this.stateIndicator);

    gsap.to(this.stateIndicator.scale, {
      x: 1.2, y: 1.2, z: 1.2,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
    });
  }

  createActivityLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    this.labelCanvas = canvas;
    this.labelCtx = canvas.getContext('2d')!;
    this.updateLabel('Idle');

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    this.activityLabel = new THREE.Sprite(material);
    this.activityLabel.position.set(0, 2.5, 0);
    this.activityLabel.scale.set(4, 0.5, 1);
    this.activityLabel.renderOrder = 1;
    this.mesh.add(this.activityLabel);
  }

  updateLabel(text: string) {
    if (!this.labelCanvas || !this.labelCtx) return;
    const ctx = this.labelCtx;
    const canvas = this.labelCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'var(--green)';
    ctx.font = '500 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    if (this.activityLabel) {
      (this.activityLabel.material as THREE.SpriteMaterial).map!.needsUpdate = true;
    }
  }

  setState(state: NPCState, activity?: string) {
    this.state = state;
    this.activity = activity || this.getDefaultActivity(state);
    this.updateLabel(this.activity);
    this.updateStateColor();
    this.transitionAnimation(state);
  }

  getDefaultActivity(state: NPCState): string {
    const activities: Record<NPCState, string> = {
      idle: 'Monitoring...',
      thinking: 'Analyzing...',
      working: 'Executing task...',
      speaking: 'Communicating...',
      blocked: 'Awaiting input...',
    };
    return activities[state] || 'Idle';
  }

  updateStateColor() {
    const colors: Record<NPCState, number> = {
      idle: 0x56883E,
      thinking: 0xFF9800,
      working: 0x2196F3,
      speaking: 0x9C27B0,
      blocked: 0xF44336,
    };
    const color = colors[this.state] || 0x56883E;

    if (this.stateIndicator) {
      (this.stateIndicator.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
    if (this.eyes) {
      this.eyes.forEach(eye => {
        (eye.material as THREE.MeshBasicMaterial).color.setHex(color);
      });
    }
    if (this.accentRing) {
      (this.accentRing.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    }
  }

  transitionAnimation(state: NPCState) {
    if (this.idleAnimation) {
      this.idleAnimation.kill();
      this.idleAnimation = null;
    }

    switch (state) {
      case 'idle':
        this.startIdleAnimation();
        break;
      case 'thinking':
        this.animateThinking();
        break;
      case 'working':
        this.animateWorking();
        break;
      case 'speaking':
        this.animateSpeaking();
        break;
      case 'blocked':
        this.animateBlocked();
        break;
    }
  }

  startIdleAnimation() {
    this.idleAnimation = gsap.timeline({ repeat: -1, yoyo: true })
      .to(this.mesh.position, { y: '+=0.02', duration: 2, ease: 'power1.inOut' })
      .to(this.mesh.rotation, { y: '+=0.01', duration: 3, ease: 'power1.inOut' }, 0)
      .to(this.eyes[0].scale, { y: 0.3, duration: 0.1, repeat: 1, yoyo: true }, 1.5)
      .to(this.eyes[1].scale, { y: 0.3, duration: 0.1, repeat: 1, yoyo: true }, 1.5);
  }

  animateThinking() {
    gsap.to(this.mesh.rotation, { y: '+=0.1', duration: 0.5, ease: 'power2.out' });
    gsap.to(this.leftArm.rotation, { x: -1.0, z: 0.4, duration: 0.5, ease: 'power2.out' });
    gsap.to(this.rightArm.rotation, { x: -0.2, z: -0.2, duration: 0.5, ease: 'power2.out' });

    this.idleAnimation = gsap.timeline({ repeat: -1 })
      .to(this.eyes[0].scale, { y: 0.1, duration: 0.15, ease: 'power2.inOut' })
      .to(this.eyes[0].scale, { y: 1, duration: 0.15, ease: 'power2.inOut' })
      .to(this.eyes[1].scale, { y: 0.1, duration: 0.15, ease: 'power2.inOut' }, 0)
      .to(this.eyes[1].scale, { y: 1, duration: 0.15, ease: 'power2.inOut' }, 0)
      .to({}, { duration: 2 });
  }

  animateWorking() {
    gsap.to(this.leftArm.rotation, { x: -0.6, z: 0.2, duration: 0.3, ease: 'power2.out' });
    gsap.to(this.rightArm.rotation, { x: -0.6, z: -0.2, duration: 0.3, ease: 'power2.out' });

    this.idleAnimation = gsap.timeline({ repeat: -1 })
      .to(this.leftArm.rotation, { x: -0.7, duration: 0.08, ease: 'power1.inOut' })
      .to(this.leftArm.rotation, { x: -0.5, duration: 0.08, ease: 'power1.inOut' })
      .to(this.rightArm.rotation, { x: -0.7, duration: 0.08, ease: 'power1.inOut' }, 0.04)
      .to(this.rightArm.rotation, { x: -0.5, duration: 0.08, ease: 'power1.inOut' }, 0.04);
  }

  animateSpeaking() {
    gsap.to(this.mesh.rotation, { x: 0.03, duration: 0.3, ease: 'power2.inOut', repeat: -1, yoyo: true });
    gsap.to(this.leftArm.rotation, { x: -0.4, z: 0.3, duration: 0.6, ease: 'power2.inOut', repeat: -1, yoyo: true });
    gsap.to(this.rightArm.rotation, { x: -0.4, z: -0.3, duration: 0.6, ease: 'power2.inOut', repeat: -1, yoyo: true });
  }

  animateBlocked() {
    // Crossed arms, slight red pulse
    gsap.to(this.leftArm.rotation, { x: -1.2, z: 0.6, duration: 0.5, ease: 'power2.out' });
    gsap.to(this.rightArm.rotation, { x: -1.2, z: -0.6, duration: 0.5, ease: 'power2.out' });

    if (!this.stateIndicator) return;
    this.idleAnimation = gsap.timeline({ repeat: -1 })
      .to(this.stateIndicator.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.4, ease: 'power1.inOut' })
      .to(this.stateIndicator.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power1.inOut' });
  }

  update() {
    // No continuous updates needed for the mini version
  }
}

// React component
export default function OfficeCanvasMini({ workflow }: { workflow: any }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const office = new MiniOfficeScene(containerRef.current);
      return () => office.dispose();
    }
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg)' }} />;
}