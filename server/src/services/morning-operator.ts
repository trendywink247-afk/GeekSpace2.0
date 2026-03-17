// ============================================================
// Morning Operator — Daily 8am IST voice briefing via Telegram
// Runs: reminders due today, unread inbox, habit check,
//       Jarvis sign-off with motivational close.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { routeChat } from './llm.js';
import { sendTelegramNotification } from './telegram.js';
import { logActivity } from './activity-log.js';

const IST_OFFSET_HOURS = 5.5;

function getISTHour(): number {
  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  return (utcHours + IST_OFFSET_HOURS) % 24;
}

export async function deliverMorningBriefing(userId: string): Promise<void> {
  logger.info({ userId }, 'Morning Operator: generating briefing');

  try {
    // 1. Reminders due today
    const today = new Date().toISOString().slice(0, 10);
    const reminders = db.prepare(
      `SELECT text, datetime FROM reminders
       WHERE user_id = ? AND date(datetime) = ? AND completed = 0
       ORDER BY datetime ASC LIMIT 5`
    ).all(userId, today) as { text: string; datetime: string }[];

    // 2. Unread inbox count (table may not exist for all users)
    let unreadCount = 0;
    try {
      const unread = db.prepare(
        `SELECT COUNT(*) as cnt FROM activity_log WHERE user_id = ? AND date(created_at) = ? AND action LIKE '%received%'`
      ).get(userId, today) as { cnt: number };
      unreadCount = unread.cnt;
    } catch { /* table may not exist */ }

    // 3. Habits due today
    const habits = db.prepare(
      `SELECT name FROM habits WHERE user_id = ? AND is_active = 1 LIMIT 3`
    ).all(userId) as { name: string }[];

    // 4. Build briefing prompt
    const reminderText = reminders.length > 0
      ? `Reminders today: ${reminders.map(r => r.text).join(', ')}.`
      : 'No reminders today.';

    const activityText = unreadCount > 0
      ? `${unreadCount} activity events since yesterday.`
      : 'Quiet day so far.';

    const habitText = habits.length > 0
      ? `Habits to check off: ${habits.map(h => h.name).join(', ')}.`
      : '';

    const prompt = `You are Jarvis, giving a warm morning briefing. Keep it under 60 words, conversational, no bullet points. Data: ${reminderText} ${activityText} ${habitText} End with a motivating one-liner.`;

    const result = await routeChat(
      [{ role: 'user', content: 'Morning briefing please.' }],
      { systemPrompt: prompt, agentName: 'Jarvis', userId, userCredits: 999 }
    );

    const briefingText = result.reply;

    // Get user's Telegram chat ID
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 LIMIT 1"
    ).get(userId) as { external_id: string } | undefined;

    if (!link?.external_id) {
      logger.debug({ userId }, 'Morning Operator: no Telegram link — skipping');
      return;
    }

    await sendTelegramNotification(link.external_id, `Good morning!\n\n${briefingText}`);
    logActivity(userId, 'Morning briefing', 'Daily operator briefing delivered', 'clock');
    logger.info({ userId }, 'Morning Operator: briefing delivered');
  } catch (err) {
    logger.error({ err, userId }, 'Morning Operator: failed to deliver briefing');
  }
}

// ---- Scheduler tick ----
// Call from the main scheduler loop. Fires for all users at their 8am IST.
export async function runMorningOperatorTick(): Promise<void> {
  const istHour = getISTHour();
  // Fire between 8:00 and 8:05 IST
  if (istHour < 8 || istHour >= 8.085) return;

  const today = new Date().toISOString().slice(0, 10);
  const users = db.prepare(
    `SELECT DISTINCT cl.user_id FROM channel_links cl
     WHERE cl.channel = 'telegram' AND cl.is_verified = 1
     AND NOT EXISTS (
       SELECT 1 FROM activity_log al
       WHERE al.user_id = cl.user_id
       AND al.action = 'Morning briefing'
       AND date(al.created_at) = ?
     )
     LIMIT 50`
  ).all(today) as { user_id: string }[];

  for (const user of users) {
    await deliverMorningBriefing(user.user_id).catch(() => {});
  }
}
