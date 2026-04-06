/**
 * Temporal Service — Track deadlines, follow-ups, and time-sensitive context
 *
 * Examples:
 * - User says "I have a meeting Friday" → anchor created for Thursday evening
 *   to surface as "Your meeting is tomorrow, want to prep?"
 * - User says "I'm anxious about the demo" → anchor created to follow up
 *   after the expected demo date
 * - User mentions a deadline → anchor created for the day before
 */

import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage, type Provider } from './llm.js';

export type AnchorType = 'deadline' | 'followup' | 'checkin' | 'reminder' | 'anniversary';
export type AnchorStatus = 'pending' | 'surfaced' | 'resolved' | 'expired';

export interface TemporalAnchor {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  type: AnchorType;
  trigger_at: string; // ISO timestamp
  context: string;
  original_message: string;
  status: AnchorStatus;
  surfaced_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Create a temporal anchor programmatically.
 */
export function createTemporalAnchor(params: {
  userId: string;
  conversationId?: string;
  messageId?: string;
  type: AnchorType;
  triggerAt: Date | string;
  context: string;
  originalMessage?: string;
}): string {
  const id = uuid();
  const triggerAt = params.triggerAt instanceof Date ? params.triggerAt.toISOString() : params.triggerAt;

  db.prepare(`
    INSERT INTO temporal_anchors (id, user_id, conversation_id, message_id, type, trigger_at, context, original_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.userId,
    params.conversationId ?? null,
    params.messageId ?? null,
    params.type,
    triggerAt,
    params.context,
    params.originalMessage ?? '',
  );

  logger.debug({ userId: params.userId, type: params.type, triggerAt }, 'temporal: anchor created');
  return id;
}

/**
 * Extract temporal anchors from a user message using LLM.
 * Detects implicit deadlines, planned events, anxieties, and follow-up opportunities.
 */
export async function extractTemporalAnchors(
  userId: string,
  message: string,
  conversationId?: string,
  messageId?: string,
): Promise<number> {
  try {
    if (message.length < 20) return 0; // Skip very short messages

    const userTz = getUserTimezone(userId);
    const now = DateTime.now().setZone(userTz);
    const nowStr = now.toFormat("cccc, LLLL d, yyyy 'at' h:mm a");

    const prompt = `Extract time-sensitive anchors from this user message. Look for:
1. DEADLINES: "by Friday", "end of month", "need to ship by X"
2. PLANNED EVENTS: "meeting on Tuesday", "interview next week", "flight on the 15th"
3. ANXIETIES/STRESSORS: "worried about X", "nervous about Y" (suggests followup after the event)
4. FOLLOW-UP OPPORTUNITIES: "trying X for a week", "giving Y a shot"
5. ANNIVERSARIES: "X started today", "one year since Y"

Current time: ${nowStr} (${userTz})

User message: "${message.slice(0, 800)}"

Return JSON array (empty if no anchors found):
[
  {
    "type": "deadline|followup|checkin|reminder|anniversary",
    "trigger_at": "ISO 8601 timestamp WHEN we should bring this up",
    "context": "short description for the agent to recall"
  }
]

For deadlines: trigger 1 day before.
For anxieties: trigger 1 day after the event ended.
For planned events: trigger 2-4 hours before.
For checkins: trigger 3-7 days later.

JSON array only, no markdown:`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You extract structured time anchors from messages. Return JSON array only.' },
      { role: 'user', content: prompt },
    ];

    const result = await routeChat(messages, { userId, forceProvider: 'groq' as Provider });

    const jsonMatch = result.reply.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;

    const anchors = JSON.parse(jsonMatch[0]) as Array<{
      type: string;
      trigger_at: string;
      context: string;
    }>;

    let created = 0;
    for (const anchor of anchors) {
      if (!['deadline', 'followup', 'checkin', 'reminder', 'anniversary'].includes(anchor.type)) continue;

      // Validate trigger_at is in the future
      const triggerDate = new Date(anchor.trigger_at);
      if (isNaN(triggerDate.getTime()) || triggerDate < new Date()) continue;
      // Don't create anchors more than 1 year out
      if (triggerDate.getTime() - Date.now() > 365 * 24 * 3600 * 1000) continue;

      createTemporalAnchor({
        userId,
        conversationId,
        messageId,
        type: anchor.type as AnchorType,
        triggerAt: triggerDate,
        context: anchor.context.slice(0, 300),
        originalMessage: message.slice(0, 500),
      });
      created++;
    }

    if (created > 0) {
      logger.info({ userId, count: created }, 'temporal: anchors extracted');
    }
    return created;
  } catch (err) {
    logger.debug({ err, userId }, 'temporal: extraction failed (non-fatal)');
    return 0;
  }
}

function getUserTimezone(userId: string): string {
  try {
    const row = db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined;
    return row?.timezone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/**
 * Get pending anchors that should be surfaced now (trigger_at <= now).
 */
export function getDueAnchors(userId: string): TemporalAnchor[] {
  return db.prepare(`
    SELECT * FROM temporal_anchors
    WHERE user_id = ? AND status = 'pending' AND trigger_at <= datetime('now')
    ORDER BY trigger_at ASC LIMIT 5
  `).all(userId) as TemporalAnchor[];
}

/**
 * Get upcoming anchors (next 7 days) for context injection.
 */
export function getUpcomingAnchors(userId: string, daysAhead = 7): TemporalAnchor[] {
  return db.prepare(`
    SELECT * FROM temporal_anchors
    WHERE user_id = ? AND status = 'pending'
      AND trigger_at >= datetime('now')
      AND trigger_at <= datetime('now', '+' || ? || ' days')
    ORDER BY trigger_at ASC LIMIT 10
  `).all(userId, daysAhead) as TemporalAnchor[];
}

/**
 * Format anchors as a context block for system prompt injection.
 */
export function formatAnchorsForPrompt(userId: string): string {
  const due = getDueAnchors(userId);
  const upcoming = getUpcomingAnchors(userId, 3);

  if (due.length === 0 && upcoming.length === 0) return '';

  const lines: string[] = ['## Time-Sensitive Context'];

  if (due.length > 0) {
    lines.push('### Things to bring up NOW:');
    for (const a of due) {
      lines.push(`- [${a.type}] ${a.context}`);
    }
  }

  if (upcoming.length > 0) {
    lines.push('### Coming up soon:');
    for (const a of upcoming) {
      const when = DateTime.fromISO(a.trigger_at).toRelative({ base: DateTime.now() });
      lines.push(`- ${when}: ${a.context}`);
    }
  }

  return '\n' + lines.join('\n');
}

/**
 * Mark an anchor as surfaced (the agent brought it up).
 */
export function markAnchorSurfaced(id: string): void {
  db.prepare(`
    UPDATE temporal_anchors
    SET status = 'surfaced', surfaced_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

/**
 * Mark an anchor as resolved (no longer relevant).
 */
export function markAnchorResolved(id: string): void {
  db.prepare(`
    UPDATE temporal_anchors
    SET status = 'resolved', resolved_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

/**
 * Background cleanup: expire anchors that are >7 days past trigger.
 */
export function expireStaleAnchors(): number {
  const result = db.prepare(`
    UPDATE temporal_anchors
    SET status = 'expired'
    WHERE status = 'pending' AND trigger_at < datetime('now', '-7 days')
  `).run();
  return result.changes;
}
