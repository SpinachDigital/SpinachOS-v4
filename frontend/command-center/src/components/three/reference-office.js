// reference-office.js — the 3D office extracted verbatim from spinach-os.html
// (lines 55169–57313): procedural textures → 141-component kit → buildOffice()
// → initOfficeViewport(). Exported for the React wrapper.
// @ts-nocheck — vendored reference module, kept verbatim on purpose.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ===== three/textures.js ===== */
/* Procedural canvas textures for the Spinach Labs office scene.
   Brand lockup: stacked "spinach" Bold + green dot as the dot of the "i",
   "labs" wide-tracked Regular right-aligned beneath. Palette: #16A34A, #0B0F0B, #F8F9F7. */

const GREEN = '#16A34A';
const CHARCOAL = '#0B0F0B';
const WARM_WHITE = '#F8F9F7';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Brand wordmark drawn exactly as the official stacked lockup. */
function _raw_brandLockupTexture(w = 1024, h = 512, opts = {}) {
  const [c, g] = makeCanvas(w, h);
  const dark = opts.dark !== false;
  g.fillStyle = dark ? '#2b2620' : WARM_WHITE;
  g.fillRect(0, 0, w, h);
  const fg = dark ? '#f5f2ec' : CHARCOAL;
  // "spinach" — Bold, with the green dot as the dot of the "i"
  g.fillStyle = fg;
  g.font = `700 ${h * 0.30}px Satoshi, "Segoe UI", sans-serif`;
  g.textBaseline = 'alphabetic';
  const wordY = h * 0.44;
  const word = 'sp';
  const word2 = 'nach';
  g.textAlign = 'left';
  const x0 = w * 0.08;
  g.fillText(word, x0, wordY);
  const wSp = g.measureText(word).width;
  // stem of the "i" (dotless), green dot above it
  const iX = x0 + wSp;
  g.fillRect(iX, wordY - h * 0.205, h * 0.035, h * 0.21);
  g.fillStyle = GREEN;
  g.beginPath();
  g.arc(iX + h * 0.0175, wordY - h * 0.26, h * 0.035, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fg;
  g.fillText(word2, iX + h * 0.055, wordY);
  // "labs" — Regular, wide-tracked, right-aligned under "spinach"
  const fullW = g.measureText('spinach').width + h * 0.055;
  g.font = `400 ${h * 0.13}px Satoshi, "Segoe UI", sans-serif`;
  const labs = 'l a b s';
  const labsW = g.measureText(labs).width;
  g.fillText(labs, x0 + fullW - labsW, wordY + h * 0.20);
  return toTexture(c);
}

/* Timber slat wall with the brand lockup mounted on it. */
function _raw_brandWallTexture(w = 1024, h = 1024) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#4a3a2c';
  g.fillRect(0, 0, w, h);
  const slats = 26;
  for (let i = 0; i < slats; i++) {
    const x = (i / slats) * w;
    const shade = 0.85 + Math.random() * 0.3;
    g.fillStyle = `rgb(${Math.floor(96 * shade)},${Math.floor(72 * shade)},${Math.floor(50 * shade)})`;
    g.fillRect(x, 0, w / slats - 3, h);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(x + w / slats - 3, 0, 3, h);
  }
  // subtle vertical grain noise
  g.globalAlpha = 0.08;
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() > 0.5 ? '#000' : '#c9a876';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 20 + Math.random() * 60);
  }
  g.globalAlpha = 1;
  // mounted lockup panel (dark inset board with the wordmark)
  const bw = w * 0.78, bh = h * 0.30, bx = (w - bw) / 2, by = h * 0.30;
  g.fillStyle = 'rgba(12,10,8,0.85)';
  g.fillRect(bx, by, bw, bh);
  const [lc] = makeCanvas(1024, 400);
  const lg = lc.getContext('2d');
  lg.drawImage(brandLockupCanvasOnly(1024, 400), 0, 0);
  g.drawImage(lc, bx + 20, by + 14, bw - 40, bh - 28);
  return toTexture(c);
}

function brandLockupCanvasOnly(w, h) {
  const [c, g] = makeCanvas(w, h);
  const fg = '#f5f2ec';
  g.font = `700 ${h * 0.42}px Satoshi, "Segoe UI", sans-serif`;
  g.textBaseline = 'alphabetic';
  const wordY = h * 0.52, x0 = w * 0.05;
  g.fillStyle = fg;
  g.fillText('sp', x0, wordY);
  const wSp = g.measureText('sp').width;
  const iX = x0 + wSp;
  g.fillRect(iX, wordY - h * 0.30, h * 0.05, h * 0.305);
  g.fillStyle = GREEN;
  g.beginPath();
  g.arc(iX + h * 0.025, wordY - h * 0.375, h * 0.052, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fg;
  g.fillText('nach', iX + h * 0.075, wordY);
  g.font = `400 ${h * 0.17}px Satoshi, "Segoe UI", sans-serif`;
  const fullW = g.measureText('spinach').width + h * 0.075;
  const labs = 'l a b s';
  g.fillText(labs, x0 + fullW - g.measureText(labs).width, wordY + h * 0.28);
  return c;
}

/* Big slogan wall: "A quieter, brighter tomorrow." */
function _raw_sloganWallTexture(w = 2048, h = 512) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, w, h);
  g.fillStyle = CHARCOAL;
  g.font = `900 ${h * 0.30}px Satoshi, "Segoe UI", sans-serif`;
  g.textAlign = 'center';
  g.fillText('A quieter, brighter tomorrow.', w / 2, h * 0.46);
  g.fillStyle = GREEN;
  g.fillRect(w / 2 - 120, h * 0.60, 240, 10);
  g.fillStyle = '#6B7280';
  g.font = `400 ${h * 0.11}px Satoshi, "Segoe UI", sans-serif`;
  g.fillText('SPINACH LABS — SYSTEMS FOR A BRIGHTER TOMORROW', w / 2, h * 0.82);
  return toTexture(c);
}

/* Secondary statement walls. */
function _raw_statementTexture(text, w = 1024, h = 256, accent = GREEN) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, w, h);
  g.fillStyle = CHARCOAL;
  g.font = `900 ${h * 0.34}px Satoshi, "Segoe UI", sans-serif`;
  g.textAlign = 'center';
  g.fillText(text, w / 2, h * 0.52);
  g.fillStyle = accent;
  g.fillRect(w / 2 - 70, h * 0.66, 140, 8);
  return toTexture(c);
}

/* Monitor / screen content placeholders by kind. */
function _raw_screenTexture(kind = 'code', w = 512, h = 320) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#101418';
  g.fillRect(0, 0, w, h);
  if (kind === 'code') {
    const cols = ['#7dd3fc', '#86efac', '#f0abfc', '#fde68a', '#94a3b8'];
    for (let r = 0; r < 14; r++) {
      let x = 24 + (r % 3) * 22;
      while (x < w - 60) {
        const len = 30 + Math.random() * 90;
        g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        g.globalAlpha = 0.85;
        g.fillRect(x, 22 + r * 20, len, 9);
        x += len + 14;
      }
    }
    g.globalAlpha = 1;
  } else if (kind === 'chart') {
    g.strokeStyle = '#334155';
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, (h / 5) * i); g.lineTo(w, (h / 5) * i); g.stroke(); }
    const cols = ['#16A34A', '#7dd3fc', '#f0abfc', '#fde68a'];
    const n = 8, bw = w / (n * 1.6);
    for (let i = 0; i < n; i++) {
      const bh = 40 + Math.random() * (h - 110);
      g.fillStyle = cols[i % cols.length];
      g.fillRect(30 + i * (w - 60) / n, h - 30 - bh, bw, bh);
    }
    g.strokeStyle = '#f8f9f7'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = 30 + i * (w - 60) / n + bw / 2, y = h - 60 - Math.random() * (h - 140);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  } else if (kind === 'design') {
    g.fillStyle = '#1e293b'; g.fillRect(20, 20, w - 40, h - 40);
    const cols = ['#16A34A', '#f0abfc', '#7dd3fc', '#fde68a'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.8;
      g.beginPath();
      g.arc(60 + Math.random() * (w - 120), 60 + Math.random() * (h - 120), 20 + Math.random() * 50, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#f8f9f7'; g.font = `900 44px Satoshi, sans-serif`;
    g.fillText('Aa', 40, 80);
  } else { // video
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0ea5e9'); grad.addColorStop(1, '#16A34A');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(w / 2, h / 2, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0B0F0B';
    g.beginPath(); g.moveTo(w / 2 - 10, h / 2 - 16); g.lineTo(w / 2 + 18, h / 2); g.lineTo(w / 2 - 10, h / 2 + 16); g.fill();
  }
  return toTexture(c);
}

/* Abstract wall art panels. */
function _raw_artTexture(variant = 0, w = 512, h = 640) {
  const [c, g] = makeCanvas(w, h);
  const palettes = [
    ['#0B0F0B', '#16A34A', '#F8F9F7', '#2E3A2E'],
    ['#F8F9F7', '#16A34A', '#0B0F0B', '#6B7280'],
    ['#2E3A2E', '#F8F9F7', '#16A34A', '#0B0F0B'],
  ];
  const p = palettes[variant % palettes.length];
  g.fillStyle = p[0]; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    g.fillStyle = p[(i + 1) % p.length]; g.globalAlpha = 0.85;
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 0, Math.PI * 2); g.fill(); }
    else if (kind === 1) { g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 120, 20 + Math.random() * 60); }
    else { g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.fill(); }
  }
  g.globalAlpha = 1;
  return toTexture(c);
}

/* Floating department label sprite. */
function _raw_deptLabelTexture(name, w = 512, h = 160) {
  const [c, g] = makeCanvas(w, h);
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(11,15,11,0.82)';
  const r = 36;
  g.beginPath();
  g.roundRect(8, 8, w - 16, h - 16, r);
  g.fill();
  g.strokeStyle = GREEN; g.lineWidth = 4;
  g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, r); g.stroke();
  g.fillStyle = '#F8F9F7';
  g.font = `700 ${h * 0.34}px Satoshi, "Segoe UI", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name.toUpperCase(), w / 2, h / 2 + 2);
  return toTexture(c);
}

/* Concrete floor: subtle mottling. */
function _raw_concreteTexture(w = 512, h = 512) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#b9b7b2'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = 165 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  return toTexture(c);
}

/* Oak top grain. */
function _raw_oakTexture(w = 512, h = 256) {  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#c9a876'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(120,85,50,${0.12 + Math.random() * 0.2})`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    const y = Math.random() * h;
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 6);
    g.stroke();
  }
  return toTexture(c);
}

/* Woven mesh for the task-chair backrest. */
function _raw_meshTexture(w = 256, h = 256) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#33373e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1d2025';
  const s = 11;
  for (let y = 0; y < h + s; y += s)
    for (let x = 0; x < w + s; x += s) {
      g.beginPath(); g.arc(x + s / 2, y + s / 2, 2.8, 0, Math.PI * 2); g.fill();
    }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 2.5);
  return t;
}

function _raw_helloSignTexture(w = 256, h = 128) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#16a34a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4f1ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 62px sans-serif';
  g.fillText('hello', w / 2, h / 2 + 2);
  return toTexture(c);
}

function _raw_menuBoardTexture(w = 256, h = 320) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#262626'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a6f4d'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#f4f1ea'; g.textAlign = 'center';
  g.font = 'bold 30px sans-serif'; g.fillText('MENU', w / 2, 52);
  g.strokeStyle = '#16a34a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(48, 74); g.lineTo(w - 48, 74); g.stroke();
  g.font = '21px sans-serif'; g.fillStyle = '#d8cfa8';
  ['espresso', 'flat white', 'cappuccino', 'cold brew', 'croissant'].forEach((t, i) =>
    g.fillText(t, w / 2, 116 + i * 40));
  return toTexture(c);
}

/* ---- memoization: each canvas texture is generated once and shared ----
   (models.js screenMat()/oakTopMat() and the office share these instances,
   cutting GPU texture uploads and canvas redraws to one per unique texture) */
const _texCache = new Map();
function _cached(fn) {
  const wrapped = (...args) => {
    const k = fn.name + '|' + JSON.stringify(args);
    if (!_texCache.has(k)) _texCache.set(k, fn(...args));
    return _texCache.get(k);
  };
  return wrapped;
}
const brandLockupTexture = _cached(_raw_brandLockupTexture);
const brandWallTexture = _cached(_raw_brandWallTexture);
const sloganWallTexture = _cached(_raw_sloganWallTexture);
const statementTexture = _cached(_raw_statementTexture);
const screenTexture = _cached(_raw_screenTexture);
const artTexture = _cached(_raw_artTexture);
const deptLabelTexture = _cached(_raw_deptLabelTexture);
const concreteTexture = _cached(_raw_concreteTexture);
const oakTexture = _cached(_raw_oakTexture);
const meshTexture = _cached(_raw_meshTexture);
const helloSignTexture = _cached(_raw_helloSignTexture);
const menuBoardTexture = _cached(_raw_menuBoardTexture);

/* ===== three/models.js ===== */
/* Spinach OS dashboard — optimized procedural models.
   Same visual factories as the reference viewer, plus a bake/instancing layer:
   - bakeSmart(group): merges a factory group into per-bucket geometries
     (vertex-colored matte / vertex-colored metal / per-material rest for
     textured|transparent|emissive parts). Geometry is visually identical.
   - tpl(key): cached baked templates for InstancedMesh placement.
   - Factories that contain repeated sub-parts take a `kit` and emit
     placements (in factory-local space) instead of child groups.
   Units: meters. All factories build at local origin, facing +Z unless noted. */

const C = {
  concrete: 0xb9b7b2, oak: 0xc9a876, timber: 0x4a3a2c, charcoal: 0x232323,
  warmWhite: 0xf4f1ea, blackMetal: 0x1a1a1a, foliage: 0x2f7a3d, foliageDark: 0x1f5c2a,
  screen: 0x101418, sofa: 0x8a8f98, sofaAccent: 0xd8cfa8, green: 0x16a34a,
};

const _mats = {};
function mat(name, opts = {}) {
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

function grp(id, zone, label, dims = {}) {
  const g = new THREE.Group();
  g.userData = { id, zone, label, dims, selectable: true };
  g.name = id;
  return g;
}
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const sph = (r, m, w = 10, h = 8) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m);
function put(mesh, x, y, z, ry = 0) { mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

function strut(p1, p2, r, mName, parent) {
  const d = new THREE.Vector3().subVectors(p2, p1);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 8), mat(mName));
  m.position.copy(p1).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; parent.add(m); return m;
}

/* ---------------- bake / merge layer ---------------- */
// Shared vertex-colored materials for baked flat-color geometry.
const VC_MATTE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
const VC_METAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.62 });

// Merge non-indexed geometries (position/normal/uv/color). Missing color defaults to white.
function mergeGeometries(geos) {
  const list = geos.map(g => (g.index ? g.toNonIndexed() : g));
  let vCount = 0;
  for (const g of list) vCount += g.attributes.position.count;
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2), col = new Float32Array(vCount * 3);
  let o = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + n) * 3);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

function bakeExcluded(m) {
  // textured | transparent | strongly emissive parts keep their own material/mesh
  return !!m.map || !!m.transparent || (m.emissive !== undefined && m.emissiveIntensity > 0.6);
}

// Bake a factory group (at local origin) into merged geometries.
// Returns { matte:{geo,cast,recv}|null, metal:{...}|null, rest:[{material,geo,cast,recv}] }.
// Meshes with material arrays are left untouched (marked userData._keep).
function bakeSmart(group) {
  group.updateMatrixWorld(true);
  const matte = [], metal = [], rest = new Map();
  const fb = { matte: { c: false, r: false }, metal: { c: false, r: false } };
  group.traverse(o => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) { o.userData._keep = true; return; }
    const m = o.material;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (bakeExcluded(m)) {
      let e = rest.get(m);
      if (!e) { e = { geos: [], c: false, r: false }; rest.set(m, e); }
      e.geos.push(g); e.c = e.c || !!o.castShadow; e.r = e.r || !!o.receiveShadow;
    } else {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      const c = m.color || { r: 1, g: 1, b: 1 };
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const isMetal = (m.metalness || 0) >= 0.3;
      (isMetal ? metal : matte).push(g);
      const B = isMetal ? fb.metal : fb.matte;
      B.c = B.c || !!o.castShadow; B.r = B.r || !!o.receiveShadow;
    }
  });
  const out = { matte: null, metal: null, rest: [] };
  if (matte.length) out.matte = { geo: mergeGeometries(matte), cast: fb.matte.c, recv: fb.matte.r };
  if (metal.length) out.metal = { geo: mergeGeometries(metal), cast: fb.metal.c, recv: fb.metal.r };
  for (const [material, e] of rest) out.rest.push({ material, geo: mergeGeometries(e.geos), cast: e.c, recv: e.r });
  return out;
}

/* ---------------- template registry ---------------- */
const _builders = new Map();
const _tplCache = new Map();
function defineTpl(key, buildFn) { _builders.set(key, buildFn); }
function tpl(key) {
  if (!_tplCache.has(key)) {
    const b = _builders.get(key);
    if (!b) throw new Error('unknown template: ' + key);
    _tplCache.set(key, bakeSmart(b()));
  }
  return _tplCache.get(key);
}
// Push an instanced placement (factory-local matrix) into a kit.
function placeKit(kit, key, matrix) {
  kit.placements.push({ key, baked: tpl(key), matrix: matrix.clone() });
}
function mat4(x, y, z, ry = 0, s = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(s, s, s));
}

// Cached textured materials shared across components.
let _oakTop = null;
function oakTopMat() {
  if (!_oakTop) _oakTop = new THREE.MeshStandardMaterial({ color: C.oak, roughness: 0.55, map: oakTexture() });
  return _oakTop;
}
const _screenMats = {};
function screenMat(kind) {
  if (!_screenMats[kind]) _screenMats[kind] = new THREE.MeshBasicMaterial({ map: screenTexture(kind) });
  return _screenMats[kind];
}
// Radial glow sprite texture for pendant fake-glow points.
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,225,170,1)');
  grad.addColorStop(0.35, 'rgba(255,200,130,0.55)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

/* ---------------- seating ---------------- */
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
    _meshMat = new THREE.MeshStandardMaterial({ map: meshTexture(), roughness: 0.95, side: THREE.DoubleSide });
  }
  return _meshMat;
}

// Designer-toy task chair: oak frame, mesh back, cushioned seat, 5-star caster base.
// Faces +Z (backrest at -Z). Seat top ~0.51 so seated NPCs still sit correctly.
function makeChair(accent = false) {
  const g = grp('chair', '', 'Task chair');
  const cushionM = accent ? mat('sofaAccent') : mat('charcoal');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leg = put(box(0.30, 0.035, 0.06, mat('blackMetal')), Math.cos(a) * 0.15, 0.085, Math.sin(a) * 0.15);
    leg.rotation.y = -a; g.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('blackMetal'));
    wheel.position.set(Math.cos(a) * 0.30, 0.045, Math.sin(a) * 0.30);
    wheel.scale.set(1, 0.9, 1); wheel.castShadow = true; g.add(wheel);
  }
  g.add(put(cyl(0.032, 0.032, 0.30, mat('blackMetal')), 0, 0.25, 0));
  g.add(put(box(0.24, 0.05, 0.22, mat('blackMetal')), 0, 0.415, 0));
  g.add(put(cyl(0.27, 0.27, 0.05, mat('oak'), 20), 0, 0.44, 0));
  g.add(put(cyl(0.25, 0.26, 0.08, cushionM, 20), 0, 0.47, 0));
  strut(new THREE.Vector3(-0.19, 0.47, -0.22), new THREE.Vector3(-0.19, 1.02, -0.29), 0.028, 'oak', g);
  strut(new THREE.Vector3(0.19, 0.47, -0.22), new THREE.Vector3(0.19, 1.02, -0.29), 0.028, 'oak', g);
  const frameShape = roundedRect(0.48, 0.58, 0.15);
  frameShape.holes.push(roundedRect(0.37, 0.47, 0.11));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.045, bevelEnabled: false }), mat('oak'));
  frame.position.set(0, 0.78, -0.335); frame.rotation.x = -0.07; frame.castShadow = true; g.add(frame);
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(0.37, 0.47, 0.11), 24), meshBackMat());
  panel.position.set(0, 0.78, -0.312); panel.rotation.x = -0.07; panel.castShadow = true; g.add(panel);
  for (const sx of [-1, 1]) {
    strut(new THREE.Vector3(sx * 0.25, 0.50, 0.06), new THREE.Vector3(sx * 0.25, 0.76, 0.06), 0.026, 'oak', g);
    strut(new THREE.Vector3(sx * 0.25, 0.76, 0.10), new THREE.Vector3(sx * 0.21, 0.80, -0.26), 0.026, 'oak', g);
  }
  return g;
}

function makeSofa(len = 2.2, mName = 'sofa') {
  const g = grp('sofa', '', 'Sofa');
  const fabric = mat(mName);
  const cushionM = mat(mName === 'sofa' ? 'sofaAccent' : 'sofa');
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(put(cyl(0.035, 0.05, 0.12, mat('oak')), sx * (len / 2 - 0.12), 0.06, sz * 0.36));
  g.add(put(box(len, 0.16, 0.88, mat('oak')), 0, 0.2, 0));
  const n = Math.max(2, Math.round(len / 0.75));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.42 + i * ((len - 0.84) / Math.max(1, n - 1));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), i % 2 ? cushionM : fabric);
    c.scale.set(1.0, 0.34, 1.12); c.position.set(x, 0.36, 0.02);
    c.castShadow = c.receiveShadow = true; g.add(c);
  }
  const back = put(box(len, 0.52, 0.16, fabric), 0, 0.6, -0.38); back.rotation.x = -0.1; g.add(back);
  const backPanel = put(box(len - 0.1, 0.46, 0.05, mat('oak')), 0, 0.6, -0.475); backPanel.rotation.x = -0.1; g.add(backPanel);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.42 + i * ((len - 0.84) / Math.max(1, n - 1));
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), i % 2 ? fabric : cushionM);
    c.scale.set(1.0, 0.95, 0.42); c.position.set(x, 0.66, -0.26); c.rotation.x = -0.16;
    c.castShadow = c.receiveShadow = true; g.add(c);
  }
  for (const sx of [-1, 1]) {
    const arm = put(cyl(0.07, 0.07, 0.8, mat('oak'), 14), sx * (len / 2 - 0.07), 0.56, 0);
    arm.rotation.x = Math.PI / 2; g.add(arm);
    g.add(put(cyl(0.045, 0.055, 0.3, mat('oak')), sx * (len / 2 - 0.07), 0.36, 0.3));
    g.add(put(cyl(0.045, 0.055, 0.3, mat('oak')), sx * (len / 2 - 0.07), 0.36, -0.3));
  }
  const tp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), mat('green'));
  tp.scale.set(1.0, 1.0, 0.42); tp.position.set(-len / 2 + 0.5, 0.62, -0.14);
  tp.rotation.set(-0.2, 0.15, 0.28); tp.castShadow = true; g.add(tp);
  return g;
}

function makeArmchair() {
  const g = grp('armchair', '', 'Armchair');
  g.add(put(box(0.8, 0.35, 0.75, mat('sofaAccent')), 0, 0.3, 0));
  g.add(put(box(0.8, 0.5, 0.2, mat('sofaAccent')), 0, 0.6, -0.3));
  g.add(put(box(0.18, 0.28, 0.75, mat('sofaAccent')), -0.4, 0.55, 0));
  g.add(put(box(0.18, 0.28, 0.75, mat('sofaAccent')), 0.4, 0.55, 0));
  return g;
}

function makeCoffeeTable() {
  const g = grp('coffee-table', '', 'Coffee table');
  g.add(put(box(1.4, 0.05, 0.7, mat('oak')), 0, 0.38, 0));
  for (const [x, z] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]])
    g.add(put(box(0.06, 0.36, 0.06, mat('blackMetal')), x, 0.18, z));
  return g;
}

function makeBarStool() {
  const g = grp('bar-stool', '', 'Bar stool');
  g.add(put(cyl(0.19, 0.19, 0.06, mat('oak')), 0, 0.78, 0));
  g.add(put(cyl(0.025, 0.025, 0.72, mat('blackMetal')), 0, 0.4, 0));
  g.add(put(cyl(0.2, 0.22, 0.03, mat('blackMetal')), 0, 0.02, 0));
  return g;
}

/* ---------------- monitors ---------------- */
// Stand (instanced, vertex-baked) + screen plane per content kind (instanced).
function monitorStand() {
  const g = new THREE.Group();
  g.add(put(box(0.58, 0.37, 0.03, mat('blackMetal')), 0, 1.22, -0.02));
  g.add(put(cyl(0.02, 0.02, 0.35, mat('blackMetal')), 0, 0.95, -0.02));
  g.add(put(box(0.24, 0.02, 0.18, mat('blackMetal')), 0, 0.77, -0.02));
  return g;
}
function monitorScreen(kind) {
  const g = new THREE.Group();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), screenMat(kind));
  scr.position.set(0, 1.22, 0); g.add(scr);
  return g;
}
// Place one monitor (screen faces +Z of the given facing; pass ry=Math.PI like the original).
function monitorPlacements(kit, kind, x, z, ry) {
  placeKit(kit, 'mon-screen-' + kind, mat4(x, 1.22, z, ry));
  placeKit(kit, 'mon-stand', mat4(x, 0, z, ry));
}

/* ---------------- desks (kit-aware: repeated sub-parts become placements) ---------------- */
function makeDeskRun(n = 4, kind = 'code', withPlanters = true) {
  const g = grp('desk-run', '', `Desk run x${n}`);
  const kit = { placements: [] };
  const W = n * 1.7;
  const top = put(box(W, 0.06, 1.5, oakTopMat()), 0, 0.74, 0);
  g.add(top);
  for (let i = 0; i <= n; i++)
    g.add(put(box(0.08, 0.71, 1.4, mat('blackMetal')), -W / 2 + i * 1.7, 0.36, 0));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.85 + i * 1.7;
    monitorPlacements(kit, kind, x - 0.25, -0.35, Math.PI);
    monitorPlacements(kit, kind, x + 0.35, 0.35, Math.PI);
    dressWorkstation(kit, x - 0.25, 0, -1); // sitter north (facing +z)
    dressWorkstation(kit, x + 0.35, 0, 1);  // sitter south
    placeKit(kit, 'chair', mat4(x - 0.25, 0, -1.05, 0));
    placeKit(kit, 'chair', mat4(x + 0.35, 0, 1.05, Math.PI));
    if (withPlanters) placeKit(kit, 'planter-1.5', mat4(x, 0.77, 0, 0));
  }
  g.userData.placements = kit.placements;
  return g;
}

function makeWorkPod(kind = 'code') {
  const g = grp('work-pod', '', 'Work pod (4 desks)');
  const kit = { placements: [] };
  for (const [x, z, ry] of [[-0.85, -0.85, 0], [0.85, -0.85, 0], [-0.85, 0.85, Math.PI], [0.85, 0.85, Math.PI]]) {
    g.add(put(box(1.6, 0.06, 0.8, mat('oak')), x, 0.74, z, ry));
    g.add(put(box(0.08, 0.71, 0.7, mat('blackMetal')), x - 0.7, 0.36, z, ry));
    g.add(put(box(0.08, 0.71, 0.7, mat('blackMetal')), x + 0.7, 0.36, z, ry));
    monitorPlacements(kit, kind, x, z + (ry ? 0.25 : -0.25), Math.PI);
    const s = ry ? 1 : -1;
    placeKit(kit, 'mug', mat4(x + 0.55, 0.77, z + s * 0.08));
    placeKit(kit, 'nb', mat4(x - 0.55, 0.77, z + s * 0.08));
    placeKit(kit, 'chair', mat4(x, 0, z + (ry ? 1.0 : -1.0), ry ? Math.PI : 0));
  }
  placeKit(kit, 'planter-2.6', mat4(0, 0, 0, 0));
  g.userData.placements = kit.placements;
  return g;
}

function makeCabinDesk(kind = 'code') {
  const g = grp('cabin-desk', '', 'Cabin desk');
  const kit = { placements: [] };
  g.add(put(box(1.8, 0.06, 0.9, mat('oak')), 0, 0.74, 0));
  g.add(put(box(0.08, 0.71, 0.8, mat('blackMetal')), -0.8, 0.36, 0));
  g.add(put(box(0.08, 0.71, 0.8, mat('blackMetal')), 0.8, 0.36, 0));
  monitorPlacements(kit, kind, -0.3, -0.2, Math.PI);
  monitorPlacements(kit, kind, 0.4, -0.2, Math.PI);
  placeKit(kit, 'kb', mat4(0.05, 0.77, -0.38));
  placeKit(kit, 'mug', mat4(0.62, 0.77, -0.32));
  placeKit(kit, 'nb', mat4(-0.6, 0.77, -0.32));
  placeKit(kit, 'pen', mat4(-0.6, 0.822, -0.24));
  placeKit(kit, 'chair-accent', mat4(0, 0, -0.9, 0));
  g.userData.placements = kit.placements;
  return g;
}

function makeConfTable(seats = 8) {
  const g = grp('conf-table', '', 'Conference table');
  const kit = { placements: [] };
  g.add(put(box(3.2, 0.07, 1.3, mat('oak')), 0, 0.73, 0));
  g.add(put(box(0.12, 0.7, 1.1, mat('blackMetal')), -1.4, 0.35, 0));
  g.add(put(box(0.12, 0.7, 1.1, mat('blackMetal')), 1.4, 0.35, 0));
  for (let i = 0; i < seats; i++) {
    const side = i % 2 ? 1 : -1;
    const x = -1.2 + Math.floor(i / 2) * 0.8;
    placeKit(kit, 'chair', mat4(x, 0, side * 1.15, side > 0 ? Math.PI : 0));
    placeKit(kit, 'nb', mat4(x, 0.765, side * 0.38, side * 0.15));
    placeKit(kit, 'pen', mat4(x + 0.18, 0.765, side * 0.42));
  }
  placeKit(kit, 'tray', mat4(0, 0.765, 0, 0));
  g.userData.placements = kit.placements;
  return g;
}

/* ---------------- desk accessories ---------------- */
function makeKeyboard() {
  const g = new THREE.Group();
  const base = put(box(0.46, 0.025, 0.17, mat('charcoal')), 0, 0.013, 0);
  base.castShadow = true; g.add(base);
  const keyM = mat('concrete');
  for (let r = 0; r < 3; r++)
    g.add(put(box(0.42, 0.01, 0.028, keyM), 0, 0.028, -0.055 + r * 0.045));
  g.add(put(box(0.2, 0.01, 0.028, keyM), 0, 0.028, 0.08));
  return g;
}

function makeMug() {
  const g = new THREE.Group();
  g.add(put(cyl(0.062, 0.062, 0.012, mat('oak'), 14), 0, 0.006, 0));
  g.add(put(cyl(0.045, 0.04, 0.1, mat('warmWhite'), 14), 0, 0.062, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 8, 14, Math.PI), mat('warmWhite'));
  handle.position.set(0.052, 0.062, 0); handle.rotation.z = -Math.PI / 2; handle.castShadow = true; g.add(handle);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.016, 12), mat('green'));
  dot.position.set(0, 0.062, 0.046); g.add(dot);
  return g;
}

function makeNotebookStack() {
  const g = new THREE.Group();
  g.add(put(box(0.22, 0.025, 0.3, mat('warmWhite')), 0, 0.013, 0));
  const top = put(box(0.2, 0.025, 0.28, mat('green')), 0.01, 0.038, 0.01);
  top.rotation.y = 0.14; top.castShadow = true; g.add(top);
  return g;
}

function makePen() {
  const g = new THREE.Group();
  const p = put(cyl(0.008, 0.008, 0.14, mat('charcoal'), 8), 0, 0.008, 0);
  p.rotation.z = Math.PI / 2; p.rotation.y = 0.5; p.castShadow = true; g.add(p);
  return g;
}

function makeDeskTray() {
  const g = new THREE.Group();
  g.add(put(box(0.34, 0.03, 0.24, mat('oak')), 0, 0.015, 0));
  const cols = [0xf5e6a8, 0xa8d5a8, 0xf5b8a8];
  for (let i = 0; i < 3; i++)
    g.add(put(box(0.09, 0.022, 0.09,
      new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.9 })), -0.1 + i * 0.1, 0.041, 0));
  return g;
}

// Dress one workstation via kit placements: keyboard + mug + notebooks + pen.
// (cx, cz): desk-center x/z reference; side: -1 = sitter north, +1 = sitter south.
function dressWorkstation(kit, cx, cz, side, topY = 0.77) {
  const az = cz + side * 0.5;
  placeKit(kit, 'kb', mat4(cx, topY, az, side > 0 ? Math.PI : 0));
  placeKit(kit, 'mug', mat4(cx + 0.38, topY, az - side * 0.05));
  placeKit(kit, 'nb', mat4(cx - 0.35, topY, az, side * 0.2));
  placeKit(kit, 'pen', mat4(cx - 0.35, topY + 0.052, az + 0.08));
}

/* ---------------- planting ---------------- */
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
function leaf(sx, sy, sz, mName, x, y, z, rx = 0, ry = 0, rz = 0, parent) {
  const l = new THREE.Mesh(LEAF, mat(mName));
  l.scale.set(sx, sy, sz); l.position.set(x, y, z); l.rotation.set(rx, ry, rz);
  l.castShadow = true; parent.add(l); return l;
}
function angDist(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

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

function makeSucculent() {
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

function makePlanterBox(len = 1.6) {
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

function makeHangingPlant() {
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

function makeLivingWall(w = 3.2, h = 1.8) {
  const g = grp('living-wall', '', 'Living green wall');
  g.add(put(box(w, h, 0.1, mat('timber')), 0, h / 2, 0));
  g.add(put(box(w - 0.24, h - 0.24, 0.06, mat('foliageDark')), 0, h / 2, 0.06));
  const cols = Math.max(3, Math.round(w / 0.55)), rows = Math.max(2, Math.round(h / 0.55));
  for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
    const px = -w / 2 + 0.3 + (cx + 0.5 * (cy % 2)) * ((w - 0.6) / cols);
    const py = 0.3 + cy * ((h - 0.6) / Math.max(1, rows - 1));
    const s = 0.13 + ((cx * 7 + cy * 13) % 5) * 0.02;
    leaf(s, s * 1.15, s * 0.55, (cx + cy) % 3 === 0 ? 'foliage' : ((cx + cy) % 3 === 1 ? 'foliageDark' : 'green'),
      px, py, 0.12 + ((cx * 3 + cy) % 3) * 0.04, 0.35, (cx * 2.4 + cy * 1.7) % 6.28, 0, g);
  }
  const vines = Math.max(2, Math.round(w / 1.5));
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

/* ---------------- people (designer-toy NPCs, deterministic variants for instancing) ---------------- */
const NPC = {
  skin: [0xf2c9a0, 0xc9a189, 0x9c6b43, 0x6b4226],
  top: [0x2b2f36, 0xf4f1ea, 0x5b6b4f, 0x16a34a, 0x3b4a5a, 0xe8e2d5],
  bottom: [0x2b2f36, 0x3a3f47, 0x4a4438],
  hair: [0x1c1a17, 0x3d2b1f, 0x5a4632, 0x77716b, 0x8a5a2b],
  hijab: [0x9caf88, 0xd6cfc2, 0x5b6b4f],
};
// Deterministic variant sets (replaces per-person Math.random in the dashboard build).
const SEAT_VARIANTS = [
  { skin: 0xf2c9a0, top: 0x16a34a, bottom: 0x2b2f36, hair: 0x1c1a17, hairStyle: 'crop', glasses: false },
  { skin: 0xc9a189, top: 0xf4f1ea, bottom: 0x3a3f47, hair: 0x3d2b1f, hairStyle: 'sidepart', glasses: true },
  { skin: 0x9c6b43, top: 0x5b6b4f, bottom: 0x2b2f36, hair: 0x1c1a17, hairStyle: 'curly', glasses: false },
  { skin: 0x6b4226, top: 0x3b4a5a, bottom: 0x4a4438, hair: 0x1c1a17, hairStyle: 'bun', glasses: false },
  { skin: 0xf2c9a0, top: 0x2b2f36, bottom: 0x3a3f47, hair: 0x77716b, hairStyle: 'long', glasses: true },
  { skin: 0xc9a189, top: 0xe8e2d5, bottom: 0x2b2f36, hair: 0x5a4632, hairStyle: 'crop', glasses: false },
  { skin: 0x9c6b43, top: 0x16a34a, bottom: 0x4a4438, hair: 0x1c1a17, hairStyle: 'hijab', hijabC: 0x9caf88, glasses: false },
  { skin: 0x6b4226, top: 0xf4f1ea, bottom: 0x3a3f47, hair: 0x8a5a2b, hairStyle: 'sidepart', glasses: false },
];
const STAND_VARIANTS = [
  { skin: 0xc9a189, top: 0x16a34a, bottom: 0x2b2f36, hair: 0x3d2b1f, hairStyle: 'crop', glasses: false },
  { skin: 0xf2c9a0, top: 0x3b4a5a, bottom: 0x3a3f47, hair: 0x1c1a17, hairStyle: 'curly', glasses: true },
  { skin: 0x9c6b43, top: 0xf4f1ea, bottom: 0x4a4438, hair: 0x5a4632, hairStyle: 'long', glasses: false },
  { skin: 0x6b4226, top: 0x5b6b4f, bottom: 0x2b2f36, hair: 0x1c1a17, hairStyle: 'hijab', hijabC: 0xd6cfc2, glasses: false },
];
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

function makeHead(o) {
  const g = new THREE.Group();
  const skin = npcMat(o.skin), hairM = npcMat(o.hair, 0.9), dark = npcMat(0x23272e, 0.5);
  npcPart(G_CYL, skin, 0.05, 0.09, 0.05, 0, 0.045, 0, g);
  npcPart(G_SPH, skin, 0.155, 0.155, 0.15, 0, 0.24, 0.01, g);
  npcPart(G_SPH, skin, 0.032, 0.032, 0.03, -0.15, 0.24, 0.01, g);
  npcPart(G_SPH, skin, 0.032, 0.032, 0.03, 0.15, 0.24, 0.01, g);
  npcPart(G_SPH, dark, 0.021, 0.026, 0.012, -0.058, 0.26, 0.15, g);
  npcPart(G_SPH, dark, 0.021, 0.026, 0.012, 0.058, 0.26, 0.15, g);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 20, Math.PI * 0.8), dark);
  smile.position.set(0, 0.198, 0.15); smile.rotation.z = Math.PI * 1.1;
  smile.castShadow = true; g.add(smile);
  const hy = 0.30;
  if (o.hairStyle === 'curly') {
    npcPart(G_SPH, hairM, 0.15, 0.08, 0.145, 0, hy + 0.03, -0.01, g);
    // deterministic curl ring (no Math.random — instancing needs identical geometry)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = 0.115;
      npcPart(G_SPH, hairM, 0.055, 0.055, 0.055,
        Math.cos(a) * r, hy + 0.06 + ((i * 37) % 10) * 0.003, Math.sin(a) * r * 0.9 - 0.01, g);
    }
  } else if (o.hairStyle === 'bun') {
    npcPart(G_SPH, hairM, 0.16, 0.115, 0.155, 0, hy + 0.015, -0.012, g);
    npcPart(G_SPH, hairM, 0.062, 0.062, 0.062, 0, hy + 0.13, -0.09, g);
  } else if (o.hairStyle === 'long') {
    npcPart(G_SPH, hairM, 0.163, 0.175, 0.158, 0, hy - 0.02, -0.035, g);
    npcPart(G_SPH, hairM, 0.158, 0.10, 0.152, 0, hy + 0.03, 0, g);
  } else if (o.hairStyle === 'hijab') {
    const hm = npcMat(o.hijabC, 0.9);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.178, 20, 14, Math.PI / 2 + 0.55, Math.PI * 2 - 1.1, 0, Math.PI * 0.72), hm);
    shell.position.set(0, 0.25, -0.01); shell.castShadow = true; g.add(shell);
    npcPart(G_CYL, hm, 0.115, 0.16, 0.115, 0, 0.02, -0.01, g);
  } else {
    npcPart(G_SPH, hairM, 0.16, 0.115, 0.155, 0, hy + 0.015, -0.012, g);
    if (o.hairStyle === 'sidepart') {
      const fr = npcPart(G_BOX, hairM, 0.15, 0.045, 0.05, 0.04, hy + 0.055, 0.125, g);
      fr.rotation.z = 0.25;
    }
  }
  if (o.glasses) {
    const gm = npcMat(0x2b2f36, 0.4);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0075, 8, 20), gm);
      lens.position.set(sx * 0.058, 0.26, 0.155); lens.castShadow = true; g.add(lens);
    }
    npcPart(G_BOX, gm, 0.032, 0.008, 0.008, 0, 0.26, 0.155, g);
  }
  return g;
}

function makePerson(seated = true, opts = {}) {
  const g = grp('person', '', 'Staff member');
  const o = {
    skin: opts.skin ?? 0xf2c9a0,
    top: opts.top ?? 0x2b2f36,
    bottom: opts.bottom ?? 0x2b2f36,
    hair: opts.hair ?? 0x1c1a17,
    hairStyle: opts.hairStyle ?? 'crop',
    hijabC: opts.hijabC ?? 0x9caf88,
    glasses: opts.glasses ?? false,
  };
  const top = npcMat(o.top), bot = npcMat(o.bottom), skin = npcMat(o.skin);
  const shoeM = npcMat(0x23272e, 0.6);
  if (seated) {
    for (const sx of [-1, 1]) {
      npcPart(G_BOX, bot, 0.11, 0.11, 0.36, sx * 0.085, 0.47, 0.15, g);
      npcPart(G_BOX, bot, 0.10, 0.40, 0.10, sx * 0.085, 0.23, 0.31, g);
      npcPart(G_BOX, shoeM, 0.11, 0.09, 0.24, sx * 0.085, 0.045, 0.34, g);
    }
    npcPart(G_BOX, bot, 0.27, 0.13, 0.18, 0, 0.52, -0.02, g);
    npcPart(G_CYL, top, 0.14, 0.50, 0.135, 0, 0.83, -0.01, g);
    npcPart(G_SPH, top, 0.15, 0.085, 0.12, 0, 1.08, -0.01, g);
    for (const sx of [-1, 1]) {
      const arm = npcPart(G_CYL, top, 0.048, 0.46, 0.048, sx * 0.205, 0.90, 0.16, g);
      arm.rotation.x = -0.55;
      npcPart(G_SPH, skin, 0.052, 0.052, 0.052, sx * 0.205, 0.70, 0.30, g);
    }
    const head = makeHead(o); head.position.y = 1.10; g.add(head);
  } else {
    for (const sx of [-1, 1]) {
      npcPart(G_CYL, bot, 0.062, 0.60, 0.062, sx * 0.085, 0.39, 0, g);
      npcPart(G_BOX, shoeM, 0.11, 0.09, 0.24, sx * 0.085, 0.045, 0.03, g);
    }
    npcPart(G_CYL, bot, 0.135, 0.16, 0.125, 0, 0.74, 0, g);
    npcPart(G_CYL, top, 0.14, 0.52, 0.135, 0, 1.06, 0, g);
    npcPart(G_SPH, top, 0.15, 0.085, 0.12, 0, 1.32, 0, g);
    for (const sx of [-1, 1]) {
      const arm = npcPart(G_CYL, top, 0.048, 0.46, 0.048, sx * 0.205, 1.04, 0, g);
      arm.rotation.z = sx * 0.10;
      npcPart(G_SPH, skin, 0.055, 0.06, 0.055, sx * 0.225, 0.79, 0, g);
    }
    const head = makeHead(o); head.position.y = 1.345; g.add(head);
  }
  return g;
}

/* ---------------- reception / cafe ---------------- */
function makeReceptionDesk() {
  const g = grp('reception-desk', 'reception', 'Curved reception desk');
  const kit = { placements: [] };
  const curve = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.05, 24, 1, true, Math.PI * 0.9, Math.PI * 0.7),
    mat('timber'));
  curve.position.y = 0.55; curve.castShadow = true; g.add(curve);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = Math.PI * 0.9 + ((i + 0.5) / N) * Math.PI * 0.7;
    const slat = put(box(0.11, 1.0, 0.04, mat('oak')), 2.63 * Math.sin(a), 0.55, 2.63 * Math.cos(a));
    slat.rotation.y = a; slat.castShadow = true; g.add(slat);
  }
  const trim = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.68, 0.1, 24, 1, true, Math.PI * 0.9, Math.PI * 0.7),
    mat('oak'));
  trim.position.y = 0.06; g.add(trim);
  const topCurve = new THREE.Mesh(new THREE.CylinderGeometry(2.78, 2.78, 0.07, 24, 1, true, Math.PI * 0.9, Math.PI * 0.7),
    mat('warmWhite'));
  topCurve.position.y = 1.1; topCurve.castShadow = true; g.add(topCurve);
  monitorPlacements(kit, 'chart', 0.4, 0.4, Math.PI * 1.25);
  placeKit(kit, 'planter-1.2', mat4(-1.2, 1.14, 0.6, 0));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), mat('green'));
  dot.position.set(0, 0.62, -2.67); dot.rotation.y = Math.PI; g.add(dot);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.04),
    [mat('oak'), mat('oak'), mat('oak'), mat('oak'),
     new THREE.MeshStandardMaterial({ map: helloSignTexture(), roughness: 0.7 }), mat('oak')]);
  sign.position.set(1.25, 1.29, 0.15); sign.rotation.y = -0.35; sign.castShadow = true; g.add(sign);
  g.add(put(box(0.42, 0.03, 0.12, mat('oak')), 1.25, 1.15, 0.15));
  placeKit(kit, 'succulent', mat4(-0.25, 1.14, 0.95, 0, 0.7));
  g.userData.placements = kit.placements;
  return g;
}

function makeCafeCounter(len = 6) {
  const g = grp('cafe-counter', 'cafe', 'Cafe counter');
  g.add(put(box(len, 0.95, 0.7, mat('timber')), 0, 0.475, 0));
  g.add(put(box(len - 0.3, 0.6, 0.02, mat('charcoal')), 0, 0.48, 0.355));
  g.add(put(box(len - 0.3, 0.08, 0.025, mat('green')), 0, 0.72, 0.355));
  g.add(put(box(len + 0.2, 0.06, 0.9, mat('warmWhite')), 0, 1.0, 0));
  for (const sx of [-1, 1])
    g.add(put(box(0.12, 0.95, 0.78, mat('oak')), sx * (len / 2 - 0.06), 0.475, 0));
  const ex = -len / 2 + 1.15, ez = -0.05;
  g.add(put(box(0.6, 0.42, 0.45, mat('charcoal')), ex, 1.27, ez));
  g.add(put(box(0.5, 0.26, 0.02, mat('concrete')), ex, 1.24, ez + 0.23));
  g.add(put(box(0.56, 0.03, 0.4, mat('blackMetal')), ex, 1.05, ez));
  g.add(put(cyl(0.035, 0.035, 0.1, mat('blackMetal'), 10), ex - 0.12, 1.14, ez + 0.24));
  const pf = put(cyl(0.018, 0.018, 0.22, mat('blackMetal'), 8), ex - 0.12, 1.1, ez + 0.33);
  pf.rotation.x = 1.15; g.add(pf);
  g.add(put(box(0.5, 0.04, 0.35, mat('blackMetal')), ex, 1.5, ez));
  for (let i = 0; i < 3; i++)
    g.add(put(cyl(0.042, 0.032, 0.075, mat('warmWhite'), 12), -0.8, 1.07 + i * 0.068, 0.12));
  g.add(put(box(0.55, 0.03, 0.32, mat('oak')), 0.4, 1.045, 0.1));
  const pastryM = new THREE.MeshStandardMaterial({ color: 0xc98d4e, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), pastryM);
    cr.scale.set(1.35, 0.72, 0.9); cr.position.set(0.22 + i * 0.18, 1.1, 0.1);
    cr.castShadow = true; g.add(cr);
  }
  const mb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.025),
    [mat('timber'), mat('timber'), mat('timber'), mat('timber'),
     new THREE.MeshStandardMaterial({ map: menuBoardTexture(), roughness: 0.85 }), mat('timber')]);
  mb.position.set(1.75, 1.36, -0.05); mb.rotation.y = -0.25; mb.castShadow = true; g.add(mb);
  g.add(put(cyl(0.025, 0.025, 0.26, mat('timber'), 10), 1.75, 1.17, -0.05));
  g.add(put(cyl(0.09, 0.11, 0.03, mat('timber'), 12), 1.75, 1.045, -0.05));
  return g;
}

function makeShelf(w = 3) {
  const g = grp('shelf', '', 'Display shelf');
  // deterministic book layout (seeded by width so rebuilds are stable)
  let seed = Math.floor(w * 1000) + 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3; i++) {
    g.add(put(box(w, 0.05, 0.35, mat('oak')), 0, 0.8 + i * 0.55, 0));
    const n = 3 + Math.floor(rnd() * 3);
    for (let b = 0; b < n; b++) {
      const bh = 0.25 + rnd() * 0.2;
      g.add(put(box(0.18, bh, 0.22, new THREE.MeshStandardMaterial({ color: NPC.top[Math.floor(rnd() * NPC.top.length)], roughness: 0.8 })),
        -w / 2 + 0.3 + b * (w - 0.6) / Math.max(1, n - 1), 0.8 + i * 0.55 + bh / 2 + 0.025, 0));
    }
  }
  g.add(put(box(0.06, 2.2, 0.35, mat('timber')), -w / 2, 1.1, 0));
  g.add(put(box(0.06, 2.2, 0.35, mat('timber')), w / 2, 1.1, 0));
  return g;
}

/* ---------------- architecture ---------------- */
function makeGlassWall(w, h) {
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

function makePendant(kind = 'dome') {
  const g = grp('pendant', '', 'Pendant light');
  const drop = 2.55;
  g.add(put(cyl(0.06, 0.075, 0.06, mat('oak'), 12), 0, -0.03, 0));
  g.add(put(cyl(0.012, 0.012, drop, mat('blackMetal'), 8), 0, -drop / 2, 0));
  const sy = -drop;
  if (kind === 'globe') {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 16), glowMat());
    globe.position.y = sy - 0.08; globe.castShadow = true; g.add(globe);
    g.add(put(cyl(0.05, 0.065, 0.09, mat('oak'), 12), 0, sy + 0.1, 0));
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

function makeSkylight(w = 6, d = 2) {
  const g = grp('skylight', '', 'Skylight strip');
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color: 0xd8ecf4, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  pane.rotation.x = Math.PI / 2; g.add(pane);
  g.add(put(box(w + 0.2, 0.12, 0.15, mat('blackMetal')), 0, 0, -d / 2));
  g.add(put(box(w + 0.2, 0.12, 0.15, mat('blackMetal')), 0, 0, d / 2));
  return g;
}

function makeRug(w = 4, d = 3, color = 0xcfc8b8) {
  const g = grp('rug', '', 'Area rug');
  const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.02; r.receiveShadow = true; g.add(r);
  return g;
}

function makeArtPanel(variant = 0) {
  const g = grp('art-panel', '', 'Wall art');
  g.add(put(box(1.1, 1.4, 0.06, mat('blackMetal')), 0, 0, -0.03));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3),
    new THREE.MeshBasicMaterial({ map: artTexture(variant) }));
  art.position.z = 0.01; g.add(art);
  return g;
}

function makeDeptLabel(name) {
  const g = grp('dept-label', '', `${name} label`);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: deptLabelTexture(name), transparent: true, depthWrite: false,
  }));
  sp.scale.set(3.4, 1.06, 1);
  g.add(sp);
  g.userData.baseY = 0; // falsy -> viewer falls back to 3.5, like the reference
  g.userData.deptName = name;
  return g;
}

function makeWallSign(text, accent) {
  const g = grp('wall-sign', '', 'Wall sign');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshBasicMaterial({ map: statementTexture(text, 1024, 256, accent), transparent: true }));
  g.add(m);
  return g;
}

/* ---------------- template definitions ---------------- */
defineTpl('chair', () => makeChair(false));
defineTpl('chair-accent', () => makeChair(true));
defineTpl('kb', () => makeKeyboard());
defineTpl('mug', () => makeMug());
defineTpl('nb', () => makeNotebookStack());
defineTpl('pen', () => makePen());
defineTpl('tray', () => makeDeskTray());
defineTpl('mon-stand', () => monitorStand());
for (const k of ['code', 'chart', 'design', 'video']) defineTpl('mon-screen-' + k, () => monitorScreen(k));
for (const L of [1.2, 1.5, 1.8, 2, 2.4, 2.6, 3]) defineTpl('planter-' + L, () => makePlanterBox(L));
defineTpl('tree-monstera', () => monsteraPlant(1));
defineTpl('tree-fiddle', () => fiddlePlant(1));
defineTpl('tree-topiary', () => topiaryPlant(1));
defineTpl('tree-bushy', () => bushyTree(1));
defineTpl('pendant-globe', () => makePendant('globe'));
defineTpl('pendant-dome', () => makePendant('dome'));
defineTpl('pendant-cylinder', () => makePendant('cylinder'));
defineTpl('stool', () => makeBarStool());
defineTpl('succulent', () => makeSucculent());
defineTpl('hanging', () => makeHangingPlant());
SEAT_VARIANTS.forEach((v, i) => defineTpl('p-seat-' + i, () => makePerson(true, v)));
STAND_VARIANTS.forEach((v, i) => defineTpl('p-stand-' + i, () => makePerson(false, v)));

/* ===== three/office.js ===== */
/* Spinach OS dashboard — optimized office assembly.
   Faithful port of the reference viewer (13 zones, 141 components, 5 dept labels,
   walkers, explode semantics, pendant layout). Performance layer:
   - Repeated items (chairs, monitors, mugs, keyboards, notebooks, pens, trays,
     desk planters, stools, hanging plants, planter boxes, trees, pendants,
     people) become baked InstancedMesh batches via per-zone placement kits.
     Nested accessories inside furniture groups are NOT registered as components
     (same as the reference: 141 components total).
   - Static groups are vertex-baked (merged) per component; textured /
     transparent / emissive parts are preserved as separate meshes.
   - Pendant bulbs stay emissive (no PointLights); a THREE.Points layer adds
     fake warm glow sprites.
   Floor plate 46 x 34 m, ceiling 5.2 m. Units: meters. */

const FW = 46, FD = 34, CH = 5.2;

// Bake a factory group into a merged group. Baked vertex-colored meshes replace
// the source children; sprites / material-array meshes / textured / transparent /
// emissive parts survive as separate meshes. userData is preserved.
function finalize(obj) {
  if (!obj || !obj.userData) return obj;
  if (obj.userData._finalized) return obj;
  const baked = bakeSmart(obj);
  const out = [];
  if (baked.matte) {
    const m = new THREE.Mesh(baked.matte.geo, VC_MATTE);
    m.castShadow = baked.matte.cast; m.receiveShadow = baked.matte.recv; out.push(m);
  }
  if (baked.metal) {
    const m = new THREE.Mesh(baked.metal.geo, VC_METAL);
    m.castShadow = baked.metal.cast; m.receiveShadow = baked.metal.recv; out.push(m);
  }
  for (const r of baked.rest) {
    const m = new THREE.Mesh(r.geo, r.material);
    m.castShadow = r.cast; m.receiveShadow = r.recv; out.push(m);
  }
  const kept = [];
  obj.traverse(o => { if (o.userData._keep || o.isSprite) kept.push(o); });
  obj.clear();
  for (const m of out) obj.add(m);
  for (const k of kept) { obj.add(k); k.updateMatrix(); k.matrixAutoUpdate = false; }
  obj.userData._finalized = true;
  return obj;
}

/* ---------- per-zone instancing kit ---------- */
class Kit {
  constructor(zoneG) { this.zone = zoneG; this.byKey = new Map(); this._glow = []; }
  place(key, baked, matrix, id, userData, glowY = null) {
    let e = this.byKey.get(key);
    if (!e) { e = { baked, mats: [], ids: [], datas: [], glows: [] }; this.byKey.set(key, e); }
    e.mats.push(matrix); e.ids.push(id); e.datas.push(userData);
    if (glowY !== null) {
      const p = new THREE.Vector3().setFromMatrixPosition(matrix);
      e.glows.push(new THREE.Vector3(p.x, glowY, p.z));
    }
  }
  build(registry) {
    for (const [key, e] of this.byKey) {
      const parts = [];
      if (e.baked.matte) parts.push({ geo: e.baked.matte.geo, mat: VC_MATTE });
      if (e.baked.metal) parts.push({ geo: e.baked.metal.geo, mat: VC_METAL });
      for (const r of e.baked.rest) parts.push({ geo: r.geo, mat: r.material });
      const n = e.mats.length;
      for (const p of parts) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, n);
        for (let i = 0; i < n; i++) im.setMatrixAt(i, e.mats[i]);
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = true; im.receiveShadow = true;
        im.frustumCulled = false;
        im.name = key;
        this.zone.add(im);
        for (let i = 0; i < n; i++) {
          if (e.ids[i]) registry[e.ids[i]] = { kind: 'inst', mesh: im, index: i, userData: e.datas[i] };
        }
      }
      if (e.glows.length) this._glow.push(...e.glows);
    }
  }
}

const TREE_SPECIES = ['monstera', 'fiddle', 'topiary', 'bushy'];

function buildOffice() {
  const root = new THREE.Group();
  root.name = 'spinach-office';
  const zones = {};
  const registry = {};
  const walkers = [];
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
    finalize(obj);
    obj.position.set(x, y, z); obj.rotation.y = ry;
    obj.userData.home = obj.position.clone();
    const dir = new THREE.Vector3(x, 0, z);
    obj.userData.dir = dir.length() > 0.01 ? dir.normalize() : new THREE.Vector3(0, 1, 0);
    if (!obj.userData.id || obj.userData.id === obj.name) {
      const id = cid(zoneG.name, obj.userData.label || 'part');
      obj.userData.id = id; obj.name = id;
    }
    obj.userData.zone = zoneG.name;
    registry[obj.userData.id] = { kind: 'grp', obj, userData: obj.userData };
    // nested kit placements (desk accessories etc.) route into the zone kit, unregistered
    if (obj.userData.placements && obj.userData.placements.length) {
      _e.set(0, ry, 0); _q.setFromEuler(_e);
      const gm = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), _one.clone());
      for (const p of obj.userData.placements) {
        kitFor(zoneG).place(p.key, p.baked, p.matrix.clone().premultiply(gm), null, null);
      }
    }
    zoneG.add(obj);
    return obj;
  }

  const kits = new Map();
  const kitFor = zg => {
    let k = kits.get(zg);
    if (!k) { k = new Kit(zg); kits.set(zg, k); }
    return k;
  };
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _one = new THREE.Vector3(1, 1, 1);
  const _m = (x, y, z, ry, s) => {
    _e.set(0, ry, 0); _q.setFromEuler(_e);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(s, s, s));
  };
  // Instanced top-level component (registered, counts toward the 141).
  function addI(zoneG, key, x, z, ry = 0, y = 0, s = 1, label = '', dims = {}, glowY = null) {
    const id = cid(zoneG.name, label || key);
    kitFor(zoneG).place(key, tpl(key), _m(x, y, z, ry, s), id,
      { id, zone: zoneG.name, label: label || key, dims, selectable: true, kind: key }, glowY);
    return id;
  }

  let _seatV = 0, _standV = 0, _treeIdx = 0, _pendantIdx = 0;
  const personAt = (zoneG, x, z, ry, seated = true) => {
    const key = seated
      ? 'p-seat-' + (_seatV++ % SEAT_VARIANTS.length)
      : 'p-stand-' + (_standV++ % STAND_VARIANTS.length);
    return addI(zoneG, key, x, z, ry, 0, 1, 'Staff member', { seated });
  };
  const treeAt = (zoneG, x, z, h = 2.6) => {
    const sp = TREE_SPECIES[(_treeIdx++) % TREE_SPECIES.length];
    return addI(zoneG, 'tree-' + sp, x, z, 0, 0, h / 2.6, 'Potted tree', { h, species: sp });
  };
  const pendantAt = (x, z) => {
    const kind = ['globe', 'dome', 'cylinder'][(_pendantIdx++) % 3];
    return addI(zones['lighting-rig'], 'pendant-' + kind, x, z, 0, CH, 1, 'Pendant light', {}, CH - 2.7);
  };

  /* ============ SHELL ============ */
  const shell = zone('shell', 'Building shell');
  {
    const floorMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.35 });
    floorMat.map.wrapS = floorMat.map.wrapT = THREE.RepeatWrapping;
    floorMat.map.repeat.set(12, 9);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const fg = grp('floor-slab', 'shell', 'Floor slab'); fg.add(floor); add(shell, fg, 0, 0);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 });
    // north wall (tall, slogan)
    const nw = new THREE.Mesh(new THREE.PlaneGeometry(FW, CH), wallMat.clone());
    nw.material.map = sloganWallTexture(); nw.position.set(0, CH / 2, -FD / 2); nw.receiveShadow = true;
    const nwg = grp('wall-north', 'shell', 'North slogan wall'); nwg.add(nw); add(shell, nwg, 0, 0);
    // west wall
    const ww = new THREE.Mesh(new THREE.PlaneGeometry(FD, CH), wallMat);
    ww.rotation.y = Math.PI / 2; ww.position.set(-FW / 2, CH / 2, 0); ww.receiveShadow = true;
    const wwg = grp('wall-west', 'shell', 'West wall'); wwg.add(ww); add(shell, wwg, 0, 0);
    // east + south glazing
    for (const [wdt, x, z, ry] of [[FD, FW / 2, 0, -Math.PI / 2], [FW, 0, FD / 2, Math.PI]]) {
      const gw = makeGlassWall(wdt, CH);
      add(shell, gw, x, z, ry);
    }
    // ceiling + beams + skylights
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = CH;
    const cg = grp('ceiling', 'shell', 'Ceiling'); cg.add(ceil);
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.28, 0.22), mat('charcoal'));
      beam.position.set(0, CH - 0.15, i * 6.4); cg.add(beam);
    }
    for (const sx of [-11.5, 0, 11.5]) {
      const sk = makeSkylight(7, 1.8);
      sk.position.set(sx, CH - 0.02, -8); cg.add(sk);
      const sk2 = makeSkylight(7, 1.8);
      sk2.position.set(sx, CH - 0.02, 4); cg.add(sk2);
    }
    add(shell, cg, 0, 0);
  }

  /* ============ RECEPTION ============ */
  const rec = zone('reception', 'Reception');
  {
    // brand wall: timber slats + lockup, west wall segment
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6),
      new THREE.MeshStandardMaterial({ map: brandWallTexture(), roughness: 0.6 }));
    bw.rotation.y = Math.PI / 2; bw.position.set(0, 1.8, 0);
    const bwg = grp('brand-wall', 'reception', 'Brand wall'); bwg.add(bw);
    add(rec, bwg, -FW / 2 + 0.06, 11.5);
    add(rec, makeReceptionDesk(), -14.5, 12.3, Math.PI * 0.15);
    const rug = makeRug(5, 3.4); add(rec, rug, -14.5, 12.5);
    const s1 = makeSofa(2.4); add(rec, s1, -19, 14.2, Math.PI / 2);
    const s2 = makeSofa(2.4, 'sofaAccent'); add(rec, s2, -10.5, 14.6, -Math.PI / 2);
    add(rec, makeCoffeeTable(), -14.8, 14.4);
    addI(rec, 'succulent', -14.8, 14.4, 0, 0.41, 1, 'Succulent cluster');
    treeAt(rec, -21, 8.5, 2.8);
    treeAt(rec, -21.5, 15.8, 2.2);
    addI(rec, 'planter-2', -18, 9.2, Math.PI / 2, 0, 1, 'Planter box');
    personAt(rec, -19, 13.4, Math.PI / 2, true);
    personAt(rec, -13.2, 11.6, Math.PI * 0.9, false); // standing at desk
    const ws = makeWallSign('Good people Build great things.', '#16A34A');
    add(rec, ws, -FW / 2 + 0.08, 4.5).rotation.y = Math.PI / 2;
  }

  /* ============ CEO CABIN ============ */
  const ceo = zone('ceo-cabin', 'CEO cabin');
  {
    add(ceo, makeGlassWall(11, 2.9), -15.5, -6, 0);
    add(ceo, makeGlassWall(10, 2.9), -10, -11, Math.PI / 2);
    add(ceo, makeCabinDesk('chart'), -15.5, -12, 0);
    const s = makeSofa(2.0, 'sofaAccent'); add(ceo, s, -19, -8.5, Math.PI / 2);
    add(ceo, makeCoffeeTable(), -19, -11);
    treeAt(ceo, -20.5, -14.5, 2.4);
    addI(ceo, 'planter-1.8', -12, -6.8, 0, 0, 1, 'Planter box');
    personAt(ceo, -15.5, -12.9, 0, true);
  }

  /* ============ RESEARCH CABIN ============ */
  const rch = zone('research-cabin', 'Research cabin');
  {
    add(rch, makeGlassWall(11, 2.9), -3.5, -6, 0);
    add(rch, makeGlassWall(10, 2.9), 2, -11, Math.PI / 2);
    add(rch, makeCabinDesk('code'), -6, -12, 0);
    add(rch, makeCabinDesk('chart'), -1, -12, 0);
    add(rch, makeShelf(3), -8, -16.2);
    addI(rch, 'planter-2', 0.5, -6.8, 0, 0, 1, 'Planter box');
    personAt(rch, -6, -12.9, 0, true);
    personAt(rch, 0.5, -10, -Math.PI / 2, false);
  }

  /* ============ LOUNGE ============ */
  const lou = zone('lounge', 'Lounge');
  {
    const rug = makeRug(7, 5, 0xd8cfa8); add(lou, rug, -7, 3);
    const s1 = makeSofa(3.0); add(lou, s1, -7, 1.2, 0);
    const s2 = makeSofa(3.0, 'sofaAccent'); add(lou, s2, -7, 4.8, Math.PI);
    add(lou, makeCoffeeTable(), -7, 3);
    const ac = makeArmchair(); add(lou, ac, -3.2, 3, -Math.PI / 2); // coffee nook
    const ac2 = makeArmchair(); add(lou, ac2, -10.8, 3, Math.PI / 2);
    addI(lou, 'planter-2.4', -7, 6.4, 0, 0, 1, 'Planter box');
    treeAt(lou, -11.5, 0.2, 2.6);
    // living wall on north wall behind lounge
    const lw = makeLivingWall(6, 2.6); add(lou, lw, -4, -16.8);
    personAt(lou, -7.8, 1.2, 0, true);
    personAt(lou, -6.2, 4.8, Math.PI, true);
    personAt(lou, -3.2, 3, -Math.PI / 2, true);
    const ws = makeWallSign('Ideas to Impact.', '#16A34A');
    add(lou, ws, -FW / 2 + 0.08, 0.5).rotation.y = Math.PI / 2;
  }

  /* ============ ENGINEERING ============ */
  const eng = zone('engineering', 'Engineering');
  {
    const r1 = makeDeskRun(4, 'code', true); add(eng, r1, 4, 0.6);
    const r2 = makeDeskRun(4, 'code', true); add(eng, r2, 4, 4.6);
    addI(eng, 'planter-3', 4, 7.6, 0, 0, 1, 'Planter box');
    treeAt(eng, 0.5, 8.8, 2.4);
    treeAt(eng, 9.5, -1.5, 2.4);
    personAt(eng, 1.1, -0.45, 0, true);
    personAt(eng, 5.2, 5.65, Math.PI, true);
    personAt(eng, 6.2, -0.45, 0, true);
    personAt(eng, 4, 2.6, Math.PI / 2, false);
    const lb = makeDeptLabel('Engineering'); lb.position.y = 3.6; add(eng, lb, 4, 2.6);
    labels.push(lb);
  }

  /* ============ MARKETING ============ */
  const mkt = zone('marketing', 'Marketing');
  {
    const p1 = makeWorkPod('chart'); add(mkt, p1, 13.5, 0.5);
    const p2 = makeWorkPod('video'); add(mkt, p2, 13.5, 4.8);
    const p3 = makeWorkPod('chart'); add(mkt, p3, 18, 2.6);
    addI(mkt, 'planter-2.4', 15.5, 7.4, 0, 0, 1, 'Planter box');
    treeAt(mkt, 20.5, 7.5, 2.2);
    personAt(mkt, 12.65, -1.35, 0, true);
    personAt(mkt, 18.85, 4.45, Math.PI, true);
    const lb = makeDeptLabel('Marketing'); lb.position.y = 3.6; add(mkt, lb, 15.5, 2.6);
    labels.push(lb);
  }

  /* ============ DESIGN ============ */
  const des = zone('design', 'Design');
  {
    const p1 = makeWorkPod('design'); add(des, p1, 4.5, -9);
    const p2 = makeWorkPod('design'); add(des, p2, 4.5, -13);
    const p3 = makeWorkPod('code'); add(des, p3, 10, -11);
    add(des, makeShelf(2.6), 7.5, -16.2);
    addI(des, 'planter-2.4', 1.5, -6.8, 0, 0, 1, 'Planter box');
    personAt(des, 3.65, -10.85, 0, true);
    personAt(des, 10.85, -9.15, Math.PI, true);
    const ws = makeWallSign('Good Design Better Results.', '#16A34A');
    add(des, ws, 7, -16.85);
    const lb = makeDeptLabel('Design'); lb.position.y = 3.6; add(des, lb, 6, -11);
    labels.push(lb);
  }

  /* ============ OPERATIONS ============ */
  const ops = zone('operations', 'Operations');
  {
    const p1 = makeWorkPod('chart'); add(ops, p1, 16.5, -4.5);
    add(ops, makeCabinDesk('code'), 20, -4.5, -Math.PI / 2);
    addI(ops, 'planter-2', 14, -2.2, 0, 0, 1, 'Planter box');
    personAt(ops, 15.65, -6.35, 0, true);
    const ws = makeWallSign('Systems Create Freedom.', '#6B7280');
    add(ops, ws, 16.5, -1.9).rotation.y = Math.PI;
    const lb = makeDeptLabel('Operations'); lb.position.y = 3.6; add(ops, lb, 17, -4.5);
    labels.push(lb);
  }

  /* ============ CLIENTS ============ */
  const cli = zone('clients', 'Clients');
  {
    add(cli, makeGlassWall(8, 2.9), 17, -8, 0);
    add(cli, makeGlassWall(8, 2.9), 13, -12, Math.PI / 2);
    add(cli, makeConfTable(8), 17, -12);
    treeAt(cli, 20.5, -15.5, 2.4);
    addI(cli, 'planter-1.8', 14, -8.8, 0, 0, 1, 'Planter box');
    personAt(cli, 15.8, -10.85, Math.PI, true);
    personAt(cli, 18.2, -13.15, 0, true);
    const lb = makeDeptLabel('Clients'); lb.position.y = 3.4; add(cli, lb, 17, -12);
    labels.push(lb);
  }

  /* ============ CAFE ============ */
  const caf = zone('cafe', 'Cafe');
  {
    const cc = makeCafeCounter(6); add(caf, cc, 21, 7, -Math.PI / 2);
    for (let i = 0; i < 4; i++) addI(caf, 'stool', 19.8, 4.8 + i * 1.5, 0, 0, 1, 'Bar stool');
    for (let i = 0; i < 3; i++) addI(caf, 'hanging', 21, 5 + i * 2, 0, 4.6, 1, 'Hanging plant');
    for (let i = 0; i < 3; i++) add(caf, makeArtPanel(i), 22.85, -6 + i * 2.2).rotation.y = -Math.PI / 2;
    add(caf, makeShelf(2.4), 21.5, 11.5, Math.PI);
    treeAt(caf, 17, 12.8, 2.6);
    const ws = makeWallSign('Build Ship Grow Repeat.', '#16A34A');
    add(caf, ws, 22.85, 1.5).rotation.y = -Math.PI / 2;
    personAt(caf, 19.8, 6.3, Math.PI / 2, true);
    personAt(caf, 20.4, 8.5, -Math.PI / 2, false);
  }

  /* ============ PENDANTS ============ */
  const lit = zone('lighting-rig', 'Lighting rig');
  {
    const pendantRows = [
      { x: 4, z: 0.6, n: 5 }, { x: 4, z: 4.6, n: 5 },
      { x: 13.5, z: 0.5, n: 4 }, { x: 13.5, z: 4.8, n: 4 },
      { x: 4.5, z: -9, n: 4 }, { x: 4.5, z: -13, n: 4 },
      { x: -14.5, z: 12.3, n: 3 }, { x: 21, z: 7, n: 4 },
    ];
    for (const row of pendantRows) {
      for (let i = 0; i < row.n; i++) {
        pendantAt(row.x - (row.n - 1) * 0.85 + i * 1.7, row.z);
      }
    }
  }

  /* ============ WALKERS ============ */
  const wkz = zone('walkers', 'Walkers');
  {
    const walkDefs = [
      { pts: [[-20, -2.5], [20, -2.5]], speed: 1.1 },
      { pts: [[-12, 8.5], [12, 8.5], [12, -3.5], [-12, -3.5]], speed: 0.9 },
      { pts: [[19, 11], [19, -6], [12, -6]], speed: 1.0 },
    ];
    const phases = [0.1, 0.45, 0.75];
    walkDefs.forEach((wd, i) => {
      const w = finalize(makePerson(false, STAND_VARIANTS[i % STAND_VARIANTS.length]));
      w.position.set(wd.pts[0][0], 0, wd.pts[0][1]);
      const id = cid('walkers', `Walker ${i + 1}`);
      w.userData = {
        ...w.userData, id, zone: 'walkers', label: `Walker ${i + 1}`,
        selectable: true, home: w.position.clone(),
      };
      w.name = id;
      wkz.add(w);
      registry[id] = { kind: 'grp', obj: w, userData: w.userData };
      walkers.push({
        g: w, pts: wd.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
        seg: 0, t: phases[i % phases.length], speed: wd.speed,
      });
    });
  }

  /* ============ build instancing kits + fake glow sprites ============ */
  for (const [, k] of kits) k.build(registry);
  let glowPoints = null;
  {
    const pts = [];
    for (const [, k] of kits) pts.push(...k._glow);
    if (pts.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      glowPoints = new THREE.Points(geo, new THREE.PointsMaterial({
        map: glowTexture(), size: 1.6, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0xffd9a0, sizeAttenuation: true, opacity: 0.75,
      }));
      glowPoints.name = 'pendant-glow';
      lit.add(glowPoints);
    }
  }

  // zone home/dir for explode (radial from office center)
  for (const [, zg] of Object.entries(zones)) {
    zg.userData.home = new THREE.Vector3();
    const c = new THREE.Box3().setFromObject(zg).getCenter(new THREE.Vector3());
    const d = new THREE.Vector3(c.x, 0, c.z);
    zg.userData.dir = d.length() > 0.5 ? d.normalize() : new THREE.Vector3(0, 1, 0);
  }

  return { root, zones, registry, walkers, labels, glowPoints };
}

/* ===== three/viewer.js ===== */
/* Spinach OS dashboard — optimized 3D office viewport entry.
   initOfficeViewport(container, opts) -> handle
   Handle: { ready, select, setZoneVisible, explode, setPreset, setLighting,
             getComponent, listZones, listComponents, getDeptAnchors,
             focusDepartment, setQuality, getPerfStats, dispose } */

const CAM = {
  'Aerial (reference)': { pos: [36, 32, 42], tgt: [0, 0, -2] },
  'Reference view': { pos: [-17, 3.8, 15], tgt: [10, 1, -10] },
  'Reception': { pos: [-6, 3.2, 19], tgt: [-16, 1.4, 11] },
  'Desk field': { pos: [4, 2.6, 13], tgt: [4, 1, 0.5] },
  'Lounge': { pos: [-1, 3.2, 10.5], tgt: [-8, 1, 3] },
  'Cafe': { pos: [13, 3.2, 13], tgt: [21, 1.2, 7] },
  'Top-down': { pos: [0, 58, 0.1], tgt: [0, 0, 0] },
  'Dashboard': { pos: [22, 13, 26], tgt: [-1, 1, -2] },
};
// dashboard-friendly aliases
const PRESET_ALIASES = {
  aerial: 'Aerial (reference)', lobby: 'Reception', lounge: 'Lounge',
  'open-plan': 'Desk field', cafe: 'Cafe', 'ceo-suite': 'Reference view', top: 'Top-down',
};

function initOfficeViewport(container, opts = {}) {
  const qualityParam = new URLSearchParams(location.search).get('quality');
  let quality = opts.quality || (qualityParam === 'high' || qualityParam === 'low' ? qualityParam : 'high');
  let disposed = false;

  const dprCap = () => (quality === 'high' ? Math.min(devicePixelRatio, 1.5) : 1);

  let renderer = null, controls = null, rInfo = null;

  function makeRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: 'high-performance' });
    r.setPixelRatio(dprCap());
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = quality === 'high';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    return r;
  }
  function makeControls() {
    const c = new OrbitControls(camera, renderer.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.minDistance = 6;
    c.maxDistance = 110;
    c.maxPolarAngle = Math.PI / 2.08;
    c.addEventListener('change', () => {
      const t = c.target;
      t.x = THREE.MathUtils.clamp(t.x, -30, 30);
      t.z = THREE.MathUtils.clamp(t.z, -30, 30);
      t.y = THREE.MathUtils.clamp(t.y, 0, 12);
    });
    return c;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1512);
  scene.fog = new THREE.Fog(0x0e1512, 90, 170);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 500);
  const startPreset = CAM[opts.preset] ? opts.preset : 'Dashboard';
  camera.position.set(...CAM[startPreset].pos);

  renderer = makeRenderer();
  container.appendChild(renderer.domElement);
  controls = makeControls();
  controls.target.set(...CAM[startPreset].tgt);
  rInfo = renderer.info;

  // ---- lighting: one tight directional shadow light + hemisphere fill ----
  const sun = new THREE.DirectionalLight(0xfff1de, 2.6);
  sun.position.set(28, 34, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 8; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xd8ecf4, 0x3a3428, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.28); scene.add(amb);

  // ---- office build ----
  const off = buildOffice();
  scene.add(off.root);
  // Dashboard overlay uses its own HTML dept tags — hide the floating 3D text
  // labels (their world positions stay valid for tag anchors).
  if (opts.hideLabels !== false) off.labels.forEach(lb => { lb.visible = false; });

  /* selection — Box3Helper outline; never touches shared baked materials. */
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const _m4 = new THREE.Matrix4();
  let selHelper = null;
  function clearSel() {
    if (selHelper) { scene.remove(selHelper); selHelper.geometry.dispose(); selHelper = null; }
  }
  function showSel(obj, instanceId = -1) {
    clearSel();
    let box;
    if (instanceId >= 0 && obj.isInstancedMesh) {
      obj.geometry.computeBoundingBox();
      box = obj.geometry.boundingBox.clone();
      obj.getMatrixAt(instanceId, _m4);
      box.applyMatrix4(_m4);
      box.applyMatrix4(obj.matrixWorld);
    } else {
      box = new THREE.Box3().setFromObject(obj);
    }
    if (box.isEmpty()) return;
    selHelper = new THREE.Box3Helper(box, 0x16a34a);
    scene.add(selHelper);
  }
  function findSelectableRoot(obj) {
    let o = obj;
    while (o && o !== off.root) {
      if (o.userData && o.userData.selectable) return o;
      o = o.parent;
    }
    return null;
  }
  function onPointerDown(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(off.root.children, true);
    clearSel();
    if (!hits.length) return;
    const h = hits[0];
    if (h.object.isInstancedMesh && h.instanceId !== undefined) showSel(h.object, h.instanceId);
    else {
      const root = findSelectableRoot(h.object);
      if (root) showSel(root);
    }
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  /* camera tween (~1s) */
  let tween = null;
  function flyTo(pos, tgt) {
    tween = {
      t: 0, dur: 1.0,
      p0: camera.position.clone(), p1: new THREE.Vector3(...pos),
      t0: controls.target.clone(), t1: new THREE.Vector3(...tgt),
    };
  }
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /* animation loop */
  const clock = new THREE.Clock();
  let frames = 0, fpsT = 0, fps = 60;
  let lowSince = 0, degraded = false;

  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    if (tween) {
      tween.t += dt;
      const k = ease(Math.min(1, tween.t / tween.dur));
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.t >= tween.dur) tween = null;
    }
    for (const w of off.walkers) {
      if (!w.g.visible) continue;
      const pts = w.pts;
      const a = pts[w.seg], b = pts[(w.seg + 1) % pts.length];
      const segLen = Math.max(0.001, a.distanceTo(b));
      w.t += (w.speed * dt) / segLen;
      if (w.t >= 1) { w.t = 0; w.seg = (w.seg + 1) % pts.length; continue; }
      w.g.position.lerpVectors(a, b, w.t);
      w.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      w.g.position.y = Math.abs(Math.sin(t * 8)) * 0.03;
    }
    // label bobbing (reference behavior)
    off.labels.forEach((lb, i) => {
      lb.position.y = (lb.userData.baseY || 3.5) + Math.sin(t * 1.2 + i) * 0.15;
    });
    controls.update();
    renderer.render(scene, camera);
    frames++; fpsT += dt;
    if (fpsT >= 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
    if (!degraded && quality === 'high') {
      if (fps < 30) { lowSince += dt; if (lowSince >= 3) { degraded = true; api.setQuality('low'); } }
      else lowSince = 0;
    }
  }

  function applyQuality() {
    const low = quality === 'low';
    renderer.shadowMap.enabled = !low;
    sun.castShadow = !low;
    sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    renderer.setPixelRatio(dprCap());
    off.walkers.forEach(w => { w.g.visible = !low; });
    off.zones.walkers.visible = !low;
  }

  function rebuildForQuality() {
    // antialias is fixed at context creation -> rebuild the renderer + controls
    const oldCanvas = renderer.domElement;
    const tgt = controls.target.clone();
    controls.dispose();
    renderer.dispose();
    renderer = makeRenderer();
    container.replaceChild(renderer.domElement, oldCanvas);
    controls = makeControls();
    controls.target.copy(tgt);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    rInfo = renderer.info;
    clearSel();
  }

  function setPreset(name) {
    const key = CAM[name] ? name : (PRESET_ALIASES[name] || 'Aerial (reference)');
    const p = CAM[key];
    flyTo(p.pos, p.tgt);
  }

  function setLighting(mode) {
    if (mode === 'evening') {
      sun.color.setHex(0xff9a5c); sun.intensity = 0.35;
      hemi.color.setHex(0x2a3550); hemi.groundColor.setHex(0x1a1410); hemi.intensity = 0.3;
      amb.intensity = 0.1;
      scene.background.setHex(0x0a0d16); scene.fog.color.setHex(0x0a0d16);
      if (off.glowPoints) off.glowPoints.material.opacity = 1.0;
    } else {
      sun.color.setHex(0xfff1de); sun.intensity = 2.6;
      hemi.color.setHex(0xd8ecf4); hemi.groundColor.setHex(0x3a3428); hemi.intensity = 0.85;
      amb.intensity = 0.28;
      scene.background.setHex(0x0e1512); scene.fog.color.setHex(0x0e1512);
      if (off.glowPoints) off.glowPoints.material.opacity = 0.75;
    }
  }

  function focusDepartment(name) {
    if (name === 'CEO') { flyTo([-15.5, 5, 2], [-15.5, 1.2, -12]); return true; }
    const lb = off.labels.find(l => l.userData.deptName === name);
    if (!lb) return false;
    const p = lb.position;
    flyTo([p.x + 7, 5.5, p.z + 9], [p.x, 1.4, p.z]);
    return true;
  }

  function dispose() {
    disposed = true;
    if (ro) ro.disconnect();
    window.removeEventListener('resize', onResize);
    controls.dispose();
    clearSel();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    renderer.dispose();
    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
  }

  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(onResize);
  ro.observe(container);
  window.addEventListener('resize', onResize);

  const api = {
    ready: Promise.resolve().then(() => { animate(); }),
    select(id) {
      const rec = off.registry[id];
      if (!rec) return false;
      if (rec.kind === 'inst') showSel(rec.mesh, rec.index);
      else showSel(rec.obj);
      return true;
    },
    setZoneVisible(zone, v) { if (off.zones[zone]) off.zones[zone].visible = !!v; },
    explode(f) {
      for (const [id, zg] of Object.entries(off.zones)) {
        if (id === 'walkers' || id === 'shell' || id === 'lighting-rig') continue;
        const d = zg.userData.dir;
        zg.position.set(d.x * f * 5, f * 1.2, d.z * f * 5);
      }
    },
    setPreset,
    setLighting,
    getComponent(id) {
      const rec = off.registry[id];
      return rec ? rec.userData : null;
    },
    listZones() { return Object.keys(off.zones); },
    listComponents() { return Object.keys(off.registry); },
    getDeptAnchors() {
      const anchors = off.labels.map(l => {
        const p = new THREE.Vector3();
        l.getWorldPosition(p);
        return { name: l.userData.deptName, position: p };
      });
      anchors.push({ name: 'CEO', position: new THREE.Vector3(-15.5, 3.4, -12) });
      return anchors;
    },
    focusDepartment,
    setQuality(mode) {
      if (mode !== 'high' && mode !== 'low') return;
      if (mode === quality) { applyQuality(); return; }
      quality = mode;
      rebuildForQuality();
      applyQuality();
    },
    getPerfStats() {
      return {
        drawCalls: rInfo.render.calls,
        triangles: rInfo.render.triangles,
        geometries: rInfo.memory.geometries,
        textures: rInfo.memory.textures,
        fps: Math.round(fps * 10) / 10,
      };
    },
    dispose,
    // dashboard overlay integration (non-contract): tag projection + canvas wiring.
    // _renderer is a getter because setQuality('low'|'high') rebuilds the renderer.
    _three: THREE,
    _camera: camera,
    get _renderer() { return renderer; },
  };
  setLighting(opts.lighting || 'evening');
  applyQuality();
  return api;
}

export { initOfficeViewport, CAM, PRESET_ALIASES };
