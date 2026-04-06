// InboxPage.tsx — Glass inbox · shadows-over-borders · stagger · scale-on-press
// Owner: Aria (#FF6B9D) — design tokens: var(--ag-*) only, no hardcoded colours
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  AlertCircle, RefreshCw, Check, Inbox, Keyboard,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import api from '@/services/api';
import type { InboxMessage, Filter } from './inbox/helpers';
import { SPRING, FAST, FADE_UP, priorityWeight } from './inbox/helpers';
import { FilterBar } from './inbox/FilterBar';
import { MessageList } from './inbox/MessageList';

// ─── Keyboard Hints (desktop only) ───────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboxPage({ shell: _shell = true }: { shell?: boolean } = {}) {
  const [messages,    setMessages]    = useState<InboxMessage[]>([]);
  const [filter,      setFilter]      = useState<Filter>('all');
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState<number | null>(null);
  const [replyMap,    setReplyMap]    = useState<Record<number, string>>({});
  const [sending,     setSending]     = useState<number | null>(null);
  const [err,         setErr]         = useState<string | null>(null);
  const [focusIdx,    setFocusIdx]    = useState(-1);
  const [showKbHints, setShowKbHints] = useState(false);

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'aria', page: 'inbox' });

  // ── Data fetching ──

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (filter === 'unread')      params.unreadOnly = 'true';
      else if (filter === 'urgent') params.priority   = 'urgent';
      else if (filter !== 'all')    params.source     = filter;
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

  const handleMarkRead = useCallback(async (id: number) => {
    try {
      await api.patch('/inbox/' + id + '/read');
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read: 1 } : m));
      void notifyDone('message marked as read');
    } catch {
      void notifyFail('failed to mark message read');
    }
  }, [notifyDone, notifyFail]);

  const handleArchive = useCallback(async (id: number) => {
    try {
      await api.patch('/inbox/' + id + '/archive');
      setMessages(prev => prev.filter(m => m.id !== id));
      void notifyDone('message archived');
    } catch {
      void notifyFail('failed to archive message');
    }
  }, [notifyDone, notifyFail]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.delete('/inbox/' + id);
      setMessages(prev => prev.filter(m => m.id !== id));
      void notifyDone('message deleted');
    } catch {
      void notifyFail('failed to delete message');
    }
  }, [notifyDone, notifyFail]);

  const handleReply = useCallback(async (msg: InboxMessage) => {
    const text = replyMap[msg.id];
    if (!text?.trim()) return;
    setSending(msg.id);
    try {
      await api.post('/inbox/' + msg.id + '/reply', { text });
      setReplyMap(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
      void handleMarkRead(msg.id);
      void notifyDone(`reply sent to ${msg.sender ?? msg.source}`);
    } catch {
      setErr('Failed to send reply');
      void notifyFail('failed to send reply');
    } finally {
      setSending(null);
    }
  }, [replyMap, handleMarkRead, notifyDone, notifyFail]);

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
            setExpanded(prev => prev === id ? null : id);
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
  }, [focusIdx, sortedMessages, handleArchive]);

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

        {/* Filter tabs */}
        <motion.div variants={FADE_UP}>
          <FilterBar
            filter={filter}
            messages={messages}
            onChange={(f) => { setFilter(f); setFocusIdx(-1); }}
          />
        </motion.div>

        {/* Message list (triage summary + skeletons + empty state + cards) */}
        <MessageList
          messages={messages}
          sortedMessages={sortedMessages}
          loading={loading}
          expanded={expanded}
          replyMap={replyMap}
          sending={sending}
          focusIdx={focusIdx}
          onToggleExpand={(id, idx) => {
            setExpanded(prev => prev === id ? null : id);
            setFocusIdx(idx);
          }}
          onMarkRead={(id) => void handleMarkRead(id)}
          onArchive={(id) => void handleArchive(id)}
          onDelete={(id) => void handleDelete(id)}
          onReplyChange={(id, text) => setReplyMap(prev => ({ ...prev, [id]: text }))}
          onSendReply={(msg) => void handleReply(msg)}
          onUseSuggestion={(id, suggestion) => setReplyMap(prev => ({ ...prev, [id]: suggestion }))}
          cardRef={(id, el) => {
            if (el) cardRefs.current.set(id, el);
            else cardRefs.current.delete(id);
          }}
        />

        {/* Keyboard shortcuts panel */}
        <AnimatePresence>
          {showKbHints && <KeyboardHints key="kbhints" />}
        </AnimatePresence>

        {/* Subtle shortcut hint */}
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
