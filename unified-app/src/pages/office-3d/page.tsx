'use client';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

export default function Office3D() {
  const containerRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const { agents, setAgents, feed, setFeed, workflows, setWorkflows } = useStore();

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onopen = () => console.log('WebSocket connected for 3D Office');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.event) {
          case 'agent_state':
            setAgents(prev => prev.map(a => 
              a.agent === msg.data.agent 
                ? { ...a, state: msg.data.state, activity: msg.data.activity } 
                : a
            ));
            break;
          case 'feed':
            setFeed(prev => [msg.data, ...prev.slice(0, 99)]);
            break;
          case 'task_update':
            setWorkflows(prev => {
              const existing = prev.find(w => w.id === msg.data.id);
              if (existing) {
                return prev.map(w => 
                  w.id === msg.data.id 
                    ? { ...w, ...msg.data } 
                    : w
                );
              }
              return [...prev, msg.data];
            });
            break;
          case 'approval':
            // Handle approval updates
            break;
          case 'workflow':
            setWorkflows(prev => {
              const existing = prev.find(w => w.id === msg.data.id);
              if (existing) {
                return prev.map(w => 
                  w.id === msg.data.id 
                    ? { ...w, ...msg.data } 
                    : w
                );
              }
              return [...prev, msg.data];
            });
            break;
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };
    ws.onerror = (e) => console.error('WS error:', e);
    ws.onclose = () => {
      console.log('WS closed, reconnecting in 5s...');
      setTimeout(() => {
        // Reconnection logic would go here in production
      }, 5000);
    };
    
    return () => ws.close();
  }, [setAgents, setFeed, setWorkflows]);

  useEffect(() => {
    if (!containerRef.current || mounted) return;

    // WebGL capability check — three.js WebGLRenderer throws hard without it,
    // which previously crashed the React tree and left a dead "Loading..." screen.
    try {
      const testCanvas = document.createElement('canvas');
      const testGl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!testGl) {
        setWebglError('WebGL is not available in this browser/view. Open the dashboard in Chrome/Edge for the 3D office.');
        return;
      }
    } catch {
      setWebglError('WebGL is not available in this browser/view. Open the dashboard in Chrome/Edge for the 3D office.');
      return;
    }

    try {
    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 20, 60);

    const camera = new THREE.PerspectiveCamera(60, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 12, 25);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;

    // Lights
    const ambient = new THREE.AmbientLight(0x222222, 0.5);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0x444455, 0.8);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 30;
    mainLight.shadow.camera.bottom = -30;
    scene.add(mainLight);

    const accentColor = new THREE.Color(0x4CAF50);
    // Room positions would be defined here
    // For simplicity, using placeholder positions
    const roomPositions = [
      new THREE.Vector3(-15, 0, 0), // CEO Room
      new THREE.Vector3(15, 0, 0),  // CTO Room
      new THREE.Vector3(0, 0, -15), // Sales Room
      new THREE.Vector3(-12, 0, 12), // Content Studio
      new THREE.Vector3(12, 0, 12),  // Design Studio
      new THREE.Vector3(0, 0, 15),   // Engineering Lab
      new THREE.Vector3(0, 0, 0),    // Ops Control
    ];

    // Create rooms (simplified)
    roomPositions.forEach((pos, index) => {
      const geometry = new THREE.BoxGeometry(10, 4, 10);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x0d0d0d,
        roughness: 0.9,
        metalness: 0.1,
      });
      const room = new THREE.Mesh(geometry, material);
      room.position.copy(pos);
      room.receiveShadow = true;
      scene.add(room);
    });

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(80, 80, 80, 80);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d0d0d,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid helper
    const gridHelper = new THREE.GridHelper(80, 80, 0x1a1a2e, 0x0f0f0f);
    scene.add(gridHelper);

    // Central hub
    const hubGeometry = new THREE.CylinderGeometry(7, 7, 0.2, 32);
    const hubMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x0d0d0d, 
      roughness: 0.8,
      metalness: 0.2 
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.receiveShadow = true;
    scene.add(hub);

    // Spinning data ring
    const ringGeometry = new THREE.TorusGeometry(2.5, 0.08, 16, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.6 });
    const dataRing = new THREE.Mesh(ringGeometry, ringMaterial);
    dataRing.position.y = 1.2;
    dataRing.rotation.x = Math.PI / 2;
    scene.add(dataRing);

    // Pulse animation
    gsap.to(dataRing.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 2, repeat: -1, yoyo: true, ease: 'power1.inOut' });

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Animate data ring
      dataRing.rotation.z += 0.002;
      
      // Update controls
      controls.update();
      
      // Render
      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const onResize = () => {
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    
    window.addEventListener('resize', onResize);
    
    setMounted(true);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      controls.dispose();
    };
    } catch (err) {
      console.error('[Office3D] three.js init failed:', err);
      setWebglError('3D office failed to initialize on this device. Open the dashboard in Chrome/Edge, or use the Command Center view.');
    }
  }, [mounted, setMounted, setAgents, setFeed, setWorkflows]);

  if (webglError) {
    return (
      <div className="h-[calc(100vh-60px)] flex items-center justify-center bg-dark-100 p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="text-2xl">⚠️</div>
          <p className="text-foreground font-medium">{webglError}</p>
          <p className="text-muted-foreground text-sm">Switch back to the Command Center to keep working.</p>
        </div>
      </div>
    );
  }

  if (!mounted) {
    return <div className="h-[calc(100vh-60px)] flex items-center justify-center bg-dark-100">Loading 3D Office...</div>;
  }

  return (
    <div 
      ref={containerRef} 
      className="h-[calc(100vh-60px)] w-full"
      style={{ touchAction: 'none' }}
    />
  );
}