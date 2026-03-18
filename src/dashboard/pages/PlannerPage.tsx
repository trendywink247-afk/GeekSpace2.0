// ============================================================
// PlannerPage — Sunsama-inspired daily time-block planner
// HTML5 drag-and-drop, API persistence with localStorage cache
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell, Flame, Plus, ChevronLeft, ChevronRight, Clock,
  GripVertical, Trash2, X, CalendarCheck, LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { plannerService, type PlannerBlock } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { toast } from 'sonner';
import type { Reminder } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface TimeBlock {
  id: string;
  title: string;
  startHour: number;  // 6–23, decimal for sub-hour (e.g. 6.5 = 6:30)
  duration: number;    // hours (0.25, 0.5, 1, 2)
  type: 'reminder' | 'habit' | 'custom';
  color: string;
  reminderId?: string;
  habitId?: number;
}

interface HabitItem {
  id: number;
  name: string;
  icon: string;
  description: string | null;
  frequency: string;
  current_streak: number;
  longest_streak: number;
  logged_today: boolean;
}

interface BacklogItem {
  id: string;
  title: string;
  type: 'reminder' | 'habit';
  priority?: string;
  icon: 'bell' | 'flame';
  sourceId: string | number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
const LS_KEY = 'agentin:planner:blocks';
const DURATION_OPTIONS = [
  { label: '15m', value: 0.25 },
  { label: '30m', value: 0.5 },
  { label: '1h', value: 1 },
  { label: '2h', value: 2 },
];

const TYPE_COLORS: Record<string, string> = {
  reminder: '#00F0FF',
  habit: '#22C55E',
  custom: '#8B5CF6',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  normal: '#00F0FF',
  low: '#6B7280',
};

function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${min.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isSameDay(d1: Date, d2: Date): boolean {
  return dateKey(d1) === dateKey(d2);
}

// ── API ↔ Local conversion helpers ──────────────────────────────────────

function apiBlockToLocal(b: PlannerBlock): TimeBlock {
  // sort_order encodes startHour * 100 (e.g. 950 = 9.5 = 9:30 AM)
  const startHour = b.sort_order > 0 ? b.sort_order / 100 : 9;
  const category = b.category as TimeBlock['type'];
  const type = (['reminder', 'habit', 'custom'].includes(category)) ? category : 'custom';
  return {
    id: b.id,
    title: b.title,
    startHour,
    duration: b.duration / 60, // minutes → hours
    type,
    color: b.color,
    reminderId: b.source === 'reminder' ? (b.source_id ?? undefined) : undefined,
    habitId: b.source === 'habit' && b.source_id ? Number(b.source_id) : undefined,
  };
}

function localBlockToApi(b: TimeBlock, date: string): {
  title: string; date: string; duration: number; color: string;
  category: string; sort_order: number; source: string; source_id?: string;
} {
  return {
    title: b.title,
    date,
    duration: Math.round(b.duration * 60), // hours → minutes
    color: b.color,
    category: b.type,
    sort_order: Math.round(b.startHour * 100),
    source: b.reminderId ? 'reminder' : b.habitId ? 'habit' : 'manual',
    source_id: b.reminderId ?? (b.habitId ? String(b.habitId) : undefined),
  };
}

function generateId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatBadge({
  label, value, suffix, accent,
}: {
  label: string;
  value: number;
  suffix: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={`text-lg font-bold ${accent ? 'text-[#00F0FF]' : 'text-[#E8E8F0]'}`}>
        {value}{suffix}
      </span>
      <span className="text-[10px] text-[#8892A4] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function BacklogCard({
  item,
  onDragStart,
}: {
  item: BacklogItem;
  onDragStart: (item: BacklogItem) => void;
}) {
  const borderColor = item.type === 'reminder' ? '#00F0FF' : '#22C55E';
  const priorityColor = item.priority ? PRIORITY_COLORS[item.priority] || '#6B7280' : undefined;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(item)}
      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing
        border border-white/[0.06] hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04]
        transition-all duration-150 select-none"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: `${borderColor}60`,
      }}
    >
      <GripVertical className="w-3 h-3 text-[#8892A4]/40 flex-shrink-0 group-hover:text-[#8892A4]" />

      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${borderColor}15` }}
      >
        {item.icon === 'bell' ? (
          <Bell className="w-3.5 h-3.5" style={{ color: borderColor }} />
        ) : (
          <Flame className="w-3.5 h-3.5" style={{ color: borderColor }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#E8E8F0] truncate leading-relaxed">{item.title}</p>
      </div>

      {priorityColor && item.priority && item.priority !== 'normal' && (
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
          style={{
            color: priorityColor,
            backgroundColor: `${priorityColor}18`,
            border: `1px solid ${priorityColor}30`,
          }}
        >
          {item.priority}
        </span>
      )}
    </div>
  );
}

function TimeBlockCard({
  block,
  onRemove,
}: {
  block: TimeBlock;
  onRemove: (id: string) => void;
}) {
  const durationLabel =
    block.duration < 1
      ? `${Math.round(block.duration * 60)}m`
      : block.duration === 1
        ? '1h'
        : `${block.duration}h`;

  return (
    <div
      className="group relative rounded-lg px-3 py-2 mb-1 border transition-all duration-150 hover:scale-[1.01]"
      style={{
        backgroundColor: `${block.color}0A`,
        borderColor: `${block.color}35`,
        borderLeftWidth: 3,
        borderLeftColor: block.color,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${block.color}20` }}
          >
            {block.type === 'reminder' ? (
              <Bell className="w-3 h-3" style={{ color: block.color }} />
            ) : block.type === 'habit' ? (
              <Flame className="w-3 h-3" style={{ color: block.color }} />
            ) : (
              <LayoutGrid className="w-3 h-3" style={{ color: block.color }} />
            )}
          </div>

          <span className="text-xs font-medium text-[#E8E8F0] truncate">{block.title}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-0.5 text-[10px] text-[#8892A4]">
            <Clock className="w-3 h-3" />
            {durationLabel}
          </span>

          <button
            onClick={() => onRemove(block.id)}
            className="w-5 h-5 rounded flex items-center justify-center text-[#8892A4]/40 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove block"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickAddForm({
  inputRef,
  title,
  duration,
  onTitleChange,
  onDurationChange,
  onSubmit,
  onCancel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  duration: number;
  onTitleChange: (v: string) => void;
  onDurationChange: (v: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg p-2.5 border border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.06] space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="What are you working on?"
          className="h-7 text-xs bg-white/5 border-white/10 text-[#E8E8F0] placeholder:text-[#8892A4]/60 flex-1"
          onKeyDown={e => {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <Button
          size="sm"
          className="h-7 px-2 text-xs bg-[#8B5CF6] hover:bg-[#8B5CF6]/80 text-white"
          onClick={onSubmit}
          disabled={!title.trim()}
        >
          Add
        </Button>
        <button
          onClick={onCancel}
          className="w-6 h-6 rounded flex items-center justify-center text-[#8892A4] hover:text-[#E8E8F0] hover:bg-white/5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#8892A4] mr-1">Duration:</span>
        {DURATION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onDurationChange(opt.value)}
            className={`
              px-2 py-0.5 rounded text-[10px] font-medium border transition-colors
              ${duration === opt.value
                ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#8B5CF6]'
                : 'bg-white/5 border-white/5 text-[#8892A4] hover:border-white/10 hover:text-[#E8E8F0]'}
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function PlannerPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
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

  // --- Load blocks from localStorage cache first, then API ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setBlocks(JSON.parse(saved));
    } catch { /* ignore corrupt data */ }
  }, []);

  // Persist to localStorage as optimistic cache
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(blocks));
    } catch { /* storage full */ }
  }, [blocks]);

  // Fetch from API whenever date changes
  const fetchBlocksForDate = useCallback(async (date: string) => {
    try {
      const res = await plannerService.getByDate(date);
      const apiBlocks = (res.data.blocks || []).map(apiBlockToLocal);
      setBlocks(prev => ({ ...prev, [date]: apiBlocks }));
    } catch {
      // API unavailable — rely on localStorage cache
    }
  }, []);

  useEffect(() => {
    fetchBlocksForDate(dk);
  }, [dk, fetchBlocksForDate]);

  // --- Data loading ---
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

  // --- Derived data ---
  const dk = dateKey(currentDate);
  const todayBlocks = useMemo(() => blocks[dk] || [], [blocks, dk]);

  const backlogItems = useMemo<BacklogItem[]>(() => {
    const items: BacklogItem[] = [];
    const now = new Date();

    reminders
      .filter((r: Reminder) => {
        if (r.completed) return false;
        if (todayBlocks.some(b => b.reminderId === r.id)) return false;
        if (!r.datetime) return isSameDay(currentDate, now);
        const rd = new Date(r.datetime);
        return isSameDay(rd, currentDate);
      })
      .forEach((r: Reminder) => {
        items.push({
          id: `rem_${r.id}`,
          title: r.text,
          type: 'reminder',
          priority: r.priority || 'normal',
          icon: 'bell',
          sourceId: r.id,
        });
      });

    if (isSameDay(currentDate, now)) {
      habits
        .filter(h => {
          if (h.logged_today) return false;
          if (todayBlocks.some(b => b.habitId === h.id)) return false;
          return true;
        })
        .forEach(h => {
          items.push({
            id: `hab_${h.id}`,
            title: `${h.icon} ${h.name}`,
            type: 'habit',
            icon: 'flame',
            sourceId: h.id,
          });
        });
    }

    return items;
  }, [reminders, habits, currentDate, todayBlocks]);

  const stats = useMemo(() => {
    const planned = todayBlocks.length;
    const hoursBlocked = todayBlocks.reduce((s, b) => s + b.duration, 0);
    const totalHours = 17;
    const pct = Math.round((hoursBlocked / totalHours) * 100);
    return { planned, hoursBlocked, pct };
  }, [todayBlocks]);

  // --- Block operations (optimistic UI + API sync) ---
  const addBlock = useCallback((block: TimeBlock) => {
    // Optimistic: update state immediately
    setBlocks(prev => {
      const existing = prev[dk] || [];
      return { ...prev, [dk]: [...existing, block] };
    });

    // Persist to API in background
    const payload = localBlockToApi(block, dk);
    plannerService.create(payload).then(res => {
      // Replace optimistic block with server-assigned one
      const serverBlock = apiBlockToLocal(res.data.block);
      setBlocks(prev => {
        const existing = prev[dk] || [];
        return { ...prev, [dk]: existing.map(b => b.id === block.id ? serverBlock : b) };
      });
    }).catch(() => {
      // API failed — local block stays via localStorage cache
    });
  }, [dk]);

  const removeBlock = useCallback((blockId: string) => {
    // Optimistic: remove from state immediately
    setBlocks(prev => {
      const existing = prev[dk] || [];
      return { ...prev, [dk]: existing.filter(b => b.id !== blockId) };
    });

    // Delete from API in background
    plannerService.delete(blockId).catch(() => {
      // API failed — block is already removed from UI
    });
  }, [dk]);

  // --- Drag and Drop ---
  const handleDragStart = useCallback((item: BacklogItem) => {
    setDragItem(item);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(hour);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragItem) return;

    const block: TimeBlock = {
      id: generateId(),
      title: dragItem.title,
      startHour: hour,
      duration: 1,
      type: dragItem.type,
      color: TYPE_COLORS[dragItem.type],
      reminderId: dragItem.type === 'reminder' ? String(dragItem.sourceId) : undefined,
      habitId: dragItem.type === 'habit' ? Number(dragItem.sourceId) : undefined,
    };

    addBlock(block);
    setDragItem(null);
    toast.success(`Scheduled "${dragItem.title}" at ${formatHour(hour)}`);
  }, [dragItem, addBlock]);

  // --- Quick Add ---
  const handleQuickAdd = useCallback(() => {
    if (!quickAddTitle.trim() || quickAddHour === null) return;

    const block: TimeBlock = {
      id: generateId(),
      title: quickAddTitle.trim(),
      startHour: quickAddHour,
      duration: quickAddDuration,
      type: 'custom',
      color: TYPE_COLORS.custom,
    };

    addBlock(block);
    const hour = quickAddHour;
    setQuickAddHour(null);
    setQuickAddTitle('');
    setQuickAddDuration(1);
    toast.success(`Added "${block.title}" at ${formatHour(hour)}`);
  }, [quickAddTitle, quickAddHour, quickAddDuration, addBlock]);

  useEffect(() => {
    if (quickAddHour !== null && quickAddRef.current) {
      quickAddRef.current.focus();
    }
  }, [quickAddHour]);

  // --- Date navigation ---
  const goToday = useCallback(() => setCurrentDate(new Date()), []);
  const goPrev = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);
  const goNext = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const isToday = isSameDay(currentDate, new Date());
  const now = new Date();
  const currentHourFraction = now.getHours() + now.getMinutes() / 60;

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8F0] flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-[#00F0FF]" />
            Daily Planner
          </h1>
          <p className="text-sm text-[#8892A4] mt-1">
            Drag tasks from backlog into your timeline
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <StatBadge label="planned" value={stats.planned} suffix=" items" />
          <StatBadge label="blocked" value={stats.hoursBlocked} suffix="h" />
          <StatBadge label="of day" value={stats.pct} suffix="%" accent />
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-5">
        {/* Left: Backlog Panel */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
          <div
            className="rounded-xl border border-white/10 overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(12,12,24,0.9) 0%, rgba(12,12,24,0.7) 100%)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#8892A4]" />
                <span className="text-sm font-semibold text-[#E8E8F0]">Backlog</span>
                <Badge
                  variant="outline"
                  className="text-xs border-[#00F0FF]/30 text-[#00F0FF] bg-[#00F0FF]/10"
                >
                  {backlogItems.length}
                </Badge>
              </div>
            </div>

            <div className="p-2 space-y-1.5 max-h-[40vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
              {backlogItems.length === 0 && !habitsLoading ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#00F0FF]/5 border border-[#00F0FF]/10 flex items-center justify-center mx-auto mb-3">
                    <CalendarCheck className="w-5 h-5 text-[#00F0FF]/40" />
                  </div>
                  <p className="text-xs text-[#8892A4]">
                    {isToday ? 'All caught up!' : 'No items for this day'}
                  </p>
                  <p className="text-[10px] text-[#8892A4]/60 mt-1">
                    Reminders and habits appear here
                  </p>
                </div>
              ) : habitsLoading ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-[#8892A4] mt-2">Loading...</p>
                </div>
              ) : (
                backlogItems.map(item => (
                  <BacklogCard
                    key={item.id}
                    item={item}
                    onDragStart={handleDragStart}
                  />
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-white/5">
              <div className="flex items-center gap-3 text-[10px] text-[#8892A4]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                  Reminders
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                  Habits
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                  Custom
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl border border-white/10 overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(12,12,24,0.9) 0%, rgba(12,12,24,0.7) 100%)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Date header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#8892A4] hover:text-[#E8E8F0] hover:bg-white/5"
                  onClick={goPrev}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <button
                  onClick={goToday}
                  className="text-sm font-semibold text-[#E8E8F0] hover:text-[#00F0FF] transition-colors"
                >
                  {formatDate(currentDate)}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[#8892A4] hover:text-[#E8E8F0] hover:bg-white/5"
                  onClick={goNext}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              {!isToday && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 h-7"
                  onClick={goToday}
                >
                  Today
                </Button>
              )}
            </div>

            {/* Time grid */}
            <div className="relative max-h-[65vh] sm:max-h-[calc(100vh-260px)] overflow-y-auto custom-scrollbar">
              {HOURS.map(hour => {
                const isCurrentHour = isToday && Math.floor(currentHourFraction) === hour;
                const isDrop = dropTarget === hour;
                const slotBlocks = todayBlocks.filter(b => Math.floor(b.startHour) === hour);

                return (
                  <div
                    key={hour}
                    className={`
                      flex border-b border-white/[0.03] min-h-[64px] transition-colors duration-150
                      ${isCurrentHour ? 'bg-[#00F0FF]/[0.03]' : ''}
                      ${isDrop ? 'bg-[#00F0FF]/[0.06]' : ''}
                    `}
                    onDragOver={e => handleDragOver(e, hour)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, hour)}
                  >
                    {/* Time label */}
                    <div className={`
                      w-16 sm:w-20 flex-shrink-0 py-2 px-2 sm:px-3 text-right
                      border-r transition-colors duration-150
                      ${isCurrentHour
                        ? 'border-r-2 border-r-[#00F0FF] text-[#00F0FF]'
                        : 'border-r-white/5 text-[#8892A4]'}
                    `}>
                      <span className="font-mono text-xs sm:text-sm">
                        {formatHour(hour)}
                      </span>
                    </div>

                    {/* Drop zone / blocks area */}
                    <div className={`
                      flex-1 py-1.5 px-2 sm:px-3 relative min-h-[64px]
                      ${isDrop ? 'ring-1 ring-inset ring-[#00F0FF]/30 rounded-r-lg' : ''}
                    `}>
                      {slotBlocks.map(block => (
                        <TimeBlockCard
                          key={block.id}
                          block={block}
                          onRemove={removeBlock}
                        />
                      ))}

                      {isDrop && slotBlocks.length === 0 && (
                        <div className="absolute inset-1 border border-dashed border-[#00F0FF]/40 rounded-lg flex items-center justify-center">
                          <span className="text-[10px] text-[#00F0FF]/60">Drop here</span>
                        </div>
                      )}

                      {!dragItem && slotBlocks.length === 0 && quickAddHour !== hour && (
                        <button
                          onClick={() => setQuickAddHour(hour)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-md bg-white/5 hover:bg-[#8B5CF6]/20 border border-white/5 hover:border-[#8B5CF6]/30 flex items-center justify-center transition-all"
                          style={{ opacity: 0.3 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
                          title="Add custom block"
                        >
                          <Plus className="w-3 h-3 text-[#8B5CF6]" />
                        </button>
                      )}

                      {quickAddHour === hour && (
                        <QuickAddForm
                          inputRef={quickAddRef}
                          title={quickAddTitle}
                          duration={quickAddDuration}
                          onTitleChange={setQuickAddTitle}
                          onDurationChange={setQuickAddDuration}
                          onSubmit={handleQuickAdd}
                          onCancel={() => {
                            setQuickAddHour(null);
                            setQuickAddTitle('');
                            setQuickAddDuration(1);
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Current time indicator line */}
              {isToday && currentHourFraction >= 6 && currentHourFraction <= 23 && (
                <div
                  className="absolute left-0 right-0 pointer-events-none z-10"
                  style={{
                    top: `${((currentHourFraction - 6) / 17) * 100}%`,
                  }}
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-[#FF2D78] -ml-1" />
                    <div className="flex-1 h-[2px] bg-[#FF2D78]/60" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
