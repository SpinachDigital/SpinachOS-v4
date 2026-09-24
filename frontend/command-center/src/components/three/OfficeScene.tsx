"use client";

import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Text, Html, useGLTF, useAnimations } from '@react-three/drei';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import NPC from './NPC';
import FurnitureGLB from './FurnitureGLB';
import CameraController from './CameraController';
import { useSpinachStore } from '@/store/spinach-store';
import { Group } from 'three';

export function OfficeScene() {
  const [mounted, setMounted] = useState(false);
  const [lightMode, setLightMode] = useState(false); // day/night — flips via 'office-theme' event
  const { 
    routingState, 
    currentRouting, 
    cameraTarget,
    setCameraTarget 
  } = useSpinachStore();
  
  // Determine camera mode based on routing state
  const [cameraMode, setCameraMode] = useState<'idle' | 'focus' | 'ceo' | 'department'>('idle');
  const [focusDept, setFocusDept] = useState<string | undefined>();

  useEffect(() => {
    setMounted(true);
    const onTheme = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLightMode(!!detail?.light);
    };
    window.addEventListener('office-theme', onTheme);
    return () => window.removeEventListener('office-theme', onTheme);
  }, []);

  useEffect(() => {
    if (routingState === 'executing' && currentRouting) {
      setCameraMode('department');
      setFocusDept(currentRouting.department);
      setCameraTarget([
        deptPositions[currentRouting.department]?.x || 0,
        deptPositions[currentRouting.department]?.y || 0,
        deptPositions[currentRouting.department]?.z || 0
      ]);
    } else if (routingState === 'idle') {
      setCameraMode('idle');
      setCameraTarget(null);
    }
  }, [routingState, currentRouting, setCameraTarget]);

  // Department positions in the office - matching reference layout
  const deptPositions: Record<string, THREE.Vector3> = {
      engineering: new THREE.Vector3(-14, 0, 6),
      design: new THREE.Vector3(14, 0, 6),
      marketing: new THREE.Vector3(14, 0, -8),
      sales: new THREE.Vector3(-14, 0, -8),
      research: new THREE.Vector3(-7, 0, 11),
      operations: new THREE.Vector3(7, 0, 11),
      social: new THREE.Vector3(0, 0, 0),
    };

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="text-green-400 font-mono text-sm mb-4">Loading Office...</div>
          <div className="w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
            <div className="w-1/4 h-full bg-green-500 rounded-full animate-ping" />
          </div>
        </div>
      </div>
    );
  }


    return (
        <Canvas
                  shadows
                  camera={{ position: [0, 22, 22], fov: 35 }}
                  style={{ outline: 'none' }}
                  gl={{ preserveDrawingBuffer: true, antialias: true }}
                  onCreated={({ scene }) => { scene.background = new THREE.Color('#0d1117'); }}
                >
                {/* ============ CINEMATIC LIGHTING — night rig (lightMode flips to day) ============ */}
                <ambientLight intensity={lightMode ? 1.1 : 0.3} color={lightMode ? '#fdfbf5' : '#fff8f0'} />

                {/* City glow horizon — kills the pitch-black void behind the walls */}
                {!lightMode && <directionalLight position={[-40, 4, -40]} intensity={0.35} color="#2a3a5a" />}

                {/* Day rig: bright warm daylight (light mode) */}
                {lightMode && <directionalLight position={[-30, 45, 30]} intensity={1.4} color="#fff8ec" />}
      
        {/* Main sun - warm golden hour */}
        <directionalLight 
          position={[30, 40, 20]} 
          intensity={2.5} 
          castShadow 
          color="#fff5e6"
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-far={80}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
        />
      
        {/* Fill light - cool bounce */}
        <directionalLight 
          position={[-20, 15, -20]} 
          intensity={0.8} 
          color="#88aaff"
        />

        {/* Upper-left quadrant fill — kills the dark corner */}
        <directionalLight position={[-35, 20, 10]} intensity={0.45} color="#fdf6e8" />
  
        {/* Rim light for depth */}
        <directionalLight 
          position={[0, 10, -30]} 
          intensity={0.4} 
          color="#ffddaa"
        />
      
        {/* HDRI Environment — real office HDR from Hermes3D asset pack (reflections) */}
        <Environment
          files="/env/office_env_1k.hdr"
          background={false}
        />
      
      {/* Atmospheric haze — far, subtle (near fog ate the whole far half) */}
      <fog attach="fog" args={['#14141e', 30, 110]} />
      
      {/* ============ FLOOR - POLISHED WOOD WITH REFLECTIONS ============ */}
      <group>
        {/* Main floor - polished wood */}
        <mesh 
          position={[0, -0.02, 0]} 
          rotation={[-Math.PI / 2, 0, 0]} 
          receiveShadow
        >
          <planeGeometry args={[80, 80, 100, 100]} />
          <meshPhysicalMaterial 
            color="#3d2b1f"
            roughness={0.15}
            metalness={0.05}
            clearcoat={0.8}
            clearcoatRoughness={0.05}
            envMapIntensity={1.5}
          />
        </mesh>
        
        {/* Floor boards texture via normal map simulation */}
        <mesh 
          position={[0, 0.001, 0]} 
          rotation={[-Math.PI / 2, 0, 0]} 
        >
          <planeGeometry args={[80, 80, 100, 100]} />
          <meshStandardMaterial 
            color="#2d1f15"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* Area rugs under desk clusters */}
        <AreaRug position={[-18, 0, 8]} rotation={0} size={[16, 12]} color="#1a1a2e" />
        <AreaRug position={[18, 0, 8]} rotation={0} size={[16, 12]} color="#1a1a2e" />
        <AreaRug position={[18, 0, -8]} rotation={0} size={[16, 12]} color="#1a1a2e" />
        <AreaRug position={[-18, 0, -8]} rotation={0} size={[16, 12]} color="#1a1a2e" />
        <AreaRug position={[0, 0, 0]} rotation={0} size={[12, 10]} color="#0d0d1a" />
        
        {/* Grid Lines on Floor - subtle */}
        <gridHelper args={[80, 80, '#3a2f1f', '#1a1a2e']} position={[0, 0.005, 0]} />
      </group>
      
      {/* ============ OFFICE LAYOUT ============ */}
      <OfficeWalls />
      <OfficeFurniture />
      <DepartmentZones positions={deptPositions} />
      
      {/* NPCs for each department - seated at desks */}
      {Object.entries(deptPositions).map(([dept, pos]) => (
        <DeskCluster 
          key={dept}
          dept={dept}
          position={[pos.x, 0, pos.z]}
          agentCount={Math.floor(Math.random() * 3) + 2}
        />
      ))}
      
      {/* CEO Cabin */}
      <CEOCabin />
      
      {/* Contact Shadows for NPCs */}
      {Object.values(deptPositions).map((pos, i) => (
        <ContactShadows
          key={i}
          position={[pos.x, 0, pos.z]}
          opacity={0.4}
          scale={7}
          blur={2.5}
          far={9}
        />
      ))}
      
      {/* Zone labels: static legend chips in page.tsx (3D Html billboards removed —
          they scaled giant near the camera and overlapped the UI) */}
      {/* Camera Controller */}
      <CameraController 
        mode={cameraMode}
        department={focusDept}
        target={cameraTarget ? new THREE.Vector3(cameraTarget[0], cameraTarget[1], cameraTarget[2]) : null}
      />
      
      {/* Orbit Controls handled inside CameraController (single owner — no camera fight) */}
    </Canvas>
  );
}

// ============ AREA RUG COMPONENT ============
function AreaRug({ position, rotation, size, color }: { 
  position: [number, number, number], 
  rotation: number, 
  size: [number, number],
  color: string 
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh 
        position={[0, 0.005, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={size} />
        <meshStandardMaterial 
          color={color}
          roughness={0.95}
          metalness={0}
          transparent
          opacity={0.4}
        />
      </mesh>
      {/* Rug border */}
      <mesh 
        position={[0, 0.006, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[size[0]/2 - 0.15, size[0]/2, 32]} />
        <meshBasicMaterial color="#3d2f1f" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ============ DESK CLUSTER COMPONENT ============
function DeskCluster({ dept, position, agentCount }: {
  dept: string,
  position: [number, number, number],
  agentCount: number
}) {
  // Store-driven: this department's live agent state drives every NPC here
  const deptAgent = useSpinachStore((s) => s.agentStates[dept]);
  const npcState = (deptAgent?.state === 'working' || deptAgent?.state === 'thinking'
    ? 'working'
    : deptAgent?.state === 'blocked' ? 'blocked'
    : deptAgent?.state === 'speaking' ? 'speaking'
    : 'idle') as 'idle' | 'working' | 'blocked' | 'speaking';

  const deptColors: Record<string, string> = {
    engineering: '#22c55e',
    design: '#a855f7',
    marketing: '#ec4899',
    sales: '#f97316',
    research: '#3b82f6',
    operations: '#eab308',
    social: '#06b6d4',
  };

  const color = deptColors[dept] || '#22c55e';
  const desksPerRow = 3;
  const deskSpacing = 2.8;
  const monitorHeight = 1.1;

  return (
    <group position={position}>
      {/* Department label on floor */}
      <mesh 
        position={[0, 0.03, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <Text
          anchorX="center"
          anchorY="middle"
          color={color}
          fontSize={0.6}
          fontWeight={600}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {dept.toUpperCase()}
        </Text>
      </mesh>

      {/* Desk rows */}
      <group>
        {Array.from({ length: Math.ceil(agentCount / desksPerRow) }, (_, row) => (
          <group key={row} position={[0, 0, row * -3.5]}>
            {Array.from({ length: Math.min(desksPerRow, agentCount - row * desksPerRow) }, (_, col) => (
              <Desk
                key={`${row}-${col}`}
                position={[(col - 1) * deskSpacing, 0, 0]}
                color={color}
                hasAgent={true}
                npcState={npcState}
              />
            ))}
          </group>
        ))}
      </group>
      
      {/* Zone indicator ring */}
      <mesh 
        position={[0, 0.02, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[6, 6.3, 32]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Desk({ position, color, hasAgent, npcState = 'idle' }: {
  position: [number, number, number],
  color: string,
  hasAgent: boolean,
  npcState?: 'idle' | 'working' | 'blocked' | 'speaking',
}) {
  return (
    <group position={position}>
      {/* GLB desk from Hermes3D asset pack */}
      <FurnitureGLB model="desk" position={[0, 0, 0]} />

      {/* GLB task chair */}
      <FurnitureGLB model="chairDesk" position={[0, 0, 0.75]} rotation={[0, Math.PI, 0]} />

      {/* GLB monitor on the desk */}
      <FurnitureGLB model="computerScreen" position={[0, 0.72, -0.25]} />

      {/* Agent NPC - seated — store-driven state + per-department tint */}
      <NPC state={npcState} position={[0, 0, 0.75]} scale={0.015} deptTint={color} />
    </group>
  );
}

function OfficeWalls() {
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: '#1a1a2e',
    roughness: 0.7,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
    transmission: 0,
    side: THREE.DoubleSide,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#00ffff',
    transparent: true,
    opacity: 0.08,
    transmission: 0.92,
    roughness: 0,
    metalness: 0,
    thickness: 0.15,
    side: THREE.DoubleSide,
  });

  const walls = [
    // Back wall with poster area
    { pos: [0, 3, -25] as [number, number, number], size: [60, 6, 0.3] as [number, number, number], material: wallMaterial, type: 'solid' },
    // Left wall — glass (was solid: flat silhouette blocked the upper-left quadrant)
    { pos: [-30, 3, 0] as [number, number, number], size: [0.3, 6, 50] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], material: glassMaterial, type: 'glass' },
    // Right wall - glass with door
    { pos: [30, 3, 0] as [number, number, number], size: [0.3, 6, 50] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number], material: glassMaterial, type: 'glass' },
    // Front wall - glass entrance
    { pos: [0, 3, 25] as [number, number, number], size: [40, 6, 0.3] as [number, number, number], material: glassMaterial, type: 'glass' },
    // Meeting room glass walls (center-right)
    { pos: [10, 3, -5] as [number, number, number], size: [0.2, 4, 12] as [number, number, number], material: glassMaterial, type: 'glass' },
    { pos: [16, 3, -11] as [number, number, number], size: [12, 4, 0.2] as [number, number, number], material: glassMaterial, type: 'glass' },
    { pos: [22, 3, -5] as [number, number, number], size: [0.2, 4, 12] as [number, number, number], material: glassMaterial, type: 'glass' },
  ];

  return (
    <>
      {walls.map((wall, i) => (
        <mesh
          key={i}
          position={wall.pos}
          rotation={wall.rotation || [0, 0, 0]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={wall.size} />
          <meshPhysicalMaterial 
            color={wall.material.color}
            roughness={wall.material.roughness}
            metalness={wall.material.metalness}
            transparent={wall.material.transparent}
            opacity={wall.material.opacity}
            transmission={wall.material.transmission || 0}
            thickness={wall.material.thickness || 0}
            side={wall.material.side}
          />
        </mesh>
      ))}
      
      {/* Wall posters/motivational text */}
      <WallPoster position={[-20, 2, -24.8]} text="IDEAS → SYSTEMS → IMPACT" color="#eab308" />
      <WallPoster position={[20, 2, -24.8]} text="BETTER IDEAS FOR A BRIGHTER TOMORROW" color="#22c55e" />
      <WallPoster position={[0, 2, 24.8]} text="BUILD • SHIP • GROW • REPEAT" color="#ec4899" rotation={[0, Math.PI, 0]} />
      <WallPoster position={[-28, 2, 0]} text="A HEALTHIER DIGITAL TOMORROW" color="#3b82f6" rotation={[0, -Math.PI/2, 0]} />
      <WallPoster position={[28, 2, 0]} text="SHIP FAST. LEARN FASTER." color="#ec4899" rotation={[0, Math.PI/2, 0]} />
    </>
  );
}

function WallPoster({ position, text, color, rotation = [0, 0, 0] }: { 
  position: [number, number, number], 
  text: string, 
  color: string,
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[8, 1.5]} />
        <meshBasicMaterial color="#0a0a10" side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 0, 0.05]}
        color={color}
        fontSize={0.35}
        anchorX="center"
        anchorY="middle"
        fontWeight={600}
        letterSpacing={0.02}
      >
        {text}
      </Text>
    </group>
  );
}

// ============ OFFICE FURNITURE ============
function OfficeFurniture() {
  return (
    <>
      {/* Lounge area - center */}
      <LoungeArea position={[0, 0, 0]} />
      
      {/* Meeting room table */}
      <MeetingRoom position={[13, 0, -5]} />
      
      {/* Reception / welcome area */}
      <ReceptionArea position={[0, 0, 22]} />
      
      {/* Coffee station */}
      <CoffeeStation position={[-25, 0, 20]} />
      
      {/* Whiteboard area */}
      <WhiteboardArea position={[-20, 0, -20]} />
    </>
  );
}

function LoungeArea({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* GLB lounge set from Hermes3D asset pack */}
      <FurnitureGLB model="loungeSofa" position={[0, 0, -2]} />
      <FurnitureGLB model="loungeDesignChair" position={[-2.2, 0, 1.5]} rotation={[0, Math.PI / 4, 0]} />
      <FurnitureGLB model="loungeDesignChair" position={[2.2, 0, 1.5]} rotation={[0, -Math.PI / 4, 0]} />
      <FurnitureGLB model="tableCoffee" position={[0, 0, 0.3]} />
      <FurnitureGLB model="lampRoundFloor" position={[-3.2, 0, -2.5]} />
      <FurnitureGLB model="pottedPlant" position={[3.2, 0, -2.5]} />
    </group>
  );
}

function MeetingRoom({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table */}
      <mesh position={[0, 0.38, 0]} receiveShadow castShadow>
        <boxGeometry args={[5, 0.06, 2.5]} />
        <meshPhysicalMaterial color="#1a1410" roughness={0.2} metalness={0.05} clearcoat={0.6} clearcoatRoughness={0.1} />
      </mesh>
      
      {/* Table legs */}
      <mesh position={[-2.4, 0.19, -1.2]} receiveShadow castShadow>
        <boxGeometry args={[0.08, 0.38, 0.08]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[2.4, 0.19, -1.2]} receiveShadow castShadow>
        <boxGeometry args={[0.08, 0.38, 0.08]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[-2.4, 0.19, 1.2]} receiveShadow castShadow>
        <boxGeometry args={[0.08, 0.38, 0.08]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[2.4, 0.19, 1.2]} receiveShadow castShadow>
        <boxGeometry args={[0.08, 0.38, 0.08]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      
      {/* Chairs around table - 6 chairs */}
      {[-2, 0, 2].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Chair position={[-2.8, 0, 0]} rotation={[0, Math.PI/2, 0]} />
          <Chair position={[2.8, 0, 0]} rotation={[0, -Math.PI/2, 0]} />
        </group>
      ))}
      
      {/* TV screen on wall */}
      <mesh position={[0, 1.8, -6.3]} receiveShadow>
        <boxGeometry args={[3, 1.7, 0.05]} />
        <meshPhysicalMaterial color="#050508" roughness={0.05} metalness={0.95} />
      </mesh>
      <mesh position={[0, 1.8, -6.25]}>
        <planeGeometry args={[2.9, 1.6]} />
        <meshBasicMaterial color="#1a2a3a" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Chair({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.55, 0.05, 0.55]} />
        <meshStandardMaterial color="#0d0d15" roughness={0.8} metalness={0.05} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.55, -0.25]} receiveShadow castShadow>
        <boxGeometry args={[0.55, 0.7, 0.05]} />
        <meshStandardMaterial color="#0d0d15" roughness={0.8} metalness={0.05} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.22, 0.125, -0.22]} receiveShadow castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.25, 8]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0.22, 0.125, -0.22]} receiveShadow castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.25, 8]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[-0.22, 0.125, 0.22]} receiveShadow castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.25, 8]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0.22, 0.125, 0.22]} receiveShadow castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.25, 8]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  );
}

function ReceptionArea({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Reception desk */}
      <mesh position={[0, 0.55, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 1.1, 1.2]} />
        <meshPhysicalMaterial color="#0d0d15" roughness={0.3} metalness={0.05} clearcoat={0.4} clearcoatRoughness={0.1} />
      </mesh>
      
      {/* Reception logo */}
      <Text
        position={[0, 0.5, 0.65]}
        color="#22c55e"
        fontSize={0.5}
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
      >
        SPINACH LABS
      </Text>
      
      {/* Welcome plant */}
      <PlantPot position={[-2.5, 0, 0.8]} scale={1.2} />
      <PlantPot position={[2.5, 0, 0.8]} scale={1.2} />
    </group>
  );
}

function CoffeeStation({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Counter */}
      <mesh position={[0, 0.45, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.9, 0.8]} />
        <meshPhysicalMaterial color="#1a1410" roughness={0.3} metalness={0.05} clearcoat={0.4} clearcoatRoughness={0.1} />
      </mesh>
      
      {/* Coffee machine */}
      <mesh position={[-0.8, 0.8, 0.2]} receiveShadow castShadow>
        <boxGeometry args={[0.4, 0.7, 0.4]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[-0.8, 1.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 16]} />
        <meshStandardMaterial color="#eab308" roughness={0.2} metalness={0.5} />
      </mesh>
      
      {/* Mugs */}
      <mesh position={[-0.5, 0.9, 0.3]} receiveShadow castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
        <meshStandardMaterial color="#1a0a05" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[0.5, 0.9, 0.25]} receiveShadow castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
        <meshStandardMaterial color="#1a0a05" roughness={0.8} metalness={0.1} />
      </mesh>
      
      {/* Plant */}
      <PlantPot position={[1.2, 0, 0.3]} scale={0.8} />
    </group>
  );
}

function WhiteboardArea({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Whiteboard */}
      <mesh position={[0, 1.5, -0.05]} receiveShadow>
        <boxGeometry args={[3, 2, 0.05]} />
        <meshStandardMaterial color="#f0f0eb" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <Text
          anchorX="center"
          anchorY="middle"
          color="#374151"
          fontSize={0.25}
          fontWeight={400}
          lineHeight={1.2}
        >
          SPRINT PLANNING
          \n□ Design system v2
          \n□ API refactor
          \n□ 3D office polish
          \n□ Laya integration
        </Text>
      </mesh>
      
      {/* Marker tray */}
      <mesh position={[0, 0.2, 1.8]} receiveShadow castShadow>
        <boxGeometry args={[1.5, 0.08, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.1} />
      </mesh>
      
      {/* Markers */}
      <mesh position={[-0.5, 0.26, 1.8]} receiveShadow castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.26, 1.8]} receiveShadow castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0.5, 0.26, 1.8]} receiveShadow castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
        <meshStandardMaterial color="#22c55e" roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

function PlantPot({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {/* GLB plant from Hermes3D asset pack */}
      <FurnitureGLB model="pottedPlant" position={[0, 0, 0]} />
    </group>
  );
}

function DepartmentZones({ positions }: { positions: Record<string, THREE.Vector3> }) {
  const deptColors: Record<string, string> = {
    engineering: '#22c55e',
    design: '#a855f7',
    marketing: '#ec4899',
    sales: '#f97316',
    research: '#3b82f6',
    operations: '#eab308',
    social: '#06b6d4',
  };

  return (
    <>
      {Object.entries(positions).map(([dept, pos]) => (
        <group key={dept}>
          {/* Zone Floor Marker */}
          <mesh 
            position={[pos.x, 0.02, pos.z]} 
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[5, 32]} />
            <meshBasicMaterial 
              color={deptColors[dept]}
              transparent
              opacity={0.12}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* Department Label */}
          <Text
            position={[pos.x, 3, pos.z]}
            color={deptColors[dept]}
            fontSize={0.55}
            anchorX="center"
            anchorY="middle"
            fontWeight={600}
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {dept.toUpperCase()}
          </Text>
        </group>
      ))}
    </>
  );
}

// ============ FLOATING ZONE LABELS ============
function FloatingZoneLabels({ positions }: { positions: Record<string, THREE.Vector3> }) {
  const deptColors: Record<string, string> = {
    engineering: '#22c55e',
    design: '#a855f7',
    marketing: '#ec4899',
    sales: '#f97316',
    research: '#3b82f6',
    operations: '#eab308',
    social: '#06b6d4',
  };

  return (
    <>
      {Object.entries(positions).map(([dept, pos]) => (
        <Html
          key={dept}
          position={[pos.x, 4.2, pos.z]}
          center
          distanceFactor={28}
          zIndexRange={[10, 0]}
        >
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(10,10,15,0.78)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: `1px solid ${deptColors[dept]}55`,
              fontSize: '8px',
              fontWeight: 700,
              color: 'rgba(247,246,241,0.92)',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            <span style={{ color: deptColors[dept] }}>●</span> {dept.toUpperCase()}
          </div>
        </Html>
      ))}
    </>
  );
}

// ============ CEO CABIN ============
function CEOCabin() {
  return (
    <group position={[0, 0, -12]}>
      {/* Glass Walls - 4 sides */}
      <mesh position={[0, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshPhysicalMaterial
          color="#00ffff"
          transparent
          opacity={0.06}
          transmission={0.98}
          roughness={0}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2, 4]} receiveShadow castShadow>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshPhysicalMaterial
          color="#00ffff"
          transparent
          opacity={0.06}
          transmission={0.98}
          roughness={0}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2, 4]} receiveShadow castShadow>
        <boxGeometry args={[0.1, 4, 8]} />
        <meshPhysicalMaterial
          color="#00ffff"
          transparent
          opacity={0.06}
          transmission={0.98}
          roughness={0}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-4, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshPhysicalMaterial
          color="#00ffff"
          transparent
          opacity={0.06}
          transmission={0.98}
          roughness={0}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[4, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshPhysicalMaterial
          color="#00ffff"
          transparent
          opacity={0.06}
          transmission={0.98}
          roughness={0}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Floor - dark wood */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshPhysicalMaterial color="#0d0d1a" roughness={0.15} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.05} />
      </mesh>
      
      {/* Area rug */}
      <mesh position={[0, 0.01, -2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.5, 32]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.95} transparent opacity={0.4} />
      </mesh>
      
      {/* CEO Desk - executive */}
      <mesh position={[0, 0.4, -2]} receiveShadow castShadow>
        <boxGeometry args={[2.8, 0.75, 1.6]} />
        <meshPhysicalMaterial color="#0d0d1a" roughness={0.2} metalness={0.05} clearcoat={0.6} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, 0.35, -3.5]} receiveShadow castShadow>
        <boxGeometry args={[0.4, 0.35, 1.6]} />
        <meshStandardMaterial color="#0d0d1a" roughness={0.7} metalness={0.05} />
      </mesh>
      
      {/* CEO Chair - executive leather */}
      <group position={[0, 0, -4]}>
        <mesh position={[0, 0.35, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.7, 0.06, 0.7]} />
          <meshStandardMaterial color="#080808" roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.7, -0.25]} receiveShadow castShadow>
          <boxGeometry args={[0.7, 0.8, 0.06]} />
          <meshStandardMaterial color="#080808" roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.4, -0.55]} receiveShadow castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.06, 16]} />
          <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.2} />
        </mesh>
        {/* Base */}
        <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.08, 16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.2} metalness={0.3} />
        </mesh>
        {/* Wheels */}
        {[-0.3, 0.3].map(x => [-0.3, 0.3].map(y => (
          <mesh key={`${x}-${y}`} position={[x, 0.04, y]} receiveShadow castShadow>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.5} metalness={0.3} />
          </mesh>
        )))}
      </group>
      
      {/* Executive monitor */}
      <mesh position={[0, 0.85, -1.5]} receiveShadow castShadow>
        <boxGeometry args={[0.7, 0.4, 0.03]} />
        <meshPhysicalMaterial color="#030305" roughness={0.02} metalness={0.98} />
      </mesh>
      <mesh position={[0, 0.85, -1.47]} receiveShadow>
        <planeGeometry args={[0.68, 0.38]} />
        <meshBasicMaterial color="#0a1a1a" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Executive chair light */}
            <group>
              <mesh visible={false} position={[0, 1, -4]} />
              <spotLight
                position={[0, 5, -4]}
                angle={0.25}
                penumbra={0.4}
                intensity={3}
                color="#ffeebb"
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
              />
            </group>
      
      {/* Accent lighting - gold strips */}
      <mesh position={[0, 3.95, -2]} receiveShadow>
        <boxGeometry args={[6, 0.05, 0.1]} />
        <meshBasicMaterial color="#eab308" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// ============ FLOATING ZONE LABELS ============
function getAgentState(dept: string): 'idle' | 'thinking' | 'working' | 'blocked' | 'speaking' {
  // This would connect to the store in a real implementation
  return 'idle';
}