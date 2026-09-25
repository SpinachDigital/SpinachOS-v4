/* Office assembly: floor plan, zones, repetition systems, walkers.
   Floor plate 46 x 34 m, ceiling 5.2 m. Units: meters. */
import * as THREE from 'three';
import * as M from './models.js';
import * as TX from './textures.js';

const FW = 46, FD = 34, CH = 5.2; // floor width/depth, ceiling height

export function buildOffice() {
  const root = new THREE.Group();
  root.name = 'spinach-labs-office';
  const zones = {};       // zoneId -> Group
  const registry = {};    // componentId -> Object3D
  const walkers = [];
  const pendants = [];
  const labels = [];
  let n = 0;
  const cid = (zone, kind) => `${zone}-${kind}-${++n}`;

  function zone(id, label) {
    const g = new THREE.Group();
    g.name = id;
    g.userData = { id, label, isZone: true, home: new THREE.Vector3(), dir: new THREE.Vector3() };
    zones[id] = g; root.add(g);
    return g;
  }
  function add(zoneG, obj, x, z, ry = 0, y = 0) {
    obj.position.set(x, y, z); obj.rotation.y = ry;
    obj.userData.home = obj.position.clone();
    const dir = new THREE.Vector3(x, 0, z);
    obj.userData.dir = dir.length() > 0.01 ? dir.normalize() : new THREE.Vector3(0, 1, 0);
    if (!obj.userData.id || obj.userData.id === obj.name) {
      const id = cid(zoneG.name, obj.userData.label || 'part');
      obj.userData.id = id; obj.name = id;
    }
    obj.userData.zone = zoneG.name;
    registry[obj.userData.id] = obj;
    zoneG.add(obj);
    return obj;
  }
  const personAt = (zoneG, x, z, ry, seated = true) => {
    const p = M.makePerson(seated);
    add(zoneG, p, x, z, ry);
    return p;
  };

  /* ============ SHELL ============ */
  const shell = zone('shell', 'Building shell');
  {
    const floorMat = new THREE.MeshStandardMaterial({ map: TX.concreteTexture(), roughness: 0.35 });
    floorMat.map.wrapS = floorMat.map.wrapT = THREE.RepeatWrapping;
    floorMat.map.repeat.set(12, 9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const fg = M.grp('floor-slab', 'shell', 'Floor slab'); fg.add(floor); add(shell, fg, 0, 0);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 });
    // north wall (tall, slogan)
    const nw = new THREE.Mesh(new THREE.PlaneGeometry(FW, CH), wallMat.clone());
    nw.material.map = TX.sloganWallTexture(); nw.position.set(0, CH / 2, -FD / 2); nw.receiveShadow = true;
    const nwg = M.grp('wall-north', 'shell', 'North slogan wall'); nwg.add(nw); add(shell, nwg, 0, 0);
    // west wall
    const ww = new THREE.Mesh(new THREE.PlaneGeometry(FD, CH), wallMat);
    ww.rotation.y = Math.PI / 2; ww.position.set(-FW / 2, CH / 2, 0); ww.receiveShadow = true;
    const wwg = M.grp('wall-west', 'shell', 'West wall'); wwg.add(ww); add(shell, wwg, 0, 0);
    // east + south glazing
    for (const [wdt, x, z, ry] of [[FD, FW / 2, 0, -Math.PI / 2], [FW, 0, FD / 2, Math.PI]]) {
      const gw = M.makeGlassWall(wdt, CH);
      add(shell, gw, x, z, ry);
    }
    // ceiling + beams + skylights
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = CH;
    const cg = M.grp('ceiling', 'shell', 'Ceiling'); cg.add(ceil);
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.28, 0.22), M.mat('charcoal'));
      beam.position.set(0, CH - 0.15, i * 6.4); cg.add(beam);
    }
    for (const sx of [-11.5, 0, 11.5]) {
      const sk = M.makeSkylight(7, 1.8);
      sk.position.set(sx, CH - 0.02, -8); cg.add(sk);
      const sk2 = M.makeSkylight(7, 1.8);
      sk2.position.set(sx, CH - 0.02, 4); cg.add(sk2);
    }
    add(shell, cg, 0, 0);
  }

  /* ============ RECEPTION ============ */
  const rec = zone('reception', 'Reception');
  {
    // brand wall: timber slats + lockup, west wall segment
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6),
      new THREE.MeshStandardMaterial({ map: TX.brandWallTexture(), roughness: 0.6 }));
    bw.rotation.y = Math.PI / 2; bw.position.set(0, 1.8, 0);
    const bwg = M.grp('brand-wall', 'reception', 'Brand wall'); bwg.add(bw);
    add(rec, bwg, -FW / 2 + 0.06, 11.5);
    add(rec, M.makeReceptionDesk(), -14.5, 12.3, Math.PI * 0.15);
    const rug = M.makeRug(5, 3.4); add(rec, rug, -14.5, 12.5);
    const s1 = M.makeSofa(2.4); add(rec, s1, -19, 14.2, Math.PI / 2);
    const s2 = M.makeSofa(2.4, 'sofaAccent'); add(rec, s2, -10.5, 14.6, -Math.PI / 2);
    add(rec, M.makeCoffeeTable(), -14.8, 14.4);
    add(rec, M.makeSucculent(), -14.8, 14.4, 0, 0.41); // succulent on coffee table
    add(rec, M.makeTree(2.8), -21, 8.5);
    add(rec, M.makeTree(2.2), -21.5, 15.8);
    add(rec, M.makePlanterBox(2), -18, 9.2, Math.PI / 2);
    personAt(rec, -19, 13.4, Math.PI / 2, true);
    personAt(rec, -13.2, 11.6, Math.PI * 0.9, false); // standing at desk
    const ws = M.makeWallSign('Good people Build great things.', '#16A34A');
    add(rec, ws, -FW / 2 + 0.08, 4.5).rotation.y = Math.PI / 2;
  }

  /* ============ CEO CABIN ============ */
  const ceo = zone('ceo-cabin', 'CEO cabin');
  {
    add(ceo, M.makeGlassWall(11, 2.9), -15.5, -6, 0);
    add(ceo, M.makeGlassWall(10, 2.9), -10, -11, Math.PI / 2);
    add(ceo, M.makeCabinDesk('chart'), -15.5, -12, 0);
    const s = M.makeSofa(2.0, 'sofaAccent'); add(ceo, s, -19, -8.5, Math.PI / 2);
    add(ceo, M.makeCoffeeTable(), -19, -11);
    add(ceo, M.makeTree(2.4), -20.5, -14.5);
    add(ceo, M.makePlanterBox(1.8), -12, -6.8);
    personAt(ceo, -15.5, -12.9, 0, true);
  }

  /* ============ RESEARCH CABIN ============ */
  const res = zone('research-cabin', 'Research cabin');
  {
    add(res, M.makeGlassWall(11, 2.9), -3.5, -6, 0);
    add(res, M.makeGlassWall(10, 2.9), 2, -11, Math.PI / 2);
    add(res, M.makeCabinDesk('code'), -6, -12, 0);
    add(res, M.makeCabinDesk('chart'), -1, -12, 0);
    add(res, M.makeShelf(3), -8, -16.2);
    add(res, M.makePlanterBox(2), 0.5, -6.8);
    personAt(res, -6, -12.9, 0, true);
    personAt(res, 0.5, -10, -Math.PI / 2, false);
  }

  /* ============ LOUNGE ============ */
  const lou = zone('lounge', 'Lounge');
  {
    const rug = M.makeRug(7, 5, 0xd8cfa8); add(lou, rug, -7, 3);
    const s1 = M.makeSofa(3.0); add(lou, s1, -7, 1.2, 0);
    const s2 = M.makeSofa(3.0, 'sofaAccent'); add(lou, s2, -7, 4.8, Math.PI);
    add(lou, M.makeCoffeeTable(), -7, 3);
    const ac = M.makeArmchair(); add(lou, ac, -3.2, 3, -Math.PI / 2); // coffee nook
    const ac2 = M.makeArmchair(); add(lou, ac2, -10.8, 3, Math.PI / 2);
    add(lou, M.makePlanterBox(2.4), -7, 6.4);
    add(lou, M.makeTree(2.6), -11.5, 0.2);
    // living wall on north wall behind lounge
    const lw = M.makeLivingWall(6, 2.6); add(lou, lw, -4, -16.8);
    personAt(lou, -7.8, 1.2, 0, true);
    personAt(lou, -6.2, 4.8, Math.PI, true);
    personAt(lou, -3.2, 3, -Math.PI / 2, true);
    const ws = M.makeWallSign('Ideas to Impact.', '#16A34A');
    add(lou, ws, -FW / 2 + 0.08, 0.5).rotation.y = Math.PI / 2;
  }

  /* ============ ENGINEERING ============ */
  const eng = zone('engineering', 'Engineering');
  {
    const r1 = M.makeDeskRun(4, 'code', true); add(eng, r1, 4, 0.6);
    const r2 = M.makeDeskRun(4, 'code', true); add(eng, r2, 4, 4.6);
    add(eng, M.makePlanterBox(3), 4, 7.6);
    add(eng, M.makeTree(2.4), 0.5, 8.8);
    add(eng, M.makeTree(2.4), 9.5, -1.5);
    personAt(eng, 1.1, -0.45, 0, true);
    personAt(eng, 5.2, 5.65, Math.PI, true);
    personAt(eng, 6.2, -0.45, 0, true);
    personAt(eng, 4, 2.6, Math.PI / 2, false);
    const lb = M.makeDeptLabel('Engineering'); lb.position.y = 3.6; add(eng, lb, 4, 2.6);
    labels.push(lb);
  }

  /* ============ MARKETING ============ */
  const mkt = zone('marketing', 'Marketing');
  {
    const p1 = M.makeWorkPod('chart'); add(mkt, p1, 13.5, 0.5);
    const p2 = M.makeWorkPod('video'); add(mkt, p2, 13.5, 4.8);
    const p3 = M.makeWorkPod('chart'); add(mkt, p3, 18, 2.6);
    add(mkt, M.makePlanterBox(2.4), 15.5, 7.4);
    add(mkt, M.makeTree(2.2), 20.5, 7.5);
    personAt(mkt, 12.65, -1.35, 0, true);
    personAt(mkt, 18.85, 4.45, Math.PI, true);
    const lb = M.makeDeptLabel('Marketing'); lb.position.y = 3.6; add(mkt, lb, 15.5, 2.6);
    labels.push(lb);
  }

  /* ============ DESIGN ============ */
  const des = zone('design', 'Design');
  {
    const p1 = M.makeWorkPod('design'); add(des, p1, 4.5, -9);
    const p2 = M.makeWorkPod('design'); add(des, p2, 4.5, -13);
    const p3 = M.makeWorkPod('code'); add(des, p3, 10, -11);
    add(des, M.makeShelf(2.6), 7.5, -16.2);
    add(des, M.makePlanterBox(2.4), 1.5, -6.8);
    personAt(des, 3.65, -10.85, 0, true);
    personAt(des, 10.85, -9.15, Math.PI, true);
    const ws = M.makeWallSign('Good Design Better Results.', '#16A34A');
    add(des, ws, 7, -16.85);
    const lb = M.makeDeptLabel('Design'); lb.position.y = 3.6; add(des, lb, 6, -11);
    labels.push(lb);
  }

  /* ============ OPERATIONS ============ */
  const ops = zone('operations', 'Operations');
  {
    const p1 = M.makeWorkPod('chart'); add(ops, p1, 16.5, -4.5);
    add(ops, M.makeCabinDesk('code'), 20, -4.5, -Math.PI / 2);
    add(ops, M.makePlanterBox(2), 14, -2.2);
    personAt(ops, 15.65, -6.35, 0, true);
    const ws = M.makeWallSign('Systems Create Freedom.', '#6B7280');
    add(ops, ws, 16.5, -1.9).rotation.y = Math.PI;
    const lb = M.makeDeptLabel('Operations'); lb.position.y = 3.6; add(ops, lb, 17, -4.5);
    labels.push(lb);
  }

  /* ============ CLIENTS ============ */
  const cli = zone('clients', 'Clients');
  {
    add(cli, M.makeGlassWall(8, 2.9), 17, -8, 0);
    add(cli, M.makeGlassWall(8, 2.9), 13, -12, Math.PI / 2);
    add(cli, M.makeConfTable(8), 17, -12);
    add(cli, M.makeTree(2.4), 20.5, -15.5);
    add(cli, M.makePlanterBox(1.8), 14, -8.8);
    personAt(cli, 15.8, -10.85, Math.PI, true);
    personAt(cli, 18.2, -13.15, 0, true);
    const lb = M.makeDeptLabel('Clients'); lb.position.y = 3.4; add(cli, lb, 17, -12);
    labels.push(lb);
  }

  /* ============ CAFE ============ */
  const caf = zone('cafe', 'Cafe');
  {
    const cc = M.makeCafeCounter(6); add(caf, cc, 21, 7, -Math.PI / 2);
    for (let i = 0; i < 4; i++) add(caf, M.makeBarStool(), 19.8, 4.8 + i * 1.5);
    for (let i = 0; i < 3; i++) {
      const hp = M.makeHangingPlant(); add(caf, hp, 21, 5 + i * 2, 0, 4.6);
    }
    for (let i = 0; i < 3; i++) add(caf, M.makeArtPanel(i), 22.85 - 0, -6 + i * 2.2).rotation.y = -Math.PI / 2;
    add(caf, M.makeShelf(2.4), 21.5, 11.5, Math.PI);
    add(caf, M.makeTree(2.6), 17, 12.8);
    const ws = M.makeWallSign('Build Ship Grow Repeat.', '#16A34A');
    add(caf, ws, 22.85, 1.5).rotation.y = -Math.PI / 2;
    personAt(caf, 19.8, 6.3, Math.PI / 2, true);
    personAt(caf, 20.4, 8.5, -Math.PI / 2, false);
  }

  /* ============ PENDANTS ============ */
  const lit = zone('lighting-rig', 'Lighting rig');
  const pendantRows = [
    { x: 4, z: 0.6, n: 5 }, { x: 4, z: 4.6, n: 5 },
    { x: 13.5, z: 0.5, n: 4 }, { x: 13.5, z: 4.8, n: 4 },
    { x: 4.5, z: -9, n: 4 }, { x: 4.5, z: -13, n: 4 },
    { x: -14.5, z: 12.3, n: 3 }, { x: 21, z: 7, n: 4 },
  ];
  const pendantKinds = ['globe', 'dome', 'cylinder'];
  let pendantIdx = 0;
  for (const row of pendantRows) {
    for (let i = 0; i < row.n; i++) {
      const p = M.makePendant(pendantKinds[(pendantIdx++) % 3]);
      add(lit, p, row.x - (row.n - 1) * 0.85 + i * 1.7, row.z, 0, CH);
      pendants.push(p);
    }
  }

  /* ============ WALKERS ============ */
  const wkz = zone('walkers', 'Walkers');
  const walkDefs = [
    { pts: [[-20, -2.5], [20, -2.5]], speed: 1.1 },
    { pts: [[-12, 8.5], [12, 8.5], [12, -3.5], [-12, -3.5]], speed: 0.9 },
    { pts: [[19, 11], [19, -6], [12, -6]], speed: 1.0 },
  ];
  for (const wd of walkDefs) {
    const p = M.makePerson(false);
    add(wkz, p, wd.pts[0][0], wd.pts[0][1]);
    walkers.push({ g: p, pts: wd.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), seg: 0, t: Math.random(), speed: wd.speed });
  }

  // zone home/dir for explode (radial from office center)
  for (const [id, zg] of Object.entries(zones)) {
    zg.userData.home = new THREE.Vector3();
    const c = new THREE.Box3().setFromObject(zg).getCenter(new THREE.Vector3());
    const d = new THREE.Vector3(c.x, 0, c.z);
    zg.userData.dir = d.length() > 0.5 ? d.normalize() : new THREE.Vector3(0, 1, 0);
  }

  return { root, zones, registry, walkers, pendants, labels };
}
