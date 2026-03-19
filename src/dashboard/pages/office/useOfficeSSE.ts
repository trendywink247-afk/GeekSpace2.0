// src/dashboard/pages/office/useOfficeSSE.ts
// Unified office data hook — one API call gets everything.
// Polls /api/office/state every 5s for agent states, tasks, comms, timeline.

import { useState, useEffect, useRef } from 'react';
import { officeService } from '@/services/api';
import type { SSEEvent, ConnectionMode } from './types';

interface OfficeData {
  taskBoard: Record<string, unknown[]>;
  taskStats: { total: number; pending: number; running: number; completed: number; failed: number; completedToday: number };
  comms: Array<{ id: string; from_agent: string; to_agent: string; message: string; message_type: string; created_at: string }>;
  commStats: { total: number; unacknowledged: number; byAgent: Record<string, number>; byType: Record<string, number> };
  timeline: Array<{ action: string; details: string; icon: string; created_at: string }>;
}

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('live');
  const [officeData, setOfficeData] = useState<OfficeData | null>(null);
  const mountedRef = useRef(true);
  const prevStatesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    mountedRef.current = true;

    async function poll() {
      try {
        const res = await officeService.getState();
        if (!mountedRef.current) return;
        const data = res.data;

        // Update office data for tabs
        setOfficeData({
          taskBoard: data.taskBoard,
          taskStats: data.taskStats,
          comms: data.comms,
          commStats: data.commStats,
          timeline: data.timeline,
        });

        // Track agent state changes for canvas animation
        for (const s of data.agentStates) {
          const prevState = prevStatesRef.current.get(s.agentId);
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

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return { events, connectionMode, officeData, clearEvents: () => setEvents([]) };
}
