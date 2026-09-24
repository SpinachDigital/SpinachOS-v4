'use client';

// useWebSocket: React hook over the shared WS store (single socket for whole app)
import { useEffect } from 'react';
import { useWebSocketStore } from '@/lib/office/wsStore';

export function useWebSocket() {
  const connected = useWebSocketStore((s) => s.connected);
  const agentStates = useWebSocketStore((s) => s.agentStates);
  const feed = useWebSocketStore((s) => s.feed);
  const connect = useWebSocketStore((s) => s.connect);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return { connected, agentStates, feed: [...feed] };
}