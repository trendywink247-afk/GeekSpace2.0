import { ArrowRight, CalendarDays } from 'lucide-react';
import type { OverviewCalendarEvent } from './helpers';

interface CalendarSectionProps {
  events: OverviewCalendarEvent[];
  onNavigate?: (page: string) => void;
}

export function CalendarSection({ events, onNavigate }: CalendarSectionProps) {
  if (events.length === 0) return null;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider font-heading">
          Calendar Today
        </h2>
        <button
          onClick={() => onNavigate?.('calendar')}
          className="flex items-center gap-1 text-xs text-[var(--ag-text-secondary)] hover:text-[var(--ag-cyan)] transition-colors"
        >
          Full calendar <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="rounded-xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-xl overflow-hidden">
        <div className="divide-y divide-[var(--ag-border-subtle)]">
          {events.slice(0, 4).map((evt) => {
            const startDate = new Date(evt.start_time);
            const endDate = evt.end_time ? new Date(evt.end_time) : null;
            const isCurrent = evt.start_time <= now && (evt.end_time ? evt.end_time >= now : true);
            return (
              <div
                key={evt.id}
                className={`p-4 flex items-center gap-3 ${isCurrent ? 'bg-[var(--ag-cyan)]/[0.04] border-l-2 border-l-[var(--ag-cyan)]' : ''}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isCurrent ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)' }}
                >
                  <CalendarDays
                    className="w-4 h-4"
                    style={{ color: isCurrent ? 'var(--ag-cyan)' : 'var(--ag-violet)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--ag-text-primary)] truncate">{evt.title}</p>
                  <span className="text-xs text-[var(--ag-text-secondary)]">
                    {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {endDate ? ` - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                  </span>
                </div>
                {isCurrent && (
                  <span className="text-xs font-medium text-[var(--ag-cyan)] bg-[var(--ag-cyan)]/10 px-2 py-0.5 rounded-full">
                    NOW
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
