// src/dashboard/pages/office/use-office-data.ts
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

/**
 * Resolves the API base URL from Vite environment variables.
 * In dev mode, defaults to localhost:3001. In production, uses the current domain.
 * @returns The API base URL (e.g., 'http://localhost:3001' or '')
 */
function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
}

/**
 * Retrieves the authentication token from localStorage or sessionStorage.
 * Checks multiple possible keys to support different authentication methods.
 * @returns JWT token string, or null if not found
 */
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

/**
 * User's delegation API quota status.
 * @property used - Number of delegations already used this cycle
 * @property limit - Total delegations allowed by current plan
 * @property remaining - Remaining delegations available
 * @property plan - Current subscription plan name (e.g., 'pro', 'free')
 */
export interface DelegationStatus {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
}

/**
 * Sidebar data polled from `/api/office/state`.
 * Contains task board, communications, timeline, and metrics.
 *
 * @property taskBoard - Kanban-style task board by status (pending, running, completed, etc.)
 * @property taskStats - Aggregate task statistics (total, pending, completed, failed, etc.)
 * @property comms - Array of communication entries (messages, delegations, etc.)
 * @property commStats - Statistics about communications (average response time, etc.)
 * @property timeline - Chronological timeline of recent events
 * @property metrics - Today's usage metrics (credits, messages, tool calls, provider breakdown)
 * @property delegationStatus - User's delegation quota status, or null if not applicable
 */
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

/**
 * Return value of useOfficeData hook.
 * Contains both real-time SSE events and polled sidebar data.
 *
 * @property sseEvents - Array of real-time agent events (grows as they arrive)
 * @property officeData - Polled sidebar data (tasks, comms, metrics), or null while loading
 * @property connectionMode - 'live' (SSE connected), 'reconnecting' (retrying), or 'polling' (SSE exhausted)
 * @property sessionExpired - True if the user's session has expired (show re-login banner)
 */
export interface UseOfficeDataReturn {
  sseEvents: SSEEvent[];
  officeData: OfficeData | null;
  connectionMode: ConnectionMode;
  sessionExpired: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for real-time office data streaming and polling.
 *
 * **Dual-channel approach:**
 * 1. **SSE `/api/agent-state/stream`** — Real-time agent events (high frequency, low latency)
 *    - Agent state changes (typing, thinking, tool calls)
 *    - Particle beams and communications
 *    - Fallback: retries every 15s if connection fails
 *
 * 2. **Polling `/api/office/state`** — Sidebar data (5s interval)
 *    - Task board, communications, timeline
 *    - Metrics and delegation status
 *    - Always runs in parallel, independent of SSE
 *
 * **Connection modes:**
 * - `live` — SSE connected and receiving events
 * - `reconnecting` — SSE failed, retrying every 15s
 * - `polling` — SSE exhausted (e.g., too many failures), using poll-only fallback
 *
 * **Event deduplication:**
 * SSE events are deduplicated by `agentId-state-timestamp` to prevent duplicates
 * from retransmissions or network issues.
 *
 * **Session expiry:**
 * If any request returns 401 (Unauthorized), `sessionExpired` is set to true.
 * The consumer should display a re-login banner.
 *
 * **Cleanup:**
 * - Aborts SSE fetch on unmount
 * - Clears polling interval on unmount
 * - Clears retry timer on unmount
 *
 * @returns Object containing:
 *   - `sseEvents`: Array of real-time agent events (grows continuously)
 *   - `officeData`: Polled sidebar data (updated every 5s)
 *   - `connectionMode`: 'live', 'reconnecting', or 'polling'
 *   - `sessionExpired`: True if user needs to re-login
 *
 * @example
 * ```tsx
 * export function OfficePage() {
 *   const { sseEvents, officeData, connectionMode, sessionExpired } = useOfficeData();
 *
 *   if (sessionExpired) {
 *     return <ReLoginBanner />;
 *   }
 *
 *   return (
 *     <OfficeCanvas
 *       events={sseEvents}
 *       sidebarData={officeData}
 *       connectionMode={connectionMode}
 *     />
 *   );
 * }
 * ```
 */
export function useOfficeData(): UseOfficeDataReturn {
  const [sseEvents, setSseEvents] = useState<SSEEvent[]>([]);
  const [officeData, setOfficeData] = useState<OfficeData | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('live');
  const [sessionExpired, setSessionExpired] = useState(false);

  const mountedRef = useRef(true);
  const sseAbortRef = useRef<AbortController | null>(null);
  const sseRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenEventIds = useRef(new Set<string>());

  // -------------------------------------------------------------------------
  // Poll /api/office/state for sidebar data
  // -------------------------------------------------------------------------
  // 2026-04-06: backoff state. Previously this hook polled every 3s with zero
  // backoff and silently dropped 429s, which after ~2 minutes of normal use
  // would saturate the global 500-req/15min rate limiter and break every
  // other API call on the dashboard (the navigation bug).
  const backoffMsRef = useRef(0); // 0 = use base interval; >0 = wait N ms before next poll
  const consecutiveErrorsRef = useRef(0);

  const pollOfficeState = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    // Pause polling entirely when the tab is in the background — saves ~50%
    // of requests for users who leave the dashboard open in another tab.
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      const res = await fetch(`${apiBase()}/office/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mountedRef.current) return;

      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }

      // 429: respect Retry-After if present, otherwise exponential backoff
      // capped at 60s. Cleared on the next successful response.
      if (res.status === 429) {
        consecutiveErrorsRef.current += 1;
        const retryAfterHeader = res.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? Math.max(0, Number(retryAfterHeader) * 1000) : 0;
        const expBackoffMs = Math.min(60_000, 3_000 * Math.pow(2, consecutiveErrorsRef.current));
        backoffMsRef.current = Math.max(retryAfterMs, expBackoffMs);
        return;
      }

      if (!res.ok) {
        consecutiveErrorsRef.current += 1;
        backoffMsRef.current = Math.min(60_000, 3_000 * Math.pow(2, consecutiveErrorsRef.current));
        return;
      }

      // Success — clear backoff state
      consecutiveErrorsRef.current = 0;
      backoffMsRef.current = 0;

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
      // Network error — back off the same as a 5xx, don't change
      // connectionMode (SSE handler owns that).
      consecutiveErrorsRef.current += 1;
      backoffMsRef.current = Math.min(60_000, 3_000 * Math.pow(2, consecutiveErrorsRef.current));
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
        // ─── Establish SSE connection with JWT auth ────────────────────────
        const res = await fetch(`${apiBase()}/agent-state/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: abort.signal,
        });

        if (!mountedRef.current) return;

        // ─── Handle session expiry ────────────────────────────────────────
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }

        // ─── Stream parsing: decode chunks and extract SSE lines ──────────
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Read response as a stream of SSE events, one per line
        // Format: "data: {...json...}\n"
        for (;;) {
          const { done, value } = await reader.read();
          if (done || !mountedRef.current) break;

          // Accumulate chunks into UTF-8 decoded strings
          buffer += decoder.decode(value, { stream: true });
          // Split by newline, keeping incomplete final line in buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          // ─── Process each complete SSE line ─────────────────────────────
          for (const line of lines) {
            // Skip non-SSE lines (e.g., comments, heartbeats)
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              // ─── Deduplication: composite key by agentId-state-timestamp
              // Prevents re-renders from network retransmissions while preserving
              // state transitions (e.g., multiple tool calls with same timestamp)
              const evt = JSON.parse(raw) as SSEEvent;
              const key = `${evt.agentId}-${evt.state}-${evt.timestamp}`;
              if (!seenEventIds.current.has(key)) {
                seenEventIds.current.add(key);
                if (mountedRef.current) {
                  setSseEvents(prev => {
                    const next = [...prev, evt];
                    // Keep only recent events (TIMELINE_MAX_ITEMS = 500)
                    return next.length > TIMELINE_MAX_ITEMS ? next.slice(-TIMELINE_MAX_ITEMS) : next;
                  });
                }
              }
            } catch {
              // Malformed JSON (corrupted packet) — skip and continue streaming
            }
          }
        }

        // ─── Stream ended (clean EOF) — schedule reconnect ─────────────────
        // This is normal when the server closes the connection. Reconnect
        // every 15s until the stream is restored (or connection mode changes).
        if (mountedRef.current) {
          setConnectionMode('reconnecting');
          scheduleSSERetry();
        }
      } catch (err) {
        if (!mountedRef.current) return;
        // ─── Cleanup abort is expected — don't retry ──────────────────────
        // User navigated away or component unmounted; abort signal was fired.
        // Don't change connectionMode (already 'live' from setConnectionMode above).
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // ─── Other errors: transient network issue — retry ─────────────────
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

    // Self-rescheduling poll loop. 2026-04-06: replaced setInterval with
    // setTimeout chaining so we can honor 429 backoff (Retry-After +
    // exponential) and pause when the tab is hidden — see pollOfficeState.
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (delay: number) => {
      if (!mountedRef.current) return;
      pollTimer = setTimeout(async () => {
        if (!mountedRef.current) return;
        await pollOfficeState();
        const nextDelay = backoffMsRef.current > 0 ? backoffMsRef.current : SIDEBAR_POLL_INTERVAL_MS;
        schedule(nextDelay);
      }, delay);
    };

    // Start SSE + first poll immediately
    connectSSE();
    schedule(0);

    // Resume polling immediately when tab becomes visible again
    const onVisibilityChange = () => {
      if (!document.hidden && mountedRef.current) {
        backoffMsRef.current = 0;
        consecutiveErrorsRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (sseAbortRef.current) sseAbortRef.current.abort();
      if (sseRetryTimerRef.current) clearTimeout(sseRetryTimerRef.current);
      if (pollTimer) clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [connectSSE, pollOfficeState]);

  return { sseEvents, officeData, connectionMode, sessionExpired };
}
