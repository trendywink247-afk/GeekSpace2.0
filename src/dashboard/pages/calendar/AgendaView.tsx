// calendar/AgendaView.tsx — selected-day detail panel with events + reminders
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Bell, CalendarDays } from "lucide-react";
import { DateTime } from 'luxon';
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent, ReminderItem } from "./helpers";
import { dateKey, isSameDay, formatTime, toMs } from "./helpers";
import { EventCard } from "./EventCard";

const panelVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, duration: 0.4, bounce: 0 } },
  exit:    { opacity: 0, y: 8,  transition: { duration: 0.18 } },
};

interface AgendaViewProps {
  selectedDate: Date;
  today: Date;
  selectedDayEvents: CalendarEvent[];
  selectedDayReminders: ReminderItem[];
  expandedEventId: string | number | null;
  onToggleExpand: (id: string | number) => void;
  onDeleteLocalEvent: (id: string | number) => void;
  onOpenAddEvent: (dateStr: string) => void;
}

export function AgendaView({
  selectedDate,
  today,
  selectedDayEvents,
  selectedDayReminders,
  expandedEventId,
  onToggleExpand,
  onDeleteLocalEvent,
  onOpenAddEvent,
}: AgendaViewProps) {
  const totalItems = selectedDayEvents.length + selectedDayReminders.length;
  const isToday    = isSameDay(selectedDate, today);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={dateKey(selectedDate)}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--ag-bg-surface)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 0 1px var(--ag-border-subtle), 0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 border-b"
            style={{ borderColor: 'var(--ag-border-subtle)' }}
          >
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.1)' }}
            >
              <Clock className="h-4 w-4 text-[var(--ag-violet)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] text-sm">
                {isToday
                  ? "Today"
                  : DateTime.fromJSDate(selectedDate).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <p className="text-xs text-[var(--ag-text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {DateTime.fromJSDate(selectedDate).toLocaleString({ year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
            {totalItems > 0 && (
              <Badge
                variant="secondary"
                className="text-xs font-medium"
                style={{
                  background: 'rgba(139,92,246,0.12)',
                  color: 'var(--ag-violet)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}
              >
                {totalItems}
              </Badge>
            )}
          </div>

          {/* Panel body */}
          <div className="p-3">
            {totalItems === 0 ? (
              <div className="py-8 flex flex-col items-center gap-3 text-center">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 48, height: 48, background: 'var(--ag-bg-elevated)' }}
                >
                  <CalendarDays className="h-5 w-5 text-[var(--ag-text-muted)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--ag-text-secondary)]">Nothing scheduled</p>
                  <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">Free day — no events or reminders.</p>
                </div>
                <button
                  onClick={() => onOpenAddEvent(dateKey(selectedDate))}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 transition-all duration-150 hover:scale-105 active:scale-95"
                  style={{
                    minHeight: 36,
                    border: '1px solid var(--ag-border-default)',
                    color: 'var(--ag-text-secondary)',
                    background: 'var(--ag-bg-elevated)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Event
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Events */}
                {selectedDayEvents
                  .sort((a, b) => toMs(a.start_time) - toMs(b.start_time))
                  .map((ev) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      isExpanded={expandedEventId === ev.id}
                      onToggle={() => onToggleExpand(ev.id)}
                      onDelete={ev.isLocal ? () => onDeleteLocalEvent(ev.id) : undefined}
                    />
                  ))}

                {/* Reminders */}
                {selectedDayReminders.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg flex items-start gap-3"
                    style={{
                      padding: '10px 12px',
                      background: 'var(--ag-bg-elevated)',
                      border: '1px solid var(--ag-border-subtle)',
                      minHeight: 44,
                    }}
                  >
                    <span
                      className="shrink-0 rounded-full mt-0.5"
                      style={{ width: 3, height: 36, background: 'var(--ag-amber)', minHeight: 36 }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">
                        {r.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                          {r.datetime ? formatTime(new Date(r.datetime).getTime()) : "All day"}
                        </p>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--ag-amber)' }}
                        >
                          <Bell className="h-2.5 w-2.5" />
                          Reminder
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
