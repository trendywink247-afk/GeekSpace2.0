import { Send, X, Mic, MicOff } from 'lucide-react';
import { AgentMentionPopup } from '@/components/AgentMentionPopup';
import type { MentionAgent } from '@/components/AgentMentionPopup';
import { FileUploadZone } from '@/components/FileUploadZone';

interface VoiceState { isListening: boolean; error?: string | null; isSupported: boolean; startListening: () => void; }
export interface ChatInputProps {
  input: string; onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e?: React.FormEvent) => void; isTyping: boolean; voice: VoiceState;
  showMentionPopup: boolean; mentionQuery: string; onMentionSelect: (agent: MentionAgent) => void;
  mentionedAgent: MentionAgent | null; onClearMention: () => void;
  councilMode?: boolean; onToggleCouncil?: () => void;
  selectedAgent?: string; onAgentSelect?: (id: string) => void; onTranscript?: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>; formRef: React.RefObject<HTMLFormElement | null>;
  files?: File[]; onFilesChange?: (files: File[]) => void;
}

export function ChatInput({ input, onInputChange, onSubmit, isTyping, voice, showMentionPopup, mentionQuery, onMentionSelect, mentionedAgent, onClearMention, textareaRef, formRef, files = [], onFilesChange }: ChatInputProps) {
  const canSend = !!input.trim() && !isTyping;

  return (
    <div className='px-3 sm:px-4 py-3'
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', background: 'var(--ag-bg-chrome)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
      {voice.error && <p className='text-xs text-[var(--ag-pink)] mb-2 px-1'>{voice.error}</p>}
      {mentionedAgent && (
        <div className='flex items-center gap-1 mb-2 px-1'>
          <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium'
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: 'var(--ag-text-accent)' }}>
            <span>@{mentionedAgent.name}</span>
            <button type='button' onClick={onClearMention} className='ml-0.5 hover:text-[var(--ag-pink)] transition-colors cursor-pointer' aria-label={`Remove @${mentionedAgent.name} mention`}>
              <X className='w-3 h-3' />
            </button>
          </span>
        </div>
      )}
      {onFilesChange && <FileUploadZone files={files} onFilesChange={onFilesChange} disabled={isTyping} />}
      <form ref={formRef} onSubmit={onSubmit}>
        <div className='relative rounded-2xl transition-all duration-200'
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
          onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.4)'; }}
          onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}>
          <AgentMentionPopup query={mentionQuery} onSelect={onMentionSelect} onClose={() => {}} visible={showMentionPopup} anchorRef={textareaRef} />
          <textarea ref={textareaRef} data-testid='chat-input' value={input} onChange={onInputChange}
            onKeyDown={e => {
              if (showMentionPopup && (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) return;
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); formRef.current?.requestSubmit(); }
            }}
            placeholder={voice.isListening ? 'Listening…' : 'Ask your team anything…'}
            disabled={isTyping} rows={1} enterKeyHint='send' inputMode='text' autoCapitalize='sentences'
            className={['w-full resize-none rounded-2xl text-sm leading-relaxed', 'text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)]',
              'bg-transparent focus:outline-none', 'min-h-[52px] max-h-[200px]', 'scrollbar-hide touch-manipulation', 'px-4 py-3.5',
              voice.isSupported ? 'pr-[5.5rem]' : 'pr-14'].join(' ')} />
          {input.length > 200 && <span className='absolute left-4 bottom-1.5 font-mono text-[10px] text-[var(--ag-text-muted)] tabular-nums pointer-events-none'>{input.length}</span>}
          <div className='absolute right-2 bottom-2 flex items-center gap-1'>
            {voice.isSupported && (
              <button type='button' onClick={voice.startListening} disabled={isTyping}
                className={['p-2 rounded-xl transition-all duration-150 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer',
                  voice.isListening ? 'text-[var(--ag-pink)] animate-pulse bg-[var(--ag-pink)]/10' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/[0.06]'].join(' ')}
                title={voice.isListening ? 'Listening…' : 'Voice input'} aria-label={voice.isListening ? 'Stop listening' : 'Start voice input'}>
                {voice.isListening ? <MicOff className='w-4 h-4' /> : <Mic className='w-4 h-4' />}
              </button>
            )}
            <button type='submit' disabled={!canSend} data-testid='chat-send-button'
              className={['p-2 rounded-xl transition-all duration-150 min-h-[40px] min-w-[40px] flex items-center justify-center',
                canSend ? 'text-white cursor-pointer active:scale-95' : 'text-[var(--ag-text-muted)] cursor-not-allowed opacity-40'].join(' ')}
              style={canSend ? { background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' } : {}}
              aria-label='Send message'>
              <Send className='w-4 h-4' />
            </button>
          </div>
        </div>
        <p className='hidden sm:block font-mono text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]/25 text-center mt-2'>⏎ send · Shift+⏎ newline</p>
      </form>
    </div>
  );
}
