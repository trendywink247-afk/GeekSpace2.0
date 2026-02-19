// ============================================================
// Artifact Cleanup Service — Self-Destruct Feature
//
// Automatically deletes expired artifacts and sends warnings
// to users before deletion.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';
import { sendTelegramMessage } from './telegram.js';

let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let warningInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Delete expired artifacts
 */
export function cleanupExpiredArtifacts(): void {
  try {
    // Find expired artifacts
    const expired = db.prepare(`
      SELECT ga.id, ga.user_id, ga.title, u.telegram_chat_id
      FROM generated_artifacts ga
      JOIN users u ON ga.user_id = u.id
      WHERE ga.expires_at IS NOT NULL
        AND datetime(ga.expires_at) <= datetime('now')
    `).all() as Array<{
      id: string;
      user_id: string;
      title: string;
      telegram_chat_id: string | null;
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

        // Notify via Telegram if linked
        if (artifact.telegram_chat_id) {
          sendTelegramMessage(
            artifact.telegram_chat_id,
            `🗑️ Your project "${artifact.title}" has been auto-deleted after 24 hours.\n\nCreate a new project anytime!`
          ).catch(() => { /* non-fatal */ });
        }

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
        SELECT ga.id, ga.user_id, ga.title, ga.expires_at, u.telegram_chat_id
        FROM generated_artifacts ga
        JOIN users u ON ga.user_id = u.id
        WHERE ga.expires_at IS NOT NULL
          AND datetime(ga.expires_at) <= datetime('now', '+${warning.minutes} minutes')
          AND datetime(ga.expires_at) > datetime('now', '+${warning.minutes - 5} minutes')
      `).all() as Array<{
        id: string;
        user_id: string;
        title: string;
        expires_at: string;
        telegram_chat_id: string | null;
      }>;

      for (const artifact of expiring) {
        if (!artifact.telegram_chat_id) continue;

        const previewUrl = `${process.env.PUBLIC_URL || 'https://ai.geekspace.space'}/preview/${artifact.user_id}/${artifact.id}`;

        sendTelegramMessage(
          artifact.telegram_chat_id,
          `${warning.emoji} Your project "${artifact.title}" will be deleted in ${warning.text}!\n\n` +
          `Preview: ${previewUrl}\n\n` +
          `To save it permanently, go to My Projects and click "Save" before it expires!`
        ).catch(() => { /* non-fatal */ });

        logger.info({ artifactId: artifact.id, warning: warning.text }, 'Expiration warning sent');
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
 * Start the cleanup scheduler
 */
export function startArtifactCleanupScheduler(): void {
  // Run cleanup every 5 minutes
  cleanupInterval = setInterval(cleanupExpiredArtifacts, 5 * 60 * 1000);

  // Send warnings every 5 minutes
  warningInterval = setInterval(sendExpirationWarnings, 5 * 60 * 1000);

  // Run immediately on start
  cleanupExpiredArtifacts();
  sendExpirationWarnings();

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
