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
  voiceMode: _voiceMode, // kept in interface for compat, not currently used in UI
}: ChatEmptyStateProps) {
  return (
    <div
      className='flex-1 overflow-y-auto scrollbar-hide'
      data-testid='chat-empty-state'
    >
      <div className='flex flex-col items-center justify-center min-h-full px-6 py-16 text-center'>
        <div className='w-full max-w-lg mx-auto flex flex-col items-center gap-6'>

          {/* Session continuity banner */}
          <SessionContinuityBanner onResume={onResume} />

          {/* Agent avatar */}
          <div className='relative'>
            <div
              className='w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-black mx-auto'
              style={{ background: meta.color, boxShadow: `var(--ag-glow-md)` }}
            >
              {meta.initial}
            </div>
            <span
              className='absolute inset-[-6px] rounded-full pointer-events-none'
              style={{ border: `1px solid ${meta.color}`, opacity: 0.18 }}
            />
          </div>

          {/* Greeting + subtitle */}
          <div className='space-y-1.5'>
            <h2 className='text-xl font-semibold text-[var(--ag-text-primary)] font-heading'>
              {timeContext.greeting}
            </h2>
            <p className='text-sm text-[var(--ag-text-secondary)]'>
              Type a message or choose a prompt below
            </p>
            {/* Agent capabilities */}
            <AgentCapabilityBadge agentId={personality} className='mt-2 justify-center' />
          </div>

          {/* ── Starter prompts 2×2 grid ── */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 w-full'>
            {timeContext.prompts.map((prompt) => (
              <button
                key={prompt.text}
                onClick={() => onStarterPrompt(prompt.text)}
                data-testid='chat-starter-prompt'
                className={[
                  'px-4 py-3 rounded-2xl text-left text-sm text-[var(--ag-text-secondary)]',
                  'border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)]',
                  'hover:text-[var(--ag-text-primary)] hover:bg-white/[0.03]',
                  'transition-all duration-150 min-h-[48px] cursor-pointer',
                ].join(' ')}
              >
                <span className='line-clamp-2'>{prompt.text}</span>
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
