import { useState } from 'react';
import { Pin, Search, Plus, Trash2, PanelLeftClose } from 'lucide-react';

// ── Types ──

interface Conversation {
  id: string;
  title: string;
  timestamp: string;
  pinned: boolean;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  conversationSearch: string;
  onSearchChange: (value: string) => void;
  onPin: (convId: string) => void;
  onDelete: (convId: string) => void;
  deleteConfirmId: string | null;
  onClearChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helper Functions ──

/** Agent color from conversation title hash */
const AGENT_COLORS = ['var(--ag-violet)', 'var(--ag-edith)', 'var(--ag-lime)', 'var(--ag-pink)', 'var(--ag-amber)', 'var(--ag-green)', 'var(--ag-indigo)', 'var(--ag-cal)', 'var(--ag-nova)'];

function getAgentColor(id: string): string {
  const hash = id.charCodeAt(0) + (id.charCodeAt(1) || 0);
  return AGENT_COLORS[hash % AGENT_COLORS.length];
}

/** Conversation sidebar item */
function ConversationItem({
  title,
  timestamp,
  isActive,
  pinned,
  convId,
  onClick,
  onPin,
  onDelete,
  deleteConfirm = false,
}: {
  title: string;
  timestamp?: string;
  isActive: boolean;
  pinned: boolean;
  convId: string;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
  deleteConfirm?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const dotColor = getAgentColor(convId);

  return (
    <div
      className={[
        'group/conv flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-sm min-h-[44px] backdrop-blur-md',
        isActive
          ? 'text-[var(--ag-text-primary)]'
          : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]',
      ].join(' ')}
      style={{
        background: isActive ? 'var(--ag-active-bg)' : 'transparent',
        border: isActive ? '1px solid var(--ag-active-border)' : '1px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Agent color dot */}
      <span
        className='w-2 h-2 rounded-full shrink-0'
        style={{ backgroundColor: dotColor }}
      />
      {pinned && <Pin className='w-3 h-3 text-[var(--ag-cyan)] shrink-0 rotate-45' />}
      <div className='flex-1 min-w-0'>
        <p className='truncate text-xs'>{title || 'New conversation'}</p>
        {timestamp && (
          <p className='text-[10px] text-[var(--ag-text-muted)] mt-0.5'>{timestamp}</p>
        )}
      </div>
      {showActions && (
        <div className='flex items-center gap-0.5 shrink-0'>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className='p-1 rounded hover:bg-[var(--ag-active-bg)] text-[var(--ag-text-muted)] hover:text-[var(--ag-cyan)] min-w-[36px] min-h-[36px] flex items-center justify-center'
            title={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinned ? 'Unpin conversation' : 'Pin conversation'}
          >
            <Pin className='w-3 h-3' />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={`p-1 rounded hover:bg-[var(--ag-pink)]/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)] min-w-[36px] min-h-[36px] flex items-center justify-center ${
              deleteConfirm ? 'bg-[var(--ag-pink)]/20 text-[var(--ag-pink)]' : ''
            }`}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete conversation'}
            aria-label={deleteConfirm ? 'Click again to confirm deletion' : 'Delete conversation'}
          >
            <Trash2 className='w-3 h-3' />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function ChatSidebar({
  conversations,
  conversationSearch,
  onSearchChange,
  onPin,
  onDelete,
  deleteConfirmId,
  onClearChat,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  if (!isOpen) return null;

  // Filter conversations based on search
  let filteredConversations = conversations;
  if (conversationSearch.trim()) {
    const q = conversationSearch.toLowerCase();
    filteredConversations = conversations.filter((c) => c.title.toLowerCase().includes(q));
  }
  
  // Sort: pinned first, then by most recent
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className='md:hidden fixed inset-0 bg-black/60 z-40'
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className='w-64 md:w-72 flex-shrink-0 border-r flex flex-col rounded-l-xl overflow-hidden backdrop-blur-xl md:relative fixed inset-y-0 left-0 z-50' data-testid="chat-sidebar" style={{ background: 'var(--ag-glass-bg)', borderColor: 'var(--ag-glass-border)' }}>
      {/* Sidebar Header */}
      <div className='flex items-center justify-between px-3 py-3 border-b' style={{ borderColor: 'var(--ag-border-subtle)' }}>
        <h3 className='text-xs font-semibold text-[var(--ag-text-primary)] uppercase tracking-wider'>Conversations</h3>
        <button
          onClick={onClose}
          className='p-1 rounded hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-w-[28px] min-h-[28px] flex items-center justify-center'
          title='Close sidebar'
          aria-label='Close sidebar'
        >
          <PanelLeftClose className='w-4 h-4' />
        </button>
      </div>

      {/* New Chat button */}
      <div className='px-3 py-2'>
        <button
          onClick={onClearChat}
          className='flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)] hover:bg-[var(--ag-cyan)]/20 transition-colors text-xs font-medium min-h-[44px]'
        >
          <Plus className='w-3.5 h-3.5' />
          New Chat
        </button>
      </div>

      {/* Search conversations */}
      <div className='px-3 pb-2'>
        <div className='relative'>
          <Search className='w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ag-text-muted)]' />
          <input
            type='text'
            value={conversationSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder='Search conversations...'
            className='w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)] text-xs focus:outline-none focus:border-[var(--ag-border-default)] min-h-[36px]'
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className='flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-hide'>
        {sortedConversations.length === 0 ? (
          <p className='text-xs text-[var(--ag-text-muted)] text-center py-8'>No conversations yet</p>
        ) : (
          sortedConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              convId={conv.id}
              title={conv.title}
              timestamp={conv.timestamp}
              isActive={false}
              pinned={conv.pinned}
              onClick={() => {
                // Scroll to message in current view
                const el = document.getElementById(`msg-${conv.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              onPin={() => onPin(conv.id)}
              onDelete={() => onDelete(conv.id)}
              deleteConfirm={deleteConfirmId === conv.id}
            />
          ))
        )}
      </div>
      </div>
    </>
  );
}