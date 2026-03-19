// src/dashboard/pages/office/useOfficeSSE.ts
// Minimal SSE hook — connects once, pushes events, reconnects on failure.

import { useState, useEffect, useRef } from 'react';
import type { SSEEvent, ConnectionMode } from './types';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

function getToken(): string | null {
  return localStorage.getItem('gs_token')
    || localStorage.getItem('token')
    || sessionStorage.getItem('token');
}

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('reconnecting');
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const retryCount = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    async function connect() {
      const token = getToken();
      if (!token || !mountedRef.current) {
        setConnectionMode('polling');
        return;
      }

      // Abort previous
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        // Try query param auth first (works through Caddy), fall back to header
        const url = `${API_URL}/api/agent-state/stream?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { signal: ctrl.signal });

        if (res.status === 401) {
          // Token invalid — don't retry endlessly
          setConnectionMode('polling');
          return;
        }

        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

        setConnectionMode('live');
        retryCount.current = 0;

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
              if (evt.agentId && evt.state) {
                setEvents(prev => {
                  const next = [...prev, evt];
                  return next.length > 200 ? next.slice(-200) : next;
                });
              }
            } catch { /* malformed */ }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }

      // Reconnect after disconnect (if still mounted)
      if (mountedRef.current) {
        retryCount.current++;
        const delay = Math.min(5000 * Math.pow(2, Math.min(retryCount.current, 5)), 60000);
        setConnectionMode('reconnecting');
        setTimeout(() => { if (mountedRef.current) connect(); }, delay);
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, connectionMode, clearEvents: () => setEvents([]) };
}
