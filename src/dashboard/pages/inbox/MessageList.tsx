// inbox/MessageList.tsx — triage summary, loading skeletons, empty state, message list
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Inbox } from 'lucide-react';
import type { InboxMessage } from './helpers';
import { SPRING, FADE_UP } from './helpers';
import { MessageCard } from './MessageCard';

// ─── Triage Summary ───────────────────────────────────────────────────────────

function TriageSummary({ messages }: { messages: InboxMessage[] }) {
  const total    = messages.length;
  const unread   = messages.filter(m => m.read === 0).length;
  const urgent   = messages.filter(m => m.priority === 'urgent').length;
  const canReply = messages.filter(m => m.suggested_reply && m.read === 0).length;

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

// ─── Skeleton Card ────────────────────────────────────────────────────────────

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

// ─── MessageList props ────────────────────────────────────────────────────────

export interface MessageListProps {
  messages: InboxMessage[];
  sortedMessages: InboxMessage[];
  loading: boolean;
  expanded: number | null;
  replyMap: Record<number, string>;
  sending: number | null;
  focusIdx: number;
  onToggleExpand: (id: number, idx: number) => void;
  onMarkRead: (id: number) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onReplyChange: (id: number, text: string) => void;
  onSendReply: (msg: InboxMessage) => void;
  onUseSuggestion: (id: number, suggestion: string) => void;
  cardRef: (id: number, el: HTMLDivElement | null) => void;
}

// ─── MessageList ──────────────────────────────────────────────────────────────

export function MessageList({
  messages, sortedMessages, loading,
  expanded, replyMap, sending, focusIdx,
  onToggleExpand, onMarkRead, onArchive, onDelete,
  onReplyChange, onSendReply, onUseSuggestion, cardRef,
}: MessageListProps) {
  return (
    <>
      {/* Triage summary */}
      {!loading && <TriageSummary messages={messages} />}

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

      {/* Message cards with exit animations */}
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
                onToggleExpand={() => onToggleExpand(msg.id, idx)}
                onMarkRead={() => onMarkRead(msg.id)}
                onArchive={() => onArchive(msg.id)}
                onDelete={() => onDelete(msg.id)}
                onReplyChange={(text) => onReplyChange(msg.id, text)}
                onSendReply={() => onSendReply(msg)}
                onUseSuggestion={() => onUseSuggestion(msg.id, msg.suggested_reply ?? '')}
                cardRef={(el) => cardRef(msg.id, el)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

    </>
  );
}
