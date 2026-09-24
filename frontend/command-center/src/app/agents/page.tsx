'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';
import dynamic from 'next/dynamic';

const AgentStatusGrid = dynamic(() => import('@/components/dashboard/AgentStatusGrid').then(m => m.default), {
  ssr: false,
  loading: () => <div className="t-meta" style={{ color: '#666' }}>Loading agents…</div>,
});
const HierarchyTree = dynamic(() => import('@/components/HierarchyTree'), {
  ssr: false,
  loading: () => <div className="t-meta" style={{ color: '#666' }}>Loading org tree…</div>,
});

export default function AgentsPage() {
  const { connected, agentStates, feed } = useWebSocket();
  const [agents, setAgents] = useState<Record<string, any>>({});
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'hierarchy'>('grid');

  const fetchAgents = useCallback(async () => {
    try {
      const [agentsRes, workflowsRes] = await Promise.all([
        apiFetch('http://localhost:4000/api/v1/hr/agents'),
        apiFetch('http://localhost:4000/api/v1/workflows'),
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        const agentMap: Record<string, any> = {};
        data.forEach((a: any) => { agentMap[a.id] = a; });
        setAgents(agentMap);
      }
      if (workflowsRes.ok) {
        const data = await workflowsRes.json();
        setWorkflows(data);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // React to WebSocket agent state updates
  useEffect(() => {
    if (Object.keys(agentStates).length > 0) {
      setAgents(prev => ({ ...prev, ...agentStates }));
    }
  }, [agentStates]);

  const isDark = true;
  const glass = {
    bg: isDark ? 'rgba(15,15,15,0.78)' : 'rgba(255,255,255,0.82)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,15,15,0.08)',
    text: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,15,15,0.85)',
    text2: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,15,15,0.45)',
  };

  // Convert agentStates (from WS) to array format for DepartmentSidebar
  const agentArray = Object.entries(agents).map(([id, a]) => ({
    agent: a.profile || id,
    state: a.state || 'idle',
    activity: a.activity || '',
  }));

  return (
    <div className="flex flex-col h-full" style={{ background: glass.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: glass.border }}>
        <div>
          <h1 className="t-title" style={{ color: glass.text }}>AI Agents</h1>
          <p className="t-meta mt-0.5" style={{ color: glass.text2 }}>
            {Object.keys(agents).length} agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
          <span className="t-mono" style={{ color: glass.text2, fontSize: 12 }}>
            {connected ? 'Live' : 'Offline'}
          </span>
          <button
            onClick={fetchAgents}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            style={{
              background: glass.bg,
              borderColor: glass.border,
              color: glass.text,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: glass.border }}>
        <button
          onClick={() => setView('grid')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === 'grid' ? 'font-medium' : ''}`}
          style={{
            background: view === 'grid' ? 'rgba(86,136,62,0.2)' : glass.bg,
            borderColor: view === 'grid' ? '#56883E' : glass.border,
            color: glass.text,
            border: '1px solid',
          }}
        >
          Grid
        </button>
        <button
          onClick={() => setView('hierarchy')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === 'hierarchy' ? 'font-medium' : ''}`}
          style={{
            background: view === 'hierarchy' ? 'rgba(86,136,62,0.2)' : glass.bg,
            borderColor: view === 'hierarchy' ? '#56883E' : glass.border,
            color: glass.text,
            border: '1px solid',
          }}
        >
          Hierarchy
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: glass.text2 }}>
            <div className="t-mono">Loading agents…</div>
          </div>
        ) : view === 'grid' ? (
          <AgentStatusGrid agents={agents} />
        ) : (
          <HierarchyTree />
        )}
      </div>
    </div>
  );
}