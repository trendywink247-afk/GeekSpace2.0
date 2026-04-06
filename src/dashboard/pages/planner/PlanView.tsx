// ============================================================
// PlanView — day timeline + week grid view (pure presentational)
// All state lives in PlannerPage; handlers are passed as props.
// ============================================================

import { useRef } from 'react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Plus, CalendarCheck, LayoutGrid,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { TimeBlockCard, BacklogCard } from './TaskCard';
import { QuickAddForm } from './CreatePlanDialog';
import {
  HOURS, formatHour, formatDate, dateKey, isSameDay,
} from './helpers';
import type { TimeBlock, BacklogItem } from './helpers';

// ── StatBadge (local) ──────────────────────────────────────────────────────

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
      <span className={`text-lg font-bold font-heading tabular-nums ${accent ? 'text-[var(--ag-cyan)]' : 'text-[var(--ag-text-primary)]'}`}>
        {value}{suffix}
      </span>
      <span className="text-[10px] text-[var(--ag-text-secondary)] uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface PlanViewProps {
  // Date + view
  currentDate: Date;
  viewMode: 'day' | 'week';
  weekDates: Date[];
  isToday: boolean;
  currentHourFraction: number;

  // Data
  blocks: Record<string, TimeBlock[]>;
  todayBlocks: TimeBlock[];
  backlogItems: BacklogItem[];
  habitsLoading: boolean;
  stats: { planned: number; hoursBlocked: number; pct: number };

  // Drag
  dragItem: BacklogItem | null;
  dropTarget: number | null;

  // Quick add
  quickAddHour: number | null;
  quickAddTitle: string;
  quickAddDuration: number;

  // Handlers — date nav
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  onGoToday: () => void;
  onGoPrev: () => void;
  onGoNext: () => void;

  // Handlers — drag & drop
  onDragStart: (item: BacklogItem) => void;
  onDragOver: (e: React.DragEvent, hour: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, hour: number) => void;
  onWeekDrop: (e: React.DragEvent, hour: number, date: Date) => void;

  // Handlers — blocks
  onRemoveBlock: (id: string) => void;

  // Handlers — quick add
  onQuickAddHourSet: (hour: number | null) => void;
  onQuickAddTitleChange: (v: string) => void;
  onQuickAddDurationChange: (v: number) => void;
  onQuickAddSubmit: () => void;
  onQuickAddCancel: () => void;
}

// ── PlanView ───────────────────────────────────────────────────────────────

export function PlanView(props: PlanViewProps) {
  const {
    currentDate, viewMode, weekDates, isToday, currentHourFraction,
    blocks, todayBlocks, backlogItems, habitsLoading, stats,
    dragItem, dropTarget,
    quickAddHour, quickAddTitle, quickAddDuration,
    setCurrentDate, onGoToday, onGoPrev, onGoNext,
    onDragStart, onDragOver, onDragLeave, onDrop, onWeekDrop,
    onRemoveBlock,
    onQuickAddHourSet, onQuickAddTitleChange, onQuickAddDurationChange,
    onQuickAddSubmit, onQuickAddCancel,
  } = props;

  const quickAddRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Stats row */}
      <BlurFade delay={0.1}>
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <StatBadge label="planned" value={stats.planned} suffix=" items" />
          <StatBadge label="blocked" value={stats.hoursBlocked} suffix="h" />
          <StatBadge label="of day" value={stats.pct} suffix="%" accent />
        </div>
      </BlurFade>

      {/* ── Week View ──────────────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <BlurFade delay={0.2}>
          <SectionCard
            padding="sm"
            className="overflow-hidden !p-0 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl"
          >
            {/* Week header with nav */}
            <div className="px-4 py-3 border-b border-[var(--ag-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5"
                  onClick={() => setCurrentDate(prev => {
                    const d = new Date(prev);
                    d.setDate(d.getDate() - 7);
                    return d;
                  })}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">
                  {DateTime.fromJSDate(weekDates[0]).toLocaleString({ month: 'short', day: 'numeric' })}
                  {' – '}
                  {DateTime.fromJSDate(weekDates[6]).toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5"
                  onClick={() => setCurrentDate(prev => {
                    const d = new Date(prev);
                    d.setDate(d.getDate() + 7);
                    return d;
                  })}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[var(--ag-cyan)] hover:text-[var(--ag-cyan)] hover:bg-[#A78BFA]/10 min-h-[44px] sm:min-h-0 sm:h-7"
                onClick={onGoToday}
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
                        onClick={() => { setCurrentDate(d); }}
                        className={`p-2 text-center transition-colors min-h-[44px] ${
                          isDateToday ? 'bg-[#A78BFA]/[0.05]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className={`text-[10px] uppercase tracking-wider ${isDateToday ? 'text-[var(--ag-cyan)]' : 'text-[var(--ag-text-secondary)]'}`}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}
                        </span>
                        <span className={`block text-lg font-bold font-heading mt-0.5 ${isDateToday ? 'text-[var(--ag-cyan)]' : 'text-[var(--ag-text-primary)]'}`}>
                          {d.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Hour rows — every 2 hours for compactness */}
                <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                  {HOURS.filter((_, i) => i % 2 === 0).map(hour => (
                    <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-white/[0.03]">
                      <div className="p-1.5 text-right text-[10px] text-[var(--ag-text-secondary)] font-mono border-r border-[var(--ag-border-subtle)]">
                        {formatHour(hour)}
                      </div>
                      {weekDates.map(d => {
                        const dk2 = dateKey(d);
                        const dayBlocks = (blocks[dk2] || []).filter(
                          b => Math.floor(b.startHour) === hour || Math.floor(b.startHour) === hour + 1,
                        );
                        const isDateToday = isSameDay(d, new Date());
                        const isCurrent = isDateToday
                          && Math.floor(currentHourFraction) >= hour
                          && Math.floor(currentHourFraction) < hour + 2;
                        return (
                          <div
                            key={dk2}
                            className={`p-0.5 min-h-[48px] border-r border-white/[0.03] transition-colors ${
                              isCurrent ? 'bg-[#A78BFA]/[0.03]' : ''
                            } ${isDateToday ? 'bg-white/[0.01]' : ''}`}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                            onDrop={e => onWeekDrop(e, hour, d)}
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
                                onClick={() => setCurrentDate(d)}
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
        </BlurFade>
      )}

      {/* ── Day View ────────────────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5">

          {/* Left: Backlog Panel */}
          <BlurFade delay={0.2}>
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
              <SectionCard
                padding="sm"
                className="overflow-hidden !p-0 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl"
              >
                <div className="px-4 py-3 border-b border-[var(--ag-border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[var(--ag-text-secondary)]" />
                    <span className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">Backlog</span>
                    <Badge
                      variant="outline"
                      className="text-xs border-[var(--ag-cyan)]/30 text-[var(--ag-cyan)] bg-[#A78BFA]/10"
                    >
                      {backlogItems.length}
                    </Badge>
                  </div>
                </div>

                <div className="p-2 space-y-1.5 max-h-[40vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                  {backlogItems.length === 0 && !habitsLoading ? (
                    <div className="py-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#A78BFA]/5 border border-[var(--ag-cyan)]/10 flex items-center justify-center mx-auto mb-3">
                        <CalendarCheck className="w-5 h-5 text-[var(--ag-cyan)]/40" />
                      </div>
                      <p className="text-xs text-[var(--ag-text-secondary)]">
                        {isToday ? 'All caught up!' : 'No items for this day'}
                      </p>
                      <p className="text-[10px] text-[var(--ag-text-secondary)]/60 mt-1">
                        Reminders and habits appear here
                      </p>
                    </div>
                  ) : habitsLoading ? (
                    <div className="py-8 text-center">
                      <div className="w-5 h-5 border-2 border-[var(--ag-cyan)]/30 border-t-[#A78BFA] rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-[var(--ag-text-secondary)] mt-2">Loading...</p>
                    </div>
                  ) : (
                    backlogItems.map(item => (
                      <BacklogCard
                        key={item.id}
                        item={item}
                        onDragStart={onDragStart}
                      />
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-[var(--ag-border-subtle)]">
                  <div className="flex items-center gap-3 text-[10px] text-[var(--ag-text-secondary)]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--ag-cyan)]" />
                      Reminders
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--ag-green)]" />
                      Habits
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--ag-violet)]" />
                      Custom
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </BlurFade>

          {/* Right: Timeline */}
          <BlurFade delay={0.3}>
            <div className="flex-1 min-w-0">
              <SectionCard
                padding="sm"
                className="overflow-hidden !p-0 bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl"
              >
                {/* Date header */}
                <div className="px-4 py-3 border-b border-[var(--ag-border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 sm:h-9 sm:w-9 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5"
                      onClick={onGoPrev}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <button
                      onClick={onGoToday}
                      className="text-sm font-semibold font-heading text-[var(--ag-text-primary)] hover:text-[var(--ag-cyan)] transition-colors min-h-[44px] px-2"
                    >
                      {formatDate(currentDate)}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 sm:h-9 sm:w-9 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-white/5"
                      onClick={onGoNext}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  {!isToday && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[var(--ag-cyan)] hover:text-[var(--ag-cyan)] hover:bg-[#A78BFA]/10 min-h-[44px] sm:min-h-0 sm:h-7"
                      onClick={onGoToday}
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
                          ${isCurrentHour ? 'bg-[#A78BFA]/[0.03]' : ''}
                          ${isDrop ? 'bg-[#A78BFA]/[0.06]' : ''}
                        `}
                        onDragOver={e => onDragOver(e, hour)}
                        onDragLeave={onDragLeave}
                        onDrop={e => onDrop(e, hour)}
                      >
                        {/* Time label */}
                        <div className={`
                          w-16 sm:w-20 flex-shrink-0 py-2 px-2 sm:px-3 text-right
                          border-r transition-colors duration-150
                          ${isCurrentHour
                            ? 'border-r-2 border-r-[#A78BFA] text-[var(--ag-cyan)]'
                            : 'border-r-white/5 text-[var(--ag-text-secondary)]'}
                        `}>
                          <span className="font-mono text-xs sm:text-sm tabular-nums">
                            {formatHour(hour)}
                          </span>
                        </div>

                        {/* Drop zone / blocks area */}
                        <div className={`
                          flex-1 py-1.5 px-2 sm:px-3 relative min-h-[64px]
                          ${isDrop ? 'ring-1 ring-inset ring-[#A78BFA]/30 rounded-r-lg' : ''}
                        `}>
                          {slotBlocks.map(block => (
                            <TimeBlockCard
                              key={block.id}
                              block={block}
                              onRemove={onRemoveBlock}
                            />
                          ))}

                          {isDrop && slotBlocks.length === 0 && (
                            <div className="absolute inset-1 border border-dashed border-[var(--ag-cyan)]/40 rounded-lg flex items-center justify-center">
                              <span className="text-[10px] text-[var(--ag-cyan)]/60">Drop here</span>
                            </div>
                          )}

                          {!dragItem && slotBlocks.length === 0 && quickAddHour !== hour && (
                            <button
                              onClick={() => onQuickAddHourSet(hour)}
                              className="absolute top-1 right-1 w-11 h-11 sm:w-7 sm:h-7 rounded-md bg-white/5 hover:bg-[#8B5CF6]/20 border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] flex items-center justify-center transition-all opacity-30 hover:opacity-100"
                              title="Add custom block"
                            >
                              <Plus className="w-3.5 h-3.5 text-[var(--ag-violet)]" />
                            </button>
                          )}

                          {quickAddHour === hour && (
                            <QuickAddForm
                              inputRef={quickAddRef}
                              title={quickAddTitle}
                              duration={quickAddDuration}
                              onTitleChange={onQuickAddTitleChange}
                              onDurationChange={onQuickAddDurationChange}
                              onSubmit={onQuickAddSubmit}
                              onCancel={onQuickAddCancel}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Current time indicator */}
                  {isToday && currentHourFraction >= 6 && currentHourFraction <= 23 && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none z-10"
                      style={{ top: `${((currentHourFraction - 6) / 17) * 100}%` }}
                    >
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-[var(--ag-pink)] -ml-1" />
                        <div className="flex-1 h-[2px] bg-[var(--ag-pink)]/60" />
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          </BlurFade>
        </div>
      )}
    </>
  );
}

// Re-export helpers for consumers that only need PlanView
export type { TimeBlock, BacklogItem } from './helpers';
export { TYPE_COLORS, generateId, localBlockToApi, apiBlockToLocal } from './helpers';
