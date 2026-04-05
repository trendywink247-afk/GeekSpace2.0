import { memo, useState } from 'react';
import {
  RefreshCw, Pin, ThumbsUp, ThumbsDown, Copy, Check,
  Pencil, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { MentionAgent } from '@/components/AgentMentionPopup';

// ── Types ──

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  toolSteps?: ToolStep[];
  mentionedAgent?: MentionAgent;
  /** Multi-agent delegation: which personality generated this message */
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
}

export interface ToolStep {
  id: string;
  tool: string;
  label: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  durationMs?: number;
}

export type FeedbackValue = 'up' | 'down' | null;

// ── Constants ──

const LANG_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  javascript: { label: 'JavaScript', bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  js:         { label: 'JavaScript', bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  typescript: { label: 'TypeScript', bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  ts:         { label: 'TypeScript', bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  tsx:        { label: 'TSX',        bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  jsx:        { label: 'JSX',        bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  python:     { label: 'Python',     bg: 'bg-[var(--ag-amber)]/10', text: 'text-[var(--ag-amber)]' },
  py:         { label: 'Python',     bg: 'bg-[var(--ag-amber)]/10', text: 'text-[var(--ag-amber)]' },
  html:       { label: 'HTML',       bg: 'bg-[var(--ag-amber)]/10', text: 'text-[var(--ag-amber)]' },
  css:        { label: 'CSS',        bg: 'bg-[var(--ag-pink)]/10',  text: 'text-[var(--ag-pink)]' },
  json:       { label: 'JSON',       bg: 'bg-[var(--ag-green)]/10', text: 'text-[var(--ag-green)]' },
  bash:       { label: 'Bash',       bg: 'bg-[var(--ag-green)]/10', text: 'text-[var(--ag-green)]' },
  sh:         { label: 'Shell',      bg: 'bg-[var(--ag-green)]/10', text: 'text-[var(--ag-green)]' },
  sql:        { label: 'SQL',        bg: 'bg-[var(--ag-violet)]/10', text: 'text-[var(--ag-violet)]' },
  rust:       { label: 'Rust',       bg: 'bg-[var(--ag-amber)]/10', text: 'text-[var(--ag-amber)]' },
  go:         { label: 'Go',         bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  java:       { label: 'Java',       bg: 'bg-[var(--ag-pink)]/10',  text: 'text-[var(--ag-pink)]' },
  c:          { label: 'C',          bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  cpp:        { label: 'C++',        bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  yaml:       { label: 'YAML',       bg: 'bg-[var(--ag-pink)]/10',  text: 'text-[var(--ag-pink)]' },
  yml:        { label: 'YAML',       bg: 'bg-[var(--ag-pink)]/10',  text: 'text-[var(--ag-pink)]' },
  markdown:   { label: 'Markdown',   bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  md:         { label: 'Markdown',   bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
  dockerfile: { label: 'Dockerfile', bg: 'bg-[var(--ag-cyan)]/10', text: 'text-[var(--ag-cyan)]' },
};

// ── Sub-components ──

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const langKey = (lang || '').toLowerCase();
  const langMeta = LANG_COLORS[langKey];
  return (
    <div
      className='relative my-3 rounded-xl overflow-hidden border'
      style={{ borderColor: 'var(--ag-border-default)' }}
    >
      <div
        className='flex items-center justify-between px-3 py-2'
        style={{ background: 'var(--ag-bg-deep)' }}
      >
        {langMeta ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${langMeta.bg} ${langMeta.text}`}>
            {langMeta.label}
          </span>
        ) : (
          <span className='text-xs text-[var(--ag-text-muted)]'>{lang || 'code'}</span>
        )}
        <button
          onClick={handleCopy}
          className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all min-h-[32px] cursor-pointer',
            copied
              ? 'text-[var(--ag-green)] bg-[var(--ag-green)]/10'
              : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5',
          ].join(' ')}
          title='Copy code'
          aria-label='Copy code'
        >
          {copied ? <Check className='w-3.5 h-3.5' /> : <Copy className='w-3.5 h-3.5' />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre
        className='p-4 overflow-x-auto text-xs leading-relaxed whitespace-pre font-mono'
        style={{ color: 'var(--ag-text-primary)', background: 'var(--ag-bg-deep)' }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let keyIdx = 0;

  const processInline = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const inlineRegex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let pIdx = 0;
    while ((match = inlineRegex.exec(line)) !== null) {
      if (match.index > lastIdx) parts.push(line.slice(lastIdx, match.index));
      if (match[1])
        parts.push(<strong key={pIdx++} className='font-semibold text-[var(--ag-text-primary)]'>{match[1]}</strong>);
      else if (match[2])
        parts.push(<em key={pIdx++} className='italic text-[var(--ag-text-secondary)]'>{match[2]}</em>);
      else if (match[3])
        parts.push(
          <code key={pIdx++} className='px-1.5 py-0.5 rounded-md bg-[var(--ag-bg-surface)] text-[var(--ag-cyan)] text-[0.8em] font-mono border border-[var(--ag-border-subtle)]'>
            {match[3]}
          </code>
        );
      else if (match[4] && match[5])
        parts.push(
          <a key={pIdx++} href={match[5]} target='_blank' rel='noopener noreferrer'
            className='text-[var(--ag-violet)] hover:text-[var(--ag-cyan)] underline underline-offset-2 transition-colors'>
            {match[4]}
          </a>
        );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={keyIdx++} className='list-disc list-inside space-y-1.5 my-2 text-[var(--ag-text-secondary)]'>
          {listItems.map((item, i) => <li key={i}>{processInline(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.match(/^[-*] /)) {
      listItems.push(line.replace(/^[-*] /, ''));
    } else {
      flushList();
      if (line.trim()) {
        elements.push(
          <span key={keyIdx++} style={{ whiteSpace: 'pre-wrap' }}>
            {processInline(line)}{'\n'}
          </span>
        );
      } else {
        elements.push(<br key={keyIdx++} />);
      }
    }
  }
  flushList();
  return <>{elements}</>;
}

function renderMessageContent(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const fenceRegex = /```(\w*)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;
  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={keyIdx++}>{renderInlineMarkdown(content.slice(lastIndex, match.index))}</span>);
    }
    parts.push(<CodeBlock key={keyIdx++} lang={match[1] || ''} code={match[2] || ''} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={keyIdx++}>{renderInlineMarkdown(content.slice(lastIndex))}</span>);
  }
  return parts.length > 0 ? <>{parts}</> : content;
}

function ToolStepCard({ step }: { step: ToolStep }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';

  return (
    <div className='my-1.5'>
      <button
        onClick={() => setExpanded(!expanded)}
        className='flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)] transition-colors text-xs cursor-pointer'
      >
        {isRunning ? (
          <RefreshCw className='w-3 h-3 text-[var(--ag-cyan)] animate-spin shrink-0' />
        ) : isDone ? (
          <Check className='w-3 h-3 text-[var(--ag-lime)] shrink-0' />
        ) : (
          <X className='w-3 h-3 text-[var(--ag-pink)] shrink-0' />
        )}
        <span className={isRunning ? 'text-[var(--ag-cyan)]' : isDone ? 'text-[var(--ag-text-secondary)]' : 'text-[var(--ag-pink)]'}>
          {step.label}
        </span>
        {step.durationMs != null && (
          <span className='text-[var(--ag-text-muted)] ml-auto mr-1 tabular-nums'>
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        {step.result && (
          expanded
            ? <ChevronDown className='w-3 h-3 text-[var(--ag-text-muted)] shrink-0' />
            : <ChevronRight className='w-3 h-3 text-[var(--ag-text-muted)] shrink-0' />
        )}
      </button>
      {expanded && step.result && (
        <div className='mt-1 px-3 py-2 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)] text-xs text-[var(--ag-text-secondary)] whitespace-pre-wrap'>
          {step.result}
        </div>
      )}
    </div>
  );
}

// ── Main bubble props ──

export interface ChatMessageBubbleProps {
  msg: ChatMessage;
  isStreaming: boolean;
  showTimestamp: boolean;
  msgFeedback: FeedbackValue;
  isEditing: boolean;
  editText: string;
  copiedMsgId: string | null;
  isTyping: boolean;
  meta: { emoji: string; color: string; glow: string; initial: string };
  formatRelativeTime: (date: Date) => string;
  formatDateTime: (date: Date) => string;
  onRegenerate: (msgId: string) => void;
  onPinToNotes: (msgId: string, content: string) => void;
  onCopyMessage: (msgId: string, content: string) => void;
  onFeedback: (msgId: string, value: FeedbackValue) => void;
  onStartEdit: (msgId: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  msg,
  isStreaming,
  showTimestamp,
  msgFeedback,
  isEditing,
  editText,
  copiedMsgId,
  isTyping,
  meta,
  formatRelativeTime,
  formatDateTime,
  onRegenerate,
  onPinToNotes,
  onCopyMessage,
  onFeedback,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onEditTextChange,
}: ChatMessageBubbleProps) {
  // Don't render empty completed agent messages
  if (msg.role === 'agent' && !msg.content && !isStreaming && !isTyping) {
    return null;
  }

  const isUser = msg.role === 'user';
  const isAgent = msg.role === 'agent';

  return (
    <div
      id={`msg-${msg.id}`}
      className={['flex gap-3 group/msg', isUser ? 'justify-end' : 'justify-start items-start'].join(' ')}
    >
      {/* ── Agent avatar dot (left margin) ── */}
      {isAgent && (
        <div className='relative shrink-0 mt-1'>
          <div
            className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black'
            style={{ background: meta.color, boxShadow: isStreaming ? meta.glow : 'none' }}
          >
            {meta.initial}
          </div>
          {isStreaming && (
            <span
              className='absolute inset-0 rounded-full animate-ping'
              style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
            />
          )}
        </div>
      )}

      {/* ── Message body ── */}
      <div
        className={[
          isUser
            // User: subtle bubble, right-aligned
            ? 'w-fit max-w-[80%] md:max-w-[70%] ml-auto px-4 py-2.5 rounded-2xl rounded-tr-sm bg-[var(--ag-violet)]/10 border border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] text-sm leading-[1.7]'
            // Agent: no bubble — just text, document-style
            : 'flex-1 min-w-0 text-sm leading-[1.7] text-[var(--ag-text-primary)]',
        ].join(' ')}
      >
        {/* ── Edit mode (user messages) ── */}
        {isEditing ? (
          <div className='space-y-2'>
            <textarea
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              className='w-full bg-[var(--ag-bg-deep)] border border-[var(--ag-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--ag-text-primary)] resize-none focus:outline-none focus:border-[var(--ag-violet)]/40 min-h-[60px]'
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirmEdit(); }
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
            <div className='flex items-center gap-2 justify-end'>
              <button
                onClick={onCancelEdit}
                className='px-2.5 py-1 rounded text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[28px] cursor-pointer'
              >
                Cancel
              </button>
              <button
                onClick={onConfirmEdit}
                className='px-2.5 py-1 rounded text-xs bg-[var(--ag-violet)]/20 text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/30 min-h-[28px] cursor-pointer'
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Multi-agent: show which personality is speaking */}
            {msg.agentName && isAgent && (
              <div className='flex items-center gap-1.5 mb-1.5 -mt-0.5'>
                <span className='text-[11px] font-semibold' style={{ color: meta.color }}>
                  {msg.agentName}
                </span>
              </div>
            )}

            {/* Tool execution steps */}
            {msg.toolSteps && msg.toolSteps.length > 0 && (
              <div className='mb-3'>
                {msg.toolSteps.map((step) => (
                  <ToolStepCard key={step.id} step={step} />
                ))}
              </div>
            )}

            {/* Typing indicator — streaming but no content yet */}
            {isAgent && !msg.content && (isStreaming || isTyping) && (
              <div className='flex items-center gap-1.5 py-1'>
                <span
                  className='w-1.5 h-1.5 rounded-full bg-[var(--ag-text-muted)]'
                  style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0ms' }}
                />
                <span
                  className='w-1.5 h-1.5 rounded-full bg-[var(--ag-text-muted)]'
                  style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '200ms' }}
                />
                <span
                  className='w-1.5 h-1.5 rounded-full bg-[var(--ag-text-muted)]'
                  style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '400ms' }}
                />
              </div>
            )}

            {/* Message content */}
            {msg.content ? (
              isAgent ? (
                renderMessageContent(msg.content)
              ) : (
                <>
                  {msg.mentionedAgent && (
                    <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--ag-violet)]/10 text-[var(--ag-text-accent)] mb-1.5 mr-1'>
                      @{msg.mentionedAgent.name}
                    </span>
                  )}
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                </>
              )
            ) : (
              isAgent && (isStreaming || isTyping) ? (
                <div className='flex items-center gap-1.5 py-1'>
                  <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
                  <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
                  <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
                </div>
              ) : null
            )}

            {/* ── Footer: timestamp + action buttons ── */}
            <div className={[
              'flex items-center gap-2 mt-2',
              isUser ? 'justify-start' : 'justify-start',
            ].join(' ')}>
              {/* Timestamp — always visible for cluster-end messages, hover-only otherwise */}
              <p
                className={[
                  'text-[10px] text-[var(--ag-text-muted)] transition-opacity duration-200',
                  showTimestamp ? 'opacity-60' : 'opacity-0 group-hover/msg:opacity-60',
                ].join(' ')}
                title={formatDateTime(msg.timestamp)}
              >
                {formatRelativeTime(msg.timestamp)}
              </p>

              {/* Action buttons — agent messages */}
              {isAgent && msg.content && (
                <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity duration-200'>
                  <button
                    onClick={() => onRegenerate(msg.id)}
                    className='p-1 rounded-lg transition-colors text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer'
                    title='Regenerate'
                    aria-label='Regenerate response'
                    disabled={isTyping}
                  >
                    <RefreshCw className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={() => onPinToNotes(msg.id, msg.content)}
                    className='p-1 rounded-lg transition-colors text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer'
                    title='Pin to notes'
                    aria-label='Pin to notes'
                  >
                    <Pin className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={() => onFeedback(msg.id, 'up')}
                    className={[
                      'p-1 rounded-lg transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer',
                      msgFeedback === 'up'
                        ? 'text-[var(--ag-lime)]'
                        : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-lime)] hover:bg-white/5',
                    ].join(' ')}
                    title='Helpful'
                    aria-label='Mark as helpful'
                  >
                    <ThumbsUp className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={() => onFeedback(msg.id, 'down')}
                    className={[
                      'p-1 rounded-lg transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer',
                      msgFeedback === 'down'
                        ? 'text-[var(--ag-pink)]'
                        : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)] hover:bg-white/5',
                    ].join(' ')}
                    title='Not helpful'
                    aria-label='Mark as not helpful'
                  >
                    <ThumbsDown className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={() => onCopyMessage(msg.id, msg.content)}
                    className='p-1 rounded-lg transition-colors text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer'
                    title='Copy'
                    aria-label='Copy message'
                  >
                    {copiedMsgId === msg.id
                      ? <Check className='w-3.5 h-3.5 text-[var(--ag-lime)]' />
                      : <Copy className='w-3.5 h-3.5' />
                    }
                  </button>
                </div>
              )}

              {/* Action buttons — user messages */}
              {isUser && msg.content && (
                <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity duration-200'>
                  <button
                    onClick={() => onStartEdit(msg.id)}
                    className='p-1 rounded-lg transition-colors text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer'
                    title='Edit'
                    aria-label='Edit message'
                    disabled={isTyping}
                  >
                    <Pencil className='w-3.5 h-3.5' />
                  </button>
                  <button
                    onClick={() => onCopyMessage(msg.id, msg.content)}
                    className='p-1 rounded-lg transition-colors text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] hover:bg-white/5 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer'
                    title='Copy'
                    aria-label='Copy message'
                  >
                    {copiedMsgId === msg.id
                      ? <Check className='w-3.5 h-3.5 text-[var(--ag-lime)]' />
                      : <Copy className='w-3.5 h-3.5' />
                    }
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
