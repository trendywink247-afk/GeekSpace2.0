// src/dashboard/pages/office/DigestModal.tsx
// "What did I miss?" modal shown when users return after 2+ hours away.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell } from 'lucide-react';
import { AGENT_META, AGENT_COLORS } from '../constants';
import type { AgentId } from '../entities/types';
import type { OfficeData } from '../state/use-office-data';

const AWAY_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const LAST_ACTIVE_KEY = 'gs_office_last_active';

interface Props {
  officeData: OfficeData | null;
}

/** Tracks page visibility and shows a digest modal when user returns after 2+ hours. */
/** Compute away info outside the component to avoid impure calls during render. */
function computeAwayInfo(): { shouldShow: boolean; duration: string } {
  const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || '0');
  const shown = sessionStorage.getItem('gs_digest_shown');
  const now = Date.now();
  if (lastActive > 0 && !shown && now - lastActive > AWAY_THRESHOLD_MS) {
    const hours = Math.floor((now - lastActive) / 3600000);
    const mins = Math.floor(((now - lastActive) % 3600000) / 60000);
    return { shouldShow: true, duration: hours > 0 ? `${hours}h ${mins}m` : `${mins}m` };
  }
  return { shouldShow: false, duration: '' };
}

export function DigestModal({ officeData }: Props) {
  const [awayInfo] = useState(computeAwayInfo);
  const [show, setShow] = useState(awayInfo.shouldShow);
  const awayDuration = awayInfo.duration;

  useEffect(() => {
    if (awayInfo.shouldShow) {
      sessionStorage.setItem('gs_digest_shown', '1');
    }

    // Update last-active timestamp on visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Mark as active now
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));

    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [awayInfo.shouldShow]);

  // Build agent activity summary from timeline
  const agentSummary = (() => {
    if (!officeData?.timeline) return [];
    const agentActions = new Map<string, number>();
    for (const entry of officeData.timeline) {
      const agentId = (entry as Record<string, unknown>).agentId as string | undefined;
      if (agentId) {
        agentActions.set(agentId, (agentActions.get(agentId) ?? 0) + 1);
      }
    }
    return Array.from(agentActions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        id: id as AgentId,
        meta: AGENT_META[id as AgentId] ?? AGENT_META.weebo,
        color: AGENT_COLORS[id as AgentId] ?? '#A78BFA',
        count,
      }));
  })();

  const tasksCompleted = officeData?.taskStats?.completedToday ?? 0;
  const messagesToday = officeData?.metrics?.messagesToday ?? 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(3,3,12,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShow(false)}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              background: 'rgba(12,12,30,0.95)',
              border: '1px solid rgba(139,92,246,0.15)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.1)',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShow(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-[#6B7280] hover:text-[#9CA3AF] transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div
              className="px-6 pt-6 pb-4"
              style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}
            >
              <h2 className="text-base font-bold text-[var(--ag-text-primary)]">
                While you were away
              </h2>
              <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                {awayDuration} since your last visit
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-4 flex flex-col gap-3">
              {/* Quick stats */}
              <div className="flex gap-3">
                <div
                  className="flex-1 rounded-xl p-3 text-center"
                  style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)' }}
                >
                  <div className="text-xl font-bold text-[var(--ag-cyan)]">{messagesToday}</div>
                  <div className="text-[10px] text-[var(--ag-text-secondary)]">Messages</div>
                </div>
                <div
                  className="flex-1 rounded-xl p-3 text-center"
                  style={{ background: 'rgba(173,255,47,0.06)', border: '1px solid rgba(173,255,47,0.1)' }}
                >
                  <div className="text-xl font-bold text-[var(--ag-lime)]">{tasksCompleted}</div>
                  <div className="text-[10px] text-[var(--ag-text-secondary)]">Tasks Done</div>
                </div>
              </div>

              {/* Agent activity */}
              {agentSummary.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-2">
                    Agent Activity
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {agentSummary.map(({ id, meta, color, count }) => (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: `${color}08`, border: `1px solid ${color}10` }}
                      >
                        <span className="text-sm">{meta.emoji}</span>
                        <span className="text-xs font-medium text-[var(--ag-text-primary)] flex-1">
                          {id.charAt(0).toUpperCase() + id.slice(1)}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color }}>
                          {count} action{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agentSummary.length === 0 && (
                <div className="text-center py-4">
                  <Bell className="w-6 h-6 mx-auto text-[var(--ag-text-muted)] mb-2" />
                  <p className="text-xs text-[var(--ag-text-secondary)]">
                    Things were quiet while you were away
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-2">
              <button
                onClick={() => setShow(false)}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.01]"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  color: 'var(--ag-cyan)',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
