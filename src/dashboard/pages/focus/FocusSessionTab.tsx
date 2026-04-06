// ============================================================
// FocusSessionTab — timer display, history, break suggestion
// ============================================================

import { useState } from 'react';
import { motion, type TargetAndTransition } from 'framer-motion';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Target, Calendar, TrendingUp, Timer, Play, Pause, Zap,
} from 'lucide-react';
import {
  type FocusSession,
  DURATIONS,
  RING_COLORS,
  SHADOW_CARD,
  SHADOW_CARD_HOVER,
  pad,
  formatDuration,
  formatRelativeDate,
  getDayLabel,
  getRandomBreakTip,
} from './helpers';

// ---------- TimerRing ----------

function TimerRing({ progress, size = 220, strokeWidth = 10, children }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const center = size / 2;
  const gradId = `timer-grad-${size}`;
  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: size, height: size }}>
      <svg className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--ag-violet)" />
            <stop offset="100%" stopColor="var(--ag-cyan)" />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress / 100)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke="var(--ag-violet)"
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress / 100)}
          opacity={0.14}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: 'blur(8px)' }}
        />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}

// ---------- WeeklyFocusChart ----------

function WeeklyFocusChart({ sessions }: { sessions: FocusSession[] }) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const dailyMinutes: number[] = Array(7).fill(0);
  for (const s of sessions) {
    if (!s.ended_at || !s.duration_min) continue;
    const sessionDate = new Date(s.started_at);
    const diffDays = Math.floor((sessionDate.getTime() - monday.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < 7) {
      dailyMinutes[diffDays] += s.duration_min;
    }
  }

  const maxMin = Math.max(...dailyMinutes, 30);
  const barWidth = 28;
  const chartHeight = 100;
  const chartWidth = barWidth * 7 + 6 * 8;
  const gap = 8;
  const todayIndex = mondayOffset;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
        className="w-full max-w-[320px] mx-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="bar-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--ag-cyan)" />
            <stop offset="100%" stopColor="var(--ag-violet)" />
          </linearGradient>
        </defs>
        {dailyMinutes.map((mins, i) => {
          const barH = maxMin > 0 ? (mins / maxMin) * chartHeight : 0;
          const x = i * (barWidth + gap);
          const y = chartHeight - barH;
          const isToday = i === todayIndex;
          const hasData = mins > 0;
          return (
            <g key={i}>
              <rect x={x} y={0} width={barWidth} height={chartHeight} rx={6}
                fill="rgba(139,92,246,0.05)"
              />
              {hasData && (
                <rect
                  x={x} y={y} width={barWidth} height={Math.max(barH, 4)} rx={6}
                  fill={isToday ? 'url(#bar-grad)' : 'var(--ag-violet)'}
                  opacity={isToday ? 1 : 0.45}
                  style={{ transition: 'height 0.4s ease-out, y 0.4s ease-out' }}
                />
              )}
              {hasData && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle"
                  fill="var(--ag-text-secondary)" fontSize="9" fontFamily="monospace"
                >
                  {mins}m
                </text>
              )}
              <text
                x={x + barWidth / 2} y={chartHeight + 16}
                textAnchor="middle"
                fill={isToday ? 'var(--ag-cyan)' : 'var(--ag-text-muted)'}
                fontSize="10"
                fontWeight={isToday ? 'bold' : 'normal'}
                fontFamily="inherit"
              >
                {getDayLabel(i)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- SessionHistoryItem ----------

function SessionHistoryItem({ session }: { session: FocusSession }) {
  return (
    <motion.div
      className="flex items-center justify-between py-2.5 px-3 rounded-xl backdrop-blur-xl"
      style={{
        background: 'var(--ag-bg-surface)',
        boxShadow: SHADOW_CARD,
        transition: 'box-shadow var(--ag-transition-fast)',
      }}
      whileHover={{ boxShadow: SHADOW_CARD_HOVER } as TargetAndTransition}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: session.completed ? 'var(--ag-lime)' : 'var(--ag-pink)' }} />
        <div className="min-w-0">
          <p className="text-sm truncate" style={{ color: 'var(--ag-text-primary)' }}>
            {session.goal || 'Focus session'}
          </p>
          <p className="text-xs" style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatRelativeDate(session.started_at)}
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className="text-xs flex-shrink-0 ml-2"
        style={{ borderColor: 'var(--ag-border-subtle)', color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}
      >
        {session.duration_min ? formatDuration(session.duration_min) : '--'}
      </Badge>
    </motion.div>
  );
}

// ---------- BreakSuggestion ----------

function BreakSuggestion({ onDismiss }: { onDismiss: () => void }) {
  const [tip] = useState(getRandomBreakTip);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
      className="backdrop-blur-xl rounded-2xl p-5 text-center space-y-3"
      style={{
        background: 'var(--ag-bg-surface)',
        boxShadow: '0 0 0 1px rgba(173,255,47,0.15), 0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: 'rgba(173,255,47,0.1)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(173,255,47,0.08)' }}>
          <Zap size={20} style={{ color: 'var(--ag-lime)' }} />
        </div>
      </div>
      <p className="text-sm font-medium font-heading" style={{ color: 'var(--ag-text-primary)' }}>Session complete!</p>
      <p className="text-sm" style={{ color: 'var(--ag-text-secondary)', textWrap: 'pretty' } as React.CSSProperties}>{tip}</p>
      <motion.div whileTap={{ scale: 0.96 }}>
        <Button
          size="sm" variant="ghost"
          onClick={onDismiss}
          className="min-h-[44px]"
          style={{ color: 'var(--ag-cyan)' }}
        >
          Got it
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ---------- CelebrationPulse ----------

export function CelebrationPulse() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="w-64 h-64 rounded-full animate-ping" style={{ background: 'rgba(173,255,47,0.08)' }} />
      <div className="absolute w-48 h-48 rounded-full animate-ping" style={{ background: 'rgba(167,139,250,0.08)', animationDelay: '0.15s' }} />
      <div className="absolute w-32 h-32 rounded-full animate-ping" style={{ background: 'rgba(255,45,120,0.08)', animationDelay: '0.3s' }} />
    </div>
  );
}

// ---------- FocusSessionTab props ----------

export interface FocusSessionTabProps {
  session: FocusSession | null;
  showBreakSuggestion: boolean;
  setShowBreakSuggestion: (v: boolean) => void;
  progress: number;
  remaining: number | null;
  remainStr: string;
  elapsedStr: string;
  durInput: number;
  setDurInput: (v: number) => void;
  setShowStartModal: (v: boolean) => void;
  onEndFocus: () => Promise<void>;
  loading: boolean;
  history: FocusSession[];
  completedHistory: FocusSession[];
}

// ---------- FocusSessionTab ----------

export function FocusSessionTab({
  session,
  showBreakSuggestion,
  setShowBreakSuggestion,
  progress,
  remaining,
  remainStr,
  elapsedStr,
  durInput,
  setDurInput,
  setShowStartModal,
  onEndFocus,
  loading,
  history,
  completedHistory,
}: FocusSessionTabProps) {
  return (
    <div className="space-y-4">
      {/* Timer card */}
      <motion.div
        className="rounded-2xl backdrop-blur-xl p-6"
        style={{ background: 'var(--ag-bg-surface)', boxShadow: SHADOW_CARD }}
        layout
      >
        {session ? (
          <div className="space-y-5">
            <TimerRing progress={progress} size={240} strokeWidth={11}>
              <div
                className="text-4xl font-mono font-bold tracking-wider"
                style={{ color: 'var(--ag-cyan)', fontVariantNumeric: 'tabular-nums' }}
              >
                {remaining !== null ? remainStr : elapsedStr}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ag-text-secondary)' }}>
                {remaining !== null ? 'remaining' : 'elapsed'}
              </div>
            </TimerRing>
            {session.goal && (
              <p className="text-center text-sm" style={{ color: 'var(--ag-text-secondary)' }}>
                <Target size={12} className="inline mr-1" style={{ color: 'var(--ag-cyan)' }} />
                {session.goal}
              </p>
            )}
            <div className="text-center text-xs" style={{ color: 'var(--ag-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {session.duration_min ? `${session.duration_min} min session` : 'Open session'}
            </div>
            <motion.button
              onClick={onEndFocus}
              disabled={loading}
              whileTap={{ scale: 0.96 }}
              className="w-full h-14 px-8 rounded-xl text-white font-semibold
                flex items-center justify-center gap-2
                focus-visible:ring-2 focus-visible:outline-none
                disabled:opacity-50 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(220,38,38,0.8))',
                boxShadow: '0 0 0 1px rgba(239,68,68,0.2), 0 4px 12px rgba(239,68,68,0.2)',
              }}
            >
              <Pause size={18} />
              End Session
            </motion.button>
          </div>
        ) : showBreakSuggestion ? (
          <BreakSuggestion onDismiss={() => setShowBreakSuggestion(false)} />
        ) : (
          <div className="text-center space-y-5 py-2">
            <TimerRing progress={0} size={200} strokeWidth={9}>
              <div
                className="text-3xl font-mono font-bold"
                style={{ color: 'rgba(167,139,250,0.3)', fontVariantNumeric: 'tabular-nums' }}
              >
                {pad(durInput)}:00
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--ag-text-muted)' }}>ready</div>
            </TimerRing>

            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map(d => (
                <motion.button
                  key={d.value}
                  onClick={() => setDurInput(d.value)}
                  whileTap={{ scale: 0.94 }}
                  className="rounded-xl p-2.5 text-center transition-all duration-200
                    focus-visible:ring-2 focus-visible:outline-none min-h-[44px]"
                  style={{
                    background: durInput === d.value ? 'rgba(139,92,246,0.12)' : 'var(--ag-bg-surface)',
                    color: durInput === d.value ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                    boxShadow: durInput === d.value
                      ? '0 0 0 1px rgba(139,92,246,0.3), 0 0 12px rgba(139,92,246,0.1)'
                      : SHADOW_CARD,
                  }}
                >
                  <div className="text-lg font-bold font-heading">{d.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{d.desc}</div>
                </motion.button>
              ))}
            </div>

            <motion.button
              onClick={() => setShowStartModal(true)}
              whileTap={{ scale: 0.96 }}
              className="h-14 px-10 rounded-xl text-base font-semibold
                focus-visible:ring-2 focus-visible:outline-none
                flex items-center justify-center gap-2 mx-auto"
              style={{
                background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
                color: '#0d0d1a',
                boxShadow: '0 0 0 1px rgba(139,92,246,0.3), 0 4px 16px rgba(139,92,246,0.3)',
              }}
            >
              <Play size={18} className="ml-0.5" />
              Start Focus
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Weekly chart */}
      {completedHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', duration: 0.4, bounce: 0 }}
        >
          <SectionCard>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} style={{ color: 'var(--ag-cyan)' }} />
              <span className="text-sm font-semibold font-heading" style={{ color: 'var(--ag-text-primary)' }}>This week</span>
            </div>
            <WeeklyFocusChart sessions={history} />
          </SectionCard>
        </motion.div>
      )}

      {/* Session history */}
      {completedHistory.length > 0 && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', duration: 0.4, bounce: 0 }}
        >
          <h3 className="text-sm font-medium flex items-center gap-2 px-1 font-heading" style={{ color: 'var(--ag-text-secondary)' }}>
            <Calendar size={14} />
            Recent sessions
          </h3>
          <div className="space-y-1.5">
            {completedHistory.slice(0, 5).map((s, idx) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, type: 'spring', duration: 0.35, bounce: 0 }}
              >
                <SessionHistoryItem session={s} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {completedHistory.length === 0 && !session && (
        <motion.div
          className="text-center py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(139,92,246,0.07)' }}>
            <Timer size={28} style={{ color: 'rgba(139,92,246,0.3)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>No focus sessions yet.</p>
          <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--ag-text-secondary)' }}>Start one to begin tracking your deep work.</p>
        </motion.div>
      )}
    </div>
  );
}

// Re-export RING_COLORS so FocusPage sub-components can import from a single place
export { RING_COLORS };
