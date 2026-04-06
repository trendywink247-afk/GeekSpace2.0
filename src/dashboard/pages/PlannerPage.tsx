// ============================================================
// PlannerPage — state, data fetching, and event orchestration
// Visual rendering delegated to planner/PlanView
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import {
  Clock, Calendar as CalendarIcon, CalendarCheck, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { plannerService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboard-store';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import type { Reminder } from '@/types';

import {
  PlanView,
  TYPE_COLORS, LS_KEY, generateId, dateKey, isSameDay,
  apiBlockToLocal, localBlockToApi, formatHour,
} from './planner';
import type { TimeBlock, HabitItem, BacklogItem } from './planner';

// ── PlannerPage ────────────────────────────────────────────────────────────

export function PlannerPage() {
  const navigate = useNavigate();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'jarvis', page: 'planner' });

  // ── State ────────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [blocks, setBlocks] = useState<Record<string, TimeBlock[]>>({});
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [dragItem, setDragItem] = useState<BacklogItem | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [quickAddHour, setQuickAddHour] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddDuration, setQuickAddDuration] = useState(1);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const { reminders, loadReminders } = useDashboardStore();

  // ── localStorage cache ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setBlocks(JSON.parse(saved));
    } catch { /* ignore corrupt data */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(blocks)); }
    catch { /* storage full */ }
  }, [blocks]);

  // ── API fetch ────────────────────────────────────────────────────────────
  const fetchBlocksForDate = useCallback(async (date: string) => {
    try {
      const res = await plannerService.getByDate(date);
      const apiBlocks = (res.data.blocks || []).map(apiBlockToLocal);
      setBlocks(prev => ({ ...prev, [date]: apiBlocks }));
    } catch { /* rely on localStorage cache */ }
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadReminders();
    loadHabits();
  }, [loadReminders]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHabits = useCallback(async () => {
    try {
      const res = await api.get('/habits');
      setHabits((res.data as { habits: HabitItem[] }).habits || []);
    } catch {
      setHabits([]);
    } finally {
      setHabitsLoading(false);
    }
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────
  const dk = dateKey(currentDate);

  useEffect(() => {
    fetchBlocksForDate(dk);
  }, [dk, fetchBlocksForDate]);

  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  useEffect(() => {
    if (viewMode === 'week') {
      weekDates.forEach(d => fetchBlocksForDate(dateKey(d)));
    }
  }, [viewMode, weekDates, fetchBlocksForDate]);

  const todayBlocks = useMemo(() => blocks[dk] || [], [blocks, dk]);

  const backlogItems = useMemo<BacklogItem[]>(() => {
    const items: BacklogItem[] = [];
    const now = new Date();

    reminders
      .filter((r: Reminder) => {
        if (r.completed) return false;
        if (todayBlocks.some(b => b.reminderId === r.id)) return false;
        if (!r.datetime) return isSameDay(currentDate, now);
        return isSameDay(new Date(r.datetime), currentDate);
      })
      .forEach((r: Reminder) => {
        items.push({ id: `rem_${r.id}`, title: r.text, type: 'reminder', priority: r.priority || 'normal', icon: 'bell', sourceId: r.id });
      });

    if (isSameDay(currentDate, now)) {
      habits
        .filter(h => !h.logged_today && !todayBlocks.some(b => b.habitId === h.id))
        .forEach(h => {
          items.push({ id: `hab_${h.id}`, title: `${h.icon} ${h.name}`, type: 'habit', icon: 'flame', sourceId: h.id });
        });
    }

    return items;
  }, [reminders, habits, currentDate, todayBlocks]);

  const stats = useMemo(() => {
    const planned = todayBlocks.length;
    const hoursBlocked = todayBlocks.reduce((s, b) => s + b.duration, 0);
    const pct = Math.round((hoursBlocked / 17) * 100);
    return { planned, hoursBlocked, pct };
  }, [todayBlocks]);

  // ── Block operations ─────────────────────────────────────────────────────
  const addBlock = useCallback((block: TimeBlock) => {
    notifyStart('Adding block');
    setBlocks(prev => ({ ...prev, [dk]: [...(prev[dk] || []), block] }));

    plannerService.create(localBlockToApi(block, dk)).then(res => {
      const serverBlock = apiBlockToLocal(res.data.block);
      setBlocks(prev => ({
        ...prev,
        [dk]: (prev[dk] || []).map(b => b.id === block.id ? serverBlock : b),
      }));
      notifyDone(`Scheduled "${block.title}"`);
    }).catch(() => notifyFail('Failed to save block to server'));
  }, [dk, notifyStart, notifyDone, notifyFail]);

  const removeBlock = useCallback((blockId: string) => {
    notifyStart('Removing block');
    setBlocks(prev => ({ ...prev, [dk]: (prev[dk] || []).filter(b => b.id !== blockId) }));
    plannerService.delete(blockId)
      .then(() => notifyDone('Block removed'))
      .catch(() => notifyFail('Failed to delete block from server'));
  }, [dk, notifyStart, notifyDone, notifyFail]);

  // ── Drag & drop (day view) ───────────────────────────────────────────────
  const handleDragStart = useCallback((item: BacklogItem) => setDragItem(item), []);

  const handleDragOver = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(hour);
  }, []);

  const handleDragLeave = useCallback(() => setDropTarget(null), []);

  const handleDrop = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragItem) return;
    const block: TimeBlock = {
      id: generateId(), title: dragItem.title, startHour: hour, duration: 1,
      type: dragItem.type, color: TYPE_COLORS[dragItem.type],
      reminderId: dragItem.type === 'reminder' ? String(dragItem.sourceId) : undefined,
      habitId: dragItem.type === 'habit' ? Number(dragItem.sourceId) : undefined,
    };
    addBlock(block);
    setDragItem(null);
    toast.success(`Scheduled "${dragItem.title}" at ${formatHour(hour)}`);
  }, [dragItem, addBlock]);

  // ── Drag & drop (week view) ──────────────────────────────────────────────
  const handleWeekDrop = useCallback((e: React.DragEvent, hour: number, date: Date) => {
    e.preventDefault();
    if (!dragItem) return;
    const dk2 = dateKey(date);
    const block: TimeBlock = {
      id: generateId(), title: dragItem.title, startHour: hour, duration: 1,
      type: dragItem.type, color: TYPE_COLORS[dragItem.type],
      reminderId: dragItem.type === 'reminder' ? String(dragItem.sourceId) : undefined,
      habitId: dragItem.type === 'habit' ? Number(dragItem.sourceId) : undefined,
    };
    setBlocks(prev => ({ ...prev, [dk2]: [...(prev[dk2] || []), block] }));
    plannerService.create(localBlockToApi(block, dk2)).then(res => {
      const serverBlock = apiBlockToLocal(res.data.block);
      setBlocks(prev => ({
        ...prev,
        [dk2]: (prev[dk2] || []).map(b => b.id === block.id ? serverBlock : b),
      }));
    }).catch(() => { /* optimistic block stays */ });
    setDragItem(null);
    toast.success(`Scheduled at ${formatHour(hour)} on ${DateTime.fromJSDate(date).toLocaleString({ weekday: 'short' })}`);
  }, [dragItem]);

  // ── Quick add ────────────────────────────────────────────────────────────
  const handleQuickAdd = useCallback(() => {
    if (!quickAddTitle.trim() || quickAddHour === null) return;
    const block: TimeBlock = {
      id: generateId(), title: quickAddTitle.trim(),
      startHour: quickAddHour, duration: quickAddDuration,
      type: 'custom', color: TYPE_COLORS.custom,
    };
    addBlock(block);
    const hour = quickAddHour;
    setQuickAddHour(null);
    setQuickAddTitle('');
    setQuickAddDuration(1);
    toast.success(`Added "${block.title}" at ${formatHour(hour)}`);
  }, [quickAddTitle, quickAddHour, quickAddDuration, addBlock]);

  useEffect(() => {
    if (quickAddHour !== null && quickAddRef.current) quickAddRef.current.focus();
  }, [quickAddHour]);

  // ── Date navigation ───────────────────────────────────────────────────────
  const goToday = useCallback(() => setCurrentDate(new Date()), []);
  const goPrev = useCallback(() => setCurrentDate(prev => {
    const d = new Date(prev); d.setDate(d.getDate() - 1); return d;
  }), []);
  const goNext = useCallback(() => setCurrentDate(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + 1); return d;
  }), []);

  const isToday = isSameDay(currentDate, new Date());
  const now = new Date();
  const currentHourFraction = now.getHours() + now.getMinutes() / 60;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PageShell>
        <div className="space-y-6">
          {/* Header */}
          <BlurFade delay={0}>
            <PageHeader
              icon={CalendarCheck}
              title={`${viewMode === 'day' ? 'Daily' : 'Weekly'} Planner`}
              subtitle={viewMode === 'day' ? 'Drag tasks from backlog into your timeline' : 'See your full week at a glance'}
              badge={
                <span className="relative flex h-3 w-3" title="Owned by Jarvis">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ADFF2F] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ADFF2F]" />
                </span>
              }
              actions={
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* View toggle */}
                  <div className="flex items-center rounded-lg border border-[rgba(139,92,246,0.08)] overflow-hidden">
                    <button
                      onClick={() => setViewMode('day')}
                      className={`px-3 py-1.5 text-xs font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.96] min-h-[44px] min-w-[44px] ${
                        viewMode === 'day'
                          ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)]'
                          : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 inline mr-1.5" />Day
                    </button>
                    <button
                      onClick={() => setViewMode('week')}
                      className={`px-3 py-1.5 text-xs font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.96] min-h-[44px] min-w-[44px] ${
                        viewMode === 'week'
                          ? 'bg-[#A78BFA]/15 text-[var(--ag-cyan)]'
                          : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5'
                      }`}
                    >
                      <CalendarIcon className="w-3.5 h-3.5 inline mr-1.5" />Week
                    </button>
                  </div>

                  {/* Ask Cal CTA */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#ADFF2F]/30 text-[#ADFF2F] hover:bg-[#ADFF2F]/10 min-h-[44px] text-xs active:scale-[0.96] transition-transform"
                    onClick={() => navigate('/dashboard/chat?agent=cal&prompt=Plan+my+week')}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Ask Cal
                  </Button>
                </div>
              }
            />
          </BlurFade>

          {/* Plan view (stats + week/day grid) */}
          <PlanView
            currentDate={currentDate}
            viewMode={viewMode}
            weekDates={weekDates}
            isToday={isToday}
            currentHourFraction={currentHourFraction}
            blocks={blocks}
            todayBlocks={todayBlocks}
            backlogItems={backlogItems}
            habitsLoading={habitsLoading}
            stats={stats}
            dragItem={dragItem}
            dropTarget={dropTarget}
            quickAddHour={quickAddHour}
            quickAddTitle={quickAddTitle}
            quickAddDuration={quickAddDuration}
            setCurrentDate={setCurrentDate}
            onGoToday={goToday}
            onGoPrev={goPrev}
            onGoNext={goNext}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onWeekDrop={handleWeekDrop}
            onRemoveBlock={removeBlock}
            onQuickAddHourSet={setQuickAddHour}
            onQuickAddTitleChange={setQuickAddTitle}
            onQuickAddDurationChange={setQuickAddDuration}
            onQuickAddSubmit={handleQuickAdd}
            onQuickAddCancel={() => { setQuickAddHour(null); setQuickAddTitle(''); setQuickAddDuration(1); }}
          />
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
