'use client';

// DioramaViewer — native 3D Spinach Labs office (no iframe).
// Wraps the embeddable office-diorama module per its README:
//   createOfficeViewer(container, { THREE, OrbitControls, lighting, onZoneClick })
// StrictMode-safe: the effect cleanup disposes the viewer; the double-mount
// (dev StrictMode) creates → disposes → re-creates cleanly.
// Live agent states flow in via the `agentStates` prop (WS feed).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOfficeViewer } from '@/lib/office-diorama/viewer';

type AgentState = 'active' | 'busy' | 'idle' | 'offline';

export default function DioramaViewer({
  agentStates,
  onZoneClick,
  lighting = 'evening',
}: {
  agentStates?: Record<string, AgentState>;
  onZoneClick?: (zoneId: string, label: string) => void;
  lighting?: 'day' | 'evening' | 'night';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ReturnType<typeof createOfficeViewer> | null>(null);
  const clickRef = useRef(onZoneClick);
  clickRef.current = onZoneClick;

  useEffect(() => {
    if (!ref.current) return;
    const v = createOfficeViewer(ref.current, {
      THREE,
      OrbitControls,
      lighting,
      onZoneClick: (zoneId: string, label: string) => clickRef.current?.(zoneId, label),
    });
    viewerRef.current = v;
    return () => {
      v.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (agentStates) viewerRef.current?.setAgentStates(agentStates);
  }, [agentStates]);

  return <div ref={ref} className="w-full h-full" />;
}
