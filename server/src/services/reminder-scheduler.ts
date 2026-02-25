// ============================================================
// Reminder Scheduler
//
// Checks every 5 seconds for due reminders and delivers them
// through the appropriate channel (Telegram, email, push).
//
// Drift tracking: logs drift_ms = actual_fire_time - scheduled_time
// Target: reminders fire within 30 seconds of scheduled time
//
// Snooze expiry: each tick first resumes reminders whose
// snooze_until has passed (clears snooze_until so the main
// query picks them up on the next tick).
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';
import { sendReminderEmail, resolveEmailAddress } from './email.js';

// ---- Types ----

interface DueReminder {
  id: string;
  user_id: string;
  text: string;
  datetime: string;
  channel: string;
  category: string;
  recurring: string;
  scheduled_for: number | null;
}

interface SnoozedReminder {
  id: string;
  user_id: string;
  text: string;
  snooze_until: number;
}

interface ChannelLink {
  external_id: string;
}

// ---- Scheduler ----

const POLL_INTERVAL_MS = 5_000; // 5 seconds for <=30s drift requirement
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(): void {
  if (schedulerInterval) return;

  // Run immediately on startup, then every 5 seconds
  checkAndDeliverReminders();
  schedulerInterval = setInterval(checkAndDeliverReminders, POLL_INTERVAL_MS);

  logger.info('Reminder scheduler started (5s interval)');
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
    const now = Date.now();

    // Step 1: Resume expired snoozes — clear snooze_until so the main
    // query picks them up on the next tick.
    const expiredSnoozes = db.prepare(`
      SELECT id, user_id, text, snooze_until
      FROM reminders
      WHERE completed = 0
        AND snooze_until IS NOT NULL
        AND snooze_until <= ?
    `).all(now) as SnoozedReminder[];

    if (expiredSnoozes.length > 0) {
      const resumeStmt = db.prepare(`UPDATE reminders SET snooze_until = NULL WHERE id = ?`);
      for (const r of expiredSnoozes) {
        resumeStmt.run(r.id);
        logger.debug(
          { reminderId: r.id, userId: r.user_id, snoozedUntil: r.snooze_until },
          'Reminder snooze expired — resumed',
        );
      }
      logger.info({ count: expiredSnoozes.length }, 'Snooze expiry cleanup: reminders resumed');
    }

    // Step 2: Fetch due reminders (skip still-snoozed ones)
    const dueReminders = db.prepare(`
      SELECT id, user_id, text, datetime, channel, category, recurring, scheduled_for
      FROM reminders
      WHERE completed = 0
        AND snooze_until IS NULL
        AND (
          (scheduled_for IS NOT NULL AND scheduled_for <= ?)
          OR
          (scheduled_for IS NULL AND datetime IS NOT NULL
           AND REPLACE(REPLACE(datetime, 'T', ' '), 'Z', '') <= datetime('now'))
        )
      ORDER BY
        CASE WHEN scheduled_for IS NOT NULL THEN scheduled_for ELSE 0 END ASC,
        datetime ASC
      LIMIT 50
    `).all(now) as DueReminder[];

    if (dueReminders.length === 0) return;

    logger.info({ count: dueReminders.length }, 'Processing due reminders');

    for (const reminder of dueReminders) {
      try {
        const fireTime = Date.now();
        const scheduledTime = reminder.scheduled_for || new Date(reminder.datetime).getTime();
        const driftMs = fireTime - scheduledTime;

        // Log drift for observability
        logger.info({
          reminderId: reminder.id,
          userId: reminder.user_id,
          scheduledFor: scheduledTime,
          firedAt: fireTime,
          driftMs,
          driftSeconds: Math.round(driftMs / 1000 * 10) / 10,
        }, 'Reminder firing');

        await deliverReminder(reminder);

        // Mark as completed with delivery tracking
        db.prepare(`
          UPDATE reminders
          SET completed = 1,
              delivered_at = ?,
              drift_ms = ?
          WHERE id = ?
        `).run(fireTime, driftMs, reminder.id);

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
      // Check if user has disabled reminder notifications
      const notifPref = db.prepare('SELECT notif_reminders FROM agent_configs WHERE user_id = ?').get(reminder.user_id) as { notif_reminders?: number } | undefined;
      if (notifPref && notifPref.notif_reminders === 0) {
        logger.info({ reminderId: reminder.id }, 'Telegram reminder skipped: notif_reminders disabled');
        break;
      }

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

      // Also send email if user has an address configured (best-effort)
      await tryEmailDelivery(reminder);
      break;
    }

    case 'email': {
      await tryEmailDelivery(reminder);
      break;
    }

    case 'push':
    default:
      // 35.3: Auto-push to Telegram if user has it connected + notif_reminders enabled
      await tryTelegramAutoDelivery(reminder);
      logger.debug({ reminderId: reminder.id, channel: reminder.channel }, 'Reminder completed (push channel)');
      break;
  }
}

/**
 * 35.3: Auto-deliver reminders via Telegram for push/default-channel reminders.
 * Sends if: user has a verified Telegram channel link AND notif_reminders != 0.
 */
async function tryTelegramAutoDelivery(reminder: DueReminder): Promise<void> {
  try {
    const notifPref = db.prepare('SELECT notif_reminders FROM agent_configs WHERE user_id = ?').get(reminder.user_id) as { notif_reminders?: number } | undefined;
    if (notifPref && notifPref.notif_reminders === 0) return;

    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
    ).get(reminder.user_id) as ChannelLink | undefined;

    if (!link) return;

    const result = await sendTelegramMessage(link.external_id, `⏰ Reminder: ${reminder.text}`);
    if (result.success) {
      logger.info({ reminderId: reminder.id, userId: reminder.user_id }, 'Reminder auto-delivered via Telegram (push channel)');
    }
  } catch (err) {
    logger.warn({ reminderId: reminder.id, err: (err as Error).message }, 'Telegram auto-delivery failed for reminder (non-fatal)');
  }
}

/**
 * Attempt email delivery for a reminder. Resolves the user's email address
 * from agent_configs (notification_email_address) or users.email.
 * Gracefully no-ops if no address or Resend not configured.
 */
async function tryEmailDelivery(reminder: DueReminder): Promise<void> {
  try {
    const emailAddress = resolveEmailAddress(reminder.user_id);
    if (!emailAddress) return;

    const sent = await sendReminderEmail(reminder.user_id, reminder.text);
    if (sent) {
      logger.info({ reminderId: reminder.id, userId: reminder.user_id }, 'Reminder delivered via email');
    }
  } catch (err) {
    logger.warn({ reminderId: reminder.id, err: (err as Error).message }, 'Email delivery failed for reminder (non-fatal)');
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
    const nextEpoch = next.getTime();

    db.prepare(`INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, completed, created_by, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'scheduler', ?)`).run(
      uuid(), reminder.user_id, reminder.text, nextStr,
      reminder.channel, reminder.category, reminder.recurring, nextEpoch,
    );
    logger.info({ reminderId: reminder.id, nextAt: nextStr, scheduledFor: nextEpoch }, 'Recurring reminder rescheduled');
  }
}

// ---- Dev/Test Helpers ----

/**
 * Schedule a test reminder that fires in specified seconds.
 * Returns the reminder ID for tracking.
 */
export function scheduleTestReminder(userId: string, seconds: number): string {
  const id = uuid();
  const scheduledFor = Date.now() + seconds * 1000;
  const datetime = new Date(scheduledFor).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

  db.prepare(`
    INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by, scheduled_for)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'test', ?)
  `).run(id, userId, `Test reminder (${seconds}s)`, datetime, 'push', 'test', scheduledFor);

  logger.info({ reminderId: id, userId, scheduledFor, seconds }, 'Test reminder scheduled');
  return id;
}

/**
 * Get drift statistics for reminders fired in the last N hours.
 */
export function getReminderDriftStats(hours: number = 24): {
  count: number;
  avgDriftMs: number;
  maxDriftMs: number;
  withinTolerance: number;
} {
  const since = Date.now() - hours * 3600_000;

  const stats = db.prepare(`
    SELECT
      COUNT(*) as count,
      AVG(drift_ms) as avg_drift,
      MAX(drift_ms) as max_drift,
      SUM(CASE WHEN drift_ms <= 30000 THEN 1 ELSE 0 END) as within_tolerance
    FROM reminders
    WHERE delivered_at >= ? AND drift_ms IS NOT NULL
  `).get(since) as {
    count: number;
    avg_drift: number | null;
    max_drift: number | null;
    within_tolerance: number;
  };

  return {
    count: stats.count || 0,
    avgDriftMs: Math.round(stats.avg_drift || 0),
    maxDriftMs: stats.max_drift || 0,
    withinTolerance: stats.within_tolerance || 0,
  };
}
