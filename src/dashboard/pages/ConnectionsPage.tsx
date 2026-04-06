// ============================================================
// Connections Page — state + data fetching only.
// All UI is delegated to connections/ sub-components.
// ============================================================
import { DashboardPageWrapper, PageHeader } from '@/components/agentin';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plug, Shield, Plus, Link, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';
import { notify } from '@/services/notifications';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  fadeUp,
  type TelegramStep,
  type TelegramLinkData,
  type CustomBotStatus,
  type CustomBotInfo,
  type TestResultEntry,
} from './connections/helpers';
import { TelegramWizard, EmailDialog } from './connections/ConfigDialog';
import { IntegrationList } from './connections/IntegrationList';
import { StatsRow } from './connections/StatsRow';
import { InviteLinkCard } from './connections/InviteLinkCard';
import { FilterChips } from './connections/FilterChips';
import { EventsFeed } from './connections/EventsFeed';

const MAX_TELEGRAM_POLL = 30;

export function ConnectionsPage() {
  const { integrations, connectIntegration, disconnectIntegration, loadIntegrations } = useDashboardStore();
  const isMobile = useMobileDetect();
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'nova', page: 'connections' });

  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as 'all' | 'connected' | 'disconnected') || 'all';
  const setStatusFilter = (v: 'all' | 'connected' | 'disconnected') => {
    setSearchParams(v === 'all' ? {} : { status: v }, { replace: true });
  };

  // ── Connection state ──────────────────────────────────────────────────────
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // ── Telegram wizard ───────────────────────────────────────────────────────
  const [telegramDialog, setTelegramDialog] = useState(false);
  const [telegramStep, setTelegramStep] = useState<TelegramStep>('idle');
  const [telegramLink, setTelegramLink] = useState<TelegramLinkData | null>(null);
  const [polling, setPolling] = useState(false);
  const [telegramPollAttempts, setTelegramPollAttempts] = useState(0);
  const [telegramLastPing, setTelegramLastPing] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);

  // ── Health + ping ─────────────────────────────────────────────────────────
  const [healthStatus, setHealthStatus] = useState<Record<string, 'healthy' | 'unhealthy' | 'checking'>>({});
  const [pingLatency, setPingLatency] = useState<Record<string, number | null>>({});
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  // ── Email dialog ──────────────────────────────────────────────────────────
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // ── Invite link ───────────────────────────────────────────────────────────
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // ── Test + expand ─────────────────────────────────────────────────────────
  const [testResult, setTestResult] = useState<Record<string, TestResultEntry | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Custom bot ────────────────────────────────────────────────────────────
  const [customBotToken, setCustomBotToken] = useState('');
  const [customBotStatus, setCustomBotStatus] = useState<CustomBotStatus>('idle');
  const [customBotInfo, setCustomBotInfo] = useState<CustomBotInfo | null>(null);
  const [customBotError, setCustomBotError] = useState<string | null>(null);
  const [customBotExpanded, setCustomBotExpanded] = useState(false);

  // ── Integration events ────────────────────────────────────────────────────
  const [integrationEvents, setIntegrationEvents] = useState<
    Array<{ id: string; action: string; details: string; icon: string; created_at: string }>
  >([]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    integrationService.getEvents(10).then((r) => setIntegrationEvents(r.data.events)).catch(() => {});
  }, []);

  useEffect(() => {
    const runHealthChecks = async () => {
      const connected = integrations.filter((c) => c.status === 'connected');
      if (connected.length === 0) return;
      setHealthStatus((prev) => {
        const next = { ...prev };
        for (const c of connected) next[c.type] = 'checking';
        return next;
      });
      const results = await Promise.allSettled(
        connected.map((c) => integrationService.testIntegration(c.type)),
      );
      setHealthStatus((prev) => {
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
    const tg = integrations.find((i) => i.type === 'telegram' && i.status === 'connected');
    if (!tg) return;
    integrationService
      .checkTelegramLink()
      .then((r) => {
        if (r.data.lastPing) setTelegramLastPing(r.data.lastPing);
        if (r.data.username) setTelegramUsername(r.data.username);
      })
      .catch(() => {});
  }, [integrations]);

  useEffect(() => {
    integrationService
      .getCustomTelegramBotStatus()
      .then((r) => {
        if (r.data.connected && r.data.botName && r.data.botUsername) {
          setCustomBotInfo({ botName: r.data.botName, botUsername: r.data.botUsername });
          setCustomBotStatus('connected');
        }
      })
      .catch(() => {});
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────
  const pollTelegramStatus = useCallback(async () => {
    try {
      const res = await integrationService.checkTelegramLink();
      if (res.data.linked) { setTelegramStep('success'); setPolling(false); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!polling) return;
    if (telegramPollAttempts >= MAX_TELEGRAM_POLL) { setPolling(false); setTelegramStep('timeout'); return; }
    const base = Math.min(1000 * Math.pow(2, telegramPollAttempts), 5000);
    const delay = Math.max(500, base + (Math.random() * 500 - 250));
    const timer = setTimeout(() => { pollTelegramStatus(); setTelegramPollAttempts((a) => a + 1); }, delay);
    return () => clearTimeout(timer);
  }, [polling, telegramPollAttempts, pollTelegramStatus]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const connectedCount = integrations.filter((c) => c.status === 'connected').length;
  const totalRequests  = integrations.reduce((acc, c) => acc + c.requestsToday, 0);
  const avgHealth = Math.round(
    integrations.filter((c) => c.status === 'connected').reduce((acc, c) => acc + c.health, 0) /
      (connectedCount || 1),
  );
  const filteredIntegrations =
    statusFilter === 'all'
      ? integrations
      : integrations.filter((c) =>
          statusFilter === 'connected' ? c.status === 'connected' : c.status !== 'connected',
        );

  // ── Handlers ──────────────────────────────────────────────────────────────
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
      if (type === 'email') { setEmailAddress(''); setEmailSaved(false); setEmailDialog(true); return; }
      if (type === 'telegram') {
        setTelegramDialog(true); setTelegramStep('generating'); setTelegramPollAttempts(0);
        try {
          const res = await integrationService.linkTelegram();
          setTelegramLink(res.data);
          if (res.data.linked) {
            setTelegramDialog(false); setTelegramStep('idle'); setTelegramLink(null);
            setConnectingId(null); loadIntegrations();
          } else { setTelegramStep('open-bot'); setPolling(true); }
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
    } finally { setConnectingId(null); }
  };

  const handlePing = async (type: string) => {
    setPinging((p) => ({ ...p, [type]: true }));
    setPingLatency((p) => ({ ...p, [type]: null }));
    try {
      const res = await integrationService.pingIntegration(type);
      setPingLatency((p) => ({ ...p, [type]: res.data.latencyMs }));
      setHealthStatus((p) => ({ ...p, [type]: res.data.healthy ? 'healthy' : 'unhealthy' }));
    } catch { setPingLatency((p) => ({ ...p, [type]: null })); }
    finally { setPinging((p) => ({ ...p, [type]: false })); }
  };

  const handleTestConnection = async (type: string) => {
    setTesting((p) => ({ ...p, [type]: true }));
    setTestResult((p) => ({ ...p, [type]: null }));
    try {
      const res = await integrationService.testIntegration(type);
      const healthy = res.data.healthy;
      setTestResult((p) => ({
        ...p,
        [type]: { status: healthy ? 'pass' : 'fail', message: healthy ? 'Connection is healthy' : 'Connection has issues', at: new Date().toLocaleTimeString() },
      }));
      setHealthStatus((p) => ({ ...p, [type]: healthy ? 'healthy' : 'unhealthy' }));
    } catch {
      setTestResult((p) => ({ ...p, [type]: { status: 'fail', message: 'Test failed — service unreachable', at: new Date().toLocaleTimeString() } }));
    } finally { setTesting((p) => ({ ...p, [type]: false })); }
  };

  const handleDisconnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (integration?.type === 'email') await integrationService.updateNotificationEmail({ enabled: false });
    if (integration?.type === 'telegram') { try { await integrationService.unlinkTelegram(); } catch { /* ignore */ } }
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

  // ── Shared props for IntegrationList ──────────────────────────────────────
  const listProps = {
    filteredIntegrations, statusFilter, connectingId, expandedId, isMobile,
    healthStatus, pingLatency, pinging, testing, testResult,
    telegramUsername, telegramLastPing,
    customBotExpanded, customBotStatus, customBotInfo, customBotToken, customBotError,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onPing: handlePing,
    onTestConnection: handleTestConnection,
    onToggleExpand: (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    onSetCustomBotExpanded: setCustomBotExpanded,
    onSetCustomBotToken: setCustomBotToken,
    onSetCustomBotStatus: setCustomBotStatus,
    onSetCustomBotError: setCustomBotError,
    onCustomBotConnect: handleCustomBotConnect,
    onCustomBotDisconnect: handleCustomBotDisconnect,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <div data-testid="connections-page" className="space-y-5 pb-24 md:pb-8 overflow-x-hidden">

        {/* Header */}
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
                  <Shield className="w-3.5 h-3.5" />Encrypted
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
                  <Plus className="w-4 h-4 mr-2" />Add New
                </Button>
              </div>
            }
          />
        </motion.div>

        {/* Stats */}
        <StatsRow connectedCount={connectedCount} totalRequests={totalRequests} avgHealth={avgHealth} />

        {/* Invite link */}
        <AnimatePresence initial={false}>
          {inviteUrl && (
            <InviteLinkCard
              inviteUrl={inviteUrl}
              inviteCopied={inviteCopied}
              onDismiss={() => setInviteUrl(null)}
              onCopy={handleCopyInvite}
            />
          )}
        </AnimatePresence>

        {/* Telegram wizard */}
        <AnimatePresence initial={false}>
          {telegramDialog && (
            <TelegramWizard
              telegramStep={telegramStep}
              telegramLink={telegramLink}
              onClose={closeTelegramDialog}
              onRetry={() => { setTelegramPollAttempts(0); setPolling(true); setTelegramStep('open-bot'); }}
            />
          )}
        </AnimatePresence>

        {/* Email dialog */}
        <AnimatePresence initial={false}>
          {emailDialog && (
            <EmailDialog
              emailAddress={emailAddress}
              emailSaving={emailSaving}
              emailSaved={emailSaved}
              onClose={() => setEmailDialog(false)}
              onEmailChange={setEmailAddress}
              onSave={handleEmailSave}
            />
          )}
        </AnimatePresence>

        {/* Filter chips */}
        <FilterChips
          statusFilter={statusFilter}
          totalCount={integrations.length}
          connectedCount={connectedCount}
          onFilter={setStatusFilter}
        />

        {/* Integration grid */}
        <IntegrationList {...listProps} />

        {/* Events + privacy note */}
        <EventsFeed events={integrationEvents} cardCount={filteredIntegrations.length} />

      </div>
    </DashboardPageWrapper>
  );
}
