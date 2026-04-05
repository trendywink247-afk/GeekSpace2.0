import { Send, X, Mic, MicOff } from 'lucide-react';
import { AgentMentionPopup } from '@/components/AgentMentionPopup';
import type { MentionAgent } from '@/components/AgentMentionPopup';
import { FileUploadZone } from '@/components/FileUploadZone';

// ── Types ──

interface VoiceState {
  isListening: boolean;
  error?: string | null;
  isSupported: boolean;
  startListening: () => void;
}

export interface ChatInputProps {
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
  // Council mode kept in interface for parent compat — not rendered
  councilMode?: boolean;
  onToggleCouncil?: () => void;
  // Agent selector kept in interface for parent compat — moved to header
  selectedAgent?: string;
  onAgentSelect?: (id: string) => void;
  // Voice transcript kept for parent compat — handled by voice hook
  onTranscript?: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  formRef: React.RefObject<HTMLFormElement | null>;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
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
  textareaRef,
  formRef,
  files = [],
  onFilesChange,
}: ChatInputProps) {
  const canSend = !!input.trim() && !isTyping;

  return (
    <div
      className='px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
      style={{
        background: 'var(--ag-bg-chrome)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Voice error */}
      {voice.error && (
        <p className='text-xs text-[var(--ag-pink)] mb-2 px-1'>{voice.error}</p>
      )}

      {/* Mentioned agent badge */}
      {mentionedAgent && (
        <div className='flex items-center gap-1 mb-2 px-1'>
          <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--ag-violet)]/10 border border-[var(--ag-border-default)] text-[var(--ag-text-accent)]'>
            <span>@{mentionedAgent.name}</span>
            <button
              type='button'
              onClick={onClearMention}
              className='ml-0.5 hover:text-[var(--ag-pink)] transition-colors cursor-pointer'
              aria-label={`Remove @${mentionedAgent.name} mention`}
            >
              <X className='w-3 h-3' />
            </button>
          </span>
        </div>
      )}

      {/* File upload zone (drag-drop + paste + previews) */}
      {onFilesChange && (
        <FileUploadZone files={files} onFilesChange={onFilesChange} disabled={isTyping} />
      )}

      {/* ── Input form ── */}
      <form ref={formRef} onSubmit={onSubmit}>
        <div className='relative'>
          {/* @mention autocomplete popup */}
          <AgentMentionPopup
            query={mentionQuery}
            onSelect={onMentionSelect}
            onClose={() => {}}
            visible={showMentionPopup}
            anchorRef={textareaRef}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            data-testid='chat-input'
            value={input}
            onChange={onInputChange}
            onKeyDown={(e) => {
              // Let mention popup handle navigation keys
              if (
                showMentionPopup &&
                (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')
              ) {
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder={voice.isListening ? 'Listening…' : 'Message Agentin…'}
            disabled={isTyping}
            rows={1}
            enterKeyHint='send'
            inputMode='text'
            autoCapitalize='sentences'
            className={[
              'w-full resize-none rounded-2xl text-sm leading-relaxed',
              'text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)]',
              'bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)]',
              'focus:border-[var(--ag-violet)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--ag-violet)]/20',
              'transition-colors duration-150',
              'min-h-[48px] max-h-[200px]',
              'scrollbar-hide touch-manipulation',
              // Padding: top/bottom for text, right for buttons, left for readability
              'px-4 py-3',
              voice.isSupported ? 'pr-[5.5rem]' : 'pr-14',
            ].join(' ')}
          />

          {/* Character count — subtle, only when long */}
          {input.length > 200 && (
            <span className='absolute left-4 bottom-1 text-[10px] text-[var(--ag-text-muted)] tabular-nums pointer-events-none'>
              {input.length}
            </span>
          )}

          {/* ── Inline action buttons ── */}
          <div className='absolute right-2 bottom-2 flex items-center gap-1'>
            {/* Voice button — only if supported */}
            {voice.isSupported && (
              <button
                type='button'
                onClick={voice.startListening}
                disabled={isTyping}
                className={[
                  'p-2 rounded-xl transition-all duration-150 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer',
                  voice.isListening
                    ? 'text-[var(--ag-pink)] animate-pulse'
                    : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5',
                ].join(' ')}
                title={voice.isListening ? 'Listening…' : 'Press to speak'}
                aria-label={voice.isListening ? 'Stop listening' : 'Start voice input'}
              >
                {voice.isListening ? (
                  <MicOff className='w-4 h-4' />
                ) : (
                  <Mic className='w-4 h-4' />
                )}
              </button>
            )}

            {/* Send button */}
            <button
              type='submit'
              disabled={!canSend}
              data-testid='chat-send-button'
              className={[
                'p-2 rounded-xl transition-all duration-150 min-h-[36px] min-w-[36px] flex items-center justify-center',
                canSend
                  ? 'text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 cursor-pointer'
                  : 'text-[var(--ag-text-muted)] cursor-not-allowed',
              ].join(' ')}
              aria-label='Send message'
            >
              <Send className='w-4 h-4' />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
