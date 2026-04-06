// calendar/MonthGrid.tsx — animated month grid with day cells, nav, and legend
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent, ReminderItem, EventCategory } from "./helpers";
import {
  CATEGORY_CONFIG,
  REMINDER_COLOR,
  DAY_NAMES_SHORT,
  DAY_NAMES_FULL,
  isSameDay,
  dateKey,
  getDaysInMonth,
  getFirstDayOfMonth,
} from "./helpers";

const monthVariants = {
  enterNext: { opacity: 0, x:  40 },
  enterPrev: { opacity: 0, x: -40 },
  center:    { opacity: 1, x:   0 },
  exitNext:  { opacity: 0, x: -40 },
  exitPrev:  { opacity: 0, x:  40 },
};

interface MonthGridProps {
  viewYear: number;
  viewMonth: number;
  navDir: "next" | "prev";
  today: Date;
  selectedDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  remindersByDate: Map<string, ReminderItem[]>;
  monthLabel: string;
  monthKey: string;
  isCurrentMonthView: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (date: Date) => void;
}

export function MonthGrid({
  viewYear,
  viewMonth,
  navDir,
  today,
  selectedDate,
  eventsByDate,
  remindersByDate,
  monthLabel,
  monthKey,
  isCurrentMonthView,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}: MonthGridProps) {
  const gridCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay    = getFirstDayOfMonth(viewYear, viewMonth);
    const cells: Array<{ day: number; date: Date; isCurrentMonth: boolean }> = [];

    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear  = viewMonth === 0 ? viewYear - 1 : viewYear;
    const prevDays  = getDaysInMonth(prevYear, prevMonth);
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevDays - i, date: new Date(prevYear, prevMonth, prevDays - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(viewYear, viewMonth, d), isCurrentMonth: true });
    }
    const nextMonth = viewMonth === 11 ? 0  : viewMonth + 1;
    const nextYear  = viewMonth === 11 ? viewYear + 1 : viewYear;
    for (let d = 1; d <= 42 - cells.length; d++) {
      cells.push({ day: d, date: new Date(nextYear, nextMonth, d), isCurrentMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const navBtnClass =
    "flex items-center justify-center rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 " +
    "focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--ag-bg-surface)',
        backdropFilter: 'blur(20px)',
        boxShadow: [
          '0 0 0 1px var(--ag-border-subtle)',
          '0 8px 32px rgba(0,0,0,0.35)',
          '0 0 60px rgba(139,92,246,0.05)',
          'inset 0 1px 0 rgba(255,255,255,0.04)',
        ].join(', '),
      }}
    >
      {/* Month navigation */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--ag-border-subtle)' }}
      >
        <button
          onClick={onPrevMonth}
          aria-label="Previous month"
          className={navBtnClass}
          style={{ width: 44, height: 44, background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ag-bg-elevated)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ChevronLeft className="h-5 w-5 text-[var(--ag-text-secondary)]" />
        </button>

        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={monthKey}
              initial={navDir === "next" ? { opacity: 0, x: 20 } : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={navDir === "next" ? { opacity: 0, x: -20 } : { opacity: 0, x: 20 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              className="font-heading font-semibold text-[var(--ag-text-primary)] select-none"
              style={{ fontSize: '1.0625rem', fontVariantNumeric: 'tabular-nums' }}
            >
              {monthLabel}
            </motion.h2>
          </AnimatePresence>

          {!isCurrentMonthView && (
            <button
              onClick={onToday}
              className="text-xs px-2.5 py-1 rounded-md border transition-all duration-150 hover:scale-105 active:scale-95"
              style={{
                borderColor: 'var(--ag-border-default)',
                color: 'var(--ag-text-secondary)',
                background: 'var(--ag-bg-elevated)',
                minHeight: '28px',
              }}
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={onNextMonth}
          aria-label="Next month"
          className={navBtnClass}
          style={{ width: 44, height: 44, background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ag-bg-elevated)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ChevronRight className="h-5 w-5 text-[var(--ag-text-secondary)]" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-2 pt-2 pb-1">
        {DAY_NAMES_SHORT.map((d, i) => (
          <div key={i} className="flex items-center justify-center" style={{ height: 28 }}>
            <span className="hidden sm:block text-xs font-medium text-[var(--ag-text-muted)] uppercase tracking-wide select-none">
              {DAY_NAMES_FULL[i]}
            </span>
            <span className="sm:hidden text-xs font-medium text-[var(--ag-text-muted)] uppercase tracking-wide select-none">
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Animated grid */}
      <div className="px-2 pb-3 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={monthKey}
            initial={navDir === "next" ? monthVariants.enterNext : monthVariants.enterPrev}
            animate={monthVariants.center}
            exit={navDir === "next" ? monthVariants.exitNext : monthVariants.exitPrev}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
            className="grid grid-cols-7 gap-0.5"
          >
            {gridCells.map((cell, idx) => {
              const key        = dateKey(cell.date);
              const isToday    = isSameDay(cell.date, today);
              const isSelected = isSameDay(cell.date, selectedDate);
              const dayEvs     = eventsByDate.get(key)    ?? [];
              const dayRems    = remindersByDate.get(key) ?? [];
              const totalDots  = dayEvs.length + dayRems.length;

              const dotItems: Array<{ color: string }> = [];
              for (const ev of dayEvs) {
                const cat = (ev.category ?? 'personal') as EventCategory;
                dotItems.push({ color: (CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.personal).dot });
              }
              for (let i = 0; i < dayRems.length; i++) {
                dotItems.push({ color: REMINDER_COLOR });
              }
              const visibleDots = dotItems.slice(0, 3);
              const overflow    = totalDots > 3 ? totalDots - 3 : 0;

              return (
                <button
                  key={idx}
                  onClick={() => onSelectDate(cell.date)}
                  aria-label={`${cell.day} ${monthLabel}`}
                  aria-pressed={isSelected}
                  className="relative flex flex-col items-center justify-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/60 transition-all duration-150"
                  style={{
                    minHeight: 44,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: isToday
                      ? 'rgba(139,92,246,0.08)'
                      : isSelected ? 'var(--ag-active-bg)' : 'transparent',
                    boxShadow: isToday
                      ? '0 0 0 1.5px rgba(139,92,246,0.5), 0 0 12px rgba(139,92,246,0.15)'
                      : isSelected && !isToday ? '0 0 0 1px var(--ag-border-active)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isToday && !isSelected) e.currentTarget.style.background = 'var(--ag-bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isToday && !isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    className="leading-none select-none"
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: isToday ? 700 : isSelected ? 600 : 500,
                      fontVariantNumeric: 'tabular-nums',
                      color: isToday ? 'var(--ag-violet)' : 'var(--ag-text-primary)',
                      opacity: cell.isCurrentMonth ? 1 : 0.3,
                    }}
                  >
                    {cell.day}
                  </span>

                  {totalDots > 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {visibleDots.map((dot, di) => (
                        <span
                          key={di}
                          className="rounded-full shrink-0"
                          style={{
                            width: 4, height: 4,
                            background: dot.color,
                            opacity: cell.isCurrentMonth ? 1 : 0.3,
                          }}
                        />
                      ))}
                      {overflow > 0 && (
                        <span
                          className="leading-none"
                          style={{
                            fontSize: '0.5rem',
                            color: 'var(--ag-text-muted)',
                            opacity: cell.isCurrentMonth ? 0.8 : 0.3,
                          }}
                        >
                          +{overflow}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t text-xs text-[var(--ag-text-muted)]"
        style={{ borderColor: 'var(--ag-border-subtle)' }}
      >
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 select-none">
            <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: cfg.dot }} />
            <span>{cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 select-none">
          <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: REMINDER_COLOR }} />
          <span>Reminders</span>
        </div>
      </div>
    </div>
  );
}
