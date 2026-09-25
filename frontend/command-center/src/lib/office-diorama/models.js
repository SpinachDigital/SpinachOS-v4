/* Procedural model factories — one per spec component family.
   Every factory returns a THREE.Group with userData: { id, zone, label, dims, materials }. */
import * as THREE from 'three';
import * as TX from './textures.js';

export const C = {
  concrete: 0xb9b7b2, oak: 0xc9a876, timber: 0x4a3a2c, charcoal: 0x232323,
  warmWhite: 0xf4f1ea, blackMetal: 0x1a1a1a, foliage: 0x2f7a3d, foliageDark: 0x1f5c2a,
  screen: 0x101418, sofa: 0x8a8f98, sofaAccent: 0xd8cfa8, green: 0x16a34a,
};

const _mats = {};
export function mat(name, opts = {}) {
  if (!_mats[name]) {
    const base = {
      concrete: { color: C.concrete, roughness: 0.35 },
      oak: { color: C.oak, roughness: 0.55 },
      timber: { color: C.timber, roughness: 0.6 },
      charcoal: { color: C.charcoal, roughness: 0.9 },
      warmWhite: { color: C.warmWhite, roughness: 0.9 },
      blackMetal: { color: C.blackMetal, roughness: 0.4, metalness: 0.6 },
      foliage: { color: C.foliage, roughness: 0.9 },
      foliageDark: { color: C.foliageDark, roughness: 0.9 },
      screen: { color: C.screen, roughness: 0.3, emissive: 0x223344, emissiveIntensity: 0.4 },
      sofa: { color: C.sofa, roughness: 0.95 },
      sofaAccent: { color: C.sofaAccent, roughness: 0.95 },
      green: { color: C.green, roughness: 0.5 },
      glass: { color: 0xcfe4ea, roughness: 0.08, transparent: true, opacity: 0.28 },
    }[name] || { color: 0x999999, roughness: 0.8 };
    _mats[name] = new THREE.MeshStandardMaterial({ ...base, ...opts });
  }
  return _mats[name];
}

export function grp(id, zone, label, dims = {}) {
  const g = new THREE.Group();
  g.userData = { id, zone, label, dims, selectable: true };
  g.name = id;
  return g;
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const sph = (r, m, w = 10, h = 8) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m);
function put(mesh, x, y, z, ry = 0) { mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
export { put };

/* ---------------- seating ---------------- */
// rounded-rectangle shape (for chair back frame + mesh panel)
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
let _meshMat = null;
function meshBackMat() {
  if (!_meshMat) {
    _meshMat = new THREE.MeshStandardMaterial({ map: TX.meshTexture(), roughness: 0.95, side: THREE.DoubleSide });
  }
  return _meshMat;
}

// Designer-toy task chair: oak frame, mesh back, cushioned seat, 5-star caster base.
// Faces +Z (backrest at -Z). Seat top ~0.51 so seated NPCs still sit correctly.
export function makeChair(accent = false) {
  const g = grp('chair', '', 'Task chair');
  const cushionM = accent ? mat('sofaAccent') : mat('charcoal');
  // five-star base + casters
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leg = put(box(0.30, 0.035, 0.06, mat('blackMetal')), Math.cos(a) * 0.15, 0.085, Math.sin(a) * 0.15);
    leg.rotation.y = -a; g.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('blackMetal'));
    wheel.position.set(Math.cos(a) * 0.30, 0.045, Math.sin(a) * 0.30);
    wheel.scale.set(1, 0.9, 1); wheel.castShadow = true; g.add(wheel);
  }
  // gas lift + mechanism
  g.add(put(cyl(0.032, 0.032, 0.30, mat('blackMetal')), 0, 0.25, 0));
  g.add(put(box(0.24, 0.05, 0.22, mat('blackMetal')), 0, 0.415, 0));
  // oak seat ring + cushion
  g.add(put(cyl(0.27, 0.27, 0.05, mat('oak'), 20), 0, 0.44, 0));
  g.add(put(cyl(0.25, 0.26, 0.08, cushionM, 20), 0, 0.47, 0));
  // back posts (oak)
  strut(new THREE.Vector3(-0.19, 0.47, -0.22), new THREE.Vector3(-0.19, 1.02, -0.29), 0.028, 'oak', g);
  strut(new THREE.Vector3(0.19, 0.47, -0.22), new THREE.Vector3(0.19, 1.02, -0.29), 0.028, 'oak', g);
  // back frame: oak rounded-rect ring
  const frameShape = roundedRect(0.48, 0.58, 0.15);
  frameShape.holes.push(roundedRect(0.37, 0.47, 0.11));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.045, bevelEnabled: false }), mat('oak'));
  frame.position.set(0, 0.78, -0.335); frame.rotation.x = -0.07; frame.castShadow = true; g.add(frame);
  // mesh panel inside the frame
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(0.37, 0.47, 0.11), 24), meshBackMat());
  panel.position.set(0, 0.78, -0.312); panel.rotation.x = -0.07; panel.castShadow = true; g.add(panel);
  // armrests: oak posts + bars
  for (const sx of [-1, 1]) {
    strut(new THREE.Vector3(sx * 0.25, 0.50, 0.06), new THREE.Vector3(sx * 0.25, 0.76, 0.06), 0.026, 'oak', g);
    strut(new THREE.Vector3(sx * 0.25, 0.76, 0.10), new THREE.Vector3(sx * 0.21, 0.80, -0.26), 0.026, 'oak', g);
  }
  return g;
}

export function makeSofa(len = 2.2, mName = 'sofa') {
  const g = grp('sofa', '', 'Sofa');
  const fabric = mat(mName);
  const cushionM = mat(mName === 'sofa' ? 'sofaAccent' : 'sofa');
  // short tapered oak legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(put(cyl(0.035, 0.05, 0.12, mat('oak')), sx * (len / 2 - 0.12), 0.06, sz * 0.36));
  // oak base platform
  g.add(put(box(len, 0.16, 0.88, mat('oak')), 0, 0.2, 0));
  // plump seat cushions (flattened spheres)
  const n = Math.max(2, Math.round(len / 0.75));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.42 + i * ((len - 0.84) / Math.max(1, n - 1));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), i % 2 ? cushionM : fabric);
    c.scale.set(1.0, 0.34, 1.12); c.position.set(x, 0.36, 0.02);
    c.castShadow = c.receiveShadow = true; g.add(c);
  }
  // upholstered backrest, slight recline, with oak back panel
  const back = put(box(len, 0.52, 0.16, fabric), 0, 0.6, -0.38); back.rotation.x = -0.1; g.add(back);
  const backPanel = put(box(len - 0.1, 0.46, 0.05, mat('oak')), 0, 0.6, -0.475); backPanel.rotation.x = -0.1; g.add(backPanel);
  // tilted back cushions
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.42 + i * ((len - 0.84) / Math.max(1, n - 1));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), i % 2 ? fabric : cushionM);
    c.scale.set(1.0, 0.95, 0.42); c.position.set(x, 0.66, -0.26); c.rotation.x = -0.16;
    c.castShadow = c.receiveShadow = true; g.add(c);
  }
  // low rounded oak arms
  for (const sx of [-1, 1]) {
    const arm = put(cyl(0.07, 0.07, 0.8, mat('oak'), 14), sx * (len / 2 - 0.07), 0.56, 0);
    arm.rotation.x = Math.PI / 2; g.add(arm);
    g.add(put(cyl(0.045, 0.055, 0.3, mat('oak')), sx * (len / 2 - 0.07), 0.36, 0.3));
    g.add(put(cyl(0.045, 0.055, 0.3, mat('oak')), sx * (len / 2 - 0.07), 0.36, -0.3));
  }
  // brand-green throw pillow at the left end
  const tp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), mat('green'));
  tp.scale.set(1.0, 1.0, 0.42); tp.position.set(-len / 2 + 0.5, 0.62, -0.14);
  tp.rotation.set(-0.2, 0.15, 0.28); tp.castShadow = true; g.add(tp);
  return g;
}

export function makeArmchair() {
  const g = grp('armchair', '', 'Armchair');
  g.add(put(box(0.8, 0.35, 0.75, mat('sofaAccent')), 0, 0.3, 0));
  g.add(put(box(0.8, 0.5, 0.2, mat('sofaAccent')), 0, 0.6, -0.3));
  g.add(put(box(0.18, 0.28, 0.75, mat('sofaAccent')), -0.4, 0.55, 0));
  g.add(put(box(0.18, 0.28, 0.75, mat('sofaAccent')), 0.4, 0.55, 0));
  return g;
}

export function makeCoffeeTable() {
  const g = grp('coffee-table', '', 'Coffee table');
  g.add(put(box(1.4, 0.05, 0.7, mat('oak')), 0, 0.38, 0));
  for (const [x, z] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]])
    g.add(put(box(0.06, 0.36, 0.06, mat('blackMetal')), x, 0.18, z));
  return g;
}

export function makeBarStool() {
  const g = grp('bar-stool', '', 'Bar stool');
  g.add(put(cyl(0.19, 0.19, 0.06, mat('oak')), 0, 0.78, 0));
  g.add(put(cyl(0.025, 0.025, 0.72, mat('blackMetal')), 0, 0.4, 0));
  g.add(put(cyl(0.2, 0.22, 0.03, mat('blackMetal')), 0, 0.02, 0));
  return g;
}

/* ---------------- desks ---------------- */
function monitor(kind) {
  const g = new THREE.Group();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34),
    new THREE.MeshBasicMaterial({ map: TX.screenTexture(kind) }));
  scr.position.set(0, 1.22, 0); g.add(scr);
  g.add(put(box(0.58, 0.37, 0.03, mat('blackMetal')), 0, 1.22, -0.02));
  g.add(put(cyl(0.02, 0.02, 0.35, mat('blackMetal')), 0, 0.95, -0.02));
  g.add(put(box(0.24, 0.02, 0.18, mat('blackMetal')), 0, 0.77, -0.02));
  return g;
}

export function makeDeskRun(n = 4, kind = 'code', withPlanters = true) {
  const g = grp('desk-run', '', `Desk run x${n}`);
  const W = n * 1.7;
  const top = put(box(W, 0.06, 1.5, mat('oak')), 0, 0.74, 0);
  top.material = mat('oak').clone();
  top.material.map = TX.oakTexture();
  g.add(top);
  for (let i = 0; i <= n; i++)
    g.add(put(box(0.08, 0.71, 1.4, mat('blackMetal')), -W / 2 + i * 1.7, 0.36, 0));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.85 + i * 1.7;
    g.add(put(monitor(kind), x - 0.25, 0, -0.35, Math.PI));
    g.add(put(monitor(kind), x + 0.35, 0, 0.35, Math.PI));
    dressWorkstation(g, x - 0.25, 0, -1); // sitter north
    dressWorkstation(g, x + 0.35, 0, 1);  // sitter south
    const ch1 = makeChair(); ch1.position.set(x - 0.25, 0, -1.05); g.add(ch1);
    const ch2 = makeChair(); ch2.position.set(x + 0.35, 0, 1.05); ch2.rotation.y = Math.PI; g.add(ch2);
  }
  if (withPlanters) {
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.85 + i * 1.7;
      const pb = makePlanterBox(1.5);
      pb.position.set(x, 0.77, 0); g.add(pb);
    }
  }
  return g;
}

export function makeWorkPod(kind = 'code') {
  const g = grp('work-pod', '', 'Work pod (4 desks)');
  for (const [x, z, ry] of [[-0.85, -0.85, 0], [0.85, -0.85, 0], [-0.85, 0.85, Math.PI], [0.85, 0.85, Math.PI]]) {
    const d = put(box(1.6, 0.06, 0.8, mat('oak')), x, 0.74, z, ry);
    g.add(d);
    g.add(put(box(0.08, 0.71, 0.7, mat('blackMetal')), x - 0.7, 0.36, z, ry));
    g.add(put(box(0.08, 0.71, 0.7, mat('blackMetal')), x + 0.7, 0.36, z, ry));
    g.add(put(monitor(kind), x, 0, z + (ry ? 0.25 : -0.25), Math.PI));
    const s = ry ? 1 : -1;
    const mug = makeMug(); mug.position.set(x + 0.55, 0.77, z + s * 0.08); g.add(mug);
    const nb = makeNotebookStack(); nb.position.set(x - 0.55, 0.77, z + s * 0.08); g.add(nb);
    const ch = makeChair();
    ch.position.set(x, 0, z + (ry ? 1.0 : -1.0));
    ch.rotation.y = ry ? Math.PI : 0;
    g.add(ch);
  }
  const pb = makePlanterBox(2.6);
  pb.position.set(0, 0, 0); g.add(pb);
  return g;
}

export function makeCabinDesk(kind = 'code') {
  const g = grp('cabin-desk', '', 'Cabin desk');
  g.add(put(box(1.8, 0.06, 0.9, mat('oak')), 0, 0.74, 0));
  g.add(put(box(0.08, 0.71, 0.8, mat('blackMetal')), -0.8, 0.36, 0));
  g.add(put(box(0.08, 0.71, 0.8, mat('blackMetal')), 0.8, 0.36, 0));
  g.add(put(monitor(kind), -0.3, 0, -0.2, Math.PI));
  g.add(put(monitor(kind), 0.4, 0, -0.2, Math.PI));
  const kb = makeKeyboard(); kb.position.set(0.05, 0.77, -0.38); g.add(kb);
  const mug = makeMug(); mug.position.set(0.62, 0.77, -0.32); g.add(mug);
  const nb = makeNotebookStack(); nb.position.set(-0.6, 0.77, -0.32); g.add(nb);
  const pen = makePen(); pen.position.set(-0.6, 0.822, -0.24); g.add(pen);
  const ch = makeChair(true); ch.position.set(0, 0, -0.9); g.add(ch);
  return g;
}

export function makeConfTable(seats = 8) {
  const g = grp('conf-table', '', 'Conference table');
  g.add(put(box(3.2, 0.07, 1.3, mat('oak')), 0, 0.73, 0));
  g.add(put(box(0.12, 0.7, 1.1, mat('blackMetal')), -1.4, 0.35, 0));
  g.add(put(box(0.12, 0.7, 1.1, mat('blackMetal')), 1.4, 0.35, 0));
  for (let i = 0; i < seats; i++) {
    const side = i % 2 ? 1 : -1;
    const x = -1.2 + Math.floor(i / 2) * 0.8;
    const ch = makeChair();
    ch.position.set(x, 0, side * 1.15);
    ch.rotation.y = side > 0 ? Math.PI : 0;
    g.add(ch);
    const nb = makeNotebookStack(); nb.position.set(x, 0.765, side * 0.38); nb.rotation.y = side * 0.15; g.add(nb);
    const pen = makePen(); pen.position.set(x + 0.18, 0.765, side * 0.42); g.add(pen);
  }
  const tray = makeDeskTray(); tray.position.set(0, 0.765, 0); g.add(tray);
  return g;
}


/* ---------------- desk accessories (Phase 7) ---------------- */
export function makeKeyboard() {
  const g = new THREE.Group();
  const base = put(box(0.46, 0.025, 0.17, mat('charcoal')), 0, 0.013, 0);
  base.castShadow = true; g.add(base);
  const keyM = mat('concrete');
  for (let r = 0; r < 3; r++)
    g.add(put(box(0.42, 0.01, 0.028, keyM), 0, 0.028, -0.055 + r * 0.045));
  g.add(put(box(0.2, 0.01, 0.028, keyM), 0, 0.028, 0.08));
  return g;
}

export function makeMug() {
  const g = new THREE.Group();
  g.add(put(cyl(0.062, 0.062, 0.012, mat('oak'), 14), 0, 0.006, 0)); // coaster
  g.add(put(cyl(0.045, 0.04, 0.1, mat('warmWhite'), 14), 0, 0.062, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 8, 14, Math.PI), mat('warmWhite'));
  handle.position.set(0.052, 0.062, 0); handle.rotation.z = -Math.PI / 2; handle.castShadow = true; g.add(handle);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.016, 12), mat('green'));
  dot.position.set(0, 0.062, 0.046); g.add(dot);
  return g;
}

export function makeNotebookStack() {
  const g = new THREE.Group();
  g.add(put(box(0.22, 0.025, 0.3, mat('warmWhite')), 0, 0.013, 0));
  const top = put(box(0.2, 0.025, 0.28, mat('green')), 0.01, 0.038, 0.01);
  top.rotation.y = 0.14; top.castShadow = true; g.add(top);
  return g;
}

export function makePen() {
  const g = new THREE.Group();
  const p = put(cyl(0.008, 0.008, 0.14, mat('charcoal'), 8), 0, 0.008, 0);
  p.rotation.z = Math.PI / 2; p.rotation.y = 0.5; p.castShadow = true; g.add(p);
  return g;
}

export function makeDeskTray() {
  const g = new THREE.Group();
  g.add(put(box(0.34, 0.03, 0.24, mat('oak')), 0, 0.015, 0));
  const cols = [0xf5e6a8, 0xa8d5a8, 0xf5b8a8];
  for (let i = 0; i < 3; i++)
    g.add(put(box(0.09, 0.022, 0.09,
      new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.9 })), -0.1 + i * 0.1, 0.041, 0));
  return g;
}

// Dress one workstation: keyboard + mug + notebooks + pen.
// (cx, cz): desk-center x/z reference; side: -1 = sitter north (facing +z), +1 = sitter south.
export function dressWorkstation(g, cx, cz, side, topY = 0.77) {
  const az = cz + side * 0.5;
  const kb = makeKeyboard(); kb.position.set(cx, topY, az); kb.rotation.y = side > 0 ? Math.PI : 0; g.add(kb);
  const mug = makeMug(); mug.position.set(cx + 0.38, topY, az - side * 0.05); g.add(mug);
  const nb = makeNotebookStack(); nb.position.set(cx - 0.35, topY, az); nb.rotation.y = side * 0.2; g.add(nb);
  const pen = makePen(); pen.position.set(cx - 0.35, topY + 0.052, az + 0.08); g.add(pen);
}

/* ---------------- planting ---------------- */
// Shared tapered pot with rim + soil. mName: 'oak' | 'warmWhite' | 'charcoal'.
function makePot(r = 0.26, mName = 'oak') {
  const g = new THREE.Group();
  const m = mat(mName);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.45, 20), m);
  body.position.y = r * 0.725; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, r * 0.10, 10, 28), m);
  rim.rotation.x = Math.PI / 2; rim.position.y = r * 1.45; rim.castShadow = true; g.add(rim);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.05, 20), mat('timber'));
  soil.position.y = r * 1.40; soil.receiveShadow = true; g.add(soil);
  g.userData.soilY = r * 1.42;
  return g;
}

const LEAF = new THREE.SphereGeometry(1, 10, 8);
// flattened-sphere leaf; rx/ry/rz radians
function leaf(sx, sy, sz, mName, x, y, z, rx = 0, ry = 0, rz = 0, parent) {
  const l = new THREE.Mesh(LEAF, mat(mName));
  l.scale.set(sx, sy, sz); l.position.set(x, y, z); l.rotation.set(rx, ry, rz);
  l.castShadow = true; parent.add(l); return l;
}
// cylinder strut between two points
function strut(p1, p2, r, mName, parent) {
  const d = new THREE.Vector3().subVectors(p2, p1);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 8), mat(mName));
  m.position.copy(p1).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; parent.add(m); return m;
}
function angDist(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

// Monstera leaf: extruded shape with carved slits (cached geometry).
let _monsteraGeo = null;
function monsteraGeo() {
  if (_monsteraGeo) return _monsteraGeo;
  const s = 0.52;
  const sh = new THREE.Shape();
  const slits = [];
  for (const off of [0.36, 0.70, 1.04]) {
    slits.push(Math.PI / 2 - off, Math.PI / 2 + off, -Math.PI / 2 - off, -Math.PI / 2 + off);
  }
  const N = 84;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const up = Math.cos(a);
    let r = s * (0.60 + 0.16 * up);
    const side = Math.min(1, Math.abs(Math.sin(a)) * 1.6);
    let cut = 0;
    for (const sa of slits) {
      const d = angDist(a, sa);
      cut = Math.max(cut, Math.exp(-(d * d) / (2 * 0.075 * 0.075)));
    }
    r *= 1 - 0.38 * cut * side;
    const x = Math.sin(a) * r, y = up * r * 1.12;
    if (i) sh.lineTo(x, y); else sh.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(sh,
    { depth: s * 0.05, bevelEnabled: true, bevelThickness: s * 0.02, bevelSize: s * 0.02, bevelSegments: 1 });
  geo.center();
  _monsteraGeo = geo;
  return geo;
}

function monsteraPlant(scale = 1) {
  const g = new THREE.Group();
  const pot = makePot(0.26, 'oak'); g.add(pot);
  const sy = pot.userData.soilY;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const sx = Math.cos(a), sz = Math.sin(a);
    const hgt = (0.55 + (i % 3) * 0.18) * scale;
    const tilt = 0.28 + (i % 2) * 0.12;
    const bx = sx * 0.06, bz = sz * 0.06;
    const tx = bx + sx * Math.sin(tilt) * hgt, tz = bz + sz * Math.sin(tilt) * hgt;
    const ty = sy + Math.cos(tilt) * hgt;
    strut(new THREE.Vector3(bx, sy, bz), new THREE.Vector3(tx, ty, tz), 0.026, 'foliageDark', g);
    const holder = new THREE.Group();
    holder.position.set(tx, ty + 0.05 * scale, tz);
    holder.lookAt(tx + sx * 2, ty + 1.1, tz + sz * 2);
    const lf = new THREE.Mesh(monsteraGeo(), mat(i % 2 ? 'foliage' : 'foliageDark'));
    const ls = (0.9 + (i % 3) * 0.18) * scale;
    lf.scale.set(ls, ls, ls); lf.rotation.x = -0.35; lf.castShadow = true;
    holder.add(lf); g.add(holder);
  }
  return g;
}

function fiddlePlant(scale = 1) {
  const g = new THREE.Group();
  const pot = makePot(0.24, 'warmWhite'); g.add(pot);
  const sy = pot.userData.soilY;
  const trunkH = 1.15 * scale;
  strut(new THREE.Vector3(0, sy, 0), new THREE.Vector3(0, sy + trunkH, 0), 0.05, 'timber', g);
  const nL = 8;
  for (let i = 0; i < nL; i++) {
    const t = i / (nL - 1);
    const y = sy + trunkH * (0.35 + 0.62 * t);
    const a = i * 2.4 + 0.5;
    const ls = (0.17 - t * 0.05) * scale;
    leaf(ls, ls * 1.3, ls * 0.35, i % 2 ? 'foliage' : 'foliageDark',
      Math.cos(a) * 0.24 * scale, y, Math.sin(a) * 0.24 * scale,
      -0.35, Math.PI / 2 - a, 0, g);
  }
  leaf(0.15 * scale, 0.2 * scale, 0.06, 'foliage', 0, sy + trunkH + 0.14 * scale, 0, -0.3, 0, 0, g);
  return g;
}

function topiaryPlant(scale = 1) {
  const g = new THREE.Group();
  const pot = makePot(0.26, 'warmWhite'); g.add(pot);
  const sy = pot.userData.soilY;
  const trunkH = 0.72 * scale;
  strut(new THREE.Vector3(0, sy, 0), new THREE.Vector3(0, sy + trunkH, 0), 0.05, 'timber', g);
  const R = 0.46 * scale, cy = sy + trunkH + R * 0.82;
  const core = new THREE.Mesh(new THREE.SphereGeometry(R, 18, 14), mat('foliageDark'));
  core.position.y = cy; core.castShadow = true; g.add(core);
  const nB = 30, golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nB; i++) {
    const y = 1 - (i / (nB - 1)) * 2, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = golden * i;
    const br = 0.105 * scale * (0.8 + ((i * 37) % 10) / 22);
    leaf(br, br * 0.9, br * 0.9, i % 3 ? 'foliage' : 'foliageDark',
      Math.cos(th) * rad * R * 0.98, cy + y * R * 0.98, Math.sin(th) * rad * R * 0.98,
      0, 0, 0, g);
  }
  return g;
}

function bushyTree(scale = 1) {
  const g = new THREE.Group();
  const pot = makePot(0.3, 'oak'); g.add(pot);
  const sy = pot.userData.soilY;
  const trunkH = 0.85 * scale;
  const top = new THREE.Vector3(0, sy + trunkH, 0);
  strut(new THREE.Vector3(0, sy, 0), top, 0.06, 'timber', g);
  const blobs = [
    [0, 1.42, 0, 0.52], [0.44, 1.14, 0.16, 0.40], [-0.42, 1.16, -0.14, 0.42],
    [0.06, 1.08, 0.44, 0.38], [-0.08, 1.06, -0.44, 0.38],
  ];
  let bi = 0;
  for (const [bx, by, bz, br] of blobs) {
    const c = new THREE.Vector3(bx * scale, sy + by * scale, bz * scale);
    strut(top, c, 0.035, 'timber', g);
    const core = new THREE.Mesh(new THREE.SphereGeometry(br * scale, 16, 12),
      mat(bi % 2 ? 'foliage' : 'foliageDark'));
    core.position.copy(c); core.castShadow = true; g.add(core);
    const nB = 9, golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nB; i++) {
      const y = 1 - (i / (nB - 1)) * 2, rad = Math.sqrt(Math.max(0, 1 - y * y)), th = golden * i + bi;
      const sbr = 0.11 * scale;
      leaf(sbr, sbr * 0.85, sbr * 0.85, (i + bi) % 3 ? 'foliage' : 'foliageDark',
        c.x + Math.cos(th) * rad * br * scale * 0.95, c.y + y * br * scale * 0.95, c.z + Math.sin(th) * rad * br * scale * 0.95,
        0, 0, 0, g);
    }
    bi++;
  }
  return g;
}

const TREE_SPECIES = ['monstera', 'fiddle', 'topiary', 'bushy'];
let _treeIdx = 0;
export function makeTree(h = 2.6, species) {
  const g = grp('tree', '', 'Potted tree');
  const sp = species || TREE_SPECIES[(_treeIdx++) % TREE_SPECIES.length];
  const s = h / 2.6;
  g.add(sp === 'monstera' ? monsteraPlant(s)
    : sp === 'fiddle' ? fiddlePlant(s)
    : sp === 'topiary' ? topiaryPlant(s) : bushyTree(s));
  g.userData.dims = { h, species: sp };
  return g;
}

export function makeSucculent() {
  const g = grp('succulent', '', 'Succulent cluster');
  const pot = makePot(0.15, 'charcoal'); g.add(pot);
  const sy = pot.userData.soilY;
  const rings = [[6, 0.35, 0.14], [9, 0.62, 0.17]];
  let li = 0;
  for (const [count, tilt, len] of rings) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tilt * 2;
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.045, len, 8), mat(li % 2 ? 'foliage' : 'foliageDark'));
      lf.scale.set(1, 1, 0.7);
      lf.position.set(Math.cos(a) * 0.05, sy + len * 0.32, Math.sin(a) * 0.05);
      lf.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      lf.castShadow = true; g.add(lf); li++;
    }
  }
  return g;
}

// one leafy tuft for planter boxes
function tuft(parent, x, y, z) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const s = 0.085;
    leaf(s, s * 1.15, s * 0.65, i % 2 ? 'foliage' : 'foliageDark',
      x + Math.cos(a) * 0.07, y + 0.10 + (i % 3) * 0.03, z + Math.sin(a) * 0.07,
      0.40, Math.PI / 2 - a, 0, parent);
  }
  leaf(0.07, 0.16, 0.06, 'foliageDark', x, y + 0.18, z, 0.15, 0, 0, parent);
}

export function makePlanterBox(len = 1.6) {
  const g = grp('planter-box', '', 'Planter box');
  const H = 0.34, D = 0.36;
  g.add(put(box(len, 0.06, D, mat('timber')), 0, 0.03, 0));
  for (const z of [-D / 2 + 0.03, D / 2 - 0.03])
    for (let s = 0; s < 3; s++)
      g.add(put(box(len, 0.07, 0.05, mat('timber')), 0, 0.10 + s * 0.095, z));
  for (const x of [-len / 2 + 0.03, len / 2 - 0.03])
    g.add(put(box(0.06, H, D, mat('timber')), x, H / 2, 0));
  g.add(put(box(len - 0.1, 0.05, D - 0.1, mat('charcoal')), 0, H + 0.01, 0));
  const n = Math.max(2, Math.round(len / 0.45));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.3 + (i * (len - 0.6)) / Math.max(1, n - 1);
    tuft(g, x, H + 0.03, (i % 2 ? 0.06 : -0.06));
  }
  return g;
}

export function makeHangingPlant() {
  const g = grp('hanging-plant', '', 'Hanging plant');
  for (const a of [0, 2.1, 4.2]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 6), mat('timber'));
    cord.position.set(Math.cos(a) * 0.14, -0.35, Math.sin(a) * 0.14);
    cord.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(cord);
  }
  const pot = makePot(0.16, 'warmWhite'); pot.position.y = -1.25; g.add(pot);
  const sy = -1.25 + pot.userData.soilY;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, s = 0.06 + (i % 3) * 0.015;
    leaf(s, s * 1.3, s * 0.5, i % 2 ? 'foliage' : 'foliageDark',
      Math.cos(a) * 0.1, sy + 0.08 + (i % 2) * 0.05, Math.sin(a) * 0.1,
      0.4, a, 0, g);
  }
  for (let v = 0; v < 7; v++) {
    const a = (v / 7) * Math.PI * 2 + 0.3;
    const len = 0.5 + (v % 3) * 0.18;
    const nL = 6;
    for (let i = 0; i < nL; i++) {
      const t = (i + 1) / nL;
      const s = 0.055 * (1 - t * 0.35);
      leaf(s, s * 1.4, s * 0.45, i % 2 ? 'foliage' : 'foliageDark',
        Math.cos(a) * (0.14 + t * 0.07), sy - t * len, Math.sin(a) * (0.14 + t * 0.07),
        0.9, a, 0, g);
    }
  }
  return g;
}

export function makeLivingWall(w = 3.2, h = 1.8) {
  const g = grp('living-wall', '', 'Living green wall');
  g.add(put(box(w, h, 0.1, mat('timber')), 0, h / 2, 0));                       // timber frame
  g.add(put(box(w - 0.24, h - 0.24, 0.06, mat('foliageDark')), 0, h / 2, 0.06)); // moss bed
  const cols = Math.max(3, Math.round(w / 0.55)), rows = Math.max(2, Math.round(h / 0.55));
  for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
    const px = -w / 2 + 0.3 + (cx + 0.5 * (cy % 2)) * ((w - 0.6) / cols);
    const py = 0.3 + cy * ((h - 0.6) / Math.max(1, rows - 1));
    const s = 0.13 + ((cx * 7 + cy * 13) % 5) * 0.02;
    leaf(s, s * 1.15, s * 0.55, (cx + cy) % 3 === 0 ? 'foliage' : ((cx + cy) % 3 === 1 ? 'foliageDark' : 'green'),
      px, py, 0.12 + ((cx * 3 + cy) % 3) * 0.04, 0.35, (cx * 2.4 + cy * 1.7) % 6.28, 0, g);
  }
  const vines = Math.max(2, Math.round(w / 1.5));                                // trailing vines
  for (let v = 0; v < vines; v++) {
    const px = -w / 2 + 0.4 + v * ((w - 0.8) / Math.max(1, vines - 1));
    const len = 0.4 + (v % 3) * 0.2;
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 5, s = 0.06 * (1 - t * 0.3);
      leaf(s, s * 1.3, s * 0.5, i % 2 ? 'foliage' : 'foliageDark', px, 0.15 - t * len, 0.10, 0.8, v * 2.1, 0, g);
    }
  }
  return g;
}

/* ---------------- people (designer-toy NPCs v2, from npc-character-sheet) ---------------- */
const NPC = {
  skin: [0xf2c9a0, 0xc9a189, 0x9c6b43, 0x6b4226],
  top: [0x2b2f36, 0xf4f1ea, 0x5b6b4f, 0x16a34a, 0x3b4a5a, 0xe8e2d5],
  bottom: [0x2b2f36, 0x3a3f47, 0x4a4438],
  hair: [0x1c1a17, 0x3d2b1f, 0x5a4632, 0x77716b, 0x8a5a2b],
  hijab: [0x9caf88, 0xd6cfc2, 0x5b6b4f],
};
const _npcMats = new Map();
function npcMat(color, rough = 0.75) {
  const k = color + '|' + rough;
  if (!_npcMats.has(k)) _npcMats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return _npcMats.get(k);
}
const G_SPH = new THREE.SphereGeometry(1, 20, 14);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
function npcPart(geo, material, sx, sy, sz, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true; parent.add(m); return m;
}
const npcPick = a => a[Math.floor(Math.random() * a.length)];

function makeHead(o) {
  // origin at neck base; faces +Z. Big rounded designer-toy head.
  const g = new THREE.Group();
  const skin = npcMat(o.skin), hairM = npcMat(o.hair, 0.9), dark = npcMat(0x23272e, 0.5);
  npcPart(G_CYL, skin, 0.05, 0.09, 0.05, 0, 0.045, 0, g);              // neck
  npcPart(G_SPH, skin, 0.155, 0.155, 0.15, 0, 0.24, 0.01, g);           // head
  npcPart(G_SPH, skin, 0.032, 0.032, 0.03, -0.15, 0.24, 0.01, g);       // ears
  npcPart(G_SPH, skin, 0.032, 0.032, 0.03, 0.15, 0.24, 0.01, g);
  npcPart(G_SPH, dark, 0.021, 0.026, 0.012, -0.058, 0.26, 0.15, g);     // dot eyes
  npcPart(G_SPH, dark, 0.021, 0.026, 0.012, 0.058, 0.26, 0.15, g);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 20, Math.PI * 0.8), dark);
  smile.position.set(0, 0.198, 0.15); smile.rotation.z = Math.PI * 1.1;  // smile arc
  smile.castShadow = true; g.add(smile);
  const hy = 0.30;
  if (o.hairStyle === 'curly') {
    npcPart(G_SPH, hairM, 0.15, 0.08, 0.145, 0, hy + 0.03, -0.01, g);   // under-cap
    for (let i = 0; i < 10; i++) {                                     // curls
      const a = (i / 10) * Math.PI * 2, r = 0.115;
      npcPart(G_SPH, hairM, 0.055, 0.055, 0.055,
        Math.cos(a) * r, hy + 0.06 + Math.random() * 0.03, Math.sin(a) * r * 0.9 - 0.01, g);
    }
  } else if (o.hairStyle === 'bun') {
    npcPart(G_SPH, hairM, 0.16, 0.115, 0.155, 0, hy + 0.015, -0.012, g);
    npcPart(G_SPH, hairM, 0.062, 0.062, 0.062, 0, hy + 0.13, -0.09, g); // bun
  } else if (o.hairStyle === 'long') {
    npcPart(G_SPH, hairM, 0.163, 0.175, 0.158, 0, hy - 0.02, -0.035, g); // back fall
    npcPart(G_SPH, hairM, 0.158, 0.10, 0.152, 0, hy + 0.03, 0, g);       // top
  } else if (o.hairStyle === 'hijab') {
    const hm = npcMat(o.hijabC, 0.9);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.178, 20, 14, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1, 0, Math.PI * 0.72), hm);
    shell.position.set(0, 0.25, -0.01); shell.castShadow = true; g.add(shell); // open at face
    npcPart(G_CYL, hm, 0.115, 0.16, 0.115, 0, 0.02, -0.01, g);          // drape
  } else { // crop / sidepart
    npcPart(G_SPH, hairM, 0.16, 0.115, 0.155, 0, hy + 0.015, -0.012, g);
    if (o.hairStyle === 'sidepart') {
      const fr = npcPart(G_BOX, hairM, 0.15, 0.045, 0.05, 0.04, hy + 0.055, 0.125, g);
      fr.rotation.z = 0.25;                                              // swept fringe
    }
  }
  if (o.glasses) {
    const gm = npcMat(0x2b2f36, 0.4);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0075, 8, 20), gm);
      lens.position.set(sx * 0.058, 0.26, 0.155); lens.castShadow = true; g.add(lens);
    }
    npcPart(G_BOX, gm, 0.032, 0.008, 0.008, 0, 0.26, 0.155, g);         // bridge
  }
  return g;
}

export function makePerson(seated = true, opts = {}) {
  const g = grp('person', '', 'Staff member');
  const o = {
    skin: opts.skin ?? npcPick(NPC.skin),
    top: opts.top ?? npcPick(NPC.top),
    bottom: opts.bottom ?? npcPick(NPC.bottom),
    hair: opts.hair ?? npcPick(NPC.hair),
    hairStyle: opts.hairStyle ?? npcPick(['crop', 'crop', 'sidepart', 'curly', 'bun', 'long', 'hijab']),
    hijabC: opts.hijabC ?? npcPick(NPC.hijab),
    glasses: opts.glasses ?? Math.random() < 0.3,
  };
  const top = npcMat(o.top), bot = npcMat(o.bottom), skin = npcMat(o.skin);
  const shoeM = npcMat(0x23272e, 0.6);
  if (seated) {
    for (const sx of [-1, 1]) {
      npcPart(G_BOX, bot, 0.11, 0.11, 0.36, sx * 0.085, 0.47, 0.15, g);   // thigh
      npcPart(G_BOX, bot, 0.10, 0.40, 0.10, sx * 0.085, 0.23, 0.31, g);   // shin
      npcPart(G_BOX, shoeM, 0.11, 0.09, 0.24, sx * 0.085, 0.045, 0.34, g); // shoe
    }
    npcPart(G_BOX, bot, 0.27, 0.13, 0.18, 0, 0.52, -0.02, g);             // hips
    npcPart(G_CYL, top, 0.14, 0.50, 0.135, 0, 0.83, -0.01, g);            // torso
    npcPart(G_SPH, top, 0.15, 0.085, 0.12, 0, 1.08, -0.01, g);            // shoulders
    for (const sx of [-1, 1]) {                                          // arms reaching to desk
      const arm = npcPart(G_CYL, top, 0.048, 0.46, 0.048, sx * 0.205, 0.90, 0.16, g);
      arm.rotation.x = -0.55;
      npcPart(G_SPH, skin, 0.052, 0.052, 0.052, sx * 0.205, 0.70, 0.30, g); // hands
    }
    const head = makeHead(o); head.position.y = 1.10; g.add(head);
  } else {
    for (const sx of [-1, 1]) {
      npcPart(G_CYL, bot, 0.062, 0.60, 0.062, sx * 0.085, 0.39, 0, g);     // legs
      npcPart(G_BOX, shoeM, 0.11, 0.09, 0.24, sx * 0.085, 0.045, 0.03, g); // shoes
    }
    npcPart(G_CYL, bot, 0.135, 0.16, 0.125, 0, 0.74, 0, g);               // hips
    npcPart(G_CYL, top, 0.14, 0.52, 0.135, 0, 1.06, 0, g);                // torso
    npcPart(G_SPH, top, 0.15, 0.085, 0.12, 0, 1.32, 0, g);                // shoulders
    for (const sx of [-1, 1]) {
      const arm = npcPart(G_CYL, top, 0.048, 0.46, 0.048, sx * 0.205, 1.04, 0, g);
      arm.rotation.z = sx * 0.10;
      npcPart(G_SPH, skin, 0.055, 0.06, 0.055, sx * 0.225, 0.79, 0, g);    // hands
    }
    const head = makeHead(o); head.position.y = 1.345; g.add(head);
  }
  return g;
}

/* ---------------- reception / cafe ---------------- */
export function makeReceptionDesk() {
  const g = grp('reception-desk', 'reception', 'Curved reception desk');
  const curve = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.05, 24, 1, true, Math.PI * 0.9, Math.PI * 0.7),
    mat('timber'));
  curve.position.y = 0.55; curve.castShadow = true; g.add(curve);
  // vertical oak slats around the curved front
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = Math.PI * 0.9 + ((i + 0.5) / N) * Math.PI * 0.7;
    const slat = put(box(0.11, 1.0, 0.04, mat('oak')), 2.63 * Math.sin(a), 0.55, 2.63 * Math.cos(a));
    slat.rotation.y = a; slat.castShadow = true; g.add(slat);
  }
  // oak base trim + rounded white stone top
  const trim = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.68, 0.1, 24, 1, true, Math.PI * 0.9, Math.PI * 0.7),
    mat('oak'));
  trim.position.y = 0.06; g.add(trim);
  const topCurve = new THREE.Mesh(new THREE.CylinderGeometry(2.78, 2.78, 0.07, 24, 1, true, Math.PI * 0.9, Math.PI * 0.7),
    mat('warmWhite'));
  topCurve.position.y = 1.1; topCurve.castShadow = true; g.add(topCurve);
  g.add(put(monitor('chart'), 0.4, 0, 0.4, Math.PI * 1.25));
  const pb = makePlanterBox(1.2); pb.position.set(-1.2, 1.14, 0.6); g.add(pb);
  // brand green dot on the slatted front
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), mat('green'));
  dot.position.set(0, 0.62, -2.67); dot.rotation.y = Math.PI; g.add(dot);
  // green 'hello' desk sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.04),
    [mat('oak'), mat('oak'), mat('oak'), mat('oak'),
     new THREE.MeshStandardMaterial({ map: TX.helloSignTexture(), roughness: 0.7 }), mat('oak')]);
  sign.position.set(1.25, 1.29, 0.15); sign.rotation.y = -0.35; sign.castShadow = true; g.add(sign);
  g.add(put(box(0.42, 0.03, 0.12, mat('oak')), 1.25, 1.15, 0.15));
  // tiny succulent in oak pot
  const ss = makeSucculent(); ss.scale.setScalar(0.7); ss.position.set(-0.25, 1.14, 0.95); g.add(ss);
  return g;
}

export function makeCafeCounter(len = 6) {
  const g = grp('cafe-counter', 'cafe', 'Cafe counter');
  g.add(put(box(len, 0.95, 0.7, mat('timber')), 0, 0.475, 0));                 // timber base
  g.add(put(box(len - 0.3, 0.6, 0.02, mat('charcoal')), 0, 0.48, 0.355));     // charcoal front panel
  g.add(put(box(len - 0.3, 0.08, 0.025, mat('green')), 0, 0.72, 0.355));      // brand green stripe
  g.add(put(box(len + 0.2, 0.06, 0.9, mat('warmWhite')), 0, 1.0, 0));         // stone top
  for (const sx of [-1, 1])                                                  // oak corner posts
    g.add(put(box(0.12, 0.95, 0.78, mat('oak')), sx * (len / 2 - 0.06), 0.475, 0));
  // --- espresso machine ---
  const ex = -len / 2 + 1.15, ez = -0.05;
  g.add(put(box(0.6, 0.42, 0.45, mat('charcoal')), ex, 1.27, ez));
  g.add(put(box(0.5, 0.26, 0.02, mat('concrete')), ex, 1.24, ez + 0.23));     // steel front
  g.add(put(box(0.56, 0.03, 0.4, mat('blackMetal')), ex, 1.05, ez));          // drip tray
  g.add(put(cyl(0.035, 0.035, 0.1, mat('blackMetal'), 10), ex - 0.12, 1.14, ez + 0.24));
  const pf = put(cyl(0.018, 0.018, 0.22, mat('blackMetal'), 8), ex - 0.12, 1.1, ez + 0.33);
  pf.rotation.x = 1.15; g.add(pf);                                            // portafilter handle
  g.add(put(box(0.5, 0.04, 0.35, mat('blackMetal')), ex, 1.5, ez));           // cup warmer
  // --- cup stack ---
  for (let i = 0; i < 3; i++)
    g.add(put(cyl(0.042, 0.032, 0.075, mat('warmWhite'), 12), -0.8, 1.07 + i * 0.068, 0.12));
  // --- pastry tray ---
  g.add(put(box(0.55, 0.03, 0.32, mat('oak')), 0.4, 1.045, 0.1));
  const pastryM = new THREE.MeshStandardMaterial({ color: 0xc98d4e, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), pastryM);
    cr.scale.set(1.35, 0.72, 0.9); cr.position.set(0.22 + i * 0.18, 1.1, 0.1);
    cr.castShadow = true; g.add(cr);
  }
  // --- menu board on stand ---
  const mb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.025),
    [mat('timber'), mat('timber'), mat('timber'), mat('timber'),
     new THREE.MeshStandardMaterial({ map: TX.menuBoardTexture(), roughness: 0.85 }), mat('timber')]);
  mb.position.set(1.75, 1.36, -0.05); mb.rotation.y = -0.25; mb.castShadow = true; g.add(mb);
  g.add(put(cyl(0.025, 0.025, 0.26, mat('timber'), 10), 1.75, 1.17, -0.05));
  g.add(put(cyl(0.09, 0.11, 0.03, mat('timber'), 12), 1.75, 1.045, -0.05));
  return g;
}

export function makeShelf(w = 3) {
  const g = grp('shelf', '', 'Display shelf');
  for (let i = 0; i < 3; i++) {
    g.add(put(box(w, 0.05, 0.35, mat('oak')), 0, 0.8 + i * 0.55, 0));
    const n = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < n; b++) {
      const bh = 0.25 + Math.random() * 0.2;
      g.add(put(box(0.18, bh, 0.22, new THREE.MeshStandardMaterial({ color: NPC.top[Math.floor(Math.random() * NPC.top.length)], roughness: 0.8 })),
        -w / 2 + 0.3 + b * (w - 0.6) / Math.max(1, n - 1), 0.8 + i * 0.55 + bh / 2 + 0.025, 0));
    }
  }
  g.add(put(box(0.06, 2.2, 0.35, mat('timber')), -w / 2, 1.1, 0));
  g.add(put(box(0.06, 2.2, 0.35, mat('timber')), w / 2, 1.1, 0));
  return g;
}

/* ---------------- architecture ---------------- */
export function makeGlassWall(w, h) {
  const g = grp('glass-wall', '', 'Glass partition');
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: 0xcfe4ea, roughness: 0.08, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  glass.position.y = h / 2; g.add(glass);
  const n = Math.max(2, Math.round(w / 2.2));
  for (let i = 0; i <= n; i++)
    g.add(put(box(0.08, h, 0.08, mat('blackMetal')), -w / 2 + (w * i) / n, h / 2, 0));
  g.add(put(box(w, 0.08, 0.1, mat('blackMetal')), 0, h - 0.04, 0));
  g.add(put(box(w, 0.06, 0.1, mat('blackMetal')), 0, 0.03, 0));
  return g;
}

let _glowMat = null;
function glowMat() {
  if (!_glowMat) _glowMat = new THREE.MeshStandardMaterial({
    color: 0xfff2dd, emissive: 0xffc98a, emissiveIntensity: 1.7, roughness: 0.55,
  });
  return _glowMat;
}

export function makePendant(kind = 'dome') {
  const g = grp('pendant', '', 'Pendant light');
  const drop = 2.55;
  g.add(put(cyl(0.06, 0.075, 0.06, mat('oak'), 12), 0, -0.03, 0));      // oak ceiling cap
  g.add(put(cyl(0.012, 0.012, drop, mat('blackMetal'), 8), 0, -drop / 2, 0)); // cord
  const sy = -drop;
  if (kind === 'globe') {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), glowMat());
    globe.position.y = sy - 0.08; globe.castShadow = true; g.add(globe);
    g.add(put(cyl(0.05, 0.065, 0.09, mat('oak'), 12), 0, sy + 0.1, 0)); // oak socket
  } else if (kind === 'cylinder') {
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.34, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: C.oak, roughness: 0.6, side: THREE.DoubleSide }));
    shade.position.y = sy - 0.1; shade.castShadow = true; g.add(shade);
    g.add(put(cyl(0.05, 0.05, 0.06, mat('blackMetal'), 10), 0, sy + 0.08, 0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glowMat());
    bulb.position.y = sy - 0.22; g.add(bulb);
  } else {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.35), mat('charcoal'));
    dome.position.y = sy - 0.02; dome.castShadow = true; g.add(dome);
    g.add(put(cyl(0.045, 0.045, 0.07, mat('blackMetal'), 10), 0, sy + 0.12, 0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glowMat());
    bulb.position.y = sy - 0.2; g.add(bulb);
  }
  return g;
}

export function makeSkylight(w = 6, d = 2) {
  const g = grp('skylight', '', 'Skylight strip');
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color: 0xd8ecf4, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  pane.rotation.x = Math.PI / 2; g.add(pane);
  g.add(put(box(w + 0.2, 0.12, 0.15, mat('blackMetal')), 0, 0, -d / 2));
  g.add(put(box(w + 0.2, 0.12, 0.15, mat('blackMetal')), 0, 0, d / 2));
  return g;
}

export function makeRug(w = 4, d = 3, color = 0xcfc8b8) {
  const g = grp('rug', '', 'Area rug');
  const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.02; r.receiveShadow = true; g.add(r);
  return g;
}

export function makeArtPanel(variant = 0) {
  const g = grp('art-panel', '', 'Wall art');
  g.add(put(box(1.1, 1.4, 0.06, mat('blackMetal')), 0, 0, -0.03));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3),
    new THREE.MeshBasicMaterial({ map: TX.artTexture(variant) }));
  art.position.z = 0.01; g.add(art);
  return g;
}

export function makeDeptLabel(name) {
  const g = grp('dept-label', '', `${name} label`);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TX.deptLabelTexture(name), transparent: true, depthWrite: false,
  }));
  sp.scale.set(3.4, 1.06, 1);
  g.add(sp);
  g.userData.baseY = 0;
  return g;
}

export function makeWallSign(text, accent) {
  const g = grp('wall-sign', '', 'Wall sign');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshBasicMaterial({ map: TX.statementTexture(text, 1024, 256, accent), transparent: true }));
  g.add(m);
  return g;
}
