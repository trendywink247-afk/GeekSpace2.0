import { SessionContinuityBanner } from '@/components/SessionContinuityBanner';
import { AgentCapabilityBadge } from '@/components/AgentCapabilityBadge';
import type { AgentPersonality } from '@/types';

interface AgentMeta { emoji: string; color: string; glow: string; initial: string; }
interface TimeContext { greeting: string; prompts: { text: string; icon: string }[]; }
interface ChatEmptyStateProps {
  meta: AgentMeta; timeContext: TimeContext;
  onStarterPrompt: (prompt: string) => void; onResume: (text: string) => void;
  personality: AgentPersonality; voiceMode: boolean;
}

export function ChatEmptyState({ meta, timeContext, onStarterPrompt, onResume, personality, voiceMode: _voiceMode }: ChatEmptyStateProps) {
  return (
    <div className='flex-1 overflow-y-auto scrollbar-hide' style={{ overscrollBehavior: 'contain' } as React.CSSProperties} data-testid='chat-empty-state'>
      <div className='flex flex-col items-center justify-center min-h-full px-5 py-12 sm:py-20 text-center'>
        <div className='w-full max-w-lg mx-auto flex flex-col items-center gap-7'>
          <SessionContinuityBanner onResume={onResume} />

          {/* Agent avatar */}
          <div className='relative'>
            <div className='absolute inset-[-14px] rounded-full opacity-15 blur-2xl' style={{ background: meta.color }} />
            <div className='absolute inset-[-6px] rounded-full' style={{ border: `1px solid ${meta.color}`, opacity: 0.15 }} />
            <div className='relative w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-black'
              style={{ background: meta.color, boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
              {meta.initial}
            </div>
          </div>

          {/* Text */}
          <div className='space-y-2'>
            <span className='font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60 block'>AI Assistant</span>
            <h2 className='text-2xl sm:text-3xl font-bold text-[var(--ag-text-primary)] leading-tight' style={{ fontFamily: 'Syne, sans-serif' }}>
              {timeContext.greeting}
            </h2>
            <p className='text-sm text-[var(--ag-text-secondary)] leading-relaxed'>Type a message or pick a prompt below</p>
            <AgentCapabilityBadge agentId={personality} className='mt-3 justify-center' />
          </div>

          {/* Starter prompts — glass tiles */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full'>
            {timeContext.prompts.map(prompt => (
              <button key={prompt.text} onClick={() => onStarterPrompt(prompt.text)} data-testid='chat-starter-prompt'
                className={['group relative px-4 py-3.5 rounded-2xl text-left text-sm text-[var(--ag-text-secondary)]',
                  'border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm',
                  'hover:bg-white/[0.05] hover:border-[var(--ag-border-active)] hover:text-[var(--ag-text-primary)]',
                  'transition-all duration-200 min-h-[56px] cursor-pointer overflow-hidden'].join(' ')}>
                <span className='absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200' style={{ background: 'var(--ag-violet)' }} />
                <span className='line-clamp-2 pl-1'>{prompt.text}</span>
              </button>
            ))}
          </div>

          <p className='font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/30'>⏎ send · Shift+⏎ newline</p>
        </div>
      </div>
    </div>
  );
}
