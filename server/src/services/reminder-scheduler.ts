/**
 * Reminder Scheduler
 *
 * Polls the `reminders` table every 5 seconds for due items and
 * delivers them through the user's preferred channel (Telegram,
 * email, or push notification). Designed for single-process
 * deployments with SQLite.
 *
 * **Timing guarantees:**
 * - Poll interval: 5 seconds (`POLL_INTERVAL_MS`)
 * - Target drift: reminders fire within 30 seconds of `scheduled_for`
 * - Drift is logged per delivery for monitoring
 *
 * **Per-tick pipeline:**
 *  1. Send 5-minute "heads-up" alerts for upcoming reminders (Telegram only)
 *  2. Resume reminders whose `snooze_until` has expired
 *  3. Query due reminders (completed = 0, scheduled_for <= now)
 *  4. Deliver each via the appropriate channel
 *  5. Mark as completed, or compute next occurrence for recurring items
 *
 * **Recurring reminders:** When a recurring reminder fires, its
 * `datetime` and `scheduled_for` are advanced to the next occurrence
 * (via `computeNextOccurrence`) rather than being marked completed.
 *
 * @module services/reminder-scheduler
 */

import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';
import { sendReminderEmail, resolveEmailAddress } from './email.js';
import { computeNextOccurrence } from '../routes/reminders.js';

// ---- Types ----

interface DueReminder {
  id: string;
  user_id: string;
  text: string;
  datetime: string;
  channel: string;
  category: string;
  recurring: string;
  recurrence: string | null;
  scheduled_for: number | null;
  priority: string | null;
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

/**
 * Start the reminder polling loop.
 *
 * Runs the first tick immediately, then schedules subsequent ticks
 * every 5 seconds via `setInterval`. Calling this function multiple
 * times is safe -- subsequent calls are no-ops if the scheduler is
 * already running.
 *
 * @see {@link stopReminderScheduler} to cleanly shut down the loop
 */
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

// 40.6: 5-minute remind-before alert
const REMIND_BEFORE_MS = 5 * 60 * 1000; // 5 minutes

async function checkAndDeliverReminders(): Promise<void> {
  try {
    const now = Date.now();

    // Step 0 (40.6): Send early "heads-up" for reminders due in the next 5–10 minutes
    // Only for users with Telegram linked; only sent once per reminder.
    try {
      const horizon = now + REMIND_BEFORE_MS + POLL_INTERVAL_MS; // 5min + 5s lookahead
      const upcoming = db.prepare(`
        SELECT id, user_id, text, scheduled_for, datetime
        FROM reminders
        WHERE completed = 0
          AND snooze_until IS NULL
          AND remind_before_sent_at IS NULL
          AND (
            (scheduled_for IS NOT NULL AND scheduled_for > ? AND scheduled_for <= ?)
            OR
            (scheduled_for IS NULL AND datetime IS NOT NULL
             AND REPLACE(REPLACE(datetime, 'T', ' '), 'Z', '') > datetime('now')
             AND REPLACE(REPLACE(datetime, 'T', ' '), 'Z', '') <= datetime('now', '+5 minutes'))
          )
        LIMIT 20
      `).all(now, horizon) as Array<{ id: string; user_id: string; text: string; scheduled_for: number | null; datetime: string }>;

      for (const rem of upcoming) {
        try {
          const link = db.prepare(
            "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
          ).get(rem.user_id) as { external_id: string } | undefined;
          if (link) {
            const notifPref = db.prepare('SELECT notif_reminders FROM agent_configs WHERE user_id = ?').get(rem.user_id) as { notif_reminders?: number } | undefined;
            if (!notifPref || notifPref.notif_reminders !== 0) {
              await sendTelegramMessage(link.external_id, `⏳ Heads up! Reminder in ~5 min: ${rem.text}`);
              logger.info({ reminderId: rem.id }, 'Remind-before alert sent');
            }
          }
          db.prepare('UPDATE reminders SET remind_before_sent_at = ? WHERE id = ?').run(now, rem.id);
        } catch (err) {
          logger.debug({ reminderId: rem.id, err: (err as Error).message }, 'Remind-before send failed');
        }
      }
    } catch { /* non-fatal — don't block main delivery */ }

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
      SELECT id, user_id, text, datetime, channel, category, recurring, recurrence, scheduled_for, priority
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
        const scheduledTime = reminder.scheduled_for || (reminder.datetime ? new Date(reminder.datetime).getTime() : Date.now());
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

        // Handle recurring reminders (check both legacy and new fields)
        if (reminder.recurring || reminder.recurrence) {
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
  // Look up user timezone for local time display in notification
  const userRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(reminder.user_id) as { timezone?: string } | undefined;
  const userTimezone = userRow?.timezone || 'Asia/Kolkata';

  let timeDisplay = '';
  if (reminder.datetime) {
    try {
      const localTime = DateTime.fromISO(reminder.datetime.replace(' ', 'T') + (reminder.datetime.includes('T') ? '' : 'Z'), { zone: 'UTC' }).setZone(userTimezone);
      timeDisplay = ` (${localTime.toFormat('h:mm a z')})`;
    } catch {
      // non-fatal — skip time display if datetime is malformed
    }
  }
  const message = `⏰ Reminder${timeDisplay}: ${reminder.text}`;

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
          // 78.7: sendTelegramMessage already retries 3x internally; log to dead_letters on final failure
          logger.warn({ reminderId: reminder.id }, 'Telegram delivery failed for reminder — writing to dead_letters');
          try {
            db.prepare(`
              INSERT INTO reminder_dead_letters (id, reminder_id, user_id, channel, error, attempts, last_attempt_at)
              VALUES (?, ?, ?, 'telegram', 'send_failed_after_retries', 3, datetime('now'))
            `).run(uuid(), reminder.id, reminder.user_id);
          } catch (dlErr) {
            logger.error({ reminderId: reminder.id, err: (dlErr as Error).message }, 'Failed to write reminder dead letter');
          }
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

    // Build message with local time display for auto-delivery too
    const autoUserRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(reminder.user_id) as { timezone?: string } | undefined;
    const autoTimezone = autoUserRow?.timezone || 'Asia/Kolkata';
    let autoTimeDisplay = '';
    if (reminder.datetime) {
      try {
        const localTime = DateTime.fromISO(reminder.datetime.replace(' ', 'T') + (reminder.datetime.includes('T') ? '' : 'Z'), { zone: 'UTC' }).setZone(autoTimezone);
        autoTimeDisplay = ` (${localTime.toFormat('h:mm a z')})`;
      } catch { /* non-fatal */ }
    }
    const result = await sendTelegramMessage(link.external_id, `⏰ Reminder${autoTimeDisplay}: ${reminder.text}`);
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

export function scheduleNextRecurrence(reminder: DueReminder): void {
  // Support both legacy `recurring` field and newer `recurrence` field
  const recurField = reminder.recurrence || reminder.recurring;
  if (!recurField || !reminder.datetime) return;

  const current = new Date(reminder.datetime);

  // Use the smart recurrence engine from Phase 107
  const next = computeNextOccurrence(current, recurField);
  if (!next) return;

  if (next.getTime() > Date.now()) {
    const nextStr = next.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    const nextEpoch = next.getTime();

    // Copy both `recurring` and `recurrence` fields so the next occurrence
    // is properly rescheduled by both the scheduler and the /complete endpoint.
    // Also preserve `priority` so user preference carries forward.
    db.prepare(`INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, priority, completed, created_by, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'scheduler', ?)`).run(
      uuid(), reminder.user_id, reminder.text, nextStr,
      reminder.channel, reminder.category, reminder.recurring || '',
      reminder.recurrence || null, reminder.priority || 'normal', nextEpoch,
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
