'use client';

// Office page — the 3D Spinach Labs diorama (native render, no iframe).
// Live agent states flow from the shared WS feed; lighting toggle
// day/evening/night (default evening). Zone click prefills the command bar.
import { useEffect, useState } from 'react';
import DioramaViewer from '@/components/three/DioramaViewer';
import { useWebSocket } from '@/hooks/useWebSocket';

type AgentState = 'active' | 'busy' | 'idle' | 'offline';

// map the WS feed's status field to the viewer's beacon states —
// no fake data: missing agents default to 'idle'
const KNOWN_AGENTS = ['engineering', 'social', 'designer', 'orchestrator', 'ceo', 'research', 'sales'];

function mapStates(raw: Record<string, { agent: string; state: string; activity?: string }>): Record<string, AgentState> {
  const out: Record<string, AgentState> = {};
  for (const key of KNOWN_AGENTS) {
    const entry = raw[key];
    const s = (entry?.state || 'idle').toLowerCase();
    out[key] = s === 'working' || s === 'active' ? 'active' : s === 'thinking' || s === 'busy' || s === 'speaking' ? 'busy' : s === 'offline' ? 'offline' : 'idle';
  }
  return out;
}

const ZONE_SUGGESTIONS: Record<string, string> = {
  engineering: 'status of engineering tasks',
  social: 'status of social media queue',
  designer: 'status of design deliverables',
  orchestrator: 'daily standup',
  ceo: 'show pending approvals',
  research: 'status of research tasks',
  sales: 'status of sales outreach',
};

export default function OfficePage() {
  const { agentStates: rawStates } = useWebSocket();
  const [states, setStates] = useState<Record<string, AgentState>>(() => mapStates({}));
  const [lighting, setLighting] = useState<'day' | 'evening' | 'night'>('evening');
  const [prefill, setPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    setStates(mapStates(rawStates as Record<string, { agent: string; state: string; activity?: string }>));
  }, [rawStates]);

  const onZoneClick = (zoneId: string) => {
    // prefill, never auto-send — broadcast for the AppShell-level gateway
    const suggestion = ZONE_SUGGESTIONS[zoneId] || `status of ${zoneId} tasks`;
    setPrefill(suggestion);
    window.setTimeout(() => setPrefill(undefined), 300);
    window.dispatchEvent(new CustomEvent('spinach:prefill', { detail: suggestion }));
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Spinach Labs — 3D Office</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Live floor — beacons pulse per agent state. Click a zone to prefill a command.
          </p>
        </div>
        {/* Lighting toggle: day / evening / night (default evening) */}
        <div className="flex items-center gap-1" role="group" aria-label="Lighting preset">
          {(['day', 'evening', 'night'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLighting(l)}
              className="t-mono"
              style={{
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                background: lighting === l ? 'var(--green-dim)' : 'transparent',
                color: lighting === l ? 'var(--green-bright)' : 'var(--text-faint)',
                border: `1px solid ${lighting === l ? 'var(--green-dim)' : 'var(--panel-2)'}`,
              }}
              aria-pressed={lighting === l}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {/* explicit height per the module README */}
      <div className="flex-1 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 420, background: 'var(--panel)' }}>
        <DioramaViewer
          key={lighting}
          agentStates={states}
          onZoneClick={onZoneClick}
          lighting={lighting}
        />
      </div>
    </div>
  );
}
