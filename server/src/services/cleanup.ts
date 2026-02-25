// ============================================================
// Database Cleanup Cron
//
// Runs daily at 03:00 to purge old records that would otherwise
// grow unboundedly.
//
// Retention policy:
//   activity_log      — 90 days
//   portfolio_visits  — 90 days
//   automation_logs   — 30 days
//   usage_events      — 365 days  (billing audit trail)
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

// ---- Core cleanup function (exported for testing) ----

export function runDbCleanup(): void {
  const now = new Date().toISOString();
  logger.info({ at: now }, 'DB cleanup: starting');

  try {
    const activity = db.prepare(
      `DELETE FROM activity_log WHERE created_at < datetime('now', '-90 days')`
    ).run();
    logger.info({ deleted: activity.changes }, 'DB cleanup: activity_log');
  } catch (err) {
    logger.warn({ err }, 'DB cleanup: activity_log failed');
  }

  try {
    const visits = db.prepare(
      `DELETE FROM portfolio_visits WHERE visited_at < datetime('now', '-90 days')`
    ).run();
    logger.info({ deleted: visits.changes }, 'DB cleanup: portfolio_visits');
  } catch (err) {
    logger.warn({ err }, 'DB cleanup: portfolio_visits failed');
  }

  try {
    const autoLogs = db.prepare(
      `DELETE FROM automation_logs WHERE created_at < datetime('now', '-30 days')`
    ).run();
    logger.info({ deleted: autoLogs.changes }, 'DB cleanup: automation_logs');
  } catch (err) {
    logger.warn({ err }, 'DB cleanup: automation_logs failed');
  }

  try {
    const usage = db.prepare(
      `DELETE FROM usage_events WHERE created_at < datetime('now', '-365 days')`
    ).run();
    logger.info({ deleted: usage.changes }, 'DB cleanup: usage_events (1yr)');
  } catch (err) {
    logger.warn({ err }, 'DB cleanup: usage_events failed');
  }

  logger.info('DB cleanup: complete');
}

// ---- Schedule daily at 03:00 using a simple interval approach ----
// We avoid adding node-cron (which is not imported in this project) and instead
// use a setInterval that fires every hour and checks if it's 3am.

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function initCleanupCron(): void {
  if (cleanupTimer) return; // already initialized

  const MS_PER_HOUR = 60 * 60 * 1000;

  const maybeRun = () => {
    try {
      const hour = new Date().getHours();
      if (hour === 3) {
        runDbCleanup();
      }
    } catch (err) {
      // Never let cleanup crash the server
      logger.warn({ err }, 'DB cleanup cron: unexpected error');
    }
  };

  // Check once at startup (won't run unless it's 3am, but logs that cron is active)
  logger.info('DB cleanup cron: initialized (runs daily at 03:00)');

  // Check every hour
  cleanupTimer = setInterval(maybeRun, MS_PER_HOUR);
}
