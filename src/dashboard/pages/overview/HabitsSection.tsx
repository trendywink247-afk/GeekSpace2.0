import { ArrowRight, Plus, Target, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/agentin';
import type { OverviewData } from './helpers';

interface HabitsSectionProps {
  overviewData: OverviewData | null;
  overviewLoading: boolean;
  onNavigate?: (page: string) => void;
}

export function HabitsSection({ overviewData, overviewLoading, onNavigate }: HabitsSectionProps) {
  const done = overviewData?.habitsToday.filter((h) => h.loggedToday).length ?? 0;
  const total = overviewData?.habitsToday.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider font-heading">
          Habits Today
        </h2>
        <button
          onClick={() => onNavigate?.('reminders')}
          className="flex items-center gap-1 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] transition-colors"
        >
          Manage
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <SectionCard padding="sm" className="overflow-hidden">
        {overviewLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-3 w-24 mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : overviewData && overviewData.habitsToday.length > 0 ? (
          <>
            {/* Progress bar */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--ag-text-secondary)]">
                  {done}/{total} habits done
                </span>
                <span className="text-xs font-mono text-[var(--ag-jarvis)]">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--ag-bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--ag-jarvis)] to-[var(--ag-cyan)] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="divide-y divide-[var(--ag-border-subtle)]">
              {overviewData.habitsToday.map((habit) => (
                <div key={habit.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: habit.loggedToday ? 'rgba(173,255,47,0.1)' : 'rgba(139,92,246,0.08)' }}
                  >
                    {habit.icon === 'star'
                      ? <Target className="w-4 h-4 text-[var(--ag-violet)]" />
                      : habit.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${habit.loggedToday ? 'text-[var(--ag-jarvis)]' : 'text-[var(--ag-text-primary)]'}`}>
                      {habit.name}
                    </p>
                    <span className="text-xs text-[var(--ag-text-secondary)]">
                      {habit.streak > 0 ? `${habit.streak} day streak` : 'No streak yet'}
                    </span>
                  </div>
                  {habit.loggedToday ? (
                    <div className="w-7 h-7 rounded-full bg-[var(--ag-jarvis)]/15 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-[var(--ag-jarvis)]" />
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate?.('reminders')}
                      className="text-[var(--ag-violet)] hover:bg-[var(--ag-violet)]/10 text-xs px-3 min-h-[44px] rounded-md"
                    >
                      Log
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <Target className="w-6 h-6 text-[var(--ag-text-secondary)]/30 mx-auto mb-1.5" />
            <p className="text-sm text-[var(--ag-text-secondary)]">No habits set up yet</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 bg-gradient-to-r from-[#8B5CF6] to-[#F59E0B] text-white hover:opacity-90 min-h-[44px]"
              onClick={() => onNavigate?.('reminders')}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create a habit
            </Button>
          </div>
        )}
      </SectionCard>
    </section>
  );
}
