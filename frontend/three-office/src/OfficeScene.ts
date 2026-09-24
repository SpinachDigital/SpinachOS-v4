import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

// ============================================
// TYPES
// ============================================
type NPCState = 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';

interface NPCConfig {
  profile: string;
  room: string;
  position: THREE.Vector3;
  rotation: number;
  personality: string;
  modelPath?: string;
}

interface RoomConfig {
  id: string;
  name: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: number;
  npcProfile: string;
}

// ============================================
// ROOM CONFIGURATIONS
// ============================================
const ROOMS: RoomConfig[] = [
  { id: 'ceo-room', name: 'CEO Room', position: new THREE.Vector3(-15, 0, 0), size: new THREE.Vector3(10, 4, 10), color: 0x1a1a2e, npcProfile: 'ceo' },
  { id: 'cto-room', name: 'CTO Room', position: new THREE.Vector3(15, 0, 0), size: new THREE.Vector3(10, 4, 10), color: 0x16213e, npcProfile: 'cto' },
  { id: 'sales-room', name: 'Sales Room', position: new THREE.Vector3(0, 0, -15), size: new THREE.Vector3(12, 4, 8), color: 0x0f3460, npcProfile: 'sales' },
  { id: 'content-studio', name: 'Content Studio', position: new THREE.Vector3(-12, 0, 12), size: new THREE.Vector3(8, 4, 8), color: 0x1a1a2e, npcProfile: 'content' },
  { id: 'design-studio', name: 'Design Studio', position: new THREE.Vector3(12, 0, 12), size: new THREE.Vector3(8, 4, 8), color: 0x16213e, npcProfile: 'design' },
  { id: 'engineering-lab', name: 'Engineering Lab', position: new THREE.Vector3(0, 0, 15), size: new THREE.Vector3(12, 4, 8), color: 0x0f3460, npcProfile: 'engineering' },
  { id: 'ops-room', name: 'Ops Control', position: new THREE.Vector3(0, 0, 0), size: new THREE.Vector3(14, 4, 14), color: 0x1a1a2e, npcProfile: 'ops' },
];

const NPC_CONFIGS: NPCConfig[] = [
  { profile: 'ceo', room: 'ceo-room', position: new THREE.Vector3(-15, 1, 0), rotation: 0, personality: 'calm-strategist' },
  { profile: 'cto', room: 'cto-room', position: new THREE.Vector3(15, 1, 0), rotation: Math.PI, personality: 'focused-planner' },
  { profile: 'sales', room: 'sales-room', position: new THREE.Vector3(0, 1, -15), rotation: Math.PI / 2, personality: 'active-scanner' },
  { profile: 'content', room: 'content-studio', position: new THREE.Vector3(-12, 1, 12), rotation: -Math.PI / 4, personality: 'writer' },
  { profile: 'design', room: 'design-studio', position: new THREE.Vector3(12, 1, 12), rotation: Math.PI / 4, personality: 'sketcher' },
  { profile: 'engineering', room: 'engineering-lab', position: new THREE.Vector3(0, 1, 15), rotation: Math.PI, personality: 'builder' },
  { profile: 'ops', room: 'ops-room', position: new THREE.Vector3(2, 1, 2), rotation: -Math.PI / 2, personality: 'monitor' },
];

// ============================================
// OFFICE SCENE
// ============================================
export class OfficeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  rooms: Map<string, THREE.Group> = new Map();
  npcs: Map<string, NPCAvatar> = new Map();
  currentRoom: string | null = null;
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
    this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 12, 25);
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
    this.controls.maxDistance = 50;

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
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 30;
    mainLight.shadow.camera.bottom = -30;
    this.scene.add(mainLight);

    // Spinach green accent lights
    const accentColor = new THREE.Color(0x4CAF50);
    ROOMS.forEach((room, i) => {
      const light = new THREE.PointLight(accentColor, 0.3, 15, 2);
      light.position.copy(room.position).add(new THREE.Vector3(0, 5, 0));
      this.scene.add(light);
    });

    // Subtle rim lights
    const rimLight1 = new THREE.DirectionalLight(0x4CAF50, 0.1);
    rimLight1.position.set(-1, 0, -1);
    this.scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x2E7D32, 0.1);
    rimLight2.position.set(1, 0, 1);
    this.scene.add(rimLight2);
  }

  createOffice() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(80, 80, 80, 80);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d0d0d,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid lines on floor
    const gridHelper = new THREE.GridHelper(80, 80, 0x1a1a2e, 0x0f0f0f);
    this.scene.add(gridHelper);

    // Rooms
    ROOMS.forEach((roomConfig) => {
      const room = this.createRoom(roomConfig);
      room.position.copy(roomConfig.position);
      this.scene.add(room);
      this.rooms.set(roomConfig.id, room);
    });

    // Connecting corridors
    this.createCorridors();

    // Central hub
    this.createCentralHub();
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

    // Walls (with openings for corridors)
    const wallHeight = size.y;
    const wallThickness = 0.2;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(1.3),
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });

    // Four walls with doorways
    const walls = [
      { pos: new THREE.Vector3(0, wallHeight / 2, -size.z / 2), rot: 0, skip: config.id === 'ops-room' }, // front
      { pos: new THREE.Vector3(0, wallHeight / 2, size.z / 2), rot: Math.PI, skip: false }, // back
      { pos: new THREE.Vector3(-size.x / 2, wallHeight / 2, 0), rot: Math.PI / 2, skip: false }, // left
      { pos: new THREE.Vector3(size.x / 2, wallHeight / 2, 0), rot: -Math.PI / 2, skip: false }, // right
    ];

    walls.forEach((wall) => {
      if (wall.skip) return;
      const wallGeo = new THREE.BoxGeometry(size.x, wallHeight, wallThickness);
      const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
      wallMesh.position.copy(wall.pos);
      wallMesh.rotation.y = wall.rot;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
    });

    // Doorway frames (glowing green)
    const doorFrameMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.6 });
    const doorWidth = 3;
    const doorHeight = 2.5;

    walls.forEach((wall) => {
      if (wall.skip) return;
      const frameGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
      const frame = new THREE.Mesh(frameGeo, doorFrameMat);
      frame.position.copy(wall.pos).add(new THREE.Vector3(0, doorHeight / 2 - wallHeight / 2, wallThickness / 2 + 0.05));
      frame.rotation.y = wall.rot;
      group.add(frame);
    });

    // Room label
    const label = this.createRoomLabel(config.name);
    label.position.set(0, size.y + 0.5, 0);
    group.add(label);

    return group;
  }

  createRoomLabel(name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(6, 1.5, 1);
    sprite.renderOrder = 1;
    return sprite;
  }

  createCorridors() {
    const corridorMat = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.9 });
    
    // Corridors from center to each room
    ROOMS.forEach((room) => {
      if (room.id === 'ops-room') return;
      const dir = room.position.clone().normalize();
      const length = room.position.length() - 7; // from center edge to room edge
      
      const corridorGeo = new THREE.BoxGeometry(4, 3, length);
      const corridor = new THREE.Mesh(corridorGeo, corridorMat);
      corridor.position.copy(dir.clone().multiplyScalar(length / 2 + 7));
      corridor.lookAt(room.position);
      corridor.castShadow = true;
      corridor.receiveShadow = true;
      this.scene.add(corridor);

      // Glowing edges
      const edgeGeo = new THREE.BoxGeometry(4.2, 0.1, length + 0.2);
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.3 });
      const edgeTop = new THREE.Mesh(edgeGeo, edgeMat);
      edgeTop.position.copy(corridor.position).add(new THREE.Vector3(0, 1.55, 0));
      edgeTop.rotation.copy(corridor.rotation);
      this.scene.add(edgeTop);

      const edgeBottom = edgeTop.clone();
      edgeBottom.position.y = corridor.position.y - 1.55;
      this.scene.add(edgeBottom);
    });
  }

  createCentralHub() {
    // Central circular platform
    const hubGeo = new THREE.CylinderGeometry(7, 7, 0.2, 32);
    const hubMat = new THREE.MeshStandardMaterial({ 
      color: 0x0d0d0d, 
      roughness: 0.8,
      metalness: 0.2 
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.receiveShadow = true;
    this.scene.add(hub);

    // Central hologram pedestal
    const pedestalGeo = new THREE.CylinderGeometry(1.5, 1.5, 1, 16);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5 });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.5;
    pedestal.castShadow = true;
    this.scene.add(pedestal);

    // Spinning data ring
    const ringGeo = new THREE.TorusGeometry(2.5, 0.08, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.6 });
    this.dataRing = new THREE.Mesh(ringGeo, ringMat);
    this.dataRing.position.y = 1.2;
    this.dataRing.rotation.x = Math.PI / 2;
    this.scene.add(this.dataRing);

    // Pulse animation
    gsap.to(this.dataRing.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 2, repeat: -1, yoyo: true, ease: 'power1.inOut' });
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
    
    this.ws.onopen = () => console.log('WebSocket connected');
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleWebSocketMessage(msg);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };
    this.ws.onerror = (e) => console.error('WS error:', e);
    this.ws.onclose = () => {
      console.log('WS closed, reconnecting in 5s...');
      setTimeout(() => this.setupWebSocket(), 5000);
    };
  }

  handleWebSocketMessage(msg: any) {
    switch (msg.event) {
      case 'agent_state':
        const npc = this.npcs.get(msg.data.agent);
        if (npc) npc.setState(msg.data.state, msg.data.activity);
        break;
      case 'feed':
        this.showNotification(msg.data.profile, msg.data.action);
        break;
      case 'task_update':
        this.updateTaskDisplay(msg.data);
        break;
      case 'approval':
        this.showApprovalNotification(msg.data);
        break;
      case 'workflow':
        this.updateWorkflowDisplay(msg.data);
        break;
    }
  }

  enterRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.currentRoom = roomId;
    const target = room.position.clone().add(new THREE.Vector3(0, 3, 8));
    
    gsap.to(this.camera.position, {
      x: target.x, y: target.y, z: target.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => this.controls.update(),
    });
    
    gsap.to(this.controls.target, {
      x: room.position.x, y: 1, z: room.position.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => this.controls.update(),
    });
  }

  exitRoom() {
    this.currentRoom = null;
    gsap.to(this.camera.position, {
      x: 0, y: 12, z: 25,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => this.controls.update(),
    });
    gsap.to(this.controls.target, {
      x: 0, y: 0, z: 0,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => this.controls.update(),
    });
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Animate data ring
    if (this.dataRing) {
      this.dataRing.rotation.z += 0.002;
    }

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

  showNotification(profile: string, action: string) {
    // Could show toast notification
    console.log(`[${profile}] ${action}`);
  }

  updateTaskDisplay(task: any) {
    console.log('Task update:', task);
  }

  showApprovalNotification(approval: any) {
    console.log('Approval:', approval);
  }

  updateWorkflowDisplay(workflow: any) {
    console.log('Workflow:', workflow);
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.ws?.close();
    this.renderer.dispose();
    this.controls.dispose();
  }
}

// ============================================
// NPC AVATAR
// ============================================
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
    // Professional humanoid silhouette (no cartoonish features)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.6,
      metalness: 0.1,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x4CAF50,
      roughness: 0.3,
      metalness: 0.5,
      emissive: new THREE.Color(0x4CAF50),
      emissiveIntensity: 0.2,
    });

    // Torso
    const torsoGeo = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16);
    const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
    torso.position.y = 1.2;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const head = new THREE.Mesh(headGeo, bodyMaterial);
    head.position.y = 2.1;
    head.castShadow = true;
    this.mesh.add(head);

    // Eyes (subtle glow)
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.8 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 2.15, 0.3);
    this.mesh.add(leftEye);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.12;
    this.mesh.add(rightEye);
    this.eyes = [leftEye, rightEye];

    // Shoulders
    const shoulderGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const leftShoulder = new THREE.Mesh(shoulderGeo, bodyMaterial);
    leftShoulder.position.set(-0.55, 1.6, 0);
    leftShoulder.scale.set(1, 0.6, 1);
    this.mesh.add(leftShoulder);
    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.x = 0.55;
    this.mesh.add(rightShoulder);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.12, 0.8, 6, 12);
    this.leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    this.leftArm.position.set(-0.7, 1.2, 0);
    this.leftArm.rotation.z = 0.2;
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    this.rightArm.position.set(0.7, 1.2, 0);
    this.rightArm.rotation.z = -0.2;
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Subtle accent line on torso
    const accentGeo = new THREE.RingGeometry(0.42, 0.45, 16);
    const accent = new THREE.Mesh(accentGeo, accentMaterial);
    accent.position.set(0, 1.3, 0.41);
    accent.rotation.x = -Math.PI / 2;
    this.mesh.add(accent);
    this.accentRing = accent;
  }

  createStateIndicator() {
    // Small floating indicator above head
    const geo = new THREE.SphereGeometry(0.15, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ 
      color: 0x4CAF50, 
      transparent: true, 
      opacity: 0.8 
    });
    this.stateIndicator = new THREE.Mesh(geo, mat);
    this.stateIndicator.position.set(0, 2.6, 0);
    this.mesh.add(this.stateIndicator);

    // Pulse animation
    gsap.to(this.stateIndicator.scale, {
      x: 1.3, y: 1.3, z: 1.3,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
    });
  }

  createActivityLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    this.labelCanvas = canvas;
    this.labelCtx = canvas.getContext('2d')!;
    this.updateLabel('Idle');

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    this.activityLabel = new THREE.Sprite(material);
    this.activityLabel.position.set(0, 3, 0);
    this.activityLabel.scale.set(8, 1, 1);
    this.activityLabel.renderOrder = 1;
    this.mesh.add(this.activityLabel);
  }

  updateLabel(text: string) {
    if (!this.labelCanvas || !this.labelCtx) return;
    const ctx = this.labelCtx;
    const canvas = this.labelCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4CAF50';
    ctx.font = '500 28px Inter, sans-serif';
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
      idle: 0x4CAF50,
      thinking: 0xFF9800,
      working: 0x2196F3,
      speaking: 0x9C27B0,
      blocked: 0xF44336,
    };
    const color = colors[this.state] || 0x4CAF50;
    
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
    // Kill existing animations
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
    // Subtle breathing
    this.idleAnimation = gsap.timeline({ repeat: -1, yoyo: true })
      .to(this.mesh.position, { y: '+=0.03', duration: 2, ease: 'power1.inOut' })
      .to(this.mesh.rotation, { y: '+=0.02', duration: 3, ease: 'power1.inOut' }, 0)
      .to(this.eyes[0].scale, { y: 0.3, duration: 0.15, repeat: 1, yoyo: true }, 1.5)
      .to(this.eyes[1].scale, { y: 0.3, duration: 0.15, repeat: 1, yoyo: true }, 1.5);
  }

  animateThinking() {
    // Head tilt, hand to chin gesture
    gsap.to(this.mesh.rotation, { y: '+=0.15', duration: 0.5, ease: 'power2.out' });
    gsap.to(this.leftArm.rotation, { x: -1.2, z: 0.5, duration: 0.5, ease: 'power2.out' });
    gsap.to(this.rightArm.rotation, { x: -0.3, z: -0.3, duration: 0.5, ease: 'power2.out' });
    
    // Blink slower
    this.idleAnimation = gsap.timeline({ repeat: -1 })
      .to(this.eyes[0].scale, { y: 0.1, duration: 0.2, ease: 'power2.inOut' })
      .to(this.eyes[0].scale, { y: 1, duration: 0.2, ease: 'power2.inOut' })
      .to(this.eyes[1].scale, { y: 0.1, duration: 0.2, ease: 'power2.inOut' }, 0)
      .to(this.eyes[1].scale, { y: 1, duration: 0.2, ease: 'power2.inOut' }, 0)
      .to({}, { duration: 3 }); // pause
  }

  animateWorking() {
    // Typing gesture
    gsap.to(this.leftArm.rotation, { x: -0.8, z: 0.3, duration: 0.3, ease: 'power2.out' });
    gsap.to(this.rightArm.rotation, { x: -0.8, z: -0.3, duration: 0.3, ease: 'power2.out' });
    
    // Rapid typing motion
    this.idleAnimation = gsap.timeline({ repeat: -1 })
      .to(this.leftArm.rotation, { x: -0.9, duration: 0.1, ease: 'power1.inOut' })
      .to(this.leftArm.rotation, { x: -0.7, duration: 0.1, ease: 'power1.inOut' })
      .to(this.rightArm.rotation, { x: -0.9, duration: 0.1, ease: 'power1.inOut' }, 0.05)
      .to(this.rightArm.rotation, { x: -0.7, duration: 0.1, ease: 'power1.inOut' }, 0.05);
  }

  animateSpeaking() {
    // Subtle head nod, hand gestures
    gsap.to(this.mesh.rotation, { x: 0.05, duration: 0.4, ease: 'power2.inOut', repeat: -1, yoyo: true });
    gsap.to(this.leftArm.rotation, { x: -0.5, z: 0.4, duration: 0.8, ease: 'power2.inOut', repeat: -1, yoyo: true });
    gsap.to(this.rightArm.rotation, { x: -0.5, z: -0.4, duration: 0.8, ease: 'power2.inOut', repeat: -1, yoyo: true });
  }

  animateBlocked() {
    // Crossed arms, slight red pulse
    gsap.to(this.leftArm.rotation, { x: -1.5, z: 0.8, duration: 0.5, ease: 'power2.out' });
    gsap.to(this.rightArm.rotation, { x: -1.5, z: -0.8, duration: 0.5, ease: 'power2.out' });
    
    this.idleAnimation = gsap.timeline({ repeat: -1 })
      .to(this.stateIndicator.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.5, ease: 'power1.inOut' })
      .to(this.stateIndicator.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power1.inOut' });
  }

  update() {
    // Continuous subtle movements
  }
}

// ============================================
// EXPORTS
// ============================================
export { NPC_CONFIGS, ROOMS, NPCAvatar };