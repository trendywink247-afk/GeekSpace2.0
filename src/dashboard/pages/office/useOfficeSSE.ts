// src/dashboard/pages/office/useOfficeSSE.ts
// Unified office data hook — polls /api/office/state every 2s.
// Processes buffered SSE events from server for real-time canvas animations.

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
  const seenEventIds = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;

    async function poll() {
      try {
        const res = await officeService.getState();
        if (!mountedRef.current) return;
        const data = res.data;

        // Update office data for tabs (comms, tasks, metrics, timeline)
        setOfficeData({
          taskBoard: data.taskBoard,
          taskStats: data.taskStats,
          comms: data.comms,
          commStats: data.commStats,
          timeline: data.timeline,
        });

        // Process buffered events from server for real-time canvas animations
        const recentEvents = (data as Record<string, unknown>).recentEvents as SSEEvent[] | undefined;
        if (recentEvents && recentEvents.length > 0) {
          const newEvents: SSEEvent[] = [];
          for (const evt of recentEvents) {
            const key = `${evt.agentId}-${evt.state}-${evt.timestamp}`;
            if (!seenEventIds.current.has(key)) {
              seenEventIds.current.add(key);
              newEvents.push(evt);
            }
          }
          if (newEvents.length > 0) {
            setEvents(prev => {
              const next = [...prev, ...newEvents];
              return next.length > 200 ? next.slice(-200) : next;
            });
          }
          // Trim seen set to prevent memory leak
          if (seenEventIds.current.size > 500) {
            const arr = [...seenEventIds.current];
            seenEventIds.current = new Set(arr.slice(-200));
          }
        }

        setConnectionMode('live');
      } catch {
        if (mountedRef.current) setConnectionMode('polling');
      }
    }

    poll();
    const interval = setInterval(poll, 2000); // 2s for real-time feel

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return { events, connectionMode, officeData, clearEvents: () => setEvents([]) };
}
