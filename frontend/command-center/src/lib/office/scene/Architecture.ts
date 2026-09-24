// Architecture: floor, walls, glass cabin, ceiling — Spinach Labs office v2
import * as THREE from 'three';

const AMBER = 0xc9a86a;
const GLASS_CLEAR = 0xafc8d8;

export function makeBaseboardStrip(length: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(length, 0.06, 0.03);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9a86a,
    emissive: new THREE.Color(0xc9a86a),
    emissiveIntensity: 0.8,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.03;
  return mesh;
}

function makeFloor(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(46, 30, 24, 16);
  geo.rotateX(-Math.PI / 2);
  
  const pos = geo.getAttribute('position');
  const colors = new THREE.Float32BufferAttribute(pos.count * 3, 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = Math.sin(x * 0.8) * Math.cos(z * 0.6) * 0.02 + Math.sin(x * 1.3 + 10) * Math.cos(z * 1.1) * 0.015;
    const brightness = 0.98 + n;
    colors.setXYZ(i, brightness, brightness, brightness * 1.02);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors.array, 3));
  
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a3f3b,
    roughness: 0.35,
    metalness: 0.1,
    vertexColors: true,
  });
  
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(46, 30, 24, 16), mat).rotateX(-Math.PI / 2));
  
  const gridGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(46, 30, 24, 16));
  const gridMat = new THREE.LineBasicMaterial({ color: 0x2e2e2e, opacity: 0.3, transparent: true });
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  
  group.add(grid);
  return group;
}

function makeSolidWall(length: number, height: number, color: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(length, height, 0.2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function makeBackWall(): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0d1420,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
    metalness: 0.1,
  });

  const count = Math.floor(46 / 1.5);
  for (let i = 0; i <= count; i++) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4, 0.12), frameMat);
    mullion.position.set(-23 + i * 1.5, 2, 0);
    group.add(mullion);
  }

  for (const y of [1.0, 2.6]) {
    const transom = new THREE.Mesh(new THREE.BoxGeometry(46, 0.06, 0.12), frameMat);
    transom.position.set(0, y, 0);
    group.add(transom);
  }

  for (let i = 0; i < count; i++) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(1.42, 3.9, 0.02), glassMat);
    pane.position.set(-23 + 0.75 + i * 1.5, 2, 0);
    group.add(pane);
  }

  const dotGeo = new THREE.PlaneGeometry(0.12, 0.12);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xc9a86a,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, 100);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let bx = 0; bx < 10 && placed < 100; bx++) {
    const buildingH = 8 + Math.floor(Math.random() * 18);
    for (let wy = 1; wy < buildingH && placed < 100; wy += 2) {
      for (let wx = 0; wx < 2 && placed < 100; wx++) {
        dummy.position.set(
          -23 - 6 + bx * 1.2 + wx * 0.5,
          1 + wy * 0.5,
          -15 - 0.5
        );
        dummy.updateMatrix();
        dots.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }
  }
  dots.count = placed;
  group.add(dots);

  const strip = makeBaseboardStrip(46);
  strip.position.set(0, 0.03, 0.12);
  group.add(strip);

  group.position.set(0, 0, -15);
  return group;
}

function makeLeftWall(): THREE.Group {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 0.2), 
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.05 }));
  wall.position.y = 2;
  wall.receiveShadow = true;
  group.add(wall);

  const baseboardGeo = new THREE.BoxGeometry(30, 0.15, 0.22);
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const baseboard = new THREE.Mesh(baseboardGeo, baseboardMat);
  baseboard.position.set(0, 0.075, 0.11);
  group.add(baseboard);

  const railGeo = new THREE.BoxGeometry(30, 0.02, 0.03);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.position.set(0, 1.0, 0.11);
  group.add(rail);

  const brandGeo = new THREE.BoxGeometry(0.04, 0.35, 6);
  const brandMat = new THREE.MeshStandardMaterial({
    color: 0x56883e,
    emissive: new THREE.Color(0x56883e),
    emissiveIntensity: 0.6,
  });
  const brand = new THREE.Mesh(brandGeo, brandMat);
  brand.position.set(0, 3, 0);
  group.add(brand);

  group.position.set(-23, 0, 0);
  group.rotation.y = Math.PI / 2;
  return group;
}

function makeRightWall(): THREE.Group {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 0.2), 
    new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.85, metalness: 0.05 }));
  wall.position.y = 2;
  wall.receiveShadow = true;
  group.add(wall);

  const baseboardGeo = new THREE.BoxGeometry(30, 0.15, 0.22);
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const baseboard = new THREE.Mesh(baseboardGeo, baseboardMat);
  baseboard.position.set(0, 0.075, 0.11);
  group.add(baseboard);

  const railGeo = new THREE.BoxGeometry(30, 0.02, 0.03);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.position.set(0, 1.0, 0.11);
  group.add(rail);

  group.position.set(23, 0, 0);
  group.rotation.y = Math.PI / 2;
  return group;
}

function makeFrontWall(): THREE.Group {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85, metalness: 0.05 });
  
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 0.2), wallMat);
  leftWall.position.set(-13, 2, 0);
  leftWall.receiveShadow = true;
  group.add(leftWall);
  
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 0.2), wallMat);
  rightWall.position.set(13, 2, 0);
  rightWall.receiveShadow = true;
  group.add(rightWall);
  
  const topWall = new THREE.Mesh(new THREE.BoxGeometry(20, 1.5, 0.2), wallMat);
  topWall.position.set(0, 4 - 0.75, 0);
  topWall.receiveShadow = true;
  group.add(topWall);
  
  const strip = makeBaseboardStrip(20);
  strip.position.set(0, 0.03, 0.12);
  group.add(strip);
  
  group.position.set(0, 0, 15);
  return group;
}

function makeCabin(): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xafc8d8,
    transparent: true,
    opacity: 0.12,
    roughness: 0.05,
    metalness: 0.1,
  });

  const CAB_W = 7;
  const CAB_D = 5;
  const mullionStep = 1.2;

  const sides = [
    { len: 7, pos: [0, 2.5], rot: 0 },
    { len: 7, pos: [0, -2.5], rot: 0 },
    { len: 5, pos: [3.5, 0], rot: Math.PI / 2 },
  ];

  for (const side of sides) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(side.len, 3.9, 0.02), glassMat);
    pane.position.set(side.pos[0], 2, side.pos[1]);
    pane.rotation.y = side.rot;
    group.add(pane);

    const mCount = Math.floor(side.len / 1.2);
    for (let i = 0; i <= mCount; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4, 0.08), frameMat);
      const along = -side.len / 2 + i * 1.2;
      if (side.rot === 0) m.position.set(along, 2, side.pos[1]);
      else m.position.set(side.pos[0], 2, along);
      group.add(m);
    }

    const rail = new THREE.Mesh(new THREE.BoxGeometry(side.len, 0.08, 0.1), frameMat);
    rail.position.set(side.pos[0], 3.96, side.pos[1]);
    rail.rotation.y = side.rot;
    group.add(rail);

    const strip = makeBaseboardStrip(side.len);
    strip.position.set(side.pos[0], 0.03, side.pos[1]);
    strip.rotation.y = side.rot;
    group.add(strip);
  }

  group.position.set(13.5, 0, 0.5);
  return group;
}

function makeCeiling(): THREE.Group {
  const group = new THREE.Group();
  
  const ceilMat = new THREE.MeshStandardMaterial({ 
    color: 0x0a0a0a, 
    roughness: 0.95,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.3,
  });
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(46, 0.1, 30), ceilMat);
  ceiling.position.y = 4.05;
  group.add(ceiling);

  const trackMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.6, metalness: 0.3 });
  const housingGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.5, metalness: 0.4 });

  for (const z of [-8, 0, 8]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.12), trackMat);
    track.position.set(0, 3.94, z);
    group.add(track);

    for (let i = 0; i < 8; i++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8), 
        new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.5, metalness: 0.4 }));
      h.position.set(-5.25 + i * 1.5, 3.8, z);
      group.add(h);
    }
  }

  return group;
}

function makePartitions(): THREE.Group {
  const group = new THREE.Group();
  const partMat = new THREE.MeshStandardMaterial({ color: 0x2a2824, roughness: 0.95 });
  const partGeo = new THREE.BoxGeometry(0.04, 1.2, 3.5);

  const p1 = new THREE.Mesh(partGeo, partMat); p1.position.set(-9, 0.6, -2); group.add(p1);
  const p2 = new THREE.Mesh(partGeo, partMat); p2.position.set(2, 0.6, -11); group.add(p2);
  const p3 = new THREE.Mesh(partGeo, partMat); p3.position.set(-4, 0.6, 5); group.add(p3);
  const p4 = new THREE.Mesh(partGeo, partMat); p4.position.set(9, 0.6, -2); group.add(p4);

  return group;
}

export function buildArchitecture(scene: THREE.Scene): void {
  scene.add(makeFloor());
  scene.add(makeBackWall());
  scene.add(makeLeftWall());
  scene.add(makeRightWall());
  scene.add(makeFrontWall());
  scene.add(makeCabin());
  scene.add(makeCeiling());
  scene.add(makePartitions());

  const colGeo = new THREE.BoxGeometry(0.4, 4, 0.4);
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7, metalness: 0.2 });
  for (const x of [-15, 0, 15]) {
    for (const z of [-10, 8]) {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(x, 2, z);
      col.receiveShadow = true;
      scene.add(col);
    }
  }
}