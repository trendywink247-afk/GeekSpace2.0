// InboxPage.tsx -- Overhauled AI Inbox with triage, priority cards, keyboard nav
// Owner: Aria (#FF6B9D) -- design tokens: #06061a bg, rgba(12,12,30,0.6) surface
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  Send, Archive, Trash2, AlertCircle,
  RefreshCw, Check, Inbox, ChevronDown, ChevronUp,
  Clock, Sparkles, Eye, EyeOff, Keyboard,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import api from '@/services/api';
import { timeAgo as luxonTimeAgo } from '@/utils/dateFormat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  telegram: 'TG',
  whatsapp: 'WA',
  system: 'SYS',
};

const SOURCE_BADGE_CLASSES: Record<string, string> = {
  telegram: 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] border-[var(--ag-violet)]/25',
  whatsapp: 'bg-[var(--ag-green)]/15 text-[var(--ag-green)] border-[var(--ag-green)]/25',
  system: 'bg-[var(--ag-text-secondary)]/15 text-[var(--ag-text-secondary)] border-[var(--ag-text-secondary)]/25',
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-2 border-l-[var(--ag-pink)]',
  high: 'border-l-2 border-l-[var(--ag-amber)]',
  normal: '',
};

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  urgent: 'bg-[var(--ag-pink)]/15 text-[var(--ag-pink)] border-[var(--ag-pink)]/30',
  high: 'bg-[var(--ag-amber)]/15 text-[var(--ag-amber)] border-[var(--ag-amber)]/30',
  normal: 'bg-[var(--ag-text-muted)]/10 text-[var(--ag-text-secondary)] border-[var(--ag-text-muted)]/20',
};

const FILTERS = ['all', 'unread', 'urgent', 'telegram', 'whatsapp', 'system'] as const;
type Filter = (typeof FILTERS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number): string {
  return luxonTimeAgo(new Date(ms));
}

function priorityWeight(p: string): number {
  if (p === 'urgent') return 0;
  if (p === 'high') return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Triage Summary
// ---------------------------------------------------------------------------

interface TriageSummaryProps {
  messages: InboxMessage[];
}

function TriageSummary({ messages }: TriageSummaryProps) {
  const total = messages.length;
  const unread = messages.filter(m => m.read === 0).length;
  const urgent = messages.filter(m => m.priority === 'urgent').length;
  const suggestReply = messages.filter(m => m.suggested_reply && m.read === 0).length;

  if (total === 0) return null;

  return (
    <BlurFade delay={0.1}>
      <SectionCard className="bg-gradient-to-r from-[var(--ag-aria)]/[0.04] to-[var(--ag-violet)]/[0.04]" padding="sm">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <Sparkles className="w-4 h-4 text-[var(--ag-aria)] shrink-0" />
          <span className="text-[var(--ag-text-primary)] font-medium font-heading">AI Triage:</span>
          {urgent > 0 && (
            <span className="text-[var(--ag-pink)] font-semibold">{urgent} urgent</span>
          )}
          {urgent > 0 && unread > 0 && (
            <span className="text-[var(--ag-text-muted)]">&middot;</span>
          )}
          {unread > 0 && (
            <span className="text-[var(--ag-aria)] font-semibold">{unread} unread</span>
          )}
          <span className="text-[var(--ag-text-muted)]">&middot;</span>
          <span className="text-[var(--ag-text-secondary)]">{total} total</span>
        </div>
        {suggestReply > 0 && (
          <p className="text-xs text-[var(--ag-text-secondary)] pl-7 mt-2">
            AI suggests: Reply to {suggestReply} message{suggestReply > 1 ? 's' : ''}
          </p>
        )}
      </SectionCard>
    </BlurFade>
  );
}

// ---------------------------------------------------------------------------
// Message Card
// ---------------------------------------------------------------------------

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
}

function MessageCard({
  msg, isExpanded, isFocused, replyText, isSending,
  onToggleExpand, onMarkRead, onArchive, onDelete,
  onReplyChange, onSendReply, onUseSuggestion, cardRef,
}: MessageCardProps) {
  const isUnread = msg.read === 0;
  const priorityBorder = PRIORITY_BORDER[msg.priority] ?? '';
  const sourceBadge = SOURCE_BADGE_CLASSES[msg.source] ?? SOURCE_BADGE_CLASSES.system;
  const priorityBadge = PRIORITY_BADGE_CLASSES[msg.priority] ?? PRIORITY_BADGE_CLASSES.normal;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
      className={[
        'rounded-xl border transition-all duration-200 outline-none group',
        'bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]',
        'hover:border-[var(--ag-border-default)]',
        priorityBorder,
        isFocused ? 'ring-1 ring-[var(--ag-aria)]/40' : '',
        isUnread ? 'shadow-[var(--ag-glow-sm)]' : 'opacity-80',
      ].filter(Boolean).join(' ')}
    >
      {/* Header row */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 mb-1.5">
          {/* Sender name */}
          <span className={[
            'text-sm truncate max-w-[180px] sm:max-w-none font-heading',
            isUnread ? 'font-semibold text-[var(--ag-text-primary)]' : 'font-medium text-[var(--ag-text-secondary)]',
          ].join(' ')}>
            {msg.sender ?? msg.source}
          </span>

          {/* Source badge */}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${sourceBadge}`}>
            {SOURCE_LABELS[msg.source] ?? msg.source.toUpperCase()}
          </span>

          {/* Priority badge (urgent/high only) */}
          {msg.priority !== 'normal' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${priorityBadge}`}>
              {msg.priority}
            </span>
          )}

          {/* Unread dot */}
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-[var(--ag-aria)] shrink-0 animate-pulse" />
          )}

          {/* Timestamp */}
          <span className="text-xs text-[var(--ag-text-secondary)] ml-auto shrink-0">
            {formatTime(msg.received_at)}
          </span>
        </div>

        {/* Message preview */}
        <p className={[
          'text-sm line-clamp-2 leading-relaxed',
          isUnread ? 'text-[var(--ag-text-primary)]/80' : 'text-[var(--ag-text-secondary)]',
        ].join(' ')}>
          {msg.summary ?? msg.content}
        </p>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="px-4 pb-3 space-y-3 border-t border-[var(--ag-border-subtle)] pt-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="region"
          aria-label="Message details"
        >
          {/* Full content */}
          <p className="text-sm text-[var(--ag-text-primary)]/90 whitespace-pre-wrap leading-relaxed">{msg.content}</p>

          {/* AI Suggested Reply */}
          {msg.suggested_reply && (
            <div className="bg-[#8B5CF6]/8 border border-[var(--ag-violet)]/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-[var(--ag-violet)]" />
                <p className="text-xs text-[var(--ag-violet)] font-medium font-heading">AI Suggested Reply</p>
              </div>
              <p className="text-sm text-[var(--ag-text-primary)]/70">{msg.suggested_reply}</p>
              <button
                onClick={onUseSuggestion}
                className="mt-2 text-xs text-[var(--ag-violet)] hover:text-[var(--ag-cyan)] transition-colors font-medium min-h-[44px] flex items-center"
              >
                Use this reply
              </button>
            </div>
          )}

          {/* Quick reply inline */}
          {(msg.source === 'telegram' || msg.source === 'whatsapp') && (
            <div className="space-y-2">
              <textarea
                value={replyText}
                onChange={e => onReplyChange(e.target.value)}
                placeholder="Type a reply..."
                rows={3}
                className="w-full min-h-[44px] bg-white/5 border border-[var(--ag-border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--ag-text-primary)] placeholder-[var(--ag-text-muted)]/60 focus:outline-none focus:border-[var(--ag-border-default)] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/20 resize-none transition-colors"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--ag-text-secondary)]">
                  {msg.suggested_reply ? 'Edit the suggestion above or write your own' : 'Write your reply'}
                </span>
                <button
                  onClick={onSendReply}
                  disabled={isSending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/80 hover:to-[var(--ag-amber)]/80 text-white rounded-lg text-sm font-medium font-heading disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions row */}
      <div
        className="flex items-center gap-1 px-4 pb-3 pt-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="toolbar"
        aria-label="Message actions"
      >
        {/* Expand/collapse */}
        <button
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 px-2 min-h-[44px] text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors rounded-md hover:bg-white/5"
        >
          {isExpanded ? (
            <><ChevronUp className="w-3 h-3" /> Less</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> More</>
          )}
        </button>

        <div className="flex-1" />

        {/* Mark read / unread */}
        {isUnread ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMarkRead}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-lime)] transition-colors"
                aria-label="Mark as read"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Mark read</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onMarkRead}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-aria)] transition-colors"
                aria-label="Already read"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Read</TooltipContent>
          </Tooltip>
        )}

        {/* Archive */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onArchive}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-amber)] transition-colors"
              aria-label="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>

        {/* Snooze */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {/* snooze handler -- future */}}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] transition-colors"
              aria-label="Snooze"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Snooze</TooltipContent>
        </Tooltip>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDelete}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-pink)] transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyInbox() {
  return (
    <BlurFade delay={0.2}>
      <SectionCard padding="lg">
        <div className="text-center py-12 space-y-4">
          <BlurFade delay={0.3}>
            <div className="w-16 h-16 rounded-2xl bg-[var(--ag-aria)]/5 border border-[var(--ag-aria)]/10 flex items-center justify-center mx-auto">
              <Inbox className="w-8 h-8 text-[var(--ag-aria)]/40" />
            </div>
          </BlurFade>
          <div className="space-y-2">
            <BlurFade delay={0.4}>
              <p className="text-[var(--ag-text-primary)] font-semibold text-lg font-heading">Your inbox is empty</p>
            </BlurFade>
            <BlurFade delay={0.5}>
              <p className="text-[var(--ag-text-secondary)] text-sm max-w-xs mx-auto leading-relaxed">
                Messages from your AI agents and integrations will appear here
              </p>
            </BlurFade>
          </div>
        </div>
      </SectionCard>
    </BlurFade>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Bar
// ---------------------------------------------------------------------------

function KeyboardHints() {
  return (
    <BlurFade delay={0.6}>
      <div className="flex items-center justify-center gap-4 py-3 text-[10px] text-[var(--ag-text-muted)]/60 select-none">
        <span className="inline-flex items-center gap-1">
          <Kbd className="bg-white/5 text-[var(--ag-text-muted)]/60 border-0 h-4 min-w-4 text-[10px]">J</Kbd>
          <Kbd className="bg-white/5 text-[var(--ag-text-muted)]/60 border-0 h-4 min-w-4 text-[10px]">K</Kbd>
          navigate
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd className="bg-white/5 text-[var(--ag-text-muted)]/60 border-0 h-4 min-w-4 text-[10px]">E</Kbd>
          archive
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd className="bg-white/5 text-[var(--ag-text-muted)]/60 border-0 h-4 min-w-4 text-[10px]">R</Kbd>
          reply
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd className="bg-white/5 text-[var(--ag-text-muted)]/60 border-0 h-4 min-w-4 text-[10px]">Enter</Kbd>
          expand
        </span>
      </div>
    </BlurFade>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function InboxPage({ shell: _shell = true }: { shell?: boolean } = {}) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [replyMap, setReplyMap] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [showKbHints, setShowKbHints] = useState(false);

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ---- Agent canvas (aria owns this page) ----
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'aria', page: 'inbox' });

  // ---- Data fetching ----

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (filter === 'unread') params.unreadOnly = 'true';
      else if (filter === 'urgent') params.priority = 'urgent';
      else if (filter !== 'all') params.source = filter;
      const res = await api.get('/inbox', { params });
      setMessages(res.data.messages ?? []);
    } catch {
      setErr('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Auto-refresh every 30s so new messages appear without manual reload
  useEffect(() => {
    const interval = setInterval(() => { void fetchMessages(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // ---- Sorted/filtered list ----

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      // Unread first
      if (a.read !== b.read) return a.read - b.read;
      // Then by priority
      const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pw !== 0) return pw;
      // Then newest first
      return b.received_at - a.received_at;
    });
  }, [messages]);

  // ---- Actions ----

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
      const updMap = { ...replyMap };
      delete updMap[msg.id];
      setReplyMap(updMap);
      handleMarkRead(msg.id);
      void notifyDone(`reply sent to ${msg.sender ?? msg.source}`);
    } catch {
      setErr('Failed to send reply');
      void notifyFail('failed to send reply');
    } finally {
      setSending(null);
    }
  };

  // ---- Keyboard navigation ----

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Don't intercept when typing in inputs/textareas
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const len = sortedMessages.length;
      if (len === 0) return;

      switch (e.key) {
        case 'j':
        case 'J': {
          e.preventDefault();
          const next = Math.min(focusIdx + 1, len - 1);
          setFocusIdx(next);
          const el = cardRefs.current.get(sortedMessages[next].id);
          el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          break;
        }
        case 'k':
        case 'K': {
          e.preventDefault();
          const prev = Math.max(focusIdx - 1, 0);
          setFocusIdx(prev);
          const el = cardRefs.current.get(sortedMessages[prev].id);
          el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
        case 'e':
        case 'E': {
          if (focusIdx >= 0 && focusIdx < len) {
            e.preventDefault();
            handleArchive(sortedMessages[focusIdx].id);
          }
          break;
        }
        case 'r':
        case 'R': {
          if (focusIdx >= 0 && focusIdx < len) {
            e.preventDefault();
            const id = sortedMessages[focusIdx].id;
            setExpanded(id);
            // Focus reply textarea after expansion
            requestAnimationFrame(() => {
              const el = cardRefs.current.get(id);
              const textarea = el?.querySelector('textarea');
              textarea?.focus();
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusIdx, sortedMessages, expanded, handleArchive]);

  // ---- Triage stats ----

  const unreadCount = messages.filter(m => m.read === 0).length;

  // ---- Render ----

  return (
    <DashboardPageWrapper>
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Page header -- Aria ownership dot */}
      <PageHeader
        icon={Inbox}
        title="AI Inbox"
        subtitle="Triaged by Aria"
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-aria)]/10 border border-[var(--ag-aria)]/30 text-[var(--ag-aria)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-aria)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-aria)]" />
            </span>
            Aria
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge className="bg-[var(--ag-aria)]/15 text-[var(--ag-aria)] border-[var(--ag-aria)]/25 text-xs font-bold animate-pulse">
                {unreadCount}
              </Badge>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowKbHints(h => !h)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>
            <button
              onClick={fetchMessages}
              className={[
                'p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50',
                loading ? 'animate-spin' : '',
              ].join(' ')}
              aria-label="Refresh inbox"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Error banner */}
      {err && (
        <BlurFade delay={0.05}>
          <div className="flex items-center gap-2 text-[var(--ag-pink)] bg-[var(--ag-pink)]/10 border border-[var(--ag-pink)]/20 rounded-xl p-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{err}</span>
            <button onClick={() => setErr(null)} className="text-[var(--ag-pink)]/60 hover:text-[var(--ag-pink)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </BlurFade>
      )}

      {/* AI triage summary */}
      {!loading && <TriageSummary messages={messages} />}

      {/* Filters */}
      <BlurFade delay={0.15}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f, index) => (
            <BlurFade key={f} delay={0.2 + index * 0.02}>
              <button
                onClick={() => { setFilter(f); setFocusIdx(-1); }}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium font-heading whitespace-nowrap transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50',
                  filter === f
                    ? 'bg-[var(--ag-aria)]/15 text-[var(--ag-aria)] border border-[var(--ag-aria)]/25'
                    : 'bg-white/5 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/10',
                ].join(' ')}
              >
                {f === 'urgent' ? 'Urgent' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'urgent' && messages.filter(m => m.priority === 'urgent').length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-[var(--ag-pink)]/20 text-[var(--ag-pink)] px-1 py-0.5 rounded">
                    {messages.filter(m => m.priority === 'urgent').length}
                  </span>
                )}
              </button>
            </BlurFade>
          ))}
        </div>
      </BlurFade>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <BlurFade key={i} delay={0.1 + i * 0.05}>
              <div className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-xl p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-white/5 rounded" />
                  <div className="h-4 w-10 bg-white/5 rounded" />
                  <div className="ml-auto h-3 w-12 bg-white/5 rounded" />
                </div>
                <div className="h-4 w-3/4 bg-white/5 rounded" />
                <div className="h-4 w-1/2 bg-white/5 rounded" />
              </div>
            </BlurFade>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sortedMessages.length === 0 && <EmptyInbox />}

      {/* Message list */}
      {!loading && sortedMessages.length > 0 && (
        <div className="space-y-2">
          {sortedMessages.map((msg, idx) => (
            <BlurFade key={msg.id} delay={0.25 + idx * 0.03}>
              <MessageCard
                msg={msg}
                isExpanded={expanded === msg.id}
                isFocused={focusIdx === idx}
                replyText={replyMap[msg.id] ?? ''}
                isSending={sending === msg.id}
                onToggleExpand={() => {
                  setExpanded(expanded === msg.id ? null : msg.id);
                  setFocusIdx(idx);
                }}
                onMarkRead={() => handleMarkRead(msg.id)}
                onArchive={() => handleArchive(msg.id)}
                onDelete={() => handleDelete(msg.id)}
                onReplyChange={(text) => setReplyMap({ ...replyMap, [msg.id]: text })}
                onSendReply={() => handleReply(msg)}
                onUseSuggestion={() => setReplyMap({ ...replyMap, [msg.id]: msg.suggested_reply ?? '' })}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(msg.id, el);
                  else cardRefs.current.delete(msg.id);
                }}
              />
            </BlurFade>
          ))}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {showKbHints && <KeyboardHints />}

      {/* Subtle always-visible shortcut hint */}
      {!showKbHints && sortedMessages.length > 0 && (
        <BlurFade delay={0.7}>
          <p className="text-center text-[10px] text-[var(--ag-text-muted)]/40 select-none">
            Press <span className="text-[var(--ag-text-muted)]/60">?</span> for keyboard shortcuts
          </p>
        </BlurFade>
      )}
    </div>
    </DashboardPageWrapper>
  );
}
