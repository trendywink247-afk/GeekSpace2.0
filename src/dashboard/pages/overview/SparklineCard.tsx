import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscoverCard } from '@/components/DiscoverCard';
import { ActivitySparkline } from './ActivitySparkline';

interface SparklineCardProps {
  loading: boolean;
  activityData: number[];
  dayLabels: string[];
  /** Total reminders count — used for completion badge */
  totalReminders: number;
  completedReminders: number;
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

export function SparklineCard({
  loading,
  activityData,
  dayLabels,
  totalReminders,
  completedReminders,
  onNavigate,
  onOpenChat,
}: SparklineCardProps) {
  const weeklyTotal = activityData.reduce((a, b) => a + b, 0);
  const today = activityData.length > 0 ? activityData[activityData.length - 1] : 0;

  return (
    <section className="lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider font-heading">
          7-day activity
        </h2>
        <button
          onClick={() => onNavigate?.('activity')}
          className="flex items-center gap-1 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] transition-colors"
        >
          Details <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <Card className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <div className="flex justify-between">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-6" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <ActivitySparkline data={activityData} labels={dayLabels} color="#A78BFA" />
              {dayLabels.length > 0 && (
                <div className="flex justify-between mt-2 px-1">
                  {dayLabels.map((label, i) => (
                    <span key={i} className="text-xs text-[var(--ag-text-secondary)] font-mono">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[var(--ag-border-subtle)]">
                <div>
                  <div className="text-xs text-[var(--ag-text-secondary)]">Total this week</div>
                  <div className="text-lg font-bold text-[var(--ag-cyan)] font-mono">{weeklyTotal}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--ag-text-secondary)]">Today</div>
                  <div className="text-lg font-bold text-[var(--ag-jarvis)] font-mono">{today}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!loading && totalReminders > 0 && (
        <div className="mt-3 rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--ag-jarvis)]/10 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-[var(--ag-jarvis)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--ag-text-primary)]">
              {completedReminders} of {totalReminders} tasks done
            </div>
            <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
              {completedReminders === totalReminders
                ? 'All caught up!'
                : `${totalReminders - completedReminders} remaining`}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3">
        <DiscoverCard
          onNavigate={(path) => onNavigate?.(path)}
          onOpenChat={() => onOpenChat?.()}
        />
      </div>
    </section>
  );
}
