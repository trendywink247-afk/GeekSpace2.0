import { useState, useEffect } from 'react';
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
  ToggleLeft,
  ToggleRight,
  Edit3,
  Send,
  Globe,
  MessageSquare,
  RefreshCw,
  Hand,
  Hash,
  HeartPulse,
  FileText,
  Phone,
  Bell,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import { automationLogService, automationService } from '@/services/api';
import type { AutomationTrigger, AutomationAction, AutomationLog } from '@/types';

const triggerIcons: Record<AutomationTrigger, typeof Clock> = {
  time: CalendarClock,
  event: Activity,
  webhook: Webhook,
  manual: Hand,
  keyword: Hash,
  health_down: HeartPulse,
};

const triggerLabels: Record<AutomationTrigger, string> = {
  time: 'Scheduled',
  event: 'Event-based',
  webhook: 'Webhook',
  manual: 'Manual',
  keyword: 'Keyword',
  health_down: 'Health Check',
};

const triggerColors: Record<AutomationTrigger, string> = {
  time: '#FFB800',
  event: '#00FF88',
  webhook: '#00F0FF',
  manual: '#6B7280',
  keyword: '#FF2D78',
  health_down: '#FF6161',
};

const actionIcons: Record<AutomationAction, typeof Send> = {
  'n8n-webhook': Globe,
  'telegram-message': Send,
  'whatsapp-message': Send,
  'portfolio-update': RefreshCw,
  'manychat-broadcast': MessageSquare,
  'call_api': Phone,
  'create_reminder': Bell,
  'log': FileText,
};

const actionLabels: Record<AutomationAction, string> = {
  'n8n-webhook': 'n8n Webhook',
  'telegram-message': 'Telegram Message',
  'whatsapp-message': 'WhatsApp Message',
  'portfolio-update': 'Portfolio Update',
  'manychat-broadcast': 'ManyChat Broadcast',
  'call_api': 'API Call',
  'create_reminder': 'Create Reminder',
  'log': 'Log',
};

export function AutomationsPage() {
  const {
    automations,
    addAutomation,
    updateAutomation,
    deleteAutomation,
  } = useDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'time' as AutomationTrigger,
    actionType: 'telegram-message' as AutomationAction,
    enabled: true,
    // 62.6: Cron builder — stores interval in minutes for time-based triggers
    intervalMinutes: 60,
    // 65.8: Webhook URL field for n8n-webhook / call_api
    webhookUrl: '',
    // B3: action-specific configuration payload
    actionConfig: {} as Record<string, string>,
  });
  const [saveError, setSaveError] = useState('');
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  // 53.7: Pagination state for automation logs
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  // 63.4: Run log status filter
  const [logsStatusFilter, setLogsStatusFilter] = useState<'' | 'success' | 'failed' | 'error'>('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; statusCode?: number; latencyMs?: number; responseBody?: string } | null>(null);
  // 64.5: Automation stats
  const [automationStats, setAutomationStats] = useState<{ total: number; enabled: number; disabled: number; recentRuns: number } | null>(null);

  // 37.4: Dead-letter log
  const [deadLetters, setDeadLetters] = useState<Array<{ id: string; automation_id: string; url: string; error: string; payload: string | null; failed_at: number; retry_count: number; last_error: string | null }>>([]);
  // 55.6: Dead-letter retry state
  const [retryingDeadLetterId, setRetryingDeadLetterId] = useState<string | null>(null);
  const [triggerErrors] = useState<Record<string, string>>({});
  // 61.8: Dry-run result popover
  const [dryRunResult, setDryRunResult] = useState<{ id: string; simulatedOutput: string } | null>(null);

  const resetForm = () => {
    setForm({ name: '', description: '', triggerType: 'time', actionType: 'telegram-message', enabled: true, intervalMinutes: 60, webhookUrl: '', actionConfig: {} });
    setEditingId(null);
    setSaveError('');
  };

  useEffect(() => {
    automationLogService.list(20, 0, logsStatusFilter || undefined).then((r) => {
      setLogs(r.data.logs);
      setLogsOffset(0);
      setLogsHasMore(r.data.logs.length === 20);
    }).catch(() => setLogs([]));
    automationService.getDeadLetters().then((r) => setDeadLetters(r.data)).catch(() => setDeadLetters([]));
    // 64.5: load stats
    automationService.getStats().then((r) => setAutomationStats(r.data)).catch(() => {});
  }, [logsStatusFilter]);

  // 53.7: Load more logs handler
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

  const handleOpenAdd = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const auto = automations.find((a) => a.id === id);
    if (!auto) return;
    const existingInterval = (auto.triggerConfig?.interval_minutes as number | undefined) ?? 60;
    // B3: restore actionConfig from stored automation (API returns snake_case action_config or camelCase actionConfig)
    const storedConfig: Record<string, string> = auto.actionConfig
      ?? (() => { try { return JSON.parse(auto.action_config || '{}') as Record<string, string>; } catch { return {}; } })();
    const restoredWebhookUrl = storedConfig.url ?? storedConfig.webhookUrl ?? '';
    setForm({
      name: auto.name,
      description: auto.description,
      triggerType: auto.triggerType,
      actionType: auto.actionType,
      enabled: auto.enabled,
      intervalMinutes: existingInterval,
      webhookUrl: restoredWebhookUrl,
      actionConfig: storedConfig,
    });
    setEditingId(id);
    setIsAddDialogOpen(true);
  };

  // Validate action-specific required fields
  const getActionValidationError = (): string => {
    if (!form.name.trim()) return 'Name is required';
    const at = form.actionType;
    if ((at === 'telegram-message' || at === 'whatsapp-message' || at === 'manychat-broadcast') && !form.actionConfig.message?.trim()) {
      return 'Message text is required for this action';
    }
    if ((at === 'n8n-webhook' || at === 'call_api') && !form.webhookUrl.trim()) {
      return 'Webhook URL is required for this action';
    }
    if (at === 'create_reminder' && !form.actionConfig.reminder_text?.trim()) {
      return 'Reminder text is required';
    }
    return '';
  };

  const actionValidationError = getActionValidationError();

  const handleSave = async () => {
    const validationErr = getActionValidationError();
    if (validationErr) {
      setSaveError(validationErr);
      return;
    }
    setSaveError('');
    try {
      // 62.6: build triggerConfig for time-based automations
      const triggerConfig = form.triggerType === 'time'
        ? { interval_minutes: form.intervalMinutes }
        : {};
      // B3: build actionConfig — merge form.actionConfig with webhookUrl for url-based actions
      const urlActionTypes = ['n8n-webhook', 'call_api'];
      const builtActionConfig: Record<string, string> = { ...form.actionConfig };
      if (urlActionTypes.includes(form.actionType) && form.webhookUrl) {
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
      setIsAddDialogOpen(false);
      resetForm();
    } catch {
      setSaveError('Failed to save automation. Please try again.');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await updateAutomation(id, { enabled: !enabled });
  };

  const handleDelete = async (id: string) => {
    await deleteAutomation(id);
  };


  // 55.6: Retry a failed dead-letter webhook
  const handleRetryDeadLetter = async (id: string) => {
    setRetryingDeadLetterId(id);
    try {
      await automationService.retryDeadLetter(id);
      // Refresh dead-letter list
      automationService.getDeadLetters().then((r) => setDeadLetters(r.data)).catch(() => {});
    } catch { /* ignore */ } finally {
      setRetryingDeadLetterId(null);
    }
  };

  const handleTestFire = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const auto = automations.find((a) => a.id === id);
    const isUrlAction = auto && (auto.actionType === 'n8n-webhook' || auto.actionType === 'call_api');
    try {
      if (isUrlAction) {
        // URL-based actions: use the /test endpoint (sends real HTTP request)
        const res = await automationService.testFire(id);
        setTestResult({ id, success: res.data.success, message: res.data.message, statusCode: res.data.statusCode, latencyMs: res.data.latencyMs, responseBody: res.data.responseBody });
      } else {
        // Non-URL actions: use dry-run to simulate
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
  const totalRuns = automations.reduce((acc, a) => acc + a.runCount, 0);

  // 50.2: Unified relative-time formatter — consistent casing and language
  const fmtRelativeTime = (ts: string | null | undefined): string => {
    if (!ts) return 'Never';
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatLastRun = fmtRelativeTime;
  const fmtRunTime = fmtRelativeTime;

  // 52.9: Compute "next run" for time-triggered automations
  const fmtNextRun = (auto: typeof automations[number]): string | null => {
    if (auto.triggerType !== 'time' && (auto as unknown as Record<string, unknown>).trigger_type !== 'time') return null;
    try {
      const triggerConfig = JSON.parse(((auto as unknown as Record<string, unknown>).trigger_config as string) || '{}') as { interval_minutes?: number };
      const intervalMs = (triggerConfig.interval_minutes || 60) * 60 * 1000;
      const lastRunTs = auto.last_run ? new Date(auto.last_run).getTime() : null;
      const nextTs = lastRunTs ? lastRunTs + intervalMs : Date.now() + intervalMs;
      const diff = Math.floor((nextTs - Date.now()) / 1000);
      if (diff <= 0) return 'due now';
      if (diff < 60) return `in ${diff}s`;
      if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
      if (diff < 86400) return `in ${Math.floor(diff / 3600)}h`;
      return `in ${Math.floor(diff / 86400)}d`;
    } catch {
      return null;
    }
  };


  // Extract HTTP status code from output string like "HTTP 200 OK" or "HTTP 404 Not Found"
  const parseHttpStatus = (output: string): number | null => {
    const match = output.match(/^HTTP (\d{3})/);
    return match ? parseInt(match[1], 10) : null;
  };

  const getHttpStatusBg = (status: number): string => {
    if (status >= 200 && status < 300) return 'bg-[#00FF88]/10 border-[#00FF88]/20 text-[#00FF88]';
    if (status >= 400) return 'bg-[#FF6161]/10 border-[#FF6161]/20 text-[#FF6161]';
    return 'bg-[#6B7280]/10 border-[#6B7280]/20 text-[#9CA3AF]';
  };

  return (
    <div data-testid="automations-page" className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0">
      {/* 61.8: Dry-run result toast */}
      {dryRunResult && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="dry-run-result">
          <div className="flex items-start gap-2">
            <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-xs mb-0.5">Dry Run Result</p>
              <p className="text-xs text-[#F59E0B]/80">{dryRunResult.simulatedOutput}</p>
            </div>
            <button onClick={() => setDryRunResult(null)} className="text-[#F59E0B]/60 hover:text-[#F59E0B] ml-auto">✕</button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Automations
          </h1>
          <p className="text-sm md:text-base text-[#9CA3AF]">
            <span className="text-[#00F0FF] font-medium">{enabledCount}</span> active of {automations.length} total
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#00F0FF] hover:bg-[#00D4B0] press-scale min-h-[44px]">
          <Plus className="w-4 h-4 mr-2" />New Automation
        </Button>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { label: 'Total', value: automations.length, color: '#00F0FF' },
          { label: 'Active', value: enabledCount, color: '#00FF88' },
          { label: 'Runs', value: totalRuns, color: '#FFB800' },
          ...(automationStats ? [{ label: '7d Runs', value: automationStats.recentRuns, color: '#8B5CF6' }] : []),
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0C0C18]/60 border border-white/5 shrink-0">
            <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs text-[#8892B0]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <Input
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[44px]"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0C0C18] border border-[#00F0FF]/20 overflow-x-auto flex-nowrap w-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#00F0FF] min-h-[44px] flex-none">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#00F0FF] min-h-[44px] flex-none">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="data-[state=active]:bg-[#00F0FF] min-h-[44px] flex-none">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Automation List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((auto) => {
            const TriggerIcon = triggerIcons[auto.triggerType] || Zap;
            const ActionIcon = actionIcons[auto.actionType] || Zap;
            const triggerColor = triggerColors[auto.triggerType];
            return (
              <Card
                key={auto.id}
                className={`bg-[#0C0C18] border-[#00F0FF]/20 transition-all duration-300 hover:border-[#00F0FF]/40 press-scale ${
                  !auto.enabled ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-3 md:p-5">
                  <div className="flex items-start gap-3 md:gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(auto.id, auto.enabled)}
                      aria-label={auto.enabled ? `Disable ${auto.name}` : `Enable ${auto.name}`}
                      className="flex-shrink-0 mt-1 press-scale min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      {auto.enabled ? (
                        <ToggleRight className="w-8 h-5 text-[#00FF88]" />
                      ) : (
                        <ToggleLeft className="w-8 h-5 text-[#9CA3AF]" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{auto.name}</h3>
                        {auto.enabled && (
                          <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm text-[#9CA3AF] mb-1">{auto.description}</p>

                      {(auto.run_count ?? 0) > 0 && (
                        <p className="text-xs text-[#8888AA] mb-2">
                          Ran {auto.run_count} time{auto.run_count !== 1 ? 's' : ''}
                          {' · '}Last run: {fmtRunTime(auto.last_run)}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Trigger badge */}
                        <Badge
                          variant="outline"
                          style={{ borderColor: `${triggerColor}40`, color: triggerColor }}
                        >
                          <TriggerIcon className="w-3 h-3 mr-1" />
                          {triggerLabels[auto.triggerType]}
                        </Badge>

                        {/* Arrow */}
                        <span className="text-[#9CA3AF]">&rarr;</span>

                        {/* Action badge */}
                        <Badge variant="outline" className="border-[#00F0FF]/30 text-[#9CA3AF]">
                          <ActionIcon className="w-3 h-3 mr-1" />
                          {actionLabels[auto.actionType]}
                        </Badge>

                        {/* Run count */}
                        <Badge variant="outline" className="border-[#00F0FF]/20 text-[#9CA3AF]">
                          <Play className="w-3 h-3 mr-1" />
                          {auto.runCount} runs
                        </Badge>

                        {/* 64.2: last_status badge */}
                        {auto.lastStatus && (
                          <Badge
                            variant="outline"
                            className={
                              auto.lastStatus === 'success'
                                ? 'border-[#00FF88]/30 text-[#00FF88]'
                                : 'border-[#FF6161]/30 text-[#FF6161]'
                            }
                          >
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${auto.lastStatus === 'success' ? 'bg-[#00FF88]' : 'bg-[#FF6161]'}`} />
                            {auto.lastStatus === 'success' ? 'ok' : auto.lastStatus}
                          </Badge>
                        )}

                        {/* Last run */}
                        <span className="text-xs text-[#9CA3AF]">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatLastRun(auto.lastRun)}
                        </span>

                        {/* 52.9: Next run for time-triggered automations */}
                        {auto.enabled && (() => {
                          const next = fmtNextRun(auto);
                          return next ? (
                            <span className="text-xs text-[#FFB800]">
                              <CalendarClock className="w-3 h-3 inline mr-1" />
                              Next: {next}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Actions — clean 3-button layout */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Primary: Run */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestFire(auto.id)}
                        disabled={testingId === auto.id}
                        title="Test fire"
                        className="text-[#00F0FF] hover:bg-[#00F0FF]/10 min-h-[44px] min-w-[44px] p-0"
                      >
                        {testingId === auto.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(auto.id)}
                        title="Edit"
                        className="text-[#8892B0] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 min-h-[44px] min-w-[44px] p-0"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(auto.id)}
                        title="Delete"
                        className="text-[#8892B0] hover:text-[#FF2D78] hover:bg-[#FF2D78]/10 min-h-[44px] min-w-[44px] p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Test result toast */}
                    {testResult?.id === auto.id && (
                      <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${testResult.success ? 'bg-[#00FF88]/5 border-[#00FF88]/20 text-[#00FF88]' : 'bg-[#FF2D78]/5 border-[#FF2D78]/20 text-[#FF2D78]'}`}>
                        {testResult.message}
                        {testResult.statusCode ? ` · ${testResult.statusCode}` : ''}
                        {testResult.latencyMs ? ` · ${testResult.latencyMs}ms` : ''}
                      </div>
                    )}
                    {/* 51.5: Trigger error feedback — auto-clears after 4s */}
                    {triggerErrors[auto.id] && (
                      <p className="text-xs text-[#FF6161] mt-2 pl-1">{triggerErrors[auto.id]}</p>
                    )}
                  </div>
                  {/* Run history available in Recent Runs section below */}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-4" />
            <p className="text-[#9CA3AF] mb-4">
              {searchQuery || filter !== 'all' ? 'No automations match your filters' : 'No automations yet'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Button onClick={handleOpenAdd} variant="outline" className="border-[#00F0FF]/30 hover:bg-[#00F0FF]/10">
                Create your first automation
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="glass-card-v2 border border-[#00F0FF]/30 text-[#E8E8F0] max-w-md mx-2 md:mx-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#00F0FF]" />
              {editingId ? 'Edit Automation' : 'New Automation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3 md:pt-4">
            <div>
              <label className="text-sm text-[#9CA3AF] mb-2 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Morning briefing, Deploy webhook..."
                className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
              />
            </div>
            <div>
              <label className="text-sm text-[#9CA3AF] mb-2 block">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this automation do?"
                className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value as AutomationTrigger })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0]"
                >
                  <option value="time">Scheduled (Time)</option>
                  <option value="event">Event-based</option>
                  <option value="webhook">Webhook</option>
                  <option value="manual">Manual</option>
                  <option value="keyword">Keyword Match</option>
                  <option value="health_down">Health Check</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#9CA3AF] mb-2 block">Action</label>
                <select
                  value={form.actionType}
                  onChange={(e) => setForm({ ...form, actionType: e.target.value as AutomationAction })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0]"
                >
                  <option value="telegram-message">Telegram Message</option>
                  <option value="n8n-webhook">n8n Webhook</option>
                  <option value="portfolio-update">Portfolio Update</option>
                  <option value="manychat-broadcast">ManyChat Broadcast</option>
                  <option value="call_api">API Call</option>
                  <option value="create_reminder">Create Reminder</option>
                  <option value="log">Log</option>
                </select>
              </div>
            </div>
            {/* 65.8: Webhook URL input + https warning for n8n-webhook / call_api */}
            {(form.actionType === 'n8n-webhook' || form.actionType === 'call_api') && (
              <div className="space-y-1">
                <label className="text-xs text-[#9CA3AF]">Webhook URL</label>
                <input
                  type="url"
                  placeholder="https://your-webhook-endpoint.com/..."
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0] text-sm"
                />
                {form.webhookUrl && form.webhookUrl.startsWith('http://') && !form.webhookUrl.startsWith('https://') && (
                  <p className="text-xs flex items-center gap-1.5 text-[#F59E0B]">
                    <span>⚠</span> Using http:// sends data unencrypted. Use https:// for production.
                  </p>
                )}
              </div>
            )}
            {/* B3: Action-specific configuration fields */}
            {(form.actionType === 'telegram-message' || form.actionType === 'whatsapp-message' || form.actionType === 'manychat-broadcast') && (
              <div className="space-y-1">
                <label className="text-xs text-[#9CA3AF]">
                  {form.actionType === 'telegram-message' ? 'Telegram Message Text' : form.actionType === 'whatsapp-message' ? 'WhatsApp Message Text' : 'Broadcast Message Text'}
                </label>
                <textarea
                  placeholder={form.actionType === 'manychat-broadcast' ? 'Broadcast message to send...' : 'Message to send...'}
                  value={form.actionConfig.message ?? ''}
                  onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, message: e.target.value } })}
                  rows={3}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0] text-sm resize-none"
                />
              </div>
            )}
            {form.actionType === 'create_reminder' && (
              <div className="space-y-1">
                <label className="text-xs text-[#9CA3AF]">Reminder Text</label>
                <input
                  type="text"
                  placeholder="What to remind about..."
                  value={form.actionConfig.reminder_text ?? ''}
                  onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, reminder_text: e.target.value } })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0] text-sm"
                />
              </div>
            )}
            {form.actionType === 'log' && (
              <div className="space-y-1">
                <label className="text-xs text-[#9CA3AF]">Log Message</label>
                <input
                  type="text"
                  placeholder="Message to log..."
                  value={form.actionConfig.message ?? ''}
                  onChange={(e) => setForm({ ...form, actionConfig: { ...form.actionConfig, message: e.target.value } })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0] text-sm"
                />
              </div>
            )}
            {/* 62.6: Schedule builder — shown when trigger is time-based */}
            {form.triggerType === 'time' && (
              <div className="rounded-lg border border-[#00F0FF]/20 bg-[#06060B] p-3 space-y-3">
                <p className="text-xs text-[#9CA3AF] font-medium">Schedule</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: 'Every 15 min', value: 15 },
                    { label: 'Every 30 min', value: 30 },
                    { label: 'Every hour', value: 60 },
                    { label: 'Every 2h', value: 120 },
                    { label: 'Every 6h', value: 360 },
                    { label: 'Daily', value: 1440 },
                    { label: 'Weekly', value: 10080 },
                  ] as const).map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, intervalMinutes: value })}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        form.intervalMinutes === value
                          ? 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]'
                          : 'bg-[#0C0C18] border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9CA3AF]">Custom:</span>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={form.intervalMinutes}
                    onChange={(e) => setForm({ ...form, intervalMinutes: Math.max(1, parseInt(e.target.value, 10) || 60) })}
                    className="w-20 p-1.5 text-xs rounded-lg bg-[#0C0C18] border border-[#00F0FF]/30 text-[#E8E8F0]"
                  />
                  <span className="text-xs text-[#9CA3AF]">minutes</span>
                </div>
              </div>
            )}
            {/* 54.2: Webhook payload preview — shown when trigger is webhook */}
            {form.triggerType === 'webhook' && (
              <div className="rounded-lg border border-[#00F0FF]/20 bg-[#06060B] p-3">
                <p className="text-xs text-[#9CA3AF] mb-2 font-medium">Incoming Webhook Payload Preview</p>
                <pre className="text-xs text-[#00F0FF] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{`{
  "event": "webhook.trigger",
  "automationId": "<auto-id>",
  "timestamp": "${new Date().toISOString()}",
  "payload": { "key": "value" }
}`}
                </pre>
                <p className="text-xs text-[#9CA3AF] mt-2">POST this JSON to <code className="text-[#FFB800]">/api/webhooks/receive/&lt;auto-id&gt;</code></p>
              </div>
            )}
            {saveError && (
              <p className="text-sm text-[#FF6161] mt-2">{saveError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsAddDialogOpen(false); resetForm(); }}
                className="flex-1 border-[#00F0FF]/30 min-h-[44px] press-scale"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!!actionValidationError}
                className="flex-1 bg-[#00F0FF] hover:bg-[#00D4B0] min-h-[44px] press-scale"
              >
                {editingId ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Runs */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#E8E8F0]" style={{ fontFamily: 'Syne, sans-serif' }}>
            Recent Runs
          </h2>
          {/* 63.4: Status filter */}
          <select
            value={logsStatusFilter}
            onChange={(e) => setLogsStatusFilter(e.target.value as typeof logsStatusFilter)}
            className="text-xs px-2 py-1 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/20 text-[#9CA3AF] focus:outline-none"
            aria-label="Filter logs by status"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="error">Error</option>
          </select>
        </div>
        {logs.length === 0 ? (
          <Card className="border-[#00F0FF]/20">
            <CardContent className="py-10 text-center">
              <Clock className="w-10 h-10 text-[#00F0FF]/20 mx-auto mb-3" />
              <p className="text-[#9CA3AF]">No automation runs yet</p>
              <p className="text-sm text-[#9CA3AF]">Trigger an automation to see its history here</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#00F0FF]/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#00F0FF]/10 bg-[#06060B]">
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium">Output</th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium">Time</th>
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
                      <tr key={log.id} className="border-b border-[#00F0FF]/10 hover:bg-[#00F0FF]/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                            status === 'success'
                              ? 'bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20'
                              : 'bg-[#FF6161]/10 text-[#FF6161] border border-[#FF6161]/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'success' ? 'bg-[#00FF88]' : 'bg-[#FF6161]'}`} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {(() => {
                            const httpCode = parseHttpStatus(output);
                            if (!httpCode) return <span className="text-[#9CA3AF] text-xs">—</span>;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${getHttpStatusBg(httpCode)}`}>
                                {httpCode}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-[#9CA3AF] max-w-[200px] text-xs">
                          {/* 46.5: Pretty-print JSON output if parseable, otherwise truncate */}
                          {output ? (() => {
                            try {
                              const parsed = JSON.parse(output);
                              return (
                                <pre className="text-xs text-[#8888AA] p-2 bg-black/20 rounded overflow-auto max-h-24 whitespace-pre-wrap break-all">
                                  {JSON.stringify(parsed, null, 2)}
                                </pre>
                              );
                            } catch {
                              return <span className="truncate block">{output}</span>;
                            }
                          })() : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#9CA3AF] font-mono text-xs hidden md:table-cell">
                          {durationMs > 0 ? `${durationMs}ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">
                          {createdAt ? new Date(createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* 53.7: Load More button for paginated logs */}
            {logsHasMore && (
              <div className="flex justify-center p-3 border-t border-[#00F0FF]/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMoreLogs}
                  disabled={logsLoadingMore}
                  className="text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10"
                >
                  {logsLoadingMore ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Load More Runs
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* 37.4: Dead-letter panel — only shown when there are failures */}
        {deadLetters.length > 0 && (
          <Card style={{ background: 'rgba(255,97,97,0.04)', border: '1px solid rgba(255,97,97,0.2)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-[#FF6161]" />
                <span className="text-sm font-semibold text-[#FF6161]">Failed Webhook Deliveries</span>
                <Badge style={{ background: 'rgba(255,97,97,0.15)', color: '#FF6161', border: '1px solid rgba(255,97,97,0.3)' }}>{deadLetters.length}</Badge>
              </div>
              <div className="space-y-2">
                {deadLetters.slice(0, 5).map((dl) => {
                  const auto = automations.find((a) => a.id === dl.automation_id);
                  return (
                    <div key={dl.id} className="flex flex-col gap-0.5 bg-[#0C0C18] rounded-lg px-3 py-2 border border-[#FF6161]/10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#E8E8F0] truncate">{auto?.name ?? dl.automation_id.slice(0, 8)}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{new Date(dl.failed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {/* 55.6: Retry button */}
                          <button
                            onClick={() => handleRetryDeadLetter(dl.id)}
                            disabled={retryingDeadLetterId === dl.id}
                            aria-label="Retry failed webhook"
                            className="text-xs px-2 py-0.5 rounded border border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/10 disabled:opacity-50 transition-colors"
                          >
                            {retryingDeadLetterId === dl.id ? '...' : 'Retry'}
                          </button>
                        </div>
                      </div>
                      <span className="text-xs text-[#FF6161] truncate">{dl.last_error ?? dl.error}</span>
                      {dl.retry_count > 0 && (
                        <span className="text-xs text-amber-400">Retried {dl.retry_count}×</span>
                      )}
                      <span className="text-xs text-[#9CA3AF] truncate font-mono">{dl.url}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
