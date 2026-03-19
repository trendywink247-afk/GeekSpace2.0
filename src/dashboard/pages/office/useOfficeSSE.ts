// src/dashboard/pages/office/useOfficeSSE.ts
// Shared SSE hook — connects to /api/agent-state/stream, parses events,
// manages reconnection. Falls back to polling /api/agent-state/states.

import { useState, useEffect, useRef } from 'react';
import type { SSEEvent, ConnectionMode } from './types';
import { SSE_RECONNECT_DELAY_MS, SSE_MAX_RETRIES, MISSION_POLL_INTERVAL_MS } from './constants';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function getToken(): string | null {
  return localStorage.getItem('gs_token')
    || localStorage.getItem('token')
    || sessionStorage.getItem('token');
}

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('reconnecting');
  const abortRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable push — no deps, uses functional setState
  function pushEvent(evt: SSEEvent) {
    setEvents(prev => {
      const next = [...prev, evt];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }

  // Polling fallback — fetches current agent states
  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/agent-state/states`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const states = await res.json() as Array<{ agentId: string; agentName: string; state: string; content?: string; timestamp: string }>;
        for (const s of states) {
          if (s.state !== 'idle') {
            pushEvent({
              agentId: s.agentId,
              agentName: s.agentName,
              state: s.state as SSEEvent['state'],
              content: s.content,
              timestamp: s.timestamp,
            });
          }
        }
      } catch { /* polling failure non-fatal */ }
    }, MISSION_POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function connect() {
    const token = getToken();
    if (!token || !mountedRef.current) return;

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Use query param auth (not header) — Caddy/proxies can strip Authorization on SSE
      const res = await fetch(`${API_BASE}/agent-state/stream?token=${encodeURIComponent(token)}`, {
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE response ${res.status}`);
      }

      // Connected!
      setConnectionMode('live');
      stopPolling();
      retriesRef.current = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (mountedRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as SSEEvent;
            if (evt.agentId && evt.state) pushEvent(evt);
          } catch { /* malformed line */ }
        }
      }

      // Stream ended naturally — reconnect
      if (mountedRef.current) {
        setTimeout(() => { if (mountedRef.current) connect(); }, SSE_RECONNECT_DELAY_MS);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (!mountedRef.current) return;

      retriesRef.current++;
      if (retriesRef.current >= SSE_MAX_RETRIES) {
        setConnectionMode('polling');
        startPolling();
        return;
      }

      setConnectionMode('reconnecting');
      const delay = Math.min(SSE_RECONNECT_DELAY_MS * Math.pow(2, retriesRef.current - 1), 60000);
      setTimeout(() => { if (mountedRef.current) connect(); }, delay);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      stopPolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, connectionMode, clearEvents: () => setEvents([]) };
}
