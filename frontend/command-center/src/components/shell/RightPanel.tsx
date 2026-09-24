import { useState } from 'react';
import { Users, Activity, Clock, MessageSquare, BarChart3, Settings } from 'lucide-react';

export default function RightPanel({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  const [activeTab, setActiveTab] = useState<'agents' | 'pipeline' | 'logs' | 'settings'>('agents');

  return (
    <aside
      className={`flex flex-col border-l border-warm-200 bg-warm-50/80 backdrop-blur-sm 
                   ${open ? 'w-[320px]' : 'w-[64px]' } 
                   transition-all duration-300 overflow-hidden`}
    >
      <div className="flex h-16 items-center justify-center gap-2">
        <button
          onClick={() => onToggle(!open)}
          className="p-2 rounded hover:bg-warm-200/50 transition-colors"
          aria-label="Toggle right panel"
        >
          {!open ? (
            <Users className="h-5 w-5 text-warm-600" />
          ) : (
            <span className="text-[0.75rem] font-medium text-warm-600">Context</span>
          )}
        </button>
      </div>

      <nav className="flex h-12 border-b border-warm-200 bg-warm-50">
        <div className="flex-1 flex space-x-2 px-2">
          {([['agents', Users], ['pipeline', Activity], ['logs', MessageSquare], ['settings', Settings]] as const).map(
            ([tab, Icon]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center rounded-md transition-colors
                           ${activeTab === tab ? 'bg-warm-200 text-teal-500' : 'hover:bg-warm-200/50 text-warm-600'}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'agents' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-warm-700">Agent States</h3>
            <div className="space-y-2">
              {/* This will be populated from WebSocket/agent_states */}
              <div className="flex items-center gap-3 p-2 rounded bg-warm-100">
                <div className="h-3 w-3 rounded-full bg-teal-500" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-900">CEO</p>
                  <p className="text-[0.75rem] text-warm-500">Idle - Monitoring...</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-warm-100">
                <div className="h-3 w-3 rounded-full bg-teal-500" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-900">CTO</p>
                  <p className="text-[0.75rem] text-warm-500">Idle - Monitoring...</p>
                </div>
              </div>
              {/* Add more agents as needed */}
            </div>
          </div>
        )}
        {activeTab === 'pipeline' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-warm-700">Active Pipeline</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded bg-warm-100">
                <div className="h-3 w-3 rounded-full bg-teal-500" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-900">Mira Road Gym</p>
                  <p className="text-[0.75rem] text-warm-500">Step 3/8: Lead Generation</p>
                </div>
                <div className="text-xs text-teal-500">60%</div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-warm-700">Recent Activity</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-2 rounded bg-warm-100">
                <div className="h-3 w-3 flex-shrink-0">
                  <Activity className="h-4 w-4 text-teal-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-900">CEO approved strategy for Acme Corp</p>
                  <p className="text-[0.75rem] text-warm-500">2 min ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2 rounded bg-warm-100">
                <div className="h-3 w-3 flex-shrink-0">
                  <BarChart3 className="h-4 w-4 text-teal-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-900">Content team drafted 5 LinkedIn posts</p>
                  <p className="text-[0.75rem] text-warm-500">5 min ago</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-warm-700">System Settings</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded bg-warm-100">
                <div className="h-3 w-3 flex-shrink-0">
                  <Settings className="h-4 w-4 text-teal-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-warm-900">WebSocket Connection</p>
                  <p className="text-[0.75rem] text-warm-500">Connected • 12 agents</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapse indicator when closed */}
      {!open && (
        <div className="flex h-14 items-center justify-center border-t border-warm-200">
          <button
            onClick={() => onToggle(true)}
            className="p-2 rounded hover:bg-warm-200/50 transition-colors"
          >
            <Users className="h-5 w-5 text-warm-600" />
          </button>
        </div>
      )}
    </aside>
  );
}