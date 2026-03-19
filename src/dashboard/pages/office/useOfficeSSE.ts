// src/dashboard/pages/office/useOfficeSSE.ts
// Poll-based agent state hook. SSE via EventSource/fetch was unreliable
// through Caddy HTTP/2 — switching to simple polling that WORKS.

import { useState, useEffect, useRef } from 'react';
import { agentStateService } from '@/services/api';
import type { SSEEvent, ConnectionMode } from './types';

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('live');
  const mountedRef = useRef(true);
  const prevStatesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    mountedRef.current = true;

    async function poll() {
      try {
        const res = await agentStateService.getStates();
        if (!mountedRef.current) return;

        const states = res.data;
        for (const s of states) {
          const prevState = prevStatesRef.current.get(s.agentId);
          // Only push event if state changed
          if (prevState !== s.state) {
            prevStatesRef.current.set(s.agentId, s.state);
            if (s.state !== 'idle' || prevState) {
              setEvents(prev => {
                const evt: SSEEvent = {
                  agentId: s.agentId,
                  agentName: s.agentName,
                  state: s.state as SSEEvent['state'],
                  content: s.content,
                  timestamp: s.timestamp,
                };
                const next = [...prev, evt];
                return next.length > 200 ? next.slice(-200) : next;
              });
            }
          }
        }
        setConnectionMode('live');
      } catch {
        if (mountedRef.current) setConnectionMode('polling');
      }
    }

    // Poll immediately, then every 3 seconds
    poll();
    const interval = setInterval(poll, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return { events, connectionMode, clearEvents: () => setEvents([]), debugUrl: 'polling:3s' };
}
