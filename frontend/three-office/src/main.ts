import * as THREE from 'three';
import { OfficeScene } from './OfficeScene';

// ============================================
// MAIN ENTRY POINT
// ============================================
const container = document.getElementById('three-container')!;
const scene = new OfficeScene(container);

// Global for debugging
(window as any).spinachScene = scene;

// UI Event Listeners
document.getElementById('btn-ceo-room')?.addEventListener('click', () => scene.enterRoom('ceo-room'));
document.getElementById('btn-cto-room')?.addEventListener('click', () => scene.enterRoom('cto-room'));
document.getElementById('btn-sales-room')?.addEventListener('click', () => scene.enterRoom('sales-room'));
document.getElementById('btn-content-room')?.addEventListener('click', () => scene.enterRoom('content-studio'));
document.getElementById('btn-design-room')?.addEventListener('click', () => scene.enterRoom('design-studio'));
document.getElementById('btn-eng-room')?.addEventListener('click', () => scene.enterRoom('engineering-lab'));
document.getElementById('btn-ops-room')?.addEventListener('click', () => scene.enterRoom('ops-room'));
document.getElementById('btn-exit-room')?.addEventListener('click', () => scene.exitRoom());

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Could pause animations
  }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  scene.dispose();
});

console.log('Spinach OS 3D Office loaded');
console.log('Available rooms:', ['ceo-room', 'cto-room', 'sales-room', 'content-studio', 'design-studio', 'engineering-lab', 'ops-room']);
console.log('Use spinachScene.enterRoom("room-id") to navigate');