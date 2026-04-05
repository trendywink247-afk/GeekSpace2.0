import { Volume2, VolumeX, RotateCcw, PanelLeft } from 'lucide-react';

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

interface ChatHeaderProps {
  agentName: string;
  meta: AgentMeta;
  isTyping: boolean;
  isStreamActive: boolean;
  streamHealth: StreamHealth;
  voiceMode: boolean;
  onToggleVoice: () => void;
  onClear: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  tts: TTSState;
}

// ── Helper Components ──

/** Stream health indicator dot */
function StreamHealthDot({ health }: { health: StreamHealth }) {
  const colors: Record<StreamHealth, string> = {
    connected: 'bg-[var(--ag-lime)]',
    slow: 'bg-[var(--ag-amber)]',
    disconnected: 'bg-[var(--ag-pink)]',
  };
  const labels: Record<StreamHealth, string> = {
    connected: 'Connected',
    slow: 'Slow connection',
    disconnected: 'Disconnected',
  };

  return (
    <div className='flex items-center gap-1.5' title={labels[health]}>
      <span className={`w-2 h-2 rounded-full ${colors[health]} ${health === 'slow' ? 'animate-pulse' : ''}`} />
      {health !== 'connected' && (
        <span className='text-[10px] text-[var(--ag-text-secondary)]'>{labels[health]}</span>
      )}
    </div>
  );
}

// ── Main Component ──

export function ChatHeader({
  agentName,
  meta,
  isTyping,
  isStreamActive,
  streamHealth,
  voiceMode,
  onToggleVoice,
  onClear,
  sidebarOpen,
  onToggleSidebar,
  tts,
}: ChatHeaderProps) {
  return (
    <div className='flex items-center justify-between px-4 py-3 border-b flex-shrink-0 backdrop-blur-md' style={{ borderColor: 'var(--ag-border-subtle)', background: 'var(--ag-glass-bg)' }}>
      <div className='flex items-center gap-3'>
        {/* Sidebar toggle */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            data-testid="chat-sidebar-toggle"
            className='p-1.5 rounded-lg hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[36px] min-w-[36px] flex items-center justify-center'
            title='Open conversation sidebar'
            aria-label='Open conversation sidebar'
          >
            <PanelLeft className='w-4 h-4' />
          </button>
        )}
        {/* Agent avatar */}
        <div className='relative'>
          <div
            className='w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black relative z-10'
            style={{ background: meta.color, boxShadow: meta.glow }}
          >
            {meta.initial}
          </div>
          {isTyping && (
            <span
              className='absolute inset-0 rounded-full animate-ping'
              style={{ border: `2px solid ${meta.color}`, opacity: 0.4 }}
            />
          )}
        </div>
        <div>
          <div className='flex items-center gap-2'>
            {/* Agent ownership dot */}
            <span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: 'var(--ag-weebo)' }} title='Owned by Weebo' />
            <h2 className='text-sm font-semibold text-[var(--ag-text-primary)] font-heading' data-testid="chat-agent-name">{agentName}</h2>
            {/* Stream health indicator */}
            {isStreamActive && <div data-testid="chat-stream-health"><StreamHealthDot health={streamHealth} /></div>}
          </div>
          <p className='text-xs text-[var(--ag-text-secondary)]'>
            {isTyping ? <span className='text-shimmer'>Thinking...</span> : 'AI Assistant'}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        {tts.isSpeaking && (
          <button
            onClick={() => tts.stop()}
            className='p-1.5 rounded-lg hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)] min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50'
            title='Stop speaking'
            aria-label='Stop speaking'
          >
            <VolumeX className='w-4 h-4' />
          </button>
        )}
        <button
          onClick={onToggleVoice}
          data-testid="chat-voice-toggle"
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50',
            voiceMode
              ? 'bg-[var(--ag-cyan)]/20 text-[var(--ag-cyan)] ring-1 ring-[var(--ag-cyan)]/40'
              : 'hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)]',
          ].join(' ')}
          title={voiceMode ? 'Voice mode on' : 'Enable voice mode'}
        >
          <Volume2 className='w-3.5 h-3.5' />
          <span className='hidden sm:inline'>Voice {voiceMode ? 'On' : 'Off'}</span>
        </button>
        <button
          onClick={onClear}
          data-testid="chat-clear-button"
          className='p-1.5 rounded-lg hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50'
          title='Clear chat'
          aria-label='Clear chat'
        >
          <RotateCcw className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}