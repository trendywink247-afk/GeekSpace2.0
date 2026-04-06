import { Clock, Bell, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import type { Automation, AutomationLog } from '@/types';
import { fmtRelativeTime, parseHttpStatus, getHttpStatusBg } from './helpers';

interface DeadLetter {
  id: string;
  automation_id: string;
  url: string;
  error: string;
  payload: string | null;
  failed_at: number;
  retry_count: number;
  last_error: string | null;
}

interface RecentRunsSectionProps {
  logs: AutomationLog[];
  logsStatusFilter: '' | 'success' | 'failed' | 'error';
  logsHasMore: boolean;
  logsLoadingMore: boolean;
  deadLetters: DeadLetter[];
  retryingDeadLetterId: string | null;
  automations: Automation[];
  onStatusFilterChange: (v: '' | 'success' | 'failed' | 'error') => void;
  onLoadMore: () => void;
  onRetryDeadLetter: (id: string) => void;
}

export function RecentRunsSection({
  logs,
  logsStatusFilter,
  logsHasMore,
  logsLoadingMore,
  deadLetters,
  retryingDeadLetterId,
  automations,
  onStatusFilterChange,
  onLoadMore,
  onRetryDeadLetter,
}: RecentRunsSectionProps) {
  return (
    <BlurFade delay={0.8} inView>
      <SectionCard title="Recent Runs" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
        <div className="flex items-center justify-end mb-3">
          <select
            value={logsStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as typeof logsStatusFilter)}
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
                  <tr className="border-b border-[var(--ag-border-subtle)]/50">
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
                                <pre className="text-xs text-[var(--ag-text-secondary)] p-2 rounded-lg overflow-auto max-h-24 whitespace-pre-wrap break-all">
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
                  onClick={onLoadMore}
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
              <Badge className="bg-[var(--ag-danger)]/10 text-[var(--ag-danger)] border border-[var(--ag-danger)]/20">
                {deadLetters.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {deadLetters.slice(0, 5).map((dl) => {
                const auto = automations.find((a) => a.id === dl.automation_id);
                return (
                  <div key={dl.id} className="flex flex-col gap-1 bg-[var(--ag-bg-surface)] rounded-xl px-4 py-3 border border-[var(--ag-danger)]/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--ag-text-primary)] truncate">
                        {auto?.name ?? dl.automation_id.slice(0, 8)}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-[var(--ag-text-secondary)] whitespace-nowrap">
                          {fmtRelativeTime(new Date(dl.failed_at).toISOString())}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRetryDeadLetter(dl.id)}
                          disabled={retryingDeadLetterId === dl.id}
                          className="text-xs text-[var(--ag-accent)] hover:bg-[var(--ag-accent)]/10 min-h-[44px] min-w-[44px] px-3 transition-[transform,background-color] duration-150 active:scale-[0.96]"
                        >
                          {retryingDeadLetterId === dl.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><RefreshCw className="w-3 h-3 mr-1" />Retry</>}
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
  );
}
