// InboxPage.tsx -- Phase 97: AI Inbox
import { useState, useEffect, useCallback } from 'react';
import {
  Send, Archive, Trash2, AlertCircle,
  RefreshCw, Check, Inbox,
} from 'lucide-react';
import api from '@/services/api';

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

const SOURCE_LABELS: Record<string, string> = {
  telegram: 'TG',
  whatsapp: 'WA',
  system: 'SYS',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  normal: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const FILTERS = ['all', 'unread', 'telegram', 'whatsapp', 'system'] as const;
type Filter = typeof FILTERS[number];

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function InboxPage() {
  const [messages, setMessages] = useState([] as InboxMessage[]);
  const [filter, setFilter] = useState('all' as Filter);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null as number | null);
  const [replyMap, setReplyMap] = useState({} as Record<number, string>);
  const [sending, setSending] = useState(null as number | null);
  const [err, setErr] = useState(null as string | null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = {} as Record<string, string>;
      if (filter === 'unread') params.unreadOnly = 'true';
      else if (filter !== 'all') params.source = filter;
      const res = await api.get('/inbox', { params });
      setMessages(res.data.messages ?? []);
    } catch (e) {
      setErr('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

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
    } catch (e) {
      setErr('Failed to send reply');
    } finally {
      setSending(null);
    }
  };

  const unreadCount = messages.filter(m => m.read === 0).length;

  return (
    <div className='max-w-3xl mx-auto p-4 space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Inbox className='w-5 h-5 text-cyan-400' />
          <h1 className='text-xl font-semibold text-white'>AI Inbox</h1>
          {unreadCount > 0 && (
            <span className='bg-cyan-500 text-black text-xs font-bold px-2 py-0.5 rounded-full'>
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={fetchMessages}
          className='p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors'
          title='Refresh'
        >
          <RefreshCw className='w-4 h-4' />
        </button>
      </div>

      {err && (
        <div className='flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm'>
          <AlertCircle className='w-4 h-4 shrink-0' />
          {err}
        </div>
      )}

      <div className='flex gap-2 overflow-x-auto pb-1'>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' + (
              filter === f
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && (
        <div className='text-center py-8 text-gray-500 text-sm'>Loading...</div>
      )}

      {!loading && messages.length === 0 && (
        <div className='text-center py-12 space-y-2'>
          <Inbox className='w-12 h-12 text-gray-600 mx-auto' />
          <p className='text-gray-500'>No messages</p>
        </div>
      )}

      <div className='space-y-2'>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={'rounded-xl border transition-colors ' + (
              msg.read
                ? 'bg-white/3 border-white/5'
                : 'bg-white/6 border-cyan-500/20'
            )}
          >
            <div className='p-4 flex items-start gap-3'>
              <div className='mt-0.5 shrink-0 text-xs font-bold text-gray-500'>
                {SOURCE_LABELS[msg.source] ?? msg.source.toUpperCase()}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 mb-1 flex-wrap'>
                  <span className='text-sm font-medium text-white truncate'>
                    {msg.sender ?? msg.source}
                  </span>
                  <span className={'text-xs px-1.5 py-0.5 rounded border ' + (PRIORITY_COLORS[msg.priority] ?? PRIORITY_COLORS.normal)}>
                    {msg.priority}
                  </span>
                  {!msg.read && (
                    <span className='w-2 h-2 rounded-full bg-cyan-400 shrink-0' />
                  )}
                  <span className='text-xs text-gray-500 ml-auto shrink-0'>
                    {formatTime(msg.received_at)}
                  </span>
                </div>
                <p className='text-sm text-gray-300 line-clamp-2'>
                  {msg.summary ?? msg.content}
                </p>
              </div>
            </div>

            {expanded === msg.id && (
              <div className='px-4 pb-4 space-y-3 border-t border-white/5 pt-3'>
                <p className='text-sm text-gray-200 whitespace-pre-wrap'>{msg.content}</p>
                {msg.suggested_reply && (
                  <div className='bg-purple-500/10 border border-purple-500/20 rounded-lg p-3'>
                    <p className='text-xs text-purple-400 mb-1 font-medium'>Suggested reply</p>
                    <p className='text-sm text-gray-300'>{msg.suggested_reply}</p>
                    <button
                      onClick={() => setReplyMap({ ...replyMap, [msg.id]: msg.suggested_reply ?? '' })}
                      className='mt-2 text-xs text-purple-400 hover:text-purple-300'
                    >
                      Use this
                    </button>
                  </div>
                )}
                {(msg.source === 'telegram' || msg.source === 'whatsapp') && (
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      value={replyMap[msg.id] ?? ''}
                      onChange={e => setReplyMap({ ...replyMap, [msg.id]: e.target.value })}
                      placeholder='Type a reply...'
                      className='flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50'
                    />
                    <button
                      onClick={() => handleReply(msg)}
                      disabled={sending === msg.id || !replyMap[msg.id]?.trim()}
                      className='p-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg disabled:opacity-40 transition-colors'
                    >
                      <Send className='w-4 h-4' />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className='flex items-center gap-1 px-4 pb-3 pt-0 justify-end'>
              <button
                onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                className='px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors'
              >
                {expanded === msg.id ? 'Less' : 'More'}
              </button>
              {!msg.read && (
                <button
                  onClick={() => handleMarkRead(msg.id)}
                  className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-green-400 transition-colors'
                  title='Mark read'
                >
                  <Check className='w-3.5 h-3.5' />
                </button>
              )}
              <button
                onClick={() => handleArchive(msg.id)}
                className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-amber-400 transition-colors'
                title='Archive'
              >
                <Archive className='w-3.5 h-3.5' />
              </button>
              <button
                onClick={() => handleDelete(msg.id)}
                className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors'
                title='Delete'
              >
                <Trash2 className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
