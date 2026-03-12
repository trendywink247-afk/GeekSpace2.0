// Proactive AI Engine -- Phase 90
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { getTodayEvents } from './calendar-sync.js';
import { textToSpeech, sendTelegramVoice } from './voice.js';

export type ProactiveMessageType = 'daily_briefing' | 'overdue_alert' | 'idle_check_in' | 'weekly_report';

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
  // Phase 101: include habit reminders in daily briefing
  try {
    const todayHabits = db.prepare("SELECT name, icon FROM habits WHERE user_id = ?").all(userId) as Array<{ name: string; icon: string }>;
    if (todayHabits.length > 0) {
      const habitList = todayHabits.slice(0, 3).map((h: { name: string; icon: string }) => h.icon + " " + h.name).join(", ");
      message += " Habits today: " + habitList + ".";
    }
  } catch { }
  // Phase 95: Include today calendar events in morning briefing
  const calendarEvents = getTodayEvents(userId);
  if (calendarEvents.length > 0) {
    const eventList = calendarEvents.slice(0, 3).map(e => {
      const d = new Date(e.start_time);
      const hrs = d.getHours();
      const mins = d.getMinutes();
      const ampm = hrs >= 12 ? 'pm' : 'am';
      const h12 = hrs % 12 || 12;
      const t = String(h12) + ':' + String(mins).padStart(2, '0') + ampm;
      return e.title + ' at ' + t;
    }).join(', ');
    const moreCount = calendarEvents.length - 3;
    const moreStr = calendarEvents.length > 3 ? ' and ' + String(moreCount) + ' more' : '';
    const evtWord = plural(calendarEvents.length, "event");
    message += ' You have ' + String(calendarEvents.length) + ' calendar ' + evtWord + ' today: ' + eventList + moreStr + '.';
  }
  await sendViaTelegram(userId, message);
  // Fire-and-forget: send TTS voice note after text message — failure must not block text delivery
  {
    const tgLink = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;
    if (tgLink) {
      const chatId = tgLink.external_id;
      textToSpeech(message).then((audioBuffer: Buffer) => {
        return sendTelegramVoice(chatId, audioBuffer);
      }).catch((e: unknown) => {
        logger.warn({ err: (e as Error).message }, 'Voice briefing TTS failed — text sent OK');
      });
    }
  }
  recordProactiveMessage(userId, 'daily_briefing', message);
  logger.info({ userId, dueToday, pendingTotal, overdueCount, calEvents: calendarEvents.length }, "Daily briefing sent");
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
  // last_active column may not exist in older DB schemas — use activity_log as fallback
  let user: UserRow | undefined;
  try {
    user = db.prepare('SELECT name, last_active FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  } catch {
    // last_active column missing — fall back to name only
    user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  }
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

export async function sendHabitMilestone(userId: string, habitName: string, streak: number): Promise<void> {
  if (!isProactiveEnabled(userId)) return;
  const streakStr = String(streak);
  const msg = "Amazing! You now have a " + streakStr + " day streak on: " + habitName + ". Keep going!";
  await sendViaTelegram(userId, msg);
  recordProactiveMessage(userId, "daily_briefing", msg);
  logger.info({ userId, habitName, streak }, "Habit milestone sent");
}

export async function sendFocusSessionComplete(userId: string, durationMin: number): Promise<void> {
  if (!isProactiveEnabled(userId)) return;
  if (durationMin < 60) return;
  const minStr = String(durationMin);
  const msg = "Great focus session (" + minStr + "min)! Take a break before your next sprint.";
  await sendViaTelegram(userId, msg);
  recordProactiveMessage(userId, "daily_briefing", msg);
  logger.info({ userId, durationMin }, "Focus session complete message sent");
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

  // 30-min preview runs every 30 min (minute 0 or 30)
  if (minute === 0 || minute === 30) {
    await sendReminderPreviews().catch(err => logger.warn({ err }, 'Reminder preview failed'));
  }

  if (minute !== 0) return;
  let users: Array<{ id: string; timezone?: string }> = [];
  try {
    users = db.prepare('SELECT id, timezone FROM users WHERE proactive_enabled != 0').all() as Array<{ id: string; timezone?: string }>;
  } catch {
    users = db.prepare('SELECT id, timezone FROM users').all() as Array<{ id: string; timezone?: string }>;
  }
  for (const user of users) {
    try {
      if (hour === 8) {
        // Check if it's morning (7-9am) in the user's timezone
        const userTimezone = user.timezone || 'Asia/Kolkata';
        const hourInUserTz = parseInt(
          new Date().toLocaleString('en-US', { timeZone: userTimezone, hour: 'numeric', hour12: false }),
          10
        );
        if (hourInUserTz < 7 || hourInUserTz > 9) {
          logger.debug({ userId: user.id, userTimezone, hourInUserTz }, 'Skipping briefing — not morning for user');
        } else {
          const alreadySent = db.prepare(
            "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'daily_briefing' AND sent_at >= ?"
          ).get(user.id, new Date(todayStr + 'T00:00:00Z').getTime()) as { id: number } | undefined;
          if (!alreadySent) await dailyBriefing(user.id);
        }
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
      // Habit idle nudge at 11:00 IST daily
      if (hour === 11) {
        await sendHabitNudges().catch(err => logger.warn({ err }, 'Habit nudge failed'));
      }
      // Weekly report every Sunday at 19:00 IST
      const istDate = new Date(new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 + 5.5 * 60 * 60 * 1000);
      if (hour === 19 && istDate.getDay() === 0) {
        const weekStart = new Date(istDate.getTime() - 7 * 86_400_000).getTime();
        const alreadySentWeekly = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'weekly_report' AND sent_at >= ?"
        ).get(user.id, weekStart) as { id: number } | undefined;
        if (!alreadySentWeekly) {
          await weeklyReport(user.id);
          await weeklyExpenseDigest(user.id);
        }
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
    recordProactiveMessage(userId, 'weekly_report', message);
    logger.info({ userId }, 'Weekly report sent');
    return message;
  } catch (err) {
    logger.warn({ err, userId }, 'Weekly report failed');
    return null;
  }
}

export async function weeklyExpenseDigest(userId: string): Promise<string | null> {
  if (!isProactiveEnabled(userId)) return null;
  try {
    // Check if expenses table exists
    const hasTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'"
    ).get() as { name: string } | undefined;
    if (!hasTable) return null;

    const weekStart = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total, currency,
             category, COUNT(*) AS cnt
      FROM expenses WHERE user_id = ? AND date >= ?
      GROUP BY category ORDER BY total DESC
    `).all(userId, weekStart) as Array<{ total: number; currency: string; category: string; cnt: number }>;

    if (!rows.length) return null;

    const currency = rows[0].currency;
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const catLines = rows.slice(0, 5).map(r => `  ${r.category}: ${currency}${r.total.toFixed(2)} (${r.cnt}x)`).join('\n');

    const message = [
      `💰 Weekly Expense Digest`,
      ``,
      `Total spent: ${currency}${grandTotal.toFixed(2)}`,
      ``,
      `By category:`,
      catLines,
      ``,
      `Type /expenses for full report.`,
    ].join('\n');

    await sendViaTelegram(userId, message);
    recordProactiveMessage(userId, 'weekly_report', message);
    logger.info({ userId, total: grandTotal }, 'Weekly expense digest sent');
    return message;
  } catch (err) {
    logger.warn({ err, userId }, 'Weekly expense digest failed');
    return null;
  }
}

// ── Reminder 30-min preview ──────────────────────────────────

async function sendReminderPreviews(): Promise<void> {
  const { cacheGet, cacheSet } = await import('./cache.js');
  const { sendTelegramNotification, escapeTelegramHtml: escHtml } = await import('./telegram.js');
  const now = Date.now();
  const windowStart = now + 25 * 60 * 1000;   // 25 min from now
  const windowEnd   = now + 35 * 60 * 1000;   // 35 min from now

  const users = db.prepare(`
    SELECT DISTINCT u.id, cl.external_id as chat_id
    FROM users u
    JOIN channel_links cl ON cl.user_id = u.id
    WHERE cl.channel = 'telegram' AND cl.is_verified = 1
  `).all() as Array<{id:string; chat_id:string}>;

  for (const user of users) {
    const upcoming = db.prepare(`
      SELECT id, text, scheduled_for FROM reminders
      WHERE user_id = ? AND completed = 0
      AND scheduled_for BETWEEN ? AND ?
      AND (preview_sent IS NULL OR preview_sent < ?)
    `).all(user.id, windowStart, windowEnd, now - 300_000) as Array<{id:number; text:string; scheduled_for:number}>;

    for (const r of upcoming) {
      // Redis dedup: don't preview same reminder twice
      const dedupKey = `preview:${r.id}`;
      const already = await cacheGet(dedupKey).catch(() => null);
      if (already) continue;

      const minutesLeft = Math.round((r.scheduled_for - now) / 60_000);
      await sendTelegramNotification(user.chat_id,
        `📌 <b>Heads up!</b> "${escHtml(r.text)}" is due in ~${minutesLeft} minutes`
      ).catch(() => {});

      try {
        db.prepare('UPDATE reminders SET preview_sent = ? WHERE id = ?').run(now, r.id);
        await cacheSet(dedupKey, '1', 3600);
      } catch { /* non-fatal */ }
    }
  }
}

// ── Habit idle nudge ─────────────────────────────────────────

async function sendHabitNudges(): Promise<void> {
  const { cacheGet, cacheSet } = await import('./cache.js');
  const { getHabitInsights } = await import('./habits.js');
  const { sendTelegramButtons } = await import('./telegram.js');

  const users = db.prepare(`
    SELECT DISTINCT u.id, cl.external_id as chat_id
    FROM users u
    JOIN channel_links cl ON cl.user_id = u.id
    WHERE cl.channel = 'telegram' AND cl.is_verified = 1
  `).all() as Array<{id:string; chat_id:string}>;

  const now = Math.floor(Date.now() / 1000);

  for (const user of users) {
    const rateLimitKey = `habit_nudge:${user.id}`;
    const alreadyNudged = await cacheGet(rateLimitKey).catch(() => null);
    if (alreadyNudged) continue;

    const insights = getHabitInsights(user.id);
    const idle = insights
      .filter(h => (h.status === 'at_risk' || h.status === 'broken') && h.daysSinceLast >= 2)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    if (!idle.length) continue;

    let nudgeSent = false;
    for (const habit of idle) {
      // Check if user has skipped this habit for the week
      const habitRow = db.prepare('SELECT skip_until FROM habits WHERE id = ?')
        .get(habit.id) as { skip_until: number | null } | undefined;
      if (habitRow?.skip_until && habitRow.skip_until > now) continue;

      const nudgeText = `Hey! Noticed "${habit.name}" has been quiet lately. Life gets busy 💙\n\nWant to adjust the schedule?`;

      await sendTelegramButtons(user.chat_id, nudgeText, [
        [
          { text: '💪 Keep Going', callback_data: `habit:keep:${habit.id}` },
          { text: '🌙 Move to Evening', callback_data: `habit:reschedule:evening:${habit.id}` },
        ],
        [
          { text: '⏭️ Skip This Week', callback_data: `habit:skip_week:${habit.id}` },
        ],
      ]).catch(() => {});

      nudgeSent = true;
      break; // one nudge per user per day
    }

    if (nudgeSent) {
      await cacheSet(rateLimitKey, '1', 86400).catch(() => {});
    }
  }
}

export function initProactiveEngine(): void {
  if (proactiveTimer) return;
  proactiveTimer = setInterval(() => {
    void runProactiveChecks();
  }, 60_000);
  logger.info('Proactive engine started (daily_briefing@08:00 IST, overdue_alert@10:00 IST, idle_check_in@08:00 IST, expense_digest@19:00 IST Sunday, 30min_preview, habit_nudge@11:00 IST)');
}
