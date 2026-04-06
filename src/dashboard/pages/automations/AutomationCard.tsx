import {
  Play,
  Trash2,
  Clock,
  Edit3,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Pause,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BlurFade } from '@/components/magicui/blur-fade';
import type { Automation, AutomationLog } from '@/types';
import {
  TRIGGER_META,
  TRIGGER_BORDER_COLORS,
  getTriggerSummary,
  getActionSummary,
  getStatusBadge,
  fmtRelativeTime,
} from './helpers';
import type { TestResult } from './helpers';

interface AutomationCardProps {
  auto: Automation;
  index: number;
  isExpanded: boolean;
  runHistoryLogs: AutomationLog[];
  runHistoryLoading: boolean;
  testResult: TestResult | null;
  testingId: string | null;
  runningId: string | null;
  duplicatingId: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onRun: (id: string) => void;
  onTestFire: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleRunHistory: (id: string) => void;
}

export function AutomationCard({
  auto,
  index,
  isExpanded,
  runHistoryLogs,
  runHistoryLoading,
  testResult,
  testingId,
  runningId,
  duplicatingId,
  onToggle,
  onEdit,
  onDelete,
  onRun,
  onTestFire,
  onDuplicate,
  onToggleRunHistory,
}: AutomationCardProps) {
  const statusBadge = getStatusBadge(auto);
  const TriggerIcon = TRIGGER_META[auto.triggerType]?.icon;
  const triggerColor = TRIGGER_META[auto.triggerType]?.color || '#6B7280';
  const runCount = auto.run_count ?? auto.runCount ?? 0;
  const lastRun = auto.last_run ?? auto.lastRun ?? null;
  const leftBorder = TRIGGER_BORDER_COLORS[auto.triggerType] ?? '#6B7280';

  return (
    <BlurFade key={auto.id} delay={0.6 + index * 0.1} inView>
      <div
        className={`relative overflow-hidden rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-violet)]/30 transition-[box-shadow,border-color,opacity] duration-200 p-4 md:p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_16px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_24px_rgba(0,0,0,0.45)] ${!auto.enabled ? 'opacity-60' : ''}`}
        style={{ borderLeftWidth: '3px', borderLeftColor: leftBorder }}
      >
        {/* Main card row */}
        <div className="flex items-start gap-3 md:gap-4">
          {/* Toggle */}
          <button
            onClick={() => onToggle(auto.id, auto.enabled)}
            aria-label={auto.enabled ? `Disable ${auto.name}` : `Enable ${auto.name}`}
            className="flex-shrink-0 mt-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors hover:bg-white/5"
          >
            <div
              className={`w-10 h-6 rounded-full flex items-center transition-colors duration-200 ${
                auto.enabled ? 'bg-[#ADFF2F]/20 justify-end' : 'bg-white/10 justify-start'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full mx-0.5 transition-colors duration-200 ${
                  auto.enabled ? 'bg-[#ADFF2F]' : 'bg-[#6B7280]'
                }`}
              />
            </div>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] text-base">
                {auto.name}
              </h3>
              <Badge
                className="text-[10px] font-medium border px-2 py-0.5"
                style={{
                  background: statusBadge.bg,
                  color: statusBadge.color,
                  borderColor: `${statusBadge.color}30`,
                }}
              >
                {statusBadge.label === 'Active' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-success)] inline-block mr-1.5 animate-pulse" />
                )}
                {statusBadge.label === 'Error' && <XCircle className="w-3 h-3 mr-1 inline" />}
                {statusBadge.label === 'Paused' && <Pause className="w-3 h-3 mr-1 inline" />}
                {statusBadge.label}
              </Badge>
            </div>

            {/* When / Do summary */}
            <div className="flex items-center gap-2 text-sm text-[var(--ag-text-muted)] mb-1.5">
              {TriggerIcon && (
                <TriggerIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: triggerColor }} />
              )}
              <span>{getTriggerSummary(auto)}</span>
              <ArrowRight className="w-3 h-3 text-[var(--ag-text-secondary)] flex-shrink-0" />
              <span>{getActionSummary(auto)}</span>
            </div>

            {/* Run stats */}
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
                <span
                  className={`flex items-center gap-1 ${
                    auto.lastStatus === 'success' ? 'text-[#00FF88]' : 'text-[#FF6161]'
                  }`}
                >
                  {auto.lastStatus === 'success' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {auto.lastStatus === 'success' ? 'ok' : auto.lastStatus}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRun(auto.id)}
              disabled={runningId === auto.id}
              title="Run now"
              className="text-[var(--ag-accent)] hover:bg-[var(--ag-accent)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,background-color] duration-150 active:scale-[0.96]"
            >
              {runningId === auto.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTestFire(auto.id)}
              disabled={testingId === auto.id}
              title="Test fire (dry run)"
              className="text-[var(--ag-warning)] hover:bg-[var(--ag-warning)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,background-color] duration-150 active:scale-[0.96]"
            >
              {testingId === auto.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(auto.id)}
              title="Edit"
              className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,color,background-color] duration-150 active:scale-[0.96]"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(auto.id)}
              disabled={duplicatingId === auto.id}
              title="Duplicate"
              className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,color,background-color] duration-150 active:scale-[0.96]"
            >
              {duplicatingId === auto.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(auto.id, auto.name)}
              title="Delete"
              className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-danger)] hover:bg-[var(--ag-danger)]/10 min-h-[44px] min-w-[44px] p-0 transition-[transform,color,background-color] duration-150 active:scale-[0.96]"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Inline test result */}
        {testResult?.id === auto.id && (
          <div
            className={`mt-3 rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2 ${
              testResult.success
                ? 'bg-[var(--ag-success)]/5 border-[var(--ag-success)]/20 text-[var(--ag-success)]'
                : 'bg-[var(--ag-danger)]/5 border-[var(--ag-danger)]/20 text-[var(--ag-danger)]'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="flex-1">{testResult.message}</span>
            {testResult.statusCode ? <span className="font-mono">{testResult.statusCode}</span> : null}
            {testResult.latencyMs ? <span className="font-mono">{testResult.latencyMs}ms</span> : null}
          </div>
        )}

        {/* Run history toggle */}
        <div className="mt-3 pt-3 border-t border-[var(--ag-border-subtle)]">
          <button
            type="button"
            onClick={() => onToggleRunHistory(auto.id)}
            className="flex items-center gap-2 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-accent)] transition-colors min-h-[44px]"
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
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
                    <div
                      key={log.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.03]"
                    >
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
                      <span className="text-xs text-[var(--ag-text-secondary)] truncate flex-1">
                        {output || '--'}
                      </span>
                      {durationMs > 0 && (
                        <span className="text-[10px] text-[var(--ag-text-secondary)] font-mono flex-shrink-0">
                          {durationMs}ms
                        </span>
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
}
