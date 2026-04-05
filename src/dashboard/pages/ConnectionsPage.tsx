// ============================================================
// Connections Page — Full redesign: shadows over borders,
// concentric radii, scale-on-press, stagger animations,
// glass cards, mobile-first, CSS vars only.
// ============================================================
import { DashboardPageWrapper, PageHeader } from '@/components/agentin';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';
import { notify } from '@/services/notifications';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';

// ─── Icon + Color Maps ──────────────────────────────────────────────────────
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
  'custom-webhook': '#A78BFA',
  email: '#00FF88',
  image: '#FF2D78',
};

// ─── Time formatter ──────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// ─── Motion variants ─────────────────────────────────────────────────────────
const EASE = [0.4, 0, 0.2, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: EASE },
  }),
};

const slideDown = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: EASE } },
};

// ─── Shadow presets (shadows over borders) ───────────────────────────────────
const SHADOW = {
  card: '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.07), 0 6px 20px rgba(0,0,0,0.25)',
  cardHover: '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15), 0 8px 28px rgba(0,0,0,0.3), 0 0 24px rgba(139,92,246,0.06)',
  cardConnected: '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,136,0.1), 0 6px 20px rgba(0,0,0,0.25), 0 0 24px rgba(0,255,136,0.04)',
  cardTelegram: '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(167,139,250,0.2), 0 6px 20px rgba(0,0,0,0.25), 0 0 32px rgba(139,92,246,0.07)',
  stat: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.06), 0 4px 12px rgba(0,0,0,0.18)',
  pill: '0 0 0 1px rgba(139,92,246,0.25), 0 0 12px rgba(139,92,246,0.12)',
};

type TelegramStep = 'idle' | 'generating' | 'open-bot' | 'send-code' | 'waiting' | 'success' | 'error' | 'timeout';

const MAX_TELEGRAM_POLL = 30;

// ─── Component ───────────────────────────────────────────────────────────────
export function ConnectionsPage() {
  const { integrations, connectIntegration, disconnectIntegration, loadIntegrations } = useDashboardStore();
  const isMobile = useMobileDetect();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'nova', page: 'connections' });

  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as 'all' | 'connected' | 'disconnected') || 'all';
  const setStatusFilter = (v: 'all' | 'connected' | 'disconnected') => {
    setSearchParams(v === 'all' ? {} : { status: v }, { replace: true });
  };

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
  const [telegramLastPing, setTelegramLastPing] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, 'healthy' | 'unhealthy' | 'checking'>>({});
  const [pingLatency, setPingLatency] = useState<Record<string, number | null>>({});
  const [pinging, setPinging] = useState<Record<string, boolean>>({});
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, { status: 'pass' | 'fail'; message: string; at: string } | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customBotToken, setCustomBotToken] = useState('');
  const [customBotStatus, setCustomBotStatus] = useState<'idle' | 'verifying' | 'connected' | 'error'>('idle');
  const [customBotInfo, setCustomBotInfo] = useState<{ botName: string; botUsername: string } | null>(null);
  const [customBotError, setCustomBotError] = useState<string | null>(null);
  const [customBotExpanded, setCustomBotExpanded] = useState(false);
  const [integrationEvents, setIntegrationEvents] = useState<Array<{ id: string; action: string; details: string; icon: string; created_at: string }>>([]);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    integrationService.getEvents(10).then((r) => setIntegrationEvents(r.data.events)).catch(() => {});
  }, []);

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
          next[type] = r.status === 'fulfilled' ? (r.value.data.healthy ? 'healthy' : 'unhealthy') : 'unhealthy';
        });
        return next;
      });
    };
    runHealthChecks();
    const interval = setInterval(runHealthChecks, 60_000);
    return () => clearInterval(interval);
  }, [integrations]);

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

  // ─── Polling ───────────────────────────────────────────────────────────────
  const pollTelegramStatus = useCallback(async () => {
    try {
      const res = await integrationService.checkTelegramLink();
      if (res.data.linked) { setTelegramStep('success'); setPolling(false); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!polling) return;
    if (telegramPollAttempts >= MAX_TELEGRAM_POLL) {
      setPolling(false); setTelegramStep('timeout'); return;
    }
    const base = Math.min(1000 * Math.pow(2, telegramPollAttempts), 5000);
    const delay = Math.max(500, base + (Math.random() * 500 - 250));
    const timer = setTimeout(() => { pollTelegramStatus(); setTelegramPollAttempts(a => a + 1); }, delay);
    return () => clearTimeout(timer);
  }, [polling, telegramPollAttempts, pollTelegramStatus]);

  // ─── Derived ──────────────────────────────────────────────────────────────
  const connectedCount = integrations.filter(c => c.status === 'connected').length;
  const totalRequests = integrations.reduce((acc, c) => acc + c.requestsToday, 0);
  const avgHealth = Math.round(
    integrations.filter(c => c.status === 'connected').reduce((acc, c) => acc + c.health, 0) / (connectedCount || 1)
  );
  const filteredIntegrations = statusFilter === 'all'
    ? integrations
    : integrations.filter(c => statusFilter === 'connected' ? c.status === 'connected' : c.status !== 'connected');

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await integrationService.createInvite();
      setInviteUrl(res.data.inviteUrl);
    } catch { /* ignore */ } finally { setInviteLoading(false); }
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

  const handleEmailSave = async () => {
    setEmailSaving(true);
    try {
      await integrationService.updateNotificationEmail({ enabled: true, address: emailAddress || undefined });
      await connectIntegration('email');
      setEmailSaved(true);
      notify('Email notifications enabled!', 'success');
      void notifyDone('email notifications enabled');
    } catch { /* ignore */ } finally { setEmailSaving(false); }
  };

  const handleConnect = async (type: IntegrationType) => {
    setConnectingId(type);
    try {
      if (type === 'email') {
        setEmailAddress(''); setEmailSaved(false); setEmailDialog(true); return;
      }
      if (type === 'telegram') {
        setTelegramDialog(true); setTelegramStep('generating'); setTelegramPollAttempts(0);
        try {
          const res = await integrationService.linkTelegram();
          setTelegramLink(res.data);
          if (res.data.linked) {
            setTelegramDialog(false); setTelegramStep('idle'); setTelegramLink(null);
            setConnectingId(null); loadIntegrations();
          } else {
            setTelegramStep('open-bot'); setPolling(true);
          }
        } catch {
          setTelegramLink({ message: 'Telegram bot is not configured. Contact the admin.' });
          setTelegramStep('error');
        }
        return;
      }
      await connectIntegration(type);
      notify(`${type.charAt(0).toUpperCase() + type.slice(1)} connected!`, 'success');
      void notifyDone(`${type} connected`);
    } catch (err) {
      notify(`Failed to connect ${type}`, 'error');
      void notifyFail(`${type} connection failed`);
      throw err;
    } finally {
      setConnectingId(null);
    }
  };

  const handlePing = async (type: string) => {
    setPinging(p => ({ ...p, [type]: true }));
    setPingLatency(p => ({ ...p, [type]: null }));
    try {
      const res = await integrationService.pingIntegration(type);
      setPingLatency(p => ({ ...p, [type]: res.data.latencyMs }));
      setHealthStatus(p => ({ ...p, [type]: res.data.healthy ? 'healthy' : 'unhealthy' }));
    } catch {
      setPingLatency(p => ({ ...p, [type]: null }));
    } finally {
      setPinging(p => ({ ...p, [type]: false }));
    }
  };

  const handleTestConnection = async (type: string) => {
    setTesting(p => ({ ...p, [type]: true }));
    setTestResult(p => ({ ...p, [type]: null }));
    try {
      const res = await integrationService.testIntegration(type);
      const healthy = res.data.healthy;
      setTestResult(p => ({
        ...p,
        [type]: { status: healthy ? 'pass' : 'fail', message: healthy ? 'Connection is healthy' : 'Connection has issues', at: new Date().toLocaleTimeString() },
      }));
      setHealthStatus(p => ({ ...p, [type]: healthy ? 'healthy' : 'unhealthy' }));
    } catch {
      setTestResult(p => ({
        ...p,
        [type]: { status: 'fail', message: 'Test failed — service unreachable', at: new Date().toLocaleTimeString() },
      }));
    } finally {
      setTesting(p => ({ ...p, [type]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (integration?.type === 'email') await integrationService.updateNotificationEmail({ enabled: false });
    if (integration?.type === 'telegram') {
      try { await integrationService.unlinkTelegram(); } catch { /* ignore */ }
    }
    notify(`${integration?.name || 'Integration'} disconnected`, 'info');
    void notifyDone(`${integration?.name || 'integration'} disconnected`);
    disconnectIntegration(id);
  };

  const closeTelegramDialog = () => {
    setTelegramDialog(false); setTelegramLink(null); setTelegramStep('idle');
    setPolling(false); setTelegramPollAttempts(0); setConnectingId(null);
    loadIntegrations();
  };

  const handleCustomBotConnect = async () => {
    if (!customBotToken.trim()) return;
    setCustomBotStatus('verifying'); setCustomBotError(null);
    try {
      const res = await integrationService.connectCustomTelegramBot({ botToken: customBotToken.trim() });
      setCustomBotInfo({ botName: res.data.botName, botUsername: res.data.botUsername });
      setCustomBotStatus('connected');
      notify('Custom Telegram bot connected!', 'success');
      loadIntegrations();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Failed to verify bot token. Please check and try again.';
      setCustomBotError(message); setCustomBotStatus('error');
    }
  };

  const handleCustomBotDisconnect = async () => {
    try {
      await integrationService.disconnectCustomTelegramBot();
      setCustomBotInfo(null); setCustomBotStatus('idle'); setCustomBotToken(''); setCustomBotError(null);
      notify('Custom bot disconnected', 'info'); loadIntegrations();
    } catch { notify('Failed to disconnect custom bot', 'error'); }
  };

  // ─── Sub-renderers ────────────────────────────────────────────────────────
  const getIcon = (type: string) => iconMap[type] || Zap;
  const getColor = (type: string) => colorMap[type] || '#A78BFA';

  const renderStatusBadge = (status: string, type?: string) => {
    const health = type ? healthStatus[type] : undefined;
    if (status === 'connected') {
      const isUnhealthy = health === 'unhealthy';
      const dotColor = isUnhealthy ? '#FF6161' : '#00FF88';
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ backgroundColor: dotColor }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
          </span>
          <span className="text-xs font-medium tabular-nums" style={{ color: dotColor }}>
            {isUnhealthy ? 'Degraded' : 'Connected'}
          </span>
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FF6161]" />
          <span className="text-xs font-medium text-[#FF6161]">Error — reconnect</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[var(--ag-text-muted)]" />
        <span className="text-xs text-[var(--ag-text-muted)]">Not connected</span>
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <div data-testid="connections-page" className="space-y-5 pb-24 md:pb-8 overflow-x-hidden">

        {/* ── Header ── */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
          <PageHeader
            icon={Plug}
            title="Connections"
            subtitle={`${connectedCount} of ${integrations.length} services connected`}
            badge={
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(236,72,153,0.1)', boxShadow: '0 0 0 1px rgba(236,72,153,0.25)' }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-[#EC4899] animate-ping opacity-70" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#EC4899]" />
                </span>
                <span className="text-[#EC4899] font-medium">Nova</span>
              </span>
            }
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-[var(--ag-green)]/30 text-[var(--ag-green)] px-3 py-1 hidden sm:inline-flex gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Encrypted
                </Badge>
                <Button
                  onClick={handleGenerateInvite}
                  disabled={inviteLoading}
                  variant="outline"
                  className="border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface)] min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link className="w-4 h-4 mr-2" />}
                  Invite
                </Button>
                <Button
                  onClick={() => document.getElementById('integration-grid')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white font-semibold min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New
                </Button>
              </div>
            }
          />
        </motion.div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Plug,     color: 'var(--ag-green)',   value: connectedCount,  label: 'Connected',       delay: 1 },
            { icon: Activity, color: 'var(--ag-violet)',  value: totalRequests,   label: 'Requests Today',  delay: 2 },
            { icon: RefreshCw,color: 'var(--ag-amber)',   value: `${avgHealth}%`, label: 'Avg Health',      delay: 3 },
            { icon: Shield,   color: 'var(--ag-green)',   value: '100%',          label: 'Secure',          delay: 4 },
          ].map(({ icon: Icon, color, value, label, delay }) => (
            <motion.div key={label} custom={delay} variants={fadeUp} initial="hidden" animate="show">
              <div
                className="relative overflow-hidden rounded-2xl p-4 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
                style={{ boxShadow: SHADOW.stat }}
              >
                {/* subtle top-edge highlight */}
                <div className="absolute inset-x-0 top-0 h-px opacity-30" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-heading font-bold text-[var(--ag-text-primary)] tabular-nums leading-none mb-0.5">{value}</div>
                    <div className="text-xs text-[var(--ag-text-secondary)] truncate">{label}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Invite Link Card ── */}
        <AnimatePresence initial={false}>
          {inviteUrl && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="relative rounded-2xl p-5 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: SHADOW.card }}>
                <button
                  onClick={() => setInviteUrl(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)] active:scale-[0.96] transition-[transform,background,color] duration-150"
                  aria-label="Dismiss invite"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)' }}>
                    <Link className="w-5 h-5 text-[var(--ag-violet)]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] text-wrap-balance">Invite Link Generated</h3>
                    <p className="text-xs text-[var(--ag-text-secondary)]">Valid for 7 days · share to connect</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl px-3 py-2.5 text-xs text-[var(--ag-text-secondary)] font-mono truncate bg-[var(--ag-bg-deep)]"
                    style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.08) inset' }}>
                    {inviteUrl}
                  </div>
                  <button
                    onClick={handleCopyInvite}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-[0.96] transition-[transform,opacity] duration-150"
                    style={{
                      background: inviteCopied
                        ? 'rgba(16,185,129,0.15)'
                        : 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))',
                      boxShadow: inviteCopied ? '0 0 0 1px rgba(16,185,129,0.3)' : '0 2px 8px rgba(139,92,246,0.3)',
                    }}
                    aria-label="Copy invite link"
                  >
                    {inviteCopied
                      ? <CheckIcon className="w-4 h-4 text-[var(--ag-green)]" />
                      : <Copy className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Telegram Wizard ── */}
        <AnimatePresence initial={false}>
          {telegramDialog && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="relative rounded-2xl p-6 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: '0 0 0 1px rgba(0,136,204,0.2), 0 8px 32px rgba(0,0,0,0.3)' }}>
                <button onClick={closeTelegramDialog}
                  className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)] active:scale-[0.96] transition-[transform,background,color] duration-150"
                  aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,136,204,0.15)' }}>
                    <Send className="w-5 h-5 text-[#0088cc]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-[var(--ag-text-primary)]">Connect Telegram</h3>
                    <p className="text-xs text-[var(--ag-text-secondary)]">Chat with your agent on Telegram</p>
                  </div>
                </div>

                {telegramStep === 'generating' && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                    <p className="text-sm text-[var(--ag-text-secondary)]">Setting up your connection…</p>
                  </div>
                )}

                {telegramStep === 'open-bot' && telegramLink?.deepLink && (
                  <div className="space-y-4">
                    <div className="rounded-xl p-4 bg-[var(--ag-bg-deep)]" style={{ boxShadow: '0 0 0 1px rgba(0,136,204,0.12)' }}>
                      <p className="text-sm font-medium text-[var(--ag-text-primary)] mb-1">Step 1: Open Telegram</p>
                      <p className="text-xs text-[var(--ag-text-secondary)]">Tap below to open the bot, then send the start command.</p>
                    </div>
                    <a href={telegramLink.deepLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-medium min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      style={{ background: '#0088cc', boxShadow: '0 2px 12px rgba(0,136,204,0.3)' }}>
                      <Send className="w-4 h-4" />Open in Telegram<ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {telegramStep === 'success' && (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.1)', boxShadow: '0 0 0 1px rgba(0,255,136,0.2), 0 0 24px rgba(0,255,136,0.1)' }}>
                      <CheckCircle2 className="w-8 h-8 text-[var(--ag-green)]" />
                    </div>
                    <p className="text-sm text-[var(--ag-text-primary)] font-medium">Telegram connected!</p>
                    <Button onClick={closeTelegramDialog}
                      className="min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      style={{ background: 'var(--ag-green)', color: 'var(--ag-bg-base)' }}>
                      Done
                    </Button>
                  </div>
                )}

                {telegramStep === 'error' && (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,97,97,0.1)', boxShadow: '0 0 0 1px rgba(255,97,97,0.2)' }}>
                      <AlertTriangle className="w-7 h-7 text-[#FF6161]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">Connection failed</p>
                    <p className="text-xs text-[var(--ag-text-secondary)] mt-1">{telegramLink?.message}</p>
                  </div>
                )}

                {telegramStep === 'timeout' && (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 0 1px rgba(245,158,11,0.2)' }}>
                      <AlertTriangle className="w-7 h-7 text-[var(--ag-amber)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">Still waiting…</p>
                    <p className="text-xs text-[var(--ag-text-secondary)] mt-1 mb-4">No response after 30 attempts. Try clicking the bot link again.</p>
                    <Button
                      onClick={() => { setTelegramPollAttempts(0); setPolling(true); setTelegramStep('open-bot'); }}
                      className="min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150 bg-[var(--ag-bg-elevated)] hover:bg-[var(--ag-bg-surface-hover)] text-[var(--ag-text-primary)]"
                      style={{ boxShadow: SHADOW.card }}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Email Dialog ── */}
        <AnimatePresence initial={false}>
          {emailDialog && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="relative rounded-2xl p-6 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: '0 0 0 1px rgba(0,255,136,0.15), 0 8px 32px rgba(0,0,0,0.3)' }}>
                <button onClick={() => setEmailDialog(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)] active:scale-[0.96] transition-[transform,background,color] duration-150"
                  aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.12)' }}>
                    <Mail className="w-5 h-5 text-[var(--ag-green)]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-[var(--ag-text-primary)]">Email Notifications</h3>
                    <p className="text-xs text-[var(--ag-text-secondary)]">Receive reminders and briefings by email</p>
                  </div>
                </div>
                {emailSaved ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,255,136,0.1)', boxShadow: '0 0 0 1px rgba(0,255,136,0.2)' }}>
                      <CheckCircle2 className="w-7 h-7 text-[var(--ag-green)]" />
                    </div>
                    <p className="text-sm text-[var(--ag-text-primary)] font-medium">Email notifications enabled!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] min-h-[44px] rounded-xl"
                    />
                    <Button
                      onClick={handleEmailSave}
                      disabled={emailSaving}
                      className="w-full min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      style={{ background: 'var(--ag-green)', color: 'var(--ag-bg-base)', boxShadow: '0 2px 12px rgba(16,185,129,0.25)' }}
                    >
                      {emailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                      Enable Notifications
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter Chips ── */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show"
          className="flex items-center gap-2 flex-wrap">
          {(['all', 'connected', 'disconnected'] as const).map((opt) => {
            const isActive = statusFilter === opt;
            const activeColor = opt === 'connected' ? 'var(--ag-green)' : opt === 'disconnected' ? '#FF6161' : 'var(--ag-text-accent)';
            return (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt)}
                className="px-3 py-1.5 rounded-full text-xs font-medium min-h-[36px] active:scale-[0.96] transition-[transform,box-shadow,color,background] duration-150"
                style={{
                  color: isActive ? activeColor : 'var(--ag-text-secondary)',
                  background: isActive ? `color-mix(in srgb, ${activeColor} 10%, transparent)` : 'transparent',
                  boxShadow: isActive ? `0 0 0 1px color-mix(in srgb, ${activeColor} 40%, transparent), 0 0 12px color-mix(in srgb, ${activeColor} 10%, transparent)` : '0 0 0 1px rgba(139,92,246,0.1)',
                }}
              >
                {opt === 'all'
                  ? `All (${integrations.length})`
                  : opt === 'connected'
                  ? `Connected (${connectedCount})`
                  : `Disconnected (${integrations.length - connectedCount})`}
              </button>
            );
          })}
        </motion.div>

        {/* ── Integration Grid ── */}
        <div id="integration-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIntegrations.length === 0 && (
            <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show"
              className="md:col-span-2 text-center py-16">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(139,92,246,0.06)', boxShadow: SHADOW.stat }}>
                <Plug className="w-7 h-7 text-[var(--ag-text-muted)]" />
              </div>
              <p className="text-base font-medium text-[var(--ag-text-primary)] mb-2">
                {statusFilter === 'all' ? 'No integrations yet' : `No ${statusFilter} integrations`}
              </p>
              <p className="text-sm text-[var(--ag-text-secondary)] max-w-sm mx-auto text-wrap-balance">
                Connect Telegram, WhatsApp, or webhooks to receive notifications and automate workflows.
              </p>
            </motion.div>
          )}

          {filteredIntegrations.map((connection, idx) => {
            const Icon = getIcon(connection.type);
            const color = getColor(connection.type);
            const isTelegram = connection.type === 'telegram';
            const isExpanded = !isMobile || expandedId === connection.id;
            const cardShadow = isTelegram
              ? SHADOW.cardTelegram
              : connection.status === 'connected'
              ? SHADOW.cardConnected
              : SHADOW.card;

            return (
              <motion.div
                key={connection.id}
                custom={idx + 6}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="h-full"
              >
                <div
                  className="relative group h-full rounded-2xl overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl transition-[box-shadow] duration-300"
                  style={{ boxShadow: cardShadow }}
                >
                  {/* Top edge color accent */}
                  <div className="absolute inset-x-0 top-0 h-px opacity-50"
                    style={{ background: `linear-gradient(90deg, transparent 10%, ${color}40, transparent 90%)` }} />

                  <div className="p-4 md:p-5">
                    {/* Telegram recommended badge */}
                    {isTelegram && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full text-[var(--ag-text-accent)]"
                          style={{ background: 'rgba(167,139,250,0.1)', boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}>
                          Recommended
                        </span>
                        <span className="text-[10px] text-[var(--ag-text-muted)]">Primary channel</span>
                      </div>
                    )}

                    {/* Card header row */}
                    <div
                      className={`flex items-start justify-between gap-3 ${isExpanded ? 'mb-4' : ''} ${isMobile ? 'cursor-pointer' : ''}`}
                      onClick={isMobile ? () => setExpandedId(expandedId === connection.id ? null : connection.id) : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon — concentric: card rounded-2xl(16), icon rounded-xl(12) with ~6px visual gap */}
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-[transform] duration-200 group-hover:scale-105"
                          style={{ background: `${color}18`, boxShadow: `0 0 0 1px ${color}25` }}
                        >
                          <Icon className="w-6 h-6" style={{ color }} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] leading-tight text-wrap-balance">
                            {connection.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {connection.type === 'whatsapp' && connection.status !== 'connected' ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-[var(--ag-amber)]" />
                                <span className="text-xs text-[var(--ag-amber)] font-medium">Not yet available</span>
                              </span>
                            ) : (
                              renderStatusBadge(connection.status, connection.type)
                            )}
                            {connection.status === 'connected' && healthStatus[connection.type] === 'checking' && (
                              <span className="w-2 h-2 rounded-full bg-[var(--ag-amber)] animate-pulse" title="Checking health…" />
                            )}
                            {connection.status === 'connected' && pingLatency[connection.type] != null && (
                              <span className="text-xs text-[var(--ag-text-accent)] font-mono tabular-nums">{pingLatency[connection.type]}ms</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action button — top-right */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {connection.status === 'connected' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] min-h-[40px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Manage
                          </Button>
                        ) : connection.type === 'whatsapp' ? (
                          <>
                            <Badge className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5"
                              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--ag-amber)', boxShadow: '0 0 0 1px rgba(245,158,11,0.25)' }}>
                              Coming Soon
                            </Badge>
                            <Button size="sm" disabled className="opacity-40 min-h-[40px] cursor-not-allowed">
                              <Plug className="w-3.5 h-3.5 mr-1.5" />Connect
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(connection.type)}
                            disabled={connectingId === connection.type}
                            className="min-h-[40px] font-semibold text-white active:scale-[0.96] transition-[transform,opacity] duration-150 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))', boxShadow: '0 2px 10px rgba(139,92,246,0.25)' }}
                          >
                            {connectingId === connection.type
                              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Connecting…</>
                              : <><Plug className="w-3.5 h-3.5 mr-1.5" />Connect</>}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div variants={slideDown} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
                          <p className="text-sm text-[var(--ag-text-secondary)] mb-4 text-wrap-pretty">
                            {connection.description}
                          </p>

                          {/* Health bar */}
                          {connection.status === 'connected' && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-[var(--ag-text-muted)]">Health</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[var(--ag-text-primary)] font-medium tabular-nums">{connection.health}%</span>
                                  <button
                                    onClick={() => void handlePing(connection.type)}
                                    disabled={pinging[connection.type]}
                                    className="text-xs text-[var(--ag-text-accent)] hover:text-[var(--ag-violet)] disabled:opacity-50 min-h-[28px] active:scale-[0.96] transition-[transform,color] duration-150"
                                    title="Test latency"
                                  >
                                    {pinging[connection.type]
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <span>Ping{pingLatency[connection.type] != null ? ` · ${pingLatency[connection.type]}ms` : ''}</span>}
                                  </button>
                                </div>
                              </div>
                              {/* bar track — rounded inner: 9999 matching bar fill */}
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)', boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset' }}>
                                <div
                                  className="h-full rounded-full transition-[width] duration-700"
                                  style={{
                                    width: `${connection.health}%`,
                                    background: connection.health > 80
                                      ? 'linear-gradient(90deg, #00CC6A, #00FF88)'
                                      : connection.health > 50
                                      ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                                      : 'linear-gradient(90deg, #DC2626, #FF6161)',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Feature badges */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {connection.features.map((feature, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full text-[var(--ag-text-muted)]"
                                style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
                                {feature}
                              </span>
                            ))}
                          </div>

                          {/* WhatsApp: interest capture */}
                          {connection.type === 'whatsapp' && connection.status !== 'connected' && (
                            <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-[var(--ag-text-secondary)]">WhatsApp integration is under development.</p>
                                <button
                                  onClick={() => notify("We'll notify you when WhatsApp is available!", 'success')}
                                  className="flex items-center gap-1.5 text-xs text-[var(--ag-amber)] hover:opacity-80 font-medium whitespace-nowrap min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                                >
                                  <Bell className="w-3.5 h-3.5" />Notify me
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Test connection */}
                          {connection.status === 'connected' && (
                            <div className="mb-4 flex items-center gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleTestConnection(connection.type)}
                                disabled={testing[connection.type]}
                                className="border-[var(--ag-border-subtle)] text-[var(--ag-text-accent)] hover:border-[var(--ag-border-default)] hover:bg-[var(--ag-active-bg)] text-xs min-h-[40px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                                data-testid={`test-connection-${connection.type}`}
                              >
                                {testing[connection.type]
                                  ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Testing…</>
                                  : <><Wifi className="w-3 h-3 mr-1.5" />Test Connection</>}
                              </Button>
                              {testResult[connection.type] && (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${testResult[connection.type]!.status === 'pass' ? 'text-[var(--ag-green)]' : 'text-[#FF6161]'}`}>
                                  {testResult[connection.type]!.status === 'pass'
                                    ? <CheckCircle2 className="w-3 h-3" />
                                    : <WifiOff className="w-3 h-3" />}
                                  {testResult[connection.type]!.message}
                                  <span className="text-[var(--ag-text-muted)] font-normal ml-0.5">at {testResult[connection.type]!.at}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Telegram: show linked username */}
                          {isTelegram && connection.status === 'connected' && telegramUsername && (
                            <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(0,136,204,0.06)', boxShadow: '0 0 0 1px rgba(0,136,204,0.15)' }}>
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,136,204,0.15)' }}>
                                <Send className="w-4 h-4 text-[#0088cc]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--ag-text-primary)]">@{telegramUsername}</p>
                                <p className="text-xs text-[var(--ag-text-secondary)]">Open in Telegram to chat with your agent</p>
                              </div>
                              <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium min-h-[40px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                                style={{ background: '#0088cc', boxShadow: '0 2px 8px rgba(0,136,204,0.25)' }}>
                                <ExternalLink className="w-3 h-3" />Open
                              </a>
                            </div>
                          )}

                          {/* Custom Telegram Bot */}
                          {isTelegram && (
                            <div className="mb-4">
                              <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px" style={{ background: 'rgba(167,139,250,0.1)' }} />
                                <span className="text-[11px] text-[var(--ag-text-muted)]">or</span>
                                <div className="flex-1 h-px" style={{ background: 'rgba(167,139,250,0.1)' }} />
                              </div>

                              <button
                                onClick={() => setCustomBotExpanded(!customBotExpanded)}
                                className="flex items-center justify-between w-full min-h-[44px] px-3 py-2.5 rounded-xl group/cbot active:scale-[0.96] transition-[transform,box-shadow] duration-150"
                                style={{
                                  background: 'var(--ag-bg-deep)',
                                  boxShadow: customBotExpanded
                                    ? '0 0 0 1px rgba(167,139,250,0.3), 0 0 12px rgba(167,139,250,0.08)'
                                    : '0 0 0 1px rgba(167,139,250,0.15)',
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Bot className="w-4 h-4 text-[var(--ag-text-accent)]" />
                                  <span className="text-sm font-medium text-[var(--ag-text-primary)]">Connect Your Own Bot</span>
                                  {customBotStatus === 'connected' && customBotInfo && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-[var(--ag-green)]"
                                      style={{ background: 'rgba(0,255,136,0.1)', boxShadow: '0 0 0 1px rgba(0,255,136,0.2)' }}>
                                      Active
                                    </span>
                                  )}
                                </div>
                                {customBotExpanded
                                  ? <ChevronUp className="w-4 h-4 text-[var(--ag-text-muted)] group-hover/cbot:text-[var(--ag-text-accent)] transition-colors duration-150" />
                                  : <ChevronDown className="w-4 h-4 text-[var(--ag-text-muted)] group-hover/cbot:text-[var(--ag-text-accent)] transition-colors duration-150" />}
                              </button>

                              <AnimatePresence initial={false}>
                                {customBotExpanded && (
                                  <motion.div variants={slideDown} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
                                    <div className="mt-3 p-4 rounded-xl space-y-4" style={{ background: 'var(--ag-bg-deep)', boxShadow: '0 0 0 1px rgba(167,139,250,0.12)' }}>
                                      {customBotStatus === 'connected' && customBotInfo ? (
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(0,255,136,0.05)', boxShadow: '0 0 0 1px rgba(0,255,136,0.15)' }}>
                                            <CheckCircle2 className="w-5 h-5 text-[var(--ag-green)] shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-[var(--ag-text-primary)]">{customBotInfo.botName}</p>
                                              <p className="text-xs text-[var(--ag-text-muted)]">@{customBotInfo.botUsername}</p>
                                            </div>
                                            <a href={`https://t.me/${customBotInfo.botUsername}`} target="_blank" rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#0088cc] text-xs font-medium min-h-[36px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                                              style={{ background: 'rgba(0,136,204,0.12)' }}>
                                              <ExternalLink className="w-3 h-3" />Open
                                            </a>
                                          </div>
                                          <Button variant="outline" size="sm" onClick={handleCustomBotDisconnect}
                                            className="w-full min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                                            style={{ borderColor: 'rgba(255,97,97,0.3)', color: '#FF6161' }}>
                                            <Unplug className="w-3.5 h-3.5 mr-1.5" />Disconnect Custom Bot
                                          </Button>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="space-y-2">
                                            <label className="flex items-center gap-1.5 text-xs text-[var(--ag-text-muted)]">
                                              <Key className="w-3 h-3" />Paste your BotFather token
                                            </label>
                                            <Input
                                              type="text"
                                              placeholder="123456:ABC-DEF…"
                                              value={customBotToken}
                                              onChange={(e) => {
                                                setCustomBotToken(e.target.value);
                                                if (customBotStatus === 'error') { setCustomBotStatus('idle'); setCustomBotError(null); }
                                              }}
                                              className="bg-[var(--ag-bg-base)] border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] font-mono text-sm min-h-[44px] rounded-xl"
                                            />
                                          </div>
                                          {customBotStatus === 'error' && customBotError && (
                                            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,97,97,0.06)', boxShadow: '0 0 0 1px rgba(255,97,97,0.2)' }}>
                                              <AlertTriangle className="w-4 h-4 text-[#FF6161] shrink-0 mt-0.5" />
                                              <p className="text-xs text-[#FF6161]">{customBotError}</p>
                                            </div>
                                          )}
                                          <Button
                                            onClick={handleCustomBotConnect}
                                            disabled={customBotStatus === 'verifying' || !customBotToken.trim()}
                                            className="w-full min-h-[44px] font-semibold text-white active:scale-[0.96] transition-[transform,opacity] duration-150 disabled:opacity-50"
                                            style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))', boxShadow: '0 2px 10px rgba(139,92,246,0.25)' }}
                                          >
                                            {customBotStatus === 'verifying'
                                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                                              : <><CheckCircle2 className="w-4 h-4 mr-2" />Verify & Connect</>}
                                          </Button>
                                          <p className="text-[11px] text-[var(--ag-text-muted)] leading-relaxed">
                                            Open{' '}
                                            <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer"
                                              className="text-[var(--ag-text-accent)] hover:underline">
                                              @BotFather
                                            </a>
                                            {' '}in Telegram → /newbot → copy the token
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Footer: last sync + disconnect switch */}
                          <div className="flex items-center justify-between pt-4 text-xs text-[var(--ag-text-muted)]"
                            style={{ borderTop: '1px solid rgba(139,92,246,0.06)' }}>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {connection.lastSync
                                ? <span>Last synced: {timeAgo(connection.lastSync)}</span>
                                : <span>Never synced</span>}
                              {isTelegram && connection.status === 'connected' && telegramUsername && (
                                <span className="text-[#0088cc] font-medium">@{telegramUsername}</span>
                              )}
                              {isTelegram && connection.status === 'connected' && telegramLastPing && (
                                <span className="text-[var(--ag-text-accent)]">Last message: {timeAgo(telegramLastPing)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {connection.status === 'connected' && (
                                <span className="tabular-nums">{connection.requestsToday} req today</span>
                              )}
                              {connection.status === 'connected' && (
                                <Switch
                                  checked={true}
                                  onCheckedChange={() => handleDisconnect(connection.id)}
                                />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Integration Events ── */}
        {integrationEvents.length > 0 && (
          <motion.div custom={filteredIntegrations.length + 7} variants={fadeUp} initial="hidden" animate="show">
            <div className="rounded-2xl p-5 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: SHADOW.card }}>
              <h4 className="text-sm font-heading font-medium text-[var(--ag-text-primary)] mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--ag-violet)]" />
                Recent Integration Events
              </h4>
              <div className="space-y-2.5">
                {integrationEvents.slice(0, 5).map((ev, i) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--ag-text-accent)' }} />
                    <span className="text-[var(--ag-text-primary)] flex-1 truncate">{ev.action}</span>
                    {ev.details && <span className="text-[var(--ag-text-secondary)] truncate max-w-[100px]">{ev.details}</span>}
                    <span className="text-[var(--ag-text-muted)] shrink-0 tabular-nums">{timeAgo(ev.created_at)}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Privacy Note ── */}
        <motion.div custom={filteredIntegrations.length + 8} variants={fadeUp} initial="hidden" animate="show">
          <div className="rounded-2xl p-5 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: SHADOW.card }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Shield className="w-4.5 h-4.5 text-[var(--ag-green)]" />
              </div>
              <div>
                <h4 className="text-sm font-heading font-medium text-[var(--ag-text-primary)] mb-1">Privacy First</h4>
                <p className="text-xs text-[var(--ag-text-secondary)] text-wrap-pretty">
                  Your data is encrypted and never shared. You can disconnect any service at any time.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </DashboardPageWrapper>
  );
}
