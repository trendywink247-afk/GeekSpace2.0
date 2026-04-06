// ─── EventsFeed — recent integration events + privacy note ───────────────────
import { motion } from 'framer-motion';
import { Activity, Shield } from 'lucide-react';
import { SHADOW, fadeUp, timeAgo } from './helpers';

interface IntegrationEvent {
  id: string;
  action: string;
  details: string;
  icon: string;
  created_at: string;
}

interface EventsFeedProps {
  events: IntegrationEvent[];
  /** Used to stagger the animation delay after the grid cards. */
  cardCount: number;
}

export function EventsFeed({ events, cardCount }: EventsFeedProps) {
  return (
    <>
      {/* ── Recent events ── */}
      {events.length > 0 && (
        <motion.div custom={cardCount + 7} variants={fadeUp} initial="hidden" animate="show">
          <div className="rounded-2xl p-5 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: SHADOW.card }}>
            <h4 className="text-sm font-heading font-medium text-[var(--ag-text-primary)] mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--ag-violet)]" />
              Recent Integration Events
            </h4>
            <div className="space-y-2.5">
              {events.slice(0, 5).map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="flex items-center gap-3 text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--ag-text-accent)' }} />
                  <span className="text-[var(--ag-text-primary)] flex-1 truncate">{ev.action}</span>
                  {ev.details && (
                    <span className="text-[var(--ag-text-secondary)] truncate max-w-[100px]">{ev.details}</span>
                  )}
                  <span className="text-[var(--ag-text-muted)] shrink-0 tabular-nums">{timeAgo(ev.created_at)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Privacy note ── */}
      <motion.div custom={cardCount + 8} variants={fadeUp} initial="hidden" animate="show">
        <div className="rounded-2xl p-5 bg-[var(--ag-bg-surface)] backdrop-blur-xl" style={{ boxShadow: SHADOW.card }}>
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(16,185,129,0.1)' }}
            >
              <Shield className="w-4 h-4 text-[var(--ag-green)]" />
            </div>
            <div>
              <h4 className="text-sm font-heading font-medium text-[var(--ag-text-primary)] mb-1">Privacy First</h4>
              <p className="text-xs text-[var(--ag-text-secondary)] text-wrap-pretty">
                Your data is encrypted and never shared. You can disconnect any service at any time.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
