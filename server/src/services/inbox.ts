// ============================================================
// Inbox Service -- Phase 97
// Unified AI inbox: stores messages from Telegram/WhatsApp/system,
// performs AI triage (priority + summary + suggested reply).
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { routeChat } from './llm.js';

// ---- Types ----

export interface InboxMessage {
  id: number;
  user_id: string;
  source: string;
  sender: string | null;
  content: string;
  summary: string | null;
  priority: string;
  read: number;
  archived: number;
  suggested_reply: string | null;
  related_reminder_id: number | null;
  received_at: number;
}

export interface GetInboxOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  source?: string;
}

// ---- Priority classifier ----
// Fast synchronous classification used as seed value before LLM triage

function classifyPriority(content: string): string {
  const lower = content.toLowerCase();
  const urgentPatterns = [
    /\basap\b/, /\burgent\b/, /\bdeadline\b/, /\bemergency\b/, /\bhelp\s*!\s*$/, /\bhelp\b.*!/,
    /\bcritical\b/, /\bimmediate\b/, /\bright now\b/, /\bfire\b/, /\bcrash\b/,
  ];
  const highPatterns = [
    /\?/, /\bquestion\b/, /\bwhen\b/, /\bhow\b/, /\bwhy\b/, /\bwhat\b/, /\bcould you\b/,
    /\bcan you\b/, /\bwill you\b/, /\bplease\b/, /\bneed\b/,
  ];
  if (urgentPatterns.some(p => p.test(lower))) return 'urgent';
  if (highPatterns.some(p => p.test(lower))) return 'high';
  return 'normal';
}

// ---- Core: add message ----

export function addInboxMessage(
  userId: string,
  source: string,
  sender: string | null,
  content: string,
): number {
  const stmt = db.prepare(`
    INSERT INTO inbox_messages (user_id, source, sender, content, priority, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const priority = classifyPriority(content);
  const now = Date.now();
  const result = stmt.run(userId, source, sender, content, priority, now);
  const messageId = result.lastInsertRowid as number;

  // Fire-and-forget AI triage (non-blocking)
  triageMessage(messageId).catch((e: unknown) => {
    logger.warn({ err: (e as Error).message, messageId }, 'Inbox triage failed');
  });

  return messageId;
}

// ---- Core: triage message ----

export async function triageMessage(messageId: number): Promise<void> {
  const msg = db.prepare('SELECT * FROM inbox_messages WHERE id = ?')
    .get(messageId) as InboxMessage | undefined;

  if (!msg) return;

  // In TEST_MODE: use deterministic stubs without LLM calls
  if (config.isTestMode) {
    const lower = msg.content.toLowerCase();
    let priority = msg.priority;

    // Re-classify in test mode using same logic
    const urgentKeywords = ['asap', 'urgent', 'deadline', 'emergency', 'critical', 'immediate'];
    const highKeywords = ['?', 'could you', 'can you', 'please', 'need', 'help me'];
    if (urgentKeywords.some(p => lower.includes(p))) priority = 'urgent';
    else if (highKeywords.some(p => lower.includes(p))) priority = 'high';

    const summary = msg.content.length > 100 ? msg.content.slice(0, 97) + '...' : msg.content;
    const isQuestion = msg.content.includes('?') || lower.includes('could you') || lower.includes('can you');
    const suggested_reply = isQuestion ? 'Thank you for reaching out. I will get back to you shortly.' : null;

    // Detect related reminder by keyword
    const relatedReminder = findRelatedReminder(msg.user_id, msg.content);

    db.prepare(`
      UPDATE inbox_messages
      SET summary = ?, priority = ?, suggested_reply = ?, related_reminder_id = ?
      WHERE id = ?
    `).run(summary, priority, suggested_reply, relatedReminder, messageId);
    return;
  }

  // Production: call LLM for triage
  try {
    const prompt = `You are an AI inbox assistant. Analyze this message and respond in JSON only.

Message from: ${msg.sender || 'unknown'}
Content: "${msg.content}"

Respond with exactly this JSON structure (no markdown, no extra text):
{
  "summary": "<1 sentence, max 100 chars>",
  "priority": "<urgent|high|normal|low>",
  "suggested_reply": "<1-2 sentence reply if message needs response, null if no reply needed>"
}

Priority rules:
- urgent: contains ASAP/deadline/emergency/critical/immediate
- high: contains a question or request
- normal: informational
- low: automated/system notifications`;

    const result = await routeChat([{ role: 'user', content: prompt }], {
      systemPrompt: 'You are a triage assistant. Always respond with valid JSON only.',
      agentName: 'Triage',
      userCredits: 0,
    });

    let parsed: { summary?: string; priority?: string; suggested_reply?: string | null } = {};
    try {
      // Strip markdown code blocks if present
      const jsonText = result.reply.replace(/```(?:json)?\n?/g, '').trim();
      parsed = JSON.parse(jsonText);
    } catch {
      logger.warn({ messageId, reply: result.reply }, 'Failed to parse triage JSON');
    }

    const summary = (parsed.summary || msg.content.slice(0, 100)).slice(0, 100);
    const priority = ['urgent', 'high', 'normal', 'low'].includes(parsed.priority || '')
      ? parsed.priority!
      : msg.priority;
    const suggested_reply = parsed.suggested_reply || null;
    const relatedReminder = findRelatedReminder(msg.user_id, msg.content);

    db.prepare(`
      UPDATE inbox_messages
      SET summary = ?, priority = ?, suggested_reply = ?, related_reminder_id = ?
      WHERE id = ?
    `).run(summary, priority, suggested_reply, relatedReminder, messageId);
  } catch (e) {
    logger.warn({ err: (e as Error).message, messageId }, 'LLM triage failed, using fallback');
    // Fallback: just truncate summary
    const summary = msg.content.length > 100 ? msg.content.slice(0, 97) + '...' : msg.content;
    db.prepare('UPDATE inbox_messages SET summary = ? WHERE id = ?').run(summary, messageId);
  }
}

// ---- Reminder detection ----

function findRelatedReminder(userId: string, content: string): number | null {
  const lower = content.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 4);
  if (words.length === 0) return null;

  try {
    const reminders = db.prepare(
      'SELECT id, text FROM reminders WHERE user_id = ? AND completed = 0 LIMIT 20'
    ).all(userId) as Array<{ id: number; text: string }>;

    for (const r of reminders) {
      const rLower = r.text.toLowerCase();
      if (words.some(w => rLower.includes(w))) return r.id;
    }
  } catch { /* non-fatal */ }
  return null;
}

// ---- Query helpers ----

export function getInbox(userId: string, options: GetInboxOptions = {}): InboxMessage[] {
  const { unreadOnly = false, limit = 50, offset = 0, source } = options;

  let query = 'SELECT * FROM inbox_messages WHERE user_id = ? AND archived = 0';
  const params: (string | number)[] = [userId];

  if (unreadOnly) {
    query += ' AND read = 0';
  }
  if (source) {
    query += ' AND source = ?';
    params.push(source);
  }

  query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params) as InboxMessage[];
}

export function getUnreadCount(userId: string): number {
  const row = db.prepare(
    'SELECT COUNT(*) as cnt FROM inbox_messages WHERE user_id = ? AND read = 0 AND archived = 0'
  ).get(userId) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

export function markRead(userId: string, messageId: number): boolean {
  const result = db.prepare(
    'UPDATE inbox_messages SET read = 1 WHERE id = ? AND user_id = ?'
  ).run(messageId, userId);
  return result.changes > 0;
}

export function archiveMessage(userId: string, messageId: number): boolean {
  const result = db.prepare(
    'UPDATE inbox_messages SET archived = 1 WHERE id = ? AND user_id = ?'
  ).run(messageId, userId);
  return result.changes > 0;
}

export function deleteMessage(userId: string, messageId: number): boolean {
  const result = db.prepare(
    'DELETE FROM inbox_messages WHERE id = ? AND user_id = ?'
  ).run(messageId, userId);
  return result.changes > 0;
}

export function getMessageById(userId: string, messageId: number): InboxMessage | null {
  const row = db.prepare(
    'SELECT * FROM inbox_messages WHERE id = ? AND user_id = ?'
  ).get(messageId, userId) as InboxMessage | undefined;
  return row ?? null;
}
