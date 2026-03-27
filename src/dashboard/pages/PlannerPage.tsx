// ============================================================
// PlannerPage — Sunsama-inspired daily time-block planner
// HTML5 drag-and-drop, API persistence with localStorage cache
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Flame, Plus, ChevronLeft, ChevronRight, Clock,
  GripVertical, Trash2, X, CalendarCheck, LayoutGrid,
  Calendar as CalendarIcon, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { plannerService, type PlannerBlock } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
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
  return DateTime.fromJSDate(d).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
      <span className={`text-lg font-bold ${accent ? 'text-[#00F0FF]' : 'text-[#F4F6FF]'}`}>
        {value}{suffix}
      </span>
      <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{label}</span>
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
        border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] bg-white/[0.02] hover:bg-white/[0.04]
        transition-all duration-150 select-none min-h-[44px]"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: `${borderColor}60`,
      }}
    >
      <GripVertical className="w-3 h-3 text-[#9CA3AF]/40 flex-shrink-0 group-hover:text-[#9CA3AF]" />

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
        <p className="text-xs text-[#F4F6FF] truncate leading-relaxed">{item.title}</p>
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

          <span className="text-xs font-medium text-[var(--ag-text-primary)] truncate">{block.title}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-0.5 text-[10px] text-[#9CA3AF]">
            <Clock className="w-3 h-3" />
            {durationLabel}
          </span>

          <button
            onClick={() => onRemove(block.id)}
            className="w-11 h-11 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[#9CA3AF]/40 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors opacity-0 group-hover:opacity-100"
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
          className="h-9 sm:h-7 text-xs bg-white/5 border-[rgba(139,92,246,0.08)] text-[#F4F6FF] placeholder:text-[#9CA3AF]/60 flex-1"
          onKeyDown={e => {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <Button
          size="sm"
          className="h-9 sm:h-7 px-2 text-xs bg-[#8B5CF6] hover:bg-[#8B5CF6]/80 text-white min-w-[44px]"
          onClick={onSubmit}
          disabled={!title.trim()}
        >
          Add
        </Button>
        <button
          onClick={onCancel}
          className="w-11 h-11 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#9CA3AF] mr-1">Duration:</span>
        {DURATION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onDurationChange(opt.value)}
            className={`
              px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded text-[10px] font-medium border transition-colors min-h-[44px] sm:min-h-0
              ${duration === opt.value
                ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#8B5CF6]'
                : 'bg-white/5 border-[rgba(139,92,246,0.08)] text-[#9CA3AF] hover:border-[rgba(139,92,246,0.15)] hover:text-[#F4F6FF]'}
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
  const navigate = useNavigate();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'jarvis', page: 'planner' });
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

  // Fetch blocks for current date (day view)
  useEffect(() => {
    fetchBlocksForDate(dk);
  }, [dk, fetchBlocksForDate]);

  // Fetch blocks for the full week (week view)
  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek); // Start on Sunday
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
    notifyStart('Adding block');
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
      notifyDone(`Scheduled "${block.title}"`);
    }).catch(() => {
      // API failed — local block stays via localStorage cache
      notifyFail('Failed to save block to server');
    });
  }, [dk, notifyStart, notifyDone, notifyFail]);

  const removeBlock = useCallback((blockId: string) => {
    notifyStart('Removing block');
    // Optimistic: remove from state immediately
    setBlocks(prev => {
      const existing = prev[dk] || [];
      return { ...prev, [dk]: existing.filter(b => b.id !== blockId) };
    });

    // Delete from API in background
    plannerService.delete(blockId).then(() => {
      notifyDone('Block removed');
    }).catch(() => {
      // API failed — block is already removed from UI
      notifyFail('Failed to delete block from server');
    });
  }, [dk, notifyStart, notifyDone, notifyFail]);

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
    <PageShell>
    <div className="space-y-6">
      {/* Header with jarvis ownership dot */}
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
                className={`px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] min-w-[44px] ${
                  viewMode === 'day'
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                    : 'text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5'
                }`}
              >
                <Clock className="w-3.5 h-3.5 inline mr-1.5" />Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] min-w-[44px] ${
                  viewMode === 'week'
                    ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                    : 'text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 inline mr-1.5" />Week
              </button>
            </div>

            {/* Ask Cal CTA */}
            <Button
              variant="outline"
              size="sm"
              className="border-[#ADFF2F]/30 text-[#ADFF2F] hover:bg-[#ADFF2F]/10 min-h-[44px] text-xs"
              onClick={() => navigate('/dashboard/chat?agent=cal&prompt=Plan+my+week')}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Ask Cal
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
        <StatBadge label="planned" value={stats.planned} suffix=" items" />
        <StatBadge label="blocked" value={stats.hoursBlocked} suffix="h" />
        <StatBadge label="of day" value={stats.pct} suffix="%" accent />
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <SectionCard padding="sm" className="overflow-hidden !p-0">
          {/* Week header with nav */}
          <div className="px-4 py-3 border-b border-[var(--ag-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9 text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5"
                onClick={() => setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold text-[#F4F6FF]">
                {DateTime.fromJSDate(weekDates[0]).toLocaleString({ month: 'short', day: 'numeric' })}
                {' - '}
                {DateTime.fromJSDate(weekDates[6]).toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9 text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5"
                onClick={() => setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 min-h-[44px] sm:min-h-0 sm:h-7"
              onClick={goToday}
            >
              This Week
            </Button>
          </div>

          {/* Week grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[var(--ag-border-subtle)]">
                <div className="p-2" />
                {weekDates.map(d => {
                  const isDateToday = isSameDay(d, new Date());
                  return (
                    <button
                      key={dateKey(d)}
                      onClick={() => { setCurrentDate(d); setViewMode('day'); }}
                      className={`p-2 text-center transition-colors min-h-[44px] ${
                        isDateToday ? 'bg-[#00F0FF]/[0.05]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className={`text-[10px] uppercase tracking-wider ${isDateToday ? 'text-[#00F0FF]' : 'text-[#9CA3AF]'}`}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
                      </span>
                      <span className={`block text-lg font-bold mt-0.5 ${isDateToday ? 'text-[#00F0FF]' : 'text-[#F4F6FF]'}`}>
                        {d.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Hour rows — show every 2 hours for compactness */}
              <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                {HOURS.filter((_, i) => i % 2 === 0).map(hour => (
                  <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/[0.03]">
                    <div className="p-1.5 text-right text-[10px] text-[#9CA3AF] font-mono border-r border-[var(--ag-border-subtle)]">
                      {formatHour(hour)}
                    </div>
                    {weekDates.map(d => {
                      const dk2 = dateKey(d);
                      const dayBlocks = (blocks[dk2] || []).filter(b => Math.floor(b.startHour) === hour || Math.floor(b.startHour) === hour + 1);
                      const isDateToday = isSameDay(d, new Date());
                      const isCurrent = isDateToday && Math.floor(currentHourFraction) >= hour && Math.floor(currentHourFraction) < hour + 2;
                      return (
                        <div
                          key={dk2}
                          className={`p-0.5 min-h-[48px] border-r border-white/[0.03] transition-colors ${
                            isCurrent ? 'bg-[#00F0FF]/[0.03]' : ''
                          } ${isDateToday ? 'bg-white/[0.01]' : ''}`}
                          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={e => {
                            e.preventDefault();
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
                            setBlocks(prev => ({
                              ...prev,
                              [dk2]: [...(prev[dk2] || []), block],
                            }));
                            const payload = localBlockToApi(block, dk2);
                            plannerService.create(payload).then(res => {
                              const serverBlock = apiBlockToLocal(res.data.block);
                              setBlocks(prev => ({
                                ...prev,
                                [dk2]: (prev[dk2] || []).map(b => b.id === block.id ? serverBlock : b),
                              }));
                            }).catch(() => { /* optimistic block stays */ });
                            setDragItem(null);
                            toast.success(`Scheduled at ${formatHour(hour)} on ${DateTime.fromJSDate(d).toLocaleString({ weekday: 'short' })}`);
                          }}
                        >
                          {dayBlocks.map(block => (
                            <div
                              key={block.id}
                              className="rounded px-1 py-0.5 mb-0.5 text-[10px] truncate border-l-2 cursor-pointer hover:opacity-80"
                              style={{
                                backgroundColor: `${block.color}0A`,
                                borderLeftColor: block.color,
                                color: block.color,
                              }}
                              onClick={() => { setCurrentDate(d); setViewMode('day'); }}
                              title={`${block.title} (${formatHour(block.startHour)})`}
                            >
                              {block.title}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Main Layout (Day View) */}
      {viewMode === 'day' && <div className="flex flex-col lg:flex-row gap-4 sm:gap-5">
        {/* Left: Backlog Panel */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
          <SectionCard padding="sm" className="overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-[var(--ag-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#9CA3AF]" />
                <span className="text-sm font-semibold text-[#F4F6FF]">Backlog</span>
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
                  <p className="text-xs text-[#9CA3AF]">
                    {isToday ? 'All caught up!' : 'No items for this day'}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF]/60 mt-1">
                    Reminders and habits appear here
                  </p>
                </div>
              ) : habitsLoading ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-[#9CA3AF] mt-2">Loading...</p>
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

            <div className="px-4 py-2.5 border-t border-[var(--ag-border-subtle)]">
              <div className="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
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
          </SectionCard>
        </div>

        {/* Right: Timeline */}
        <div className="flex-1 min-w-0">
          <SectionCard padding="sm" className="overflow-hidden !p-0">
            {/* Date header */}
            <div className="px-4 py-3 border-b border-[var(--ag-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5"
                  onClick={goPrev}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <button
                  onClick={goToday}
                  className="text-sm font-semibold text-[#F4F6FF] hover:text-[#00F0FF] transition-colors min-h-[44px] px-2"
                >
                  {formatDate(currentDate)}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5"
                  onClick={goNext}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              {!isToday && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 min-h-[44px] sm:min-h-0 sm:h-7"
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
                        : 'border-r-white/5 text-[#9CA3AF]'}
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
                          className="absolute top-1 right-1 w-11 h-11 sm:w-7 sm:h-7 rounded-md bg-white/5 hover:bg-[#8B5CF6]/20 border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] flex items-center justify-center transition-all opacity-30 hover:opacity-100"
                          title="Add custom block"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#8B5CF6]" />
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
          </SectionCard>
        </div>
      </div>}
    </div>
    </PageShell>
  );
}
