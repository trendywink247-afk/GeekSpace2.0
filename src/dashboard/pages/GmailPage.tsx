import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  Mail, RefreshCw, Link, Unlink, Send, X, ChevronDown, ChevronUp,
  Star, Paperclip, Search, Plus, Sparkles, Reply, Forward,
  Filter, MailOpen, Inbox, FileText, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';

import api, { agentService } from '@/services/api';

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
  low: 'bg-gray-500/20 text-[var(--ag-text-muted)] border-gray-500/30',
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

export function GmailPage({ shell = true }: { shell?: boolean } = {}) {
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
  const [smartReplies, setSmartReplies] = useState<Array<{text: string; tone: 'positive'|'neutral'|'action'}>>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [threadSummary, setThreadSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);

  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'aria', page: 'gmail' });

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
    void notifyStart('sync-gmail');
    try {
      await api.post('/gmail/sync', {});
      await fetchMessages();
      await fetchStatus();
      void notifyDone('Gmail synced');
    } catch {
      setError('Sync failed');
      void notifyFail('Gmail sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectMessage = (msg: GmailMessage) => {
    setSelected(msg);
    setReplyText(msg.suggested_reply || '');
    setShowReply(false);
    setShowForward(false);
    setSmartReplies([]);
    setThreadSummary('');
    setSummaryExpanded(false);
    // Generate smart replies from snippet
    const snippet = msg.snippet || msg.subject || '';
    if (snippet.length > 10) {
      void generateSmartReplies(snippet);
    }
    // Scroll detail into view on mobile
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleReply = async () => {
    if (!selected?.id || !selected.inbox_id || !replyText.trim()) return;
    setSending(true);
    setError('');
    void notifyStart('reply-email');
    try {
      await api.post(`/gmail/reply/${selected.id}`, { body: replyText });
      setReplyText('');
      setSelected(null);
      setShowReply(false);
      await fetchMessages();
      void notifyDone('Reply sent');
    } catch {
      setError('Reply failed. Please try again.');
      void notifyFail('Reply failed');
    } finally {
      setSending(false);
    }
  };

  const handleForward = async () => {
    if (!selected?.id || !forwardTo.trim()) return;
    setSending(true);
    setError('');
    void notifyStart('forward-email');
    try {
      const body = `---------- Forwarded message ----------\nFrom: ${selected.sender}\nSubject: ${selected.subject}\n\n${selected.snippet || ''}${replyText ? '\n\n' + replyText : ''}`;
      await api.post(`/gmail/reply/${selected.id}`, { body });
      setReplyText('');
      setForwardTo('');
      setShowForward(false);
      await fetchMessages();
      void notifyDone('Email forwarded');
    } catch {
      setError('Forward failed. Please try again.');
      void notifyFail('Forward failed');
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

  const generateSmartReplies = useCallback(async (emailSnippet: string) => {
    setLoadingReplies(true);
    setSmartReplies([]);
    try {
      const res = await agentService.chat(
        `Generate exactly 3 short email reply options for the following email. Return ONLY a JSON array, no other text: [{"text":"...","tone":"positive|neutral|action"}]. Each reply must be 5-15 words. Email: ${emailSnippet.slice(0, 500)}`,
        'web'
      );
      const reply = res.data?.text || '';
      const jsonMatch = reply.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{text: string; tone: string}>;
        setSmartReplies(parsed.slice(0, 3).map(r => ({
          text: r.text,
          tone: (r.tone === 'positive' || r.tone === 'action') ? r.tone : 'neutral' as const,
        })));
      }
    } catch {
      // Silently fail — smart replies are optional
    } finally {
      setLoadingReplies(false);
    }
  }, []);

  const handleSummarize = useCallback(async (emailSubject: string, emailBody: string) => {
    setSummarizing(true);
    setThreadSummary('');
    setSummaryExpanded(true);
    try {
      const res = await agentService.chat(
        `Summarize this email in 3 concise bullet points (use - prefix). Be direct and factual.\nSubject: ${emailSubject}\nContent: ${emailBody.slice(0, 2000)}`,
        'web'
      );
      setThreadSummary(res.data?.text || 'Could not generate summary.');
    } catch {
      setThreadSummary('Could not summarize this email.');
    } finally {
      setSummarizing(false);
    }
  }, []);

  const handleAiDraftReply = async () => {
    if (!selected) return;
    setAiDrafting(true);
    setShowReply(true);
    try {
      // Use the suggested_reply if available
      if (selected.suggested_reply) {
        setReplyText(selected.suggested_reply);
        return;
      }
      // Generate AI draft via agentService
      const snippet = selected.snippet || selected.subject || '';
      const res = await agentService.chat(
        `Draft a concise, professional email reply to this message. Write ONLY the reply body (no subject line). From: ${senderName(selected.sender)}\nSubject: ${selected.subject}\nContent: ${snippet.slice(0, 1000)}`,
        'web'
      );
      const draft = res.data?.text || '';
      if (draft) {
        setReplyText(draft);
      } else {
        // Fallback if AI returns empty
        setReplyText(`Hi ${senderName(selected.sender)},\n\nThank you for your email regarding "${selected.subject}". I've reviewed it and will get back to you shortly.\n\nBest regards`);
      }
    } catch {
      // Fallback on error
      setReplyText(`Hi ${senderName(selected.sender)},\n\nThank you for your email regarding "${selected.subject}". I've reviewed it and will get back to you shortly.\n\nBest regards`);
    } finally {
      setAiDrafting(false);
    }
  };

  const handleAiWriteEmail = async () => {
    if (!composeSubject.trim() && !composeBody.trim()) return;
    setAiWriting(true);
    try {
      const description = composeBody.trim() || composeSubject.trim();
      const res = await agentService.chat(
        `Write a professional email body based on this description. Write ONLY the email body text (no subject line, no "Subject:" prefix). Description: ${description}${composeSubject.trim() ? `\nSubject: ${composeSubject.trim()}` : ''}${composeTo.trim() ? `\nRecipient: ${composeTo.trim()}` : ''}`,
        'web'
      );
      const draft = res.data?.text || '';
      if (draft) {
        setComposeBody(draft);
      } else {
        setComposeBody(`Hi,\n\nI'm writing to you regarding: ${description}\n\nPlease let me know if you have any questions.\n\nBest regards`);
      }
    } catch {
      const description = composeBody.trim() || composeSubject.trim();
      setComposeBody(`Hi,\n\nI'm writing to you regarding: ${description}\n\nPlease let me know if you have any questions.\n\nBest regards`);
    } finally {
      setAiWriting(false);
    }
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return;
    setComposeSending(true);
    setError('');
    void notifyStart('compose-email');
    try {
      await api.post('/gmail/send', {
        to: composeTo.trim(),
        subject: composeSubject.trim() || '(no subject)',
        body: composeBody.trim(),
      });
      setComposeOpen(false);
      resetCompose();
      void notifyDone('Email sent');
    } catch {
      setError('Send failed. Make sure Gmail is connected with send permissions.');
      void notifyFail('Compose send failed');
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
      <PageShell maxWidth="6xl">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#FF6B9D]/30 border-t-[#FF6B9D] rounded-full animate-spin" />
            <span className="text-[var(--ag-text-secondary)] text-sm">Loading Gmail...</span>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ---------- Not connected state ---------- */

  if (!status?.available) {
    return (
      <PageShell maxWidth="5xl">
        <PageHeader
          icon={Mail}
          title="Gmail"
          subtitle="Integration unavailable"
          badge={
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#FF6B9D]/10 border border-[#FF6B9D]/30 text-[#FF6B9D]">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B9D]/50" />
              </span>
              Aria
            </span>
          }
        />
        <SectionCard>
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FF6B9D]/10 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-[#FF6B9D]" />
            </div>
            <h2 className="text-[#F4F6FF] text-lg font-semibold">Gmail Integration</h2>
            <p className="text-[#9CA3AF] text-sm max-w-md mx-auto">
              Gmail integration requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured by your administrator.
            </p>
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  if (!status?.connected) {
    return (
      <PageShell maxWidth="5xl">
        <PageHeader
          icon={Mail}
          title="Gmail"
          subtitle="Connect your inbox"
          badge={
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#FF6B9D]/10 border border-[#FF6B9D]/30 text-[#FF6B9D]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF6B9D] opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B9D]" />
              </span>
              Aria
            </span>
          }
        />
        <SectionCard>
          <div className="py-12 text-center space-y-6 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#FF6B9D]/5 via-transparent to-transparent pointer-events-none rounded-xl" />

            <div className="relative space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-[#FF6B9D]/10 border border-[#FF6B9D]/20 flex items-center justify-center mx-auto">
                <Mail className="w-10 h-10 text-[#FF6B9D]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-[#F4F6FF] text-xl font-semibold">Connect Gmail</h2>
                <p className="text-[#9CA3AF] text-sm max-w-sm mx-auto">
                  Sync your Gmail inbox with AI-powered summaries, smart replies, and priority sorting.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 text-xs text-[#9CA3AF]">
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-[#BF5FFF]" />
                  AI Summaries
                </span>
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                  <Reply className="w-3 h-3 text-[#FF6B9D]" />
                  Smart Replies
                </span>
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full">
                  <Filter className="w-3 h-3 text-[#ADFF2F]" />
                  Priority Sort
                </span>
              </div>

              <Button onClick={handleConnect}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all px-6 py-2.5 text-sm font-medium min-h-[44px]">
                <Link className="w-4 h-4 mr-2" />
                Connect Gmail Account
              </Button>
            </div>
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  /* ---------- Connected state ---------- */

  const Wrapper = shell ? PageShell : 'div';
  const wrapperProps = shell ? { maxWidth: '6xl' as const } : {};

  return (
    <Wrapper {...wrapperProps}>
    <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">
      {/* Stats header */}
      <PageHeader
        icon={Mail}
        title="Gmail"
        subtitle={status.email ? `Connected as ${status.email}` : `${stats.total} messages`}
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#FF6B9D]/10 border border-[#FF6B9D]/30 text-[#FF6B9D]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF6B9D] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B9D]" />
            </span>
            Aria
          </span>
        }
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Stats pills */}
            <div className="flex items-center gap-2 text-xs">
              {stats.unread > 0 && (
                <span className="bg-[#FF6B9D]/10 text-[#FF6B9D] border border-[#FF6B9D]/20 px-2.5 py-1 rounded-full font-medium">
                  {stats.unread} unread
                </span>
              )}
              {stats.starred > 0 && (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
                  {stats.starred} starred
                </span>
              )}
              <span className="text-[#9CA3AF]">
                {stats.total} total
              </span>
            </div>

            {/* Last sync + actions */}
            <div className="flex items-center gap-2">
              {status.lastSync && (
                <span className="text-[#9CA3AF] text-xs hidden md:block">
                  Synced {timeSince(new Date(status.lastSync).getTime())}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}
                className="border-[rgba(139,92,246,0.15)] text-[#F4F6FF] hover:bg-white/5 text-xs h-9 min-h-[44px] px-3">
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
        }
      />

      {/* Error banner */}
      {error && (
        <SectionCard padding="sm">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <X className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}
              className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Dismiss error">
              <X className="w-3 h-3" />
            </button>
          </div>
        </SectionCard>
      )}

      {/* Search bar + filters */}
      <SectionCard padding="sm">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by subject, sender, or content..."
              className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm pl-10 h-11 focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F4F6FF] min-w-[44px] min-h-[44px] flex items-center justify-center -mr-3"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {FILTER_OPTIONS.map(({ key, label, icon: FilterIcon }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                  activeFilter === key
                    ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30'
                    : 'bg-white/5 text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/10 border border-transparent'
                }`}
              >
                <FilterIcon className="w-3.5 h-3.5" />
                {label}
                {key === 'unread' && stats.unread > 0 && (
                  <span className="bg-[#FF6B9D]/20 text-[#FF6B9D] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {stats.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Email list + detail view */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Email thread list */}
        <div className="lg:col-span-2 space-y-1">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-[rgba(139,92,246,0.08)] rounded-xl bg-[rgba(12,12,30,0.6)] backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <Mail className="w-6 h-6 text-[#9CA3AF]/40" />
              </div>
              <p className="text-[#9CA3AF] text-sm">
                {searchQuery
                  ? 'No emails match your search'
                  : activeFilter !== 'all'
                    ? `No ${activeFilter} emails`
                    : 'No emails synced yet'}
              </p>
              {!searchQuery && activeFilter === 'all' && (
                <button
                  onClick={handleSync}
                  className="mt-3 text-[#8B5CF6] text-xs hover:underline min-h-[44px] flex items-center"
                >
                  Sync now to fetch emails
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 max-h-[calc(100dvh-320px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
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
                        ? 'border-[#FF6B9D]/30 bg-[#FF6B9D]/5'
                        : isUnread
                          ? 'border-[rgba(139,92,246,0.15)] bg-[rgba(12,12,30,0.6)] hover:border-[#FF6B9D]/20 hover:bg-[rgba(12,12,30,0.8)]'
                          : 'border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.4)] hover:border-[rgba(139,92,246,0.15)] hover:bg-[rgba(12,12,30,0.6)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isUnread
                          ? 'bg-[#FF6B9D]/15 text-[#FF6B9D]'
                          : 'bg-white/10 text-[#9CA3AF]'
                      }`}>
                        {senderInitial(msg.sender)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Sender + timestamp row */}
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-xs truncate ${
                            isUnread ? 'text-[#F4F6FF] font-semibold' : 'text-[#9CA3AF]'
                          }`}>
                            {senderName(msg.sender)}
                          </span>
                          <span className="text-[10px] text-[#9CA3AF]/60 shrink-0">
                            {timeSince(msg.synced_at)}
                          </span>
                        </div>

                        {/* Subject */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs truncate ${
                            isUnread ? 'text-[#F4F6FF] font-medium' : 'text-[#9CA3AF]/80'
                          }`}>
                            {msg.subject || '(no subject)'}
                          </span>
                        </div>

                        {/* Snippet */}
                        {msg.snippet && (
                          <p className="text-[11px] text-[#9CA3AF]/60 truncate">
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
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B9D] shrink-0" />
                          )}
                          {hasAttachment && (
                            <Paperclip className="w-3 h-3 text-[#9CA3AF]/40" />
                          )}
                          <div className="flex-1" />
                          {/* Star toggle */}
                          <button
                            onClick={(e) => handleToggleStar(msg.id, e)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 data-[starred=true]:opacity-100 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                            data-starred={isStarred}
                            aria-label={isStarred ? 'Unstar' : 'Star'}
                          >
                            <Star className={`w-3.5 h-3.5 ${
                              isStarred
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-[#9CA3AF]/30'
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
            <Card className="bg-[rgba(12,12,30,0.6)] backdrop-blur-xl border-[rgba(139,92,246,0.08)] overflow-hidden">
              {/* Detail header */}
              <CardHeader className="pb-3 border-b border-[rgba(139,92,246,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-[#F4F6FF] text-base font-semibold leading-snug mb-1">
                      {selected.subject || '(no subject)'}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#FF6B9D]/15 flex items-center justify-center text-[10px] font-bold text-[#FF6B9D]">
                          {senderInitial(selected.sender)}
                        </div>
                        <span className="text-[#9CA3AF] text-xs">{selected.sender}</span>
                      </div>
                      <span className="text-[#9CA3AF]/50 text-xs">
                        {timeSince(selected.synced_at)}
                      </span>
                      {selected.priority && selected.priority !== 'normal' && (
                        <Badge className={`text-[10px] ${PRIORITY_COLOR[selected.priority] || PRIORITY_COLOR.normal}`}>
                          {selected.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setShowReply(false); setShowForward(false); setSmartReplies([]); setThreadSummary(''); setSummaryExpanded(false); }}
                    className="text-[#9CA3AF] hover:text-[#F4F6FF] shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
                    aria-label="Close detail view">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* AI Summary (from sync) */}
                {selected.summary && (
                  <div className="bg-[#BF5FFF]/5 border border-[#BF5FFF]/15 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#BF5FFF]" />
                      <span className="text-[#BF5FFF] text-xs font-medium">AI Summary</span>
                    </div>
                    <p className="text-[#9CA3AF] text-sm leading-relaxed">{selected.summary}</p>
                  </div>
                )}

                {/* On-demand Thread Summary */}
                {(threadSummary || summarizing) && (
                  <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setSummaryExpanded(!summaryExpanded)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-left min-h-[44px]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[var(--ag-violet)] shrink-0" />
                      <span className="text-[var(--ag-violet)] text-xs font-medium flex-1">Thread Summary</span>
                      {summarizing ? (
                        <Loader2 className="w-3.5 h-3.5 text-[var(--ag-violet)] animate-spin shrink-0" />
                      ) : (
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--ag-violet)]/50 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {summaryExpanded && (
                      <div className="px-3 pb-3">
                        {summarizing ? (
                          <p className="text-[#9CA3AF] text-xs italic">Summarizing email...</p>
                        ) : (
                          <p className="text-[#9CA3AF] text-sm leading-relaxed whitespace-pre-wrap">{threadSummary}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Thread messages */}
                {threadMessages.length > 1 && (
                  <div className="space-y-1">
                    <button
                      onClick={() => setExpandedThread(expandedThread === selected.thread_id ? null : selected.thread_id)}
                      className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#F4F6FF] transition-colors min-h-[44px]"
                    >
                      {expandedThread === selected.thread_id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {threadMessages.length} messages in thread
                    </button>

                    {expandedThread === selected.thread_id && (
                      <div className="space-y-2 pl-2 border-l-2 border-[rgba(139,92,246,0.08)]">
                        {threadMessages.filter(m => m.id !== selected.id).map(msg => (
                          <div key={msg.id} className="bg-white/5 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-[#9CA3AF]">
                                {senderInitial(msg.sender)}
                              </div>
                              <span className="text-[#9CA3AF] text-xs truncate">{senderName(msg.sender)}</span>
                              <span className="text-[#9CA3AF]/40 text-[10px] ml-auto shrink-0">{timeSince(msg.synced_at)}</span>
                            </div>
                            <p className="text-[#9CA3AF]/70 text-xs">{msg.snippet || msg.subject}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Email content */}
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-[#F4F6FF]/80 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.snippet || selected.summary || '(no content preview available)'}
                  </p>
                </div>

                {/* Smart Reply Chips */}
                {(smartReplies.length > 0 || loadingReplies) && (
                  <div className="space-y-2">
                    <span className="text-[#9CA3AF]/60 text-[11px] font-medium uppercase tracking-wider">Smart Replies</span>
                    {loadingReplies ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-[#FF6B9D]/50 animate-spin" />
                        <span className="text-[#9CA3AF] text-xs">Generating suggestions...</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {smartReplies.map((reply, i) => (
                          <button
                            key={i}
                            onClick={() => { setReplyText(reply.text); setShowReply(true); setShowForward(false); }}
                            className={`px-3 py-1.5 rounded-full text-xs border transition-all hover:bg-white/5 min-h-[36px] ${
                              reply.tone === 'positive' ? 'border-[#00FF88]/30 text-[#00FF88] hover:border-[#00FF88]/50' :
                              reply.tone === 'action' ? 'border-[#8B5CF6]/30 text-[#8B5CF6] hover:border-[#8B5CF6]/50' :
                              'border-[#9CA3AF]/30 text-[#9CA3AF] hover:border-[#9CA3AF]/50'
                            }`}
                          >
                            {reply.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {selected.inbox_id == null ? (
                    <span className="flex items-center gap-1.5 text-[#9CA3AF] text-xs px-3 py-2 rounded-lg border border-[rgba(139,92,246,0.08)] bg-white/5 min-h-[44px]">
                      <Reply className="w-3.5 h-3.5 shrink-0" />
                      Connect Gmail first to reply
                    </span>
                  ) : (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setShowReply(true); setShowForward(false); }}
                    className="border-[rgba(139,92,246,0.15)] text-[#F4F6FF] hover:bg-white/5 text-xs h-9 min-h-[44px]"
                  >
                    <Reply className="w-3.5 h-3.5 mr-1.5" />
                    Reply
                  </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setShowForward(true); setShowReply(false); }}
                    className="border-[rgba(139,92,246,0.15)] text-[#F4F6FF] hover:bg-white/5 text-xs h-9 min-h-[44px]"
                  >
                    <Forward className="w-3.5 h-3.5 mr-1.5" />
                    Forward
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handleSummarize(selected.subject, selected.snippet || selected.summary || '')}
                    disabled={summarizing || !!threadSummary}
                    className="border-[#8B5CF6]/30 text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 text-xs h-9 min-h-[44px]"
                  >
                    {summarizing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {summarizing ? 'Summarizing...' : threadSummary ? 'Summarized' : 'Summarize'}
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
                  <div className="space-y-3 border-t border-[rgba(139,92,246,0.08)] pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Reply className="w-3.5 h-3.5 text-[#FF6B9D]" />
                      <span className="text-[#9CA3AF] text-xs">
                        Replying to {senderName(selected.sender)}
                      </span>
                    </div>
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm resize-none min-h-[120px] focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowReply(false)}
                        className="border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:bg-white/5 text-xs h-9 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleReply}
                        disabled={sending || !replyText.trim()}
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs h-9 min-h-[44px]">
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {sending ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Forward section */}
                {showForward && (
                  <div className="space-y-3 border-t border-[rgba(139,92,246,0.08)] pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Forward className="w-3.5 h-3.5 text-[#FF6B9D]" />
                      <span className="text-[#9CA3AF] text-xs">Forward this email</span>
                    </div>
                    <Input
                      type="email"
                      value={forwardTo}
                      onChange={e => setForwardTo(e.target.value)}
                      placeholder="Recipient email address"
                      className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm h-10 focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
                    />
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Add a message (optional)..."
                      className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm resize-none min-h-[80px] focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setShowForward(false)}
                        className="border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:bg-white/5 text-xs h-9 min-h-[44px]">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleForward}
                        disabled={sending || !forwardTo.trim()}
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs h-9 min-h-[44px]">
                        <Forward className="w-3.5 h-3.5 mr-1.5" />
                        {sending ? 'Sending...' : 'Forward'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 lg:h-[calc(100dvh-320px)] text-center border border-[rgba(139,92,246,0.08)] rounded-xl bg-[rgba(12,12,30,0.6)] backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <MailOpen className="w-6 h-6 text-[#9CA3AF]/30" />
              </div>
              <p className="text-[#9CA3AF] text-sm">Select an email to read</p>
              <p className="text-[#9CA3AF]/50 text-xs mt-1">Choose from the list on the left</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Compose button */}
      <button
        onClick={() => setComposeOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-full shadow-lg shadow-[#8B5CF6]/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06061a]"
        aria-label="Compose new email"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-[rgba(12,12,30,0.95)] backdrop-blur-xl border-[rgba(139,92,246,0.15)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F4F6FF] text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#FF6B9D]" />
              Compose Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-[#9CA3AF] text-xs mb-1 block">To</label>
              <Input
                type="email"
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm h-10 focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
              />
            </div>
            <div>
              <label className="text-[#9CA3AF] text-xs mb-1 block">Subject</label>
              <Input
                type="text"
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm h-10 focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
              />
            </div>
            <div>
              <label className="text-[#9CA3AF] text-xs mb-1 block">Body</label>
              <Textarea
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="Write your email or describe what you want to say..."
                className="bg-[#06061a] border-[rgba(139,92,246,0.08)] text-[#F4F6FF] text-sm resize-none min-h-[160px] focus-visible:border-[#8B5CF6]/40 focus-visible:ring-[#8B5CF6]/20"
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
              className="border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:bg-white/5 text-xs h-9 min-h-[44px]">
              Cancel
            </Button>
            <Button size="sm" onClick={handleComposeSend}
              disabled={composeSending || !composeTo.trim() || !composeBody.trim()}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs h-9 min-h-[44px]">
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {composeSending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Wrapper>
  );
}
