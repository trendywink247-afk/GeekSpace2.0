import { ArrowRight, Bell, CheckCircle2, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/agentin';
import type { OverviewData } from './helpers';

interface RemindersSectionProps {
  overviewData: OverviewData | null;
  overviewLoading: boolean;
  completingReminder: string | null;
  onCompleteReminder: (id: string) => void;
  onNavigate?: (page: string) => void;
}

export function RemindersSection({
  overviewData,
  overviewLoading,
  completingReminder,
  onCompleteReminder,
  onNavigate,
}: RemindersSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider font-heading">
          Today&apos;s Reminders
        </h2>
        <button
          onClick={() => onNavigate?.('reminders')}
          className="flex items-center gap-1 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] transition-colors"
        >
          All reminders
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <SectionCard padding="sm" className="overflow-hidden">
        {overviewLoading ? (
          <div className="divide-y divide-[var(--ag-border-subtle)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="w-14 h-7 rounded-md" />
              </div>
            ))}
          </div>
        ) : overviewData && overviewData.remindersDueToday.length > 0 ? (
          <div className="divide-y divide-[var(--ag-border-subtle)]">
            {overviewData.remindersDueToday.map((rem) => (
              <div
                key={rem.id}
                className={`p-4 flex items-center gap-3 ${rem.overdue ? 'bg-[var(--ag-pink)]/[0.04]' : ''}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: rem.overdue ? 'rgba(255,45,120,0.12)' : 'rgba(139,92,246,0.08)' }}
                >
                  <Bell
                    className="w-4 h-4"
                    style={{ color: rem.overdue ? 'var(--ag-pink)' : 'var(--ag-cyan)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--ag-text-primary)] truncate">{rem.text}</p>
                  <span
                    className={`text-xs ${rem.overdue ? 'text-[var(--ag-pink)]' : 'text-[var(--ag-text-secondary)]'}`}
                  >
                    {rem.overdue ? 'Overdue - ' : ''}
                    {new Date(rem.datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={completingReminder === rem.id}
                  onClick={() => onCompleteReminder(rem.id)}
                  className="text-[var(--ag-jarvis)] hover:bg-[var(--ag-jarvis)]/10 text-xs px-3 min-h-[44px] rounded-md"
                >
                  {completingReminder === rem.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Done
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-6 h-6 text-[var(--ag-jarvis)]/40 mx-auto mb-1.5" />
            <p className="text-sm text-[var(--ag-jarvis)]">No reminders for today</p>
          </div>
        )}
      </SectionCard>
    </section>
  );
}
