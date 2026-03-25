// InboxPage.tsx -- Overhauled AI Inbox with triage, priority cards, keyboard nav
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  telegram: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  whatsapp: 'bg-green-500/15 text-green-400 border-green-500/25',
  system: 'bg-[#8892A4]/15 text-[#8892A4] border-[#8892A4]/25',
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-2 border-l-red-500',
  high: 'border-l-2 border-l-amber-500',
  normal: '',
};

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  normal: 'bg-[#8892A4]/10 text-[#8892A4] border-[#8892A4]/20',
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
    <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <Sparkles className="w-4 h-4 text-[#00F0FF] shrink-0" />
        <span className="text-[#F4F6FF] font-medium">AI Triage:</span>
        {urgent > 0 && (
          <span className="text-[#FF2D78] font-semibold">{urgent} urgent</span>
        )}
        {urgent > 0 && unread > 0 && (
          <span className="text-[#8892A4]">&middot;</span>
        )}
        {unread > 0 && (
          <span className="text-[#00F0FF] font-semibold">{unread} unread</span>
        )}
        <span className="text-[#8892A4]">&middot;</span>
        <span className="text-[#8892A4]">{total} total</span>
      </div>
      {suggestReply > 0 && (
        <p className="text-xs text-[#8892A4] pl-7">
          AI suggests: Reply to {suggestReply} message{suggestReply > 1 ? 's' : ''}
        </p>
      )}
    </div>
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
        'bg-[#0C0C18] border-[#00F0FF]/10',
        priorityBorder,
        isFocused ? 'ring-1 ring-[#00F0FF]/40' : '',
        isUnread ? 'shadow-[0_0_12px_rgba(0,240,255,0.04)]' : 'opacity-80',
      ].filter(Boolean).join(' ')}
    >
      {/* Header row */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 mb-1.5">
          {/* Sender name */}
          <span className={[
            'text-sm truncate max-w-[180px] sm:max-w-none',
            isUnread ? 'font-semibold text-[#F4F6FF]' : 'font-medium text-[#8892A4]',
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
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shrink-0 animate-pulse" />
          )}

          {/* Timestamp */}
          <span className="text-xs text-[#8892A4] ml-auto shrink-0">
            {formatTime(msg.received_at)}
          </span>
        </div>

        {/* Message preview */}
        <p className={[
          'text-sm line-clamp-2 leading-relaxed',
          isUnread ? 'text-[#F4F6FF]/80' : 'text-[#8892A4]',
        ].join(' ')}>
          {msg.summary ?? msg.content}
        </p>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="px-4 pb-3 space-y-3 border-t border-[#00F0FF]/5 pt-3 animate-in fade-in-0 slide-in-from-top-1 duration-200"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="region"
          aria-label="Message details"
        >
          {/* Full content */}
          <p className="text-sm text-[#F4F6FF]/90 whitespace-pre-wrap leading-relaxed">{msg.content}</p>

          {/* AI Suggested Reply */}
          {msg.suggested_reply && (
            <div className="bg-[#8B5CF6]/8 border border-[#8B5CF6]/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
                <p className="text-xs text-[#8B5CF6] font-medium">AI Suggested Reply</p>
              </div>
              <p className="text-sm text-[#F4F6FF]/70">{msg.suggested_reply}</p>
              <button
                onClick={onUseSuggestion}
                className="mt-2 text-xs text-[#8B5CF6] hover:text-[#a78bfa] transition-colors font-medium min-h-[44px] flex items-center"
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
                className="w-full bg-white/5 border border-[#00F0FF]/10 rounded-lg px-3 py-2.5 text-sm text-[#F4F6FF] placeholder-[#8892A4]/60 focus:outline-none focus:border-[#00F0FF]/30 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/20 resize-none transition-colors"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8892A4]">
                  {msg.suggested_reply ? 'Edit the suggestion above or write your own' : 'Write your reply'}
                </span>
                <button
                  onClick={onSendReply}
                  disabled={isSending || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] rounded-lg text-sm font-medium disabled:opacity-40 transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
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
          className="inline-flex items-center gap-1 px-2 min-h-[44px] text-xs text-[#8892A4] hover:text-[#F4F6FF] transition-colors rounded-md hover:bg-white/5"
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#8892A4] hover:text-[#ADFF2F] transition-colors"
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#8892A4] hover:text-[#00F0FF] transition-colors"
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#8892A4] hover:text-amber-400 transition-colors"
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
              onClick={() => {/* snooze handler — future */}}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#8892A4] hover:text-[#8B5CF6] transition-colors"
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#8892A4] hover:text-[#FF2D78] transition-colors"
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
    <div className="text-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/5 border border-[#00F0FF]/10 flex items-center justify-center mx-auto">
        <Inbox className="w-8 h-8 text-[#00F0FF]/40" />
      </div>
      <div className="space-y-2">
        <p className="text-[#F4F6FF] font-semibold text-lg">Your inbox is empty</p>
        <p className="text-[#8892A4] text-sm max-w-xs mx-auto leading-relaxed">
          Messages from your AI agents and integrations will appear here
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Bar
// ---------------------------------------------------------------------------

function KeyboardHints() {
  return (
    <div className="flex items-center justify-center gap-4 py-3 text-[10px] text-[#8892A4]/60 select-none">
      <span className="inline-flex items-center gap-1">
        <Kbd className="bg-white/5 text-[#8892A4]/60 border-0 h-4 min-w-4 text-[10px]">J</Kbd>
        <Kbd className="bg-white/5 text-[#8892A4]/60 border-0 h-4 min-w-4 text-[10px]">K</Kbd>
        navigate
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd className="bg-white/5 text-[#8892A4]/60 border-0 h-4 min-w-4 text-[10px]">E</Kbd>
        archive
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd className="bg-white/5 text-[#8892A4]/60 border-0 h-4 min-w-4 text-[10px]">R</Kbd>
        reply
      </span>
      <span className="inline-flex items-center gap-1">
        <Kbd className="bg-white/5 text-[#8892A4]/60 border-0 h-4 min-w-4 text-[10px]">Enter</Kbd>
        expand
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function InboxPage() {
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
    await api.patch('/inbox/' + id + '/read');
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: 1 } : m));
  };

  const handleArchive = async (id: number) => {
    await api.patch('/inbox/' + id + '/archive');
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleDelete = async (id: number) => {
    await api.delete('/inbox/' + id);
    setMessages(prev => prev.filter(m => m.id !== id));
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
    } catch {
      setErr('Failed to send reply');
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
  }, [focusIdx, sortedMessages, expanded]);

  // ---- Triage stats ----

  const unreadCount = messages.filter(m => m.read === 0).length;

  // ---- Render ----

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
            <Inbox className="w-4 h-4 text-[#00F0FF]" />
          </div>
          <h1 className="text-xl font-semibold text-[#F4F6FF]">AI Inbox <span className="text-[10px] text-[#4B5563] font-medium ml-1.5">📥 Triaged by Edith</span></h1>
          {unreadCount > 0 && (
            <Badge className="bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/25 text-xs font-bold">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowKbHints(h => !h)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[#8892A4] hover:text-[#F4F6FF] transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
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
              'p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[#8892A4] hover:text-[#F4F6FF] transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50',
              loading ? 'animate-spin' : '',
            ].join(' ')}
            aria-label="Refresh inbox"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {err && (
        <div className="flex items-center gap-2 text-[#FF2D78] bg-[#FF2D78]/10 border border-[#FF2D78]/20 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)} className="text-[#FF2D78]/60 hover:text-[#FF2D78] transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI triage summary */}
      {!loading && <TriageSummary messages={messages} />}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setFocusIdx(-1); }}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50',
              filter === f
                ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/25'
                : 'bg-white/5 text-[#8892A4] hover:text-[#F4F6FF] hover:bg-white/10',
            ].join(' ')}
          >
            {f === 'urgent' ? 'Urgent' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'urgent' && messages.filter(m => m.priority === 'urgent').length > 0 && (
              <span className="ml-1.5 text-[10px] bg-[#FF2D78]/20 text-[#FF2D78] px-1 py-0.5 rounded">
                {messages.filter(m => m.priority === 'urgent').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-white/5 rounded" />
                <div className="h-4 w-10 bg-white/5 rounded" />
                <div className="ml-auto h-3 w-12 bg-white/5 rounded" />
              </div>
              <div className="h-4 w-3/4 bg-white/5 rounded" />
              <div className="h-4 w-1/2 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sortedMessages.length === 0 && <EmptyInbox />}

      {/* Message list */}
      {!loading && sortedMessages.length > 0 && (
        <div className="space-y-2">
          {sortedMessages.map((msg, idx) => (
            <MessageCard
              key={msg.id}
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
          ))}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {showKbHints && <KeyboardHints />}

      {/* Subtle always-visible shortcut hint */}
      {!showKbHints && sortedMessages.length > 0 && (
        <p className="text-center text-[10px] text-[#8892A4]/40 select-none">
          Press <span className="text-[#8892A4]/60">?</span> for keyboard shortcuts
        </p>
      )}
    </div>
  );
}
