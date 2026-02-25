// ============================================================
// Edith Memory System
//
// Short-term (session context), long-term (persistent facts),
// and episodic (conversation log) memory for the AI agent.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';

// ---- Schema (called on init) ----

export function initMemoryTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source TEXT DEFAULT 'observed',
      access_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, category, key)
    );

    CREATE TABLE IF NOT EXISTS conversation_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      provider TEXT DEFAULT '',
      model TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      request_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_conversation_log_user ON conversation_log(user_id, created_at);
  `);

  logger.info('Memory tables initialized');

  // Migration: add request_id column to conversation_log if not exists
  try {
    db.exec("ALTER TABLE conversation_log ADD COLUMN request_id TEXT DEFAULT ''");
    logger.info('Migration: added request_id to conversation_log');
  } catch { /* column already exists */ }
}

// ---- Memory CRUD ----

export function upsertMemory(
  userId: string,
  category: string,
  key: string,
  value: string,
  confidence = 1.0,
  source = 'observed',
): void {
  db.prepare(`
    INSERT INTO agent_memory (id, user_id, category, key, value, confidence, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, category, key)
    DO UPDATE SET value = excluded.value, confidence = excluded.confidence,
                  source = excluded.source, updated_at = datetime('now'),
                  access_count = access_count + 1
  `).run(uuid(), userId, category, key, value, confidence, source);
}

export function getMemories(userId: string, category?: string, limit = 20): MemoryEntry[] {
  if (category) {
    return db.prepare(
      'SELECT * FROM agent_memory WHERE user_id = ? AND category = ? ORDER BY updated_at DESC LIMIT ?'
    ).all(userId, category, limit) as MemoryEntry[];
  }
  return db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? ORDER BY confidence DESC, updated_at DESC LIMIT ?'
  ).all(userId, limit) as MemoryEntry[];
}

export function getRelevantMemories(userId: string, query: string, limit = 10): MemoryEntry[] {
  // Simple keyword-based relevance (no vector DB needed for now)
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!words.length) {
    return getMemories(userId, undefined, limit);
  }

  // Score memories by keyword overlap
  const all = db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? ORDER BY confidence DESC, updated_at DESC LIMIT 100'
  ).all(userId) as MemoryEntry[];

  const scored = all.map(m => {
    const text = `${m.key} ${m.value} ${m.category}`.toLowerCase();
    const score = words.filter(w => text.includes(w)).length;
    return { ...m, score };
  });

  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  // Update access counts for returned memories
  const results = scored.slice(0, limit);
  for (const m of results) {
    db.prepare('UPDATE agent_memory SET access_count = access_count + 1 WHERE id = ?').run(m.id);
  }

  return results;
}

export function deleteMemory(userId: string, memoryId: string): boolean {
  const result = db.prepare('DELETE FROM agent_memory WHERE id = ? AND user_id = ?').run(memoryId, userId);
  return result.changes > 0;
}

// ---- Conversation Logging ----

export function logConversation(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  requestIdOrProvider?: string,
  providerOrModel?: string,
  modelParam?: string,
): void {
  // Support both old signature and new signature with requestId
  let requestId = '';
  let provider = '';
  let model = '';

  if (arguments.length <= 4) {
    // New signature: (userId, role, content, requestId?, provider?, model?)
    requestId = requestIdOrProvider || '';
    provider = providerOrModel || '';
    model = modelParam || '';
  } else {
    // Old signature: (userId, role, content, provider, model)
    provider = requestIdOrProvider || '';
    model = providerOrModel || '';
  }

  db.prepare(
    'INSERT INTO conversation_log (id, user_id, role, content, provider, model, request_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(uuid(), userId, role, content, provider, model, requestId);
}

export function getRecentConversations(userId: string, limit = 10, search?: string): ConversationEntry[] {
  if (search) {
    return db.prepare(
      'SELECT * FROM conversation_log WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, `%${search}%`, limit) as ConversationEntry[];
  }
  return db.prepare(
    'SELECT * FROM conversation_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as ConversationEntry[];
}

export function getConversationContext(userId: string, maxChars = 4096): Array<{ role: 'user' | 'assistant'; content: string }> {
  const rows = getRecentConversations(userId, 10);
  const messages = rows.reverse().map(r => ({
    role: r.role as 'user' | 'assistant',
    content: r.content,
  }));
  let totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  while (totalChars > maxChars && messages.length > 0) {
    totalChars -= messages[0].content.length;
    messages.shift();
  }
  return messages;
}

// ---- Memory Extraction (lightweight — runs after each chat) ----
// This parses the user message for obvious facts/preferences.
// A full LLM-powered extraction can be layered on later.

const PATTERN_EXTRACTORS: Array<{
  pattern: RegExp;
  category: string;
  keyFn: (match: RegExpMatchArray) => string;
  valueFn: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /(?:my name is|i'm|i am)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    category: 'fact',
    keyFn: () => 'name',
    valueFn: (m) => m[1],
  },
  {
    pattern: /(?:i (?:use|prefer|like|work with))\s+(.+?)(?:\.|$)/i,
    category: 'preference',
    keyFn: () => 'tool_preference',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:i (?:live|am) (?:in|from|based in))\s+(.+?)(?:\.|$)/i,
    category: 'fact',
    keyFn: () => 'location',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:i (?:work (?:at|for)|am (?:a|an)))\s+(.+?)(?:\.|$)/i,
    category: 'fact',
    keyFn: () => 'role_or_company',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:my (?:timezone|tz) is|i'm in)\s+([A-Z]{2,5}(?:[+-]\d+)?)/i,
    category: 'preference',
    keyFn: () => 'timezone',
    valueFn: (m) => m[1],
  },
];

export function extractMemories(userId: string, message: string): number {
  let extracted = 0;
  for (const { pattern, category, keyFn, valueFn } of PATTERN_EXTRACTORS) {
    const match = message.match(pattern);
    if (match) {
      const key = keyFn(match);
      const value = valueFn(match);
      if (value.length > 2 && value.length < 200) {
        upsertMemory(userId, category, key, value, 0.8, 'inferred');
        extracted++;
      }
    }
  }
  return extracted;
}

/**
 * AI-powered memory extraction: uses PicoClaw to analyze conversations
 * and extract user preferences, facts, projects, and patterns.
 * Falls back to regex-based extraction when PicoClaw is unavailable.
 */
export async function extractMemoriesWithAI(userId: string, userMessage: string, assistantResponse: string): Promise<void> {
  try {
    const picoAvailable = await isPicoClawAvailable();
    if (!picoAvailable) {
      extractMemories(userId, userMessage);
      return;
    }

    const prompt = `Extract facts about the user from this conversation. Return ONLY a JSON array of objects with {category, key, value}. Categories: preference, fact, project, pattern. If nothing notable, return [].

User said: "${userMessage.slice(0, 500)}"
Assistant said: "${assistantResponse.slice(0, 500)}"`;

    const result = await queryPicoClaw(prompt, 'You extract user facts from conversations. Return valid JSON only.');

    let facts: Array<{ category: string; key: string; value: string }>;
    try {
      facts = JSON.parse(result.text);
      if (!Array.isArray(facts)) return;
    } catch {
      return;
    }

    for (const fact of facts.slice(0, 5)) {
      if (!fact.category || !fact.key || !fact.value) continue;

      const existing = db.prepare(
        "SELECT value FROM agent_memory WHERE user_id = ? AND key = ?"
      ).get(userId, fact.key) as { value: string } | undefined;

      if (existing && existing.value === fact.value) continue;

      upsertMemory(userId, fact.category, fact.key, fact.value, 0.7, 'ai-extract');
    }
  } catch (err) {
    logger.debug({ error: (err as Error).message }, 'AI memory extraction failed (non-fatal)');
  }
}

// ---- Build owner context for portfolio visitor chat ----

const SCHEDULE_KEYWORDS = ['schedule', 'availability', 'free', 'busy', 'meeting', 'calendar', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'morning', 'afternoon', 'evening', 'timezone', 'hours', 'available', 'unavailable', 'slot', 'appointment', 'office hours', 'work hours'];

export function buildOwnerContextForVisitor(userId: string, query?: string): { general: string; schedule: string } {
  const allMemories = getMemories(userId, undefined, 30);
  const relevant = query ? getRelevantMemories(userId, query, 10) : [];

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: MemoryEntry[] = [];
  for (const m of [...relevant, ...allMemories]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }

  const generalLines: string[] = [];
  const scheduleLines: string[] = [];

  for (const m of merged) {
    const text = `${m.key} ${m.value} ${m.category}`.toLowerCase();
    const isSchedule = SCHEDULE_KEYWORDS.some(kw => text.includes(kw));
    const line = `- [${m.category}] ${m.key}: ${m.value}`;

    if (isSchedule) {
      scheduleLines.push(line);
    } else {
      generalLines.push(line);
    }
  }

  return {
    general: generalLines.length ? generalLines.join('\n') : '',
    schedule: scheduleLines.length ? scheduleLines.join('\n') : '',
  };
}

// ---- Build memory context for system prompt ----

export function buildMemoryContext(userId: string, userMessage?: string): string {
  const memories = userMessage
    ? getRelevantMemories(userId, userMessage, 8)
    : getMemories(userId, undefined, 8);

  if (!memories.length) return '';

  const lines = memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`);
  return `\n## What you remember about this user:\n${lines.join('\n')}`;
}

// ---- Types ----

interface MemoryEntry {
  id: string;
  user_id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  access_count: number;
  created_at: string;
  updated_at: string;
  score?: number;
}

interface ConversationEntry {
  id: string;
  user_id: string;
  role: string;
  content: string;
  provider: string;
  model: string;
  summary: string;
  tags: string;
  created_at: string;
}

// ---- 3-Hour Memory Sync ----

let memorySyncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Sync memories for all users active in the last 3 hours.
 * Re-runs AI extraction on recent conversations that haven't been
 * processed yet, and stores tasks/connections as memory entries.
 */
async function syncMemoriesForActiveUsers(): Promise<void> {
  try {
    // Find users with conversation activity in the last 3 hours
    const activeUsers = db.prepare(`
      SELECT DISTINCT user_id FROM conversation_log
      WHERE created_at >= datetime('now', '-3 hours')
    `).all() as { user_id: string }[];

    if (activeUsers.length === 0) return;

    logger.info({ count: activeUsers.length }, 'Memory sync: processing active users');

    for (const { user_id: userId } of activeUsers) {
      try {
        // 1. Store completed tasks as memories
        const recentTasks = db.prepare(`
          SELECT task_type, description, result FROM pico_tasks
          WHERE user_id = ? AND status = 'completed'
            AND completed_at >= datetime('now', '-3 hours')
        `).all(userId) as { task_type: string; description: string; result: string }[];

        for (const task of recentTasks) {
          upsertMemory(userId, 'pattern', `task_${task.task_type}_${Date.now()}`,
            `Completed: ${task.description}${task.result ? ` → ${task.result.slice(0, 100)}` : ''}`,
            0.7, 'memory-sync');
        }

        // 2. Store connected services as memories
        const connections = db.prepare(`
          SELECT channel, external_username FROM channel_links
          WHERE user_id = ? AND is_verified = 1
        `).all(userId) as { channel: string; external_username: string }[];

        for (const conn of connections) {
          upsertMemory(userId, 'fact', `connected_${conn.channel}`,
            `Connected via ${conn.channel}${conn.external_username ? ` as @${conn.external_username}` : ''}`,
            0.9, 'memory-sync');
        }

        // 3. Run AI extraction on recent conversation pairs
        const recentConvos = db.prepare(`
          SELECT role, content FROM conversation_log
          WHERE user_id = ? AND created_at >= datetime('now', '-3 hours')
          ORDER BY created_at ASC LIMIT 20
        `).all(userId) as { role: string; content: string }[];

        // Process conversation pairs (user + assistant)
        for (let i = 0; i < recentConvos.length - 1; i++) {
          if (recentConvos[i].role === 'user' && recentConvos[i + 1]?.role === 'assistant') {
            await extractMemoriesWithAI(userId, recentConvos[i].content, recentConvos[i + 1].content);
            i++; // skip the assistant message
          }
        }
      } catch (err) {
        logger.debug({ userId, error: (err as Error).message }, 'Memory sync failed for user (non-fatal)');
      }
    }

    logger.info({ count: activeUsers.length }, 'Memory sync complete');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Memory sync tick failed');
  }
}

export function startMemorySyncScheduler(): void {
  if (memorySyncInterval) return;

  // Run every 3 hours (10800000 ms)
  memorySyncInterval = setInterval(syncMemoriesForActiveUsers, 3 * 60 * 60_000);

  // Also run once 5 minutes after startup to catch any recent activity
  setTimeout(syncMemoriesForActiveUsers, 5 * 60_000);

  logger.info('Memory sync scheduler started (3h interval)');
}
