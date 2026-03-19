// src/dashboard/pages/office/useOfficeSSE.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SSEEvent, ConnectionMode } from './types';
import { SSE_RECONNECT_DELAY_MS, SSE_MAX_RETRIES } from './constants';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('reconnecting');
  const abortRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const pushEvent = useCallback((evt: SSEEvent) => {
    setEvents(prev => {
      const next = [...prev, evt];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  const connect = useCallback(async () => {
    const token = localStorage.getItem('gs_token')
      || localStorage.getItem('token')
      || sessionStorage.getItem('token');
    if (!token || !mountedRef.current) return;

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/agent-state/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

      setConnectionMode('live');
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
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (!mountedRef.current) return;

      retriesRef.current++;
      if (retriesRef.current >= SSE_MAX_RETRIES) {
        setConnectionMode('polling');
        return;
      }

      setConnectionMode('reconnecting');
      const delay = Math.min(SSE_RECONNECT_DELAY_MS * Math.pow(2, retriesRef.current - 1), 60000);
      setTimeout(() => { if (mountedRef.current) connect(); }, delay);
    }
  }, [pushEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connectionMode, clearEvents };
}
