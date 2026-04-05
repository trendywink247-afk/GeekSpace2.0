import { useState, useRef, useEffect } from 'react';
import { VolumeX, RotateCcw, PanelLeft, ChevronDown } from 'lucide-react';

// ── Types ──

type StreamHealth = 'connected' | 'slow' | 'disconnected';

interface AgentMeta {
  emoji: string;
  color: string;
  glow: string;
  initial: string;
}

interface TTSState {
  isSpeaking: boolean;
  stop: () => void;
}

interface AgentOption {
  id: string;
  name: string;
  color: string;
}

interface ChatHeaderProps {
  agentName: string;
  meta: AgentMeta;
  isTyping: boolean;
  isStreamActive: boolean;
  streamHealth: StreamHealth;
  onClear: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  tts: TTSState;
  selectedAgent: string;
  onAgentSelect: (agentId: string) => void;
}

// ── Agent Options ──

const AGENTS: AgentOption[] = [
  { id: '',       name: 'Auto',   color: 'var(--ag-text-muted)' },
  { id: 'weebo',  name: 'Weebo',  color: 'var(--ag-weebo)' },
  { id: 'edith',  name: 'Edith',  color: 'var(--ag-edith)' },
  { id: 'jarvis', name: 'Jarvis', color: 'var(--ag-jarvis)' },
  { id: 'aria',   name: 'Aria',   color: 'var(--ag-aria)' },
  { id: 'forge',  name: 'Forge',  color: 'var(--ag-forge)' },
  { id: 'pulse',  name: 'Pulse',  color: 'var(--ag-pulse)' },
  { id: 'echo',   name: 'Echo',   color: 'var(--ag-echo)' },
  { id: 'cal',    name: 'Cal',    color: 'var(--ag-cal)' },
  { id: 'nova',   name: 'Nova',   color: 'var(--ag-nova)' },
];

// ── Main Component ──

export function ChatHeader({
  agentName,
  meta,
  isTyping,
  isStreamActive,
  streamHealth,
  onClear,
  sidebarOpen,
  onToggleSidebar,
  tts,
  selectedAgent,
  onAgentSelect,
}: ChatHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const isDisconnected = streamHealth === 'disconnected';
  const currentAgent = AGENTS.find(a => a.id === selectedAgent) ?? AGENTS[0];

  return (
    <div
      className='sticky top-0 z-20 flex items-center justify-between px-4 h-12 border-b border-[var(--ag-border-subtle)] backdrop-blur-xl flex-shrink-0'
      style={{ background: 'var(--ag-bg-chrome)' }}
    >
      {/* ── Left: Sidebar toggle + Agent identity ── */}
      <div className='flex items-center gap-2 min-w-0'>
        {/* Sidebar toggle — desktop only */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            data-testid='chat-sidebar-toggle'
            className='flex p-1.5 rounded-lg hover:bg-white/5 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] items-center justify-center min-h-[44px] min-w-[44px] transition-colors cursor-pointer'
            title='Open conversation history'
            aria-label='Open conversation history'
          >
            <PanelLeft className='w-4 h-4' />
          </button>
        )}

        {/* Agent avatar dot */}
        <div className='relative shrink-0'>
          <div
            className='w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-black'
            style={{ background: meta.color, boxShadow: isTyping ? meta.glow : 'none' }}
          >
            {meta.initial}
          </div>
          {isTyping && (
            <span
              className='absolute inset-0 rounded-full animate-ping'
              style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
            />
          )}
        </div>

        {/* Agent name + model selector dropdown */}
        <div ref={dropdownRef} className='relative'>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className='flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer min-h-[36px] group'
            aria-haspopup='listbox'
            aria-expanded={dropdownOpen}
            title='Switch agent'
          >
            <span
              className='text-sm font-semibold text-[var(--ag-text-primary)] font-heading'
              data-testid='chat-agent-name'
            >
              {agentName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--ag-text-muted)] transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Agent picker dropdown */}
          {dropdownOpen && (
            <div
              className='absolute top-full left-0 mt-1 w-40 bg-[var(--ag-bg-elevated)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-xl overflow-hidden shadow-xl z-50'
              role='listbox'
              aria-label='Select agent'
            >
              {AGENTS.map(agent => (
                <button
                  key={agent.id}
                  role='option'
                  aria-selected={selectedAgent === agent.id}
                  onClick={() => {
                    onAgentSelect(agent.id);
                    setDropdownOpen(false);
                  }}
                  className='w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-white/5 cursor-pointer min-h-[40px]'
                  style={{
                    color: selectedAgent === agent.id ? agent.color : 'var(--ag-text-secondary)',
                    background: selectedAgent === agent.id ? `${agent.color}10` : 'transparent',
                  }}
                >
                  <span
                    className='w-2 h-2 rounded-full shrink-0'
                    style={{ background: agent.color }}
                  />
                  <span className='font-medium'>{agent.name}</span>
                  {selectedAgent === agent.id && (
                    <span className='ml-auto w-1.5 h-1.5 rounded-full bg-[var(--ag-text-muted)]' />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div className='hidden sm:flex items-center'>
          {isTyping && !isDisconnected && (
            <span className='text-xs text-[var(--ag-text-muted)] animate-pulse'>
              {currentAgent.name !== 'Auto' ? `${currentAgent.name} is thinking…` : 'Thinking…'}
            </span>
          )}
          {isDisconnected && (
            <span className='flex items-center gap-1.5 text-xs text-[var(--ag-pink)]'>
              <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-pink)] animate-pulse' />
              {isTyping ? 'Reconnecting…' : 'Disconnected'}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: Contextual controls ── */}
      <div className='flex items-center gap-1'>
        {/* TTS stop — only when speaking */}
        {tts.isSpeaking && (
          <button
            onClick={() => tts.stop()}
            className='p-1.5 rounded-lg hover:bg-white/5 text-[var(--ag-cyan)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer'
            title='Stop speaking'
            aria-label='Stop speaking'
          >
            <VolumeX className='w-4 h-4' />
          </button>
        )}

        {/* Stream health — only when not connected */}
        {isStreamActive && streamHealth !== 'connected' && (
          <div
            className='flex items-center gap-1.5 px-2 py-1 rounded-lg'
            title={streamHealth === 'slow' ? 'Slow connection' : 'Disconnected'}
            data-testid='chat-stream-health'
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${streamHealth === 'slow' ? 'bg-[var(--ag-amber)] animate-pulse' : 'bg-[var(--ag-pink)]'}`}
            />
          </div>
        )}

        {/* Clear chat */}
        <button
          onClick={onClear}
          data-testid='chat-clear-button'
          className='p-1.5 rounded-lg hover:bg-white/5 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer'
          title='Clear conversation'
          aria-label='Clear conversation'
        >
          <RotateCcw className='w-3.5 h-3.5' />
        </button>
      </div>
    </div>
  );
}
