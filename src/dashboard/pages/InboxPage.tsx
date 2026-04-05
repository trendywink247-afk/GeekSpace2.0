// InboxPage.tsx — Glass inbox · shadows-over-borders · stagger · scale-on-press
// Owner: Aria (#FF6B9D) — design tokens: var(--ag-*) only, no hardcoded colours
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  Send, Archive, Trash2, AlertCircle, RefreshCw, Check,
  Inbox, ChevronDown, Clock, Sparkles, Eye, EyeOff, Keyboard,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import api from '@/services/api';
import { timeAgo as luxonTimeAgo } from '@/utils/dateFormat';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InboxMessage {
  id: number;
  source: string;
  sender: string | null;
  content: string;
  summary: string | null;
  priority: string;
  read: number;
  archived: number;
  suggested_reply: string | null;
  related_reminder_id: number | null;
  received_at: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  telegram: 'TG',
  whatsapp: 'WA',
  system: 'SYS',
};

const SOURCE_PILL: Record<string, string> = {
  telegram:  'bg-[var(--ag-violet)]/10 text-[var(--ag-violet)]',
  whatsapp:  'bg-[var(--ag-green)]/10  text-[var(--ag-green)]',
  system:    'bg-[var(--ag-text-muted)]/10 text-[var(--ag-text-secondary)]',
};

const PRIORITY_PILL: Record<string, string> = {
  urgent: 'bg-[var(--ag-pink)]/10  text-[var(--ag-pink)]',
  high:   'bg-[var(--ag-amber)]/10 text-[var(--ag-amber)]',
  normal: 'bg-[var(--ag-text-muted)]/8 text-[var(--ag-text-muted)]',
};

const FILTERS = ['all', 'unread', 'urgent', 'telegram', 'whatsapp', 'system'] as const;
type Filter = (typeof FILTERS)[number];

// ─── Shadow helpers (dark-mode pattern: white ring + depth) ──────────────────

function cardShadow(priority: string, unread: boolean): string {
  const ring   = '0 0 0 1px rgba(255,255,255,0.06)';
  const depth  = '0 1px 4px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)';
  const inset  = 'inset 0 1px 0 rgba(255,255,255,0.04)';
  const glow   = unread ? ', var(--ag-glow-sm)' : '';
  const left   = priority === 'urgent' ? ', inset 3px 0 0 var(--ag-pink)'
               : priority === 'high'   ? ', inset 3px 0 0 var(--ag-amber)'
               : '';
  return `${ring}, ${depth}, ${inset}${left}${glow}`;
}

function cardHoverShadow(priority: string, unread: boolean): string {
  const ring  = '0 0 0 1px rgba(255,255,255,0.10)';
  const depth = '0 4px 16px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.2)';
  const inset = 'inset 0 1px 0 rgba(255,255,255,0.06)';
  const glow  = unread ? ', var(--ag-glow-md)' : '';
  const left  = priority === 'urgent' ? ', inset 3px 0 0 var(--ag-pink)'
              : priority === 'high'   ? ', inset 3px 0 0 var(--ag-amber)'
              : '';
  return `${ring}, ${depth}, ${inset}${left}${glow}`;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const SPRING = { type: 'spring' as const, duration: 0.45, bounce: 0 };
const FAST   = { duration: 0.18, ease: 'easeIn' as const };

const FADE_UP = {
  hidden:  { opacity: 0, y: 14, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: SPRING },
  exit:    { opacity: 0, y: -8, scale: 0.97, filter: 'blur(4px)', transition: FAST },
};

const EXPAND = {
  hidden:  { opacity: 0, height: 0,      filter: 'blur(4px)' },
  visible: { opacity: 1, height: 'auto', filter: 'blur(0px)', transition: { ...SPRING, duration: 0.3 } },
  exit:    { opacity: 0, height: 0,      filter: 'blur(4px)', transition: { duration: 0.2, ease: 'easeIn' as const } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  return luxonTimeAgo(new Date(ms));
}

function priorityWeight(p: string): number {
  return p === 'urgent' ? 0 : p === 'high' ? 1 : 2;
}

// ─── Triage Summary ───────────────────────────────────────────────────────────

function TriageSummary({ messages }: { messages: InboxMessage[] }) {
  const total      = messages.length;
  const unread     = messages.filter(m => m.read === 0).length;
  const urgent     = messages.filter(m => m.priority === 'urgent').length;
  const canReply   = messages.filter(m => m.suggested_reply && m.read === 0).length;

  if (total === 0) return null;

  return (
    <motion.div
      variants={FADE_UP}
      style={{
        boxShadow: '0 0 0 1px var(--ag-glass-border), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        background: 'linear-gradient(135deg, rgba(255,107,157,0.05) 0%, rgba(139,92,246,0.06) 100%)',
      }}
      className="rounded-2xl backdrop-blur-xl p-4"
    >
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <div className="w-7 h-7 rounded-lg bg-[var(--ag-aria)]/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-[var(--ag-aria)]" />
        </div>
        <span className="font-semibold font-heading text-[var(--ag-text-primary)] [text-wrap:balance]">
          AI Triage
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {urgent > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ag-pink)]/10 text-[var(--ag-pink)] font-semibold tabular-nums">
              {urgent} urgent
            </span>
          )}
          {unread > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ag-aria)]/10 text-[var(--ag-aria)] font-semibold tabular-nums">
              {unread} unread
            </span>
          )}
          <span className="text-xs text-[var(--ag-text-muted)] tabular-nums">{total} total</span>
        </div>
      </div>
      {canReply > 0 && (
        <p className="text-xs text-[var(--ag-text-secondary)] pl-10 mt-2 [text-wrap:pretty]">
          AI suggests replies for {canReply} message{canReply > 1 ? 's' : ''}
        </p>
      )}
    </motion.div>
  );
}

// ─── Message Card ─────────────────────────────────────────────────────────────

interface MessageCardProps {
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

function MessageCard({
  msg, isExpanded, isFocused, replyText, isSending,
  onToggleExpand, onMarkRead, onArchive, onDelete,
  onReplyChange, onSendReply, onUseSuggestion, cardRef, staggerDelay,
}: MessageCardProps) {
  const isUnread   = msg.read === 0;
  const sourcePill = SOURCE_PILL[msg.source]  ?? SOURCE_PILL.system;
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

          {/* Timestamp */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
            <span className="text-[11px] text-[var(--ag-text-muted)] tabular-nums">
              {formatTime(msg.received_at)}
            </span>
            {/* Expand chevron */}
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

              {/* Quick reply */}
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

        {/* Mark read / unread */}
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

        {/* Archive */}
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

        {/* Snooze */}
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

        {/* Delete */}
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyInbox() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      style={{
        boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      className="rounded-2xl bg-[var(--ag-glass-bg)] backdrop-blur-xl p-8 sm:p-12"
    >
      <div className="flex flex-col items-center text-center space-y-5">
        <motion.div
          variants={FADE_UP}
          style={{ boxShadow: '0 0 0 1px var(--ag-glass-border), var(--ag-glow-sm)' }}
          className="w-16 h-16 rounded-2xl bg-[var(--ag-aria)]/[0.06] flex items-center justify-center"
        >
          <Inbox className="w-7 h-7 text-[var(--ag-aria)]/50" />
        </motion.div>

        <div className="space-y-1.5">
          <motion.p
            variants={FADE_UP}
            className="font-semibold text-lg font-heading text-[var(--ag-text-primary)] [text-wrap:balance]"
          >
            Your inbox is empty
          </motion.p>
          <motion.p
            variants={FADE_UP}
            className="text-sm text-[var(--ag-text-secondary)] max-w-xs leading-relaxed [text-wrap:pretty]"
          >
            Messages from your AI agents and integrations will appear here
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Keyboard Hints (desktop only — anti-pattern to show on mobile) ───────────

function KeyboardHints() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      className="hidden sm:flex items-center justify-center gap-4 py-3 text-[10px] text-[var(--ag-text-muted)]/50 select-none"
    >
      {[
        { keys: ['J', 'K'], label: 'navigate' },
        { keys: ['E'],      label: 'archive'  },
        { keys: ['R'],      label: 'reply'    },
        { keys: ['Enter'],  label: 'expand'   },
      ].map(({ keys, label }) => (
        <span key={label} className="inline-flex items-center gap-1">
          {keys.map(k => (
            <Kbd
              key={k}
              className="bg-white/5 text-[var(--ag-text-muted)]/50 border-0 h-4 min-w-4 text-[10px]"
            >
              {k}
            </Kbd>
          ))}
          {label}
        </span>
      ))}
    </motion.div>
  );
}

// ─── Loading Skeletons ────────────────────────────────────────────────────────

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay } }}
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 1px 4px rgba(0,0,0,0.35)' }}
      className="rounded-2xl bg-[var(--ag-glass-bg)] backdrop-blur-xl p-4 space-y-3 animate-pulse"
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-28 bg-white/5 rounded-lg" />
        <div className="h-4 w-8  bg-white/5 rounded-md" />
        <div className="ml-auto h-3 w-12 bg-white/5 rounded-lg" />
      </div>
      <div className="h-3.5 w-3/4 bg-white/5 rounded-lg" />
      <div className="h-3.5 w-1/2 bg-white/5 rounded-lg" />
      <div className="h-8 w-full bg-white/[0.03] rounded-xl mt-1" />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboxPage({ shell: _shell = true }: { shell?: boolean } = {}) {
  const [messages,  setMessages]  = useState<InboxMessage[]>([]);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [replyMap,  setReplyMap]  = useState<Record<number, string>>({});
  const [sending,   setSending]   = useState<number | null>(null);
  const [err,       setErr]       = useState<string | null>(null);
  const [focusIdx,  setFocusIdx]  = useState(-1);
  const [showKbHints, setShowKbHints] = useState(false);

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'aria', page: 'inbox' });

  // ── Data fetching ──

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (filter === 'unread')       params.unreadOnly = 'true';
      else if (filter === 'urgent')  params.priority   = 'urgent';
      else if (filter !== 'all')     params.source     = filter;
      const res = await api.get('/inbox', { params });
      setMessages(res.data.messages ?? []);
    } catch {
      setErr('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    const id = setInterval(() => { void fetchMessages(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // ── Sorted list ──

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      if (a.read !== b.read) return a.read - b.read;
      const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pw !== 0) return pw;
      return b.received_at - a.received_at;
    });
  }, [messages]);

  // ── Actions ──

  const handleMarkRead = async (id: number) => {
    try {
      await api.patch('/inbox/' + id + '/read');
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read: 1 } : m));
      void notifyDone('message marked as read');
    } catch {
      void notifyFail('failed to mark message read');
    }
  };

  const handleArchive = useCallback(async (id: number) => {
    try {
      await api.patch('/inbox/' + id + '/archive');
      setMessages(prev => prev.filter(m => m.id !== id));
      void notifyDone('message archived');
    } catch {
      void notifyFail('failed to archive message');
    }
  }, [notifyDone, notifyFail]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete('/inbox/' + id);
      setMessages(prev => prev.filter(m => m.id !== id));
      void notifyDone('message deleted');
    } catch {
      void notifyFail('failed to delete message');
    }
  };

  const handleReply = async (msg: InboxMessage) => {
    const text = replyMap[msg.id];
    if (!text?.trim()) return;
    setSending(msg.id);
    try {
      await api.post('/inbox/' + msg.id + '/reply', { text });
      const next = { ...replyMap };
      delete next[msg.id];
      setReplyMap(next);
      void handleMarkRead(msg.id);
      void notifyDone(`reply sent to ${msg.sender ?? msg.source}`);
    } catch {
      setErr('Failed to send reply');
      void notifyFail('failed to send reply');
    } finally {
      setSending(null);
    }
  };

  // ── Keyboard navigation ──

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      const len = sortedMessages.length;
      if (len === 0) return;

      switch (e.key) {
        case 'j': case 'J': {
          e.preventDefault();
          const next = Math.min(focusIdx + 1, len - 1);
          setFocusIdx(next);
          cardRefs.current.get(sortedMessages[next].id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          break;
        }
        case 'k': case 'K': {
          e.preventDefault();
          const prev = Math.max(focusIdx - 1, 0);
          setFocusIdx(prev);
          cardRefs.current.get(sortedMessages[prev].id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          break;
        }
        case 'Enter': {
          if (focusIdx >= 0 && focusIdx < len) {
            e.preventDefault();
            const id = sortedMessages[focusIdx].id;
            setExpanded(expanded === id ? null : id);
          }
          break;
        }
        case 'e': case 'E': {
          if (focusIdx >= 0 && focusIdx < len) {
            e.preventDefault();
            void handleArchive(sortedMessages[focusIdx].id);
          }
          break;
        }
        case 'r': case 'R': {
          if (focusIdx >= 0 && focusIdx < len) {
            e.preventDefault();
            const id = sortedMessages[focusIdx].id;
            setExpanded(id);
            requestAnimationFrame(() => {
              cardRefs.current.get(id)?.querySelector('textarea')?.focus();
            });
          }
          break;
        }
        case '?': {
          e.preventDefault();
          setShowKbHints(h => !h);
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusIdx, sortedMessages, expanded, handleArchive]);

  const unreadCount = messages.filter(m => m.read === 0).length;

  // ── Render ──

  return (
    <DashboardPageWrapper>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="space-y-5 pb-24 md:pb-6"
      >
        {/* Page header */}
        <motion.div variants={FADE_UP}>
          <PageHeader
            icon={Inbox}
            title="AI Inbox"
            subtitle="Triaged by Aria"
            badge={
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--ag-aria)]/10 text-[var(--ag-aria)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-aria)] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--ag-aria)]" />
                </span>
                Aria
              </span>
            }
            actions={
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <Badge className="bg-[var(--ag-aria)]/15 text-[var(--ag-aria)] border-0 text-xs font-bold tabular-nums">
                    {unreadCount}
                  </Badge>
                )}
                {/* Keyboard shortcuts toggle — desktop only */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowKbHints(h => !h)}
                      aria-label="Keyboard shortcuts"
                      className="hidden sm:flex p-2 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-[color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                    >
                      <Keyboard className="w-4 h-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => void fetchMessages()}
                      aria-label="Refresh inbox"
                      className={[
                        'p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] transition-[color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50',
                        loading ? 'animate-spin' : '',
                      ].join(' ')}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </div>
            }
          />
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {err && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)', transition: FAST }}
              style={{ boxShadow: '0 0 0 1px rgba(255,45,120,0.2), 0 2px 8px rgba(255,45,120,0.08)' }}
              className="flex items-center gap-2.5 text-[var(--ag-pink)] bg-[var(--ag-pink)]/[0.07] rounded-2xl p-3.5 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 [text-wrap:pretty]">{err}</span>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setErr(null)}
                className="text-[var(--ag-pink)]/60 hover:text-[var(--ag-pink)] min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors duration-150"
              >
                <Check className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Triage summary */}
        {!loading && <TriageSummary messages={messages} />}

        {/* Filter tabs */}
        <motion.div variants={FADE_UP}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          >
            {FILTERS.map((f) => {
              const isActive  = filter === f;
              const urgentCnt = f === 'urgent' ? messages.filter(m => m.priority === 'urgent').length : 0;
              return (
                <motion.button
                  key={f}
                  variants={FADE_UP}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { setFilter(f); setFocusIdx(-1); }}
                  style={isActive ? {
                    boxShadow: '0 0 0 1px var(--ag-border-active), var(--ag-glow-sm)',
                  } : {}}
                  className={[
                    'px-3 py-1.5 rounded-xl text-sm font-semibold font-heading whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 shrink-0',
                    isActive
                      ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)]'
                      : 'bg-white/[0.04] text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-white/[0.08]',
                  ].join(' ')}
                >
                  {f === 'urgent' ? 'Urgent' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {urgentCnt > 0 && (
                    <span className="ml-1.5 text-[10px] tabular-nums bg-[var(--ag-pink)]/15 text-[var(--ag-pink)] px-1.5 py-0.5 rounded-md">
                      {urgentCnt}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-2.5">
            {[0, 1, 2].map(i => <SkeletonCard key={i} delay={i * 0.07} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && sortedMessages.length === 0 && (
          <motion.div variants={FADE_UP}>
            <EmptyInbox />
          </motion.div>
        )}

        {/* Message list with AnimatePresence for exit animations */}
        {!loading && sortedMessages.length > 0 && (
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {sortedMessages.map((msg, idx) => (
                <MessageCard
                  key={msg.id}
                  msg={msg}
                  isExpanded={expanded === msg.id}
                  isFocused={focusIdx === idx}
                  replyText={replyMap[msg.id] ?? ''}
                  isSending={sending === msg.id}
                  staggerDelay={Math.min(idx * 0.05, 0.4)}
                  onToggleExpand={() => {
                    setExpanded(expanded === msg.id ? null : msg.id);
                    setFocusIdx(idx);
                  }}
                  onMarkRead={() => void handleMarkRead(msg.id)}
                  onArchive={() => void handleArchive(msg.id)}
                  onDelete={() => void handleDelete(msg.id)}
                  onReplyChange={(text) => setReplyMap({ ...replyMap, [msg.id]: text })}
                  onSendReply={() => void handleReply(msg)}
                  onUseSuggestion={() => setReplyMap({ ...replyMap, [msg.id]: msg.suggested_reply ?? '' })}
                  cardRef={(el) => {
                    if (el) cardRefs.current.set(msg.id, el);
                    else cardRefs.current.delete(msg.id);
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Keyboard shortcuts panel */}
        <AnimatePresence>
          {showKbHints && <KeyboardHints key="kbhints" />}
        </AnimatePresence>

        {/* Subtle hint */}
        {!showKbHints && sortedMessages.length > 0 && (
          <motion.p
            variants={FADE_UP}
            className="hidden sm:block text-center text-[10px] text-[var(--ag-text-muted)]/35 select-none"
          >
            Press{' '}
            <span className="text-[var(--ag-text-muted)]/55">?</span>
            {' '}for keyboard shortcuts
          </motion.p>
        )}
      </motion.div>
    </DashboardPageWrapper>
  );
}
