// No unused useRef import
import { Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceButton } from '@/components/VoiceButton';
import { AgentMentionPopup } from '@/components/AgentMentionPopup';
import type { MentionAgent } from '@/components/AgentMentionPopup';

// ── Types ──

interface VoiceState {
  isListening: boolean;
  error?: string | null;
  isSupported: boolean;
  startListening: () => void;
}

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isTyping: boolean;
  voice: VoiceState;
  showMentionPopup: boolean;
  mentionQuery: string;
  onMentionSelect: (agent: MentionAgent) => void;
  mentionedAgent: MentionAgent | null;
  onClearMention: () => void;
  councilMode: boolean;
  onToggleCouncil: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  formRef: React.RefObject<HTMLFormElement | null>;
  selectedAgent: string;
  onAgentSelect: (agentId: string) => void;
  onTranscript: (text: string) => void;
}

// ── Main Component ──

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isTyping,
  voice,
  showMentionPopup,
  mentionQuery,
  onMentionSelect,
  mentionedAgent,
  onClearMention,
  councilMode,
  onToggleCouncil,
  textareaRef,
  formRef,
  selectedAgent,
  onAgentSelect,
  onTranscript,
}: ChatInputProps) {
  const agents = [
    { id: '', name: 'Auto', emoji: '🤖', color: '#8892A4' },
    { id: 'weebo', name: 'Weebo', emoji: '✨', color: 'var(--ag-cyan)' },
    { id: 'edith', name: 'Edith', emoji: '⚡', color: 'var(--ag-violet)' },
    { id: 'jarvis', name: 'Jarvis', emoji: '🎩', color: 'var(--ag-lime)' },
    { id: 'aria', name: 'Aria', emoji: '🎨', color: 'var(--ag-pink)' },
    { id: 'forge', name: 'Forge', emoji: '🔧', color: 'var(--ag-amber)' },
    { id: 'pulse', name: 'Pulse', emoji: '📊', color: 'var(--ag-green)' },
    { id: 'echo', name: 'Echo', emoji: '💙', color: 'var(--ag-indigo)' },
    { id: 'cal', name: 'Cal', emoji: '📅', color: 'var(--ag-lime)' },
    { id: 'nova', name: 'Nova', emoji: '🔭', color: 'var(--ag-nova)' },
  ];

  return (
    <div className='px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t flex-shrink-0' style={{ 
      borderColor: 'var(--ag-border-subtle)', 
      background: 'var(--ag-glass-bg)',
      backdropFilter: 'blur(16px)'
    }}>
      {/* Agent Picker */}
      <div className='flex gap-1.5 pb-2 overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
        {agents.map(p => (
          <button
            key={p.id}
            type='button'
            onClick={() => onAgentSelect(p.id)}
            className='flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shrink-0 transition-all'
            style={{
              border: `1px solid ${selectedAgent === p.id ? p.color + '60' : 'rgba(255,255,255,0.06)'}`,
              background: selectedAgent === p.id ? p.color + '15' : 'transparent',
              color: selectedAgent === p.id ? p.color : '#8892A4',
            }}
          >
            <span>{p.emoji}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      {voice.error && (
        <p className='text-xs text-[var(--ag-pink)] mb-2'>{voice.error}</p>
      )}
      {/* Council mode banner */}
      {councilMode && (
        <div className='flex items-center gap-2 pb-1.5'>
          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--ag-aria)]/10 border border-[var(--ag-aria)]/20 text-[var(--ag-aria)] animate-pulse'>
            <Sparkles className='w-3 h-3' />
            Council Mode — all agents will discuss your question
            <button
              type='button'
              onClick={onToggleCouncil}
              className='ml-0.5 hover:text-white transition-colors'
            >
              <X className='w-3 h-3' />
            </button>
          </span>
        </div>
      )}
      {/* Mentioned agent badge */}
      {mentionedAgent && (
        <div className='flex items-center gap-1 pb-1.5'>
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--ag-cyan)]/10 border border-[var(--ag-cyan)]/15 text-[var(--ag-cyan)]'>
            <span>{mentionedAgent.emoji}</span>
            <span>@{mentionedAgent.name}</span>
            <button
              type='button'
              onClick={onClearMention}
              className='ml-0.5 hover:text-[var(--ag-pink)] transition-colors'
              aria-label={`Remove @${mentionedAgent.name} mention`}
            >
              <X className='w-3 h-3' />
            </button>
          </span>
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className='flex items-end gap-2'
      >
        <div className='flex-1 relative'>
          {/* @mention autocomplete popup */}
          <AgentMentionPopup
            query={mentionQuery}
            onSelect={onMentionSelect}
            onClose={() => {}}
            visible={showMentionPopup}
            anchorRef={textareaRef}
          />
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            value={input}
            onChange={onInputChange}
            onKeyDown={(e) => {
              // Don't submit when mention popup is open — let popup handle Enter/Escape
              if (showMentionPopup && (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder={voice.isListening ? 'Listening...' : 'Type @ to mention an agent...'}
            disabled={isTyping}
            rows={1}
            enterKeyHint='send'
            inputMode='text'
            autoCapitalize='sentences'
            className='w-full resize-none bg-[var(--ag-glass-bg)] border border-[var(--ag-border-default)] text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)] focus:border-[var(--ag-violet)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--ag-violet)]/20 focus:shadow-[var(--ag-glow-md)] rounded-2xl px-4 py-3 text-sm leading-relaxed min-h-[44px] max-h-[120px] scrollbar-hide touch-manipulation backdrop-blur-xl transition-all duration-200'
            style={{
              borderImage: 'linear-gradient(145deg, var(--ag-border-default), var(--ag-border-subtle)) 1'
            }}
          />
          {input.length > 200 && (
            <span className='absolute right-2 bottom-1.5 text-[10px] text-[var(--ag-text-muted)] tabular-nums pointer-events-none'>
              {input.length}
            </span>
          )}
        </div>
        <VoiceButton
          onTranscript={onTranscript}
          isListening={voice.isListening}
          isProcessing={isTyping && input === ''}
          isSupported={voice.isSupported}
          onClick={voice.startListening}
        />
        <button
          type='button'
          onClick={onToggleCouncil}
          title={councilMode ? 'Council mode ON — all agents will discuss your next message' : 'Council mode — get all agents\' perspectives'}
          className={[
            'h-10 px-2.5 min-w-[44px] min-h-[44px] rounded-md transition-all shrink-0 text-xs font-medium',
            councilMode
              ? 'bg-[var(--ag-aria)]/20 text-[var(--ag-aria)] border border-[var(--ag-aria)]/40 ring-1 ring-[var(--ag-aria)]/30'
              : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-muted)] border border-[var(--ag-border-subtle)] hover:text-[var(--ag-cyan)] hover:border-[var(--ag-border-default)]',
          ].join(' ')}
          aria-label='Toggle council mode'
        >
          <Sparkles className='w-4 h-4' />
        </button>
        <Button
          type='submit'
          disabled={!input.trim() || isTyping}
          data-testid="chat-send-button"
          className='bg-[var(--ag-cyan)] hover:bg-[var(--ag-cyan)]/80 text-black h-10 px-3 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50 shrink-0'
          aria-label='Send message'
        >
          <Send className='w-4 h-4' />
        </Button>
      </form>
      <div className='flex items-center justify-between mt-1.5 px-0.5'>
        <p className='text-[10px] text-[var(--ag-text-muted)]'>
          Shift+Enter for new line &middot; @ to mention &middot; <Sparkles className='w-2.5 h-2.5 inline' /> for council
        </p>
        <p className='text-[10px] text-[var(--ag-text-muted)]'>
          Alt+V for voice
        </p>
      </div>
    </div>
  );
}