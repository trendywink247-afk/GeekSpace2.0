// src/dashboard/pages/office/CommsTab.tsx
import { useState, useEffect, useMemo } from 'react';
import type { AgentComm } from '@/services/api';
import { AGENT_COLORS, AGENT_META, C, CORE_AGENTS } from './constants';
import type { AgentId, SSEEvent } from './types';

interface Props {
  sseEvents: SSEEvent[];
  commsData?: Array<{ id: string; from_agent: string; to_agent: string; message: string; message_type: string; created_at: string }>;
}

const TYPE_FILTERS = ['All', 'info', 'delegation', 'alert'] as const;

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function typeBadge(type: string): { bg: string; text: string } {
  switch (type) {
    case 'delegation': return { bg: '#FFB80020', text: '#FFB800' };
    case 'alert': return { bg: '#EF444420', text: '#EF4444' };
    case 'request': return { bg: '#8B5CF620', text: '#8B5CF6' };
    case 'response': return { bg: '#10B98120', text: '#10B981' };
    default: return { bg: 'rgba(0,240,255,0.08)', text: C.cyan };
  }
}

export default function CommsTab({ sseEvents, commsData }: Props) {
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Ticker for relative timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  // Use commsData from unified 2s poll directly
  const baseComms = useMemo(() => {
    if (commsData && commsData.length > 0) {
      return commsData.map(c => ({ ...c, user_id: '', related_task_id: null, acknowledged: 0 })) as AgentComm[];
    }
    return [] as AgentComm[];
  }, [commsData]);

  // Merge with SSE comm events (for real-time items that haven't hit the poll yet)
  const merged = useMemo<AgentComm[]>(() => {
    const polledIds = new Set(baseComms.map((c) => c.id));
    const sseComms: AgentComm[] = sseEvents
      .filter((e) => (e.state === 'comm_sent' || e.state === 'comm_received') && e.commId && !polledIds.has(e.commId))
      .map((e) => ({
        id: e.commId ?? e.timestamp,
        user_id: '',
        from_agent: e.agentId,
        to_agent: e.targetAgent ?? 'unknown',
        message: e.content ?? '',
        message_type: 'info' as const,
        related_task_id: null,
        acknowledged: 0,
        created_at: e.timestamp,
      }));
    return [...sseComms, ...baseComms].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [baseComms, sseEvents]);

  // Apply filters
  const filtered = useMemo(() => {
    return merged.filter((c) => {
      if (agentFilter !== 'All' && c.from_agent !== agentFilter && c.to_agent !== agentFilter) return false;
      if (typeFilter !== 'All' && c.message_type !== typeFilter) return false;
      return true;
    });
  }, [merged, agentFilter, typeFilter]);

  // Show loading only if commsData hasn't arrived yet
  if (!commsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Agent filters */}
        {['All', ...CORE_AGENTS].map((id) => {
          const active = agentFilter === id;
          const color = id === 'All' ? C.cyan : AGENT_COLORS[id as AgentId];
          return (
            <button
              key={id}
              onClick={() => setAgentFilter(id)}
              className="text-[10px] px-2 py-1 rounded-full transition-colors"
              style={{
                background: active ? `${color}20` : 'transparent',
                color: active ? color : C.dim,
                border: `1px solid ${active ? color : 'rgba(0,240,255,0.05)'}`,
              }}
            >
              {id === 'All' ? 'All' : `${AGENT_META[id as AgentId].emoji} ${id}`}
            </button>
          );
        })}

        <div className="w-px h-4 mx-1" style={{ background: C.border }} />

        {/* Type filters */}
        {TYPE_FILTERS.map((t) => {
          const active = typeFilter === t;
          const badge = t === 'All' ? { bg: 'rgba(0,240,255,0.08)', text: C.cyan } : typeBadge(t);
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="text-[10px] px-2 py-1 rounded-full transition-colors capitalize"
              style={{
                background: active ? badge.bg : 'transparent',
                color: active ? badge.text : C.dim,
                border: `1px solid ${active ? badge.text : 'rgba(0,240,255,0.05)'}`,
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Message List */}
      <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-[10px] text-center py-8" style={{ color: C.dim }}>No communications</p>
        )}
        {filtered.map((comm) => {
          const fromMeta = AGENT_META[comm.from_agent as AgentId];
          const toMeta = AGENT_META[comm.to_agent as AgentId];
          const fromColor = AGENT_COLORS[comm.from_agent as AgentId] ?? C.dim;
          const badge = typeBadge(comm.message_type);
          const isDelegation = comm.message_type === 'delegation';

          return (
            <div
              key={comm.id}
              className="rounded-lg p-2 transition-colors"
              style={{
                background: C.card,
                border: `1px solid rgba(0,240,255,0.05)`,
                borderLeft: isDelegation ? '2px solid #FFB800' : `1px solid rgba(0,240,255,0.05)`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {/* From agent */}
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: fromColor }} />
                <span className="text-[10px]">{fromMeta?.emoji ?? '?'}</span>
                <span className="text-[10px] font-medium" style={{ color: fromColor }}>
                  {comm.from_agent}
                </span>

                <span className="text-[10px]" style={{ color: C.dim }}>-&gt;</span>

                {/* To agent */}
                <span className="text-[10px]">{toMeta?.emoji ?? '?'}</span>
                <span className="text-[10px] font-medium" style={{ color: AGENT_COLORS[comm.to_agent as AgentId] ?? C.dim }}>
                  {comm.to_agent}
                </span>

                <span className="flex-1" />

                {/* Type badge */}
                <span
                  className="text-[9px] px-1 py-0.5 rounded capitalize"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {comm.message_type}
                </span>
                <span className="text-[9px] font-mono" style={{ color: C.dim }}>
                  {relativeTime(comm.created_at)}
                </span>
              </div>

              {/* Message text */}
              <p className="text-[11px] pl-4" style={{ color: C.muted }}>
                {comm.message.length > 120 ? `${comm.message.slice(0, 120)}...` : comm.message}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
