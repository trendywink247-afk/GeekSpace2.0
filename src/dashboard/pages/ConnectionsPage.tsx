// ============================================================
// Improved Connections Page
// Better visual feedback, working states, QR code for WhatsApp
// ============================================================
import { PageShell } from '@/components/agentin';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Calendar,
  MapPin,
  Github,
  Twitter,
  Linkedin,
  RefreshCw,
  Shield,
  Plug,
  Activity,
  AlertTriangle,
  Plus,
  Zap,
  ExternalLink,
  X,
  Send,
  Loader2,
  CheckCircle2,
  Mail,
  Image as ImageIcon,
  Link,
  Copy,
  Check as CheckIcon,
  WifiOff,
  Wifi,
  Bell,
  ChevronDown,
  ChevronUp,
  Bot,
  Key,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';
import { notify } from '@/services/notifications';

const iconMap: Record<string, typeof MessageSquare> = {
  telegram: Send,
  'google-calendar': Calendar,
  location: MapPin,
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  email: Mail,
  whatsapp: MessageSquare,
  image: ImageIcon,
};

const colorMap: Record<string, string> = {
  telegram: '#0088cc',
  'google-calendar': '#4285f4',
  location: '#00FF88',
  github: '#f0f6fc',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
  n8n: '#ff6d5a',
  manychat: '#0084ff',
  whatsapp: '#25d366',
  'custom-webhook': '#00F0FF',
  email: '#00FF88',
  image: '#FF2D78',
};

// 42.5: Time ago formatter for last sync display
function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

type TelegramStep = 'idle' | 'generating' | 'open-bot' | 'send-code' | 'waiting' | 'success' | 'error' | 'timeout';

const MAX_TELEGRAM_POLL = 30;

export function ConnectionsPage() {
  const { integrations, connectIntegration, disconnectIntegration, loadIntegrations } = useDashboardStore();
  const isMobile = useMobileDetect();

  // 50.4: Status filter persisted to URL param
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as 'all' | 'connected' | 'disconnected') || 'all';
  const setStatusFilter = (v: 'all' | 'connected' | 'disconnected') => {
    setSearchParams(v === 'all' ? {} : { status: v }, { replace: true });
  };

  // Per-integration connecting state — avoids blocking ALL buttons when one is connecting
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const [telegramDialog, setTelegramDialog] = useState(false);
  const [telegramStep, setTelegramStep] = useState<TelegramStep>('idle');
  const [telegramLink, setTelegramLink] = useState<{
    code?: string;
    deepLink?: string | null;
    botUsername?: string | null;
    message?: string;
    linked?: boolean;
  } | null>(null);
  const [polling, setPolling] = useState(false);
  const [telegramPollAttempts, setTelegramPollAttempts] = useState(0);


  // 78.6: Telegram last message time + username (from channel_links via status endpoint)
  const [telegramLastPing, setTelegramLastPing] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);

  // Health poll state (24.1) — keyed by integration type
  const [healthStatus, setHealthStatus] = useState<Record<string, 'healthy' | 'unhealthy' | 'checking'>>({});
  // 62.7: Ping latency badge — keyed by integration type
  const [pingLatency, setPingLatency] = useState<Record<string, number | null>>({});
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  // Email dialog state
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // Invite link state (27.3)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  // Test connection result state — keyed by integration type
  const [testResult, setTestResult] = useState<Record<string, { status: 'pass' | 'fail'; message: string; at: string } | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  // 55.9: Mobile tap-to-expand connection cards
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Custom Telegram bot state
  const [customBotToken, setCustomBotToken] = useState('');
  const [customBotStatus, setCustomBotStatus] = useState<'idle' | 'verifying' | 'connected' | 'error'>('idle');
  const [customBotInfo, setCustomBotInfo] = useState<{ botName: string; botUsername: string } | null>(null);
  const [customBotError, setCustomBotError] = useState<string | null>(null);
  const [customBotExpanded, setCustomBotExpanded] = useState(false);

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await integrationService.createInvite();
      setInviteUrl(res.data.inviteUrl);
    } catch { /* ignore */ } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      notify('Invite link copied!', 'success');
      setTimeout(() => setInviteCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // 66.4: Integration event log
  const [integrationEvents, setIntegrationEvents] = useState<Array<{ id: string; action: string; details: string; icon: string; created_at: string }>>([]);
  useEffect(() => {
    integrationService.getEvents(10).then((r) => setIntegrationEvents(r.data.events)).catch(() => {});
  }, []);

  // Run health check for all connected integrations on mount and every 60s
  useEffect(() => {
    const runHealthChecks = async () => {
      const connected = integrations.filter(c => c.status === 'connected');
      if (connected.length === 0) return;
      setHealthStatus(prev => {
        const next = { ...prev };
        for (const c of connected) next[c.type] = 'checking';
        return next;
      });
      const results = await Promise.allSettled(
        connected.map(c => integrationService.testIntegration(c.type))
      );
      setHealthStatus(prev => {
        const next = { ...prev };
        results.forEach((r, i) => {
          const type = connected[i].type;
          if (r.status === 'fulfilled') {
            next[type] = r.value.data.healthy ? 'healthy' : 'unhealthy';
          } else {
            next[type] = 'unhealthy';
          }
        });
        return next;
      });
    };

    runHealthChecks();
    const interval = setInterval(runHealthChecks, 60_000);
    return () => clearInterval(interval);
  }, [integrations]);

  // 78.6: Fetch Telegram lastPing + username on mount if Telegram is connected
  useEffect(() => {
    const tg = integrations.find(i => i.type === 'telegram' && i.status === 'connected');
    if (!tg) return;
    integrationService.checkTelegramLink()
      .then(r => {
        if (r.data.lastPing) setTelegramLastPing(r.data.lastPing);
        if (r.data.username) setTelegramUsername(r.data.username);
      })
      .catch(() => {});
  }, [integrations]);

  const connectedCount = integrations.filter(c => c.status === 'connected').length;
  const totalRequests = integrations.reduce((acc, c) => acc + c.requestsToday, 0);
  const avgHealth = Math.round(integrations.filter(c => c.status === 'connected').reduce((acc, c) => acc + c.health, 0) / (connectedCount || 1));

  // 50.4: Apply status filter
  const filteredIntegrations = statusFilter === 'all'
    ? integrations
    : integrations.filter(c => statusFilter === 'connected' ? c.status === 'connected' : c.status !== 'connected');

  // Poll for Telegram link status
  const pollTelegramStatus = useCallback(async () => {
    try {
      const res = await integrationService.checkTelegramLink();
      if (res.data.linked) {
        setTelegramStep('success');
        setPolling(false);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!polling) return;
    if (telegramPollAttempts >= MAX_TELEGRAM_POLL) {
      setPolling(false);
      setTelegramStep('timeout');
      return;
    }
    // Exponential backoff: 1s → 2s → 4s, capped at 5s, with ±500ms jitter
    const base = Math.min(1000 * Math.pow(2, telegramPollAttempts), 5000);
    const jitter = Math.random() * 500 - 250;
    const delay = Math.max(500, base + jitter);
    const timer = setTimeout(() => {
      pollTelegramStatus();
      setTelegramPollAttempts(a => a + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [polling, telegramPollAttempts, pollTelegramStatus]);


  const handleEmailSave = async () => {
    setEmailSaving(true);
    try {
      await integrationService.updateNotificationEmail({ enabled: true, address: emailAddress || undefined });
      await connectIntegration('email');
      setEmailSaved(true);
      notify('Email notifications enabled!', 'success');
    } catch { /* ignore */ } finally {
      setEmailSaving(false);
    }
  };

  const handleConnect = async (type: IntegrationType) => {
    setConnectingId(type);
    try {
      if (type === 'email') {
        setEmailAddress('');
        setEmailSaved(false);
        setEmailDialog(true);
        return;
      }
      if (type === 'telegram') {
        setTelegramDialog(true);
        setTelegramStep('generating');
        setTelegramPollAttempts(0);
        try {
          const res = await integrationService.linkTelegram();
          setTelegramLink(res.data);
          if (res.data.linked) {
            // Already connected — close dialog and refresh so tile shows correct state
            setTelegramDialog(false);
            setTelegramStep('idle');
            setTelegramLink(null);
            setConnectingId(null);
            loadIntegrations();
          } else {
            setTelegramStep('open-bot');
            setPolling(true);
          }
        } catch {
          setTelegramLink({ message: 'Telegram bot is not configured on this server. Contact the admin.' });
          setTelegramStep('error');
        }
        return;
      }
      await connectIntegration(type);
      notify(`${type.charAt(0).toUpperCase() + type.slice(1)} connected!`, 'success');
    } finally {
      setConnectingId(null);
    }
  };

  // 62.7: Ping integration for latency badge
  const handlePing = async (type: string) => {
    setPinging((prev) => ({ ...prev, [type]: true }));
    setPingLatency((prev) => ({ ...prev, [type]: null }));
    try {
      const res = await integrationService.pingIntegration(type);
      setPingLatency((prev) => ({ ...prev, [type]: res.data.latencyMs }));
      setHealthStatus((prev) => ({ ...prev, [type]: res.data.healthy ? 'healthy' : 'unhealthy' }));
    } catch {
      setPingLatency((prev) => ({ ...prev, [type]: null }));
    } finally {
      setPinging((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Test connection — calls test endpoint, shows pass/fail result on card
  const handleTestConnection = async (type: string) => {
    setTesting((prev) => ({ ...prev, [type]: true }));
    setTestResult((prev) => ({ ...prev, [type]: null }));
    try {
      const res = await integrationService.testIntegration(type);
      const healthy = res.data.healthy;
      setTestResult((prev) => ({
        ...prev,
        [type]: {
          status: healthy ? 'pass' : 'fail',
          message: healthy ? 'Connection is healthy' : 'Connection has issues',
          at: new Date().toLocaleTimeString(),
        },
      }));
      setHealthStatus((prev) => ({ ...prev, [type]: healthy ? 'healthy' : 'unhealthy' }));
    } catch {
      setTestResult((prev) => ({
        ...prev,
        [type]: {
          status: 'fail',
          message: 'Test failed - service unreachable',
          at: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (integration?.type === 'email') {
      await integrationService.updateNotificationEmail({ enabled: false });
    }
    if (integration?.type === 'telegram') {
      // Must delete channel_links row so reconnect starts fresh (not showing "already linked")
      try { await integrationService.unlinkTelegram(); } catch { /* ignore if not linked */ }
    }
    notify(`${integration?.name || 'Integration'} disconnected`, 'info');
    disconnectIntegration(id);
  };

  const closeTelegramDialog = () => {
    setTelegramDialog(false);
    setTelegramLink(null);
    setTelegramStep('idle');
    setPolling(false);
    setTelegramPollAttempts(0);
    setConnectingId(null);
    // Only reload integrations, not the full dashboard
    loadIntegrations();
  };

  // Custom Telegram bot: verify & connect
  const handleCustomBotConnect = async () => {
    if (!customBotToken.trim()) return;
    setCustomBotStatus('verifying');
    setCustomBotError(null);
    try {
      const res = await integrationService.connectCustomTelegramBot({ botToken: customBotToken.trim() });
      setCustomBotInfo({ botName: res.data.botName, botUsername: res.data.botUsername });
      setCustomBotStatus('connected');
      notify('Custom Telegram bot connected!', 'success');
      loadIntegrations();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Failed to verify bot token. Please check and try again.';
      setCustomBotError(message);
      setCustomBotStatus('error');
    }
  };

  // Custom Telegram bot: disconnect
  const handleCustomBotDisconnect = async () => {
    try {
      await integrationService.disconnectCustomTelegramBot();
      setCustomBotInfo(null);
      setCustomBotStatus('idle');
      setCustomBotToken('');
      setCustomBotError(null);
      notify('Custom bot disconnected', 'info');
      loadIntegrations();
    } catch {
      notify('Failed to disconnect custom bot', 'error');
    }
  };

  // On mount, check if a custom bot is already connected
  useEffect(() => {
    integrationService.getCustomTelegramBotStatus()
      .then((r) => {
        if (r.data.connected && r.data.botName && r.data.botUsername) {
          setCustomBotInfo({ botName: r.data.botName, botUsername: r.data.botUsername });
          setCustomBotStatus('connected');
        }
      })
      .catch(() => {});
  }, []);

  const getStatusDot = (status: string, type?: string) => {
    const health = type ? healthStatus[type] : undefined;
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{
                  backgroundColor: health === 'unhealthy' ? '#FF6161' : '#00FF88',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ backgroundColor: health === 'unhealthy' ? '#FF6161' : '#00FF88' }}
              />
            </span>
            <span className={`text-xs font-medium ${health === 'unhealthy' ? 'text-[#FF6161]' : 'text-[#00FF88]'}`}>
              {health === 'unhealthy' ? 'Degraded' : 'Connected'}
            </span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF6161]" />
            <span className="text-xs text-[#FF6161] font-medium">Error -- reconnect</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#9CA3AF]" />
            <span className="text-xs text-[var(--ag-text-muted)]">Not connected</span>
          </span>
        );
    }
  };

  const getIcon = (type: string) => iconMap[type] || Zap;
  const getColor = (type: string) => colorMap[type] || '#00F0FF';

  return (
    <PageShell className="animate-in fade-in duration-500">
    <div data-testid="connections-page" className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Connections</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ADFF2F]/10 border border-[#ADFF2F]/30 text-[#ADFF2F]">Managed by Jarvis</span>
          </div>
          <p className="text-[var(--ag-text-muted)]">
            <span className="text-[var(--ag-cyan)] font-medium">{connectedCount}</span> of {integrations.length} services connected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-[#00FF88]/30 text-[#00FF88] px-3 py-1">
            <Shield className="w-4 h-4 mr-2" />
            End-to-end encrypted
          </Badge>
          <Button
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            variant="outline"
            className="border-[#BF5FFF]/40 text-[#BF5FFF] hover:bg-[#BF5FFF]/10"
          >
            {inviteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link className="w-4 h-4 mr-2" />}
            Invite
          </Button>
          <Button onClick={() => document.getElementById('integration-grid')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#00F0FF] hover:bg-[#00D4B0]">
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00FF88]/10 flex items-center justify-center">
                <Plug className="w-5 h-5 text-[#00FF88]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)]">{connectedCount}</div>
                <div className="text-xs text-[var(--ag-text-muted)]">Connected</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[var(--ag-cyan)]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)]">{totalRequests}</div>
                <div className="text-xs text-[var(--ag-text-muted)]">Requests Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFB800]/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-[#FFB800]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)]">{avgHealth}%</div>
                <div className="text-xs text-[var(--ag-text-muted)]">Avg Health</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2D78]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#FF2D78]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)]">100%</div>
                <div className="text-xs text-[var(--ag-text-muted)]">Secure</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Link Card (27.3) */}
      {inviteUrl && (
        <Card className="border-[#BF5FFF]/40 relative overflow-hidden">
          <CardContent className="p-4">
            <button
              onClick={() => setInviteUrl(null)}
              className="absolute top-4 right-4 text-[var(--ag-text-muted)] hover:text-white z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Dismiss invite card"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#BF5FFF]/20 flex items-center justify-center">
                <Link className="w-5 h-5 text-[#BF5FFF]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--ag-text-primary)]">Invite Link Generated</h3>
                <p className="text-xs text-[var(--ag-text-muted)]">Valid for 7 days — share with anyone to connect</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#06060B] rounded-lg px-3 py-2 text-xs text-[var(--ag-text-muted)] font-mono truncate border border-[#BF5FFF]/20">
                {inviteUrl}
              </div>
              <Button
                size="sm"
                onClick={handleCopyInvite}
                className={inviteCopied ? 'bg-[#00FF88] text-[#0C0C18]' : 'bg-[#BF5FFF] hover:bg-[#A855F7]'}
              >
                {inviteCopied ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Telegram Link Wizard */}
      {telegramDialog && (
        <Card className="border-[#0088cc]/40 relative overflow-hidden">
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={closeTelegramDialog} className="absolute top-4 right-4 text-[var(--ag-text-muted)] hover:text-white z-10 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close Telegram dialog">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--ag-text-primary)]">Connect Telegram</h3>
                <p className="text-xs text-[var(--ag-text-muted)]">Chat with your agent on Telegram</p>
              </div>
            </div>

            {telegramStep === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                <p className="text-sm text-[var(--ag-text-muted)]">Setting up your connection...</p>
              </div>
            )}

            {telegramStep === 'open-bot' && telegramLink?.deepLink && (
              <div className="space-y-4">
                <div className="bg-[#06060B] rounded-lg p-4 border border-[#0088cc]/20">
                  <p className="text-sm text-[var(--ag-text-primary)] font-medium mb-2">Step 1: Open Telegram</p>
                  <p className="text-xs text-[var(--ag-text-muted)]">Click below to open our bot, then send the start command.</p>
                </div>
                <a href={telegramLink.deepLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium">
                  <Send className="w-4 h-4" />
                  Open in Telegram
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {telegramStep === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-[#00FF88]" />
                <p className="text-sm text-[var(--ag-text-primary)] font-medium">Telegram connected!</p>
                <Button className="bg-[#00FF88] hover:bg-[#51EF6B] text-[#0C0C18]" onClick={closeTelegramDialog}>
                  Done
                </Button>
              </div>
            )}

            {telegramStep === 'error' && (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-[#FF6161] mx-auto mb-2" />
                <p className="text-sm text-[var(--ag-text-primary)]">Connection failed</p>
                <p className="text-xs text-[var(--ag-text-muted)] mt-1">{telegramLink?.message}</p>
              </div>
            )}

            {telegramStep === 'timeout' && (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-[#F59E0B] mx-auto mb-2" />
                <p className="text-sm text-[var(--ag-text-primary)]">Still waiting — try clicking the bot link again</p>
                <p className="text-xs text-[var(--ag-text-muted)] mt-1">No response received after 30 attempts (~2.5 min)</p>
                <Button
                  className="mt-4 bg-[#2A2A3A] hover:bg-[#3A3A4A] text-[var(--ag-text-primary)]"
                  onClick={() => { setTelegramPollAttempts(0); setPolling(true); setTelegramStep('open-bot'); }}
                >
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Email Dialog */}
      {emailDialog && (
        <Card className="border-[#00FF88]/40 relative overflow-hidden">
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={() => setEmailDialog(false)} className="absolute top-4 right-4 text-[var(--ag-text-muted)] hover:text-white z-10 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close email dialog">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#00FF88]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#00FF88]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--ag-text-primary)]">Email Notifications</h3>
                <p className="text-xs text-[var(--ag-text-muted)]">Get reminders and briefings via email</p>
              </div>
            </div>

            {emailSaved ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-[#00FF88] mx-auto mb-2" />
                <p className="text-sm text-[var(--ag-text-primary)]">Email notifications enabled!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="bg-[#06060B] border-[#00F0FF]/20 text-[var(--ag-text-primary)]"
                />
                <Button
                  className="w-full bg-[#00FF88] hover:bg-[#51EF6B] text-[#0C0C18]"
                  onClick={handleEmailSave}
                  disabled={emailSaving}
                >
                  {emailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Enable Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 50.4: Status filter chips — persisted to URL param */}
      <div className="flex items-center gap-2">
        {(['all', 'connected', 'disconnected'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setStatusFilter(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === opt
                ? opt === 'connected'
                  ? 'bg-[#00FF88]/15 border-[#00FF88]/50 text-[#00FF88]'
                  : opt === 'disconnected'
                  ? 'bg-[#FF6161]/15 border-[#FF6161]/50 text-[#FF6161]'
                  : 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[var(--ag-cyan)]'
                : 'border-[#00F0FF]/15 text-[var(--ag-text-muted)] hover:border-[#00F0FF]/30 hover:text-[var(--ag-text-primary)]'
            }`}
          >
            {opt === 'all' ? `All (${integrations.length})` : opt === 'connected' ? `Connected (${connectedCount})` : `Disconnected (${integrations.length - connectedCount})`}
          </button>
        ))}
      </div>

      {/* Connection Grid */}
      <div id="integration-grid" className="grid md:grid-cols-2 gap-4">
        {/* 46.3: Empty state when no integrations are available */}
        {filteredIntegrations.length === 0 && (
          <div className="md:col-span-2 text-center py-12 text-[#8888AA]">
            <Plug className="w-12 h-12 mx-auto mb-4 text-[#8888AA]/40" />
            <p className="text-lg font-medium mb-2">{statusFilter === 'all' ? 'No integrations connected yet' : `No ${statusFilter} integrations`}</p>
            <p className="text-sm">Connect Telegram, WhatsApp, or webhooks to receive notifications and automate your workflows.</p>
          </div>
        )}
        {filteredIntegrations.map((connection) => {
          const Icon = getIcon(connection.type);
          const color = getColor(connection.type);
          const isTelegram = connection.type === 'telegram';
          // 55.9: On mobile, cards are collapsed by default; tap the header to expand
          const isExpanded = !isMobile || expandedId === connection.id;
          return (
            <Card
              key={connection.id}
              className={`bg-[var(--ag-bg-surface)] transition-all duration-300 group ${
                isTelegram
                  ? 'border-[#00F0FF]/40 ring-1 ring-[#00F0FF]/10'
                  : 'border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
              }`}
            >
              {/* Telegram: Recommended badge */}
              {isTelegram && (
                <div className="px-4 pt-3 sm:px-6 sm:pt-4 pb-0 flex items-center gap-2">
                  <Badge className="bg-[#00F0FF]/15 text-[var(--ag-cyan)] border border-[#00F0FF]/30 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5">
                    Recommended
                  </Badge>
                  <span className="text-[10px] text-[var(--ag-text-muted)]">Primary notification channel</span>
                </div>
              )}
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'} ${isTelegram && !isMobile ? 'pt-3' : isTelegram ? 'pt-2' : ''}`}>
                <div
                  className={`flex items-start justify-between ${isExpanded ? 'mb-4' : ''} ${isMobile ? 'cursor-pointer' : ''}`}
                  onClick={isMobile ? () => setExpandedId(expandedId === connection.id ? null : connection.id) : undefined}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon className="w-6 h-6" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--ag-text-primary)]">{connection.name}</h3>
                      {/* 42.5: Last sync timestamp */}
                      {connection.status === 'connected' && connection.lastSync && (
                        <p className="text-[11px] text-[var(--ag-text-muted)] mb-0.5">Last synced: {timeAgo(connection.lastSync)}</p>
                      )}
                      {/* Status dot indicator with health-aware pulse */}
                      <div className="flex items-center gap-2 mt-1">
                        {connection.type === 'whatsapp' && connection.status !== 'connected' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                            <span className="text-xs text-[#F59E0B] font-medium">Not yet available</span>
                          </span>
                        ) : getStatusDot(connection.status, connection.type)}
                        {connection.status === 'connected' && healthStatus[connection.type] === 'checking' && (
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-[#F59E0B] animate-pulse"
                            title="Checking health..."
                          />
                        )}
                        {/* 62.7: Ping latency badge */}
                        {connection.status === 'connected' && pingLatency[connection.type] != null && (
                          <span className="text-xs text-[var(--ag-cyan)] font-mono">{pingLatency[connection.type]}ms</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {connection.status === 'connected' ? (
                    <Button
                      variant="outline"
                      size={isMobile ? 'default' : 'sm'}
                      onClick={(e) => { e.stopPropagation(); /* managed via switch still, but show subtle button */ }}
                      className="border-[#00F0FF]/30 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:border-[#00F0FF]/50 min-h-[36px]"
                    >
                      Manage
                    </Button>
                  ) : connection.type === 'whatsapp' ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge className="bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5">
                        Coming Soon
                      </Badge>
                      <Button
                        size="sm"
                        disabled
                        className="bg-[#9CA3AF]/20 text-[var(--ag-text-muted)] cursor-not-allowed opacity-60 min-h-[36px]"
                      >
                        <Plug className="w-3.5 h-3.5 mr-1.5" />
                        Connect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size={isMobile ? 'default' : 'sm'}
                      onClick={() => handleConnect(connection.type)}
                      disabled={connectingId === connection.type}
                      className="bg-[#00F0FF] hover:bg-[#00D4B0] text-[#0C0C18] font-semibold min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 shadow-lg shadow-[#00F0FF]/10"
                    >
                      {connectingId === connection.type ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Connecting…</>
                      ) : (
                        <><Plug className="w-3.5 h-3.5 mr-1.5" />Connect</>
                      )}
                    </Button>
                  )}
                </div>

                {isExpanded && (
                  <>
                    <p className="text-sm text-[var(--ag-text-muted)] mb-4">
                      {connection.description}
                    </p>

                    {connection.status === 'connected' && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[var(--ag-text-muted)]">Health</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[var(--ag-text-primary)]">{connection.health}%</span>
                            {/* 62.7: Ping button */}
                            <button
                              onClick={() => void handlePing(connection.type)}
                              disabled={pinging[connection.type]}
                              className="flex items-center gap-1 text-xs text-[var(--ag-cyan)] hover:text-[#00D4B0] disabled:opacity-50 transition-colors"
                              title="Test latency"
                            >
                              {pinging[connection.type] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <span>Ping{pingLatency[connection.type] != null ? ` ${pingLatency[connection.type]}ms` : ''}</span>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#06060B] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${connection.health}%`,
                              backgroundColor: connection.health > 80 ? '#00FF88' : connection.health > 50 ? '#FFB800' : '#FF6161'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-4">
                      {connection.features.map((feature, i) => (
                        <Badge key={i} variant="outline" className="border-[#00F0FF]/20 text-[var(--ag-text-muted)] text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>

                    {/* WhatsApp: Notify me interest capture */}
                    {connection.type === 'whatsapp' && connection.status !== 'connected' && (
                      <div className="mb-4 p-3 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-[var(--ag-text-muted)]">
                            WhatsApp integration is under development. We'll let you know when it's ready.
                          </p>
                          <button
                            onClick={() => notify('We\'ll notify you when WhatsApp is available!', 'success')}
                            className="flex items-center gap-1.5 text-xs text-[#F59E0B] hover:text-[#FBBF24] font-medium whitespace-nowrap ml-3 transition-colors"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            Notify me
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Test Connection Button + Result */}
                    {connection.status === 'connected' && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleTestConnection(connection.type)}
                            disabled={testing[connection.type]}
                            className="border-[#00F0FF]/30 text-[var(--ag-cyan)] hover:bg-[#00F0FF]/10 text-xs"
                            data-testid={`test-connection-${connection.type}`}
                          >
                            {testing[connection.type] ? (
                              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Testing...</>
                            ) : (
                              <><Wifi className="w-3 h-3 mr-1.5" />Test Connection</>
                            )}
                          </Button>
                          {testResult[connection.type] && (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                              testResult[connection.type]!.status === 'pass' ? 'text-[#00FF88]' : 'text-[#FF6161]'
                            }`}>
                              {testResult[connection.type]!.status === 'pass' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <WifiOff className="w-3 h-3" />
                              )}
                              {testResult[connection.type]!.message}
                              <span className="text-[var(--ag-text-muted)] font-normal ml-1">at {testResult[connection.type]!.at}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Telegram QR deep link */}
                    {connection.type === 'telegram' && connection.status === 'connected' && telegramUsername && (
                      <div className="mb-4 p-3 rounded-xl bg-[#0088cc]/5 border border-[#0088cc]/20">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                            <Send className="w-5 h-5 text-[#0088cc]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--ag-text-primary)]">@{telegramUsername}</p>
                            <p className="text-xs text-[var(--ag-text-muted)]">Open in Telegram to chat with your agent</p>
                          </div>
                          <a
                            href={`https://t.me/${telegramUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-medium transition-colors min-h-[36px]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Custom Telegram Bot — "Connect Your Own Bot" */}
                    {connection.type === 'telegram' && (
                      <div className="mb-4">
                        {/* Divider */}
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-[#00F0FF]/15" />
                          <span className="text-xs text-[var(--ag-text-muted)] whitespace-nowrap">— or —</span>
                          <div className="flex-1 h-px bg-[#00F0FF]/15" />
                        </div>

                        {/* Expandable header */}
                        <button
                          onClick={() => setCustomBotExpanded(!customBotExpanded)}
                          className="flex items-center justify-between w-full min-h-[44px] px-3 py-2.5 rounded-lg bg-[#06060B] border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all group/cbot"
                        >
                          <div className="flex items-center gap-2.5">
                            <Bot className="w-4 h-4 text-[var(--ag-cyan)]" />
                            <span className="text-sm font-medium text-[var(--ag-text-primary)]">Connect Your Own Bot</span>
                            {customBotStatus === 'connected' && customBotInfo && (
                              <Badge className="bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30 text-[10px] px-1.5 py-0">
                                Active
                              </Badge>
                            )}
                          </div>
                          {customBotExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[var(--ag-text-muted)] group-hover/cbot:text-[var(--ag-cyan)] transition-colors" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--ag-text-muted)] group-hover/cbot:text-[var(--ag-cyan)] transition-colors" />
                          )}
                        </button>

                        {/* Expanded content */}
                        {customBotExpanded && (
                          <div className="mt-3 p-4 rounded-lg bg-[#06060B] border border-[#00F0FF]/15 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Already connected state */}
                            {customBotStatus === 'connected' && customBotInfo ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#00FF88]/5 border border-[#00FF88]/20">
                                  <CheckCircle2 className="w-5 h-5 text-[#00FF88] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">{customBotInfo.botName}</p>
                                    <p className="text-xs text-[var(--ag-text-muted)]">@{customBotInfo.botUsername}</p>
                                  </div>
                                  <a
                                    href={`https://t.me/${customBotInfo.botUsername}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#0088cc]/20 hover:bg-[#0088cc]/30 text-[#0088cc] text-xs font-medium transition-colors min-h-[36px]"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Open
                                  </a>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCustomBotDisconnect}
                                  className="w-full border-[#FF6161]/30 text-[#FF6161] hover:bg-[#FF6161]/10 hover:border-[#FF6161]/50 min-h-[44px]"
                                >
                                  <Unplug className="w-3.5 h-3.5 mr-1.5" />
                                  Disconnect Custom Bot
                                </Button>
                              </div>
                            ) : (
                              <>
                                {/* Token input */}
                                <div className="space-y-2">
                                  <label className="flex items-center gap-1.5 text-xs text-[var(--ag-text-muted)]">
                                    <Key className="w-3 h-3" />
                                    Paste your BotFather token
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="123456:ABC-DEF..."
                                    value={customBotToken}
                                    onChange={(e) => {
                                      setCustomBotToken(e.target.value);
                                      if (customBotStatus === 'error') {
                                        setCustomBotStatus('idle');
                                        setCustomBotError(null);
                                      }
                                    }}
                                    className="bg-[#0C0C18] border-[#00F0FF]/20 text-[var(--ag-text-primary)] font-mono text-sm placeholder:text-[#8888AA]/50 min-h-[44px]"
                                  />
                                </div>

                                {/* Error message */}
                                {customBotStatus === 'error' && customBotError && (
                                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FF6161]/5 border border-[#FF6161]/20">
                                    <AlertTriangle className="w-4 h-4 text-[#FF6161] flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-[#FF6161]">{customBotError}</p>
                                  </div>
                                )}

                                {/* Verify button */}
                                <Button
                                  onClick={handleCustomBotConnect}
                                  disabled={customBotStatus === 'verifying' || !customBotToken.trim()}
                                  className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] text-[#0C0C18] font-semibold min-h-[44px] disabled:opacity-50"
                                >
                                  {customBotStatus === 'verifying' ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                                  ) : (
                                    <><CheckCircle2 className="w-4 h-4 mr-2" />Verify & Connect</>
                                  )}
                                </Button>

                                {/* Instructions */}
                                <p className="text-[11px] text-[var(--ag-text-muted)] leading-relaxed">
                                  Open{' '}
                                  <a
                                    href="https://t.me/BotFather"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--ag-cyan)] hover:underline"
                                  >
                                    @BotFather
                                  </a>
                                  {' '}in Telegram → /newbot → copy the token
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-[#00F0FF]/10 text-xs text-[var(--ag-text-muted)]">
                      <div className="flex flex-col gap-0.5">
                        {connection.lastSync ? (
                          <span>Last synced: {timeAgo(connection.lastSync)}</span>
                        ) : (
                          <span>Never synced</span>
                        )}
                        {/* 78.6: Show Telegram username + last message time */}
                        {connection.type === 'telegram' && connection.status === 'connected' && telegramUsername && (
                          <span className="text-[#0088cc] font-medium">@{telegramUsername}</span>
                        )}
                        {connection.type === 'telegram' && connection.status === 'connected' && telegramLastPing && (
                          <span className="text-[var(--ag-cyan)]">Last message: {timeAgo(telegramLastPing)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {connection.status === 'connected' && (
                          <span>{connection.requestsToday} req today</span>
                        )}
                        {connection.status === 'connected' && (
                          <Switch
                            checked={true}
                            onCheckedChange={() => handleDisconnect(connection.id)}
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 66.4: Integration event log */}
      {integrationEvents.length > 0 && (
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--ag-cyan)]" />
              Recent Integration Events
            </h4>
            <div className="space-y-2">
              {integrationEvents.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#00F0FF] flex-shrink-0" />
                  <span className="text-[var(--ag-text-primary)] flex-1 truncate">{ev.action}</span>
                  {ev.details && <span className="text-[var(--ag-text-muted)] truncate max-w-[120px]">{ev.details}</span>}
                  <span className="text-[var(--ag-text-muted)] flex-shrink-0">{timeAgo(ev.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Privacy Note */}
      <Card className="bg-gradient-to-r from-[#00F0FF]/10 to-transparent border-[#00F0FF]/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[var(--ag-cyan)] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Privacy First</h4>
              <p className="text-xs text-[var(--ag-text-muted)]">
                Your data is encrypted and never shared. You can disconnect any service at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </PageShell>
  );
}
