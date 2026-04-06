// ============================================================
// FocusStatsGrid — 3-col summary (streak · habits today · week)
// ============================================================

import { motion } from 'framer-motion';
import { SectionCard } from '@/components/agentin';
import { Flame, CheckCircle, Clock } from 'lucide-react';
import { type FocusSummary, formatDuration } from './helpers';

export interface FocusStatsGridProps {
  focusStreak: number;
  habitsLoggedToday: number;
  habitsTotal: number;
  summary: FocusSummary | null;
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, duration: 0.4, bounce: 0 } },
};

export function FocusStatsGrid({ focusStreak, habitsLoggedToday, habitsTotal, summary }: FocusStatsGridProps) {
  return (
    <motion.div
      className="grid grid-cols-3 gap-3"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* Focus Streak */}
      <motion.div variants={CARD_VARIANTS}>
        <SectionCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame size={13} className="text-orange-400" />
            <span className="text-xs" style={{ color: 'var(--ag-text-secondary)' }}>Focus streak</span>
          </div>
          <div className="relative w-16 h-16 mx-auto">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <defs>
                <linearGradient id="streak-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--ag-violet)" />
                  <stop offset="100%" stopColor="var(--ag-cyan)" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke="url(#streak-grad)"
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${Math.min(focusStreak / 7, 1) * 175.9} 175.9`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xl font-bold font-heading" style={{ color: 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {focusStreak}<span className="text-[9px] font-normal" style={{ color: 'var(--ag-text-secondary)' }}>d</span>
              </p>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* Habits Today */}
      <motion.div variants={CARD_VARIANTS}>
        <SectionCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle size={13} style={{ color: 'var(--ag-lime)' }} />
            <span className="text-xs" style={{ color: 'var(--ag-text-secondary)' }}>Habits today</span>
          </div>
          <p className="text-xl font-bold font-heading" style={{ color: 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {habitsLoggedToday}<span className="text-xs font-normal" style={{ color: 'var(--ag-text-secondary)' }}>/{habitsTotal}</span>
          </p>
        </SectionCard>
      </motion.div>

      {/* This Week */}
      <motion.div variants={CARD_VARIANTS}>
        <SectionCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock size={13} style={{ color: 'var(--ag-cyan)' }} />
            <span className="text-xs" style={{ color: 'var(--ag-text-secondary)' }}>This week</span>
          </div>
          <p className="text-xl font-bold font-heading" style={{ color: 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {summary ? formatDuration(summary.totalMinutesThisWeek) : '0m'}
          </p>
        </SectionCard>
      </motion.div>
    </motion.div>
  );
}
