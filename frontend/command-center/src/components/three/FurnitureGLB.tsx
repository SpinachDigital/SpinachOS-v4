"use client";

// FurnitureGLB — GLB furniture models from the Hermes3D office-assets pack.
// Lazy-loads a named model from /models/furniture/ with useMemo cloning so
// multiple instances animate/position independently.
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group } from 'three';

interface FurnitureGLBProps {
  model: string;              // e.g. 'desk', 'chairDesk', 'pottedPlant' (no .glb)
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function FurnitureGLB({
  model,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: FurnitureGLBProps) {
  const { scene } = useGLTF(`/models/furniture/${model}.glb`);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={cloned} dispose={null} />
    </group>
  );
}

// Preload all furniture models once at module level
useGLTF.preload('/models/furniture/desk.glb');
useGLTF.preload('/models/furniture/chairDesk.glb');
useGLTF.preload('/models/furniture/computerScreen.glb');
useGLTF.preload('/models/furniture/pottedPlant.glb');
useGLTF.preload('/models/furniture/loungeSofa.glb');
useGLTF.preload('/models/furniture/loungeDesignChair.glb');
useGLTF.preload('/models/furniture/tableCoffee.glb');
useGLTF.preload('/models/furniture/lampRoundFloor.glb');
