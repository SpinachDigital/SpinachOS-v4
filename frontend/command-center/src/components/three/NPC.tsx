"use client";

// NPC — worker.glb agent avatar with state-driven Mixamo animations + per-department tint.
// worker.glb has 14 clips: Dance, Death, Idle, Jump, No, Punch, Running,
// Sitting, Standing, ThumbsUp, Walking, WalkJump, Wave, Yes.
// Map agent states to the closest available clip. "Typing"/"Thinking" don't
// exist in this pack — Sitting reads as "at the desk working", Standing as idle.
import { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationClip, Color, MeshStandardMaterial, Mesh, Material } from 'three';

interface NPCProps {
  state: 'idle' | 'thinking' | 'working' | 'blocked' | 'speaking';
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  deptTint?: string;   // subtle per-department accent (muted hex) — tints torso materials
  onLoad?: () => void;
}

const STATE_ANIM: Record<string, string[]> = {
  idle: ['Idle', 'Standing'],
  thinking: ['Standing', 'Idle'],           // upright, thinking pose
  working: ['Sitting', 'Idle'],             // seated at desk = working
  blocked: ['No', 'Idle'],
  speaking: ['Wave', 'Idle'],
};

export default function NPC({
  state,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  deptTint,
  onLoad,
}: NPCProps) {
  const groupRef = useRef<Group>(null);

  const { scene, animations } = useGLTF('/models/worker.glb');

  // Clone the scene skeleton per instance so each NPC runs its own
  // AnimationMixer (a shared scene would sync every NPC's animation).
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // Per-department tint: clone the 2 largest-surface materials and shift color subtly
  useEffect(() => {
    if (!deptTint || !cloned) return;
    const tint = new Color(deptTint);
    let applied = 0;
    cloned.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || applied >= 2) return; // tint at most 2 materials (torso/large surfaces)
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = mats.map((m) => {
        const mat = m as MeshStandardMaterial;
        if (!mat || !(mat as any).isMeshStandardMaterial) return m;
        if (applied >= 2) return m;
        applied++;
        // Clone the material and lerp toward the dept tint (20% — subtle, muted)
        const clone = mat.clone();
        clone.color = clone.color.clone().lerp(tint, 0.2);
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? (newMats as Material[]) : (newMats[0] as Material);
    });
  }, [deptTint, cloned]);

  const { actions } = useAnimations(animations as AnimationClip[], groupRef);

  useEffect(() => {
    if (!actions) return;

    Object.values(actions).forEach((a) => a?.stop());

    const candidates = STATE_ANIM[state] || ['Idle'];
    let action = null;
    for (const name of candidates) {
      if (actions[name]) {
        action = actions[name];
        break;
      }
    }
    // Fallback: play the first available clip
    if (!action) {
      const first = Object.keys(actions)[0];
      if (first) action = actions[first];
    }

    if (action) {
      action.reset();
      action.play();
      action.clampWhenFinished = false;
    }
  }, [state, actions]);

  // Call onLoad when scene is ready
  useEffect(() => {
    if (scene && onLoad) {
      onLoad();
    }
  }, [scene, onLoad]);

  if (!scene) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={cloned} dispose={null} />
    </group>
  );
}

// Preload once at module level so the Canvas doesn't suspend per-instance
useGLTF.preload('/models/worker.glb');
