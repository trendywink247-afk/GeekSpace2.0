import { memo, useState } from 'react';
import { motion } from 'framer-motion';
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
  javascript: { label: 'JavaScript', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  js: { label: 'JavaScript', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  typescript: { label: 'TypeScript', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  ts: { label: 'TypeScript', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  tsx: { label: 'TSX', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  jsx: { label: 'JSX', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  python: { label: 'Python', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  py: { label: 'Python', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  html: { label: 'HTML', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  css: { label: 'CSS', bg: 'bg-pink-500/15', text: 'text-pink-400' },
  json: { label: 'JSON', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  bash: { label: 'Bash', bg: 'bg-green-500/15', text: 'text-green-400' },
  sh: { label: 'Shell', bg: 'bg-green-500/15', text: 'text-green-400' },
  sql: { label: 'SQL', bg: 'bg-violet-500/15', text: 'text-violet-400' },
  rust: { label: 'Rust', bg: 'bg-orange-600/15', text: 'text-orange-300' },
  go: { label: 'Go', bg: 'bg-sky-500/15', text: 'text-sky-400' },
  java: { label: 'Java', bg: 'bg-red-500/15', text: 'text-red-400' },
  c: { label: 'C', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  cpp: { label: 'C++', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  yaml: { label: 'YAML', bg: 'bg-rose-500/15', text: 'text-rose-400' },
  yml: { label: 'YAML', bg: 'bg-rose-500/15', text: 'text-rose-400' },
  markdown: { label: 'Markdown', bg: 'bg-slate-500/15', text: 'text-slate-400' },
  md: { label: 'Markdown', bg: 'bg-slate-500/15', text: 'text-slate-400' },
  dockerfile: { label: 'Dockerfile', bg: 'bg-blue-600/15', text: 'text-blue-300' },
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
    <div className="relative my-2 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--ag-border-default)' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--ag-bg-deep)' }}>
        {langMeta ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${langMeta.bg} ${langMeta.text}`}>
            {langMeta.label}
          </span>
        ) : (
          <span className="text-xs text-[var(--ag-text-secondary)]">{lang || 'code'}</span>
        )}
        <button
          onClick={handleCopy}
          className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50',
            copied
              ? 'text-[var(--ag-green)] bg-[var(--ag-green)]/10'
              : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-cyan)]/10',
          ].join(' ')}
          title="Copy code"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed whitespace-pre font-mono" style={{ color: 'var(--ag-text-primary)', background: 'var(--ag-bg-deep)' }}><code>{code}</code></pre>
    </div>
  );
}

function renderMessageContent(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const fenceRegex = /```(\w*)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;
  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={keyIdx++} style={{ whiteSpace: 'pre-wrap' }}>{content.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<CodeBlock key={keyIdx++} lang={match[1] || ''} code={match[2] || ''} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={keyIdx++} style={{ whiteSpace: 'pre-wrap' }}>{content.slice(lastIndex)}</span>);
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
        className='flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)] transition-colors text-xs'
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
  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={['flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
    >
      {/* Agent avatar */}
      {msg.role === 'agent' && (
        <div className='relative shrink-0 self-start mt-0.5'>
          <div
            className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black relative z-10'
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
      <div
        className={[
          'max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed group/msg relative',
          msg.role === 'user'
            ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-text-primary)] rounded-tr-sm'
            : 'bg-[var(--ag-bg-surface)] backdrop-blur-xl text-[var(--ag-text-primary)] border border-[var(--ag-border-subtle)] rounded-tl-sm',
        ].join(' ')}
      >
        {/* Editing mode for user messages */}
        {isEditing ? (
          <div className='space-y-2'>
            <textarea
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              className='w-full bg-[var(--ag-bg-deep)] border border-[var(--ag-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--ag-text-primary)] resize-none focus:outline-none focus:border-[var(--ag-cyan)]/40 min-h-[60px]'
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onConfirmEdit();
                }
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
            <div className='flex items-center gap-2 justify-end'>
              <button
                onClick={onCancelEdit}
                className='px-2.5 py-1 rounded text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[28px]'
              >
                Cancel
              </button>
              <button
                onClick={onConfirmEdit}
                className='px-2.5 py-1 rounded text-xs bg-[var(--ag-cyan)]/20 text-[var(--ag-cyan)] hover:bg-[var(--ag-cyan)]/30 min-h-[28px]'
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Multi-agent: show which personality is speaking */}
            {msg.agentName && msg.role === 'agent' && (
              <div className='flex items-center gap-1.5 mb-1.5 -mt-0.5'>
                <span className='text-[11px] font-semibold' style={{ color: meta.color }}>{msg.agentEmoji || meta.initial}</span>
                <span className='text-[11px] font-semibold' style={{ color: meta.color }}>{msg.agentName}</span>
              </div>
            )}
            {/* Tool execution steps */}
            {msg.toolSteps && msg.toolSteps.length > 0 && (
              <div className='mb-2'>
                {msg.toolSteps.map((step) => (
                  <ToolStepCard key={step.id} step={step} />
                ))}
              </div>
            )}
            {msg.role === 'agent' ? renderMessageContent(msg.content) : (
              <>
                {msg.mentionedAgent && (
                  <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)] mb-1'>
                    <span>{msg.mentionedAgent.emoji}</span>
                    <span>{msg.mentionedAgent.name}</span>
                  </span>
                )}
                <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              </>
            )}
          </>
        )}

        {/* Footer: timestamp + action buttons */}
        {!isEditing && (
          <div className='flex items-center justify-between mt-1 gap-2'>
            {showTimestamp ? (
              <p className='text-[10px] text-[var(--ag-text-secondary)]/70' title={formatDateTime(msg.timestamp)}>
                {formatRelativeTime(msg.timestamp)}
              </p>
            ) : (
              <span />
            )}

            {/* Action buttons on AGENT messages */}
            {msg.role === 'agent' && msg.content && (
              <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity'>
                <button
                  onClick={() => onRegenerate(msg.id)}
                  className='p-1 rounded transition-colors text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] min-w-[28px] min-h-[28px] flex items-center justify-center'
                  title='Regenerate response'
                  aria-label='Regenerate response'
                  disabled={isTyping}
                >
                  <RefreshCw className='w-3 h-3' />
                </button>
                <button
                  onClick={() => onPinToNotes(msg.id, msg.content)}
                  className='p-1 rounded transition-colors text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] min-w-[28px] min-h-[28px] flex items-center justify-center'
                  title='Pin to notes'
                  aria-label='Pin to notes'
                >
                  <Pin className='w-3 h-3' />
                </button>
                <button
                  onClick={() => onFeedback(msg.id, 'up')}
                  className={[
                    'p-1 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center',
                    msgFeedback === 'up' ? 'text-[var(--ag-lime)]' : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-lime)]',
                  ].join(' ')}
                  title='Helpful'
                  aria-label='Mark as helpful'
                >
                  <ThumbsUp className='w-3 h-3' />
                </button>
                <button
                  onClick={() => onFeedback(msg.id, 'down')}
                  className={[
                    'p-1 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center',
                    msgFeedback === 'down' ? 'text-[var(--ag-pink)]' : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-pink)]',
                  ].join(' ')}
                  title='Not helpful'
                  aria-label='Mark as not helpful'
                >
                  <ThumbsDown className='w-3 h-3' />
                </button>
                <button
                  onClick={() => onCopyMessage(msg.id, msg.content)}
                  className='p-1 rounded transition-colors text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] min-w-[28px] min-h-[28px] flex items-center justify-center'
                  title='Copy message'
                  aria-label='Copy message'
                >
                  {copiedMsgId === msg.id ? <Check className='w-3 h-3 text-[var(--ag-lime)]' /> : <Copy className='w-3 h-3' />}
                </button>
              </div>
            )}

            {/* Action buttons on USER messages */}
            {msg.role === 'user' && msg.content && (
              <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity'>
                <button
                  onClick={() => onStartEdit(msg.id)}
                  className='p-1 rounded transition-colors text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] min-w-[28px] min-h-[28px] flex items-center justify-center'
                  title='Edit message'
                  aria-label='Edit message'
                  disabled={isTyping}
                >
                  <Pencil className='w-3 h-3' />
                </button>
                <button
                  onClick={() => onCopyMessage(msg.id, msg.content)}
                  className='p-1 rounded transition-colors text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] min-w-[28px] min-h-[28px] flex items-center justify-center'
                  title='Copy message'
                  aria-label='Copy message'
                >
                  {copiedMsgId === msg.id ? <Check className='w-3 h-3 text-[var(--ag-lime)]' /> : <Copy className='w-3 h-3' />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
