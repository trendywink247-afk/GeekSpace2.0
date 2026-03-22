// src/dashboard/pages/office/useOfficeData.ts
// Unified office data hook — real-time SSE canvas events + polled sidebar data.
// Falls back to polling-only if SSE fails, retries SSE every 15s.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SSEEvent, ConnectionMode, OfficeMetrics } from './types';
import {
  SIDEBAR_POLL_INTERVAL_MS,
  SSE_RETRY_INTERVAL_MS,
  TIMELINE_MAX_ITEMS,
} from './constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
}

function getToken(): string | null {
  return (
    localStorage.getItem('gs_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token')
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DelegationStatus {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
}

export interface OfficeData {
  taskBoard: Record<string, unknown[]>;
  taskStats: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    completedToday: number;
  };
  comms: Array<Record<string, unknown>>;
  commStats: Record<string, unknown>;
  timeline: Array<{ action: string; details: string; icon: string; created_at: string }>;
  metrics: OfficeMetrics;
  delegationStatus: DelegationStatus | null;
}

export interface UseOfficeDataReturn {
  sseEvents: SSEEvent[];
  officeData: OfficeData | null;
  connectionMode: ConnectionMode;
  sessionExpired: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useOfficeData(): UseOfficeDataReturn {
  const [sseEvents, setSseEvents] = useState<SSEEvent[]>([]);
  const [officeData, setOfficeData] = useState<OfficeData | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('live');
  const [sessionExpired, setSessionExpired] = useState(false);

  const mountedRef = useRef(true);
  const sseAbortRef = useRef<AbortController | null>(null);
  const sseRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenEventIds = useRef(new Set<string>());

  // -------------------------------------------------------------------------
  // Poll /api/office/state for sidebar data
  // -------------------------------------------------------------------------
  const pollOfficeState = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiBase()}/api/office/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mountedRef.current) return;

      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }

      if (!res.ok) return;

      const data = (await res.json()) as Record<string, unknown>;

      const metricsRaw = (data.metrics as Record<string, unknown>) ?? {};
      const metrics: OfficeMetrics = {
        creditsUsedToday: (metricsRaw.creditsUsedToday as number) ?? 0,
        messagesToday: (metricsRaw.messagesToday as number) ?? 0,
        toolCallsToday: (metricsRaw.toolCallsToday as number) ?? 0,
        providerBreakdown: (metricsRaw.providerBreakdown as Record<string, number>) ?? {},
      };

      setOfficeData({
        taskBoard: (data.taskBoard as Record<string, unknown[]>) ?? {},
        taskStats: (data.taskStats as OfficeData['taskStats']) ?? {
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0,
          completedToday: 0,
        },
        comms: (data.comms as Array<Record<string, unknown>>) ?? [],
        commStats: (data.commStats as Record<string, unknown>) ?? {},
        timeline: (data.timeline as OfficeData['timeline']) ?? [],
        metrics,
        delegationStatus: (data.delegationStatus as DelegationStatus | undefined) ?? null,
      });

      // Also process any buffered SSE events embedded in the poll response
      const recentEvents = data.recentEvents as SSEEvent[] | undefined;
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
          setSseEvents(prev => {
            const next = [...prev, ...newEvents];
            return next.length > TIMELINE_MAX_ITEMS ? next.slice(-TIMELINE_MAX_ITEMS) : next;
          });
        }
        // Trim seen set to prevent memory leak
        if (seenEventIds.current.size > 500) {
          const arr = [...seenEventIds.current];
          seenEventIds.current = new Set(arr.slice(-200));
        }
      }
    } catch {
      // Network error — don't change connectionMode here; SSE handler owns that
    }
  }, []);

  // -------------------------------------------------------------------------
  // SSE connection via fetch (so we can attach Authorization header)
  // -------------------------------------------------------------------------
  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return;

    const token = getToken();
    if (!token) {
      setConnectionMode('polling');
      return;
    }

    // Cancel any previous SSE connection
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
    }
    const abort = new AbortController();
    sseAbortRef.current = abort;

    setConnectionMode('live');

    (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/agent-state/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: abort.signal,
        });

        if (!mountedRef.current) return;

        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done || !mountedRef.current) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const evt = JSON.parse(raw) as SSEEvent;
              const key = `${evt.agentId}-${evt.state}-${evt.timestamp}`;
              if (!seenEventIds.current.has(key)) {
                seenEventIds.current.add(key);
                if (mountedRef.current) {
                  setSseEvents(prev => {
                    const next = [...prev, evt];
                    return next.length > TIMELINE_MAX_ITEMS ? next.slice(-TIMELINE_MAX_ITEMS) : next;
                  });
                }
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }
        }

        // Stream ended cleanly — schedule a reconnect
        if (mountedRef.current) {
          setConnectionMode('reconnecting');
          scheduleSSERetry();
        }
      } catch (err) {
        if (!mountedRef.current) return;
        // AbortError is expected on cleanup — don't mark as reconnecting
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setConnectionMode('reconnecting');
        scheduleSSERetry();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSSERetry() {
    if (sseRetryTimerRef.current) clearTimeout(sseRetryTimerRef.current);
    sseRetryTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connectSSE();
    }, SSE_RETRY_INTERVAL_MS);
  }

  // -------------------------------------------------------------------------
  // Mount / unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;

    // Start SSE
    connectSSE();

    // Start polling for sidebar data
    pollOfficeState();
    pollIntervalRef.current = setInterval(pollOfficeState, SIDEBAR_POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (sseAbortRef.current) sseAbortRef.current.abort();
      if (sseRetryTimerRef.current) clearTimeout(sseRetryTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [connectSSE, pollOfficeState]);

  return { sseEvents, officeData, connectionMode, sessionExpired };
}
