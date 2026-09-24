'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { DepartmentSidebar } from '@/components/DepartmentSidebar';
import { ActivityFeed } from '@/components/ActivityFeed';
import { WorkflowCards } from '@/components/WorkflowCards';
import { AgentStatusGrid } from '@/components/AgentStatusGrid';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { CommandBar } from '@/components/CommandBar';

export default function CommandCenter() {
  const { feed, tasks, agents, approvals, workflows, setFeed, setTasks, setAgents, setApprovals, setWorkflows } = useStore();
  
  // Initialize sample data on mount
  useEffect(() => {
    if (feed.length === 0) {
      setFeed([
        { id: '1', timestamp: new Date().toISOString(), profile: 'system', action: 'System initialized', details: 'Spinach OS v4 ready' },
      ]);
    }
    if (agents.length === 0) {
      setAgents([
        { agent: 'ceo', state: 'idle', activity: 'Awaiting command' },
        { agent: 'cto', state: 'idle', activity: 'Awaiting strategy' },
        { agent: 'research', state: 'idle', activity: 'Monitoring sources' },
        { agent: 'social', state: 'idle', activity: 'Awaiting approval' },
        { agent: 'sales', state: 'idle', activity: 'Scanning pipeline' },
        { agent: 'content', state: 'idle', activity: 'Drafting queue empty' },
        { agent: 'design', state: 'idle', activity: 'Idle' },
        { agent: 'engineering', state: 'idle', activity: 'Idle' },
        { agent: 'ops', state: 'idle', activity: 'Monitoring systems' },
      ]);
    }
    if (workflows.length === 0) {
      setWorkflows([]);
    }
  }, [setFeed, setTasks, setAgents, setApprovals, setWorkflows]);

  return (
    <div className="grid grid-cols-[280px_1fr_320px] h-[calc(100vh-60px)] overflow-hidden">
      {/* LEFT: Department Sidebar */}
      <DepartmentSidebar 
        agents={agents}
        workflows={workflows}
        onFilterChange={(filter) => console.log('Filter:', filter)}
      />

      {/* CENTER: Live Operations */}
      <main className="overflow-y-auto p-6 bg-dark-100">
        <div className="space-y-6 max-w-4xl mx-auto">
          <ActivityFeed feed={feed} />
          <WorkflowCards workflows={workflows} />
          <AgentStatusGrid agents={agents} />
        </div>
      </main>

      {/* RIGHT: Approvals + Controls */}
      <aside className="border-l border-border bg-dark-50 overflow-y-auto p-4">
        <ApprovalQueue approvals={approvals} />
      </aside>
    </div>
  );
}