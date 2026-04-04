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
  weebo: { emoji: '\u2728', color: 'var(--ag-cyan)', glow: 'shadow-[0_0_8px_rgba(139,92,246,0.3)]' },
  edith: { emoji: '\uD83D\uDD37', color: 'var(--ag-violet)', glow: 'shadow-[0_0_8px_rgba(139,92,246,0.3)]' },
  jarvis: { emoji: '\uD83E\uDD16', color: '#ADFF2F', glow: 'shadow-[0_0_8px_rgba(173,255,47,0.3)]' },
  aria: { emoji: '\uD83C\uDFA8', color: '#FF6B9D', glow: 'shadow-[0_0_8px_rgba(255,107,157,0.3)]' },
  forge: { emoji: '\uD83D\uDD27', color: '#F59E0B', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' },
  pulse: { emoji: '\uD83D\uDCCA', color: '#10B981', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]' },
  echo: { emoji: '\uD83D\uDC99', color: '#6366F1', glow: 'shadow-[0_0_8px_rgba(99,102,241,0.3)]' },
  cal: { emoji: '\uD83D\uDCC5', color: '#84CC16', glow: 'shadow-[0_0_8px_rgba(132,204,22,0.3)]' },
  nova: { emoji: '\uD83D\uDD2D', color: '#EC4899', glow: 'shadow-[0_0_8px_rgba(236,72,153,0.3)]' },
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

const ALL_AGENTS = [
  { agentId: 'weebo', agentName: 'Weebo' },
  { agentId: 'edith', agentName: 'Edith' },
  { agentId: 'jarvis', agentName: 'Jarvis' },
  { agentId: 'aria', agentName: 'Aria' },
  { agentId: 'forge', agentName: 'Forge' },
  { agentId: 'pulse', agentName: 'Pulse' },
  { agentId: 'echo', agentName: 'Echo' },
  { agentId: 'cal', agentName: 'Cal' },
  { agentId: 'nova', agentName: 'Nova' },
];

export function AgentStatusStrip({ onAgentClick }: AgentStatusStripProps) {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial fetch -- merge API data with defaults for all 9 agents
  useEffect(() => {
    agentStateService.getStates().then(res => {
      const fetched = res.data || [];
      const merged = ALL_AGENTS.map(def => {
        const found = fetched.find((a: AgentState) => a.agentId === def.agentId);
        return found || { ...def, state: 'idle', timestamp: new Date().toISOString() };
      });
      setAgents(merged);
    }).catch(() => {
      setAgents(ALL_AGENTS.map(def => ({
        ...def,
        state: 'idle',
        timestamp: new Date().toISOString(),
      })));
    });
  }, []);

  // SSE subscription for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('gs_token') || localStorage.getItem('token');
    if (!token) return;

    const url = `${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')}/agent-state/stream`;
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);

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
    <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none -mx-1 px-1">
      {agents.map(agent => {
        const meta = AGENT_META[agent.agentId] || AGENT_META.weebo;
        const isActive = agent.state !== 'idle' && agent.state !== 'done';

        return (
          <button
            key={agent.agentId}
            onClick={() => onAgentClick?.(agent.agentId)}
            className={[
              'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all snap-start shrink-0 min-h-[44px]',
              'backdrop-blur-md',
              isActive
                ? `${meta.glow}`
                : 'hover:border-[var(--ag-border-default)]',
            ].join(' ')}
            style={{
              background: isActive
                ? `linear-gradient(135deg, ${meta.color}12, ${meta.color}08)`
                : 'var(--ag-glass-bg)',
              borderColor: isActive ? `${meta.color}30` : 'var(--ag-border-subtle)',
            }}
          >
            {/* Avatar dot */}
            <div className="relative shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: `${meta.color}18` }}
              >
                <span className="text-sm">{meta.emoji}</span>
              </div>
              {isActive && (
                <motion.div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {!isActive && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#4B5563' }}
                />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold text-[var(--ag-text-primary)]">{agent.agentName}</p>
              <p className={[
                'text-[9px] truncate max-w-[80px]',
                isActive ? 'text-[#A0A8C0]' : 'text-[var(--ag-text-muted)]',
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
