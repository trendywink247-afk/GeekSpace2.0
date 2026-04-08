import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardPageWrapper, PageShell } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { StatCard } from '@/components/ui/agentin';
import { CalendarDays, Clock, PercentSquare } from 'lucide-react';
import api from '@/services/api';
import { useDashboardStore } from '@/stores/dashboard-store';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { usePlannerStore } from './state/planner-store';
import { usePlannerBlocks } from './hooks/usePlannerBlocks';
import { usePlannerView } from './hooks/usePlannerView';
import { PlannerHeader } from './components/PlannerHeader';
import { DayPlanner } from './components/DayPlanner';
import { WeekOverview } from './components/WeekOverview';
import { formatHour } from './helpers';
import type { BacklogItem, HabitItem } from './helpers';
export function PlannerPage() {
  const { currentDate, viewMode, setCurrentDate, goToday, goPrev, goNext, setViewMode, dragItemId, setDragItemId, quickAddHour, quickAddTitle, quickAddDuration, setQuickAddHour, setQuickAddTitle, setQuickAddDuration, resetQuickAdd } = usePlannerStore();
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragItemRef = useRef<BacklogItem | null>(null);
  const { reminders, loadReminders } = useDashboardStore();
  const weekDates = useMemo(() => { const start = new Date(currentDate); start.setDate(start.getDate() - start.getDay()); return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; }); }, [currentDate]);
  const { blocks, todayBlocks, removeBlock, scheduleBacklogItem, addCustomBlock } = usePlannerBlocks({ currentDate, weekDates, viewMode });
  const { isToday, currentHourFraction, backlogItems, stats, topThree } = usePlannerView({ currentDate, todayBlocks, habits, reminders });
  useEffect(() => { loadReminders(); }, [loadReminders]);
  useEffect(() => { let alive = true; api.get('/habits').then(res => { if (alive) setHabits((res.data as { habits: HabitItem[] }).habits || []); }).catch(() => { if (alive) setHabits([]); }).finally(() => { if (alive) setHabitsLoading(false); }); return () => { alive = false; }; }, []);
  const handleDragStart = useCallback((item: BacklogItem) => { dragItemRef.current = item; setDragItemId(item.id); }, [setDragItemId]);
  const handleDragOver = useCallback((e: React.DragEvent, hour: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(hour); }, []);
  const handleDragLeave = useCallback(() => setDropTarget(null), []);
  const handleDrop = useCallback((e: React.DragEvent, hour: number) => { e.preventDefault(); setDropTarget(null); const item = dragItemRef.current; if (!item) return; const block = scheduleBacklogItem(item, hour); dragItemRef.current = null; setDragItemId(null); toast.success(`Scheduled "${block.title}" at ${formatHour(hour)}`); }, [scheduleBacklogItem, setDragItemId]);
  const handleWeekDrop = useCallback((e: React.DragEvent, hour: number, date: Date) => { e.preventDefault(); const item = dragItemRef.current; if (!item) return; const block = scheduleBacklogItem(item, hour, date); dragItemRef.current = null; setDragItemId(null); toast.success(`Scheduled "${block.title}" at ${formatHour(hour)} on ${DateTime.fromJSDate(date).toLocaleString({ weekday: 'short' })}`); }, [scheduleBacklogItem, setDragItemId]);
  const handleQuickAdd = useCallback(() => { if (!quickAddTitle.trim() || quickAddHour === null) return; const block = addCustomBlock(quickAddTitle.trim(), quickAddHour, quickAddDuration); toast.success(`Added "${block.title}" at ${formatHour(quickAddHour)}`); resetQuickAdd(); }, [quickAddTitle, quickAddHour, quickAddDuration, addCustomBlock, resetQuickAdd]);
<<<<<<< HEAD
  const dragItem = dragItemId ? dragItemRef.current : null;
=======
  const dragItem = dragItemId ? (backlogItems.find((item) => item.id === dragItemId) ?? null) : null;
>>>>>>> origin/ui/wave1-reminders
  return (
    <DashboardPageWrapper>
      <PageShell spacing={4}>
        <PlannerHeader viewMode={viewMode} onViewChange={setViewMode} />
        <div className="space-y-5">
          <BlurFade delay={0.1}>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Planned" value={stats.planned} icon={CalendarDays} accent="violet" />
              <StatCard label="Hours" value={`${stats.hoursBlocked}h`} icon={Clock} accent="indigo" />
              <StatCard label="Day filled" value={`${stats.pct}%`} icon={PercentSquare} accent={stats.pct >= 70 ? 'emerald' : stats.pct >= 40 ? 'amber' : 'coral'} />
            </div>
          </BlurFade>
          {viewMode === 'week' ? (
<<<<<<< HEAD
            <WeekOverview currentDate={currentDate} weekDates={weekDates} currentHourFraction={currentHourFraction} blocks={blocks} onSelectDate={(d: any) => { setCurrentDate(d); setViewMode('day'); }} onGoToday={goToday} onGoPrev={goPrev} onGoNext={goNext} onWeekDrop={handleWeekDrop} />
=======
            <WeekOverview currentDate={currentDate} weekDates={weekDates} currentHourFraction={currentHourFraction} blocks={blocks} onSelectDate={(d) => { setCurrentDate(d); setViewMode('day'); }} onGoToday={goToday} onGoPrev={goPrev} onGoNext={goNext} onWeekDrop={handleWeekDrop} />
>>>>>>> origin/ui/wave1-reminders
          ) : (
            <DayPlanner currentDate={currentDate} isToday={isToday} currentHourFraction={currentHourFraction} todayBlocks={todayBlocks} backlogItems={backlogItems} topThree={topThree} habitsLoading={habitsLoading} dragItem={dragItem} dropTarget={dropTarget} quickAddHour={quickAddHour} quickAddTitle={quickAddTitle} quickAddDuration={quickAddDuration} onGoPrev={goPrev} onGoNext={goNext} onGoToday={goToday} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onRemoveBlock={removeBlock} onQuickAddHourSet={setQuickAddHour} onQuickAddTitleChange={setQuickAddTitle} onQuickAddDurationChange={setQuickAddDuration} onQuickAddSubmit={handleQuickAdd} onQuickAddCancel={resetQuickAdd} />
          )}
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
