// NPC: real-proportion people with state animations — Spinach Labs office v2
import * as THREE from 'three';
import gsap from 'gsap';

// ── Brand + palette (spinach green var(--green) only — never neon) ──
const BRAND_GREEN = 0x56883e;
type PersonState = 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';
const STATE_COLORS: Record<PersonState, number> = {
  idle: BRAND_GREEN,
  thinking: 0xc9a86a, // amber
  working: 0x4a7a99, // teal
  speaking: 0x8a5a99, // purple
  blocked: 0xb94a3e, // red
};

const SHIRT_PALETTE = [0x3e4a52, 0x52473e, 0x4a5240, 0x52404a, 0x3e424a, 0x5a5248];
const SKIN_TONES = [0xc9a88a, 0xa87858, 0x8a5c3e, 0xe0b89a, 0x6b4630];

// ── Shared geometry cache (keeps 25+ people cheap) ──
const GEO = {
  torso: new THREE.CapsuleGeometry(0.16, 0.5, 4, 8),
  head: new THREE.SphereGeometry(0.11, 10, 10),
  hair: new THREE.SphereGeometry(0.115, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
  upperArm: new THREE.CapsuleGeometry(0.045, 0.24, 3, 6),
  forearm: new THREE.CapsuleGeometry(0.04, 0.22, 3, 6),
  thigh: new THREE.CapsuleGeometry(0.07, 0.32, 3, 6),
  shin: new THREE.CapsuleGeometry(0.055, 0.34, 3, 6),
  eye: new THREE.SphereGeometry(0.014, 6, 6),
  indicator: new THREE.SphereGeometry(0.035, 8, 8),
  faceGlow: new THREE.PlaneGeometry(0.22, 0.16),
};

// Chair seat height (matches Furniture.makeChair)
const SEAT_H = 0.46;

export interface PersonConfig {
  id: string;
  pose: 'seated' | 'standing' | 'walking';
  shirtColor?: number;
  skinTone?: number;
}

export class Person {
  id: string;
  pose: PersonConfig['pose'];
  state: PersonState = 'idle';
  mesh: THREE.Group;

  private timeline: gsap.core.Timeline | null = null;
  private walkTl: gsap.core.Timeline | null = null;
  private blinkTimer = 0;
  private nextBlink = 2 + Math.random() * 4;
  private disposed = false;

  // Pivots + parts (assigned in build)
  private torso!: THREE.Mesh;
  private head!: THREE.Group;
  private indicator!: THREE.Mesh;
  private faceGlowMat!: THREE.MeshBasicMaterial;
  private lShoulder!: THREE.Group;
  private rShoulder!: THREE.Group;
  private lElbow!: THREE.Group;
  private rElbow!: THREE.Group;
  private lHip!: THREE.Group;
  private rHip!: THREE.Group;
  private lKnee!: THREE.Group;
  private rKnee!: THREE.Group;

  constructor(config: PersonConfig) {
    this.id = config.id;
    this.pose = config.pose;
    this.mesh = new THREE.Group();
    this.build(config.shirtColor, config.skinTone);
  }

  private build(shirtColor?: number, skinTone?: number) {
    const shirt = new THREE.MeshStandardMaterial({
      color: shirtColor ?? SHIRT_PALETTE[Math.floor(Math.random() * SHIRT_PALETTE.length)],
      roughness: 0.8,
    });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({
      color: skinTone ?? SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      roughness: 0.7,
    });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 });

    // Torso
    this.torso = new THREE.Mesh(GEO.torso, shirt);
    this.torso.castShadow = true;
    this.mesh.add(this.torso);

    // Head group (head + hair + eyes + face glow)
    this.head = new THREE.Group();
    const headMesh = new THREE.Mesh(GEO.head, skin);
    this.head.add(headMesh);
    const hair = new THREE.Mesh(GEO.hair, hairMat);
    hair.position.y = 0.02;
    this.head.add(hair);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const dx of [-0.04, 0.04]) {
      const eye = new THREE.Mesh(GEO.eye, eyeMat);
      eye.position.set(dx, 0.01, 0.1);
      this.head.add(eye);
    }

    // Screen-glow reflection on face (state color, subtle)
    this.faceGlowMat = new THREE.MeshBasicMaterial({
      color: STATE_COLORS.idle,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const faceGlow = new THREE.Mesh(GEO.faceGlow, this.faceGlowMat);
    faceGlow.position.set(0, 0.02, 0.16);
    this.head.add(faceGlow);

    this.mesh.add(this.head);

    // Arms: shoulder pivot groups for natural rotation
    const mkArm = (side: number) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.19, 0.22, 0);
      const upper = new THREE.Mesh(GEO.upperArm, shirt);
      upper.position.y = -0.14;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      const fore = new THREE.Mesh(GEO.forearm, skin);
      fore.position.y = -0.13;
      elbow.add(fore);
      shoulder.add(elbow);
      this.mesh.add(shoulder);
      return { shoulder, elbow };
    };
    const left = mkArm(-1);
    const right = mkArm(1);
    this.lShoulder = left.shoulder;
    this.lElbow = left.elbow;
    this.rShoulder = right.shoulder;
    this.rElbow = right.elbow;

    // Legs: hip pivot groups
    const mkLeg = (side: number) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, -0.26, 0);
      const thigh = new THREE.Mesh(GEO.thigh, pants);
      thigh.position.y = -0.18;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.36;
      const shin = new THREE.Mesh(GEO.shin, pants);
      shin.position.y = -0.19;
      knee.add(shin);
      hip.add(knee);
      this.mesh.add(hip);
      return { hip, knee };
    };
    const lLeg = mkLeg(-1);
    const rLeg = mkLeg(1);
    this.lHip = lLeg.hip;
    this.lKnee = lLeg.knee;
    this.rHip = rLeg.hip;
    this.rKnee = rLeg.knee;

    // State indicator above head
    this.indicator = new THREE.Mesh(
      GEO.indicator,
      new THREE.MeshBasicMaterial({ color: STATE_COLORS.idle, transparent: true, opacity: 0.9 })
    );
    this.indicator.position.y = 0.32;
    this.mesh.add(this.indicator);

    this.applyPose();
  }

  private applyPose() {
    if (this.pose === 'seated') {
      // Hips at seat height; thighs horizontal, shins down
      this.mesh.position.y = SEAT_H - 0.2;
      this.lHip.rotation.x = -Math.PI / 2;
      this.rHip.rotation.x = -Math.PI / 2;
      this.lKnee.rotation.x = Math.PI / 2;
      this.rKnee.rotation.x = Math.PI / 2;
      this.lShoulder.rotation.x = -0.55;
      this.rShoulder.rotation.x = -0.55;
      this.lElbow.rotation.x = -0.6;
      this.rElbow.rotation.x = -0.6;
    } else if (this.pose === 'standing') {
      this.mesh.position.y = 0;
      this.lShoulder.rotation.x = 0;
      this.rShoulder.rotation.x = 0;
      this.lElbow.rotation.x = -0.15;
      this.rElbow.rotation.x = -0.15;
    } else {
      // walking — stride handled by animation
      this.mesh.position.y = 0;
    }
  }

  setState(state: PersonState, opts?: { path?: THREE.Vector3[] }) {
    this.state = state;
    const color = new THREE.Color(STATE_COLORS[state]);
    (this.indicator.material as THREE.MeshBasicMaterial).color.copy(color);
    this.faceGlowMat.color.copy(color);
    this.faceGlowMat.opacity = state === 'working' ? 0.22 : 0.12;

    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    this.applyPose();

    const mk = () => gsap.timeline({ repeat: -1 });

    switch (state) {
      case 'working': {
        this.timeline = mk();
        this.timeline
          .to(this.lElbow.rotation, { x: -0.72, duration: 0.35, ease: 'power1.inOut' }, 0)
          .to(this.lElbow.rotation, { x: -0.5, duration: 0.35, ease: 'power1.inOut' }, 0.35)
          .to(this.rElbow.rotation, { x: -0.5, duration: 0.35, ease: 'power1.inOut' }, 0.175)
          .to(this.rElbow.rotation, { x: -0.72, duration: 0.35, ease: 'power1.inOut' }, 0.525)
          .to(this.head.rotation, { x: 0.12, duration: 0.8, ease: 'power1.inOut' }, 0);
        break;
      }
      case 'idle': {
        this.timeline = mk();
        this.timeline
          .to(this.torso.scale, { y: 1.015, duration: 1.1, ease: 'power1.inOut' }, 0)
          .to(this.torso.scale, { y: 1.0, duration: 1.1, ease: 'power1.inOut' }, 1.1)
          .to(this.mesh.rotation, { z: 0.012, duration: 2.2, ease: 'power1.inOut' }, 0)
          .to(this.mesh.rotation, { z: -0.012, duration: 2.2, ease: 'power1.inOut' }, 2.2);
        break;
      }
      case 'thinking': {
        this.timeline = mk();
        this.timeline
          .to(this.rShoulder.rotation, { x: -1.1, z: -0.5, duration: 0.5, ease: 'power2.out' }, 0)
          .to(this.rElbow.rotation, { x: -1.4, duration: 0.5, ease: 'power2.out' }, 0)
          .to(this.head.rotation, { x: 0.08, z: 0.06, duration: 0.5, ease: 'power2.out' }, 0)
          .to(this.head.rotation, { x: 0.1, z: -0.04, duration: 1.6, ease: 'power1.inOut' }, 0.6);
        break;
      }
      case 'speaking': {
        this.timeline = mk();
        this.timeline
          .to(this.head.rotation, { x: 0.05, duration: 0.6, ease: 'power1.inOut' }, 0)
          .to(this.head.rotation, { x: -0.03, duration: 0.6, ease: 'power1.inOut' }, 0.6)
          .to(this.lShoulder.rotation, { x: -0.4, z: 0.25, duration: 0.9, ease: 'power1.inOut' }, 0)
          .to(this.lShoulder.rotation, { x: -0.55, z: 0.05, duration: 0.9, ease: 'power1.inOut' }, 0.9);
        break;
      }
      case 'blocked': {
        this.timeline = mk();
        this.timeline
          .to(this.lShoulder.rotation, { x: -1.6, z: 0.6, duration: 0.5, ease: 'power2.out' }, 0)
          .to(this.rShoulder.rotation, { x: -1.6, z: -0.6, duration: 0.5, ease: 'power2.out' }, 0)
          .to(this.indicator.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 0.5, ease: 'power1.inOut' }, 0)
          .to(this.indicator.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power1.inOut' }, 0.5);
        break;
      }
    }

    // Walking: start stride + path movement when requested
    if (opts?.path && opts.path.length > 1) {
      this.startWalk(opts.path);
    }
  }

  private startWalk(path: THREE.Vector3[]) {
    if (this.walkTl) this.walkTl.kill();
    this.walkTl = gsap.timeline({ repeat: -1 });
    this.walkTl
      .to(this.lHip.rotation, { x: 0.5, duration: 0.3, ease: 'power1.inOut' }, 0)
      .to(this.lHip.rotation, { x: -0.5, duration: 0.3, ease: 'power1.inOut' }, 0.3)
      .to(this.lHip.rotation, { x: 0, duration: 0.15, ease: 'power1.inOut' }, 0.6)
      .to(this.rHip.rotation, { x: -0.5, duration: 0.3, ease: 'power1.inOut' }, 0)
      .to(this.rHip.rotation, { x: 0.5, duration: 0.3, ease: 'power1.inOut' }, 0.3)
      .to(this.rHip.rotation, { x: 0, duration: 0.15, ease: 'power1.inOut' }, 0.6)
      .to(this.lShoulder.rotation, { x: -0.4, duration: 0.3, ease: 'power1.inOut' }, 0)
      .to(this.lShoulder.rotation, { x: 0.2, duration: 0.3, ease: 'power1.inOut' }, 0.3)
      .to(this.rShoulder.rotation, { x: 0.2, duration: 0.3, ease: 'power1.inOut' }, 0)
      .to(this.rShoulder.rotation, { x: -0.4, duration: 0.3, ease: 'power1.inOut' }, 0.3);

    // Ping-pong along path
    const segDuration = 10 / (path.length - 1);
    gsap.to(this.mesh.position, {
      keyframes: path.map((p) => ({ x: p.x, z: p.z, duration: segDuration })),
      repeat: -1,
      yoyo: true,
      ease: 'none',
    });
  }

  update(delta: number) {
    if (this.disposed) return;
    this.blinkTimer += delta;
    if (this.blinkTimer >= this.nextBlink) {
      this.blinkTimer = 0;
      this.nextBlink = 2 + Math.random() * 4;
      gsap.to(this.head.scale, { y: 0.96, duration: 0.06, yoyo: true, repeat: 1 });
    }
  }

  dispose() {
    this.disposed = true;
    if (this.timeline) this.timeline.kill();
    if (this.walkTl) this.walkTl.kill();
    gsap.killTweensOf(this.mesh.position);
    this.mesh.removeFromParent();
  }
}

export interface NPCBuildConfig {
  seatedPositions: Array<{ x: number; z: number; rotation: number; agentId?: string }>;
  walkers: Array<{ startX: number; startZ: number; path: Array<{ x: number; z: number }> }>;
  meetingGroup: { centerX: number; centerZ: number };
}

/** Build all NPCs: seated workers, walkers, meeting group */
export function buildNPCs(scene: THREE.Scene, config: NPCBuildConfig): Person[] {
  const people: Person[] = [];

  for (const pos of config.seatedPositions) {
    const p = new Person({ id: pos.agentId ?? `worker-${people.length}`, pose: 'seated' });
    const y = p.mesh.position.y;
    p.mesh.position.set(pos.x, y, pos.z);
    p.mesh.rotation.y = pos.rotation;
    p.setState('working');
    scene.add(p.mesh);
    people.push(p);
  }

  for (const w of config.walkers) {
    const p = new Person({ id: `walker-${people.length}`, pose: 'walking' });
    p.mesh.position.set(w.startX, 0, w.startZ);
    const path = w.path.map((pt) => new THREE.Vector3(pt.x, 0, pt.z));
    p.setState('idle', { path });
    scene.add(p.mesh);
    people.push(p);
  }

  const seats = 5;
  for (let i = 0; i < seats; i++) {
    const angle = (i / seats) * Math.PI * 2 + 0.3;
    const r = 1.2;
    const p = new Person({ id: `meeting-${i}`, pose: 'seated' });
    const y = p.mesh.position.y;
    p.mesh.position.set(
      config.meetingGroup.centerX + Math.cos(angle) * r,
      y,
      config.meetingGroup.centerZ + Math.sin(angle) * r
    );
    p.mesh.rotation.y = -angle + Math.PI / 2;
    p.setState(i % 2 === 0 ? 'speaking' : 'idle');
    scene.add(p.mesh);
    people.push(p);
  }

  return people;
}

/** Default layout matching desk clusters + aisle + meeting cabin */
export const DEFAULT_NPC_CONFIG: NPCBuildConfig = {
  seatedPositions: [
    // 6 agent-driven NPCs (WS states)
    { x: -17, z: -6, rotation: Math.PI / 2, agentId: 'ceo' },
    { x: -17, z: 0, rotation: Math.PI / 2, agentId: 'cto' },
    { x: -4.5, z: -11, rotation: 0, agentId: 'content' },
    { x: 8, z: -11, rotation: 0, agentId: 'sales' },
    { x: -8, z: 2, rotation: Math.PI / 2, agentId: 'design' },
    { x: -1.5, z: 8, rotation: Math.PI, agentId: 'engineering' },
    // Generic workers
    { x: -17, z: 6, rotation: Math.PI / 2 },
    { x: -1.5, z: -11, rotation: 0 },
    { x: 1.5, z: -11, rotation: 0 },
    { x: 4.5, z: -11, rotation: 0 },
    { x: 11, z: -11, rotation: 0 },
    { x: 14, z: -11, rotation: 0 },
    { x: -8, z: -1, rotation: Math.PI / 2 },
    { x: -8, z: -4, rotation: Math.PI / 2 },
    { x: -8, z: 5, rotation: Math.PI / 2 },
    { x: -4.5, z: 8, rotation: Math.PI },
    { x: 1.5, z: 8, rotation: Math.PI },
    { x: 4.5, z: 8, rotation: Math.PI },
  ],
  walkers: [
    { startX: 0.5, startZ: 6, path: [{ x: 0.5, z: 6 }, { x: 0.5, z: -8 }] },
    { startX: -0.5, startZ: -6, path: [{ x: -0.5, z: -6 }, { x: -0.5, z: 8 }] },
  ],
  meetingGroup: { centerX: 13.5, centerZ: 0.5 },
};