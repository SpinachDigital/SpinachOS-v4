'use client';

// Office page — the 3D Spinach Labs diorama (native render, no iframe).
// Sprint 6 "Living Office": live floating labels per agent zone (agent + truncated
// current task + status dot), data from the WS feed + /api/v1/hr/roster (2s-throttled
// poll), labels toggle, label click → /tasks/[id]. Lighting toggle day/evening/night.
// Honesty: labels show exactly what the roster reports — idle when nothing runs.
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DioramaViewer, { type AgentLabelData } from '@/components/three/DioramaViewer';
import { useWebSocket } from '@/hooks/useWebSocket';

type AgentState = 'active' | 'busy' | 'idle' | 'offline';

// WS agent key → viewer beacon state — no fake data: missing agents default to 'idle'
const KNOWN_AGENTS = ['engineering', 'social', 'designer', 'orchestrator', 'ceo', 'research', 'sales'];

// hr_agents department/profile → diorama zone (AGENT_ZONES in the module maps
// agent keys: engineering→engineering, social→marketing, designer→design,
// orchestrator→operations, ceo→ceo-cabin, research→research-cabin, sales→clients)
const AGENT_ZONE: Record<string, string> = {
  engineering: 'engineering',
  social: 'marketing',
  designer: 'design',
  orchestrator: 'operations',
  ceo: 'ceo-cabin',
  research: 'research-cabin',
  sales: 'clients',
};

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

interface RosterAgent {
  id: string;
  name: string;
  department: string;
  status: string;
  live_state: string;
  current_task: { id: string; title: string; progress: number } | null;
}

export default function OfficePage() {
  const { agentStates: rawStates } = useWebSocket();
  const router = useRouter();
  const [states, setStates] = useState<Record<string, AgentState>>(() => mapStates({}));
  const [lighting, setLighting] = useState<'day' | 'evening' | 'night'>('evening');
  const [labelsOn, setLabelsOn] = useState(true);
  const [roster, setRoster] = useState<RosterAgent[]>([]);
  const [prefill, setPrefill] = useState<string | undefined>(undefined);
  const lastFetch = useRef(0);

  useEffect(() => {
    setStates(mapStates(rawStates as Record<string, { agent: string; state: string; activity?: string }>));
  }, [rawStates]);

  // roster poll — 2s throttle (max ~1 update/2s per agent — re-render storms nahi)
  useEffect(() => {
    let stopped = false;
    const fetchRoster = async () => {
      if (stopped) return;
      const now = Date.now();
      if (now - lastFetch.current < 2000) return;
      lastFetch.current = now;
      try {
        const { apiFetch } = await import('@/lib/auth');
        const res = await apiFetch('/api/v1/hr/roster?limit=100');
        if (res.ok) {
          const d = await res.json();
          if (!stopped) setRoster(d.agents || []);
        }
      } catch {
        // honest: roster unavailable → labels fall back to WS states / idle
      }
    };
    fetchRoster();
    const timer = setInterval(fetchRoster, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  // Build the label set: roster (current_task + live state) + WS states (beacon color).
  // Honesty: no running task → 'idle' label — kabhi invent mat karo.
  const agentLabels: AgentLabelData[] = KNOWN_AGENTS.map((agent) => {
    const r = roster.find((a) => a.id === agent);
    const wsState = states[agent] || 'idle';
    const live = r?.live_state?.toLowerCase();
    const status: AgentState = live === 'working' ? 'active' : wsState;
    const task = r?.current_task?.title
      ? r.current_task.title.length > 34 ? `${r.current_task.title.slice(0, 34)}…` : r.current_task.title
      : null;
    return {
      agent,
      name: r?.name || agent.charAt(0).toUpperCase() + agent.slice(1),
      zoneId: AGENT_ZONE[agent] || agent,
      status: r ? status : wsState,
      task,
      taskId: r?.current_task?.id || null,
    };
  });

  const onZoneClick = (zoneId: string) => {
    // prefill, never auto-send — broadcast for the AppShell-level gateway
    const suggestion = ZONE_SUGGESTIONS[zoneId] || `status of ${zoneId} tasks`;
    setPrefill(suggestion);
    window.setTimeout(() => setPrefill(undefined), 300);
    window.dispatchEvent(new CustomEvent('spinach:prefill', { detail: suggestion }));
  };

  const onTaskClick = useCallback((taskId: string) => {
    router.push(`/tasks/${taskId}`);
  }, [router]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Spinach Labs — 3D Office</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Live floor — beacons pulse per agent state. Click a zone to prefill a command.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Labels toggle (Sprint 6 §2) */}
          <button
            type="button"
            onClick={() => setLabelsOn((v) => !v)}
            className="t-mono"
            style={{
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              background: labelsOn ? 'var(--green-dim)' : 'transparent',
              color: labelsOn ? 'var(--green-bright)' : 'var(--text-faint)',
              border: `1px solid ${labelsOn ? 'var(--green-dim)' : 'var(--panel-2)'}`,
            }}
            aria-pressed={labelsOn}
          >
            labels {labelsOn ? 'on' : 'off'}
          </button>
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
      </div>
      {/* explicit height per the module README */}
      <div className="flex-1 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 420, background: 'var(--panel)' }}>
        <DioramaViewer
          key={lighting}
          agentStates={states}
          agentLabels={labelsOn ? agentLabels : []}
          onZoneClick={onZoneClick}
          onTaskClick={onTaskClick}
          lighting={lighting}
        />
      </div>
    </div>
  );
}
