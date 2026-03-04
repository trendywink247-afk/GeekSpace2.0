// ============================================================
// Habits Service -- Phase 101
// Habit tracking with streaks, daily logging, AI coaching
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

export interface Habit {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  frequency: string;
  target_time: string | null;
  icon: string;
  current_streak: number;
  longest_streak: number;
  created_at: number;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  user_id: string;
  logged_at: number;
  note: string | null;
}

export interface HabitWithStatus extends Habit {
  logged_today: boolean;
  today_log_id: number | null;
}

// ---- CRUD ----

export function createHabit(
  userId: string,
  opts: { name: string; description?: string; frequency?: string; targetTime?: string; icon?: string }
): Habit {
  const result = db.prepare(
    'INSERT INTO habits (user_id, name, description, frequency, target_time, icon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    userId,
    opts.name,
    opts.description ?? null,
    opts.frequency ?? 'daily',
    opts.targetTime ?? null,
    opts.icon ?? '⭐',
    Date.now()
  );
  logger.info({ userId, name: opts.name }, 'Habit created');
  return db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid) as Habit;
}

export function deleteHabit(userId: string, habitId: number): boolean {
  const result = db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(habitId, userId);
  return result.changes > 0;
}

export function getHabits(userId: string): HabitWithStatus[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const habits = db.prepare(
    'SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC'
  ).all(userId) as Habit[];

  return habits.map(h => {
    const todayLog = db.prepare(
      "SELECT id FROM habit_logs WHERE habit_id = ? AND date(logged_at/1000, 'unixepoch') = ? LIMIT 1"
    ).get(h.id, todayStr) as { id: number } | undefined;

    return {
      ...h,
      logged_today: !!todayLog,
      today_log_id: todayLog?.id ?? null,
    };
  });
}

// ---- Logging + streak calculation ----

export function logHabit(userId: string, habitId: number, note?: string): HabitLog {
  const habit = db.prepare(
    'SELECT * FROM habits WHERE id = ? AND user_id = ?'
  ).get(habitId, userId) as Habit | undefined;
  if (!habit) throw new Error('Habit not found');

  const now = Date.now();
  const result = db.prepare(
    'INSERT INTO habit_logs (habit_id, user_id, logged_at, note) VALUES (?, ?, ?, ?)'
  ).run(habitId, userId, now, note ?? null);

  const newStreak = calculateStreak(habitId);
  const longestStreak = Math.max(habit.longest_streak, newStreak);
  db.prepare(
    'UPDATE habits SET current_streak = ?, longest_streak = ? WHERE id = ?'
  ).run(newStreak, longestStreak, habitId);

  logger.info({ userId, habitId, streak: newStreak }, 'Habit logged');

  // Milestone coaching (non-blocking)
  if (newStreak === 7 || newStreak === 30 || newStreak === 100) {
    sendStreakCoaching(userId, habit.name, newStreak).catch(() => { /* non-fatal */ });
  }

  return db.prepare('SELECT * FROM habit_logs WHERE id = ?').get(result.lastInsertRowid) as HabitLog;
}

function calculateStreak(habitId: number): number {
  const logs = db.prepare(
    "SELECT date(logged_at/1000, 'unixepoch') as log_date FROM habit_logs WHERE habit_id = ? ORDER BY logged_at DESC"
  ).all(habitId) as Array<{ log_date: string }>;

  if (logs.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const firstLogDate = logs[0].log_date;
  // Streak is broken if last log is not today or yesterday
  if (firstLogDate !== todayStr && firstLogDate !== yesterdayStr) return 0;

  const logDates = new Set(logs.map(l => l.log_date));
  let streak = 0;
  const checkDate = firstLogDate === todayStr ? new Date(today) : new Date(yesterday);

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (!logDates.has(dateStr)) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

async function sendStreakCoaching(userId: string, habitName: string, streak: number): Promise<void> {
  try {
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;
    if (!link) return;
    const emojis: Record<number, string> = { 7: '🎉', 30: '🌟', 100: '🏆' };
    const emoji = emojis[streak] ?? '🎉';
    const msg = `${emoji} Amazing! You've hit a ${streak}-day streak on "${habitName}"! Keep it up!`;
    const { sendTelegramMessage } = await import('./telegram.js');
    await sendTelegramMessage(link.external_id, msg);
  } catch { /* non-fatal */ }
}

// ---- Stats / calendar ----

export function getHabitStats(userId: string, habitId: number): {
  habit_id: number;
  habit: Habit | null;
  days: Array<{ date: string; logged: boolean }>;
  totalLogs: number;
} {
  const habit = db.prepare(
    'SELECT * FROM habits WHERE id = ? AND user_id = ?'
  ).get(habitId, userId) as Habit | undefined;
  if (!habit) return { habit_id: habitId, habit: null, days: [], totalLogs: 0 };

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const logs = db.prepare(
    "SELECT date(logged_at/1000, 'unixepoch') as log_date FROM habit_logs WHERE habit_id = ? AND logged_at >= ? ORDER BY logged_at ASC"
  ).all(habitId, thirtyDaysAgo) as Array<{ log_date: string }>;

  const loggedDates = new Set(logs.map(l => l.log_date));
  const days: Array<{ date: string; logged: boolean }> = [];

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, logged: loggedDates.has(dateStr) });
  }

  const totalLogs = (db.prepare(
    'SELECT COUNT(*) as cnt FROM habit_logs WHERE habit_id = ?'
  ).get(habitId) as { cnt: number }).cnt;

  return { habit_id: habitId, habit, days, totalLogs };
}
