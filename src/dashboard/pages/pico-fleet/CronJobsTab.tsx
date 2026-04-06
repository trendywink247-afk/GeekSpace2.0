// CronJobsTab.tsx — Cron Jobs tab with self-contained form state
import { useState } from 'react';
import type { PicoAgentFull, PicoCronJob } from '@/services/api';
import { picoService } from '@/services/api';
import { TASK_TYPES, INTERVAL_OPTIONS, formatTime } from './helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, AlertCircle, Timer, Edit3, Trash2, Check } from 'lucide-react';

interface CronJobsTabProps {
  cronJobs: PicoCronJob[];
  agents: PicoAgentFull[];
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onRefresh: () => Promise<void>;
}

export function CronJobsTab({ cronJobs, agents, onShowToast, onRefresh }: CronJobsTabProps) {
  const [showCronForm, setShowCronForm] = useState(false);
  const [editingCronId, setEditingCronId] = useState<string | null>(null);
  const [cronName, setCronName] = useState('');
  const [cronTaskType, setCronTaskType] = useState('create_reminder');
  const [cronInterval, setCronInterval] = useState(60);
  const [cronAgentSlot, setCronAgentSlot] = useState(2);
  const [cronConfig, setCronConfig] = useState('{}');
  const [cronConfigError, setCronConfigError] = useState<string | null>(null);
  const [savingCron, setSavingCron] = useState(false);

  const resetForm = () => {
    setCronName('');
    setCronTaskType('create_reminder');
    setCronInterval(60);
    setCronAgentSlot(2);
    setCronConfig('{}');
    setCronConfigError(null);
    setEditingCronId(null);
    setShowCronForm(false);
  };

  const handleEditCron = (job: PicoCronJob) => {
    setEditingCronId(job.id);
    setCronName(job.name);
    setCronTaskType(job.task_type);
    setCronInterval(job.interval_minutes);
    setCronAgentSlot(job.agent_slot);
    setCronConfig(job.task_config || '{}');
    setShowCronForm(true);
  };

  const handleToggleCron = async (job: PicoCronJob) => {
    try {
      await picoService.updateCronJob(job.id, { enabled: !job.enabled });
      onShowToast(`Cron job ${job.enabled ? 'disabled' : 'enabled'}`, 'success');
      await onRefresh();
    } catch {
      onShowToast('Failed to toggle cron job', 'error');
    }
  };

  const handleDeleteCron = async (jobId: string) => {
    try {
      await picoService.deleteCronJob(jobId);
      onShowToast('Cron job deleted', 'success');
      await onRefresh();
    } catch {
      onShowToast('Failed to delete cron job', 'error');
    }
  };

  const handleSaveCronJob = async () => {
    if (!cronName.trim()) return;
    let parsedConfig: Record<string, unknown> = {};
    if (cronConfig.trim()) {
      try {
        parsedConfig = JSON.parse(cronConfig);
        setCronConfigError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message.replace('JSON.parse: ', '').slice(0, 60) : 'Invalid JSON';
        setCronConfigError(msg);
        return;
      }
    }
    setSavingCron(true);
    try {
      if (editingCronId) {
        await picoService.updateCronJob(editingCronId, {
          name: cronName,
          task_type: cronTaskType,
          task_config: parsedConfig,
          interval_minutes: cronInterval,
          agent_slot: cronAgentSlot,
        });
        onShowToast('Cron job updated', 'success');
      } else {
        await picoService.createCronJob({
          name: cronName,
          task_type: cronTaskType,
          task_config: parsedConfig,
          interval_minutes: cronInterval,
          agent_slot: cronAgentSlot,
        });
        onShowToast('Cron job created', 'success');
      }
      resetForm();
      await onRefresh();
    } catch {
      onShowToast('Failed to save cron job', 'error');
    } finally {
      setSavingCron(false);
    }
  };

  const handleConfigChange = (val: string) => {
    setCronConfig(val);
    if (!val.trim()) { setCronConfigError(null); return; }
    try {
      JSON.parse(val);
      setCronConfigError(null);
    } catch (err) {
      setCronConfigError(err instanceof Error ? err.message.replace('JSON.parse: ', '').slice(0, 60) : 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create / Edit form */}
      {showCronForm ? (
        <Card className="border-[rgba(139,92,246,0.15)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-[var(--ag-text-primary)]">
              {editingCronId ? 'Edit Cron Job' : 'New Cron Job'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div>
              <label className="text-sm text-[var(--ag-text-muted)] block mb-1">Name</label>
              <Input
                value={cronName}
                onChange={e => setCronName(e.target.value)}
                placeholder="e.g., Daily standup reminder"
                className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[var(--ag-text-muted)] block mb-1">Task Type</label>
                <Select value={cronTaskType} onValueChange={setCronTaskType}>
                  <SelectTrigger className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.08)]">
                    {TASK_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-[var(--ag-text-primary)]">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted)] block mb-1">Interval</label>
                <Select value={String(cronInterval)} onValueChange={v => setCronInterval(Number(v))}>
                  <SelectTrigger className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.08)]">
                    {INTERVAL_OPTIONS.map(i => (
                      <SelectItem key={i.value} value={String(i.value)} className="text-[var(--ag-text-primary)]">
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-[var(--ag-text-muted)] block mb-1">Agent Slot</label>
                <Select value={String(cronAgentSlot)} onValueChange={v => setCronAgentSlot(Number(v))}>
                  <SelectTrigger className="bg-[var(--ag-bg-deep)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--ag-bg-surface)] border-[rgba(139,92,246,0.08)]">
                    {[2, 3, 4, 5, 6].map(s => {
                      const a = agents.find(ag => ag.slot === s);
                      return (
                        <SelectItem key={s} value={String(s)} className="text-[var(--ag-text-primary)]">
                          Slot {s}{a ? ` — ${a.name}` : ' (empty)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-[var(--ag-text-muted)]">Config (JSON)</label>
                {cronConfigError ? (
                  <span className="text-xs text-[#FF6161] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {cronConfigError}
                  </span>
                ) : (
                  cronConfig.trim() && (
                    <span className="text-xs text-[#00FF88] flex items-center gap-1">
                      <Check className="w-3 h-3 shrink-0" />
                      Valid JSON
                    </span>
                  )
                )}
              </div>
              <Textarea
                value={cronConfig}
                onChange={e => handleConfigChange(e.target.value)}
                className={[
                  'bg-[var(--ag-bg-deep)] text-[var(--ag-text-primary)] font-mono text-xs min-h-[80px] resize-none transition-colors',
                  cronConfigError
                    ? 'border-[#FF6161]/60 focus-visible:border-[#FF6161] focus-visible:ring-[#FF6161]/20'
                    : 'border-[rgba(139,92,246,0.15)]',
                ].join(' ')}
                placeholder='{"reminder_text": "Check server health"}'
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={resetForm}
                className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-muted)]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCronJob}
                disabled={!cronName.trim() || savingCron || !!cronConfigError}
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]"
                title={cronConfigError ? 'Fix JSON config before saving' : undefined}
              >
                {savingCron ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCronId ? 'Update' : 'Create')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowCronForm(true)}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white min-h-[44px]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Cron Job
        </Button>
      )}

      {/* Cron Jobs List */}
      {cronJobs.length === 0 && !showCronForm ? (
        <div className="text-center py-16">
          <Timer className="w-12 h-12 text-[var(--ag-violet)]/30 mx-auto mb-3" />
          <p className="text-[var(--ag-text-muted)] mb-2">No cron jobs yet.</p>
          <p className="text-xs text-[var(--ag-text-muted)]">Create recurring tasks that run on a schedule.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cronJobs.map(job => {
            const intervalLabel = INTERVAL_OPTIONS.find(i => i.value === job.interval_minutes)?.label || `${job.interval_minutes}m`;
            const typeLabel = TASK_TYPES.find(t => t.value === job.task_type)?.label || job.task_type;
            const slotAgent = agents.find(a => a.slot === job.agent_slot);
            return (
              <Card key={job.id} className={`border-[rgba(139,92,246,0.08)] ${!job.enabled ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[var(--ag-text-primary)] truncate">{job.name}</span>
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0"
                          style={{ borderColor: 'rgba(139,92,246,0.15)', color: 'var(--ag-violet)' }}
                        >
                          {typeLabel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ag-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          Every {intervalLabel}
                        </span>
                        <span>Slot {job.agent_slot}{slotAgent ? ` (${slotAgent.name})` : ''}</span>
                        <span>{job.run_count} runs</span>
                        {job.last_run_at && <span>Last: {formatTime(job.last_run_at)}</span>}
                        {job.next_run_at && (
                          <span className="text-[var(--ag-violet)]">Next: {formatTime(job.next_run_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={!!job.enabled}
                        onCheckedChange={() => handleToggleCron(job)}
                        className="data-[state=checked]:bg-[#00FF88] data-[state=unchecked]:bg-[#FF6161]/40"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCron(job)}
                        aria-label={`Edit cron job ${job.name}`}
                        className="text-[var(--ag-text-muted)] hover:text-[var(--ag-violet)] hover:bg-[#8B5CF6]/10 min-h-[44px] min-w-[44px] p-0"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCron(job.id)}
                        aria-label={`Delete cron job ${job.name}`}
                        className="text-[var(--ag-text-muted)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 min-h-[44px] min-w-[44px] p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
