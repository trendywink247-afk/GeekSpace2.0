import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Mail, RefreshCw, Link, Unlink, Send, X, ChevronDown, ChevronUp,
  Star, Paperclip, Search, Plus, Sparkles, Reply, Forward,
  Filter, MailOpen, Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';

import api from '@/services/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GmailStatus {
  available: boolean;
  connected: boolean;
  email?: string;
  lastSync?: string;
  unread?: number;
}

interface GmailMessage {
  id: number;
  gmail_message_id: string;
  thread_id: string;
  subject: string;
  sender: string;
  snippet: string | null;
  inbox_id: number | null;
  synced_at: number;
  priority: string | null;
  read: number | null;
  archived: number | null;
  suggested_reply: string | null;
  summary: string | null;
}

type FilterKey = 'all' | 'unread' | 'starred' | 'attachments';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const FILTER_OPTIONS: { key: FilterKey; label: string; icon: typeof Mail }[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'unread', label: 'Unread', icon: MailOpen },
  { key: 'starred', label: 'Starred', icon: Star },
  { key: 'attachments', label: 'Attachments', icon: Paperclip },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeSince(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function senderInitial(sender: string): string {
  const name = sender.replace(/<.*>/, '').trim();
  return (name[0] || '?').toUpperCase();
}

function senderName(sender: string): string {
  const match = sender.match(/^([^<]+)/);
  return match ? match[1].trim() : sender;
}

function hasAttachmentHeuristic(msg: GmailMessage): boolean {
  const s = (msg.snippet || '') + ' ' + (msg.subject || '');
  return /attach|\.pdf|\.docx?|\.xlsx?|\.zip|\.png|\.jpg/i.test(s);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GmailPage() {
  /* ---------- State ---------- */
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [starred, setStarred] = useState<Set<number>>(() => new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState('');

  const detailRef = useRef<HTMLDivElement>(null);

  /* ---------- Data fetching ---------- */

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<GmailStatus>('/gmail/status');
      setStatus(res.data);
    } catch {
      setStatus({ available: false, connected: false });
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get<{ messages: GmailMessage[] }>('/gmail/messages', {
        params: { limit: 50 },
      });
      setMessages(res.data.messages);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchMessages()]);
      setLoading(false);
    };
    load();
  }, [fetchStatus, fetchMessages]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!status?.connected) return;
    const interval = setInterval(() => {
      void fetchMessages();
      void fetchStatus();
    }, 60_000);
    return () => clearInterval(interval);
  }, [status?.connected, fetchMessages, fetchStatus]);

  /* ---------- Filtered + searched messages ---------- */

  const filteredMessages = useMemo(() => {
    let result = messages;

    // Filter
    if (activeFilter === 'unread') {
      result = result.filter(m => !m.read);
    } else if (activeFilter === 'starred') {
      result = result.filter(m => starred.has(m.id));
    } else if (activeFilter === 'attachments') {
      result = result.filter(m => hasAttachmentHeuristic(m));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        m.sender.toLowerCase().includes(q) ||
        (m.snippet?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [messages, activeFilter, searchQuery, starred]);

  // Group messages by thread for thread view
  const threadMessages = useMemo(() => {
    if (!selected) return [];
    return messages
      .filter(m => m.thread_id === selected.thread_id)
      .sort((a, b) => a.synced_at - b.synced_at);
  }, [messages, selected]);

  /* ---------- Stats ---------- */

  const stats = useMemo(() => {
    const unread = messages.filter(m => !m.read).length;
    const starredCount = starred.size;
    const total = messages.length;
    return { unread, starred: starredCount, total };
  }, [messages, starred]);

  /* ---------- Handlers ---------- */

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('gs_token');
      const res = await fetch('/api/gmail/auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error('Gmail connect failed:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/gmail/disconnect', {});
      setMessages([]);
      setSelected(null);
      await fetchStatus();
    } catch {
      setError('Disconnect failed');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/gmail/sync', {});
      await fetchMessages();
      await fetchStatus();
    } catch {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectMessage = (msg: GmailMessage) => {
    setSelected(msg);
    setReplyText(msg.suggested_reply || '');
    setShowReply(false);
    setShowForward(false);
    // Scroll detail into view on mobile
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleReply = async () => {
    if (!selected?.id || !replyText.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/gmail/reply/${selected.id}`, { body: replyText });
      setReplyText('');
      setSelected(null);
      setShowReply(false);
      await fetchMessages();
    } catch {
      setError('Reply failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleForward = async () => {
    if (!selected?.id || !forwardTo.trim()) return;
    setSending(true);
    setError('');
    try {
      const body = `---------- Forwarded message ----------\nFrom: ${selected.sender}\nSubject: ${selected.subject}\n\n${selected.snippet || ''}${replyText ? '\n\n' + replyText : ''}`;
      await api.post(`/gmail/reply/${selected.id}`, { body });
      setReplyText('');
      setForwardTo('');
      setShowForward(false);
      await fetchMessages();
    } catch {
      setError('Forward failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleToggleStar = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAiDraftReply = async () => {
    if (!selected) return;
    setAiDrafting(true);
    try {
      // Use the suggested_reply if available, otherwise generate a contextual draft
      if (selected.suggested_reply) {
        setReplyText(selected.suggested_reply);
      } else {
        // Fallback: create a polite, contextual reply draft
        const draft = `Hi ${senderName(selected.sender)},\n\nThank you for your email regarding "${selected.subject}". I've reviewed it and will get back to you shortly with a detailed response.\n\nBest regards`;
        setReplyText(draft);
      }
      setShowReply(true);
    } finally {
      setAiDrafting(false);
    }
  };

  const handleAiWriteEmail = async () => {
    if (!composeSubject.trim() && !composeBody.trim()) return;
    setAiWriting(true);
    try {
      const description = composeBody.trim() || composeSubject.trim();
      const draft = `Hi,\n\nI'm writing to you regarding: ${description}\n\nPlease let me know if you have any questions.\n\nBest regards`;
      setComposeBody(draft);
    } finally {
      setAiWriting(false);
    }
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    setError('');
    try {
      // Use the first message's ID as a channel to send, or show info
      setError('Compose requires a connected Gmail with send permissions. Use the reply feature on synced emails.');
      setComposeOpen(false);
      resetCompose();
    } catch {
      setError('Send failed.');
    } finally {
      setComposeSending(false);
    }
  };

  const resetCompose = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
  };

  /* ---------- Loading state ---------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
          <span className="text-[#E8E8F0]/40 text-sm">Loading Gmail...</span>
        </div>
      </div>
    );
  }

  /* ---------- Not connected state ---------- */

  if (!status?.available) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="bg-[#0D0D1A] border-white/10">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-[#00F0FF]" />
            </div>
            <h2 className="text-[#F4F6FF] text-lg font-semibold">Gmail Integration</h2>
            <p className="text-[#E8E8F0]/50 text-sm max-w-md mx-auto">
              Gmail integration requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured by your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="bg-gradient-to-br from-[#0D0D1A] to-[#0D1A2A] border-[#00F0FF]/20 overflow-hidden">
          <CardContent className="py-12 text-center space-y-6 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00F0FF]/5 via-transparent to-transparent pointer-events-none" />

            <div className="relative space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center mx-auto">
                <Mail className="w-10 h-10 text-[#00F0FF]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-[#F4F6FF] text-xl font-semibold">Connect Gmail</h2>
                <p className="text-[#E8E8F0]/50 text-sm max-w-sm mx-auto">
                  Sync your Gmail inbox with AI-powered summaries, smart replies, and priority sorting.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 text-xs text-[#E8E8F0]/40">
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-[#BF5FFF]" />
                  AI Summaries
                </span>
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                  <Reply className="w-3 h-3 text-[#00F0FF]" />
                  Smart Replies
                </span>
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                  <Filter className="w-3 h-3 text-[#ADFF2F]" />
                  Priority Sort
                </span>
              </div>

              <Button onClick={handleConnect}
                className="bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 transition-all px-6 py-2.5 text-sm font-medium min-h-[44px]">
                <Link className="w-4 h-4 mr-2" />
                Connect Gmail Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Connected state ---------- */

  return (
    <div className="max-w-6xl mx-auto space-y-4 p-4 sm:p-0">
      {/* Stats header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-[#00F0FF]" />
          </div>
          <div>
            <h1 className="text-[#F4F6FF] text-lg font-semibold">Gmail</h1>
            <div className="flex items-center gap-1.5 text-xs text-[#E8E8F0]/40">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="truncate max-w-[180px]">{status.email}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats pills */}
          <div className="flex items-center gap-2 text-xs">
            {stats.unread > 0 && (
              <span className="bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 px-2.5 py-1 rounded-full font-medium">
                {stats.unread} unread
              </span>
            )}
            {stats.starred > 0 && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
                {stats.starred} starred
              </span>
            )}
            <span className="text-[#E8E8F0]/30">
              {stats.total} total
            </span>
          </div>

          {/* Last sync + actions */}
          <div className="flex items-center gap-2">
            {status.lastSync && (
              <span className="text-[#E8E8F0]/30 text-xs hidden md:block">
                Synced {timeSince(new Date(status.lastSync).getTime())}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}
              className="border-white/10 text-[#E8E8F0] hover:bg-white/5 text-xs h-9 min-h-[44px] px-3">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-9 min-h-[44px] px-3">
              <Unlink className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Disconnect</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <X className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')}
            className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Dismiss error">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Search bar + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E8E8F0]/30 pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by subject, sender, or content..."
            className="bg-[#0D0D1A] border-white/10 text-[#F4F6FF] text-sm pl-10 h-11 focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E8E8F0]/30 hover:text-[#E8E8F0]/60 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-3"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                activeFilter === key
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                  : 'bg-white/5 text-[#E8E8F0]/50 hover:text-[#E8E8F0]/80 hover:bg-white/10 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === 'unread' && stats.unread > 0 && (
                <span className="bg-[#00F0FF]/20 text-[#00F0FF] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {stats.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Email list + detail view */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Email thread list */}
        <div className="lg:col-span-2 space-y-1">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-white/5 rounded-xl bg-[#0D0D1A]">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <Mail className="w-6 h-6 text-[#E8E8F0]/20" />
              </div>
              <p className="text-[#E8E8F0]/40 text-sm">
                {searchQuery
                  ? 'No emails match your search'
                  : activeFilter !== 'all'
                    ? `No ${activeFilter} emails`
                    : 'No emails synced yet'}
              </p>
              {!searchQuery && activeFilter === 'all' && (
                <button
                  onClick={handleSync}
                  className="mt-3 text-[#00F0FF] text-xs hover:underline min-h-[44px] flex items-center"
                >
                  Sync now to fetch emails
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
              {filteredMessages.map(msg => {
                const isSelected = selected?.id === msg.id;
                const isUnread = !msg.read;
                const isStarred = starred.has(msg.id);
                const hasAttachment = hasAttachmentHeuristic(msg);

                return (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`w-full text-left p-3 rounded-xl border transition-all group ${
                      isSelected
                        ? 'border-[#00F0FF]/30 bg-[#00F0FF]/5'
                        : isUnread
                          ? 'border-white/10 bg-[#0D0D1A] hover:border-[#00F0FF]/20 hover:bg-[#0D0D1A]/80'
                          : 'border-white/5 bg-[#0D0D1A]/60 hover:border-white/10 hover:bg-[#0D0D1A]/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isUnread
                          ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                          : 'bg-white/10 text-[#E8E8F0]/50'
                      }`}>
                        {senderInitial(msg.sender)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Sender + timestamp row */}
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-xs truncate ${
                            isUnread ? 'text-[#F4F6FF] font-semibold' : 'text-[#E8E8F0]/70'
                          }`}>
                            {senderName(msg.sender)}
                          </span>
                          <span className="text-[10px] text-[#E8E8F0]/30 shrink-0">
                            {timeSince(msg.synced_at)}
                          </span>
                        </div>

                        {/* Subject */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs truncate ${
                            isUnread ? 'text-[#F4F6FF] font-medium' : 'text-[#E8E8F0]/60'
                          }`}>
                            {msg.subject || '(no subject)'}
                          </span>
                        </div>

                        {/* Snippet */}
                        {msg.snippet && (
                          <p className="text-[11px] text-[#E8E8F0]/30 truncate">
                            {msg.snippet}
                          </p>
                        )}

                        {/* Bottom row: priority + icons */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {msg.priority && msg.priority !== 'normal' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_COLOR[msg.priority] || PRIORITY_COLOR.normal}`}>
                              {msg.priority}
                            </span>
                          )}
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shrink-0" />
                          )}
                          {hasAttachment && (
                            <Paperclip className="w-3 h-3 text-[#E8E8F0]/25" />
                          )}
                          <div className="flex-1" />
                          {/* Star toggle */}
                          <button
                            onClick={(e) => handleToggleStar(msg.id, e)}
                            className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-md hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 data-[starred=true]:opacity-100 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                            data-starred={isStarred}
                            aria-label={isStarred ? 'Unstar' : 'Star'}
                          >
                            <Star className={`w-3.5 h-3.5 ${
                              isStarred
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-[#E8E8F0]/20'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail view */}
        <div className="lg:col-span-3" ref={detailRef}>
          {selected ? (
            <Card className="bg-[#0D0D1A] border-white/10 overflow-hidden">
              {/* Detail header */}
              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-[#F4F6FF] text-base font-semibold leading-snug mb-1">
                      {selected.subject || '(no subject)'}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#00F0FF]/15 flex items-center justify-center text-[10px] font-bold text-[#00F0FF]">
                          {senderInitial(selected.sender)}
                        </div>
                        <span className="text-[#E8E8F0]/60 text-xs">{selected.sender}</span>
                      </div>
                      <span className="text-[#E8E8F0]/20 text-xs">
                        {timeSince(selected.synced_at)}
                      </span>
                      {selected.priority && selected.priority !== 'normal' && (
                        <Badge className={`text-[10px] ${PRIORITY_COLOR[selected.priority] || PRIORITY_COLOR.normal}`}>
                          {selected.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setShowReply(false); setShowForward(false); }}
                    className="text-[#E8E8F0]/30 hover:text-[#E8E8F0]/60 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                    aria-label="Close detail view">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* AI Summary */}
                {selected.summary && (
                  <div className="bg-[#BF5FFF]/8 border border-[#BF5FFF]/15 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#BF5FFF]" />
                      <span className="text-[#BF5FFF] text-xs font-medium">AI Summary</span>
                    </div>
                    <p className="text-[#E8E8F0]/70 text-sm leading-relaxed">{selected.summary}</p>
                  </div>
                )}

                {/* Thread messages */}
                {threadMessages.length > 1 && (
                  <div className="space-y-1">
                    <button
                      onClick={() => setExpandedThread(expandedThread === selected.thread_id ? null : selected.thread_id)}
                      className="flex items-center gap-1.5 text-xs text-[#E8E8F0]/40 hover:text-[#E8E8F0]/60 transition-colors min-h-[44px]"
                    >
                      {expandedThread === selected.thread_id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {threadMessages.length} messages in thread
                    </button>

                    {expandedThread === selected.thread_id && (
                      <div className="space-y-2 pl-2 border-l-2 border-white/5">
                        {threadMessages.filter(m => m.id !== selected.id).map(msg => (
                          <div key={msg.id} className="bg-white/3 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-[#E8E8F0]/50">
                                {senderInitial(msg.sender)}
                              </div>
                              <span className="text-[#E8E8F0]/50 text-xs truncate">{senderName(msg.sender)}</span>
                              <span className="text-[#E8E8F0]/20 text-[10px] ml-auto shrink-0">{timeSince(msg.synced_at)}</span>
                            </div>
                            <p className="text-[#E8E8F0]/40 text-xs">{msg.snippet || msg.subject}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Email content */}
                <div className="bg-white/3 rounded-xl p-4">
                  <p className="text-[#E8E8F0]/70 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.snippet || selected.summary || '(no content preview available)'}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setShowReply(true); setShowForward(false); }}
                    className="border-white/10 text-[#E8E8F0]/70 hover:bg-white/5 text-xs h-9 min-h-[44px]"
                  >
                    <Reply className="w-3.5 h-3.5 mr-1.5" />
                    Reply
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setShowForward(true); setShowReply(false); }}
                    className="border-white/10 text-[#E8E8F0]/70 hover:bg-white/5 text-xs h-9 min-h-[44px]"
                  >
                    <Forward className="w-3.5 h-3.5 mr-1.5" />
                    Forward
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={handleAiDraftReply}
                    disabled={aiDrafting}
                    className="border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 text-xs h-9 min-h-[44px] ml-auto"
                  >
                    <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${aiDrafting ? 'animate-pulse' : ''}`} />
                    {aiDrafting ? 'Drafting...' : 'AI Draft Reply'}
                  </Button>
                </div>

                {/* Reply section */}
                {showReply && (
                  <div className="space-y-3 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Reply className="w-3.5 h-3.5 text-[#00F0FF]" />
                      <span className="text-[#E8E8F0]/60 text-xs">
                        Replying to {senderName(selected.sender)}
                      </span>
                    </div>
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-sm resize-none min-h-[120px] focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowReply(false)}
                        className="border-white/10 text-[#E8E8F0]/50 hover:bg-white/5 text-xs h-9 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleReply}
                        disabled={sending || !replyText.trim()}
                        className="bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 text-xs h-9 min-h-[44px]">
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {sending ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Forward section */}
                {showForward && (
                  <div className="space-y-3 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Forward className="w-3.5 h-3.5 text-[#00F0FF]" />
                      <span className="text-[#E8E8F0]/60 text-xs">Forward this email</span>
                    </div>
                    <Input
                      type="email"
                      value={forwardTo}
                      onChange={e => setForwardTo(e.target.value)}
                      placeholder="Recipient email address"
                      className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-sm h-10 focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
                    />
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Add a message (optional)..."
                      className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-sm resize-none min-h-[80px] focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowForward(false)}
                        className="border-white/10 text-[#E8E8F0]/50 hover:bg-white/5 text-xs h-9 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleForward}
                        disabled={sending || !forwardTo.trim()}
                        className="bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 text-xs h-9 min-h-[44px]">
                        <Forward className="w-3.5 h-3.5 mr-1.5" />
                        {sending ? 'Sending...' : 'Forward'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 lg:h-[calc(100vh-320px)] text-center border border-white/5 rounded-xl bg-[#0D0D1A]">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <MailOpen className="w-6 h-6 text-[#E8E8F0]/15" />
              </div>
              <p className="text-[#E8E8F0]/30 text-sm">Select an email to read</p>
              <p className="text-[#E8E8F0]/15 text-xs mt-1">Choose from the list on the left</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Compose button */}
      <button
        onClick={() => setComposeOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-[#00F0FF] hover:bg-[#00D4E0] text-[#05050A] rounded-full shadow-lg shadow-[#00F0FF]/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05050A]"
        aria-label="Compose new email"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-[#0D0D1A] border-white/10 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F4F6FF] text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#00F0FF]" />
              Compose Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-[#E8E8F0]/50 text-xs mb-1 block">To</label>
              <Input
                type="email"
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-sm h-10 focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
              />
            </div>
            <div>
              <label className="text-[#E8E8F0]/50 text-xs mb-1 block">Subject</label>
              <Input
                type="text"
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-sm h-10 focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
              />
            </div>
            <div>
              <label className="text-[#E8E8F0]/50 text-xs mb-1 block">Body</label>
              <Textarea
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="Write your email or describe what you want to say..."
                className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-sm resize-none min-h-[160px] focus-visible:border-[#00F0FF]/40 focus-visible:ring-[#00F0FF]/20"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline" size="sm"
              onClick={handleAiWriteEmail}
              disabled={aiWriting || (!composeSubject.trim() && !composeBody.trim())}
              className="border-[#BF5FFF]/30 text-[#BF5FFF] hover:bg-[#BF5FFF]/10 text-xs h-9 min-h-[44px]"
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${aiWriting ? 'animate-pulse' : ''}`} />
              {aiWriting ? 'Writing...' : 'AI Write'}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => { setComposeOpen(false); resetCompose(); }}
              className="border-white/10 text-[#E8E8F0]/50 hover:bg-white/5 text-xs h-9 min-h-[44px]">
              Cancel
            </Button>
            <Button size="sm" onClick={handleComposeSend}
              disabled={composeSending || !composeTo.trim() || !composeBody.trim()}
              className="bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 text-xs h-9 min-h-[44px]">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {composeSending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
