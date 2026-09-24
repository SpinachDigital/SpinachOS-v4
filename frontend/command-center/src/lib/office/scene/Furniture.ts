// Furniture: desks, monitors, chairs, planters, lounge — Spinach Labs office v2
import * as THREE from 'three';

const DESK_WOOD = 0x2a2118;
const DARK_METAL = 0x1c1c1c;
const DARK_METAL_2 = 0x151515;
const SCREEN_BLUE = 0xbfd4e6;
const POT_GRAY = 0x3a3f3b;
const PLANT_GREEN = 0x2e5339;

/** Dark bench desk (default 2.4m wide) */
export function makeDesk(width = 2.4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: DESK_WOOD, roughness: 0.6, metalness: 0.1 });
  const metalMat = new THREE.MeshStandardMaterial({ color: DARK_METAL, roughness: 0.5, metalness: 0.4 });

  // Top slab
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 1.1), woodMat);
  top.position.y = 0.74;
  top.castShadow = true;
  group.add(top);

  // Side panels
  const sideGeo = new THREE.BoxGeometry(0.05, 0.72, 1.0);
  const left = new THREE.Mesh(sideGeo, metalMat);
  left.position.set(-width / 2 + 0.1, 0.36, 0);
  group.add(left);
  const right = new THREE.Mesh(sideGeo, metalMat);
  right.position.set(width / 2 - 0.1, 0.36, 0);
  group.add(right);

  // Modesty panel
  const modesty = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.4, 0.03), metalMat);
  modesty.position.set(0, 0.45, -0.45);
  group.add(modesty);

  return group;
}

/** Dual monitor pair with emissive screens — returns screen materials for flicker */
export function makeMonitor(): { group: THREE.Group; screenMaterials: THREE.MeshStandardMaterial[] } {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.3 });
  const standMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.4 });
  const screenMaterials: THREE.MeshStandardMaterial[] = [];

  for (const dx of [-0.28, 0.28]) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.18, 8), standMat);
    stand.position.set(dx, 0.83, -0.1);
    group.add(stand);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.03), shellMat);
    shell.position.set(dx, 1.0, -0.1);
    group.add(shell);

    const screenMat = new THREE.MeshStandardMaterial({
      color: SCREEN_BLUE,
      emissive: new THREE.Color(SCREEN_BLUE),
      emissiveIntensity: 0.9,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), screenMat);
    screen.position.set(dx, 1.0, -0.083);
    group.add(screen);
    screenMaterials.push(screenMat);
  }

  return { group, screenMaterials };
}

/** Ergonomic chair — under 10 meshes */
export function makeChair(): THREE.Group {
  const group = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x23231f, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: DARK_METAL_2, roughness: 0.5, metalness: 0.4 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), seatMat);
  seat.position.y = 0.46;
  seat.castShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), seatMat);
  back.position.set(0, 0.75, -0.22);
  back.rotation.x = -0.08;
  group.add(back);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), metalMat);
  pole.position.y = 0.24;
  group.add(pole);

  // 5-star base
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.04), metalMat);
    spoke.position.set(Math.cos(angle) * 0.14, 0.04, Math.sin(angle) * 0.14);
    spoke.rotation.y = -angle;
    group.add(spoke);
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), metalMat);
    caster.position.set(Math.cos(angle) * 0.27, 0.03, Math.sin(angle) * 0.27);
    group.add(caster);
  }

  return group;
}

/** Potted plant — returns foliage group for sway animation */
export function makePlanter(): { group: THREE.Group; foliage: THREE.Group } {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.12, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: POT_GRAY, roughness: 0.8 })
  );
  pot.position.y = 0.14;
  group.add(pot);

  const foliage = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({
    color: PLANT_GREEN,
    roughness: 0.8,
    emissive: new THREE.Color(PLANT_GREEN),
    emissiveIntensity: 0.05,
  });
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.45, 0, 0.18],
    [0.08, 0.38, 0.05, 0.13],
    [-0.07, 0.4, -0.04, 0.12],
  ];
  for (const [x, y, z, r] of blobs) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), leafMat);
    blob.position.set(x, y, z);
    foliage.add(blob);
  }
  group.add(foliage);

  return { group, foliage };
}

/** Lounge set: rug, sofa, 2 armchairs, coffee table */
export function makeLoungeSet(): THREE.Group {
  const group = new THREE.Group();
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x22201c, roughness: 0.95 });
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.75 });
  const woodMat = new THREE.MeshStandardMaterial({ color: DESK_WOOD, roughness: 0.6 });

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.01;
  group.add(rug);

  // Sofa
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.85), sofaMat);
  sofaBase.position.set(0, 0.2, -0.9);
  sofaBase.castShadow = true;
  group.add(sofaBase);
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.2), sofaMat);
  sofaBack.position.set(0, 0.6, -1.25);
  group.add(sofaBack);
  for (const dx of [-0.95, 0.95]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.85), sofaMat);
    arm.position.set(dx, 0.45, -0.9);
    group.add(arm);
  }

  // 2 armchairs
  for (const dx of [-1.4, 1.4]) {
    const chairBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), sofaMat);
    chairBase.position.set(dx, 0.2, 0.1);
    chairBase.rotation.y = dx > 0 ? -0.4 : 0.4;
    group.add(chairBase);
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.15), sofaMat);
    chairBack.position.set(dx + (dx > 0 ? 0.12 : -0.12), 0.6, 0.42);
    chairBack.rotation.y = dx > 0 ? -0.4 : 0.4;
    group.add(chairBack);
  }

  // Circular coffee table
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20), woodMat);
  tableTop.position.y = 0.42;
  tableTop.castShadow = true;
  group.add(tableTop);
  const tablePole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.4, 8), new THREE.MeshStandardMaterial({ color: DARK_METAL, roughness: 0.5, metalness: 0.4 }));
  tablePole.position.y = 0.2;
  group.add(tablePole);

  return group;
}

/** Coffee mug with handle */
export function makeCoffeeMug(): THREE.Group {
  const group = new THREE.Group();
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 10), mugMat);
  body.position.y = 0.795;
  group.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 6, 12), mugMat);
  handle.position.set(0.04, 0.8, 0);
  handle.rotation.y = Math.PI / 2;
  group.add(handle);
  return group;
}

/** Books stack */
export function makeBooksStack(): THREE.Group {
  const group = new THREE.Group();
  const colors = [0x5a4a3a, 0x3e4a3a, 0x4a3e3a];
  for (let i = 0; i < 3; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.24 - i * 0.02, 0.025, 0.17),
      new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.8 })
    );
    book.position.y = 0.78 + 0.013 + i * 0.026;
    book.rotation.y = (Math.random() - 0.5) * 0.3;
    group.add(book);
  }
  return group;
}

/** Desk positions in 5 clusters (Strategy / Content / Campaigns / Web&Tech / Data) */
export const DESK_POSITIONS: Array<{ x: number; z: number; rotation: number }> = [
  // Strategy — 3 desks along left wall, facing right
  { x: -17, z: -6, rotation: Math.PI / 2 },
  { x: -17, z: 0, rotation: Math.PI / 2 },
  { x: -17, z: 6, rotation: Math.PI / 2 },
  // Content — 4 desks back-center, facing back windows
  { x: -4.5, z: -11, rotation: 0 },
  { x: -1.5, z: -11, rotation: 0 },
  { x: 1.5, z: -11, rotation: 0 },
  { x: 4.5, z: -11, rotation: 0 },
  // Campaigns — 3 desks back-right
  { x: 8, z: -11, rotation: 0 },
  { x: 11, z: -11, rotation: 0 },
  { x: 14, z: -11, rotation: 0 },
  // Web&Tech — 4 desks middle-left
  { x: -8, z: 2, rotation: Math.PI / 2 },
  { x: -8, z: -1, rotation: Math.PI / 2 },
  { x: -8, z: -4, rotation: Math.PI / 2 },
  { x: -8, z: 5, rotation: Math.PI / 2 },
  // Data — 4 desks foreground, facing front
  { x: -4.5, z: 8, rotation: Math.PI },
  { x: -1.5, z: 8, rotation: Math.PI },
  { x: 1.5, z: 8, rotation: Math.PI },
  { x: 4.5, z: 8, rotation: Math.PI },
];

/** Build all furniture — returns screen materials (flicker) + foliage groups (sway) */
export function buildFurniture(
  scene: THREE.Scene,
  deskPositions: Array<{ x: number; z: number; rotation: number }> = DESK_POSITIONS
): { screenMaterials: THREE.MeshStandardMaterial[]; foliages: THREE.Group[] } {
  const screenMaterials: THREE.MeshStandardMaterial[] = [];
  const foliages: THREE.Group[] = [];

  for (const pos of deskPositions) {
    const desk = makeDesk();
    desk.position.set(pos.x, 0, pos.z);
    desk.rotation.y = pos.rotation;
    scene.add(desk);

    // Chair behind the desk (facing the desk)
    const chair = makeChair();
    const behind = 0.75;
    chair.position.set(
      pos.x - Math.sin(pos.rotation) * behind,
      0,
      pos.z - Math.cos(pos.rotation) * behind
    );
    chair.rotation.y = pos.rotation;
    scene.add(chair);

    // Monitor on desk
    const monitor = makeMonitor();
    monitor.group.position.set(pos.x, 0, pos.z);
    monitor.group.rotation.y = pos.rotation;
    scene.add(monitor.group);
    screenMaterials.push(...monitor.screenMaterials);

    // Random prop: planter OR books OR mug (60% chance any)
    if (Math.random() < 0.6) {
      const roll = Math.random();
      if (roll < 0.4) {
        const planter = makePlanter();
        planter.group.position.set(pos.x + Math.cos(pos.rotation) * 0.9, 0, pos.z - Math.sin(pos.rotation) * 0.9);
        scene.add(planter.group);
        foliages.push(planter.foliage);
      } else if (roll < 0.75) {
        const books = makeBooksStack();
        books.position.set(pos.x + Math.cos(pos.rotation) * 0.8, 0, pos.z - Math.sin(pos.rotation) * 0.8);
        books.rotation.y = pos.rotation;
        scene.add(books);
      } else {
        const mug = makeCoffeeMug();
        mug.position.set(pos.x + Math.cos(pos.rotation) * 0.7, 0, pos.z - Math.sin(pos.rotation) * 0.7);
        scene.add(mug);
      }
    }
  }

  // Lounge set: bottom-right
  const lounge = makeLoungeSet();
  lounge.position.set(16, 0, 9);
  scene.add(lounge);

  return { screenMaterials, foliages };
}