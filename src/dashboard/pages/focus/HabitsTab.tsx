// ============================================================
// HabitsTab — habit list, streak display, log buttons
// ============================================================

import { useState } from 'react';
import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, Plus, Flame, Trophy, Trash2,
} from 'lucide-react';
import {
  type Habit,
  RING_COLORS,
  SHADOW_CARD,
  SHADOW_CARD_HOVER,
} from './helpers';

// ---------- HabitCompletionRings ----------

function HabitCompletionRings({ habits }: { habits: Habit[] }) {
  const topThree = habits.slice(0, 3);
  if (topThree.length === 0) return null;

  const sizes = [140, 108, 76];
  const strokeWidths = [8, 7, 6];

  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: 160, height: 160 }}>
      {topThree.map((h, i) => {
        const r = (sizes[i] - strokeWidths[i] * 2) / 2;
        const circ = 2 * Math.PI * r;
        const progress = h.logged_today ? 100 : 0;
        const center = 80;
        return (
          <svg key={h.id} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 160 160">
            <circle
              cx={center} cy={center} r={r} fill="none"
              stroke={RING_COLORS[i]} strokeWidth={strokeWidths[i]}
              opacity={0.15}
            />
            <circle
              cx={center} cy={center} r={r} fill="none"
              stroke={RING_COLORS[i]} strokeWidth={strokeWidths[i]}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
            />
          </svg>
        );
      })}
      <div className="relative z-10 text-center">
        <div className="text-lg font-bold font-heading" style={{ color: 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {topThree.filter(h => h.logged_today).length}/{topThree.length}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--ag-text-secondary)' }}>done</div>
      </div>
    </div>
  );
}

// ---------- HabitLogButton ----------

function HabitLogButton({ habit, onLog }: { habit: Habit; onLog: (id: number) => void }) {
  const [animating, setAnimating] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  function handleClick() {
    if (habit.logged_today || animating) return;
    setAnimating(true);
    onLog(habit.id);
    setTimeout(() => {
      setJustLogged(true);
      setAnimating(false);
    }, 400);
  }

  const isComplete = habit.logged_today || justLogged;

  return (
    <motion.button
      onClick={handleClick}
      disabled={isComplete}
      whileTap={isComplete ? {} : { scale: 0.96 }}
      className={`
        min-h-[44px] min-w-[44px] px-4 rounded-xl flex items-center justify-center gap-2
        font-medium text-sm transition-all duration-300
        focus-visible:ring-2 focus-visible:outline-none
        ${isComplete ? 'cursor-default' : ''}
        ${animating ? 'scale-105' : ''}
      `}
      style={{
        background: isComplete ? 'rgba(173,255,47,0.12)' : 'rgba(167,139,250,0.1)',
        color: isComplete ? 'var(--ag-lime)' : 'var(--ag-cyan)',
        focusVisibleOutlineColor: 'var(--ag-cyan)',
      } as React.CSSProperties}
      aria-label={`Log ${habit.name}`}
    >
      <CheckCircle
        size={18}
        className={`transition-all duration-300 ${isComplete ? 'scale-110' : ''} ${animating ? 'animate-spin' : ''}`}
      />
      {isComplete ? 'Done' : 'Log'}
    </motion.button>
  );
}

// ---------- HabitsTab props ----------

export interface HabitsTabProps {
  habits: Habit[];
  habitsLoggedToday: number;
  deletingHabitId: number | null;
  onLogHabit: (id: number) => Promise<void>;
  onDeleteHabit: (id: number) => Promise<void>;
  onAddHabit: () => void;
}

// ---------- HabitsTab ----------

export function HabitsTab({
  habits,
  habitsLoggedToday,
  deletingHabitId,
  onLogHabit,
  onDeleteHabit,
  onAddHabit,
}: HabitsTabProps) {
  return (
    <div className="space-y-4">
      {/* Completion rings */}
      {habits.length > 0 && (
        <SectionCard>
          <div className="flex items-center gap-6">
            <HabitCompletionRings habits={habits} />
            <div className="flex-1 space-y-2">
              {habits.slice(0, 3).map((h, i) => (
                <div key={h.id} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RING_COLORS[i] }} />
                  <span className="text-xs truncate" style={{ color: 'var(--ag-text-primary)' }}>{h.icon} {h.name}</span>
                  {h.logged_today && (
                    <CheckCircle size={12} className="flex-shrink-0 ml-auto" style={{ color: 'var(--ag-lime)' }} />
                  )}
                </div>
              ))}
              {habits.length > 3 && (
                <p className="text-[10px] pl-4" style={{ color: 'var(--ag-text-secondary)' }}>
                  +{habits.length - 3} more habit{habits.length - 3 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium font-heading" style={{ color: 'var(--ag-text-secondary)' }}>
          Your habits ({habits.length})
        </h3>
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            size="sm" variant="ghost"
            onClick={onAddHabit}
            className="min-h-[44px] min-w-[44px] rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            style={{ color: 'var(--ag-cyan)' }}
            aria-label="Add habit"
          >
            <Plus size={16} className="mr-1" />
            Add
          </Button>
        </motion.div>
      </div>

      {/* Habits list / empty state */}
      {habits.length === 0 ? (
        <motion.div
          className="text-center py-12 space-y-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: 'var(--ag-bg-surface)', boxShadow: SHADOW_CARD }}
          >
            <Flame size={28} style={{ color: 'rgba(139,92,246,0.25)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>No habits yet</p>
          <p className="text-xs opacity-60" style={{ color: 'var(--ag-text-secondary)' }}>
            Add your first habit to start building streaks.
          </p>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              size="sm"
              onClick={onAddHabit}
              className="min-h-[44px] mt-2 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))', color: '#0d0d1a', border: 'none' }}
            >
              <Plus size={16} className="mr-1" />
              Add Habit
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-2"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {habits.map(h => (
            <motion.div
              key={h.id}
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, duration: 0.35, bounce: 0 } } }}
              className="flex items-center justify-between p-3.5 rounded-2xl backdrop-blur-xl transition-all duration-300"
              style={{
                background: 'var(--ag-bg-surface)',
                boxShadow: h.logged_today
                  ? '0 0 0 1px rgba(173,255,47,0.12), 0 2px 8px rgba(0,0,0,0.3)'
                  : SHADOW_CARD,
                opacity: deletingHabitId === h.id ? 0.5 : 1,
                scale: deletingHabitId === h.id ? 0.97 : 1,
              }}
              whileHover={{ boxShadow: SHADOW_CARD_HOVER } as TargetAndTransition}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-2xl flex-shrink-0">{h.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: h.logged_today ? 'var(--ag-lime)' : 'var(--ag-text-primary)' }}>
                    {h.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      <Flame size={10} className="text-orange-400" />
                      {h.current_streak}d
                    </span>
                    <span className="text-[10px] opacity-40" style={{ color: 'var(--ag-text-secondary)' }}>|</span>
                    <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      <Trophy size={10} className="opacity-50" />
                      Best: {h.longest_streak}d
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4"
                      style={{ borderColor: 'var(--ag-border-subtle)', color: 'var(--ag-text-muted)' }}
                    >
                      {h.frequency}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <HabitLogButton habit={h} onLog={onLogHabit} />
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="min-h-[44px] min-w-[36px] rounded-xl flex items-center justify-center transition-colors
                    focus-visible:ring-2 focus-visible:outline-none"
                  style={{ color: 'rgba(156,163,175,0.3)' }}
                  onClick={() => void onDeleteHabit(h.id)}
                  disabled={deletingHabitId === h.id}
                  aria-label={`Delete ${h.name}`}
                  onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(156,163,175,0.3)')}
                >
                  <Trash2 size={14} />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* All done celebration */}
      <AnimatePresence>
        {habits.length > 0 && habitsLoggedToday === habits.length && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className="rounded-2xl p-5 text-center"
            style={{
              background: 'var(--ag-bg-surface)',
              boxShadow: '0 0 0 1px rgba(173,255,47,0.15), 0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <Trophy size={28} className="mx-auto mb-2" style={{ color: 'var(--ag-lime)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--ag-text-primary)' }}>All habits logged today!</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ag-text-secondary)' }}>You are on fire. Keep this momentum going.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
