// ============================================================
// Focus — shared types, constants, utilities, timer hook
// ============================================================

import { useState, useEffect, useRef } from 'react';

// ---------- Types ----------

export interface FocusSession {
  id: number;
  started_at: number;
  ended_at: number | null;
  duration_min: number | null;
  goal: string | null;
  completed: number;
}

export interface Habit {
  id: number;
  name: string;
  icon: string;
  description: string | null;
  frequency: string;
  current_streak: number;
  longest_streak: number;
  logged_today: boolean;
}

export interface NotifSettings {
  focus_mode_active: number;
  dnd_start: string;
  dnd_end: string;
  urgent_bypass: number;
  batch_interval_min: number;
}

export interface FocusSummary {
  totalSessionsThisWeek: number;
  totalMinutesThisWeek: number;
  avgSessionMin: number;
  longestSessionMin: number;
  totalSessions: number;
}

// ---------- Constants ----------

export const DURATIONS = [
  { label: '25m', value: 25, desc: 'Pomodoro' },
  { label: '45m', value: 45, desc: 'Deep work' },
  { label: '60m', value: 60, desc: 'Flow state' },
  { label: '90m', value: 90, desc: 'Ultra focus' },
];

export const HABIT_ICONS = ['⭐', '🏃', '📚', '💪', '🧘', '💧', '🎯', '✅', '🔥', '🎨', '🎵', '🥗', '😴', '🧠', '🌅'];

export const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: '3x / week', value: 'weekly' },
  { label: 'Weekdays', value: 'weekdays' },
];

export const BREAK_TIPS = [
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
export const RING_COLORS = ['var(--ag-cyan)', 'var(--ag-lime)', 'var(--ag-pink)'];

// Shadow tokens
export const SHADOW_CARD = '0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.3)';
export const SHADOW_CARD_HOVER = '0 0 0 1px rgba(139,92,246,0.18), 0 6px 20px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.07)';

// ---------- Utilities ----------

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatRelativeDate(ms: number): string {
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

export function getDayLabel(dayIndex: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex] ?? '';
}

export function getRandomBreakTip(): string {
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

// ---------- Hook ----------

export function useTimer(startMs: number | null, durationMin: number | null) {
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
