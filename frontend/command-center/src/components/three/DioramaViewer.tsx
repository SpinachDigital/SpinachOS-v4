'use client';

// DioramaViewer — native 3D Spinach Labs office (no iframe).
// Wraps the embeddable office-diorama module per its README:
//   createOfficeViewer(container, { THREE, OrbitControls, lighting, onZoneClick })
// StrictMode-safe: the effect cleanup disposes the viewer; the double-mount
// (dev StrictMode) creates → disposes → re-creates cleanly.
//
// Sprint 6 "Living Office" integration:
// - Floating HTML labels per agent zone: agent name + truncated current task + status dot.
//   Anchors: the module's own zone-center positions (zone-centers.ts = the points
//   office.js places its dept labels at) projected through the captured camera.
//   The camera is captured WITHOUT touching module source: the module calls
//   `new OrbitControls(camera, dom)` with OUR subclass (passed via options) which
//   records the camera. Labels project in a wrapper-owned RAF loop (2s throttle —
//   no re-render storms).
// - Live data flows in via the `agentLabels` prop (WS + /api/v1/hr/roster in the page).
// - Label click → /tasks/[id] (Sprint 1 detail page) via onTaskClick.
// - Honesty: the label shows exactly what the roster reports — idle when nothing runs.
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOfficeViewer } from '@/lib/office-diorama/viewer';
import { ZONE_CENTERS } from '@/lib/office-diorama/zone-centers';

type AgentState = 'active' | 'busy' | 'idle' | 'offline';

export interface AgentLabelData {
  agent: string;
  name: string;
  zoneId: string;
  status: AgentState;
  task: string | null;      // truncated current task title (null → idle, never invented)
  taskId: string | null;    // → /tasks/[id]
}

export interface DioramaLabel {
  agent: string;
  x: number;                // % of container width
  y: number;                // % of container height
  visible: boolean;
}

// Capture the camera WITHOUT touching module source: the module constructs
// OrbitControls from OUR options.OrbitControls — the subclass records the camera
// it's handed (this.object).
class CapturingOrbitControls extends OrbitControls {
  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    super(camera, domElement);
    CapturingOrbitControls.camera = camera as THREE.PerspectiveCamera;
  }
  static camera: THREE.PerspectiveCamera | null = null;
}
const WrappedOrbitControls = CapturingOrbitControls as typeof OrbitControls;

const STATE_DOT_COLOR: Record<AgentState, string> = {
  active: '#22c55e',
  busy: '#f59e0b',
  idle: '#6b7280',
  offline: '#1a1a1a',
};

export default function DioramaViewer({
  agentStates,
  agentLabels,
  onZoneClick,
  onTaskClick,
  lighting = 'evening',
}: {
  agentStates?: Record<string, AgentState>;
  agentLabels?: AgentLabelData[];
  onZoneClick?: (zoneId: string, label: string) => void;
  onTaskClick?: (taskId: string) => void;
  lighting?: 'day' | 'evening' | 'night';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ReturnType<typeof createOfficeViewer> | null>(null);
  const clickRef = useRef(onZoneClick);
  clickRef.current = onZoneClick;
  const taskClickRef = useRef(onTaskClick);
  taskClickRef.current = onTaskClick;

  // label screen positions (% coords) — updated by the wrapper RAF at ~2s cadence
  const [labelPos, setLabelPos] = useState<Record<string, DioramaLabel>>({});
  const labelsRef = useRef<Record<string, DioramaLabel>>({});
  // mobile compact mode (< 600px): show only the role badge (● Name) — task on tap
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    const v = createOfficeViewer(container, {
      THREE,
      OrbitControls: WrappedOrbitControls,
      lighting,
      onZoneClick: (zoneId: string, label: string) => clickRef.current?.(zoneId, label),
    });
    viewerRef.current = v;

    // wrapper-owned RAF: project zone centers → HTML label coords, throttled
    const tmpV = new THREE.Vector3();
    let lastPaint = 0;
    let raf = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - lastPaint < 2000) return; // max ~1 update/2s — re-render storms nahi
      lastPaint = t;
      const camera = CapturingOrbitControls.camera;
      if (!camera) return;

      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const next: Record<string, DioramaLabel> = {};
      if (agentLabelsRef.current) {
        for (const l of agentLabelsRef.current) {
          const center = ZONE_CENTERS[l.zoneId];
          if (!center) continue;
          tmpV.set(center[0], 3.2, center[1]); // float at label height above the zone
          tmpV.project(camera);
          next[l.agent] = {
            agent: l.agent,
            x: ((tmpV.x + 1) / 2) * 100,
            y: ((1 - tmpV.y) / 2) * 100,
            visible: tmpV.z < 1 && tmpV.x > -1.08 && tmpV.x < 1.08 && tmpV.y > -1.08 && tmpV.y < 1.08,
          };
        }
      }
      labelsRef.current = next;
      setLabelPos(next);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      v.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (agentStates) viewerRef.current?.setAgentStates(agentStates);
  }, [agentStates]);

  // keep the RAF reading the latest labels without re-arming
  const agentLabelsRef = useRef<AgentLabelData[] | undefined>(agentLabels);
  agentLabelsRef.current = agentLabels;

  const handleLabelClick = useCallback((agent: string) => {
    const data = agentLabelsRef.current?.find((l) => l.agent === agent);
    if (data?.taskId) taskClickRef.current?.(data.taskId);
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="absolute inset-0" />
      {/* floating HTML labels — one per agent zone, live from the roster */}
      {agentLabels?.map((l) => {
        const pos = labelPos[l.agent];
        if (!pos || !pos.visible) return null;
        return (
          <button
            key={l.agent}
            type="button"
            onClick={() => handleLabelClick(l.agent)}
            className="absolute z-10 flex items-center gap-1.5 text-left"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              padding: compact ? '4px 8px' : '5px 10px',
              borderRadius: 10,
              cursor: l.taskId ? 'pointer' : 'default',
              background: 'rgba(10, 10, 10, 0.82)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(6px)',
              maxWidth: compact ? 120 : 220,
              pointerEvents: 'auto',
            }}
            title={l.task ? `${l.name}: ${l.task}` : `${l.name}: idle`}
            aria-label={`${l.name} — ${l.task ? l.task : 'idle'}`}
          >
            <span
              aria-hidden
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: STATE_DOT_COLOR[l.status],
                boxShadow: l.status === 'active' ? `0 0 6px ${STATE_DOT_COLOR.active}` : 'none',
              }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {l.name}
              </span>
              {!compact && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.task ? `✍️ ${l.task}` : 'idle'}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
