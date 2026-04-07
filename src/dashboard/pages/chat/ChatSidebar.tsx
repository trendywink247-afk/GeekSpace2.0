import { useState } from 'react';
import { Pin, Search, Plus, Trash2, PanelLeftClose, MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/mobile';

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
  onSelectConversation?: (convId: string) => void;
  activeConversationId?: string | null;
  onNewConversation?: () => void;
}

const AGENT_COLORS = ['var(--ag-violet)','var(--ag-edith)','var(--ag-lime)','var(--ag-pink)','var(--ag-amber)','var(--ag-green)','var(--ag-echo)','var(--ag-cal)','var(--ag-nova)'];
function getAgentColor(id: string) {
  const h = id.charCodeAt(0) + (id.charCodeAt(1) || 0);
  return AGENT_COLORS[h % AGENT_COLORS.length];
}

function ConversationItem({ title, timestamp, isActive, pinned, convId, onClick, onPin, onDelete, deleteConfirm = false }: {
  title: string; timestamp?: string; isActive: boolean; pinned: boolean; convId: string;
  onClick: () => void; onPin: () => void; onDelete: () => void; deleteConfirm?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const dot = getAgentColor(convId);
  return (
    <div className={[
      'group/conv flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-sm min-h-[44px] border',
      isActive
        ? 'text-[var(--ag-text-primary)] bg-white/[0.06] border-[var(--ag-border-active)]'
        : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]',
    ].join(' ')}
      onClick={onClick} onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: dot, boxShadow: isActive ? `0 0 6px ${dot}` : 'none' }} />
      {pinned && <Pin className='w-3 h-3 text-[var(--ag-violet)] shrink-0 rotate-45' aria-label='Pinned' />}
      <div className='flex-1 min-w-0'>
        <p className='truncate text-xs font-medium leading-snug'>{title || 'New conversation'}</p>
        {timestamp && <p className='font-mono text-[10px] text-[var(--ag-text-muted)] mt-0.5 uppercase tracking-[0.06em]'>{timestamp}</p>}
      </div>
      {showActions && (
        <div className='flex items-center gap-0.5 shrink-0'>
          <button onClick={e => { e.stopPropagation(); onPin(); }}
            className='p-1.5 rounded-lg hover:bg-white/[0.06] text-[var(--ag-text-muted)] hover:text-[var(--ag-violet)] min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors cursor-pointer'
            title={pinned ? 'Unpin' : 'Pin'} aria-label={pinned ? 'Unpin conversation' : 'Pin conversation'}>
            <Pin className='w-3 h-3' />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className={['p-1.5 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center transition-colors cursor-pointer',
              deleteConfirm ? 'bg-[var(--ag-pink)]/20 text-[var(--ag-pink)]' : 'hover:bg-[var(--ag-pink)]/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)]'].join(' ')}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete'} aria-label={deleteConfirm ? 'Confirm deletion' : 'Delete conversation'}>
            <Trash2 className='w-3 h-3' />
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatSidebar({ conversations, conversationSearch, onSearchChange, onPin, onDelete, deleteConfirmId, onClearChat, isOpen, onClose, onSelectConversation, activeConversationId, onNewConversation }: ChatSidebarProps) {
  let filtered = conversations;
  if (conversationSearch.trim()) { const q = conversationSearch.toLowerCase(); filtered = conversations.filter(c => c.title.toLowerCase().includes(q)); }
  const sorted = [...filtered].sort((a, b) => a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1);

  return (
    <>
      <div className={['md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300 ease-out', isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'].join(' ')}
        onClick={onClose} aria-hidden='true' />
      <div className={['w-72 flex-shrink-0 flex flex-col overflow-hidden fixed inset-y-0 left-0 z-50 md:relative md:inset-auto md:z-auto transition-transform duration-300 ease-out', isOpen ? 'translate-x-0' : '-translate-x-full'].join(' ')}
        data-testid='chat-sidebar'
        style={{ background: 'var(--ag-bg-chrome)', borderRight: '1px solid rgba(255,255,255,0.06)', boxShadow: isOpen ? '4px 0 40px rgba(139,92,246,0.08)' : 'none' }}>
        <div className='flex items-center justify-between px-4 py-3.5' style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <span className='font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/60 block mb-0.5'>History</span>
            <h3 className='text-sm font-semibold text-[var(--ag-text-primary)]' style={{ fontFamily: 'Syne, sans-serif' }}>Conversations</h3>
          </div>
          <button onClick={onClose} className='p-2 rounded-xl hover:bg-white/[0.06] text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors cursor-pointer' title='Close sidebar' aria-label='Close sidebar'>
            <PanelLeftClose className='w-4 h-4' />
          </button>
        </div>
        <div className='px-3 py-3'>
          <button onClick={() => { onClearChat(); onNewConversation?.(); }}
            className='flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] transition-all duration-150 cursor-pointer'
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--ag-violet)' }}>
            <Plus className='w-3.5 h-3.5' /> New Chat
          </button>
        </div>
        <div className='px-3 pb-2'>
          <div className='relative'>
            <Search className='w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ag-text-muted)]' aria-hidden='true' />
            <input type='text' value={conversationSearch} onChange={e => onSearchChange(e.target.value)} placeholder='Search…' aria-label='Search conversations'
              className={['w-full pl-9 pr-3 py-2.5 rounded-xl text-xs min-h-[40px]', 'text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)]', 'bg-white/[0.03] focus:bg-white/[0.05]', 'border border-white/[0.06] focus:border-[var(--ag-border-active)]', 'focus:outline-none focus:ring-1 focus:ring-[var(--ag-violet)]/20 transition-all duration-150'].join(' ')} />
          </div>
        </div>
        {sorted.length > 0 && (
          <div className='px-4 pb-1'>
            <span className='font-mono text-[10px] uppercase tracking-[0.15em] text-[#94A3B8]/40'>{sorted.some(c => c.pinned) ? 'Pinned & Recent' : 'Recent'}</span>
          </div>
        )}
        <div className='flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 scrollbar-hide'>
          {sorted.length === 0
            ? <EmptyState icon={MessageSquare} title='No conversations yet' description='Start a new chat and it will appear here' className='py-10' />
            : sorted.map(conv => (
              <ConversationItem key={conv.id} convId={conv.id} title={conv.title} timestamp={conv.timestamp} isActive={conv.id === activeConversationId} pinned={conv.pinned}
                onClick={() => onSelectConversation?.(conv.id)} onPin={() => onPin(conv.id)} onDelete={() => onDelete(conv.id)} deleteConfirm={deleteConfirmId === conv.id} />
            ))
          }
        </div>
      </div>
    </>
  );
}
