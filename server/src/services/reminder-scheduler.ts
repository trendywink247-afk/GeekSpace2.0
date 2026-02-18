// ============================================================
// Reminder Scheduler
//
// Checks every 30 seconds for due reminders and delivers them
// through the appropriate channel (Telegram, email, push).
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';

// ---- Types ----

interface DueReminder {
  id: string;
  user_id: string;
  text: string;
  datetime: string;
  channel: string;
  category: string;
  recurring: string;
}

interface ChannelLink {
  external_id: string;
}

// ---- Scheduler ----

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(): void {
  if (schedulerInterval) return;

  // Run immediately on startup, then every 30 seconds
  checkAndDeliverReminders();
  schedulerInterval = setInterval(checkAndDeliverReminders, 30_000);

  logger.info('Reminder scheduler started (30s interval)');
}

export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

// ---- Core Logic ----

async function checkAndDeliverReminders(): Promise<void> {
  try {
    const dueReminders = db.prepare(`
      SELECT id, user_id, text, datetime, channel, category, recurring
      FROM reminders
      WHERE datetime IS NOT NULL
        AND REPLACE(REPLACE(datetime, 'T', ' '), 'Z', '') <= datetime('now')
        AND completed = 0
      ORDER BY datetime ASC
      LIMIT 20
    `).all() as DueReminder[];

    if (dueReminders.length === 0) return;

    logger.info({ count: dueReminders.length }, 'Processing due reminders');

    for (const reminder of dueReminders) {
      try {
        await deliverReminder(reminder);

        // Mark as completed
        db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(reminder.id);

        // Handle recurring reminders
        if (reminder.recurring) {
          scheduleNextRecurrence(reminder);
        }
      } catch (err) {
        logger.error({ reminderId: reminder.id, err: (err as Error).message }, 'Failed to deliver reminder');
      }
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Reminder scheduler tick failed');
  }
}

// ---- Delivery ----

async function deliverReminder(reminder: DueReminder): Promise<void> {
  const message = `⏰ Reminder: ${reminder.text}`;

  switch (reminder.channel) {
    case 'telegram': {
      const link = db.prepare(
        "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
      ).get(reminder.user_id) as ChannelLink | undefined;

      if (link) {
        const result = await sendTelegramMessage(link.external_id, message);
        if (result.success) {
          logger.info({ reminderId: reminder.id, userId: reminder.user_id }, 'Reminder delivered via Telegram');
        } else {
          logger.warn({ reminderId: reminder.id }, 'Telegram delivery failed for reminder');
        }
      } else {
        logger.warn({ reminderId: reminder.id, userId: reminder.user_id }, 'No Telegram link for reminder delivery');
      }
      break;
    }

    case 'push':
    default:
      // Push notifications not yet implemented — log and complete
      logger.debug({ reminderId: reminder.id, channel: reminder.channel }, 'Reminder completed (no delivery channel)');
      break;
  }
}

// ---- Recurring Logic ----

function scheduleNextRecurrence(reminder: DueReminder): void {
  if (!reminder.recurring || !reminder.datetime) return;

  const current = new Date(reminder.datetime);
  let next: Date;

  switch (reminder.recurring) {
    case 'daily':
      next = new Date(current.getTime() + 24 * 3600_000);
      break;
    case 'weekly':
      next = new Date(current.getTime() + 7 * 24 * 3600_000);
      break;
    case 'monthly':
      next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return;
  }

  if (next.getTime() > Date.now()) {
    const nextStr = next.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    db.prepare(`INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, completed, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'scheduler')`).run(
      uuid(), reminder.user_id, reminder.text, nextStr,
      reminder.channel, reminder.category, reminder.recurring,
    );
    logger.info({ reminderId: reminder.id, nextAt: nextStr }, 'Recurring reminder rescheduled');
  }
}
