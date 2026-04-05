import { useState, useEffect, useCallback } from 'react';
import { PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  Zap,
  Plus,
  Play,
  Trash2,
  Clock,
  Webhook,
  CalendarClock,
  Activity,
  Search,
  Edit3,
  Send,
  Globe,
  RefreshCw,
  Hand,
  Hash,
  HeartPulse,
  FileText,
  Bell,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Pause,
  Timer,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import { automationLogService, automationService } from '@/services/api';
import { confirmAction } from '@/utils/alerts';
import type { AutomationTrigger, AutomationAction, AutomationLog, Automation } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_META: Record<AutomationTrigger, { icon: typeof Clock; label: string; color: string; description: string }> = {
  time: { icon: CalendarClock, label: 'Scheduled', color: '#FFB800', description: 'Run on a schedule' },
  event: { icon: Activity, label: 'Event', color: '#00FF88', description: 'When an event fires' },
  webhook: { icon: Webhook, label: 'Webhook', color: 'var(--ag-cyan)', description: 'When a URL is called' },
  manual: { icon: Hand, label: 'Manual', color: 'var(--ag-text-muted)', description: 'Trigger by hand' },
  keyword: { icon: Hash, label: 'Keyword', color: '#FF2D78', description: 'When a message matches' },
  health_down: { icon: HeartPulse, label: 'Health Check', color: '#FF6161', description: 'When a URL is down' },
};

const ACTION_META: Record<AutomationAction, { icon: typeof Send; label: string; description: string }> = {
  'telegram-message': { icon: Send, label: 'Telegram Message', description: 'Send a Telegram message' },
  'n8n-webhook': { icon: Globe, label: 'n8n Webhook', description: 'Call an n8n webhook URL' },
  'call_api': { icon: Globe, label: 'API Call', description: 'Call any HTTP endpoint' },
  'create_reminder': { icon: Bell, label: 'Create Reminder', description: 'Set a new reminder' },
  'portfolio-update': { icon: RefreshCw, label: 'Portfolio Update', description: 'Update your portfolio' },
  'whatsapp-message': { icon: Send, label: 'WhatsApp Message', description: 'Send a WhatsApp message' },
  'manychat-broadcast': { icon: Send, label: 'ManyChat Broadcast', description: 'Send a broadcast message' },
  'log': { icon: FileText, label: 'Log', description: 'Log a message' },
};

interface TemplateItem {
  name: string;
  description: string;
  icon: string;
  triggerType: AutomationTrigger;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationAction;
  actionConfig: Record<string, string>;
}

const TEMPLATES: TemplateItem[] = [
  {
    name: 'Morning Brief',
    description: 'Daily AI briefing to Telegram at 7am',
    icon: '\u2600\uFE0F',
    triggerType: 'time',
    triggerConfig: { interval_minutes: 1440 },
    actionType: 'telegram-message',
    actionConfig: { message: 'Good morning! Here is your daily briefing.' },
  },
  {
    name: 'Expense Alert',
    description: 'Alert when you log an expense over \u20B91000',
    icon: '\uD83D\uDCB8',
    triggerType: 'keyword',
    triggerConfig: { keyword: 'spent' },
    actionType: 'telegram-message',
    actionConfig: { message: '\uD83D\uDCB8 New expense logged. Check your budget!' },
  },
  {
    name: 'Site Monitor',
    description: 'Check if a URL is down every hour',
    icon: '\uD83D\uDD0D',
    triggerType: 'health_down',
    triggerConfig: { target_url: 'https://your-site.com' },
    actionType: 'telegram-message',
    actionConfig: { message: '\uD83D\uDEA8 Site is down! {{url}} returned error.' },
  },
  {
    name: 'Weekly Summary',
    description: 'Weekly habit and expense report',
    icon: '\uD83D\uDCCA',
    triggerType: 'time',
    triggerConfig: { interval_minutes: 10080 },
    actionType: 'telegram-message',
    actionConfig: { message: 'Here is your weekly summary...' },
  },
  {
    name: 'Webhook \u2192 Telegram',
    description: 'Forward webhook payloads to Telegram',
    icon: '\uD83D\uDD17',
    triggerType: 'webhook',
    triggerConfig: {},
    actionType: 'telegram-message',
    actionConfig: { message: 'Webhook received: {{payload}}' },
  },
];

const SCHEDULE_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '6 hours', value: 360 },
  { label: 'Daily', value: 1440 },
  { label: 'Weekly', value: 10080 },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTriggerSummary(auto: Automation): string {
  if (auto.triggerType === 'time') {
    const cfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string);
    const mins = (cfg?.interval_minutes as number) || 60;
    if (mins < 60) return `Every ${mins} minutes`;
    if (mins === 60) return 'Every hour';
    if (mins === 1440) return 'Every day';
    if (mins === 10080) return 'Every week';
    return `Every ${Math.round(mins / 60)} hours`;
  }
  if (auto.triggerType === 'webhook') return 'When webhook is called';
  if (auto.triggerType === 'manual') return 'Manual trigger';
  if (auto.triggerType === 'keyword') {
    const cfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string);
    return `When message contains "${(cfg?.keyword as string) || '...'}"`;
  }
  if (auto.triggerType === 'health_down') {
    const cfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string);
    return `When ${(cfg?.target_url as string) || 'URL'} is down`;
  }
  if (auto.triggerType === 'event') return 'When an event fires';
  return auto.triggerType;
}

function getActionSummary(auto: Automation): string {
  if (auto.actionType === 'telegram-message') return 'Send Telegram message';
  if (auto.actionType === 'whatsapp-message') return 'Send WhatsApp message';
  if (auto.actionType === 'n8n-webhook' || auto.actionType === 'call_api') {
    const cfg = resolveActionConfig(auto);
    return `Call ${cfg.url || 'webhook'}`;
  }
  if (auto.actionType === 'create_reminder') return 'Create a reminder';
  if (auto.actionType === 'portfolio-update') return 'Update portfolio';
  if (auto.actionType === 'log') return 'Log message';
  if (auto.actionType === 'manychat-broadcast') return 'Send broadcast';
  return auto.actionType;
}

function getStatusBadge(auto: Automation): { label: string; color: string; bg: string } {
  if (!auto.enabled) return { label: 'Paused', color: 'var(--ag-text-muted)', bg: 'rgba(107,114,128,0.12)' };
  if (auto.lastStatus === 'error' || auto.lastStatus === 'failed')
    return { label: 'Error', color: '#FF6161', bg: 'rgba(255,97,97,0.12)' };
  return { label: 'Active', color: '#00FF88', bg: 'rgba(0,255,136,0.12)' };
}

function fmtRelativeTime(ts: string | null | undefined): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function tryParseJSON(str: string | undefined | null): Record<string, unknown> | null {
  if (!str) return null;
  try { return JSON.parse(str) as Record<string, unknown>; } catch { return null; }
}

function resolveActionConfig(auto: Automation): Record<string, string> {
  if (auto.actionConfig && Object.keys(auto.actionConfig).length > 0) return auto.actionConfig;
  const parsed = tryParseJSON(auto.action_config);
  return (parsed as Record<string, string>) ?? {};
}

function parseHttpStatus(output: string): number | null {
  const match = output.match(/^HTTP (\d{3})/);
  return match ? parseInt(match[1], 10) : null;
}

function getHttpStatusBg(status: number): string {
  if (status >= 200 && status < 300) return 'bg-[#00FF88]/10 border-[#00FF88]/20 text-[#00FF88]';
  if (status >= 400) return 'bg-[#FF6161]/10 border-[#FF6161]/20 text-[#FF6161]';
  return 'bg-[#6B7280]/10 border-[#6B7280]/20 text-[var(--ag-text-muted)]';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutomationsPage() {
  const {
    automations,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    triggerAutomation,
  } = useDashboardStore();

  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'jarvis', page: 'automations' });

  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Form State ---
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'time' as AutomationTrigger,
    actionType: 'telegram-message' as AutomationAction,
    enabled: true,
    intervalMinutes: 60,
    webhookUrl: '',
    keywordValue: '',
    healthUrl: '',
    actionConfig: {} as Record<string, string>,
  });
  const [saveError, setSaveError] = useState('');

  // --- Logs state ---
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logsStatusFilter, setLogsStatusFilter] = useState<'' | 'success' | 'failed' | 'error'>('');

  // --- Per-automation run history ---
  const [expandedRunHistory, setExpandedRunHistory] = useState<string | null>(null);
  const [runHistoryLogs, setRunHistoryLogs] = useState<AutomationLog[]>([]);
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);

  // --- Action feedback ---
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
    statusCode?: number;
    latencyMs?: number;
    responseBody?: string;
  } | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{ id: string; simulatedOutput: string } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // --- Stats ---
  const [automationStats, setAutomationStats] = useState<{
    total: number;
    enabled: number;
    disabled: number;
    recentRuns: number;
  } | null>(null);

  // --- Dead letters ---
  const [deadLetters, setDeadLetters] = useState<Array<{
    id: string;
    automation_id: string;
    url: string;
    error: string;
    payload: string | null;
    failed_at: number;
    retry_count: number;
    last_error: string | null;
  }>>([]);
  const [retryingDeadLetterId, setRetryingDeadLetterId] = useState<string | null>(null);

  // Delete confirmation is now handled by SweetAlert2 (confirmAction)

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    automationLogService.list(20, 0, logsStatusFilter || undefined).then((r) => {
      setLogs(r.data.logs);
      setLogsOffset(0);
      setLogsHasMore(r.data.logs.length === 20);
    }).catch(() => setLogs([]));
    automationService.getDeadLetters().then((r) => setDeadLetters(r.data)).catch(() => setDeadLetters([]));
    automationService.getStats().then((r) => setAutomationStats(r.data)).catch(() => {});
  }, [logsStatusFilter]);

  const handleLoadMoreLogs = async () => {
    setLogsLoadingMore(true);
    try {
      const nextOffset = logsOffset + 20;
      const r = await automationLogService.list(20, nextOffset, logsStatusFilter || undefined);
      setLogs(prev => [...prev, ...r.data.logs]);
      setLogsOffset(nextOffset);
      setLogsHasMore(r.data.logs.length === 20);
    } catch { /* ignore */ } finally {
      setLogsLoadingMore(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Per-automation run history
  // ---------------------------------------------------------------------------

  const toggleRunHistory = useCallback(async (autoId: string) => {
    if (expandedRunHistory === autoId) {
      setExpandedRunHistory(null);
      setRunHistoryLogs([]);
      return;
    }
    setExpandedRunHistory(autoId);
    setRunHistoryLoading(true);
    try {
      const r = await automationLogService.forAutomation(autoId, 10, 0);
      setRunHistoryLogs(r.data.logs);
    } catch {
      setRunHistoryLogs([]);
    } finally {
      setRunHistoryLoading(false);
    }
  }, [expandedRunHistory]);

  // ---------------------------------------------------------------------------
  // Form logic
  // ---------------------------------------------------------------------------

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      triggerType: 'time',
      actionType: 'telegram-message',
      enabled: true,
      intervalMinutes: 60,
      webhookUrl: '',
      keywordValue: '',
      healthUrl: '',
      actionConfig: {},
    });
    setEditingId(null);
    setSaveError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleUseTemplate = (t: TemplateItem) => {
    setForm({
      name: t.name,
      description: t.description,
      triggerType: t.triggerType,
      actionType: t.actionType,
      enabled: true,
      intervalMinutes: (t.triggerConfig.interval_minutes as number) || 60,
      webhookUrl: '',
      keywordValue: (t.triggerConfig.keyword as string) || '',
      healthUrl: (t.triggerConfig.target_url as string) || '',
      actionConfig: { ...t.actionConfig },
    });
    setEditingId(null);
    setSaveError('');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const auto = automations.find((a) => a.id === id);
    if (!auto) return;
    const existingInterval = (auto.triggerConfig?.interval_minutes as number | undefined) ?? 60;
    const storedConfig = resolveActionConfig(auto);
    const restoredWebhookUrl = storedConfig.url ?? storedConfig.webhookUrl ?? '';
    const trigCfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string) ?? {};
    setForm({
      name: auto.name,
      description: auto.description,
      triggerType: auto.triggerType,
      actionType: auto.actionType,
      enabled: auto.enabled,
      intervalMinutes: existingInterval,
      webhookUrl: restoredWebhookUrl,
      keywordValue: (trigCfg.keyword as string) || '',
      healthUrl: (trigCfg.target_url as string) || '',
      actionConfig: storedConfig,
    });
    setEditingId(id);
    setSaveError('');
    setIsDialogOpen(true);
  };

  const getValidationError = (): string => {
    if (!form.name.trim()) return 'Name is required';
    const at = form.actionType;
    if ((at === 'telegram-message' || at === 'whatsapp-message' || at === 'manychat-broadcast') && !form.actionConfig.message?.trim())
      return 'Message text is required for this action';
    if ((at === 'n8n-webhook' || at === 'call_api') && !form.webhookUrl.trim())
      return 'Webhook URL is required for this action';
    if (at === 'create_reminder' && !form.actionConfig.reminder_text?.trim())
      return 'Reminder text is required';
    if (form.triggerType === 'keyword' && !form.keywordValue.trim())
      return 'Keyword is required for keyword triggers';
    if (form.triggerType === 'health_down' && !form.healthUrl.trim())
      return 'URL is required for health check triggers';
    return '';
  };

  const validationError = getValidationError();

  const handleSave = async () => {
    const err = getValidationError();
    if (err) { setSaveError(err); return; }
    setSaveError('');
    const action = editingId ? 'update-automation' : 'create-automation';
    await notifyStart(action);
    try {
      // Build trigger config
      let triggerConfig: Record<string, unknown> = {};
      if (form.triggerType === 'time') triggerConfig = { interval_minutes: form.intervalMinutes };
      else if (form.triggerType === 'keyword') triggerConfig = { keyword: form.keywordValue };
      else if (form.triggerType === 'health_down') triggerConfig = { target_url: form.healthUrl };

      // Build action config
      const builtActionConfig: Record<string, string> = { ...form.actionConfig };
      if ((form.actionType === 'n8n-webhook' || form.actionType === 'call_api') && form.webhookUrl) {
        builtActionConfig.url = form.webhookUrl;
      }

      if (editingId) {
        await updateAutomation(editingId, {
          name: form.name,
          description: form.description,
          triggerType: form.triggerType,
          actionType: form.actionType,
          enabled: form.enabled,
          triggerConfig,
          actionConfig: builtActionConfig,
        });
      } else {
        await addAutomation({
          name: form.name,
          description: form.description,
          triggerType: form.triggerType,
          actionType: form.actionType,
          config: {},
          enabled: form.enabled,
          triggerConfig,
          actionConfig: builtActionConfig,
        } as Parameters<typeof addAutomation>[0]);
      }
      setIsDialogOpen(false);
      resetForm();
      await notifyDone(`${editingId ? 'Updated' : 'Created'} automation: ${form.name}`);
      // Refresh stats
      automationService.getStats().then((r) => setAutomationStats(r.data)).catch(() => {});
    } catch {
      setSaveError('Failed to save automation. Please try again.');
      await notifyFail(`Failed to ${editingId ? 'update' : 'create'} automation`);
    }
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleToggle = async (id: string, enabled: boolean) => {
    const auto = automations.find((a) => a.id === id);
    await notifyStart(enabled ? 'disable-automation' : 'enable-automation');
    try {
      await updateAutomation(id, { enabled: !enabled });
      await notifyDone(`${enabled ? 'Disabled' : 'Enabled'} automation: ${auto?.name ?? id}`);
    } catch {
      await notifyFail(`Failed to toggle automation`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirmAction(
      'Delete Automation?',
      `"${name}" will be permanently removed. This cannot be undone.`,
    );
    if (!confirmed) return;
    await notifyStart('delete-automation');
    try {
      await deleteAutomation(id);
      await notifyDone(`Deleted automation: ${name}`);
      automationService.getStats().then((r) => setAutomationStats(r.data)).catch(() => {});
    } catch {
      await notifyFail(`Failed to delete automation: ${name}`);
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    const auto = automations.find((a) => a.id === id);
    await notifyStart('trigger-automation');
    try {
      await triggerAutomation(id);
      await notifyDone(`Triggered automation: ${auto?.name ?? id}`);
    } catch {
      await notifyFail(`Failed to trigger automation: ${auto?.name ?? id}`);
    } finally {
      setRunningId(null);
    }
  };

  const handleTestFire = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const auto = automations.find((a) => a.id === id);
    const isUrlAction = auto && (auto.actionType === 'n8n-webhook' || auto.actionType === 'call_api');
    try {
      if (isUrlAction) {
        const res = await automationService.testFire(id);
        setTestResult({ id, success: res.data.success, message: res.data.message, statusCode: res.data.statusCode, latencyMs: res.data.latencyMs, responseBody: res.data.responseBody });
      } else {
        const res = await automationService.dryRun(id);
        setTestResult({ id, success: true, message: res.data.simulatedOutput });
      }
    } catch {
      setTestResult({ id, success: false, message: 'Test request failed' });
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleDryRun = async (id: string) => {
    try {
      const res = await automationService.dryRun(id);
      setDryRunResult({ id, simulatedOutput: res.data.simulatedOutput });
      setTimeout(() => setDryRunResult(null), 6000);
    } catch { /* ignore */ }
  };

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id);
    try {
      const res = await automationService.duplicate(id);
      // Add to local store
      const store = useDashboardStore.getState();
      useDashboardStore.setState({ automations: [res.data, ...store.automations] });
      automationService.getStats().then((r) => setAutomationStats(r.data)).catch(() => {});
    } catch { /* ignore */ } finally {
      setDuplicatingId(null);
    }
  };

  const handleRetryDeadLetter = async (id: string) => {
    setRetryingDeadLetterId(id);
    try {
      await automationService.retryDeadLetter(id);
      automationService.getDeadLetters().then((r) => setDeadLetters(r.data)).catch(() => {});
    } catch { /* ignore */ } finally {
      setRetryingDeadLetterId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const filtered = automations
    .filter((a) => {
      if (filter === 'active') return a.enabled;
      if (filter === 'inactive') return !a.enabled;
      return true;
    })
    .filter((a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const enabledCount = automations.filter((a) => a.enabled).length;
  const showTemplates = automations.length <= 3;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DashboardPageWrapper>
      <div className="space-y-5 md:space-y-6 px-1 md:px-0 pb-24 md:pb-6">
      {/* Dry-run result toast */}
      {dryRunResult && (
        <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 max-w-sm px-4 py-3 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="dry-run-result">
          <div className="flex items-start gap-2">
            <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-xs mb-0.5">Dry Run Result</p>
              <p className="text-xs text-[#F59E0B]/80">{dryRunResult.simulatedOutput}</p>
            </div>
            <button onClick={() => setDryRunResult(null)} className="text-[#F59E0B]/60 hover:text-[#F59E0B] ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 1: HEADER + STATS                                          */}
      {/* ================================================================== */}
      <BlurFade delay={0.1} inView>
        <PageHeader
          icon={Zap}
          title="Automations"
          subtitle="Jarvis-powered triggers and actions"
          badge={
            <span className="inline-flex items-center gap-1.5 text-sm font-normal text-[var(--ag-text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--ag-accent)] animate-pulse" />
              {automations.length}
            </span>
          }
          actions={
            <Button
              onClick={handleOpenAdd}
              className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-violet-soft)] hover:opacity-90 text-white font-semibold min-h-[44px] px-5 transition-[transform,box-shadow,opacity] duration-150 active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
            >
              <Plus className="w-4 h-4 mr-2" />New Automation
            </Button>
          }
        />
      </BlurFade>

      {/* Compact stat pills */}
      <BlurFade delay={0.2} inView>
        <SectionCard padding="sm" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { label: 'Total', value: automationStats?.total ?? automations.length, icon: BarChart3, color: 'var(--ag-accent)' },
              { label: 'Active', value: automationStats?.enabled ?? enabledCount, icon: CheckCircle2, color: 'var(--ag-success)' },
              { label: 'Runs (7d)', value: automationStats?.recentRuns ?? 0, icon: Timer, color: 'var(--ag-violet)' },
            ].map(s => (
              <div
                key={s.label}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--ag-border-subtle)] shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]"
                style={{ background: `color-mix(in srgb, ${s.color} 8%, transparent)` }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="text-xl font-bold tabular-nums font-heading" style={{ color: s.color }}>{s.value}</span>
                <span className="text-xs text-[var(--ag-text-secondary)]">{s.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </BlurFade>

      {/* ================================================================== */}
      {/* SECTION 2: TEMPLATE GALLERY                                        */}
      {/* ================================================================== */}
      {showTemplates && (
        <BlurFade delay={0.3} inView>
          <SectionCard title="Quick Start Templates" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-5 md:overflow-visible">
              {TEMPLATES.map((t, index) => (
                <BlurFade key={t.name} delay={0.4 + index * 0.1} inView>
                  <button
                    type="button"
                    onClick={() => handleUseTemplate(t)}
                    className="snap-start flex-shrink-0 w-[180px] md:w-auto p-4 rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/30 transition-[transform,box-shadow,border-color] duration-150 text-left group min-h-[44px] active:scale-[0.96] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_4px_16px_rgba(0,0,0,0.4)]"
                  >
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-1 group-hover:text-[var(--ag-accent)] transition-colors">{t.name}</h3>
                    <p className="text-xs text-[var(--ag-text-secondary)] leading-relaxed mb-3">{t.description}</p>
                    <span className="text-xs text-[var(--ag-accent)] font-medium">Use Template <ArrowRight className="w-3 h-3 inline ml-1" /></span>
                  </button>
                </BlurFade>
              ))}
            </div>
          </SectionCard>
        </BlurFade>
      )}

      {/* ================================================================== */}
      {/* FILTERS & SEARCH                                                   */}
      {/* ================================================================== */}
      <BlurFade delay={0.5} inView>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)]" />
            <Input
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] h-11 text-base focus:border-[var(--ag-violet)]/50"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] overflow-x-auto flex-nowrap w-auto">
              <TabsTrigger value="all" className="data-[state=active]:bg-[var(--ag-violet)] data-[state=active]:text-white min-h-[44px] flex-none px-4">All</TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-[var(--ag-success)] data-[state=active]:text-[var(--ag-bg-primary)] min-h-[44px] flex-none px-4">Active</TabsTrigger>
              <TabsTrigger value="inactive" className="data-[state=active]:bg-[var(--ag-text-muted)] data-[state=active]:text-white min-h-[44px] flex-none px-4">Paused</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </BlurFade>

      {/* ================================================================== */}
      {/* SECTION 3: AUTOMATION CARDS                                         */}
      {/* ================================================================== */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((auto, index) => {
            const statusBadge = getStatusBadge(auto);
            const TriggerIcon = TRIGGER_META[auto.triggerType]?.icon || Zap;
            const triggerColor = TRIGGER_META[auto.triggerType]?.color || '#6B7280';
            const runCount = auto.run_count ?? auto.runCount ?? 0;
            const lastRun = auto.last_run ?? auto.lastRun ?? null;
            const isExpanded = expandedRunHistory === auto.id;

            const triggerBorderColor: Record<string, string> = {
              time: '#A78BFA',
              keyword: '#00FF88',
              webhook: '#8B5CF6',
              manual: '#6B7280',
              event: '#00FF88',
              health_down: '#FF6161',
            };
            const leftBorder = triggerBorderColor[auto.triggerType] ?? '#6B7280';

            return (
              <BlurFade key={auto.id} delay={0.6 + index * 0.1} inView>
                <div
                  className={`relative overflow-hidden rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/30 transition-[box-shadow,border-color,opacity] duration-200 p-4 md:p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_16px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_24px_rgba(0,0,0,0.45)] ${!auto.enabled ? 'opacity-60' : ''}`}
                  style={{ borderLeftWidth: '3px', borderLeftColor: leftBorder }}
                >
                  {/* Main card row */}
                  <div className="flex items-start gap-3 md:gap-4">
                    {/* Toggle button */}
                    <button
                      onClick={() => handleToggle(auto.id, auto.enabled)}
                      aria-label={auto.enabled ? `Disable ${auto.name}` : `Enable ${auto.name}`}
                      className="flex-shrink-0 mt-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors hover:bg-white/5"
                    >
                      <div className={`w-10 h-6 rounded-full flex items-center transition-colors duration-200 ${auto.enabled ? 'bg-[#ADFF2F]/20 justify-end' : 'bg-white/10 justify-start'}`}>
                        <div className={`w-5 h-5 rounded-full mx-0.5 transition-colors duration-200 ${auto.enabled ? 'bg-[#ADFF2F]' : 'bg-[#6B7280]'}`} />
                      </div>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] text-base">{auto.name}</h3>
                        <Badge
                          className="text-[10px] font-medium border px-2 py-0.5"
                          style={{
                            background: statusBadge.bg,
                            color: statusBadge.color,
                            borderColor: `${statusBadge.color}30`,
                          }}
                        >
                          {statusBadge.label === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-success)] inline-block mr-1.5 animate-pulse" />}
                          {statusBadge.label === 'Error' && <XCircle className="w-3 h-3 mr-1 inline" />}
                          {statusBadge.label === 'Paused' && <Pause className="w-3 h-3 mr-1 inline" />}
                          {statusBadge.label}
                        </Badge>
                      </div>

                      {/* When / Do summary */}
                      <div className="flex items-center gap-2 text-sm text-[var(--ag-text-muted)] mb-1.5">
                        <TriggerIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: triggerColor }} />
                        <span>{getTriggerSummary(auto)}</span>
                        <ArrowRight className="w-3 h-3 text-[var(--ag-text-secondary)] flex-shrink-0" />
                        <span>{getActionSummary(auto)}</span>
                      </div>

                      {/* Run stats line */}
                      <div className="flex items-center gap-3 text-xs text-[var(--ag-text-secondary)] flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last run: {fmtRelativeTime(lastRun)}
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Play className="w-3 h-3" />
                          {runCount} run{runCount !== 1 ? 's' : ''}
                        </span>
                        {auto.lastStatus && (
                          <span className={`flex items-center gap-1 ${auto.lastStatus === 'success' ? 'text-[#00FF88]' : 'text-[#FF6161]'}`}>
                            {auto.lastStatus === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {auto.lastStatus === 'success' ? 'ok' : auto.lastStatus}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Run Now */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRun(auto.id)}
                        disabled={runningId === auto.id}
                        title="Run now"
                        className="text-[var(--ag-accent)] hover:bg-[var(--ag-accent)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,background-color] duration-150 active:scale-[0.96]"
                      >
                        {runningId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                      {/* Test Fire */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestFire(auto.id)}
                        disabled={testingId === auto.id}
                        title="Test fire (dry run)"
                        className="text-[var(--ag-warning)] hover:bg-[var(--ag-warning)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,background-color] duration-150 active:scale-[0.96]"
                      >
                        {testingId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                      </Button>
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(auto.id)}
                        title="Edit"
                        className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,color,background-color] duration-150 active:scale-[0.96]"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      {/* Duplicate */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(auto.id)}
                        disabled={duplicatingId === auto.id}
                        title="Duplicate"
                        className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,color,background-color] duration-150 active:scale-[0.96]"
                      >
                        {duplicatingId === auto.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(auto.id, auto.name)}
                        title="Delete"
                        className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-danger)] hover:bg-[var(--ag-danger)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,color,background-color] duration-150 active:scale-[0.96]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Test result inline */}
                  {testResult?.id === auto.id && (
                    <div className={`mt-3 rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2 ${testResult.success ? 'bg-[var(--ag-success)]/5 border-[var(--ag-success)]/20 text-[var(--ag-success)]' : 'bg-[var(--ag-danger)]/5 border-[var(--ag-danger)]/20 text-[var(--ag-danger)]'}`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                      <span className="flex-1">{testResult.message}</span>
                      {testResult.statusCode ? <span className="font-mono">{testResult.statusCode}</span> : null}
                      {testResult.latencyMs ? <span className="font-mono">{testResult.latencyMs}ms</span> : null}
                    </div>
                  )}

                  {/* Run history toggle + expandable */}
                  <div className="mt-3 pt-3 border-t border-[var(--ag-border-subtle)]">
                    <button
                      type="button"
                      onClick={() => toggleRunHistory(auto.id)}
                      className="flex items-center gap-2 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-accent)] transition-colors min-h-[44px]"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Run history
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        {runHistoryLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--ag-accent)]" />
                          </div>
                        ) : runHistoryLogs.length === 0 ? (
                          <p className="text-xs text-[var(--ag-text-secondary)] py-2 pl-1">No runs yet</p>
                        ) : (
                          runHistoryLogs.map((log) => {
                            const rawLog = log as unknown as Record<string, unknown>;
                            const status = (rawLog.status as string) ?? log.status ?? 'unknown';
                            const output = (rawLog.output as string) ?? log.output ?? '';
                            const durationMs = (rawLog.duration_ms as number) ?? log.durationMs ?? 0;
                            const createdAt = (rawLog.created_at as string) ?? log.createdAt ?? '';
                            const isRunning = status === 'running' || status === 'pending';
                            const isSuccess = status === 'success';
                            return (
                              <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg /60 border border-white/[0.03]">
                                {isRunning ? (
                                  <Loader2 className="w-3 h-3 flex-shrink-0 text-[#F59E0B] animate-spin" />
                                ) : isSuccess ? (
                                  <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-[var(--ag-success)]" />
                                ) : (
                                  <XCircle className="w-3 h-3 flex-shrink-0 text-[var(--ag-danger)]" />
                                )}
                                <span className="text-xs text-[var(--ag-text-muted)] flex-shrink-0 w-20">
                                  {createdAt ? fmtRelativeTime(createdAt) : '--'}
                                </span>
                                <span className="text-xs text-[var(--ag-text-secondary)] truncate flex-1">{output || '--'}</span>
                                {durationMs > 0 && (
                                  <span className="text-[10px] text-[var(--ag-text-secondary)] font-mono flex-shrink-0">{durationMs}ms</span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </BlurFade>
            );
          })
        ) : (
          <BlurFade delay={0.7} inView>
            <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ag-accent)]/5 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-[var(--ag-accent)]/30" />
                </div>
                <h3 className="text-[var(--ag-text-primary)] font-heading font-medium mb-1">
                  {searchQuery || filter !== 'all' ? 'No automations match your filters' : 'No automations yet'}
                </h3>
                <p className="text-sm text-[var(--ag-text-secondary)] mb-4 max-w-xs mx-auto">
                  {searchQuery || filter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Create one from a template or build your own.'}
                </p>
                {!searchQuery && filter === 'all' && (
                  <Button onClick={handleOpenAdd} className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-violet-soft)] hover:opacity-90 text-white min-h-[44px] transition-[transform,opacity] duration-150 active:scale-[0.96] shadow-[0_4px_16px_rgba(139,92,246,0.3)]">
                    <Plus className="w-4 h-4 mr-2" /> Create Automation
                  </Button>
                )}
              </div>
            </SectionCard>
          </BlurFade>
        )}
      </div>

      {/* ================================================================== */}
      {/* SECTION 4: CREATE / EDIT DIALOG                                     */}
      {/* ================================================================== */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] max-w-lg mx-2 md:mx-auto p-0 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-xl font-heading font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--ag-accent)]" />
              {editingId ? 'Edit Automation' : 'New Automation'}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-5">
            {/* Section 1: Name & Description */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-1.5 block uppercase tracking-wider">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Morning briefing, Deploy webhook..."
                  className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base focus:border-[var(--ag-violet)]/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-1.5 block uppercase tracking-wider">Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this automation do?"
                  className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base focus:border-[var(--ag-violet)]/50"
                />
              </div>
            </div>

            {/* Section 2: WHEN (Trigger) */}
            <div>
              <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-2.5 block uppercase tracking-wider">When (Trigger)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(TRIGGER_META) as [AutomationTrigger, typeof TRIGGER_META[AutomationTrigger]][]).map(([key, meta]) => {
                  const isSelected = form.triggerType === key;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, triggerType: key })}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] text-left min-h-[44px] ${
                        isSelected
                          ? 'border-[var(--ag-violet)]/50 bg-[#8B5CF6]/5'
                          : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" style={{ color: isSelected ? meta.color : '#9CA3AF' }} />
                      <span className={`text-xs font-medium ${isSelected ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-secondary)]'}`}>{meta.label}</span>
                      <span className="text-[10px] text-[var(--ag-text-secondary)] leading-tight">{meta.description}</span>
                    </button>
                  );
                })}
              </div>

              {/* Trigger config fields */}
              {form.triggerType === 'time' && (
                <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3 space-y-3">
                  <p className="text-xs text-[var(--ag-text-secondary)] font-medium">Schedule</p>
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_PRESETS.map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm({ ...form, intervalMinutes: value })}
                        className={`text-xs px-3 py-2 rounded-lg border transition-colors min-h-[44px] ${
                          form.intervalMinutes === value
                            ? 'bg-[#8B5CF6]/10 border-[var(--ag-violet)]/40 text-[#ADFF2F]'
                            : 'bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[rgba(139,92,246,0.15)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--ag-text-secondary)]">Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={10080}
                      value={form.intervalMinutes}
                      onChange={(e) => setForm({ ...form, intervalMinutes: Math.max(1, parseInt(e.target.value, 10) || 60) })}
                      className="w-20 p-2 text-sm rounded-lg bg-[var(--ag-bg-surface)] border border-white/10 text-[var(--ag-text-primary)] h-11"
                    />
                    <span className="text-xs text-[var(--ag-text-secondary)]">minutes</span>
                  </div>
                </div>
              )}

              {form.triggerType === 'webhook' && (
                <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3">
                  <p className="text-xs text-[var(--ag-text-secondary)] mb-2 font-medium">Incoming Webhook</p>
                  <p className="text-xs text-[var(--ag-text-muted)] mb-2">POST to this URL to trigger the automation:</p>
                  <code className="text-xs text-[#FFB800] bg-[#FFB800]/5 px-2 py-1 rounded block break-all">/api/webhooks/receive/&lt;auto-id&gt;</code>
                  <pre className="text-xs text-[#ADFF2F]/60 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed mt-2 p-2 bg-[var(--ag-bg-surface)] rounded-lg border border-white/[0.03]">
{`{
  "event": "webhook.trigger",
  "automationId": "<auto-id>",
  "payload": { "key": "value" }
}`}
                  </pre>
                </div>
              )}

              {form.triggerType === 'keyword' && (
                <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3 space-y-2">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium block">Keyword to match</label>
                  <Input
                    value={form.keywordValue}
                    onChange={(e) => setForm({ ...form, keywordValue: e.target.value })}
                    placeholder="e.g., spent, reminder, alert..."
                    className="bg-[var(--ag-bg-surface)] border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                  />
                </div>
              )}

              {form.triggerType === 'health_down' && (
                <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3 space-y-2">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium block">URL to monitor</label>
                  <Input
                    type="url"
                    value={form.healthUrl}
                    onChange={(e) => setForm({ ...form, healthUrl: e.target.value })}
                    placeholder="https://your-site.com"
                    className="bg-[var(--ag-bg-surface)] border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                  />
                </div>
              )}

              {form.triggerType === 'manual' && (
                <div className="mt-3 rounded-xl border border-[var(--ag-border-subtle)] p-3">
                  <p className="text-xs text-[var(--ag-text-muted)]">No configuration needed. You will trigger this manually.</p>
                </div>
              )}
            </div>

            {/* Section 3: DO (Action) */}
            <div>
              <label className="text-xs font-medium text-[var(--ag-text-secondary)] mb-2.5 block uppercase tracking-wider">Do (Action)</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(ACTION_META) as [AutomationAction, typeof ACTION_META[AutomationAction]][]).map(([key, meta]) => {
                  const isSelected = form.actionType === key;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, actionType: key })}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border transition-[transform,border-color,background-color] duration-150 active:scale-[0.96] text-left min-h-[44px] ${
                        isSelected
                          ? 'border-[var(--ag-violet)]/50 bg-[#8B5CF6]/5'
                          : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isSelected ? '#ADFF2F' : '#9CA3AF' }} />
                      <div className="min-w-0">
                        <span className={`text-xs font-medium block ${isSelected ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-secondary)]'}`}>{meta.label}</span>
                        <span className="text-[10px] text-[var(--ag-text-secondary)] block truncate">{meta.description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action config fields */}
              {(form.actionType === 'telegram-message' || form.actionType === 'whatsapp-message' || form.actionType === 'manychat-broadcast') && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium">Message text</label>
                  <textarea
                    placeholder="Message to send..."
                    value={form.actionConfig.message ?? ''}
                    onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, message: e.target.value } })}
                    rows={3}
                    className="w-full p-3 rounded-xl border border-white/10 text-[var(--ag-text-primary)] text-base resize-none focus:border-[var(--ag-violet)]/50 focus:outline-none transition-colors"
                  />
                </div>
              )}

              {(form.actionType === 'n8n-webhook' || form.actionType === 'call_api') && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--ag-text-secondary)] font-medium">Webhook URL</label>
                    <Input
                      type="url"
                      placeholder="https://your-webhook-endpoint.com/..."
                      value={form.webhookUrl}
                      onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                      className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                    />
                    {form.webhookUrl && form.webhookUrl.startsWith('http://') && !form.webhookUrl.startsWith('https://') && (
                      <p className="text-xs flex items-center gap-1.5 text-[#F59E0B]">
                        <span className="text-sm">!</span> Using http:// sends data unencrypted. Use https:// for production.
                      </p>
                    )}
                  </div>
                  {form.actionType === 'call_api' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--ag-text-secondary)] font-medium">HTTP Method</label>
                      <div className="flex gap-2">
                        {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map(method => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setForm({ ...form, actionConfig: { ...form.actionConfig, method } })}
                            className={`text-xs px-3 py-2 rounded-lg border transition-colors min-h-[44px] font-mono ${
                              (form.actionConfig.method ?? 'POST') === method
                                ? 'bg-[#8B5CF6]/10 border-[var(--ag-violet)]/40 text-[#ADFF2F]'
                                : 'bg-[rgba(12,12,30,0.6)] border-[rgba(139,92,246,0.08)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[rgba(139,92,246,0.15)]'
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {form.actionType === 'create_reminder' && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--ag-text-secondary)] font-medium">Reminder text</label>
                    <Input
                      placeholder="What to remind about..."
                      value={form.actionConfig.reminder_text ?? ''}
                      onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, reminder_text: e.target.value } })}
                      className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--ag-text-secondary)] font-medium">When (date &amp; time)</label>
                    <Input
                      type="datetime-local"
                      value={form.actionConfig.reminder_datetime ?? ''}
                      onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, reminder_datetime: e.target.value } })}
                      className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base [color-scheme:dark]"
                    />
                    <p className="text-[10px] text-[var(--ag-text-secondary)]">Leave blank to create reminder immediately when automation fires.</p>
                  </div>
                </div>
              )}

              {form.actionType === 'log' && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-xs text-[var(--ag-text-secondary)] font-medium">Log message</label>
                  <Input
                    placeholder="Message to log..."
                    value={form.actionConfig.message ?? ''}
                    onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, message: e.target.value } })}
                    className="border-white/10 text-[var(--ag-text-primary)] h-11 text-base"
                  />
                </div>
              )}
            </div>

            {/* Section 4: Preview */}
            <div className="rounded-xl border border-[rgba(139,92,246,0.08)] bg-[#8B5CF6]/[0.02] p-4">
              <p className="text-xs text-[var(--ag-text-secondary)] font-medium mb-2 uppercase tracking-wider">Preview</p>
              <p className="text-sm text-[var(--ag-text-primary)]">
                <span style={{ color: TRIGGER_META[form.triggerType]?.color || '#9CA3AF' }}>
                  {form.triggerType === 'time' ? (() => {
                    const m = form.intervalMinutes;
                    if (m < 60) return `Every ${m} minutes`;
                    if (m === 60) return 'Every hour';
                    if (m === 1440) return 'Every day';
                    if (m === 10080) return 'Every week';
                    return `Every ${Math.round(m / 60)} hours`;
                  })() : TRIGGER_META[form.triggerType]?.label || form.triggerType}
                </span>
                <ArrowRight className="w-3.5 h-3.5 inline mx-2 text-[var(--ag-text-secondary)]" />
                <span className="text-[#ADFF2F]">{ACTION_META[form.actionType]?.label || form.actionType}</span>
              </p>
              {editingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDryRun(editingId)}
                  className="mt-2 text-[#F59E0B] hover:bg-[#F59E0B]/10 min-h-[44px] text-xs"
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                  Test Dry Run
                </Button>
              )}
            </div>

            {/* Error */}
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-[#FF6161] bg-[#FF6161]/5 border border-[#FF6161]/20 rounded-xl px-4 py-2.5">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {saveError}
              </div>
            )}

            {/* Section 5: Save */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
                className="flex-1 border-white/10 hover:bg-white/5 min-h-[44px] transition-[transform,background-color] duration-150 active:scale-[0.96]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!!validationError}
                className="flex-1 bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-violet-soft)] hover:opacity-90 text-white font-semibold min-h-[44px] transition-[transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-40 shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
              >
                {editingId ? 'Save Changes' : 'Create Automation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* SECTION 6: RECENT RUNS (global logs)                                */}
      {/* ================================================================== */}
      <BlurFade delay={0.8} inView>
        <SectionCard title="Recent Runs" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
        <div className="flex items-center justify-end mb-3">
          <select
            value={logsStatusFilter}
            onChange={(e) => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
            className="text-xs px-3 py-2 rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] text-[var(--ag-text-secondary)] focus:outline-none focus:border-[var(--ag-violet)]/30 min-h-[44px]"
            aria-label="Filter logs by status"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="error">Error</option>
          </select>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="w-10 h-10 text-[var(--ag-accent)]/20 mx-auto mb-3" />
            <h3 className="text-[var(--ag-text-primary)] font-heading">No automation runs yet</h3>
            <p className="text-sm text-[var(--ag-text-secondary)]">Trigger an automation to see its history here</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-[var(--ag-border-subtle)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ag-border-subtle)] /50">
                    <th className="text-left px-4 py-3 text-[var(--ag-text-secondary)] font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-[var(--ag-text-secondary)] font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Code</th>
                    <th className="text-left px-4 py-3 text-[var(--ag-text-secondary)] font-medium text-xs uppercase tracking-wider">Output</th>
                    <th className="text-left px-4 py-3 text-[var(--ag-text-secondary)] font-medium text-xs uppercase tracking-wider hidden md:table-cell">Duration</th>
                    <th className="text-left px-4 py-3 text-[var(--ag-text-secondary)] font-medium text-xs uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const rawLog = log as unknown as Record<string, unknown>;
                    const status = (rawLog.status as string) ?? log.status ?? 'unknown';
                    const output = (rawLog.output as string) ?? log.output ?? '';
                    const durationMs = (rawLog.duration_ms as number) ?? log.durationMs ?? 0;
                    const createdAt = (rawLog.created_at as string) ?? log.createdAt ?? '';
                    return (
                      <tr key={log.id} className="border-b border-white/[0.03] hover:bg-[#8B5CF6]/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            status === 'success'
                              ? 'bg-[var(--ag-success)]/10 text-[var(--ag-success)] border border-[var(--ag-success)]/20'
                              : 'bg-[var(--ag-danger)]/10 text-[var(--ag-danger)] border border-[var(--ag-danger)]/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'success' ? 'bg-[var(--ag-success)]' : 'bg-[var(--ag-danger)]'}`} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {(() => {
                            const httpCode = parseHttpStatus(output);
                            if (!httpCode) return <span className="text-[var(--ag-text-secondary)] text-xs">--</span>;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${getHttpStatusBg(httpCode)}`}>
                                {httpCode}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-[var(--ag-text-muted)] max-w-[240px] text-xs">
                          {output ? (() => {
                            try {
                              const parsed = JSON.parse(output);
                              return (
                                <pre className="text-xs text-[var(--ag-text-secondary)] p-2 /50 rounded-lg overflow-auto max-h-24 whitespace-pre-wrap break-all">
                                  {JSON.stringify(parsed, null, 2)}
                                </pre>
                              );
                            } catch {
                              return <span className="truncate block">{output}</span>;
                            }
                          })() : <span className="text-[var(--ag-text-secondary)]">--</span>}
                        </td>
                        <td className="px-4 py-3 text-[var(--ag-text-secondary)] font-mono text-xs hidden md:table-cell">
                          {durationMs > 0 ? `${durationMs}ms` : '--'}
                        </td>
                        <td className="px-4 py-3 text-[var(--ag-text-muted)] text-xs whitespace-nowrap">
                          {createdAt ? fmtRelativeTime(createdAt) : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {logsHasMore && (
              <div className="flex justify-center p-3 border-t border-[var(--ag-border-subtle)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMoreLogs}
                  disabled={logsLoadingMore}
                  className="text-[var(--ag-accent)] hover:text-[var(--ag-accent)] hover:bg-[var(--ag-accent)]/10 min-h-[44px] transition-[transform,background-color] duration-150 active:scale-[0.96]"
                >
                  {logsLoadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  )}
                  Load More Runs
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Dead-letter panel */}
        {deadLetters.length > 0 && (
          <div className="mt-4 rounded-xl bg-[var(--ag-danger)]/[0.03] border border-[var(--ag-danger)]/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[var(--ag-danger)]" />
              <span className="text-sm font-heading font-semibold text-[var(--ag-danger)]">Failed Deliveries</span>
              <Badge className="bg-[var(--ag-danger)]/10 text-[var(--ag-danger)] border border-[var(--ag-danger)]/20">{deadLetters.length}</Badge>
            </div>
            <div className="space-y-2">
              {deadLetters.slice(0, 5).map((dl) => {
                const auto = automations.find((a) => a.id === dl.automation_id);
                return (
                  <div key={dl.id} className="flex flex-col gap-1 bg-[var(--ag-bg-surface)] rounded-xl px-4 py-3 border border-[var(--ag-danger)]/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--ag-text-primary)] truncate">{auto?.name ?? dl.automation_id.slice(0, 8)}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-[var(--ag-text-secondary)] whitespace-nowrap">
                          {fmtRelativeTime(new Date(dl.failed_at).toISOString())}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetryDeadLetter(dl.id)}
                          disabled={retryingDeadLetterId === dl.id}
                          className="text-xs text-[var(--ag-accent)] hover:bg-[var(--ag-accent)]/10 min-h-[44px] min-w-[44px] px-3 transition-[transform,background-color] duration-150 active:scale-[0.96]"
                        >
                          {retryingDeadLetterId === dl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                          {retryingDeadLetterId === dl.id ? '' : 'Retry'}
                        </Button>
                      </div>
                    </div>
                    <span className="text-xs text-[var(--ag-danger)] truncate">{dl.last_error ?? dl.error}</span>
                    {dl.retry_count > 0 && (
                      <span className="text-xs text-[var(--ag-warning)]">Retried {dl.retry_count}x</span>
                    )}
                    <span className="text-xs text-[var(--ag-text-secondary)] truncate font-mono">{dl.url}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </SectionCard>
      </BlurFade>
      </div>
    </DashboardPageWrapper>
  );
}
