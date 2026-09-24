'use client';

// ReferenceOffice — React wrapper around the extracted reference 3D office
// (reference-office.js, from spinach-os.html): procedural shell w/ slogan wall,
// glass walls, skylights, 141-component kit, staff, trees, pendant lights.
// Dept tags project REAL world positions every frame (no more hardcoded %).
import { useEffect, useRef, useState, useCallback } from 'react';
import { initOfficeViewport } from './reference-office';
import { useSpinachStore } from '@/store/spinach-store';

export interface DeptTag { id: string; label: string; x: number; y: number; state?: string; visible: boolean }

// Map anchor names → our dept ids
const ANCHOR_TO_DEPT: Record<string, string> = {
  ENGINEERING: 'engineering', DESIGN: 'design', MARKETING: 'marketing', SALES: 'sales',
  RESEARCH: 'research', OPERATIONS: 'operations', SOCIAL: 'social', CEO: 'ceo',
};

export default function ReferenceOffice({ onDeptClick }: { onDeptClick?: (dept: string) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<any>(null);
  const [tags, setTags] = useState<DeptTag[]>([]);
  const [lighting, setLighting] = useState<'day' | 'evening'>('evening');
  const agentStates = useSpinachStore((s) => s.agentStates);

  // focus a department: fly the camera to its zone (3D dept tag click)
  const focusDept = useCallback((label: string) => {
    handleRef.current?.focusDepartment?.(label);
  }, []);

  // ---- mount the office once ----
  useEffect(() => {
    if (!mountRef.current || handleRef.current) return;
    let raf = 0;
    const handle = initOfficeViewport(mountRef.current, {
      preset: 'Dashboard',
      lighting: 'evening',
      hideLabels: true, // HTML tags replace 3D text labels
    });
    handleRef.current = handle;
    handle.ready.then(() => {
      let frame = 0;
      const projectTags = () => {
        // project dept anchors → container % coords, every 3rd frame (cheap)
        if (frame++ % 3 === 0) {
          const anchors = handle.getDeptAnchors();
          const cam = handle._camera;
          const w = mountRef.current?.clientWidth ?? 1;
          const h = mountRef.current?.clientHeight ?? 1;
          const next: DeptTag[] = [];
          for (const a of anchors) {
            const p = a.position.clone().project(cam);
            const id = ANCHOR_TO_DEPT[a.name] || a.name.toLowerCase();
            const visible = p.z < 1 && p.x > -1.05 && p.x < 1.05 && p.y > -1.05 && p.y < 1.05;
            next.push({
              id,
              label: a.name,
              x: (p.x * 0.5 + 0.5) * 100,
              y: (-p.y * 0.5 + 0.5) * 100,
              visible,
            });
          }
          setTags(next);
        }
        raf = requestAnimationFrame(projectTags);
      };
      raf = requestAnimationFrame(projectTags);
    });
    return () => {
      cancelAnimationFrame(raf);
      handle.dispose();
      handleRef.current = null;
    };
  }, []);

  // ---- day/night toggle (topbar ◐ button dispatches 'office-theme') ----
  useEffect(() => {
    const onTheme = (e: Event) => {
      const light = !!(e as CustomEvent).detail?.light;
      setLighting(light ? 'day' : 'evening');
      handleRef.current?.setLighting?.(light ? 'day' : 'evening');
    };
    window.addEventListener('office-theme', onTheme);
    return () => window.removeEventListener('office-theme', onTheme);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      {/* dept tags — projected from real 3D world positions; click = fly camera to zone */}
      <div className="viewport-tags">
        {tags.filter(t => t.visible).map(t => {
          const st = agentStates[t.id];
          const working = st && (st.state === 'working' || st.state === 'thinking');
          return (
            <div
              key={t.id}
              className="dept-tag"
              style={{ left: `${t.x}%`, top: `${t.y}%`, borderColor: working ? 'rgba(22,163,74,0.85)' : undefined }}
              onClick={() => { focusDept(t.label); onDeptClick?.(t.id); }}
            >
              <span className="dot" />
              {t.label}
              {st && <span className="sub">{st.state}</span>}
            </div>
          );
        })}
      </div>
      {/* HUD: lighting + perf chip */}
      <div className="viewport-hud tl">
        <div className="hud-chip">{lighting === 'day' ? '☀ Day mode' : '◐ Evening mode'}</div>
      </div>
      <div className="viewport-hud tr">
        <button
          className="hud-btn"
          type="button"
          onClick={() => {
            const next = lighting === 'day' ? 'evening' : 'day';
            setLighting(next);
            handleRef.current?.setLighting?.(next);
            window.dispatchEvent(new CustomEvent('office-theme', { detail: { light: next === 'day' } }));
          }}
        >
          Toggle {lighting === 'day' ? 'Evening' : 'Day'}
        </button>
      </div>
    </div>
  );
}