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
      <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
        <h3 className="text-lg font-medium text-warm-900 mb-2">Agent Status</h3>
        <p className="text-warm-500">No agent data available</p>
      </div>
    );
  }

  return (
    <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
      <h3 className="text-lg font-medium text-warm-900 mb-2">Agent Status</h3>
      <div className="grid gap-3">
        {agentList.map(({ profile, state, activity }) => (
          <div key={profile} className="flex items-start gap-3 p-3 bg-warm-100 rounded hover:bg-warm-200 transition-colors">
            {/* Agent avatar and status indicator */}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-teal-500 text-white">
                {/* We could use the first letter of the profile, or an icon */}
                <span className="text-xs font-medium">{profile.toUpperCase().charAt(0)}</span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-warm-900">{profile.toUpperCase()}</h4>
              <p className="text-xs text-warm-500">{activity}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full 
                   ${state === 'idle' ? 'bg-teal-500' : state === 'thinking' ? 'bg-amber-500' : state === 'working' ? 'bg-teal-400' : state === 'speaking' ? 'bg-purple-500' : 'bg-red-500'}`}
                />
                <span className="text-xs text-warm-600 capitalize">{state}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}