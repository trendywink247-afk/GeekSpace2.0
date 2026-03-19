// src/dashboard/pages/office/useOfficeSSE.ts
// SSE hook using native EventSource — most reliable for browser SSE.
// Auth via ?token= query param (EventSource doesn't support custom headers).

import { useState, useEffect, useRef } from 'react';
import type { SSEEvent, ConnectionMode } from './types';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function getToken(): string | null {
  return localStorage.getItem('gs_token')
    || localStorage.getItem('token')
    || sessionStorage.getItem('token');
}

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('reconnecting');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setConnectionMode('polling');
      return;
    }

    const url = `${API_BASE}/agent-state/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnectionMode('live');
    };

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as SSEEvent;
        if (evt.agentId && evt.state) {
          setEvents(prev => {
            const next = [...prev, evt];
            return next.length > 200 ? next.slice(-200) : next;
          });
        }
      } catch { /* malformed */ }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setConnectionMode('polling');
      } else {
        setConnectionMode('reconnecting');
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, connectionMode, clearEvents: () => setEvents([]) };
}
