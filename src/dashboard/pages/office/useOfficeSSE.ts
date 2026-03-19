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

  const [debugUrl, setDebugUrl] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      console.warn('[OfficeSSE] No token found in localStorage');
      setConnectionMode('polling');
      setDebugUrl('NO TOKEN');
      return;
    }

    const url = `${API_BASE}/agent-state/stream?token=${token.slice(0, 20)}...`;
    setDebugUrl(url);
    console.log('[OfficeSSE] Connecting to:', `${API_BASE}/agent-state/stream?token=<${token.length}chars>`);

    const fullUrl = `${API_BASE}/agent-state/stream?token=${encodeURIComponent(token)}`;
    let es: EventSource;
    try {
      es = new EventSource(fullUrl);
    } catch (err) {
      console.error('[OfficeSSE] EventSource constructor threw:', err);
      setConnectionMode('polling');
      setDebugUrl('CONSTRUCTOR ERROR');
      return;
    }
    esRef.current = es;

    es.onopen = () => {
      console.log('[OfficeSSE] Connected! readyState:', es.readyState);
      setConnectionMode('live');
    };

    es.onmessage = (e) => {
      console.log('[OfficeSSE] Event:', e.data.slice(0, 80));
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

    es.onerror = (err) => {
      console.error('[OfficeSSE] Error, readyState:', es.readyState, err);
      if (es.readyState === EventSource.CLOSED) {
        setConnectionMode('polling');
      } else {
        setConnectionMode('reconnecting');
      }
    };

    return () => {
      console.log('[OfficeSSE] Closing');
      es.close();
      esRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, connectionMode, clearEvents: () => setEvents([]), debugUrl };
}
