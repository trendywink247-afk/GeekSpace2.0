import { MessageSquare, CheckCircle2, Target } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import type { OverviewWeeklyStats } from './helpers';

interface WeeklyStatsProps {
  stats: OverviewWeeklyStats;
}

export function WeeklyStats({ stats }: WeeklyStatsProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-3 font-heading">
        This Week
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <SectionCard className="text-center" padding="sm">
          <MessageSquare className="w-5 h-5 text-[var(--ag-cyan)] mx-auto mb-1.5" />
          <div className="text-xl font-bold text-[var(--ag-cyan)] font-mono">
            {stats.messagesThisWeek}
          </div>
          <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">Messages</div>
        </SectionCard>
        <SectionCard className="text-center" padding="sm">
          <CheckCircle2 className="w-5 h-5 text-[var(--ag-jarvis)] mx-auto mb-1.5" />
          <div className="text-xl font-bold text-[var(--ag-jarvis)] font-mono">
            {stats.remindersCompleted}
          </div>
          <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">Reminders Done</div>
        </SectionCard>
        <SectionCard className="text-center" padding="sm">
          <Target className="w-5 h-5 text-[var(--ag-violet)] mx-auto mb-1.5" />
          <div className="text-xl font-bold text-[var(--ag-violet)] font-mono">
            {stats.habitsLogged}
          </div>
          <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">Habits Logged</div>
        </SectionCard>
      </div>
    </section>
  );
}
