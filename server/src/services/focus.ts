// ============================================================
// Focus Service -- Phase 101
// Focus Mode: Pomodoro timer sessions, smart notification deferral
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

export interface FocusSession {
  id: number;
  user_id: string;
  started_at: number;
  ended_at: number | null;
  duration_min: number | null;
  goal: string | null;
  completed: number;
  pomodoro_count: number;
}

export interface NotificationSettings {
  user_id: string;
  focus_mode_active: number;
  dnd_start: string;
  dnd_end: string;
  urgent_bypass: number;
  batch_interval_min: number;
}

// ---- Notification settings helpers ----

function ensureNotificationSettings(userId: string): NotificationSettings {
  const existing = db.prepare(
    'SELECT * FROM notification_settings WHERE user_id = ?'
  ).get(userId) as NotificationSettings | undefined;

  if (existing) return existing;

  db.prepare(
    'INSERT OR IGNORE INTO notification_settings (user_id) VALUES (?)'
  ).run(userId);

  return db.prepare(
    'SELECT * FROM notification_settings WHERE user_id = ?'
  ).get(userId) as NotificationSettings;
}

export function getNotificationSettings(userId: string): NotificationSettings {
  return ensureNotificationSettings(userId);
}

export function updateNotificationSettings(
  userId: string,
  updates: Partial<Omit<NotificationSettings, 'user_id'>>
): NotificationSettings {
  ensureNotificationSettings(userId);

  const allowed = ['focus_mode_active', 'dnd_start', 'dnd_end', 'urgent_bypass', 'batch_interval_min'];
  const setClauses: string[] = [];
  const params: (string | number)[] = [];

  for (const key of allowed) {
    if (key in updates) {
      setClauses.push(key + ' = ?');
      params.push((updates as Record<string, string | number>)[key]);
    }
  }

  if (setClauses.length === 0) return ensureNotificationSettings(userId);

  params.push(userId);
  db.prepare(
    'UPDATE notification_settings SET ' + setClauses.join(', ') + ' WHERE user_id = ?'
  ).run(...params);

  return db.prepare(
    'SELECT * FROM notification_settings WHERE user_id = ?'
  ).get(userId) as NotificationSettings;
}

// ---- Focus mode toggle ----

function setFocusMode(userId: string, active: boolean): void {
  ensureNotificationSettings(userId);
  db.prepare(
    'UPDATE notification_settings SET focus_mode_active = ? WHERE user_id = ?'
  ).run(active ? 1 : 0, userId);
}

// ---- Focus session CRUD ----

export function startFocus(userId: string, goalText?: string, plannedDurationMin?: number): FocusSession {
  // Close any existing open session first
  const existing = getActiveFocus(userId);
  if (existing) {
    endFocus(userId, false);
  }

  const now = Date.now();
  const result = db.prepare(
    'INSERT INTO focus_sessions (user_id, started_at, goal, completed, duration_min) VALUES (?, ?, ?, 0, ?)'
  ).run(userId, now, goalText ?? null, plannedDurationMin ?? null);

  // Activate focus mode -- defer non-urgent notifications
  setFocusMode(userId, true);

  logger.info({ userId, goal: goalText }, 'Focus session started');

  return db.prepare(
    'SELECT * FROM focus_sessions WHERE id = ?'
  ).get(result.lastInsertRowid) as FocusSession;
}

export function endFocus(userId: string, completed = true): FocusSession | null {
  const session = getActiveFocus(userId);
  if (!session) return null;

  const now = Date.now();
  const durationMin = Math.round((now - session.started_at) / 60000);

  db.prepare(
    'UPDATE focus_sessions SET ended_at = ?, duration_min = ?, completed = ? WHERE id = ?'
  ).run(now, durationMin, completed ? 1 : 0, session.id);

  // Deactivate focus mode
  setFocusMode(userId, false);

  // Clear deferred flag from inbox messages so user sees them now
  try {
    db.prepare(
      'UPDATE inbox_messages SET deferred = 0 WHERE user_id = ? AND deferred = 1'
    ).run(userId);
  } catch { /* non-fatal */ }

  logger.info({ userId, sessionId: session.id, durationMin, completed }, 'Focus session ended');

  return db.prepare(
    'SELECT * FROM focus_sessions WHERE id = ?'
  ).get(session.id) as FocusSession;
}

export function getActiveFocus(userId: string): FocusSession | null {
  const session = db.prepare(
    'SELECT * FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
  ).get(userId) as FocusSession | undefined;
  return session ?? null;
}

export function getFocusHistory(userId: string, limit = 10): FocusSession[] {
  return db.prepare(
    'SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(userId, limit) as FocusSession[];
}

export function getFocusSummary(userId: string): {
  totalSessionsThisWeek: number;
  totalMinutesThisWeek: number;
  avgSessionMin: number;
  longestSessionMin: number;
  totalSessions: number;
} {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const weekSessions = db.prepare(
    'SELECT duration_min FROM focus_sessions WHERE user_id = ? AND started_at >= ? AND ended_at IS NOT NULL'
  ).all(userId, weekAgo) as Array<{ duration_min: number | null }>;

  const allSessions = db.prepare(
    'SELECT duration_min FROM focus_sessions WHERE user_id = ? AND ended_at IS NOT NULL'
  ).all(userId) as Array<{ duration_min: number | null }>;

  const weekMins = weekSessions.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const totalMins = allSessions.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const maxMins = allSessions.reduce((max, s) => Math.max(max, s.duration_min ?? 0), 0);

  return {
    totalSessionsThisWeek: weekSessions.length,
    totalMinutesThisWeek: weekMins,
    avgSessionMin: allSessions.length > 0 ? Math.round(totalMins / allSessions.length) : 0,
    longestSessionMin: maxMins,
    totalSessions: allSessions.length,
  };
}

export function isFocusActive(userId: string): boolean {
  try {
    const ns = db.prepare(
      'SELECT focus_mode_active FROM notification_settings WHERE user_id = ?'
    ).get(userId) as { focus_mode_active: number } | undefined;
    return ns?.focus_mode_active === 1;
  } catch {
    return false;
  }
}

export function getDeferredMessages(userId: string): unknown[] {
  try {
    const messages = db.prepare(
      'SELECT * FROM inbox_messages WHERE user_id = ? AND deferred = 1 ORDER BY received_at ASC'
    ).all(userId);

    // Clear deferred flag as user has viewed them
    db.prepare(
      'UPDATE inbox_messages SET deferred = 0 WHERE user_id = ? AND deferred = 1'
    ).run(userId);

    return messages;
  } catch {
    return [];
  }
}

// ---- DND check ----

export function isInDND(userId: string, nowOverride?: Date | number): boolean {
  try {
    const settings = db.prepare(
      'SELECT dnd_start, dnd_end FROM notification_settings WHERE user_id = ?'
    ).get(userId) as { dnd_start: string; dnd_end: string } | undefined;

    if (!settings) return false;

    const now = nowOverride ? (typeof nowOverride === 'number' ? new Date(nowOverride) : nowOverride) : new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMin;

    const [startH, startM] = settings.dnd_start.split(':').map(Number);
    const [endH, endM] = settings.dnd_end.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= endTotal) {
      // Same day: e.g. 09:00-17:00
      return currentTotal >= startTotal && currentTotal <= endTotal;
    } else {
      // Overnight: e.g. 22:00-08:00
      return currentTotal >= startTotal || currentTotal <= endTotal;
    }
  } catch {
    return false;
  }
}

// ---- Smart notification filter ----
// Called by inbox.ts before adding a message

export function shouldDeferMessage(userId: string, priority: string): boolean {
  try {
    const settings = db.prepare(
      'SELECT focus_mode_active, urgent_bypass FROM notification_settings WHERE user_id = ?'
    ).get(userId) as { focus_mode_active: number; urgent_bypass: number } | undefined;

    if (!settings) return false;
    if (!settings.focus_mode_active) return false;
    if (priority === 'urgent' && settings.urgent_bypass) return false;

    return true;
  } catch {
    return false;
  }
}
