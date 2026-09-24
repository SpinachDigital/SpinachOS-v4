import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface CameraControllerProps {
  target?: THREE.Vector3 | [number, number, number] | null;
  mode?: 'idle' | 'focus' | 'ceo' | 'department';
  department?: string;
}

type Vec3 = [number, number, number];

// Department zone camera positions (match OfficeScene dept layout)
const DEPT_CAM: Record<string, { pos: Vec3; look: Vec3 }> = {
  engineering: { pos: [-13, 5.5, 13], look: [-18, 0.5, 8] },
  design: { pos: [13, 5.5, 13], look: [18, 0.5, 8] },
  marketing: { pos: [13, 5.5, -3], look: [18, 0.5, -8] },
  sales: { pos: [-13, 5.5, -3], look: [-18, 0.5, -8] },
  research: { pos: [-6, 5.5, 19], look: [-8, 0.5, 15] },
  operations: { pos: [6, 5.5, 19], look: [8, 0.5, 15] },
  social: { pos: [6, 4, 6], look: [0, 0.5, 0] },
};

const CEO_CAM: { pos: Vec3; look: Vec3 } = { pos: [4, 3, -6], look: [0, 1, -12] };

// Base camera for idle drift — high god-view with clearance above the front desk clusters;
// no NPC clips the near plane (robot clipping fixed by raising y and pulling z back)
const BASE_CAM: { pos: Vec3; look: Vec3 } = { pos: [-19, 19, 30], look: [0, 0.5, -1] };

export default function CameraController({
  target = null,
  mode = 'idle',
  department,
}: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const lastInteraction = useRef(Date.now() + 10_000); // auto-camera starts 10s after load
  const focusAnim = useRef<{ active: boolean; t: number; fromPos: THREE.Vector3; fromLook: THREE.Vector3; toPos: THREE.Vector3; toLook: THREE.Vector3 } | null>(null);

  const lookRef = useRef(new THREE.Vector3(...BASE_CAM.look));
  const desiredPos = useRef(new THREE.Vector3(...BASE_CAM.pos));

  // Set initial camera
  useEffect(() => {
    camera.position.set(...BASE_CAM.pos);
    lookRef.current.set(...BASE_CAM.look);
    camera.lookAt(lookRef.current);
  }, [camera]);

  // User grab → cancel auto-camera + focus animation, hand control to OrbitControls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onUserGrab = () => {
      lastInteraction.current = Date.now();
      focusAnim.current = null;
    };
    controls.addEventListener('start', onUserGrab);
    return () => controls.removeEventListener('start', onUserGrab);
  }, []);

  // Mode / target change → start a smooth focus animation
  useEffect(() => {
    if (mode === 'idle' || (!target && !department)) {
      focusAnim.current = null;
      return;
    }
    let toPos: [number, number, number];
    let toLook: [number, number, number];
    if (mode === 'department' && department && DEPT_CAM[department]) {
      ({ pos: toPos, look: toLook } = DEPT_CAM[department]);
    } else if (mode === 'ceo') {
      ({ pos: toPos, look: toLook } = CEO_CAM);
    } else if (target) {
      const t = target instanceof THREE.Vector3 ? [target.x, target.y, target.z] : target;
      toPos = [t[0] + 4, t[1] + 3.5, t[2] + 5];
      toLook = [t[0], t[1] + 0.5, t[2]];
    } else {
      return;
    }
    focusAnim.current = {
      active: true,
      t: 0,
      fromPos: camera.position.clone(),
      fromLook: lookRef.current.clone(),
      toPos: new THREE.Vector3(...toPos),
      toLook: new THREE.Vector3(...toLook),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, department, target]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;

    // 1) Focus animation: 0.9s eased lerp, then hand back to OrbitControls
    if (focusAnim.current?.active) {
      const anim = focusAnim.current;
      anim.t = Math.min(anim.t + delta / 0.9, 1);
      const e = anim.t < 0.5 ? 2 * anim.t * anim.t : 1 - Math.pow(-2 * anim.t + 2, 2) / 2; // easeInOutQuad
      camera.position.lerpVectors(anim.fromPos, anim.toPos, e);
      lookRef.current.lerpVectors(anim.fromLook, anim.toLook, e);
      camera.lookAt(lookRef.current);
      if (controls) {
        controls.target.copy(lookRef.current);
        controls.update();
      }
      if (anim.t >= 1) focusAnim.current = null; // done — user can orbit freely
      return;
    }

    // 2) Idle drift: only after 10s without interaction; pauses the moment user grabs
    const idleFor = Date.now() - lastInteraction.current;
    if (mode === 'idle' && idleFor > 10_000) {
      const t = performance.now() / 1000;
      desiredPos.current.set(
        BASE_CAM.pos[0] + Math.sin(t * 0.12) * 1.5,
        BASE_CAM.pos[1] + Math.cos(t * 0.09) * 0.4,
        BASE_CAM.pos[2] + Math.cos(t * 0.12) * 1.5,
      );
      camera.position.lerp(desiredPos.current, 0.015);
      const driftLook = new THREE.Vector3(
        Math.sin(t * 0.08) * 1.2,
        0.5,
        BASE_CAM.look[2] + Math.cos(t * 0.08) * 1.2,
      );
      lookRef.current.lerp(driftLook, 0.02);
      camera.lookAt(lookRef.current);
      if (controls) {
        controls.target.copy(lookRef.current);
        controls.update();
      }
    }
    // else: OrbitControls fully owns the camera — no per-frame overwrite (fixes snap-back)
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.06}
      minDistance={5}
      maxDistance={50}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2.1}
      zoomSpeed={1.1}
      panSpeed={0.8}
    />
  );
}
