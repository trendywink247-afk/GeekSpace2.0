// ============================================================
// AgentStatusStrip — Real-time status of Weebo, Edith, Jarvis
//
// Shows at the top of the Overview page. Each agent displays:
// avatar + name + current state (idle/working/thinking) + last action.
// Clicking an agent opens chat with that agent.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { agentStateService } from '@/services/api';

interface AgentState {
  agentId: string;
  agentName: string;
  state: string;
  content?: string;
  timestamp: string;
}

interface AgentStatusStripProps {
  onAgentClick?: (agentId: string) => void;
}

const AGENT_META: Record<string, { emoji: string; color: string; glow: string }> = {
  weebo: { emoji: '\u2728', color: '#ADFF2F', glow: 'shadow-[0_0_8px_rgba(173,255,47,0.3)]' },
  edith: { emoji: '\uD83D\uDD37', color: '#8B5CF6', glow: 'shadow-[0_0_8px_rgba(139,92,246,0.3)]' },
  jarvis: { emoji: '\uD83E\uDD16', color: '#00F0FF', glow: 'shadow-[0_0_8px_rgba(0,240,255,0.3)]' },
};

const STATE_LABELS: Record<string, string> = {
  idle: 'Ready',
  thinking: 'Thinking...',
  typing: 'Typing...',
  tool_call: 'Using tools...',
  responding: 'Responding...',
  done: 'Done',
  delegating: 'Delegating...',
  task_started: 'Working...',
};

export function AgentStatusStrip({ onAgentClick }: AgentStatusStripProps) {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial fetch
  useEffect(() => {
    agentStateService.getStates().then(res => {
      setAgents(res.data || []);
    }).catch(() => {
      // Default idle state
      setAgents([
        { agentId: 'weebo', agentName: 'Weebo', state: 'idle', timestamp: new Date().toISOString() },
        { agentId: 'edith', agentName: 'Edith', state: 'idle', timestamp: new Date().toISOString() },
        { agentId: 'jarvis', agentName: 'Jarvis', state: 'idle', timestamp: new Date().toISOString() },
      ]);
    });
  }, []);

  // SSE subscription for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')}/agent-state/stream`;
    const es = new EventSource(`${url}?token=${token}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AgentState;
        setAgents(prev => {
          const next = [...prev];
          const idx = next.findIndex(a => a.agentId === data.agentId);
          if (idx >= 0) {
            next[idx] = data;
          } else {
            next.push(data);
          }
          return next;
        });
      } catch { /* ignore malformed */ }
    };

    eventSourceRef.current = es;
    return () => { es.close(); };
  }, []);

  if (agents.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {agents.filter(a => ['weebo', 'edith', 'jarvis'].includes(a.agentId)).map(agent => {
        const meta = AGENT_META[agent.agentId] || AGENT_META.jarvis;
        const isActive = agent.state !== 'idle' && agent.state !== 'done';

        return (
          <button
            key={agent.agentId}
            onClick={() => onAgentClick?.(agent.agentId)}
            className={[
              'flex items-center gap-3 p-3 rounded-xl border transition-all',
              'bg-[#0C0C18] hover:bg-[#12121F]',
              isActive
                ? `border-[${meta.color}]/20 ${meta.glow}`
                : 'border-[#00F0FF]/5 hover:border-[#00F0FF]/15',
            ].join(' ')}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <span className="text-2xl">{meta.emoji}</span>
              {isActive && (
                <motion.div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {!isActive && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#4B5563]" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-[#F4F6FF]">{agent.agentName}</p>
              <p className={[
                'text-[10px] truncate',
                isActive ? 'text-[#A0A8C0]' : 'text-[#4B5563]',
              ].join(' ')}>
                {agent.content || STATE_LABELS[agent.state] || agent.state}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
