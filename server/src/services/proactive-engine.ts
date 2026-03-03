// Proactive AI Engine -- Phase 90
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

export type ProactiveMessageType = 'daily_briefing' | 'overdue_alert' | 'idle_check_in';

interface UserRow {
  id: string;
  name: string;
  proactive_enabled: number;
  last_active: string | null;
}

function recordProactiveMessage(userId: string, type: ProactiveMessageType, message: string): void {
  try {
    db.prepare(
      'INSERT INTO proactive_messages (user_id, type, sent_at, message) VALUES (?, ?, ?, ?)'
    ).run(userId, type, Date.now(), message);
  } catch (err) {
    logger.warn({ err, userId, type }, 'Failed to record proactive message');
  }
}

async function sendViaTelegram(userId: string, message: string): Promise<boolean> {
  try {
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;
    if (!link) return false;
    const { sendTelegramMessage } = await import('./telegram.js');
    const result = await sendTelegramMessage(link.external_id, message);
    return result.success;
  } catch {
    return false;
  }
}

function isProactiveEnabled(userId: string): boolean {
  try {
    const user = db.prepare('SELECT proactive_enabled FROM users WHERE id = ?').get(userId) as { proactive_enabled: number } | undefined;
    return user?.proactive_enabled !== 0;
  } catch {
    return true;
  }
}

export async function dailyBriefing(userId: string): Promise<string | null> {
  if (!isProactiveEnabled(userId)) return null;
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
  if (!user) return null;
  const firstName = (user.name || 'there').split(' ')[0];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dueToday = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND datetime LIKE ? || '%'"
  ).get(userId, todayStr) as { c: number })?.c ?? 0;
  const pendingTotal = (db.prepare(
    'SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0'
  ).get(userId) as { c: number })?.c ?? 0;
  const overdueCount = (db.prepare(
    'SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND datetime < ?'
  ).get(userId, now.toISOString()) as { c: number })?.c ?? 0;

  const plural = (n: number, word: string) => n === 1 ? word : word + 's';
  let message = `Good morning, ${firstName}!`;
  if (dueToday > 0) {
    message += ` You have ${dueToday} ${plural(dueToday, 'reminder')} due today.`;
  } else if (pendingTotal > 0) {
    message += ` No reminders due today -- you have ${pendingTotal} pending overall.`;
  } else {
    message += ' You have a clear schedule today -- enjoy!';
  }
  if (overdueCount > 0) {
    message += ` You have ${overdueCount} overdue ${plural(overdueCount, 'item')}.`;
  }
  await sendViaTelegram(userId, message);
  recordProactiveMessage(userId, 'daily_briefing', message);
  logger.info({ userId, dueToday, pendingTotal, overdueCount }, 'Daily briefing sent');
  return message;
}

export async function overdueAlert(userId: string): Promise<string | null> {
  if (!isProactiveEnabled(userId)) return null;
  const now = new Date();
  const overdueReminders = db.prepare(
    'SELECT text FROM reminders WHERE user_id = ? AND completed = 0 AND datetime < ? LIMIT 5'
  ).all(userId, now.toISOString()) as Array<{ text: string }>;
  if (overdueReminders.length === 0) return null;
  const count = (db.prepare(
    'SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND datetime < ?'
  ).get(userId, now.toISOString()) as { c: number })?.c ?? 0;
  const preview = overdueReminders.slice(0, 3).map(r => `- ${r.text}`).join('\n');
  const more = count > 3 ? `\nand ${count - 3} more.` : '';
  const plural = (n: number) => n === 1 ? 'reminder' : 'reminders';
  const message = `You have ${count} overdue ${plural(count)}:\n${preview}${more}`;
  await sendViaTelegram(userId, message);
  recordProactiveMessage(userId, 'overdue_alert', message);
  logger.info({ userId, count }, 'Overdue alert sent');
  return message;
}

export async function idleCheckIn(userId: string): Promise<string | null> {
  if (!isProactiveEnabled(userId)) return null;
  const user = db.prepare('SELECT name, last_active FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user) return null;
  const lastActive = user.last_active ? new Date(user.last_active) : null;
  if (!lastActive) return null;
  const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceActive < 3) return null;
  const firstName = (user.name || 'there').split(' ')[0];
  const message = `Hey ${firstName}! It has been a while -- we miss you. Your AI assistant is ready whenever you are.`;
  await sendViaTelegram(userId, message);
  recordProactiveMessage(userId, 'idle_check_in', message);
  logger.info({ userId, daysSinceActive }, 'Idle check-in sent');
  return message;
}

export function getProactiveLog(userId: string, limit = 20): unknown[] {
  try {
    return db.prepare(
      'SELECT id, type, sent_at, message FROM proactive_messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT ?'
    ).all(userId, limit);
  } catch {
    return [];
  }
}

let proactiveTimer: ReturnType<typeof setInterval> | null = null;

function getISTHour(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).getHours();
}

function getISTMinute(): number {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).getMinutes();
}

function getISTDateStr(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

async function runProactiveChecks(): Promise<void> {
  const hour = getISTHour();
  const minute = getISTMinute();
  const todayStr = getISTDateStr();
  if (minute !== 0) return;
  let users: Array<{ id: string }> = [];
  try {
    users = db.prepare('SELECT id FROM users WHERE proactive_enabled != 0').all() as Array<{ id: string }>;
  } catch {
    users = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>;
  }
  for (const user of users) {
    try {
      if (hour === 8) {
        const alreadySent = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'daily_briefing' AND sent_at >= ?"
        ).get(user.id, new Date(todayStr + 'T00:00:00Z').getTime()) as { id: number } | undefined;
        if (!alreadySent) await dailyBriefing(user.id);
      } else if (hour === 10) {
        const alreadySent = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'overdue_alert' AND sent_at >= ?"
        ).get(user.id, new Date(todayStr + 'T00:00:00Z').getTime()) as { id: number } | undefined;
        if (!alreadySent) await overdueAlert(user.id);
      }
      if (hour === 8) {
        const alreadySentIdle = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'idle_check_in' AND sent_at >= ?"
        ).get(user.id, new Date(todayStr + 'T00:00:00Z').getTime()) as { id: number } | undefined;
        if (!alreadySentIdle) await idleCheckIn(user.id);
      }
      // Weekly report every Sunday at 19:00 IST
      const istDate = new Date(new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 + 5.5 * 60 * 60 * 1000);
      if (hour === 19 && istDate.getDay() === 0) {
        const weekStart = new Date(istDate.getTime() - 7 * 86_400_000).getTime();
        const alreadySentWeekly = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'daily_briefing' AND sent_at >= ? AND message LIKE 'Your Week in Review%'"
        ).get(user.id, weekStart) as { id: number } | undefined;
        if (!alreadySentWeekly) await weeklyReport(user.id);
      }
    } catch (err) {
      logger.warn({ err, userId: user.id }, 'Proactive check failed for user');
    }
  }
}


export async function weeklyReport(userId: string): Promise<string | null> {
  if (!isProactiveEnabled(userId)) return null;
  try {
    const { getWeeklySummary } = await import('./analytics.js');
    const summary = await getWeeklySummary(userId);
    const now = new Date();
    const weekEnd = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const weekStartDate = new Date(now.getTime() - 7 * 86_400_000);
    const weekStartStr = weekStartDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const streakLine = summary.longestHabitStreak
      ? `Best streak: ${summary.longestHabitStreak.name} at ${summary.longestHabitStreak.streak} day${summary.longestHabitStreak.streak === 1 ? '' : 's'}`
      : 'No habit streaks yet';
    const agentName = summary.topAgent.charAt(0).toUpperCase() + summary.topAgent.slice(1);
    const message = [
      `📊 Your Week in Review — ${weekStartStr} to ${weekEnd}`,
      '',
      `🎯 Tasks: ${summary.taskCompletionRate}% completion rate`,
      `⏱️ Focus: ${summary.totalFocusHours}h of deep work`,
      `✅ Habits: ${streakLine}`,
      `🤖 Favourite agent: ${agentName}`,
      `📬 Inbox: ${summary.inboxTriagedCount} messages triaged`,
      `💡 ${summary.aiInsight}`,
      '',
      'Keep building your AI OS. 🚀',
    ].join('\n');
    await sendViaTelegram(userId, message);
    recordProactiveMessage(userId, 'daily_briefing', message);
    logger.info({ userId }, 'Weekly report sent');
    return message;
  } catch (err) {
    logger.warn({ err, userId }, 'Weekly report failed');
    return null;
  }
}

export function initProactiveEngine(): void {
  if (proactiveTimer) return;
  proactiveTimer = setInterval(() => {
    void runProactiveChecks();
  }, 60_000);
  logger.info('Proactive engine started (daily_briefing@08:00 IST, overdue_alert@10:00 IST, idle_check_in@08:00 IST)');
}
