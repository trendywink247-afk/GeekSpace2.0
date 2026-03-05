// ============================================================
// Improved Connections Page
// Better visual feedback, working states, QR code for WhatsApp
// ============================================================

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
  Wifi,
  WifiOff,
  AlertTriangle,
  Plus,
  Zap,
  ExternalLink,
  X,
  Send,
  Loader2,
  CheckCircle2,
  Mail,
  Smartphone,
  Image as ImageIcon,
  Link,
  Copy,
  Check as CheckIcon,
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

type TelegramStep = 'idle' | 'generating' | 'open-bot' | 'send-code' | 'waiting' | 'success' | 'error';
type WhatsAppStep = 'idle' | 'generating' | 'show-qr' | 'waiting' | 'success' | 'error';

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

  // WhatsApp dialog state
  const [whatsappDialog, setWhatsappDialog] = useState(false);
  const [whatsappStep, setWhatsappStep] = useState<WhatsAppStep>('idle');
  const [whatsappQR, setWhatsappQR] = useState<string | null>(null);
  const [whatsappSessionId, setWhatsappSessionId] = useState<string | null>(null);
  const [whatsappPolling, setWhatsappPolling] = useState(false);
  const [whatsappPollAttempts, setWhatsappPollAttempts] = useState(0);

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
  // 55.9: Mobile tap-to-expand connection cards
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Poll for WhatsApp link status
  const pollWhatsAppStatus = useCallback(async () => {
    if (!whatsappSessionId) return;
    try {
      const res = await integrationService.checkWhatsAppQRStatus(whatsappSessionId);
      if (res.data.linked) {
        setWhatsappStep('success');
        setWhatsappPolling(false);
      }
    } catch { /* ignore */ }
  }, [whatsappSessionId]);

  useEffect(() => {
    if (!whatsappPolling) return;
    const base = Math.min(1000 * Math.pow(2, whatsappPollAttempts), 5000);
    const jitter = Math.random() * 500 - 250;
    const delay = Math.max(500, base + jitter);
    const timer = setTimeout(() => {
      pollWhatsAppStatus();
      setWhatsappPollAttempts(a => a + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [whatsappPolling, whatsappPollAttempts, pollWhatsAppStatus]);

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
      if (type === 'whatsapp') {
        setWhatsappDialog(true);
        setWhatsappStep('generating');
        setWhatsappPollAttempts(0);
        try {
          const res = await integrationService.linkWhatsAppQR();
          if (res.data.success && res.data.qrCodeDataUrl) {
            setWhatsappQR(res.data.qrCodeDataUrl);
            setWhatsappSessionId(res.data.sessionId);
            setWhatsappStep('show-qr');
            setWhatsappPolling(true);
          } else {
            setWhatsappStep('error');
          }
        } catch {
          setWhatsappStep('error');
        }
        return;
      }
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

  const handleDisconnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (integration?.type === 'email') {
      await integrationService.updateNotificationEmail({ enabled: false });
    }
    if (integration?.type === 'telegram') {
      // Must delete channel_links row so reconnect starts fresh (not showing "already linked")
      try { await integrationService.unlinkTelegram(); } catch { /* ignore if not linked */ }
    }
    if (integration?.type === 'whatsapp') {
      await integrationService.unlinkWhatsApp();
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

  const closeWhatsAppDialog = () => {
    setWhatsappDialog(false);
    setWhatsappQR(null);
    setWhatsappSessionId(null);
    setWhatsappStep('idle');
    setWhatsappPolling(false);
    setWhatsappPollAttempts(0);
    setConnectingId(null);
    loadIntegrations();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-4 h-4 text-[#00FF88]" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-[#FF6161]" />;
      case 'paused': return <WifiOff className="w-4 h-4 text-[#FFB800]" />;
      default: return <WifiOff className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-[#00FF88]';
      case 'error': return 'text-[#FF6161]';
      case 'paused': return 'text-[#FFB800]';
      default: return 'text-[#6B7280]';
    }
  };

  const getIcon = (type: string) => iconMap[type] || Zap;
  const getColor = (type: string) => colorMap[type] || '#00F0FF';

  return (
    <div data-testid="connections-page" className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Connections
          </h1>
          <p className="text-[#6B7280]">
            <span className="text-[#00F0FF] font-medium">{connectedCount}</span> of {integrations.length} services connected
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
                <div className="text-2xl font-bold text-[#E8E8F0]">{connectedCount}</div>
                <div className="text-xs text-[#6B7280]">Connected</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#00F0FF]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{totalRequests}</div>
                <div className="text-xs text-[#6B7280]">Requests Today</div>
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
                <div className="text-2xl font-bold text-[#E8E8F0]">{avgHealth}%</div>
                <div className="text-xs text-[#6B7280]">Avg Health</div>
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
                <div className="text-2xl font-bold text-[#E8E8F0]">100%</div>
                <div className="text-xs text-[#6B7280]">Secure</div>
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
              className="absolute top-4 right-4 text-[#6B7280] hover:text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#BF5FFF]/20 flex items-center justify-center">
                <Link className="w-5 h-5 text-[#BF5FFF]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#E8E8F0]">Invite Link Generated</h3>
                <p className="text-xs text-[#6B7280]">Valid for 7 days — share with anyone to connect</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#06060B] rounded-lg px-3 py-2 text-xs text-[#6B7280] font-mono truncate border border-[#BF5FFF]/20">
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
            <button onClick={closeTelegramDialog} className="absolute top-4 right-4 text-[#6B7280] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#E8E8F0]">Connect Telegram</h3>
                <p className="text-xs text-[#6B7280]">Chat with your agent on Telegram</p>
              </div>
            </div>

            {telegramStep === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                <p className="text-sm text-[#6B7280]">Setting up your connection...</p>
              </div>
            )}

            {telegramStep === 'open-bot' && telegramLink?.deepLink && (
              <div className="space-y-4">
                <div className="bg-[#06060B] rounded-lg p-4 border border-[#0088cc]/20">
                  <p className="text-sm text-[#E8E8F0] font-medium mb-2">Step 1: Open Telegram</p>
                  <p className="text-xs text-[#6B7280]">Click below to open our bot, then send the start command.</p>
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
                <p className="text-sm text-[#E8E8F0] font-medium">Telegram connected!</p>
                <Button className="bg-[#00FF88] hover:bg-[#51EF6B] text-[#0C0C18]" onClick={closeTelegramDialog}>
                  Done
                </Button>
              </div>
            )}

            {telegramStep === 'error' && (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-[#FF6161] mx-auto mb-2" />
                <p className="text-sm text-[#E8E8F0]">Connection failed</p>
                <p className="text-xs text-[#6B7280] mt-1">{telegramLink?.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Link Wizard with QR */}
      {whatsappDialog && (
        <Card className="border-[#25d366]/40 relative overflow-hidden">
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={closeWhatsAppDialog} className="absolute top-4 right-4 text-[#6B7280] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#25d366]/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-[#25d366]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#E8E8F0]">Connect WhatsApp</h3>
                <p className="text-xs text-[#6B7280]">Scan QR code with your phone</p>
              </div>
            </div>

            {whatsappStep === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#25d366] animate-spin" />
                <p className="text-sm text-[#6B7280]">Generating QR code...</p>
              </div>
            )}

            {whatsappStep === 'show-qr' && whatsappQR && (
              <div className="space-y-4 text-center">
                <div className="bg-white p-4 rounded-xl inline-block max-w-[90vw] mx-auto">
                  <img src={whatsappQR} alt="WhatsApp QR Code" className="w-48 h-48 max-w-full" />
                </div>
                <p className="text-sm text-[#6B7280]">
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>
                <p className="text-xs text-[#6B7280]">
                  Scan the QR code above to connect
                </p>
                {/* 78.5: WhatsApp platform policy disclaimer */}
                <div className="bg-[#25d366]/10 border border-[#25d366]/20 rounded-lg px-3 py-2 text-left">
                  <p className="text-xs text-[#6B7280]">
                    <span className="text-[#25d366] font-medium">Utility flows only</span> — reminders, OTP, and notifications.
                    {' '}AI chat is available via the{' '}
                    <a href="https://ai.agentin.chat" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] underline">Agentin web app</a>.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-[#00FF88]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Waiting for scan...
                </div>
              </div>
            )}

            {whatsappStep === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-[#00FF88]" />
                <p className="text-sm text-[#E8E8F0] font-medium">WhatsApp connected!</p>
                <Button className="bg-[#00FF88] hover:bg-[#51EF6B] text-[#0C0C18]" onClick={closeWhatsAppDialog}>
                  Done
                </Button>
              </div>
            )}

            {whatsappStep === 'error' && (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-[#FF6161] mx-auto mb-2" />
                <p className="text-sm text-[#E8E8F0]">Connection failed</p>
                <p className="text-xs text-[#6B7280] mt-1">Please try again later</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Dialog */}
      {emailDialog && (
        <Card className="border-[#00FF88]/40 relative overflow-hidden">
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={() => setEmailDialog(false)} className="absolute top-4 right-4 text-[#6B7280] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#00FF88]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#00FF88]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#E8E8F0]">Email Notifications</h3>
                <p className="text-xs text-[#6B7280]">Get reminders and briefings via email</p>
              </div>
            </div>

            {emailSaved ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-[#00FF88] mx-auto mb-2" />
                <p className="text-sm text-[#E8E8F0]">Email notifications enabled!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="bg-[#06060B] border-[#00F0FF]/20 text-[#E8E8F0]"
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
                  : 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]'
                : 'border-[#00F0FF]/15 text-[#6B7280] hover:border-[#00F0FF]/30 hover:text-[#E8E8F0]'
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
          // 55.9: On mobile, cards are collapsed by default; tap the header to expand
          const isExpanded = !isMobile || expandedId === connection.id;
          return (
            <Card
              key={connection.id}
              className="bg-[#0C0C18] border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all duration-300 group"
            >
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
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
                      <h3 className="font-semibold text-[#E8E8F0]">{connection.name}</h3>
                      {/* 42.5: Last sync timestamp */}
                      {connection.status === 'connected' && connection.lastSync && (
                        <p className="text-[10px] text-[#6B7280] mb-0.5">Last sync: {timeAgo(connection.lastSync)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(connection.status)}
                        <span className={`text-xs ${getStatusColor(connection.status)} capitalize`}>
                          {connection.status}
                        </span>
                        {connection.status === 'connected' && healthStatus[connection.type] && (
                          <span
                            className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                              healthStatus[connection.type] === 'healthy'
                                ? 'bg-[#00FF88]'
                                : healthStatus[connection.type] === 'checking'
                                ? 'bg-[#F59E0B] animate-pulse'
                                : 'bg-[#FF6161]'
                            }`}
                            title={
                              healthStatus[connection.type] === 'healthy'
                                ? 'Integration is healthy'
                                : healthStatus[connection.type] === 'checking'
                                ? 'Checking health...'
                                : 'Integration may have issues'
                            }
                          />
                        )}
                        {/* 62.7: Ping latency badge */}
                        {connection.status === 'connected' && pingLatency[connection.type] != null && (
                          <span className="text-xs text-[#00F0FF] font-mono">{pingLatency[connection.type]}ms</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {connection.status === 'connected' ? (
                    <Switch
                      checked={true}
                      onCheckedChange={() => handleDisconnect(connection.id)}
                    />
                  ) : (
                    <Button
                      size={isMobile ? 'default' : 'sm'}
                      onClick={() => handleConnect(connection.type)}
                      disabled={connectingId === connection.type}
                      className="bg-[#00F0FF] hover:bg-[#00D4B0]"
                    >
                      {connectingId === connection.type ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Connecting…</>
                      ) : 'Connect'}
                    </Button>
                  )}
                </div>

                {isExpanded && (
                  <>
                    <p className="text-sm text-[#6B7280] mb-4">
                      {connection.description}
                    </p>

                    {connection.status === 'connected' && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#6B7280]">Health</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[#E8E8F0]">{connection.health}%</span>
                            {/* 62.7: Ping button */}
                            <button
                              onClick={() => void handlePing(connection.type)}
                              disabled={pinging[connection.type]}
                              className="flex items-center gap-1 text-xs text-[#00F0FF] hover:text-[#00D4B0] disabled:opacity-50 transition-colors"
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
                        <Badge key={i} variant="outline" className="border-[#00F0FF]/20 text-[#6B7280] text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#00F0FF]/10 text-xs text-[#6B7280]">
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
                          <span className="text-[#00F0FF]">Last message: {timeAgo(telegramLastPing)}</span>
                        )}
                      </div>
                      {connection.status === 'connected' && (
                        <span>{connection.requestsToday} req today</span>
                      )}
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
            <h4 className="text-sm font-medium text-[#E8E8F0] mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00F0FF]" />
              Recent Integration Events
            </h4>
            <div className="space-y-2">
              {integrationEvents.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#00F0FF] flex-shrink-0" />
                  <span className="text-[#E8E8F0] flex-1 truncate">{ev.action}</span>
                  {ev.details && <span className="text-[#6B7280] truncate max-w-[120px]">{ev.details}</span>}
                  <span className="text-[#6B7280] flex-shrink-0">{timeAgo(ev.created_at)}</span>
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
            <Shield className="w-5 h-5 text-[#00F0FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[#E8E8F0] mb-1">Privacy First</h4>
              <p className="text-xs text-[#6B7280]">
                Your data is encrypted and never shared. You can disconnect any service at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
