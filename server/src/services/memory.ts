// ============================================================
// Edith Memory System
//
// Short-term (session context), long-term (persistent facts),
// and episodic (conversation log) memory for the AI agent.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

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
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_conversation_log_user ON conversation_log(user_id, created_at);
  `);

  logger.info('Memory tables initialized');
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
  provider = '',
  model = '',
): void {
  db.prepare(
    'INSERT INTO conversation_log (id, user_id, role, content, provider, model) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuid(), userId, role, content, provider, model);
}

export function getRecentConversations(userId: string, limit = 10): ConversationEntry[] {
  return db.prepare(
    'SELECT * FROM conversation_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as ConversationEntry[];
}

export function getConversationContext(userId: string, maxChars = 8192): Array<{ role: 'user' | 'assistant'; content: string }> {
  const rows = getRecentConversations(userId, 20);
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
