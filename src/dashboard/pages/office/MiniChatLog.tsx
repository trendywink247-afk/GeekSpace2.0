// src/dashboard/pages/office/MiniChatLog.tsx
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AGENT_COLORS, AGENT_META } from './constants';
import type { AgentId } from './types';

interface ChatMessage {
  fromAgent: string;
  toAgent: string;
  text: string;
  timestamp: string;
}

interface Props {
  messages: ChatMessage[];
}

function agentColor(name: string): string {
  const lower = name.toLowerCase() as AgentId;
  return AGENT_COLORS[lower] ?? '#9CA3AF';
}

function agentDisplayName(name: string): string {
  const lower = name.toLowerCase() as AgentId;
  const meta = AGENT_META[lower];
  if (meta) return `${meta.emoji} ${name}`;
  return name;
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

export function MiniChatLog({ messages }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, collapsed]);

  return (
    <div className="absolute top-3 right-3 w-56 bg-black/50 backdrop-blur-xl rounded-xl border border-white/5 z-10">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-[#F4F6FF]"
      >
        <span>
          Agent Comms
          {collapsed && messages.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] text-[10px] font-bold">
              {messages.length}
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" />
        )}
      </button>

      {/* Messages */}
      {!collapsed && (
        <div ref={scrollRef} className="max-h-48 overflow-y-auto px-3 pb-2 space-y-1">
          {messages.length === 0 ? (
            <p className="text-[10px] text-[#4B5563] italic">No agent comms yet</p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="text-[10px] leading-relaxed">
                <span className="text-[#4B5563]">[{formatTime(msg.timestamp)}]</span>{' '}
                <span style={{ color: agentColor(msg.fromAgent) }}>
                  {agentDisplayName(msg.fromAgent)}
                </span>
                <span className="text-[#4B5563]"> → </span>
                <span style={{ color: agentColor(msg.toAgent) }}>
                  {agentDisplayName(msg.toAgent)}
                </span>
                <span className="text-[#9CA3AF]">: {msg.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
