import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import {
  Mail, RefreshCw, Link, Unlink, Search, Plus, Sparkles, Reply, Filter, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import api, { agentService } from '@/services/api';
import { EmailList } from './EmailList';
import { EmailDetail } from './EmailDetail';
import { ComposeDialog } from './ComposeDialog';
import {
  FILTER_OPTIONS, timeSince, senderName, hasAttachmentHeuristic,
} from './helpers';
import type { GmailStatus, GmailMessage, FilterKey, SmartReply } from './helpers';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GmailPage({ shell = true }: { shell?: boolean } = {}) {
  /* ---------- State ---------- */
  const [status, setStatus]               = useState<GmailStatus | null>(null);
  const [messages, setMessages]           = useState<GmailMessage[]>([]);
  const [selected, setSelected]           = useState<GmailMessage | null>(null);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyText, setReplyText]         = useState('');
  const [syncing, setSyncing]             = useState(false);
  const [sending, setSending]             = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [activeFilter, setActiveFilter]   = useState<FilterKey>('all');
  const [starred, setStarred]             = useState<Set<number>>(() => new Set());
  const [composeOpen, setComposeOpen]     = useState(false);
  const [composeTo, setComposeTo]         = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody]     = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [aiDrafting, setAiDrafting]       = useState(false);
  const [aiWriting, setAiWriting]         = useState(false);
  const [showReply, setShowReply]         = useState(false);
  const [showForward, setShowForward]     = useState(false);
  const [forwardTo, setForwardTo]         = useState('');
  const [smartReplies, setSmartReplies]   = useState<SmartReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [threadSummary, setThreadSummary] = useState('');
  const [summarizing, setSummarizing]     = useState(false);
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
    void load();
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

  /* ---------- Derived state ---------- */

  const filteredMessages = useMemo(() => {
    let result = messages;
    if (activeFilter === 'unread')      result = result.filter(m => !m.read);
    else if (activeFilter === 'starred') result = result.filter(m => starred.has(m.id));
    else if (activeFilter === 'attachments') result = result.filter(m => hasAttachmentHeuristic(m));
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

  const threadMessages = useMemo(() => {
    if (!selected) return [];
    return messages
      .filter(m => m.thread_id === selected.thread_id)
      .sort((a, b) => a.synced_at - b.synced_at);
  }, [messages, selected]);

  const stats = useMemo(() => ({
    unread:  messages.filter(m => !m.read).length,
    starred: starred.size,
    total:   messages.length,
  }), [messages, starred]);

  /* ---------- Handlers ---------- */

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('gs_token');
      const res = await fetch('/api/gmail/auth', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      });
      const data = await res.json() as { url?: string };
      if (data?.url) window.location.href = data.url;
    } catch { /* ignore */ }
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

  const generateSmartReplies = useCallback(async (snippet: string) => {
    setLoadingReplies(true);
    setSmartReplies([]);
    try {
      const res = await agentService.chat(
        `Generate exactly 3 short email reply options for the following email. Return ONLY a JSON array, no other text: [{"text":"...","tone":"positive|neutral|action"}]. Each reply must be 5-15 words. Email: ${snippet.slice(0, 500)}`,
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
    } catch { /* silently fail — smart replies are optional */ }
    finally { setLoadingReplies(false); }
  }, []);

  const handleSelectMessage = (msg: GmailMessage) => {
    setSelected(msg);
    setReplyText(msg.suggested_reply || '');
    setShowReply(false);
    setShowForward(false);
    setSmartReplies([]);
    setThreadSummary('');
    setSummaryExpanded(false);
    if ((msg.snippet || msg.subject || '').length > 10) {
      void generateSmartReplies(msg.snippet || msg.subject || '');
    }
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleReply = async () => {
    if (!selected?.id || !selected.inbox_id || !replyText.trim()) return;
    setSending(true);
    setError('');
    void notifyStart('reply-email');
    try {
      await api.post(`/gmail/reply/${selected.id}`, { body: replyText });
      setReplyText(''); setSelected(null); setShowReply(false);
      await fetchMessages();
      void notifyDone('Reply sent');
    } catch {
      setError('Reply failed. Please try again.');
      void notifyFail('Reply failed');
    } finally { setSending(false); }
  };

  const handleForward = async () => {
    if (!selected?.id || !forwardTo.trim()) return;
    setSending(true);
    setError('');
    void notifyStart('forward-email');
    try {
      const body = `---------- Forwarded message ----------\nFrom: ${selected.sender}\nSubject: ${selected.subject}\n\n${selected.snippet || ''}${replyText ? '\n\n' + replyText : ''}`;
      await api.post(`/gmail/reply/${selected.id}`, { body });
      setReplyText(''); setForwardTo(''); setShowForward(false);
      await fetchMessages();
      void notifyDone('Email forwarded');
    } catch {
      setError('Forward failed. Please try again.');
      void notifyFail('Forward failed');
    } finally { setSending(false); }
  };

  const handleToggleStar = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSummarize = useCallback(async () => {
    if (!selected) return;
    setSummarizing(true);
    setThreadSummary('');
    setSummaryExpanded(true);
    try {
      const res = await agentService.chat(
        `Summarize this email in 3 concise bullet points (use - prefix). Be direct and factual.\nSubject: ${selected.subject}\nContent: ${(selected.snippet || selected.summary || '').slice(0, 2000)}`,
        'web'
      );
      setThreadSummary(res.data?.text || 'Could not generate summary.');
    } catch {
      setThreadSummary('Could not summarize this email.');
    } finally { setSummarizing(false); }
  }, [selected]);

  const handleAiDraftReply = async () => {
    if (!selected) return;
    setAiDrafting(true);
    setShowReply(true);
    try {
      if (selected.suggested_reply) { setReplyText(selected.suggested_reply); return; }
      const snippet = selected.snippet || selected.subject || '';
      const res = await agentService.chat(
        `Draft a concise, professional email reply to this message. Write ONLY the reply body (no subject line). From: ${senderName(selected.sender)}\nSubject: ${selected.subject}\nContent: ${snippet.slice(0, 1000)}`,
        'web'
      );
      const draft = res.data?.text || '';
      setReplyText(draft || `Hi ${senderName(selected.sender)},\n\nThank you for your email regarding "${selected.subject}". I've reviewed it and will get back to you shortly.\n\nBest regards`);
    } catch {
      setReplyText(`Hi ${senderName(selected.sender)},\n\nThank you for your email regarding "${selected.subject}". I've reviewed it and will get back to you shortly.\n\nBest regards`);
    } finally { setAiDrafting(false); }
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
      setComposeBody(res.data?.text || `Hi,\n\nI'm writing to you regarding: ${description}\n\nPlease let me know if you have any questions.\n\nBest regards`);
    } catch {
      setComposeBody(`Hi,\n\nI'm writing to you regarding: ${composeBody.trim() || composeSubject.trim()}\n\nPlease let me know if you have any questions.\n\nBest regards`);
    } finally { setAiWriting(false); }
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
      setComposeTo(''); setComposeSubject(''); setComposeBody('');
      void notifyDone('Email sent');
    } catch {
      setError('Send failed. Make sure Gmail is connected with send permissions.');
      void notifyFail('Compose send failed');
    } finally { setComposeSending(false); }
  };

  /* ---------- Loading ---------- */

  if (loading) {
    return (
      <DashboardPageWrapper>
        <PageShell maxWidth="6xl">
          <BlurFade delay={0}>
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--ag-aria)]/30 border-t-[var(--ag-aria)] rounded-full animate-spin" />
                <span className="text-[var(--ag-text-secondary)] text-sm font-medium">Loading Gmail...</span>
              </div>
            </div>
          </BlurFade>
        </PageShell>
      </DashboardPageWrapper>
    );
  }

  /* ---------- Gmail unavailable ---------- */

  if (!status?.available) {
    return (
      <DashboardPageWrapper>
        <PageShell maxWidth="5xl">
          <BlurFade delay={0}><PageHeader icon={Mail} title="Gmail" subtitle="Integration unavailable" /></BlurFade>
          <BlurFade delay={0.1}>
            <SectionCard>
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ag-aria)]/10 flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-[var(--ag-aria)]" />
                </div>
                <h2 className="text-[var(--ag-text-primary)] text-lg font-heading font-semibold">Gmail Integration</h2>
                <p className="text-[var(--ag-text-secondary)] text-sm max-w-md mx-auto">
                  Gmail integration requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured by your administrator.
                </p>
              </div>
            </SectionCard>
          </BlurFade>
        </PageShell>
      </DashboardPageWrapper>
    );
  }

  /* ---------- Not connected ---------- */

  if (!status?.connected) {
    return (
      <DashboardPageWrapper>
        <PageShell maxWidth="5xl">
          <BlurFade delay={0}><PageHeader icon={Mail} title="Gmail" subtitle="Connect your inbox" /></BlurFade>
          <BlurFade delay={0.1}>
            <SectionCard>
              <div className="py-12 text-center space-y-6 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--ag-aria)]/5 via-transparent to-transparent pointer-events-none rounded-xl" />
                <div className="relative space-y-6">
                  <BlurFade delay={0.2}>
                    <div className="w-20 h-20 rounded-2xl bg-[var(--ag-aria)]/10 border border-[var(--ag-aria)]/20 flex items-center justify-center mx-auto">
                      <Mail className="w-10 h-10 text-[var(--ag-aria)]" />
                    </div>
                  </BlurFade>
                  <BlurFade delay={0.3}>
                    <div className="space-y-2">
                      <h2 className="text-[var(--ag-text-primary)] text-xl font-heading font-semibold">Connect Gmail</h2>
                      <p className="text-[var(--ag-text-secondary)] text-sm max-w-sm mx-auto">
                        Sync your Gmail inbox with AI-powered summaries, smart replies, and priority sorting.
                      </p>
                    </div>
                  </BlurFade>
                  <BlurFade delay={0.4}>
                    <div className="flex flex-wrap justify-center gap-3 text-xs text-[var(--ag-text-secondary)]">
                      {[
                        { icon: Sparkles, label: 'AI Summaries', color: 'text-[var(--ag-text-accent)]' },
                        { icon: Reply,    label: 'Smart Replies', color: 'text-[var(--ag-aria)]' },
                        { icon: Filter,   label: 'Priority Sort',  color: 'text-[var(--ag-lime)]' },
                      ].map(({ icon: Icon, label, color }) => (
                        <span key={label} className="flex items-center gap-1.5 bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] px-3 py-1.5 rounded-full">
                          <Icon className={`w-3 h-3 ${color}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </BlurFade>
                  <BlurFade delay={0.5}>
                    <Button onClick={handleConnect}
                      className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-text-accent)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-text-accent)]/90 text-white px-6 py-2.5 text-sm font-medium min-h-[44px] shadow-lg shadow-[var(--ag-violet)]/20 active:scale-[0.96]">
                      <Link className="w-4 h-4 mr-2" />
                      Connect Gmail Account
                    </Button>
                  </BlurFade>
                </div>
              </div>
            </SectionCard>
          </BlurFade>
        </PageShell>
      </DashboardPageWrapper>
    );
  }

  /* ---------- Connected ---------- */

  const Wrapper = shell ? PageShell : 'div';
  const wrapperProps = shell ? { maxWidth: '6xl' as const } : {};

  return (
    <DashboardPageWrapper>
      <Wrapper {...wrapperProps}>
        <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">

          {/* Header */}
          <BlurFade delay={0}>
            <PageHeader
              icon={Mail}
              title="Gmail"
              subtitle={status.email ? `Connected as ${status.email}` : `${stats.total} messages`}
              actions={
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs">
                    {stats.unread > 0 && (
                      <span className="bg-[var(--ag-aria)]/10 text-[var(--ag-aria)] border border-[var(--ag-aria)]/20 px-2.5 py-1 rounded-full font-medium">
                        {stats.unread} unread
                      </span>
                    )}
                    {stats.starred > 0 && (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
                        {stats.starred} starred
                      </span>
                    )}
                    <span className="text-[var(--ag-text-secondary)]">{stats.total} total</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {status.lastSync && (
                      <span className="text-[var(--ag-text-secondary)] text-xs hidden md:block">
                        Synced {timeSince(new Date(status.lastSync).getTime())}
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}
                      className="border-[var(--ag-border-default)] text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface)] text-xs h-9 min-h-[44px] px-3">
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
          </BlurFade>

          {/* Error banner */}
          {error && (
            <BlurFade delay={0.1}>
              <SectionCard padding="sm">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <X className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')}
                    className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Dismiss">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </SectionCard>
            </BlurFade>
          )}

          {/* Search + filters */}
          <BlurFade delay={0.2}>
            <SectionCard padding="sm">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-secondary)] pointer-events-none" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by subject, sender, or content..."
                    className="bg-[var(--ag-bg-base)] border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] text-sm pl-10 h-11 focus-visible:border-[var(--ag-violet)]/40 focus-visible:ring-[var(--ag-violet)]/20"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-w-[44px] min-h-[44px] flex items-center justify-center -mr-3"
                      aria-label="Clear search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {FILTER_OPTIONS.map(({ key, label, icon: FilterIcon }) => (
                    <button key={key} onClick={() => setActiveFilter(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-[transform,background-color,color] active:scale-[0.96] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 ${
                        activeFilter === key
                          ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] border border-[var(--ag-violet)]/30'
                          : 'bg-[var(--ag-bg-surface)] backdrop-blur-xl text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface-hover)] border border-transparent'
                      }`}>
                      <FilterIcon className="w-3.5 h-3.5" />
                      {label}
                      {key === 'unread' && stats.unread > 0 && (
                        <span className="bg-[var(--ag-aria)]/20 text-[var(--ag-aria)] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {stats.unread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>
          </BlurFade>

          {/* List + detail grid */}
          <BlurFade delay={0.3}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 space-y-1">
                <EmailList
                  messages={filteredMessages}
                  selected={selected}
                  starred={starred}
                  searchQuery={searchQuery}
                  activeFilter={activeFilter}
                  onSelect={handleSelectMessage}
                  onToggleStar={handleToggleStar}
                  onSync={handleSync}
                />
              </div>
              <div className="lg:col-span-3" ref={detailRef}>
                <EmailDetail
                  selected={selected}
                  threadMessages={threadMessages}
                  expandedThread={expandedThread}
                  replyText={replyText}
                  showReply={showReply}
                  showForward={showForward}
                  forwardTo={forwardTo}
                  smartReplies={smartReplies}
                  loadingReplies={loadingReplies}
                  threadSummary={threadSummary}
                  summarizing={summarizing}
                  summaryExpanded={summaryExpanded}
                  sending={sending}
                  aiDrafting={aiDrafting}
                  onClose={() => {
                    setSelected(null);
                    setShowReply(false);
                    setShowForward(false);
                    setSmartReplies([]);
                    setThreadSummary('');
                    setSummaryExpanded(false);
                  }}
                  onExpandThread={setExpandedThread}
                  onSetReplyText={setReplyText}
                  onShowReply={setShowReply}
                  onShowForward={setShowForward}
                  onSetForwardTo={setForwardTo}
                  onSetSummaryExpanded={setSummaryExpanded}
                  onReply={handleReply}
                  onForward={handleForward}
                  onSummarize={handleSummarize}
                  onAiDraftReply={handleAiDraftReply}
                />
              </div>
            </div>
          </BlurFade>

          {/* Floating compose button */}
          <BlurFade delay={0.4}>
            <button
              onClick={() => setComposeOpen(true)}
              className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-text-accent)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-text-accent)]/90 text-white rounded-full shadow-lg shadow-[var(--ag-violet)]/30 flex items-center justify-center transition-[transform,box-shadow] duration-200 hover:scale-105 active:scale-[0.96] z-40 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ag-bg-base)]"
              aria-label="Compose new email"
            >
              <Plus className="w-6 h-6" />
            </button>
          </BlurFade>

          <ComposeDialog
            open={composeOpen}
            onOpenChange={setComposeOpen}
            composeTo={composeTo}
            composeSubject={composeSubject}
            composeBody={composeBody}
            composeSending={composeSending}
            aiWriting={aiWriting}
            onSetComposeTo={setComposeTo}
            onSetComposeSubject={setComposeSubject}
            onSetComposeBody={setComposeBody}
            onSend={handleComposeSend}
            onAiWrite={handleAiWriteEmail}
          />
        </div>
      </Wrapper>
    </DashboardPageWrapper>
  );
}
