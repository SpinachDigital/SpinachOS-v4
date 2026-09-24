import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class NPCAvatar extends THREE.Group {
  constructor(personality: string) {
    super();
    this.createDummy(personality);
  }

  createDummy(personality: string) {
    const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
    const mesh = new THREE.Mesh(geometry, material);
    this.add(mesh);
  }
}
