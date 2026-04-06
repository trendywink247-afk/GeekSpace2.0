import { Mail } from 'lucide-react';
import { EmailCard } from './EmailCard';
import type { GmailMessage, FilterKey } from './helpers';

interface EmailListProps {
  messages: GmailMessage[];
  selected: GmailMessage | null;
  starred: Set<number>;
  searchQuery: string;
  activeFilter: FilterKey;
  onSelect: (msg: GmailMessage) => void;
  onToggleStar: (id: number, e: React.MouseEvent) => void;
  onSync: () => void;
}

export function EmailList({
  messages,
  selected,
  starred,
  searchQuery,
  activeFilter,
  onSelect,
  onToggleStar,
  onSync,
}: EmailListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-[var(--ag-border-subtle)] rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl">
        <div className="w-12 h-12 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] flex items-center justify-center mb-3">
          <Mail className="w-6 h-6 text-[var(--ag-text-secondary)]/40" />
        </div>
        <p className="text-[var(--ag-text-secondary)] text-sm">
          {searchQuery
            ? 'No emails match your search'
            : activeFilter !== 'all'
              ? `No ${activeFilter} emails`
              : 'No emails synced yet'}
        </p>
        {!searchQuery && activeFilter === 'all' && (
          <button
            onClick={onSync}
            className="mt-3 text-[var(--ag-violet)] text-xs hover:underline min-h-[44px] flex items-center"
          >
            Sync now to fetch emails
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[calc(100dvh-320px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
      {messages.map(msg => (
        <EmailCard
          key={msg.id}
          msg={msg}
          isSelected={selected?.id === msg.id}
          isStarred={starred.has(msg.id)}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  );
}
