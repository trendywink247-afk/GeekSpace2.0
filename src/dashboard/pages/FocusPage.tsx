// ============================================================
// Focus Page — Full Redesign
// Violet gradient timer ring · Shadow-depth cards · Stagger
// Scale 0.96 on press · Concentric radii · CSS vars only
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { toast } from 'sonner';
import {
  Target, CheckCircle, Plus, Flame, Timer, Play, Bell, BellOff,
  Pause, Trophy, Calendar, TrendingUp, Trash2, Zap, Clock,
} from 'lucide-react';

// ---------- Types ----------

interface FocusSession {
  id: number;
  started_at: number;
  ended_at: number | null;
  duration_min: number | null;
  goal: string | null;
  completed: number;
}

interface Habit {
  id: number;
  name: string;
  icon: string;
  description: string | null;
  frequency: string;
  current_streak: number;
  longest_streak: number;
  logged_today: boolean;
}

interface NotifSettings {
  focus_mode_active: number;
  dnd_start: string;
  dnd_end: string;
  urgent_bypass: number;
  batch_interval_min: number;
}

interface FocusSummary {
  totalSessionsThisWeek: number;
  totalMinutesThisWeek: number;
  avgSessionMin: number;
  longestSessionMin: number;
  totalSessions: number;
}

// ---------- Constants ----------

const DURATIONS = [
  { label: '25m', value: 25, desc: 'Pomodoro' },
  { label: '45m', value: 45, desc: 'Deep work' },
  { label: '60m', value: 60, desc: 'Flow state' },
  { label: '90m', value: 90, desc: 'Ultra focus' },
];

const HABIT_ICONS = ['⭐', '🏃', '📚', '💪', '🧘', '💧', '🎯', '✅', '🔥', '🎨', '🎵', '🥗', '😴', '🧠', '🌅'];

const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: '3x / week', value: 'weekly' },
  { label: 'Weekdays', value: 'weekdays' },
];

const BREAK_TIPS = [
  'Take a 5 min walk outside',
  'Stretch your neck and shoulders',
  'Drink a glass of water',
  'Do 10 deep breaths',
  'Look away from the screen for 20 seconds',
  'Stand up and move around',
  'Do a quick body scan meditation',
  'Grab a healthy snack',
];

// Ring colors — CSS vars for tokens, fallback hex for SVG compat
const RING_COLORS = ['var(--ag-cyan)', 'var(--ag-lime)', 'var(--ag-pink)'];

// Shadow tokens
const SHADOW_CARD = '0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.3)';
const SHADOW_CARD_HOVER = '0 0 0 1px rgba(139,92,246,0.18), 0 6px 20px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.07)';

// ---------- Utilities ----------

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatRelativeDate(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getDayLabel(dayIndex: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex] ?? '';
}

function getRandomBreakTip(): string {
  return BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)];
}

// ---------- Web Worker timer (runs in background tabs) ----------

const TIMER_WORKER_CODE = `
  let intervalId = null;
  let startMs = 0;

  self.onmessage = function(e) {
    if (e.data.type === 'start') {
      startMs = e.data.startMs;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(function() {
        self.postMessage({ type: 'tick', elapsed: Math.floor((Date.now() - startMs) / 1000) });
      }, 1000);
      self.postMessage({ type: 'tick', elapsed: Math.floor((Date.now() - startMs) / 1000) });
    } else if (e.data.type === 'stop') {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }
  };
`;

function createTimerWorker(): Worker | null {
  try {
    const blob = new Blob([TIMER_WORKER_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  } catch (err) {
    console.warn('[Focus] Web Worker creation failed, falling back to main thread timer:', err);
    return null;
  }
}

// ---------- Hooks ----------

function useTimer(startMs: number | null, durationMin: number | null) {
  const [elapsed, setElapsed] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!startMs) {
      setElapsed(0);
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'stop' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }

    const worker = createTimerWorker();
    if (worker) {
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<{ type: string; elapsed: number }>) => {
        if (e.data.type === 'tick') {
          setElapsed(e.data.elapsed);
        }
      };
      worker.postMessage({ type: 'start', startMs });
      return () => {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        workerRef.current = null;
      };
    }

    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  const total = durationMin ? durationMin * 60 : null;
  const remaining = total ? Math.max(0, total - elapsed) : null;
  return { elapsed, remaining, progress: total ? Math.min(100, (elapsed / total) * 100) : 0 };
}

// ---------- Sub-components ----------

/** Timer ring with violet→cyan gradient stroke */
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
        {/* Track */}
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth={strokeWidth} />
        {/* Progress — violet gradient */}
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress / 100)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        {/* Glow layer */}
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
              {/* Background track */}
              <rect x={x} y={0} width={barWidth} height={chartHeight} rx={6}
                fill="rgba(139,92,246,0.05)"
              />
              {/* Data bar */}
              {hasData && (
                <rect
                  x={x} y={y} width={barWidth} height={Math.max(barH, 4)} rx={6}
                  fill={isToday ? 'url(#bar-grad)' : 'var(--ag-violet)'}
                  opacity={isToday ? 1 : 0.45}
                  style={{ transition: 'height 0.4s ease-out, y 0.4s ease-out' }}
                />
              )}
              {/* Minutes label */}
              {hasData && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle"
                  fill="var(--ag-text-secondary)" fontSize="9" fontFamily="monospace"
                >
                  {mins}m
                </text>
              )}
              {/* Day label */}
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
      {/* Outer icon wrapper: rounded-2xl p-3 → inner rounded-xl (concentric) */}
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

function CelebrationPulse() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="w-64 h-64 rounded-full animate-ping" style={{ background: 'rgba(173,255,47,0.08)' }} />
      <div className="absolute w-48 h-48 rounded-full animate-ping" style={{ background: 'rgba(167,139,250,0.08)', animationDelay: '0.15s' }} />
      <div className="absolute w-32 h-32 rounded-full animate-ping" style={{ background: 'rgba(255,45,120,0.08)', animationDelay: '0.3s' }} />
    </div>
  );
}

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

// ---------- Main Component ----------

export function FocusPage() {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'focus' });

  const [session, setSession] = useState<FocusSession | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [deferredCount, setDeferredCount] = useState(0);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [activeTab, setActiveTab] = useState('focus');

  const [showStartModal, setShowStartModal] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);

  const [goalInput, setGoalInput] = useState('');
  const [durInput, setDurInput] = useState(25);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('⭐');
  const [newHabitFreq, setNewHabitFreq] = useState('daily');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [deletingHabitId, setDeletingHabitId] = useState<number | null>(null);

  const { elapsed, remaining, progress } = useTimer(
    session?.started_at ?? null,
    session?.duration_min ?? null,
  );

  // --- Wake Lock ---
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!session) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {/* ignore */});
        wakeLockRef.current = null;
      }
      return;
    }

    async function acquireWakeLock() {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('[Focus] Wake lock unavailable:', err instanceof Error ? err.message : err);
      }
    }
    void acquireWakeLock();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {/* ignore */});
        wakeLockRef.current = null;
      }
    };
  }, [session]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {/* ignore */});
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [sRes, hRes, nsRes, dRes, histRes, sumRes] = await Promise.all([
        api.get('/focus/active'),
        api.get('/habits'),
        api.get('/focus/settings'),
        api.get('/focus/deferred'),
        api.get('/focus/history?limit=20'),
        api.get('/focus/summary'),
      ]);
      setSession((sRes.data as { session: FocusSession | null }).session);
      setHabits((hRes.data as { habits: Habit[] }).habits);
      setSettings((nsRes.data as { settings: NotifSettings }).settings);
      setDeferredCount((dRes.data as { count: number }).count);
      setHistory((histRes.data as { sessions: FocusSession[] }).sessions);
      setSummary((sumRes.data as { summary: FocusSummary }).summary);
    } catch {
      toast.error('Failed to load focus data');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const prevRemaining = useRef<number | null>(null);
  useEffect(() => {
    if (prevRemaining.current !== null && prevRemaining.current > 0 && remaining === 0 && session) {
      if ('Notification' in window && Notification.permission === 'granted') {
        const dur = session.duration_min ?? Math.floor(elapsed / 60);
        new Notification('Focus Session Complete!', {
          body: `Great work! You focused for ${dur} minutes.`,
          icon: '/favicon.ico',
        });
      }
      void handleEndFocus();
      setShowBreakSuggestion(true);
    }
    prevRemaining.current = remaining;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // --- Actions ---

  async function handleStartFocus() {
    setLoading(true);
    try {
      const res = await api.post('/focus/start', { goal: goalInput || null, durationMin: durInput });
      setSession((res.data as { session: FocusSession }).session);
      setShowStartModal(false);
      setGoalInput('');
      setShowBreakSuggestion(false);
      toast.success('Focus session started');
      void notifyDone('Focus session started');
    } catch {
      toast.error('Failed to start focus session');
      void notifyFail('Failed to start focus session');
    }
    setLoading(false);
  }

  async function handleEndFocus() {
    setLoading(true);
    try {
      await api.post('/focus/end', { completed: true });
      setSession(null);
      setShowBreakSuggestion(true);
      void load();
      toast.success('Focus session completed');
      void notifyDone('Focus session completed');
    } catch {
      toast.error('Failed to end focus session');
      void notifyFail('Failed to end focus session');
    }
    setLoading(false);
  }

  async function handleLogHabit(id: number) {
    try {
      await api.post('/habits/' + id + '/log', {});
      setHabits(prev => {
        const updated = prev.map(h =>
          h.id === id ? { ...h, logged_today: true, current_streak: h.current_streak + 1 } : h,
        );
        const allDone = updated.length > 0 && updated.every(h => h.logged_today);
        if (allDone) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 2000);
        }
        return updated;
      });
      toast.success('Habit logged');
      void notifyDone('Habit checked in');
      setTimeout(() => void load(), 600);
    } catch {
      toast.error('Failed to log habit');
      void notifyFail('Failed to log habit');
    }
  }

  async function handleAddHabit() {
    if (!newHabitName.trim()) return;
    setLoading(true);
    try {
      await api.post('/habits', {
        name: newHabitName.trim(),
        icon: newHabitIcon,
        frequency: newHabitFreq,
      });
      setNewHabitName('');
      setNewHabitIcon('⭐');
      setNewHabitFreq('daily');
      setShowAddHabit(false);
      void load();
      toast.success('Habit added');
      void notifyDone('Habit created');
    } catch {
      toast.error('Failed to add habit');
      void notifyFail('Failed to add habit');
    }
    setLoading(false);
  }

  async function handleDeleteHabit(id: number) {
    setDeletingHabitId(id);
    try {
      await api.delete('/habits/' + id);
      void load();
      toast.success('Habit deleted');
      void notifyDone('Habit deleted');
    } catch {
      toast.error('Failed to delete habit');
      void notifyFail('Failed to delete habit');
    }
    setDeletingHabitId(null);
  }

  async function toggleFocusMode() {
    const newVal = settings?.focus_mode_active ? 0 : 1;
    try {
      const res = await api.patch('/focus/settings', { focus_mode_active: newVal });
      setSettings((res.data as { settings: NotifSettings }).settings);
      toast.success(newVal ? 'Focus mode ON' : 'Focus mode OFF');
      void notifyDone(newVal ? 'Focus mode enabled' : 'Focus mode disabled');
    } catch {
      toast.error('Failed to update focus mode');
      void notifyFail('Failed to update focus mode');
    }
  }

  // --- Derived values ---

  const elapsedStr = pad(Math.floor(elapsed / 60)) + ':' + pad(elapsed % 60);
  const remainStr = remaining !== null ? pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60) : '';
  const habitsLoggedToday = habits.filter(h => h.logged_today).length;
  const completedHistory = history.filter(h => h.ended_at !== null);

  const focusStreak = (() => {
    if (completedHistory.length === 0) return 0;
    const sessionDates = new Set(
      completedHistory
        .filter(s => s.completed)
        .map(s => new Date(s.started_at).toISOString().slice(0, 10)),
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const check = new Date(today);
    const todayStr = check.toISOString().slice(0, 10);
    const yest = new Date(check);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    if (!sessionDates.has(todayStr) && !sessionDates.has(yestStr)) return 0;
    if (!sessionDates.has(todayStr)) {
      check.setDate(check.getDate() - 1);
    }
    while (sessionDates.has(check.toISOString().slice(0, 10))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return streak;
  })();

  // --- Loading skeleton ---

  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
          ))}
        </div>
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
      </div>
    );
  }

  return (
    <DashboardPageWrapper>
    <PageShell>
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-6">
      {showCelebration && <CelebrationPulse />}

      {/* ---- Header ---- */}
      <BlurFade delay={0}>
        <PageHeader
          icon={Target}
          title="Focus & Habits"
          subtitle="Coached by Pulse"
          badge={
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--ag-pulse)' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--ag-pulse)' }} />
            </span>
          }
          actions={
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="ghost" size="sm"
                onClick={toggleFocusMode}
                className={`gap-1.5 text-xs min-h-[44px] px-3 rounded-xl transition-all focus-visible:outline-none`}
                style={{
                  background: settings?.focus_mode_active ? 'rgba(167,139,250,0.1)' : 'transparent',
                  color: settings?.focus_mode_active ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                  boxShadow: settings?.focus_mode_active ? '0 0 0 1px rgba(167,139,250,0.2)' : 'none',
                }}
                aria-label={settings?.focus_mode_active ? 'Turn focus mode off' : 'Turn focus mode on'}
              >
                {settings?.focus_mode_active ? <BellOff size={14} /> : <Bell size={14} />}
                {settings?.focus_mode_active ? 'Focus ON' : 'Focus OFF'}
              </Button>
            </motion.div>
          }
        />
      </BlurFade>

      {/* ---- Deferred messages banner ---- */}
      <AnimatePresence>
        {deferredCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
          >
            <SectionCard padding="sm" className="border-[var(--ag-border-default)]">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--ag-text-primary)' }}>
                  <Bell size={14} className="inline mr-1.5" style={{ color: 'var(--ag-cyan)' }} />
                  {deferredCount} message{deferredCount > 1 ? 's' : ''} held during focus
                </span>
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    size="sm" variant="outline"
                    className="text-xs min-h-[44px] rounded-lg"
                    style={{ borderColor: 'var(--ag-border-default)', color: 'var(--ag-cyan)' }}
                    onClick={() => { setDeferredCount(0); void load(); }}
                  >
                    View now
                  </Button>
                </motion.div>
              </div>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Stats Summary — stagger ---- */}
      <BlurFade delay={0.15}>
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {/* Focus Streak */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, duration: 0.4, bounce: 0 } } }}
          >
            <SectionCard padding="sm" className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Flame size={13} className="text-orange-400" />
                <span className="text-xs" style={{ color: 'var(--ag-text-secondary)' }}>Focus streak</span>
              </div>
              {/* Arc ring */}
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
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, duration: 0.4, bounce: 0 } } }}
          >
            <SectionCard padding="sm" className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle size={13} style={{ color: 'var(--ag-lime)' }} />
                <span className="text-xs" style={{ color: 'var(--ag-text-secondary)' }}>Habits today</span>
              </div>
              <p className="text-xl font-bold font-heading" style={{ color: 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {habitsLoggedToday}<span className="text-xs font-normal" style={{ color: 'var(--ag-text-secondary)' }}>/{habits.length}</span>
              </p>
            </SectionCard>
          </motion.div>

          {/* This Week */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, duration: 0.4, bounce: 0 } } }}
          >
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
      </BlurFade>

      {/* ---- Tabs ---- */}
      <BlurFade delay={0.25}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Outer rounded-xl, inner triggers rounded-lg — concentric radii */}
          <TabsList
            className="w-full p-1 h-12 rounded-xl"
            style={{ background: 'var(--ag-bg-surface)', boxShadow: SHADOW_CARD }}
          >
            <TabsTrigger
              value="focus"
              className="flex-1 rounded-lg h-10 text-sm font-medium transition-colors min-h-[44px]"
              style={{ '--tw-text-opacity': '1' } as React.CSSProperties}
            >
              <Timer size={15} className="mr-1.5" />
              Focus Sessions
            </TabsTrigger>
            <TabsTrigger
              value="habits"
              className="flex-1 rounded-lg h-10 text-sm font-medium transition-colors min-h-[44px]"
            >
              <Flame size={15} className="mr-1.5" />
              Daily Habits
            </TabsTrigger>
          </TabsList>

          {/* ======== Focus Sessions Tab ======== */}
          <TabsContent value="focus" className="mt-4 space-y-4">
            {/* Timer card — outer rounded-2xl, inner elements rounded-xl */}
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
                    onClick={handleEndFocus}
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

                  {/* Duration preset cards — outer rounded-xl, inner rounded-lg */}
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
          </TabsContent>

          {/* ======== Daily Habits Tab ======== */}
          <TabsContent value="habits" className="mt-4 space-y-4">
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

            {/* Habit cards header */}
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium font-heading" style={{ color: 'var(--ag-text-secondary)' }}>
                Your habits ({habits.length})
              </h3>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setShowAddHabit(true)}
                  className="min-h-[44px] min-w-[44px] rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                  style={{ color: 'var(--ag-cyan)' }}
                  aria-label="Add habit"
                >
                  <Plus size={16} className="mr-1" />
                  Add
                </Button>
              </motion.div>
            </div>

            {/* Habits list */}
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
                    onClick={() => setShowAddHabit(true)}
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
                      <HabitLogButton habit={h} onLog={handleLogHabit} />
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="min-h-[44px] min-w-[36px] rounded-xl flex items-center justify-center transition-colors
                          focus-visible:ring-2 focus-visible:outline-none"
                        style={{ color: 'rgba(156,163,175,0.3)' }}
                        onClick={() => void handleDeleteHabit(h.id)}
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
          </TabsContent>
        </Tabs>
      </BlurFade>

      {/* ======== Start Focus Modal ======== */}
      <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
        <DialogContent
          className="max-w-[calc(100%-2rem)] sm:max-w-lg rounded-2xl"
          style={{
            background: 'var(--ag-bg-elevated)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.15), 0 24px 48px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            border: 'none',
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2" style={{ color: 'var(--ag-text-primary)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <Play size={16} style={{ color: 'var(--ag-cyan)' }} className="ml-0.5" />
              </div>
              Start Focus Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="focus-goal" className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>
                What are you working on?
              </Label>
              <Input
                id="focus-goal"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="e.g. Write report, Fix bug, Study…"
                className="mt-1.5 h-12 rounded-xl"
                style={{
                  background: 'var(--ag-bg-surface)',
                  borderColor: 'var(--ag-border-subtle)',
                  color: 'var(--ag-text-primary)',
                }}
                onKeyDown={e => { if (e.key === 'Enter') void handleStartFocus(); }}
              />
            </div>
            <div>
              <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Duration</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {DURATIONS.map(d => (
                  <motion.button
                    key={d.value}
                    onClick={() => setDurInput(d.value)}
                    whileTap={{ scale: 0.94 }}
                    className="rounded-xl p-3 text-center transition-all duration-200 focus-visible:outline-none min-h-[44px]"
                    style={{
                      background: durInput === d.value ? 'rgba(139,92,246,0.12)' : 'var(--ag-bg-surface)',
                      color: durInput === d.value ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                      boxShadow: durInput === d.value
                        ? '0 0 0 1px rgba(139,92,246,0.3)'
                        : SHADOW_CARD,
                    }}
                  >
                    <div className="text-base font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-60">{d.desc}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="ghost"
                onClick={() => setShowStartModal(false)}
                className="min-h-[44px] rounded-xl"
                style={{ color: 'var(--ag-text-secondary)' }}
              >
                Cancel
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                onClick={handleStartFocus}
                disabled={loading}
                className="min-h-[44px] px-6 font-semibold rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
                  color: '#0d0d1a',
                  border: 'none',
                }}
              >
                {loading ? 'Starting…' : 'Start'}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Add Habit Modal ======== */}
      <Dialog open={showAddHabit} onOpenChange={setShowAddHabit}>
        <DialogContent
          className="max-w-[calc(100%-2rem)] sm:max-w-lg rounded-2xl"
          style={{
            background: 'var(--ag-bg-elevated)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.15), 0 24px 48px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            border: 'none',
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2" style={{ color: 'var(--ag-text-primary)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <Plus size={16} style={{ color: 'var(--ag-cyan)' }} />
              </div>
              Add Habit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Habit Name</Label>
              <Input
                value={newHabitName}
                onChange={e => setNewHabitName(e.target.value)}
                placeholder="e.g. Morning Workout, Read 30 mins…"
                className="mt-1.5 h-12 rounded-xl"
                style={{
                  background: 'var(--ag-bg-surface)',
                  borderColor: 'var(--ag-border-subtle)',
                  color: 'var(--ag-text-primary)',
                }}
                onKeyDown={e => { if (e.key === 'Enter') void handleAddHabit(); }}
              />
            </div>

            <div>
              <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Icon</Label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {HABIT_ICONS.map(ic => (
                  <motion.button
                    key={ic}
                    onClick={() => setNewHabitIcon(ic)}
                    whileTap={{ scale: 0.9 }}
                    className="text-xl p-2 rounded-xl transition-all min-h-[44px] min-w-[44px]
                      flex items-center justify-center focus-visible:outline-none"
                    style={{
                      background: newHabitIcon === ic ? 'rgba(139,92,246,0.12)' : 'transparent',
                      boxShadow: newHabitIcon === ic ? '0 0 0 1px rgba(139,92,246,0.3)' : 'none',
                      transform: newHabitIcon === ic ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {ic}
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Frequency</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {FREQUENCY_OPTIONS.map(f => (
                  <motion.button
                    key={f.value}
                    onClick={() => setNewHabitFreq(f.value)}
                    whileTap={{ scale: 0.94 }}
                    className="rounded-xl p-3 text-center text-sm transition-all duration-200
                      focus-visible:outline-none min-h-[44px] font-medium"
                    style={{
                      background: newHabitFreq === f.value ? 'rgba(139,92,246,0.12)' : 'var(--ag-bg-surface)',
                      color: newHabitFreq === f.value ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                      boxShadow: newHabitFreq === f.value
                        ? '0 0 0 1px rgba(139,92,246,0.3)'
                        : SHADOW_CARD,
                    }}
                  >
                    {f.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="ghost"
                onClick={() => setShowAddHabit(false)}
                className="min-h-[44px] rounded-xl"
                style={{ color: 'var(--ag-text-secondary)' }}
              >
                Cancel
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                onClick={handleAddHabit}
                className="min-h-[44px] px-6 font-semibold rounded-xl"
                disabled={!newHabitName.trim() || loading}
                style={{
                  background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
                  color: '#0d0d1a',
                  border: 'none',
                }}
              >
                {loading ? 'Adding…' : 'Add Habit'}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
