// inbox/MessageCard.tsx — single message card with expand, reply, and actions
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Archive, Trash2, Clock, Sparkles, Eye, EyeOff, ChevronDown,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { InboxMessage } from './helpers';
import {
  SOURCE_LABELS, SOURCE_PILL, PRIORITY_PILL,
  cardShadow, cardHoverShadow,
  SPRING, FAST, EXPAND,
  formatTime,
} from './helpers';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MessageCardProps {
  msg: InboxMessage;
  isExpanded: boolean;
  isFocused: boolean;
  replyText: string;
  isSending: boolean;
  onToggleExpand: () => void;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReplyChange: (text: string) => void;
  onSendReply: () => void;
  onUseSuggestion: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
  staggerDelay: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageCard({
  msg, isExpanded, isFocused, replyText, isSending,
  onToggleExpand, onMarkRead, onArchive, onDelete,
  onReplyChange, onSendReply, onUseSuggestion, cardRef, staggerDelay,
}: MessageCardProps) {
  const isUnread   = msg.read === 0;
  const sourcePill = SOURCE_PILL[msg.source]     ?? SOURCE_PILL.system;
  const priPill    = PRIORITY_PILL[msg.priority] ?? PRIORITY_PILL.normal;
  const baseShadow = cardShadow(msg.priority, isUnread);
  const hovShadow  = cardHoverShadow(msg.priority, isUnread);

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{
        opacity: isUnread ? 1 : 0.72,
        y: 0,
        filter: 'blur(0px)',
        transition: { ...SPRING, delay: staggerDelay },
      }}
      exit={{ opacity: 0, y: -8, scale: 0.97, filter: 'blur(4px)', transition: FAST }}
      whileHover={{ boxShadow: hovShadow }}
      whileTap={{ scale: 0.96 }}
      style={{ boxShadow: baseShadow }}
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); }
      }}
      className={[
        'rounded-2xl outline-none cursor-pointer select-none',
        'bg-[var(--ag-glass-bg)] backdrop-blur-xl',
        'transition-[opacity] duration-200',
        isFocused ? 'ring-2 ring-[var(--ag-aria)]/35 ring-offset-1 ring-offset-transparent' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* ── Header row ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-2">
          {/* Unread dot */}
          {isUnread && (
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ag-aria)] shrink-0 animate-pulse" />
          )}

          {/* Sender + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={[
                'text-sm font-heading truncate max-w-[140px] sm:max-w-none',
                isUnread
                  ? 'font-semibold text-[var(--ag-text-primary)]'
                  : 'font-medium text-[var(--ag-text-secondary)]',
              ].join(' ')}>
                {msg.sender ?? msg.source}
              </span>

              {/* Source pill */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${sourcePill}`}>
                {SOURCE_LABELS[msg.source] ?? msg.source.toUpperCase()}
              </span>

              {/* Priority pill (urgent / high only) */}
              {msg.priority !== 'normal' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md capitalize ${priPill}`}>
                  {msg.priority}
                </span>
              )}
            </div>

            {/* Preview */}
            <p className={[
              'text-sm leading-relaxed [text-wrap:pretty]',
              isExpanded ? '' : 'line-clamp-2',
              isUnread ? 'text-[var(--ag-text-primary)]/80' : 'text-[var(--ag-text-secondary)]',
            ].join(' ')}>
              {msg.summary ?? msg.content}
            </p>
          </div>

          {/* Timestamp + chevron */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
            <span className="text-[11px] text-[var(--ag-text-muted)] tabular-nums">
              {formatTime(msg.received_at)}
            </span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              className="text-[var(--ag-text-muted)]"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Expanded content ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            variants={EXPAND}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="region"
            aria-label="Message details"
            className="overflow-hidden"
          >
            <div
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
              className="px-4 pt-3 pb-4 space-y-3"
            >
              {/* Full message text */}
              <p className="text-sm text-[var(--ag-text-primary)]/90 whitespace-pre-wrap leading-relaxed [text-wrap:pretty]">
                {msg.content}
              </p>

              {/* AI Suggested Reply */}
              {msg.suggested_reply && (
                <div
                  style={{ boxShadow: '0 0 0 1px var(--ag-border-glow), inset 0 1px 0 rgba(255,255,255,0.04)' }}
                  className="bg-[var(--ag-violet)]/[0.06] rounded-xl p-3"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-5 h-5 rounded-md bg-[var(--ag-violet)]/15 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-[var(--ag-violet)]" />
                    </div>
                    <p className="text-xs font-semibold font-heading text-[var(--ag-violet)]">
                      AI Suggested Reply
                    </p>
                  </div>
                  <p className="text-sm text-[var(--ag-text-primary)]/70 leading-relaxed [text-wrap:pretty]">
                    {msg.suggested_reply}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onUseSuggestion}
                    className="mt-2.5 text-xs font-semibold font-heading text-[var(--ag-violet)] hover:text-[var(--ag-cyan)] transition-colors duration-150 min-h-[36px] flex items-center"
                  >
                    Use this reply →
                  </motion.button>
                </div>
              )}

              {/* Quick reply textarea */}
              {(msg.source === 'telegram' || msg.source === 'whatsapp') && (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={e => onReplyChange(e.target.value)}
                    placeholder="Type a reply…"
                    rows={3}
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 2px rgba(0,0,0,0.3)' }}
                    className="w-full bg-[var(--ag-bg-deep)]/60 rounded-xl px-3 py-2.5 text-sm text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/30 resize-none transition-[box-shadow] duration-150 min-h-[44px]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--ag-text-muted)] [text-wrap:pretty]">
                      {msg.suggested_reply ? 'Edit suggestion or write your own' : 'Write a reply'}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={onSendReply}
                      disabled={isSending || !replyText.trim()}
                      style={{
                        boxShadow: replyText.trim()
                          ? '0 2px 8px rgba(139,92,246,0.25), 0 0 0 1px rgba(139,92,246,0.3)'
                          : 'none',
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/90 text-white rounded-xl text-sm font-semibold font-heading disabled:opacity-35 transition-[opacity,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSending ? 'Sending…' : 'Send'}
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action row ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="toolbar"
        aria-label="Message actions"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        className="flex items-center gap-0.5 px-3 pb-2.5 pt-2"
      >
        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onMarkRead}
              aria-label={isUnread ? 'Mark as read' : 'Mark as unread'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--ag-text-muted)] hover:text-[var(--ag-lime)] hover:bg-[var(--ag-lime)]/8 transition-[color,background-color] duration-150"
            >
              {isUnread
                ? <Eye    className="w-3.5 h-3.5" />
                : <EyeOff className="w-3.5 h-3.5" />
              }
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>{isUnread ? 'Mark read' : 'Mark unread'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onArchive}
              aria-label="Archive"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--ag-text-muted)] hover:text-[var(--ag-amber)] hover:bg-[var(--ag-amber)]/8 transition-[color,background-color] duration-150"
            >
              <Archive className="w-3.5 h-3.5" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { /* snooze — future */ }}
              aria-label="Snooze"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--ag-text-muted)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/8 transition-[color,background-color] duration-150"
            >
              <Clock className="w-3.5 h-3.5" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>Snooze</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onDelete}
              aria-label="Delete"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)] hover:bg-[var(--ag-pink)]/8 transition-[color,background-color] duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}
