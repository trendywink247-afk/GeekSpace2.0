import { Star, Paperclip } from 'lucide-react';
import {
  PRIORITY_COLOR,
  senderInitial,
  senderName,
  timeSince,
  hasAttachmentHeuristic,
} from './helpers';
import type { GmailMessage } from './helpers';

interface EmailCardProps {
  msg: GmailMessage;
  isSelected: boolean;
  isStarred: boolean;
  onSelect: (msg: GmailMessage) => void;
  onToggleStar: (id: number, e: React.MouseEvent) => void;
}

export function EmailCard({ msg, isSelected, isStarred, onSelect, onToggleStar }: EmailCardProps) {
  const isUnread = !msg.read;
  const hasAttachment = hasAttachmentHeuristic(msg);

  return (
    <button
      onClick={() => onSelect(msg)}
      className={`w-full text-left p-3 rounded-xl border transition-[transform,background-color,border-color] active:scale-[0.98] group ${
        isSelected
          ? 'border-[var(--ag-aria)]/30 bg-[var(--ag-aria)]/5'
          : isUnread
            ? 'border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] backdrop-blur-xl hover:border-[var(--ag-aria)]/20 hover:bg-[var(--ag-bg-surface-hover)]'
            : 'border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-xl hover:border-[var(--ag-border-default)] hover:bg-[var(--ag-bg-surface-hover)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
          isUnread
            ? 'bg-[var(--ag-aria)]/15 text-[var(--ag-aria)]'
            : 'bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)]'
        }`}>
          {senderInitial(msg.sender)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Sender + timestamp */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-xs truncate ${
              isUnread ? 'text-[var(--ag-text-primary)] font-semibold' : 'text-[var(--ag-text-secondary)]'
            }`}>
              {senderName(msg.sender)}
            </span>
            <span className="text-[10px] text-[var(--ag-text-secondary)]/60 shrink-0">
              {timeSince(msg.synced_at)}
            </span>
          </div>

          {/* Subject */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-xs truncate ${
              isUnread ? 'text-[var(--ag-text-primary)] font-medium' : 'text-[var(--ag-text-secondary)]/80'
            }`}>
              {msg.subject || '(no subject)'}
            </span>
          </div>

          {/* Snippet */}
          {msg.snippet && (
            <p className="text-[11px] text-[var(--ag-text-secondary)]/60 truncate">
              {msg.snippet}
            </p>
          )}

          {/* Bottom row */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {msg.priority && msg.priority !== 'normal' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_COLOR[msg.priority] || PRIORITY_COLOR.normal}`}>
                {msg.priority}
              </span>
            )}
            {isUnread && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-aria)] shrink-0" />
            )}
            {hasAttachment && (
              <Paperclip className="w-3 h-3 text-[var(--ag-text-secondary)]/40" />
            )}
            <div className="flex-1" />
            <button
              onClick={(e) => onToggleStar(msg.id, e)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-[var(--ag-bg-surface)] backdrop-blur-xl transition-[transform,background-color,opacity] active:scale-[0.9] opacity-0 group-hover:opacity-100 data-[starred=true]:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
              data-starred={isStarred}
              aria-label={isStarred ? 'Unstar' : 'Star'}
            >
              <Star className={`w-3.5 h-3.5 ${
                isStarred ? 'text-amber-400 fill-amber-400' : 'text-[var(--ag-text-secondary)]/30'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}
