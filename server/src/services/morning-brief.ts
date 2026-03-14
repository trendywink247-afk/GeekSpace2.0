// ============================================================
// Smart Morning Brief v2
//
// Assembles a rich, personalized daily briefing with inline
// keyboard buttons for quick actions (habit logging, reminders,
// focus start). Called by the proactive engine at 8am user-local.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

export async function assembleMorningBrief(userId: string): Promise<{
  text: string;
  buttons: Array<Array<{ text: string; callback_data: string }>>;
}> {
  const user = db.prepare('SELECT name, timezone FROM users WHERE id = ?').get(userId) as { name: string; timezone?: string } | undefined;
  if (!user) return { text: '', buttons: [] };

  const firstName = (user.name || 'there').split(' ')[0];
  const tz = user.timezone || 'Asia/Kolkata';

  // Get today's date in user's timezone
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD format
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' });

  // 1. Reminders due today
  const todayReminders = db.prepare(`
    SELECT id, text, datetime FROM reminders
    WHERE user_id = ? AND completed = 0 AND datetime LIKE ? || '%'
    ORDER BY datetime ASC
  `).all(userId, todayStr) as Array<{ id: string; text: string; datetime: string }>;

  // 2. Overdue reminders
  const overdueCount = (db.prepare(`
    SELECT COUNT(*) as c FROM reminders
    WHERE user_id = ? AND completed = 0 AND datetime < ? AND datetime IS NOT NULL
  `).get(userId, todayStr) as { c: number })?.c ?? 0;

  // 3. Upcoming this week (next 7 days, excluding today)
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const weekReminders = db.prepare(`
    SELECT text, datetime FROM reminders
    WHERE user_id = ? AND completed = 0 AND datetime > ? AND datetime <= ?
    ORDER BY datetime ASC LIMIT 5
  `).all(userId, todayStr + ' 23:59:59', weekEnd) as Array<{ text: string; datetime: string }>;

  // 4. Habits with streaks
  const habits = db.prepare(`
    SELECT id, name, current_streak FROM habits WHERE user_id = ?
  `).all(userId) as Array<{ id: number; name: string; current_streak: number }>;

  // 5. Which habits are NOT logged today
  // habit_logs.logged_at is millisecond epoch — compute today's start in ms
  const todayStartMs = new Date(todayStr + 'T00:00:00').getTime();
  const unloggedHabits = habits.filter(h => {
    const logged = db.prepare(`
      SELECT id FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_at >= ?
    `).get(h.id, userId, todayStartMs);
    return !logged;
  });

  // 6. Expenses this month vs last month
  const monthStart = todayStr.slice(0, 7) + '-01';
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStart = lastMonthDate.toISOString().slice(0, 7) + '-01';
  const lastMonthEnd = todayStr.slice(0, 7) + '-01';

  const thisMonthTotal = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ?'
  ).get(userId, monthStart) as { total: number })?.total ?? 0;

  const lastMonthTotal = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ? AND date < ?'
  ).get(userId, lastMonthStart, lastMonthEnd) as { total: number })?.total ?? 0;

  // 7. Recent memory
  const recentMemory = db.prepare(
    'SELECT key, value FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
  ).get(userId) as { key: string; value: string } | undefined;

  // ── Build the message ──────────────────────────────────────
  const sections: string[] = [];
  sections.push(`Good morning ${firstName}! \u2600\uFE0F\n`);
  sections.push(`\u{1F4C5} *TODAY* \u2014 ${dateStr}, ${dayOfWeek}`);

  if (todayReminders.length > 0) {
    const lines = todayReminders.map(r => {
      const time = r.datetime ? new Date(r.datetime).toLocaleTimeString('en-IN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }) : '';
      return `  \u2022 ${r.text}${time ? ' at ' + time : ''}`;
    });
    sections.push(`\n\u23F0 *Reminders due today:*\n${lines.join('\n')}`);
  }

  if (unloggedHabits.length > 0) {
    const lines = unloggedHabits.map(h => {
      const streak = h.current_streak > 0 ? ` \u2014 ${h.current_streak}-day streak \u{1F525}` : '';
      return `  \u2022 ${h.name}${streak}`;
    });
    sections.push(`\n\u{1F4AA} *Habits to complete:*\n${lines.join('\n')}`);
  }

  if (overdueCount > 0) {
    sections.push(`\n\u26A0\uFE0F ${overdueCount} overdue reminder${overdueCount > 1 ? 's' : ''}`);
  }

  if (weekReminders.length > 0) {
    const lines = weekReminders.slice(0, 3).map(r => {
      const day = new Date(r.datetime).toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
      return `  \u2022 ${r.text} (${day})`;
    });
    sections.push(`\n\u{1F4C6} *This week:*\n${lines.join('\n')}`);
  }

  if (thisMonthTotal > 0) {
    let expLine = `\n\u{1F4B0} *This month:* \u20B9${Math.round(thisMonthTotal).toLocaleString('en-IN')}`;
    if (lastMonthTotal > 0) {
      const pct = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
      const arrow = pct > 0 ? '\u2191' : pct < 0 ? '\u2193' : '\u2192';
      expLine += ` (${arrow}${Math.abs(pct)}% vs last month)`;
    }
    sections.push(expLine);
  }

  // 8. Gmail inbox summary (if connected)
  try {
    const gmailToken = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?').get(userId) as { google_gmail_token: string | null } | undefined;
    if (gmailToken?.google_gmail_token) {
      const unreadCount = (db.prepare(
        'SELECT COUNT(*) as c FROM gmail_messages WHERE user_id = ? AND synced_at >= ?'
      ).get(userId, Date.now() - 24 * 3600_000) as { c: number })?.c ?? 0;

      if (unreadCount > 0) {
        // Get top 3 most recent
        const recent = db.prepare(`
          SELECT sender, subject FROM gmail_messages
          WHERE user_id = ? ORDER BY synced_at DESC LIMIT 3
        `).all(userId) as Array<{ sender: string; subject: string }>;

        const lines = recent.map(m => `  \u2022 ${m.sender?.split('<')[0]?.trim() || 'Unknown'}: ${m.subject?.slice(0, 50) || '(no subject)'}`);
        sections.push(`\n\u{1F4E7} *Inbox:* ${unreadCount} new email${unreadCount > 1 ? 's' : ''}\n${lines.join('\n')}`);
      }
    }
  } catch { /* Gmail not connected — skip */ }

  if (recentMemory) {
    sections.push(`\n\u{1F9E0} I remember: ${recentMemory.key} \u2014 ${recentMemory.value.slice(0, 80)}`);
  }

  if (unloggedHabits.length > 0) {
    sections.push('\nQuick actions below \u{1F447}');
  }

  // ── Build buttons ──────────────────────────────────────────
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  // Row 1: unlogged habits (max 3 per row)
  if (unloggedHabits.length > 0) {
    const habitButtons = unloggedHabits.slice(0, 3).map(h => ({
      text: `\u2705 ${h.name}`,
      callback_data: `hab_logged:${h.id}`,
    }));
    buttons.push(habitButtons);
  }

  // Row 2: utility buttons
  const utilRow: Array<{ text: string; callback_data: string }> = [];
  if (todayReminders.length > 0) {
    utilRow.push({ text: '\u{1F4CB} Reminders', callback_data: 'brief_show_reminders' });
  }
  utilRow.push({ text: '\u{1F3AF} Focus', callback_data: 'brief_start_focus' });
  buttons.push(utilRow);

  const text = sections.join('\n');

  logger.info({
    userId,
    remindersToday: todayReminders.length,
    overdue: overdueCount,
    habitsTotal: habits.length,
    habitsUnlogged: unloggedHabits.length,
    expenseThisMonth: thisMonthTotal,
  }, 'Smart Morning Brief v2 assembled');

  return { text, buttons };
}
