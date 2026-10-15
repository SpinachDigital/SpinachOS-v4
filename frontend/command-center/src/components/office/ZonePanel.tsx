'use client';

// ZonePanel — N4.22: modifier-click a 3D zone to see its live story without
// navigating away. Agents in the zone (from the diorama's AGENT_ZONES
// inversion), their live state + current task, and an "Open →" button.
// All data comes from the existing websocket store — no new backend.

import { ZONE_ROUTES } from '@/app/page-zone-routes';

interface AgentState {
  state?: string;
  activity?: string;
  task?: string;
}

const STATE_DOT: Record<string, string> = {
  working: '#22c55e',
  thinking: '#f59e0b',
  idle: '#9ca3af',
  offline: '#4b5563',
};

// Mirrors ZONE_AGENTS in app/page.tsx (inverted from viewer.js AGENT_ZONES).
const ZONE_AGENTS: Record<string, string[]> = {
  engineering: ['engineering'],
  marketing: ['social'],
  design: ['designer'],
  operations: ['orchestrator'],
  clients: ['sales'],
  'ceo-cabin': ['ceo'],
  'research-cabin': ['research'],
};

export default function ZonePanel({
  zoneId,
  agentStates,
  onClose,
  onOpen,
}: {
  zoneId: string;
  agentStates: Record<string, AgentState>;
  onClose: () => void;
  onOpen: () => void;
}) {
  const route = ZONE_ROUTES[zoneId];
  const agents = (ZONE_AGENTS[zoneId] || [])
    .map(a => ({ name: a, ...(agentStates[a] || {}) }))
    .filter(a => agentStates[a.name]); // only agents the store knows
  const working = agents.filter(a => a.state === 'working' || a.state === 'thinking').length;

  return (
    <div
      role="dialog"
      aria-label={`${zoneId} zone panel`}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', right: 16, top: 16, zIndex: 30,
        width: 'min(300px, calc(100% - 32px))',
        background: 'var(--card, #fff)', borderRadius: 14,
        border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="t-title" style={{ fontSize: 15, color: 'var(--text)', textTransform: 'capitalize' }}>
          {zoneId.replace('-', ' ')}
        </div>
        <button
          onClick={onClose}
          aria-label="Close zone panel"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', fontSize: 16, minWidth: 32, minHeight: 32,
          }}
        >
          ✕
        </button>
      </div>

      <div className="t-mono" style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 10 }}>
        {working} working · {agents.length - working} idle
      </div>

      {agents.length === 0 ? (
        <div className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 12 }}>
          No agent reporting from this zone right now.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {agents.map(a => (
            <div key={a.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 9, height: 9, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                  background: STATE_DOT[a.state || 'idle'] || STATE_DOT.idle,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div className="t-meta" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                  {a.name}
                </div>
                <div className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', wordBreak: 'break-word' }}>
                  {a.activity || a.task || a.state || 'idle'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {route && (
        <button
          onClick={onOpen}
          style={{
            width: '100%', minHeight: 44, borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Open {route.label} →
        </button>
      )}
    </div>
  );
}
