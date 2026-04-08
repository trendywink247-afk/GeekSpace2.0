import { useState, useEffect, useCallback } from 'react';
import { PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  Zap,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Timer,
  BarChart3,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboard-store';
import { automationLogService, automationService } from '@/services/api';
import { confirmAction } from '@/utils/alerts';
import type { AutomationLog } from '@/types';
import {
  TEMPLATES,
  DEFAULT_FORM,
  resolveActionConfig,
  tryParseJSON,
} from './helpers';
import type { FormState, TestResult, TemplateItem } from './helpers';
import { AutomationList } from './AutomationList';
import { CreateEditDialog } from './CreateEditDialog';
import { RecentRunsSection } from './RecentRunsSection';

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
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
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
  const [testResult, setTestResult] = useState<TestResult | null>(null);
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
  // Run history
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
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setSaveError('');
  };

  const handleOpenAdd = () => { resetForm(); setIsDialogOpen(true); };

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

  const handleSave = async () => {
    const err = getValidationError();
    if (err) { setSaveError(err); return; }
    setSaveError('');
    const action = editingId ? 'update-automation' : 'create-automation';
    await notifyStart(action);
    try {
      let triggerConfig: Record<string, unknown> = {};
      if (form.triggerType === 'time') triggerConfig = { interval_minutes: form.intervalMinutes };
      else if (form.triggerType === 'keyword') triggerConfig = { keyword: form.keywordValue };
      else if (form.triggerType === 'health_down') triggerConfig = { target_url: form.healthUrl };

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
      automationService.getStats().then((r) => setAutomationStats(r.data)).catch(() => {});
    } catch {
      setSaveError('Failed to save automation. Please try again.');
      await notifyFail(`Failed to ${editingId ? 'update' : 'create'} automation`);
    }
  };

  // ---------------------------------------------------------------------------
  // Card actions
  // ---------------------------------------------------------------------------

  const handleToggle = async (id: string, enabled: boolean) => {
    const auto = automations.find((a) => a.id === id);
    await notifyStart(enabled ? 'disable-automation' : 'enable-automation');
    try {
      await updateAutomation(id, { enabled: !enabled });
      await notifyDone(`${enabled ? 'Disabled' : 'Enabled'} automation: ${auto?.name ?? id}`);
    } catch {
      await notifyFail('Failed to toggle automation');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirmAction('Delete Automation?', `"${name}" will be permanently removed. This cannot be undone.`);
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
          <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 max-w-sm px-4 py-3 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start gap-2">
              <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-xs mb-0.5">Dry Run Result</p>
                <p className="text-xs text-[#F59E0B]/80">{dryRunResult.simulatedOutput}</p>
              </div>
              <button
                onClick={() => setDryRunResult(null)}
                className="text-[#F59E0B]/60 hover:text-[#F59E0B] ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
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

        {/* Stat pills */}
        <BlurFade delay={0.2} inView>
          <SectionCard padding="sm" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { label: 'Total', value: automationStats?.total ?? automations.length, icon: BarChart3, color: 'var(--ag-accent)' },
                { label: 'Active', value: automationStats?.enabled ?? enabledCount, icon: CheckCircle2, color: 'var(--ag-success)' },
                { label: 'Runs (7d)', value: automationStats?.recentRuns ?? 0, icon: Timer, color: 'var(--ag-violet)' },
              ].map((s) => (
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

        {/* Template gallery */}
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

        {/* Automation list (filters + cards) */}
        <AutomationList
          filtered={filtered}
          searchQuery={searchQuery}
          filter={filter}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilter}
          expandedRunHistory={expandedRunHistory}
          runHistoryLogs={runHistoryLogs}
          runHistoryLoading={runHistoryLoading}
          testResult={testResult}
          testingId={testingId}
          runningId={runningId}
          duplicatingId={duplicatingId}
          onToggle={handleToggle}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          onRun={handleRun}
          onTestFire={handleTestFire}
          onDuplicate={handleDuplicate}
          onToggleRunHistory={toggleRunHistory}
          onOpenAdd={handleOpenAdd}
        />

        {/* Create / Edit dialog */}
        <CreateEditDialog
          open={isDialogOpen}
          onClose={() => { setIsDialogOpen(false); resetForm(); }}
          editingId={editingId}
          form={form}
          onFormChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
          onSave={handleSave}
          onDryRun={handleDryRun}
          saveError={saveError}
          validationError={getValidationError()}
        />

        {/* Recent Runs + Dead Letters */}
        <RecentRunsSection
          logs={logs}
          logsStatusFilter={logsStatusFilter}
          logsHasMore={logsHasMore}
          logsLoadingMore={logsLoadingMore}
          deadLetters={deadLetters}
          retryingDeadLetterId={retryingDeadLetterId}
          automations={automations}
          onStatusFilterChange={setLogsStatusFilter}
          onLoadMore={handleLoadMoreLogs}
          onRetryDeadLetter={handleRetryDeadLetter}
        />
      </div>
    </DashboardPageWrapper>
  );
}
