/* Procedural canvas textures for the Spinach Labs office scene.
   Brand lockup: stacked "spinach" Bold + green dot as the dot of the "i",
   "labs" wide-tracked Regular right-aligned beneath. Palette: #16A34A, #0B0F0B, #F8F9F7. */
import * as THREE from 'three';

const GREEN = '#16A34A';
const CHARCOAL = '#0B0F0B';
const WARM_WHITE = '#F8F9F7';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Brand wordmark drawn exactly as the official stacked lockup. */
export function brandLockupTexture(w = 1024, h = 512, opts = {}) {
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
export function brandWallTexture(w = 1024, h = 1024) {
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
export function sloganWallTexture(w = 2048, h = 512) {
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
export function statementTexture(text, w = 1024, h = 256, accent = GREEN) {
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
export function screenTexture(kind = 'code', w = 512, h = 320) {
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
export function artTexture(variant = 0, w = 512, h = 640) {
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
export function deptLabelTexture(name, w = 512, h = 160) {
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
export function concreteTexture(w = 512, h = 512) {
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
export function oakTexture(w = 512, h = 256) {  const [c, g] = makeCanvas(w, h);
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
export function meshTexture(w = 256, h = 256) {
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

export function helloSignTexture(w = 256, h = 128) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = '#16a34a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4f1ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 62px sans-serif';
  g.fillText('hello', w / 2, h / 2 + 2);
  return toTexture(c);
}

export function menuBoardTexture(w = 256, h = 320) {
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
