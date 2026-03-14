// Proactive AI Engine -- Phase 90
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { getTodayEvents } from './calendar-sync.js';
import { textToSpeech, sendTelegramVoice } from './voice.js';
import { eventBus } from './event-bus.js';

export type ProactiveMessageType = 'daily_briefing' | 'overdue_alert' | 'idle_check_in' | 'weekly_report' | 'streak_milestone' | 'expense_spike';

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

type ProactiveType = 'daily_briefing' | 'overdue_alert' | 'habit_nudge' | 'idle_check_in' | 'weekly_report' | 'streak_milestone' | 'expense_spike';

function isTypeEnabled(userId: string, type: ProactiveType): boolean {
  if (!isProactiveEnabled(userId)) return false;
  try {
    const row = db.prepare('SELECT proactive_preferences FROM agent_configs WHERE user_id = ?')
      .get(userId) as { proactive_preferences: string } | undefined;
    if (!row?.proactive_preferences) return true;
    const prefs = JSON.parse(row.proactive_preferences);
    return prefs[type] !== false;
  } catch {
    return true;
  }
}

const MAX_PROACTIVE_PER_DAY = 8;
const MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function isThrottled(userId: string): boolean {
  try {
    const dayAgo = Date.now() - 86_400_000;
    const todayCount = (db.prepare(
      'SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND sent_at >= ?'
    ).get(userId, dayAgo) as { c: number })?.c ?? 0;
    if (todayCount >= MAX_PROACTIVE_PER_DAY) return true;

    const lastSent = db.prepare(
      'SELECT sent_at FROM proactive_messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 1'
    ).get(userId) as { sent_at: number } | undefined;
    if (lastSent && (Date.now() - lastSent.sent_at) < MIN_INTERVAL_MS) return true;

    return false;
  } catch {
    return false;
  }
}

export async function dailyBriefing(userId: string): Promise<string | null> {
  if (!isTypeEnabled(userId, 'daily_briefing')) return null;

  // Try Smart Morning Brief v2 first — rich briefing with inline buttons
  try {
    const { assembleMorningBrief } = await import('./morning-brief.js');
    const brief = await assembleMorningBrief(userId);
    if (brief.text) {
      const { sendTelegramButtons } = await import('./telegram.js');
      const link = db.prepare(
        "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
      ).get(userId) as { external_id: string } | undefined;
      if (link) {
        await sendTelegramButtons(link.external_id, brief.text, brief.buttons);
        recordProactiveMessage(userId, 'daily_briefing', brief.text);
        return brief.text;
      }
    }
  } catch (err) {
    logger.debug({ err }, 'Smart Morning Brief failed, falling back to template');
  }
  // ... existing template-based briefing continues as fallback

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
  if (!isTypeEnabled(userId, 'overdue_alert')) return null;
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
  if (!isTypeEnabled(userId, 'idle_check_in')) return null;
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
  if (!isTypeEnabled(userId, 'streak_milestone')) return;
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

function getUserHour(timezone: string): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
    10
  );
}

function getUserMinute(timezone: string): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: timezone, minute: 'numeric' }),
    10
  );
}

function getUserDateStr(timezone: string): string {
  const d = new Date();
  const year = d.toLocaleString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = d.toLocaleString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = d.toLocaleString('en-US', { timeZone: timezone, day: '2-digit' });
  return `${year}-${month}-${day}`;
}

async function runProactiveChecks(): Promise<void> {
  // Reminder previews run every 30 min — timezone-independent
  // Use a reasonable default timezone just for the minute check
  const globalMinute = getUserMinute('Asia/Kolkata');
  if (globalMinute === 0 || globalMinute === 30) {
    await sendReminderPreviews().catch(err => logger.warn({ err }, 'Reminder preview failed'));
  }

  if (globalMinute !== 0) return;

  let users: Array<{ id: string; timezone?: string }> = [];
  try {
    users = db.prepare('SELECT id, timezone FROM users WHERE proactive_enabled != 0').all() as Array<{ id: string; timezone?: string }>;
  } catch {
    users = db.prepare('SELECT id, timezone FROM users').all() as Array<{ id: string; timezone?: string }>;
  }

  for (const user of users) {
    try {
      if (isThrottled(user.id)) continue;

      const tz = user.timezone || 'Asia/Kolkata';
      const hour = getUserHour(tz);
      const todayStr = getUserDateStr(tz);
      const dayStart = new Date(todayStr + 'T00:00:00Z').getTime();

      // Daily briefing at 8am user-local
      if (hour === 8) {
        const alreadySent = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'daily_briefing' AND sent_at >= ?"
        ).get(user.id, dayStart) as { id: number } | undefined;
        if (!alreadySent) await dailyBriefing(user.id);
      }

      // Overdue alert at 10am user-local
      if (hour === 10) {
        const alreadySent = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'overdue_alert' AND sent_at >= ?"
        ).get(user.id, dayStart) as { id: number } | undefined;
        if (!alreadySent) await overdueAlert(user.id);
      }

      // Idle check-in at 8am user-local
      if (hour === 8) {
        const alreadySentIdle = db.prepare(
          "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'idle_check_in' AND sent_at >= ?"
        ).get(user.id, dayStart) as { id: number } | undefined;
        if (!alreadySentIdle) await idleCheckIn(user.id);
      }

      // Habit nudge at 11am user-local
      if (hour === 11) {
        await sendHabitNudges().catch(err => logger.warn({ err }, 'Habit nudge failed'));
      }

      // Weekly report on Sunday at 7pm user-local
      if (hour === 19) {
        const userDate = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
        if (userDate.getDay() === 0) {
          const weekStart = Date.now() - 7 * 86_400_000;
          const alreadySentWeekly = db.prepare(
            "SELECT id FROM proactive_messages WHERE user_id = ? AND type = 'weekly_report' AND sent_at >= ?"
          ).get(user.id, weekStart) as { id: number } | undefined;
          if (!alreadySentWeekly) {
            await weeklyReport(user.id);
            await weeklyExpenseDigest(user.id);
          }
        }
      }
    } catch (err) {
      logger.warn({ err, userId: user.id }, 'Proactive check failed for user');
    }
  }
}


export async function weeklyReport(userId: string): Promise<string | null> {
  if (!isTypeEnabled(userId, 'weekly_report')) return null;
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
  if (!isTypeEnabled(userId, 'weekly_report')) return null;
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
    if (isThrottled(user.id)) continue;
    if (!isTypeEnabled(user.id, 'habit_nudge')) continue;
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

export async function initProactiveEngine(): Promise<void> {
  if (proactiveTimer) return;
  proactiveTimer = setInterval(() => {
    void runProactiveChecks();
  }, 60_000);

  // Event-driven proactive messages
  eventBus.on('streak.milestone', async ({ userId, habitName, streak }) => {
    if (!isTypeEnabled(userId, 'streak_milestone') || isThrottled(userId)) return;
    const emojis = streak >= 30 ? '\u{1F3C6}\u{1F525}' : streak >= 21 ? '\u{1F525}\u{1F4AA}' : '\u{1F4AA}\u2728';
    const msg = `${emojis} ${streak}-day streak on "${habitName}"! You're building something real. Keep it up!`;
    const sent = await sendViaTelegram(userId, msg);
    if (sent) recordProactiveMessage(userId, 'streak_milestone', msg);
    logger.info({ userId: userId.slice(0, 8), habitName, streak }, 'Streak milestone fired');
  });

  eventBus.on('expense.spike', async ({ userId, amount, category, averageForCategory }) => {
    if (!isTypeEnabled(userId, 'expense_spike') || isThrottled(userId)) return;
    const ratio = Math.round(amount / averageForCategory);
    const msg = `\u{1F4CA} Heads up \u2014 you just logged \u20B9${amount} on ${category}. Your monthly average for ${category} is \u20B9${averageForCategory}. That's ${ratio}x the usual.`;
    const sent = await sendViaTelegram(userId, msg);
    if (sent) recordProactiveMessage(userId, 'expense_spike', msg);
    logger.info({ userId: userId.slice(0, 8), category, amount }, 'Expense spike alert fired');
  });

  // ── Durable scheduler: restart-safe job queue ──────────────
  try {
    const { startJobRunner, registerHandler, scheduleRecurringDaily, scheduleJob } = await import('./durable-scheduler.js');

    // Register handlers for durable jobs
    registerHandler('morning_brief', async (job) => {
      if (!isTypeEnabled(job.userId, 'daily_briefing') || isThrottled(job.userId)) return;
      await dailyBriefing(job.userId);
      // Reschedule for tomorrow
      const tz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(job.userId) as { timezone?: string })?.timezone || 'Asia/Kolkata';
      scheduleRecurringDaily(job.userId, 'morning_brief', 8, tz);
    });

    registerHandler('overdue_alert', async (job) => {
      if (!isTypeEnabled(job.userId, 'overdue_alert') || isThrottled(job.userId)) return;
      await overdueAlert(job.userId);
      const tz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(job.userId) as { timezone?: string })?.timezone || 'Asia/Kolkata';
      scheduleRecurringDaily(job.userId, 'overdue_alert', 10, tz);
    });

    registerHandler('habit_nudge', async (job) => {
      if (!isTypeEnabled(job.userId, 'habit_nudge') || isThrottled(job.userId)) return;
      await sendHabitNudges();
      const tz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(job.userId) as { timezone?: string })?.timezone || 'Asia/Kolkata';
      scheduleRecurringDaily(job.userId, 'habit_nudge', 21, tz); // 9pm nudge
    });

    registerHandler('weekly_report', async (job) => {
      if (!isTypeEnabled(job.userId, 'weekly_report') || isThrottled(job.userId)) return;
      await weeklyReport(job.userId);
      await weeklyExpenseDigest(job.userId);
      // Reschedule for next Sunday 7pm
      const tz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(job.userId) as { timezone?: string })?.timezone || 'Asia/Kolkata';
      const nextSunday = Date.now() + 7 * 86_400_000;
      scheduleJob(job.userId, 'weekly_report', nextSunday, {}, { dedupeKey: `weekly_report:${job.userId}:${new Date(nextSunday).toISOString().slice(0, 10)}` });
    });

    registerHandler('page_monitor', async (job) => {
      const monId = job.payload.monitorId as string;
      if (!monId) return;

      const monitor = db.prepare('SELECT * FROM page_monitors WHERE id = ? AND enabled = 1').get(monId) as any;
      if (!monitor) return;

      try {
        const { createHash } = await import('crypto');
        const { navigatePage } = await import('./browser-agent.js');
        const result = await navigatePage(monitor.url);
        if (result.error) return;

        const contentHash = createHash('md5').update(result.text?.slice(0, 5000) || '').digest('hex');

        if (monitor.last_content_hash && contentHash !== monitor.last_content_hash) {
          // Content changed! Alert the user
          const msg = `\u{1F441}\uFE0F Page changed: ${monitor.url}\n${monitor.check_for ? `Watching for: "${monitor.check_for}"` : 'Content has been updated.'}`;
          await sendViaTelegram(monitor.user_id, msg);
          db.prepare('UPDATE page_monitors SET last_content_hash = ?, last_checked_at = ?, alert_count = alert_count + 1 WHERE id = ?')
            .run(contentHash, Date.now(), monId);
        } else {
          db.prepare('UPDATE page_monitors SET last_content_hash = ?, last_checked_at = ? WHERE id = ?')
            .run(contentHash, Date.now(), monId);
        }

        // Reschedule next check
        scheduleJob(monitor.user_id, 'page_monitor', Date.now() + monitor.frequency_hours * 3600000, { monitorId: monId }, { dedupeKey: `pagemon:${monId}` });
      } catch (err) {
        logger.warn({ err, monitorId: monId }, 'Page monitor check failed');
      }
    });

    // Start the runner (polls every 30s for due jobs)
    startJobRunner(30_000);

    // Seed initial recurring jobs for all proactive-enabled users
    try {
      const users = db.prepare('SELECT id, timezone FROM users WHERE proactive_enabled != 0').all() as Array<{ id: string; timezone?: string }>;
      for (const user of users) {
        const tz = user.timezone || 'Asia/Kolkata';
        scheduleRecurringDaily(user.id, 'morning_brief', 8, tz);
        scheduleRecurringDaily(user.id, 'overdue_alert', 10, tz);
        scheduleRecurringDaily(user.id, 'habit_nudge', 21, tz);
      }
      logger.info({ userCount: users.length }, 'Seeded recurring durable jobs');
    } catch (err) {
      logger.warn({ err }, 'Failed to seed durable jobs (non-fatal)');
    }
  } catch (err) {
    logger.warn({ err }, 'Durable scheduler init failed (falling back to setInterval only)');
  }

  logger.info('Proactive engine started (setInterval + durable scheduler — per-user timezone)');
}
