/**
 * Feedback Service — Learn from user ratings on agent responses
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

// ── Types ────────────────────────────────────────────────────

export interface MessageFeedback {
  id: string;
  user_id: string;
  message_id: string;
  rating: 'up' | 'down';
  comment: string;
  created_at: string;
}

// ── CRUD ─────────────────────────────────────────────────────

export function recordFeedback(
  userId: string,
  messageId: string,
  rating: 'up' | 'down',
  comment?: string,
): void {
  const id = uuid();
  // Upsert: one rating per user per message
  db.prepare(`
    INSERT INTO message_feedback (id, user_id, message_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, message_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment
  `).run(id, userId, messageId, rating, comment || '');
  logger.debug({ userId, messageId, rating }, 'feedback:recorded');
}

export function getFeedbackStats(userId: string): {
  total: number;
  positive: number;
  negative: number;
  patterns: string[];
} {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as negative
    FROM message_feedback WHERE user_id = ?
  `).get(userId) as { total: number; positive: number; negative: number };

  // Extract patterns from recent negative feedback
  const negatives = db.prepare(`
    SELECT mf.comment, cl.content as agent_message
    FROM message_feedback mf
    LEFT JOIN conversation_log cl ON cl.id = mf.message_id
    WHERE mf.user_id = ? AND mf.rating = 'down' AND mf.comment != ''
    ORDER BY mf.created_at DESC LIMIT 10
  `).all(userId) as Array<{ comment: string; agent_message: string | null }>;

  const patterns = negatives
    .filter(n => n.comment)
    .map(n => n.comment);

  return { ...stats, patterns };
}

/**
 * Build a feedback context block for injection into the system prompt.
 * Tells the agent what the user liked/disliked.
 */
export function getUserFeedbackPatterns(userId: string, limit = 5): string {
  const negatives = db.prepare(`
    SELECT mf.comment, mf.created_at, cl.content as agent_message
    FROM message_feedback mf
    LEFT JOIN conversation_log cl ON cl.id = mf.message_id
    WHERE mf.user_id = ? AND mf.rating = 'down' AND mf.comment != ''
    ORDER BY mf.created_at DESC LIMIT ?
  `).all(userId, limit) as Array<{ comment: string; created_at: string; agent_message: string | null }>;

  if (negatives.length === 0) return '';

  const lines = negatives.map(n => {
    const date = n.created_at.split('T')[0];
    return `- [${date}] User disliked: "${n.comment}"`;
  });

  return `\n## User Feedback (avoid these patterns)\n${lines.join('\n')}`;
}
