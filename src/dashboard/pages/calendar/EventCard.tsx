// calendar/EventCard.tsx — single expandable event row
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import type { CalendarEvent, EventCategory } from "./helpers";
import { CATEGORY_CONFIG, toMs, formatTime } from "./helpers";

interface EventCardProps {
  ev: CalendarEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}

export function EventCard({ ev, isExpanded, onToggle, onDelete }: EventCardProps) {
  const cat = (ev.category ?? 'personal') as EventCategory;
  const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.personal;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full rounded-lg flex items-start gap-3 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
        style={{
          padding: '10px 12px',
          background: isExpanded ? 'var(--ag-active-bg)' : 'var(--ag-bg-elevated)',
          border: `1px solid ${isExpanded ? 'var(--ag-border-active)' : 'var(--ag-border-subtle)'}`,
          minHeight: 44,
        }}
        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.borderColor = 'var(--ag-border-default)'; }}
        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.borderColor = 'var(--ag-border-subtle)'; }}
      >
        {/* Category colour strip */}
        <span
          className="shrink-0 rounded-full mt-0.5"
          style={{ width: 3, height: 36, background: cfg.dot, minHeight: 36 }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">
              {ev.title}
            </p>
            {ev.isLocal && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
                style={{ background: cfg.bg, color: cfg.text }}
              >
                {cfg.label}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(ev.start_time)}
            {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
          </p>
        </div>

        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 mt-1 transition-transform duration-200"
          style={{ color: 'var(--ag-text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="ml-[19px] mt-1 rounded-lg p-3 space-y-2 text-sm"
              style={{
                background: 'var(--ag-bg-elevated)',
                border: '1px solid var(--ag-border-subtle)',
                borderRadius: 8,
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>Time</span>
                <span className="text-xs text-[var(--ag-text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(ev.start_time)}
                  {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                </span>
              </div>

              {ev.end_time && (
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>Duration</span>
                  <span className="text-xs text-[var(--ag-text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round((toMs(ev.end_time) - toMs(ev.start_time)) / 60000)}m
                  </span>
                </div>
              )}

              {ev.category && (
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>Category</span>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: cfg.bg, color: cfg.text }}
                  >
                    {cfg.label}
                  </span>
                </div>
              )}

              {ev.isLocal && onDelete && (
                <button
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-3 transition-all duration-150 hover:scale-105 active:scale-95"
                  style={{
                    minHeight: 32,
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'transparent',
                  }}
                >
                  <X className="h-3 w-3" />
                  Delete Event
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
