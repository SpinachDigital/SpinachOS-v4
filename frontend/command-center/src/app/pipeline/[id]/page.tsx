'use client';

// Pipeline detail — placeholder route: pipelines connect to the API at :4000
// The full pipeline UI is next; this route keeps the shell working meanwhile.
import { useParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function PipelineDetail() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const { agentStates } = useWebSocket();

  return (
    <div className="p-6" style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <h2 className="t-title" style={{ color: 'var(--text)' }}>
        Pipeline <span className="t-mono" style={{ color: 'var(--green)' }}>{pipelineId}</span>
      </h2>
      <p className="t-meta" style={{ color: 'rgba(255,255,255,0.45)', marginTop: 8, maxWidth: 520 }}>
        Pipeline detail view is being wired to the API at :4000. Workflow events (step
        changes, approvals) will appear here in real time. The 3D office digital twin
        already reflects live agent states.
      </p>

      <div className="mt-6 grid gap-3" style={{ maxWidth: 520 }}>
        {Object.entries(agentStates).map(([profile, s]) => (
          <div
            key={profile}
            className="flex items-center gap-3"
            style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span
              className={`dot ${
                s.state === 'working' ? 'dot-teal' :
                s.state === 'thinking' ? 'dot-amber' :
                s.state === 'speaking' ? 'dot-purple' :
                s.state === 'blocked' ? 'dot-red' : 'dot-green'
              }`}
            />
            <span className="t-meta" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
              {profile.toUpperCase()}
            </span>
            <span className="t-mono ml-auto" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
              {s.activity || s.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}