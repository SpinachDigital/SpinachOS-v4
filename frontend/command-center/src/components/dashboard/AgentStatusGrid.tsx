import { useParams } from 'next/navigation';

interface AgentState {
  agent: string;
  state: 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';
  activity: string;
}

export default function AgentStatusGrid({ agents }: { agents: Record<string, AgentState> }) {
  // Convert the record to an array for easier mapping
  const agentList = Object.entries(agents).map(([profile, state]) => ({
    profile,
    ...state,
  }));

  if (agentList.length === 0) {
    return (
      <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
        <h3 className="text-lg font-medium text-[var(--text)] mb-2">Agent Status</h3>
        <p className="text-[var(--text-dim)]">No agent data available</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
      <h3 className="text-lg font-medium text-[var(--text)] mb-2">Agent Status</h3>
      <div className="grid gap-3">
        {agentList.map(({ profile, state, activity }) => (
          <div key={profile} className="flex items-start gap-3 p-3 bg-[var(--card)] rounded hover:bg-[var(--card-hover)] transition-colors">
            {/* Agent avatar and status indicator */}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--green)] text-white">
                {/* We could use the first letter of the profile, or an icon */}
                <span className="text-xs font-medium">{profile.toUpperCase().charAt(0)}</span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-[var(--text)]">{profile.toUpperCase()}</h4>
              <p className="text-xs text-[var(--text-dim)]">{activity}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full 
                   ${state === 'idle' ? 'bg-[var(--green)]' : state === 'thinking' ? 'bg-amber-500' : state === 'working' ? 'bg-[var(--green)]' : state === 'speaking' ? 'bg-purple-500' : 'bg-red-500'}`}
                />
                <span className="text-xs text-[var(--text-dim)] capitalize">{state}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}