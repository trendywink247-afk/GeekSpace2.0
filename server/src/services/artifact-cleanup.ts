// ============================================================
// Artifact Cleanup Service — Self-Destruct Feature
//
// Automatically deletes expired artifacts and sends warnings
// to users before deletion.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';
import { cleanupExpiredImages } from '../routes/images.js';
import { cleanupExpiredVideos } from '../routes/videos.js';

let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let warningInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Delete expired artifacts
 */
export function cleanupExpiredArtifacts(): void {
  try {
    // Find expired artifacts
    const expired = db.prepare(`
      SELECT ga.id, ga.user_id, ga.title
      FROM generated_artifacts ga
      WHERE ga.expires_at IS NOT NULL
        AND datetime(ga.expires_at) <= datetime('now')
    `).all() as Array<{
      id: string;
      user_id: string;
      title: string;
    }>;

    for (const artifact of expired) {
      try {
        // Delete the artifact
        db.prepare('DELETE FROM generated_artifacts WHERE id = ?').run(artifact.id);

        // Log activity
        db.prepare(`
          INSERT INTO activity_log (id, user_id, action, details, icon)
          VALUES (?, ?, 'Artifact auto-deleted', ?, 'trash')
        `).run(uuid(), artifact.user_id, `"${artifact.title}" expired and was deleted`);

        logger.info({ artifactId: artifact.id, userId: artifact.user_id }, 'Expired artifact deleted');
      } catch (err) {
        logger.error({ err, artifactId: artifact.id }, 'Failed to delete expired artifact');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Artifact cleanup failed');
  }
}

/**
 * Send warning notifications for artifacts expiring soon
 */
export function sendExpirationWarnings(): void {
  const warnings = [
    { minutes: 60, emoji: '⏰', text: '1 hour' },
    { minutes: 30, emoji: '⚠️', text: '30 minutes' },
    { minutes: 10, emoji: '🚨', text: '10 minutes' },
  ];

  for (const warning of warnings) {
    try {
      const expiring = db.prepare(`
        SELECT ga.id, ga.user_id, ga.title, ga.expires_at
        FROM generated_artifacts ga
        WHERE ga.expires_at IS NOT NULL
          AND datetime(ga.expires_at) <= datetime('now', '+${warning.minutes} minutes')
          AND datetime(ga.expires_at) > datetime('now', '+${warning.minutes - 5} minutes')
      `).all() as Array<{
        id: string;
        user_id: string;
        title: string;
        expires_at: string;
      }>;

      // Note: Telegram notifications disabled - would need telegram_chat_id from user integrations
      for (const artifact of expiring) {
        logger.info({ artifactId: artifact.id, warning: warning.text }, 'Artifact expiring soon (notifications disabled)');
      }
    } catch (err) {
      logger.error({ err, warning }, 'Failed to send expiration warnings');
    }
  }
}

/**
 * Save artifact permanently (remove expiration)
 */
export function saveArtifactPermanently(artifactId: string, userId: string): boolean {
  try {
    const result = db.prepare(`
      UPDATE generated_artifacts
      SET expires_at = NULL
      WHERE id = ? AND user_id = ?
    `).run(artifactId, userId);

    if (result.changes === 0) {
      return false;
    }

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, details, icon)
      VALUES (?, ?, 'Artifact saved', ?, 'save')
    `).run(uuid(), userId, `Saved "${artifactId}" permanently`);

    logger.info({ artifactId, userId }, 'Artifact saved permanently');
    return true;
  } catch (err) {
    logger.error({ err, artifactId, userId }, 'Failed to save artifact');
    return false;
  }
}

/**
 * Purge channel links that have been inactive for 90+ days.
 * Runs daily. Safe: only removes links with no recent activity.
 */
export function purgeStaleChannelLinks(): void {
  try {
    const result = db.prepare(`
      DELETE FROM channel_links
      WHERE last_message_at IS NOT NULL
        AND datetime(last_message_at) < datetime('now', '-90 days')
    `).run();

    if (result.changes > 0) {
      logger.info({ purged: result.changes }, 'Stale channel links purged (90-day TTL)');
    }
  } catch (err) {
    logger.error({ err }, 'Stale channel link purge failed');
  }
}

/**
 * Start the cleanup scheduler
 */
export function startArtifactCleanupScheduler(): void {
  // Run cleanup every 5 minutes
  cleanupInterval = setInterval(() => {
    cleanupExpiredArtifacts();
    cleanupExpiredImages().catch(() => {});
    cleanupExpiredVideos();
  }, 5 * 60 * 1000);

  // Send warnings every 5 minutes
  warningInterval = setInterval(sendExpirationWarnings, 5 * 60 * 1000);

  // Purge stale channel links daily (90-day TTL)
  setInterval(purgeStaleChannelLinks, 24 * 60 * 60 * 1000);

  // Run immediately on start
  cleanupExpiredArtifacts();
  cleanupExpiredImages().catch(() => {});
  cleanupExpiredVideos();
  sendExpirationWarnings();
  purgeStaleChannelLinks(); // run once on startup to catch any existing stale links

  logger.info('Artifact cleanup scheduler started');
}

/**
 * Stop the cleanup scheduler
 */
export function stopArtifactCleanupScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (warningInterval) {
    clearInterval(warningInterval);
    warningInterval = null;
  }
}
