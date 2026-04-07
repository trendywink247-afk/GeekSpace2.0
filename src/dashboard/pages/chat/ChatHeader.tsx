import { useState, useRef, useEffect } from 'react';
import { VolumeX, RotateCcw, PanelLeft, ChevronDown } from 'lucide-react';
import { MobilePageHeader } from '@/components/mobile';

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

function AgentDropdown({
  selectedAgent, onAgentSelect, agentName, isTyping, meta,
}: {
  selectedAgent: string; onAgentSelect: (id: string) => void;
  agentName: string; isTyping: boolean; meta: AgentMeta;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className='relative flex items-center gap-2'>
      <div className='relative shrink-0'>
        <div className='w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-black'
          style={{ background: meta.color, boxShadow: isTyping ? meta.glow : 'none' }}>
          {meta.initial}
        </div>
        {isTyping && <span className='absolute inset-0 rounded-full animate-ping' style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }} />}
      </div>
      <button onClick={() => setOpen(v => !v)}
        className='flex items-center gap-1 px-1 py-1 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer min-h-[36px]'
        aria-haspopup='listbox' aria-expanded={open} aria-label='Switch agent' title='Switch agent'>
        <span className='text-sm font-semibold text-[var(--ag-text-primary)]' style={{ fontFamily: 'Syne, sans-serif' }} data-testid='chat-agent-name'>
          {agentName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--ag-text-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className='absolute top-full left-0 mt-1.5 w-44 rounded-2xl overflow-hidden z-50'
          style={{ background: 'var(--ag-bg-chrome)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 0 40px rgba(139,92,246,0.15), 0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}
          role='listbox' aria-label='Select agent'>
          <div className='px-3 pt-2.5 pb-1.5 border-b border-white/[0.06]'>
            <span className='font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60'>Agent</span>
          </div>
          <div className='py-1'>
            {AGENTS.map(a => (
              <button key={a.id} role='option' aria-selected={selectedAgent === a.id}
                onClick={() => { onAgentSelect(a.id); setOpen(false); }}
                className='w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-white/[0.04] cursor-pointer min-h-[40px]'
                style={{ color: selectedAgent === a.id ? a.color : 'var(--ag-text-secondary)', background: selectedAgent === a.id ? `${a.color}10` : 'transparent' }}>
                <span className='w-2 h-2 rounded-full shrink-0' style={{ background: a.color }} />
                <span className='font-medium'>{a.name}</span>
                {selectedAgent === a.id && <span className='ml-auto w-1.5 h-1.5 rounded-full' style={{ background: a.color }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatHeader({
  agentName, meta, isTyping, isStreamActive, streamHealth, onClear,
  sidebarOpen, onToggleSidebar, tts, selectedAgent, onAgentSelect,
}: ChatHeaderProps) {
  const isDisconnected = streamHealth === 'disconnected';
  const currentAgent = AGENTS.find(a => a.id === selectedAgent) ?? AGENTS[0];

  const rightActions = (
    <div className='flex items-center gap-0.5'>
      {tts.isSpeaking && (
        <button onClick={() => tts.stop()}
          className='p-2 rounded-xl hover:bg-white/[0.06] text-[var(--ag-violet)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer'
          title='Stop speaking' aria-label='Stop speaking'>
          <VolumeX className='w-4 h-4' />
        </button>
      )}
      {isStreamActive && streamHealth !== 'connected' && (
        <span className={`w-2 h-2 rounded-full mx-1.5 ${streamHealth === 'slow' ? 'bg-[var(--ag-amber)] animate-pulse' : 'bg-[var(--ag-pink)] animate-pulse'}`}
          title={streamHealth === 'slow' ? 'Slow connection' : 'Disconnected'} data-testid='chat-stream-health' />
      )}
      <button onClick={onClear} data-testid='chat-clear-button'
        className='p-2 rounded-xl hover:bg-white/[0.06] text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer'
        title='Clear conversation' aria-label='Clear conversation'>
        <RotateCcw className='w-3.5 h-3.5' />
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile: MobilePageHeader primitive */}
      <div className='md:hidden'>
        <MobilePageHeader
          title={agentName}
          subtitle={
            isTyping && !isDisconnected
              ? `${currentAgent.name !== 'Auto' ? currentAgent.name : agentName} is thinking…`
              : isDisconnected ? 'Disconnected' : undefined
          }
          onBack={onToggleSidebar}
          actions={rightActions}
        />
      </div>

      {/* Desktop: glass chrome header */}
      <div className='hidden md:flex items-center justify-between px-5 h-14 border-b flex-shrink-0 sticky top-0 z-20'
        style={{ background: 'var(--ag-bg-chrome)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
        <div className='flex items-center gap-2 min-w-0'>
          {!sidebarOpen && (
            <button onClick={onToggleSidebar} data-testid='chat-sidebar-toggle'
              className='flex items-center justify-center p-2 rounded-xl hover:bg-white/[0.06] text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] min-h-[44px] min-w-[44px] transition-colors cursor-pointer'
              title='Open conversation history' aria-label='Open conversation history'>
              <PanelLeft className='w-4 h-4' />
            </button>
          )}
          <AgentDropdown selectedAgent={selectedAgent} onAgentSelect={onAgentSelect} agentName={agentName} isTyping={isTyping} meta={meta} />
          <div className='hidden sm:flex items-center'>
            {isTyping && !isDisconnected && (
              <span className='font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ag-text-muted)] animate-pulse'>
                {currentAgent.name !== 'Auto' ? `${currentAgent.name} thinking…` : 'Thinking…'}
              </span>
            )}
            {isDisconnected && (
              <span className='flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ag-pink)]'>
                <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-pink)] animate-pulse' />
                {isTyping ? 'Reconnecting…' : 'Disconnected'}
              </span>
            )}
          </div>
        </div>
        {rightActions}
      </div>
    </>
  );
}
