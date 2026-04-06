// ============================================================
// LiveAgentFeed — Real-time SSE agent activity feed
//
// Subscribes to GET /api/agent-state/stream (SSE) and shows
// the last 5 agent activity events as animated cards in a
// horizontal scrollable strip. Auto-removes entries older
// than 30 seconds. Tap/click navigates to the office page.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentEvent {
  id: string;
  agentId: string;
  agentName: string;
  state: string;
  tool?: string;
  content?: string;
  targetAgent?: string;
  timestamp: string;
  receivedAt: number; // Date.now() when we received it
}

interface LiveAgentFeedProps {
  onNavigate?: (page: string) => void;
}

// ---------------------------------------------------------------------------
// Agent color map (specification colors)
// ---------------------------------------------------------------------------

const AGENT_COLORS: Record<string, string> = {
  weebo: '#A78BFA',
  edith: '#8B5CF6',
  jarvis: '#ADFF2F',
  nova: '#F59E0B',
  cal: '#EC4899',
  pulse: '#10B981',
  forge: '#EF4444',
  aria: '#6366F1',
  echo: '#14B8A6',
};

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

/** Convert an agent state string into a human-readable action phrase. */
function stateToAction(state: string, tool?: string, targetAgent?: string): string {
  switch (state) {
    case 'thinking':
      return 'is thinking...';
    case 'typing':
      return 'is typing...';
    case 'tool_call':
      return tool ? `is using ${tool}` : 'is using tools...';
    case 'tool_result':
      return tool ? `finished ${tool}` : 'got tool results';
    case 'responding':
      return 'is responding...';
    case 'delegating':
      return targetAgent ? `delegated to ${targetAgent}` : 'is delegating...';
    case 'comm_sent':
      return targetAgent ? `messaged ${targetAgent}` : 'sent a message';
    case 'comm_received':
      return 'received a message';
    case 'task_started':
      return 'started a task';
    case 'task_completed':
      return 'completed a task';
    case 'task_failed':
      return 'task failed';
    case 'done':
      return 'finished';
    case 'idle':
      return 'is idle';
    default:
      return `is ${state}`;
  }
}

/** Format relative time like "2s ago", "15s ago". */
function relativeSeconds(receivedAt: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - receivedAt) / 1000));
  if (diff < 1) return 'just now';
  return `${diff}s ago`;
}

const MAX_EVENTS = 5;
const EXPIRY_MS = 30_000;
const SSE_RETRY_MS = 15_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveAgentFeed({ onNavigate }: LiveAgentFeedProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [now, setNow] = useState(Date.now());
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef(new Set<string>());

  // Tick clock every second for relative time + expiry
  useEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      // Prune expired events
      setEvents((prev) => prev.filter((e) => current - e.receivedAt < EXPIRY_MS));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // SSE connection (mirrors use-office-data.ts pattern)
  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return;

    const token = getToken();
    if (!token) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abort = new AbortController();
    abortRef.current = abort;

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
              const evt = JSON.parse(raw) as {
                agentId: string;
                agentName: string;
                state: string;
                tool?: string;
                content?: string;
                targetAgent?: string;
                timestamp: string;
              };

              // Skip idle events — not interesting for the feed
              if (evt.state === 'idle') continue;

              const key = `${evt.agentId}-${evt.state}-${evt.timestamp}`;
              if (seenIdsRef.current.has(key)) continue;
              seenIdsRef.current.add(key);

              const agentEvent: AgentEvent = {
                id: key,
                agentId: evt.agentId,
                agentName: evt.agentName,
                state: evt.state,
                tool: evt.tool,
                content: evt.content,
                targetAgent: evt.targetAgent,
                timestamp: evt.timestamp,
                receivedAt: Date.now(),
              };

              if (mountedRef.current) {
                setEvents((prev) => {
                  const next = [agentEvent, ...prev];
                  return next.slice(0, MAX_EVENTS);
                });
              }
            } catch {
              // Malformed JSON — skip
            }
          }
        }

        // Stream ended — schedule reconnect
        if (mountedRef.current) {
          scheduleRetry();
        }
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        scheduleRetry();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleRetry() {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connectSSE();
    }, SSE_RETRY_MS);
  }

  // Trim seen set to prevent memory leak
  useEffect(() => {
    const interval = setInterval(() => {
      if (seenIdsRef.current.size > 300) {
        const arr = [...seenIdsRef.current];
        seenIdsRef.current = new Set(arr.slice(-100));
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    connectSSE();

    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [connectSSE]);

  const handleClick = () => {
    onNavigate?.('office');
  };

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (events.length === 0) {
    return (
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className="flex items-center justify-center gap-2 rounded-2xl border px-5 py-4 cursor-pointer transition-all hover:border-[#A78BFA]/30 hover:bg-[#A78BFA]/5"
        style={{
          background: 'rgba(12,12,24,0.6)',
          borderColor: 'rgba(139,92,246,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#A78BFA', boxShadow: '0 0 6px rgba(139,92,246,0.5)' }}
        />
        <span className="text-sm text-[#8892A4]">Agents are standing by</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Feed strip
  // ---------------------------------------------------------------------------

  return (
    <div
      className="overflow-x-auto scrollbar-none pb-1"
      role="region"
      aria-label="Live agent activity feed"
    >
      <div className="flex gap-3 min-w-0">
        <AnimatePresence mode="popLayout">
          {events.map((evt) => {
            const color = AGENT_COLORS[evt.agentId.toLowerCase()] ?? '#A78BFA';
            const action = stateToAction(evt.state, evt.tool, evt.targetAgent);
            const timeAgo = relativeSeconds(evt.receivedAt, now);

            return (
              <motion.div
                key={evt.id}
                layout
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={handleClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                  }
                }}
                className="flex-shrink-0 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors hover:border-[#A78BFA]/30 hover:bg-[#A78BFA]/5 w-[220px] md:w-auto md:min-w-[200px] md:max-w-[240px]"
                style={{
                  background: 'rgba(12,12,24,0.6)',
                  borderColor: 'rgba(139,92,246,0.12)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Agent color dot */}
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                  }}
                />

                {/* Text content */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-tight truncate">
                    <span className="font-semibold" style={{ color }}>
                      {evt.agentName}
                    </span>{' '}
                    <span className="text-[#8892A4]">{action}</span>
                  </p>
                  <p className="text-[10px] text-[#4B5563] mt-0.5">{timeAgo}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
