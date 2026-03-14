import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, Link, Unlink, Send, X, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';

import api from '@/services/api';

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

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function timeSince(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function GmailPage() {

  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      const res = await api.get<{ messages: GmailMessage[] }>('/gmail/messages');
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
      await api.post('/gmail/disconnect', null);
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
      await api.post('/gmail/sync', null);
      await fetchMessages();
      await fetchStatus();
    } catch {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleReply = async () => {
    if (!selected?.inbox_id || !replyText.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/gmail/reply/${selected.inbox_id}`, { body: replyText });
      setReplyText('');
      setSelected(null);
      await fetchMessages();
    } catch {
      setError('Reply failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#E8E8F0]/40 text-sm">Loading Gmail...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Connection card */}
      <Card className="bg-[#0D0D1A] border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#F4F6FF] text-base">
            <Mail className="w-5 h-5 text-[#00F0FF]" />
            Gmail Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!status?.available ? (
            <p className="text-[#E8E8F0]/50 text-sm">
              Gmail integration requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured.
            </p>
          ) : status.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-[#F4F6FF] text-sm truncate">
                  Connected as <span className="text-[#00F0FF]">{status.email}</span>
                </span>
                {status.unread != null && status.unread > 0 && (
                  <Badge className="bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 shrink-0">
                    {status.unread} unread
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {status.lastSync && (
                  <span className="text-[#E8E8F0]/40 text-xs hidden sm:block">
                    Last synced {timeSince(new Date(status.lastSync).getTime())}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}
                  className="border-white/10 text-[#E8E8F0] hover:bg-white/5 text-xs h-8 min-h-[32px]">
                  <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync now'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8 min-h-[32px]">
                  <Unlink className="w-3 h-3 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-[#E8E8F0]/60 text-sm">
                Connect Gmail to sync unread emails into your AI Inbox.
              </p>
              <Button size="sm" onClick={handleConnect}
                className="bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 text-xs shrink-0 ml-3">
                <Link className="w-3 h-3 mr-1" />
                Connect Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {(error) && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <X className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Message list + detail */}
      {status?.connected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Message list */}
          <div className="space-y-2">
            <h3 className="text-[#F4F6FF] text-sm font-medium">Recent Synced Emails ({messages.length})</h3>
            {messages.length === 0 ? (
              <div className="text-[#E8E8F0]/40 text-sm py-8 text-center border border-white/5 rounded-lg">
                No emails synced yet. Click &quot;Sync now&quot; to fetch recent emails.
              </div>
            ) : (
              messages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => {
                    setSelected(msg);
                    setReplyText(msg.suggested_reply || '');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selected?.id === msg.id
                      ? 'border-[#00F0FF]/30 bg-[#00F0FF]/5'
                      : 'border-white/5 bg-[#0D0D1A] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[#F4F6FF] text-xs font-medium truncate flex-1">
                      {msg.subject}
                    </span>
                    {msg.priority && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${PRIORITY_COLOR[msg.priority] || PRIORITY_COLOR.normal}`}>
                        {msg.priority}
                      </span>
                    )}
                  </div>
                  <div className="text-[#E8E8F0]/50 text-xs truncate">{msg.sender}</div>
                  {msg.snippet && (
                    <div className="text-[#E8E8F0]/30 text-xs mt-1 line-clamp-2">{msg.snippet}</div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[#E8E8F0]/20 text-[10px]">{timeSince(msg.synced_at)}</span>
                    <ChevronRight className="w-3 h-3 text-[#E8E8F0]/20" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detail view */}
          <div>
            {selected ? (
              <Card className="bg-[#0D0D1A] border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-[#F4F6FF] text-sm font-medium line-clamp-2">
                        {selected.subject}
                      </CardTitle>
                      <p className="text-[#E8E8F0]/50 text-xs mt-0.5 truncate">{selected.sender}</p>
                    </div>
                    <button onClick={() => setSelected(null)}
                      className="text-[#E8E8F0]/30 hover:text-[#E8E8F0]/60 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selected.summary && (
                    <div className="bg-[#BF5FFF]/10 border border-[#BF5FFF]/20 rounded-lg p-2">
                      <p className="text-[#BF5FFF] text-xs font-medium mb-0.5">AI Summary</p>
                      <p className="text-[#E8E8F0]/70 text-xs">{selected.summary}</p>
                    </div>
                  )}
                  {selected.snippet && !selected.summary && (
                    <p className="text-[#E8E8F0]/60 text-xs">{selected.snippet}</p>
                  )}
                  <div>
                    <label className="text-[#E8E8F0]/50 text-xs mb-1 block">Reply</label>
                    <Textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      className="bg-[#06060B] border-white/10 text-[#F4F6FF] text-xs resize-none h-24"
                    />
                  </div>
                  <Button size="sm" onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    className="w-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 text-xs h-8">
                    <Send className="w-3 h-3 mr-1" />
                    {sending ? 'Sending...' : 'Send Reply'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-48 text-[#E8E8F0]/30 text-sm border border-white/5 rounded-lg">
                Select an email to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}