// src/dashboard/pages/office/TimelineTab.tsx
import { useRef, useEffect, useState, useMemo } from 'react';
import { AGENT_COLORS, AGENT_META, C, MAX_TIMELINE_EVENTS } from './constants';
import type { AgentId, AgentStateType, SSEEvent } from './types';

interface ActivityItem {
  action: string;
  details: string;
  icon: string;
  created_at: string;
}

interface Props {
  events: SSEEvent[];
  activityTimeline?: ActivityItem[];
}

function inferAgentFromAction(action: string, icon: string): string {
  const lower = (action + ' ' + icon).toLowerCase();
  if (lower.includes('weebo') || lower.includes('creative') || lower.includes('social')) return 'weebo';
  if (lower.includes('edith') || lower.includes('code') || lower.includes('review') || lower.includes('zap')) return 'edith';
  if (lower.includes('jarvis') || lower.includes('remind') || lower.includes('schedule') || lower.includes('clock')) return 'jarvis';
  if (lower.includes('aria') || lower.includes('design')) return 'aria';
  if (lower.includes('forge') || lower.includes('build')) return 'forge';
  return 'jarvis'; // default
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function minuteKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface BadgeStyle {
  bg: string;
  text: string;
  pulse?: boolean;
  suffix?: string;
}

function eventBadge(state: AgentStateType, targetAgent?: string): BadgeStyle {
  switch (state) {
    case 'thinking':
      return { bg: '#3B82F620', text: '#3B82F6', pulse: true };
    case 'tool_call':
      return { bg: '#F59E0B20', text: '#F59E0B' };
    case 'tool_result':
      return { bg: '#10B98120', text: '#10B981' };
    case 'delegating':
      return { bg: '#FFB80020', text: '#FFB800', suffix: targetAgent ? ` -> ${targetAgent}` : undefined };
    case 'comm_sent':
      return { bg: '#8B5CF620', text: '#8B5CF6', suffix: targetAgent ? ` -> ${targetAgent}` : undefined };
    case 'comm_received':
      return { bg: '#8B5CF620', text: '#8B5CF6' };
    case 'task_started':
      return { bg: `${C.cyan}20`, text: C.cyan };
    case 'task_completed':
      return { bg: '#10B98120', text: '#10B981' };
    case 'task_failed':
      return { bg: '#EF444420', text: '#EF4444' };
    case 'done':
      return { bg: `${C.dim}20`, text: C.dim };
    default:
      return { bg: 'rgba(139,92,246,0.08)', text: C.muted };
  }
}

function stateLabel(state: AgentStateType): string {
  switch (state) {
    case 'thinking': return 'Thinking';
    case 'tool_call': return 'Tool Call';
    case 'tool_result': return 'Tool Result';
    case 'delegating': return 'Delegating';
    case 'comm_sent': return 'Comm Sent';
    case 'comm_received': return 'Comm Recv';
    case 'task_started': return 'Task Started';
    case 'task_completed': return 'Completed';
    case 'task_failed': return 'Failed';
    case 'done': return 'Done';
    case 'typing': return 'Typing';
    case 'responding': return 'Responding';
    case 'idle': return 'Idle';
    default: return state;
  }
}

export default function TimelineTab({ events, activityTimeline }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  // Merge SSE events with activity timeline data
  const sorted = useMemo(() => {
    const sseItems = events.map(ev => ({
      type: 'sse' as const,
      timestamp: ev.timestamp,
      agentId: ev.agentId, agentName: ev.agentName,
      state: ev.state,
      content: ev.content || '',
      tool: ev.tool, targetAgent: ev.targetAgent,
    }));

    const actItems = (activityTimeline || []).map(a => {
      const isUserMsg = a.icon === 'user' || a.action === 'User message';
      return {
        type: (isUserMsg ? 'user_message' : 'activity') as 'activity' | 'user_message',
        timestamp: a.created_at,
        agentId: isUserMsg ? 'user' : inferAgentFromAction(a.action, a.icon),
        agentName: isUserMsg ? 'Aliya' : inferAgentFromAction(a.action, a.icon),
        state: (isUserMsg ? 'idle' : 'done') as AgentStateType,
        content: isUserMsg ? a.details : (a.details || a.action).replace(/→ undefined:? /g, '').slice(0, 120),
        tool: undefined, targetAgent: undefined,
      };
    });

    return [...sseItems, ...actItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_TIMELINE_EVENTS);
  }, [events, activityTimeline]);

  // Auto-scroll to top (newest) unless hovered
  useEffect(() => {
    if (!hovered && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [sorted, hovered]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-xs" style={{ color: C.dim }}>No events yet. Send a message to see agent activity.</p>
      </div>
    );
  }

  let lastMinute = '';

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col gap-0.5 max-h-[320px] md:max-h-[420px] overflow-y-auto p-3"
    >
      {sorted.map((ev, i) => {
        const min = minuteKey(ev.timestamp);
        const showSeparator = min !== lastMinute && i > 0;
        lastMinute = min; // eslint-disable-line react-hooks/immutability

        const isUser = ev.agentId === 'user' || (ev as Record<string, unknown>).type === 'user_message';
        const color = isUser ? '#FF9F43' : (AGENT_COLORS[ev.agentId as AgentId] ?? C.dim);
        const meta = isUser ? { emoji: '\uD83D\uDC64' } : AGENT_META[ev.agentId as AgentId];
        const badge = isUser ? { bg: '#FF9F4320', text: '#FF9F43', pulse: false, suffix: undefined } : eventBadge(ev.state, ev.targetAgent);

        return (
          <div key={`${ev.timestamp}-${ev.agentId}-${ev.state}-${i}`}>
            {showSeparator && (
              <div className="flex items-center gap-2 py-1.5 my-0.5">
                <div className="flex-1 h-px" style={{ background: 'rgba(139,92,246,0.06)' }} />
                <span className="text-[9px] font-mono" style={{ color: C.dim }}>{min}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(139,92,246,0.06)' }} />
              </div>
            )}

            <div
              className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:gap-2 rounded px-2 py-1.5 md:py-1 transition-colors hover:bg-white/[0.02] min-h-[36px] md:min-h-0"
            >
              {/* Timestamp */}
              <span className="text-[9px] font-mono flex-shrink-0 w-14 text-right" style={{ color: C.dim }}>
                {formatTime(ev.timestamp)}
              </span>

              {/* Agent dot */}
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />

              {/* Agent name */}
              <span className="text-[10px] font-medium flex-shrink-0 w-12 truncate" style={{ color }}>
                {meta?.emoji ?? '?'} {ev.agentName || ev.agentId}
              </span>

              {/* Event badge */}
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${badge.pulse ? 'animate-pulse' : ''}`}
                style={{ background: badge.bg, color: badge.text }}
              >
                {isUser ? 'Message' : stateLabel(ev.state)}
                {badge.suffix ?? ''}
                {ev.state === 'task_completed' ? ' \u2713' : ''}
              </span>

              {/* Content */}
              {ev.content && (
                <span className="text-[10px] break-words md:truncate flex-1 min-w-0 w-full md:w-auto" style={{ color: C.muted }}>
                  {(ev.content || "").replace(/→ undefined:? /g, "").slice(0, 80) || ev.content}
                </span>
              )}
              {ev.tool && !ev.content && (
                <span className="text-[10px] font-mono break-words md:truncate flex-1 min-w-0 w-full md:w-auto" style={{ color: C.dim }}>
                  {ev.tool}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
