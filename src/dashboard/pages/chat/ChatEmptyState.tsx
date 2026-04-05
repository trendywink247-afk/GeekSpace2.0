import { Clock, Sparkles } from 'lucide-react';
import { useVoice } from '@/hooks/useVoice';
import { SessionContinuityBanner } from '@/components/SessionContinuityBanner';
import { AgentCapabilityBadge } from '@/components/AgentCapabilityBadge';
import type { AgentPersonality } from '@/types';

// ── Types ──

interface AgentMeta {
  emoji: string;
  color: string;
  glow: string;
  initial: string;
}

interface TimeContext {
  greeting: string;
  prompts: { text: string; icon: string }[];
}

interface ChatEmptyStateProps {
  meta: AgentMeta;
  timeContext: TimeContext;
  onStarterPrompt: (prompt: string) => void;
  onResume: (text: string) => void;
  personality: AgentPersonality;
  voiceMode: boolean;
}

// ── Main Component ──

export function ChatEmptyState({
  meta,
  timeContext,
  onStarterPrompt,
  onResume,
  personality,
  voiceMode,
}: ChatEmptyStateProps) {
  const voice = useVoice({
    onTranscript: () => {},
    onInterim: () => {},
  });

  return (
    <div className='flex-1 overflow-y-auto px-4 py-3 scrollbar-hide relative' data-testid="chat-empty-state">
      <div className='flex flex-col items-center justify-center h-full gap-4 text-center py-12'>
        {/* Session continuity — "Welcome back" banner */}
        <SessionContinuityBanner
          onResume={onResume}
        />
        {/* Hero avatar */}
        <div className='relative'>
          <div
            className='w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-black relative z-10'
            style={{ background: meta.color, boxShadow: meta.glow }}
          >
            {meta.initial}
          </div>
          <span
            className='absolute inset-[-4px] rounded-full'
            style={{ border: `1.5px solid ${meta.color}`, opacity: 0.25 }}
          />
        </div>
        <div>
          <p className='text-lg font-semibold text-[var(--ag-text-primary)] font-heading'>{timeContext.greeting}</p>
          <p className='text-sm text-[var(--ag-text-secondary)] mt-1 max-w-xs'>
            {voice.isSupported ? 'Type, speak, or try a suggestion below' : 'Type a message or try a suggestion below'}
          </p>
          {/* Agent capabilities */}
          <AgentCapabilityBadge agentId={personality} className='mt-2 justify-center' />
        </div>
        {voiceMode && voice.isSupported && (
          <div className='flex items-center gap-1.5 text-xs text-[var(--ag-cyan)]'>
            <Sparkles className='w-3.5 h-3.5' />
            Voice mode active
          </div>
        )}
        {/* Context-aware starter prompts */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md'>
          {timeContext.prompts.map((prompt) => (
            <button
              key={prompt.text}
              onClick={() => onStarterPrompt(prompt.text)}
              data-testid="chat-starter-prompt"
              className='flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] text-left text-sm text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] hover:shadow-[var(--ag-glow-sm)] transition-all duration-200 min-h-[44px]'
            >
              <Clock className='w-4 h-4 text-[var(--ag-cyan)]/50 shrink-0' />
              <span className='line-clamp-2'>{prompt.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}