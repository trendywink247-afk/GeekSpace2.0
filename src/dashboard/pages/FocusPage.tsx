import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const RING_COLORS = ['#00F0FF', '#ADFF2F', '#FF2D78'];

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

// ---------- Hooks ----------

function useTimer(startMs: number | null, durationMin: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startMs) { setElapsed(0); return; }
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

function TimerRing({ progress, size = 220, strokeWidth = 10, color = '#00F0FF', children }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children: React.ReactNode;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const center = size / 2;
  return (
    <div className="relative flex items-center justify-center mx-auto" style={{ width: size, height: size }}>
      <svg className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="#0C0C18" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress / 100)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
        {/* Glow effect */}
        <circle
          cx={center} cy={center} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress / 100)}
          opacity={0.15}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: 'blur(6px)' }}
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
        <div className="text-lg font-bold text-[#F4F6FF]">
          {topThree.filter(h => h.logged_today).length}/{topThree.length}
        </div>
        <div className="text-[10px] text-[#8892A4]">done</div>
      </div>
    </div>
  );
}

function WeeklyFocusChart({ sessions }: { sessions: FocusSession[] }) {
  // Build Mon-Sun data for current week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
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

  const maxMin = Math.max(...dailyMinutes, 30); // At least 30 for scale
  const barWidth = 28;
  const chartHeight = 100;
  const chartWidth = barWidth * 7 + 6 * 8; // 7 bars + 6 gaps of 8px
  const gap = 8;
  const todayIndex = mondayOffset;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`} className="w-full max-w-[320px] mx-auto" preserveAspectRatio="xMidYMid meet">
        {dailyMinutes.map((mins, i) => {
          const barH = maxMin > 0 ? (mins / maxMin) * chartHeight : 0;
          const x = i * (barWidth + gap);
          const y = chartHeight - barH;
          const isToday = i === todayIndex;
          const hasData = mins > 0;
          return (
            <g key={i}>
              {/* Background bar */}
              <rect x={x} y={0} width={barWidth} height={chartHeight} rx={6} fill="#0C0C18" />
              {/* Data bar */}
              {hasData && (
                <rect
                  x={x} y={y} width={barWidth} height={Math.max(barH, 4)} rx={6}
                  fill={isToday ? '#00F0FF' : '#00F0FF'}
                  opacity={isToday ? 1 : 0.5}
                  style={{ transition: 'height 0.4s ease-out, y 0.4s ease-out' }}
                />
              )}
              {/* Minutes label on hover area */}
              {hasData && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fill="#8892A4" fontSize="9" fontFamily="monospace">
                  {mins}m
                </text>
              )}
              {/* Day label */}
              <text
                x={x + barWidth / 2} y={chartHeight + 16}
                textAnchor="middle"
                fill={isToday ? '#00F0FF' : '#8892A4'}
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
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.completed ? 'bg-[#ADFF2F]' : 'bg-[#FF2D78]'}`} />
        <div className="min-w-0">
          <p className="text-sm text-[#F4F6FF] truncate">
            {session.goal || 'Focus session'}
          </p>
          <p className="text-xs text-[#8892A4]">
            {formatRelativeDate(session.started_at)}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="text-xs border-[#00F0FF]/20 text-[#8892A4] flex-shrink-0 ml-2">
        {session.duration_min ? formatDuration(session.duration_min) : '--'}
      </Badge>
    </div>
  );
}

function BreakSuggestion({ onDismiss }: { onDismiss: () => void }) {
  const [tip] = useState(getRandomBreakTip);
  return (
    <div className="bg-[#0C0C18] border border-[#ADFF2F]/20 rounded-xl p-4 text-center space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#ADFF2F]/10">
        <Zap size={22} className="text-[#ADFF2F]" />
      </div>
      <p className="text-sm font-medium text-[#F4F6FF]">Session complete!</p>
      <p className="text-sm text-[#8892A4]">{tip}</p>
      <Button
        size="sm" variant="ghost"
        onClick={onDismiss}
        className="text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 min-h-[44px]"
      >
        Got it
      </Button>
    </div>
  );
}

// Confetti-like pulse overlay
function CelebrationPulse() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="w-64 h-64 rounded-full bg-[#ADFF2F]/10 animate-ping" />
      <div className="absolute w-48 h-48 rounded-full bg-[#00F0FF]/10 animate-ping" style={{ animationDelay: '0.15s' }} />
      <div className="absolute w-32 h-32 rounded-full bg-[#FF2D78]/10 animate-ping" style={{ animationDelay: '0.3s' }} />
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
    // Show checkmark animation
    setTimeout(() => {
      setJustLogged(true);
      setAnimating(false);
    }, 400);
  }

  const isComplete = habit.logged_today || justLogged;

  return (
    <button
      onClick={handleClick}
      disabled={isComplete}
      className={`
        min-h-[44px] min-w-[44px] px-4 rounded-lg flex items-center justify-center gap-2
        font-medium text-sm transition-all duration-300
        focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none
        ${isComplete
          ? 'bg-[#ADFF2F]/15 text-[#ADFF2F] cursor-default'
          : 'bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 active:scale-95'
        }
        ${animating ? 'scale-110' : ''}
      `}
      aria-label={`Log ${habit.name}`}
    >
      <CheckCircle
        size={18}
        className={`transition-all duration-300 ${isComplete ? 'scale-125' : ''} ${animating ? 'animate-spin' : ''}`}
      />
      {isComplete ? 'Done' : 'Log'}
    </button>
  );
}

// ---------- Main Component ----------

export function FocusPage() {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [deferredCount, setDeferredCount] = useState(0);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [activeTab, setActiveTab] = useState('focus');

  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);

  // Form state
  const [goalInput, setGoalInput] = useState('');
  const [durInput, setDurInput] = useState(25);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('⭐');
  const [newHabitFreq, setNewHabitFreq] = useState('daily');

  // Loading / UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [deletingHabitId, setDeletingHabitId] = useState<number | null>(null);

  const { elapsed, remaining, progress } = useTimer(
    session?.started_at ?? null,
    session?.duration_min ?? null,
  );

  // --- Data loading ---

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

  // Auto-detect session completion
  const prevRemaining = useRef<number | null>(null);
  useEffect(() => {
    if (prevRemaining.current !== null && prevRemaining.current > 0 && remaining === 0 && session) {
      // Timer just hit zero
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
    } catch {
      toast.error('Failed to start focus session');
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
    } catch {
      toast.error('Failed to end focus session');
    }
    setLoading(false);
  }

  async function handleLogHabit(id: number) {
    try {
      await api.post('/habits/' + id + '/log', {});
      // Optimistic update
      setHabits(prev => {
        const updated = prev.map(h =>
          h.id === id ? { ...h, logged_today: true, current_streak: h.current_streak + 1 } : h,
        );
        // Check if all habits are now logged
        const allDone = updated.length > 0 && updated.every(h => h.logged_today);
        if (allDone) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 2000);
        }
        return updated;
      });
      toast.success('Habit logged');
      // Full reload for accurate streak data
      setTimeout(() => void load(), 600);
    } catch {
      toast.error('Failed to log habit');
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
    } catch {
      toast.error('Failed to add habit');
    }
    setLoading(false);
  }

  async function handleDeleteHabit(id: number) {
    setDeletingHabitId(id);
    try {
      await api.delete('/habits/' + id);
      void load();
      toast.success('Habit deleted');
    } catch {
      toast.error('Failed to delete habit');
    }
    setDeletingHabitId(null);
  }

  async function toggleFocusMode() {
    const newVal = settings?.focus_mode_active ? 0 : 1;
    try {
      const res = await api.patch('/focus/settings', { focus_mode_active: newVal });
      setSettings((res.data as { settings: NotifSettings }).settings);
      toast.success(newVal ? 'Focus mode ON' : 'Focus mode OFF');
    } catch {
      toast.error('Failed to update focus mode');
    }
  }

  // --- Derived values ---

  const elapsedStr = pad(Math.floor(elapsed / 60)) + ':' + pad(elapsed % 60);
  const remainStr = remaining !== null ? pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60) : '';
  const habitsLoggedToday = habits.filter(h => h.logged_today).length;
  const completedHistory = history.filter(h => h.ended_at !== null);

  // Compute focus streak: consecutive days with at least one completed session
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
    // Allow today or yesterday as the most recent session day
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
        <div className="h-8 w-48 bg-[#0C0C18] rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[#0C0C18] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-[#0C0C18] rounded-xl animate-pulse" />
        <div className="h-48 bg-[#0C0C18] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5 pb-24">
      {showCelebration && <CelebrationPulse />}

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#F4F6FF] font-[Syne] flex items-center gap-2">
          <Target className="text-[#00F0FF]" size={24} />
          Focus & Habits
        </h1>
        <Button
          variant="ghost" size="sm"
          onClick={toggleFocusMode}
          className={`gap-1.5 text-xs min-h-[44px] px-3 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
            settings?.focus_mode_active
              ? 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20'
              : 'text-[#8892A4] hover:text-[#F4F6FF]'
          }`}
          aria-label={settings?.focus_mode_active ? 'Turn focus mode off' : 'Turn focus mode on'}
        >
          {settings?.focus_mode_active ? <BellOff size={14} /> : <Bell size={14} />}
          {settings?.focus_mode_active ? 'Focus ON' : 'Focus OFF'}
        </Button>
      </div>

      {/* ---- Deferred messages banner ---- */}
      {deferredCount > 0 && (
        <div className="bg-[#0C0C18] border border-[#00F0FF]/20 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-[#F4F6FF]">
            <Bell size={14} className="inline mr-1.5 text-[#00F0FF]" />
            {deferredCount} message{deferredCount > 1 ? 's' : ''} held during focus
          </span>
          <Button
            size="sm" variant="outline"
            className="text-xs min-h-[44px] border-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/10"
            onClick={() => { setDeferredCount(0); void load(); }}
          >
            View now
          </Button>
        </div>
      )}

      {/* ---- Stats Summary ---- */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs text-[#8892A4]">Focus streak</span>
          </div>
          <p className="text-xl font-bold text-[#F4F6FF] font-[Syne]">{focusStreak}<span className="text-xs text-[#8892A4] font-normal ml-0.5">d</span></p>
        </div>
        <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle size={14} className="text-[#ADFF2F]" />
            <span className="text-xs text-[#8892A4]">Habits today</span>
          </div>
          <p className="text-xl font-bold text-[#F4F6FF] font-[Syne]">
            {habitsLoggedToday}<span className="text-xs text-[#8892A4] font-normal">/{habits.length}</span>
          </p>
        </div>
        <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock size={14} className="text-[#00F0FF]" />
            <span className="text-xs text-[#8892A4]">This week</span>
          </div>
          <p className="text-xl font-bold text-[#F4F6FF] font-[Syne]">
            {summary ? formatDuration(summary.totalMinutesThisWeek) : '0m'}
          </p>
        </div>
      </div>

      {/* ---- Tabs ---- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-1 h-12">
          <TabsTrigger
            value="focus"
            className="flex-1 rounded-lg h-10 text-sm font-medium data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] text-[#8892A4] transition-colors min-h-[44px]"
          >
            <Timer size={16} className="mr-1.5" />
            Focus Sessions
          </TabsTrigger>
          <TabsTrigger
            value="habits"
            className="flex-1 rounded-lg h-10 text-sm font-medium data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] text-[#8892A4] transition-colors min-h-[44px]"
          >
            <Flame size={16} className="mr-1.5" />
            Daily Habits
          </TabsTrigger>
        </TabsList>

        {/* ======== Focus Sessions Tab ======== */}
        <TabsContent value="focus" className="mt-4 space-y-4">
          {/* Timer card */}
          <Card className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl overflow-hidden">
            <CardContent className="p-6">
              {session ? (
                <div className="space-y-5">
                  <TimerRing progress={progress} size={240} strokeWidth={10}>
                    <div className="text-4xl font-mono font-bold text-[#00F0FF] tracking-wider">
                      {remaining !== null ? remainStr : elapsedStr}
                    </div>
                    <div className="text-xs text-[#8892A4] mt-1">
                      {remaining !== null ? 'remaining' : 'elapsed'}
                    </div>
                  </TimerRing>
                  {session.goal && (
                    <p className="text-center text-sm text-[#F4F6FF]/80">
                      <Target size={12} className="inline mr-1 text-[#00F0FF]" />
                      {session.goal}
                    </p>
                  )}
                  <div className="text-center text-xs text-[#8892A4]">
                    {session.duration_min ? `${session.duration_min} min session` : 'Open session'}
                  </div>
                  <button
                    onClick={handleEndFocus}
                    disabled={loading}
                    className="w-full h-14 px-8 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-medium
                      transition-colors flex items-center justify-center gap-2
                      focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none
                      disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Pause size={18} />
                    End Session
                  </button>
                </div>
              ) : showBreakSuggestion ? (
                <BreakSuggestion onDismiss={() => setShowBreakSuggestion(false)} />
              ) : (
                <div className="text-center space-y-5 py-2">
                  <TimerRing progress={0} size={200} strokeWidth={8}>
                    <div className="text-3xl font-mono font-bold text-[#8892A4]/40">
                      {pad(durInput)}:00
                    </div>
                    <div className="text-xs text-[#8892A4] mt-1">ready</div>
                  </TimerRing>

                  {/* Duration preset cards */}
                  <div className="grid grid-cols-4 gap-2">
                    {DURATIONS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDurInput(d.value)}
                        className={`
                          rounded-xl p-2.5 text-center transition-all duration-200
                          focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none
                          min-h-[44px]
                          ${durInput === d.value
                            ? 'bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF]'
                            : 'bg-[#05050A] border border-[#00F0FF]/5 text-[#8892A4] hover:border-[#00F0FF]/20 hover:text-[#F4F6FF]'
                          }
                        `}
                      >
                        <div className="text-lg font-bold font-[Syne]">{d.label}</div>
                        <div className="text-[10px] mt-0.5 opacity-70">{d.desc}</div>
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={() => setShowStartModal(true)}
                    className="bg-[#00F0FF] text-black hover:bg-[#00d4e0] h-14 px-10 rounded-xl text-base font-semibold
                      focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 active:scale-[0.98] transition-transform"
                  >
                    <Play size={18} className="mr-2" />
                    Start Focus
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly chart */}
          {completedHistory.length > 0 && (
            <Card className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#F4F6FF] flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#00F0FF]" />
                  This week
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <WeeklyFocusChart sessions={history} />
              </CardContent>
            </Card>
          )}

          {/* Session history */}
          {completedHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[#8892A4] flex items-center gap-2 px-1">
                <Calendar size={14} />
                Recent sessions
              </h3>
              <div className="space-y-1.5">
                {completedHistory.slice(0, 5).map(s => (
                  <SessionHistoryItem key={s.id} session={s} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {completedHistory.length === 0 && !session && (
            <div className="text-center py-8">
              <Timer size={32} className="mx-auto text-[#8892A4]/30 mb-3" />
              <p className="text-sm text-[#8892A4]">No focus sessions yet.</p>
              <p className="text-xs text-[#8892A4]/60 mt-1">Start one to begin tracking your deep work.</p>
            </div>
          )}
        </TabsContent>

        {/* ======== Daily Habits Tab ======== */}
        <TabsContent value="habits" className="mt-4 space-y-4">
          {/* Completion rings */}
          {habits.length > 0 && (
            <Card className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-6">
                  <HabitCompletionRings habits={habits} />
                  <div className="flex-1 space-y-2">
                    {habits.slice(0, 3).map((h, i) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: RING_COLORS[i] }} />
                        <span className="text-xs text-[#F4F6FF] truncate">{h.icon} {h.name}</span>
                        {h.logged_today && (
                          <CheckCircle size={12} className="text-[#ADFF2F] flex-shrink-0 ml-auto" />
                        )}
                      </div>
                    ))}
                    {habits.length > 3 && (
                      <p className="text-[10px] text-[#8892A4] pl-4">
                        +{habits.length - 3} more habit{habits.length - 3 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Habit cards */}
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-medium text-[#8892A4]">
              Your habits ({habits.length})
            </h3>
            <Button
              size="sm" variant="ghost"
              onClick={() => setShowAddHabit(true)}
              className="text-[#00F0FF] min-h-[44px] min-w-[44px] hover:bg-[#00F0FF]/10
                focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
              aria-label="Add habit"
            >
              <Plus size={16} className="mr-1" />
              Add
            </Button>
          </div>

          {habits.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0C0C18] border border-[#00F0FF]/10">
                <Flame size={28} className="text-[#8892A4]/30" />
              </div>
              <p className="text-sm text-[#8892A4]">No habits yet</p>
              <p className="text-xs text-[#8892A4]/60">
                Add your first habit to start building streaks.
              </p>
              <Button
                size="sm"
                onClick={() => setShowAddHabit(true)}
                className="bg-[#00F0FF] text-black hover:bg-[#00d4e0] min-h-[44px] mt-2"
              >
                <Plus size={16} className="mr-1" />
                Add Habit
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {habits.map(h => (
                <div
                  key={h.id}
                  className={`
                    flex items-center justify-between p-3.5 rounded-xl
                    bg-[#0C0C18] border transition-all duration-300
                    ${h.logged_today ? 'border-[#ADFF2F]/15' : 'border-[#00F0FF]/5'}
                    ${deletingHabitId === h.id ? 'opacity-50 scale-95' : ''}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl flex-shrink-0">{h.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${h.logged_today ? 'text-[#ADFF2F]' : 'text-[#F4F6FF]'}`}>
                        {h.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[#8892A4] flex items-center gap-0.5">
                          <Flame size={10} className="text-orange-400" />
                          {h.current_streak}d
                        </span>
                        <span className="text-[10px] text-[#8892A4]/50">|</span>
                        <span className="text-xs text-[#8892A4] flex items-center gap-0.5">
                          <Trophy size={10} className="text-[#8892A4]/60" />
                          Best: {h.longest_streak}d
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#00F0FF]/10 text-[#8892A4]/60 h-4">
                          {h.frequency}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <HabitLogButton habit={h} onLog={handleLogHabit} />
                    <button
                      className="min-h-[44px] min-w-[36px] rounded-lg text-[#8892A4]/30 hover:text-red-400
                        hover:bg-red-400/10 flex items-center justify-center transition-colors
                        focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none"
                      onClick={() => void handleDeleteHabit(h.id)}
                      disabled={deletingHabitId === h.id}
                      aria-label={`Delete ${h.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All done celebration message */}
          {habits.length > 0 && habitsLoggedToday === habits.length && (
            <div className="bg-[#0C0C18] border border-[#ADFF2F]/20 rounded-xl p-4 text-center
              animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Trophy size={28} className="mx-auto text-[#ADFF2F] mb-2" />
              <p className="text-sm font-medium text-[#F4F6FF]">All habits logged today!</p>
              <p className="text-xs text-[#8892A4] mt-1">You are on fire. Keep this momentum going.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ======== Start Focus Modal ======== */}
      <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
        <DialogContent className="bg-[#06060B] border-[#00F0FF]/10 text-[#F4F6FF] max-w-[calc(100%-2rem)] sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-[Syne] flex items-center gap-2">
              <Play size={18} className="text-[#00F0FF]" />
              Start Focus Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="focus-goal" className="text-[#8892A4] text-sm">
                What are you working on?
              </Label>
              <Input
                id="focus-goal"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="e.g. Write report, Fix bug, Study..."
                className="mt-1.5 bg-[#0C0C18] border-[#00F0FF]/10 text-[#F4F6FF] h-12 rounded-xl
                  placeholder:text-[#8892A4]/40 focus-visible:ring-[#00F0FF]/30"
                onKeyDown={e => { if (e.key === 'Enter') void handleStartFocus(); }}
              />
            </div>
            <div>
              <Label className="text-[#8892A4] text-sm">Duration</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDurInput(d.value)}
                    className={`
                      rounded-xl p-3 text-center transition-all duration-200
                      focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none
                      min-h-[44px]
                      ${durInput === d.value
                        ? 'bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF]'
                        : 'bg-[#0C0C18] border border-[#00F0FF]/5 text-[#8892A4] hover:border-[#00F0FF]/20'
                      }
                    `}
                  >
                    <div className="text-base font-bold">{d.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-60">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowStartModal(false)}
              className="text-[#8892A4] hover:text-[#F4F6FF] min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartFocus}
              disabled={loading}
              className="bg-[#00F0FF] text-black hover:bg-[#00d4e0] min-h-[44px] px-6 font-semibold"
            >
              {loading ? 'Starting...' : 'Start'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Add Habit Modal ======== */}
      <Dialog open={showAddHabit} onOpenChange={setShowAddHabit}>
        <DialogContent className="bg-[#06060B] border-[#00F0FF]/10 text-[#F4F6FF] max-w-[calc(100%-2rem)] sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-[Syne] flex items-center gap-2">
              <Plus size={18} className="text-[#00F0FF]" />
              Add Habit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <Label className="text-[#8892A4] text-sm">Habit Name</Label>
              <Input
                value={newHabitName}
                onChange={e => setNewHabitName(e.target.value)}
                placeholder="e.g. Morning Workout, Read 30 mins..."
                className="mt-1.5 bg-[#0C0C18] border-[#00F0FF]/10 text-[#F4F6FF] h-12 rounded-xl
                  placeholder:text-[#8892A4]/40 focus-visible:ring-[#00F0FF]/30"
                onKeyDown={e => { if (e.key === 'Enter') void handleAddHabit(); }}
              />
            </div>

            <div>
              <Label className="text-[#8892A4] text-sm">Icon</Label>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {HABIT_ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setNewHabitIcon(ic)}
                    className={`text-xl p-2 rounded-lg transition-all min-h-[44px] min-w-[44px]
                      flex items-center justify-center
                      focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none
                      ${newHabitIcon === ic
                        ? 'bg-[#00F0FF]/15 ring-1 ring-[#00F0FF]/40 scale-110'
                        : 'hover:bg-[#0C0C18]'
                      }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[#8892A4] text-sm">Frequency</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {FREQUENCY_OPTIONS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setNewHabitFreq(f.value)}
                    className={`
                      rounded-xl p-3 text-center text-sm transition-all duration-200
                      focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 focus-visible:outline-none
                      min-h-[44px]
                      ${newHabitFreq === f.value
                        ? 'bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] font-medium'
                        : 'bg-[#0C0C18] border border-[#00F0FF]/5 text-[#8892A4] hover:border-[#00F0FF]/20'
                      }
                    `}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowAddHabit(false)}
              className="text-[#8892A4] hover:text-[#F4F6FF] min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddHabit}
              className="bg-[#00F0FF] text-black hover:bg-[#00d4e0] min-h-[44px] px-6 font-semibold"
              disabled={!newHabitName.trim() || loading}
            >
              {loading ? 'Adding...' : 'Add Habit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
