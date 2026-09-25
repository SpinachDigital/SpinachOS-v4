// Lightweight WS store — shared agent state feed for shell + 3D scene
// Standalone module so both the React tree and the imperative scene read the same data
import { create } from 'zustand';

export interface AgentStateEntry {
  agent: string;
  state: 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';
  activity: string;
}

export interface FeedEntry {
  profile: string;
  action: string;
  timestamp: string;
}

interface WSStore {
  connected: boolean;
  agentStates: Record<string, AgentStateEntry>;
  feed: FeedEntry[];
  connect: () => () => void;
  applyMessage: (msg: { event: string; data: Record<string, unknown> }) => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useWebSocketStore = create<WSStore>((set, get) => ({
  connected: false,
  agentStates: {},
  feed: [],

  applyMessage: (msg) => {
    if (msg.event === 'agent_state') {
      const d = msg.data as { agent: string; state: AgentStateEntry['state']; activity?: string };
      set((s) => ({
        agentStates: { ...s.agentStates, [d.agent]: { agent: d.agent, state: d.state, activity: d.activity || '' } },
      }));
    } else if (msg.event === 'feed') {
      const d = msg.data as { profile?: string; action?: string };
      set((s) => ({
        feed: [...s.feed, { profile: d.profile || '', action: d.action || '', timestamp: new Date().toISOString() }].slice(-50),
      }));
    }
  },

  connect: () => {
    if (typeof window === 'undefined') return () => {};
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return () => {};
    }

    const open = () => {
      // API WebSocket is on port 4000, not the frontend port.
      // Env-driven so a remote API host works without a code change
      // (NEXT_PUBLIC_WS_URL=ws://host:4000/ws; default = local API).
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const url = (process.env.NEXT_PUBLIC_WS_URL || apiBase.replace(/^http/, 'ws') + '/ws').trim();
      socket = new WebSocket(url);
      socket.onopen = () => set({ connected: true });
      socket.onmessage = (event) => {
        try {
          get().applyMessage(JSON.parse(event.data));
        } catch {
          // ignore malformed
        }
      };
      socket.onclose = () => {
        set({ connected: false });
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(open, 5000);
      };
    };
    open();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    };
  },
}));