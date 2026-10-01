'use client';

// Keo Karpin 3D Preview — dedicated client-facing 3D office experience.
// Simplified version of the internal /office page for client preview.
// No internal controls (lighting toggle, labels toggle, zone prefill) — clean presentation.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DioramaViewer, { type AgentLabelData } from '@/components/three/DioramaViewer';
import { useWebSocket } from '@/hooks/useWebSocket';

type AgentState = 'active' | 'busy' | 'idle' | 'offline';

const KNOWN_AGENTS = ['engineering', 'social', 'designer', 'orchestrator', 'ceo', 'research', 'sales'];

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

interface RosterAgent {
  id: string;
  name: string;
  department: string;
  status: string;
  live_state: string;
  current_task: { id: string; title: string; progress: number } | null;
}

export default function KeoKarpin3DPage() {
  const { agentStates: rawStates } = useWebSocket();
  const router = useRouter();
  const [states, setStates] = useState<Record<string, AgentState>>(() => mapStates({}));
  const [roster, setRoster] = useState<RosterAgent[]>([]);
  const lastFetch = useRef(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setStates(mapStates(rawStates as Record<string, { agent: string; state: string; activity?: string }>));
  }, [rawStates]);

  // roster poll — 2s throttle
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
          if (!stopped) {
            setRoster(d.agents || []);
            setIsLoading(false);
          }
        } else {
          if (!stopped) setIsLoading(false);
        }
      } catch {
        if (!stopped) setIsLoading(false);
      }
    };
    fetchRoster();
    const timer = setInterval(fetchRoster, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  // Build the label set: roster (current_task + live state) + WS states (beacon color).
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

  const onTaskClick = useCallback((taskId: string) => {
    router.push(`/tasks/${taskId}`);
  }, [router]);

  return (
    <div className="flex flex-col h-full">
      {/* Client-facing header — branded for Keo Karpin */}
      <header className="flex items-center justify-between border-b border-[var(--panel-2)] px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--green-bright)] flex items-center justify-center">
            <span className="text-[var(--char)] font-bold text-xl">KK</span>
          </div>
          <div>
            <h1 className="t-title" style={{ color: 'var(--text)' }}>Keo Karpin — 3D Workspace Preview</h1>
            <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
              Live view of your dedicated Spinach Labs team floor. Beacons show real-time agent activity.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="t-mono px-3 py-1 rounded-full border border-[var(--green-dim)] text-[var(--green-bright)] text-xs">
            LIVE
          </span>
          <a
            href="/"
            className="t-mono px-4 py-2 rounded-lg border border-[var(--panel-2)] hover:border-[var(--green-dim)] transition-colors text-sm"
            style={{ color: 'var(--text)' }}
          >
            Back to Command Center
          </a>
        </div>
      </header>

      {/* 3D Diorama */}
      <main className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--panel)' }}>
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[var(--green-dim)] border-t-[var(--green-bright)] rounded-full animate-spin mx-auto mb-4" />
              <p className="t-meta" style={{ color: 'var(--text-faint)' }}>Loading 3D workspace...</p>
            </div>
          </div>
        )}
        <div className="w-full h-full rounded-xl overflow-hidden" style={{ background: 'var(--panel)' }}>
          <DioramaViewer
            agentStates={states}
            agentLabels={agentLabels}
            onTaskClick={onTaskClick}
            lighting="evening"
          />
        </div>
      </main>

      {/* Footer with legend */}
      <footer className="border-t border-[var(--panel-2)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm" style={{ color: 'var(--text-faint)' }}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}></span>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }}></span>
            <span>Busy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#6b7280' }}></span>
            <span>Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#1a1a1a', border: '1px solid #333' }}></span>
            <span>Offline</span>
          </div>
        </div>
        <p className="t-mono text-center mt-3 text-xs" style={{ color: 'var(--text-faint)' }}>
          Powered by Spinach Labs — AI Company HQ | {new Date().toLocaleString()}
        </p>
      </footer>
    </div>
  );
}