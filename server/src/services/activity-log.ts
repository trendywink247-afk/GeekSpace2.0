// ============================================================
// Centralized Activity Logger — INSERT + SSE push + cache bust
// ============================================================

import { db } from '../db/index.js';
import { pushActivityEvent, invalidateActivityCache } from '../routes/activity.js';
import { logger } from '../logger.js';

export function logActivity(userId: string, action: string, details: string, icon: string = '⚡'): void {
  try {
    db.prepare(
      'INSERT INTO activity_log (user_id, action, details, icon) VALUES (?, ?, ?, ?)'
    ).run(userId, action, details, icon);

    pushActivityEvent(userId, { action, details, icon });
    invalidateActivityCache(userId);
  } catch (err) {
    logger.error({ err, userId, action }, 'Failed to log activity');
  }
}
