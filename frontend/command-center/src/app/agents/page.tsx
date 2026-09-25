'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';
import dynamic from 'next/dynamic';

const AgentStatusGrid = dynamic(() => import('@/components/dashboard/AgentStatusGrid').then(m => m.default), {
  ssr: false,
  loading: () => <div className="t-meta" style={{ color: 'var(--text-faint)' }}>Loading agents…</div>,
});
const HierarchyTree = dynamic(() => import('@/components/HierarchyTree'), {
  ssr: false,
  loading: () => <div className="t-meta" style={{ color: 'var(--text-faint)' }}>Loading org tree…</div>,
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
        apiFetch('/api/v1/hr/agents'),
        apiFetch('/api/v1/workflows'),
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

  // Convert agentStates (from WS) to array format for DepartmentSidebar
  const agentArray = Object.entries(agents).map(([id, a]) => ({
    agent: a.profile || id,
    state: a.state || 'idle',
    activity: a.activity || '',
  }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>AI Agents</h1>
          <p className="sub">{Object.keys(agents).length} agents · {workflows.length} workflows</p>
        </div>
        <div className="actions">
          <span className="live-badge">
            <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={fetchAgents} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 24px 0' }}>
        <div className="chip-tabs">
          <button className={`chip-tab ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>Grid</button>
          <button className={`chip-tab ${view === 'hierarchy' ? 'active' : ''}`} onClick={() => setView('hierarchy')}>Hierarchy</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="grid-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 120 }} />
            ))}
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
