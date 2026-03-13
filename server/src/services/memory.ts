// ============================================================
// Edith Memory System
//
// Short-term (session context), long-term (persistent facts),
// and episodic (conversation log) memory for the AI agent.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
import { upsertMemoryVector } from './search-vector.js';
import { indexMemory } from './search-index.js';

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
  // Skip for guest/visitor users — no FK row in users table
  if (userId.startsWith('guest:')) return;
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

// ---- Training Example Logging ----

export function logTrainingExample(params: {
  userId: string;
  input: string;
  output: string;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  systemPrompt?: string;
  channel?: string;
}): void {
  const { userId, input, output, provider, model, tokensIn = 0, tokensOut = 0, systemPrompt, channel = 'web' } = params;
  if (!input?.trim() || !output?.trim()) return;
  try {
    db.prepare(`
      INSERT INTO training_examples (id, user_id, input, output, system_prompt, provider, model, tokens_in, tokens_out, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), userId, input.slice(0, 8000), output.slice(0, 8000),
      systemPrompt ? systemPrompt.slice(0, 2000) : null,
      provider, model, tokensIn, tokensOut, channel);
  } catch { /* non-blocking — never fail a user request over logging */ }
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
  // Guest/visitor tokens have sub = 'guest:UUID' — skip conversation logging
  // (no row in users table, FOREIGN KEY constraint would fail)
  if (userId.startsWith('guest:')) return;

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

/**
 * 79.2: Ollama-powered memory extraction — uses local Ollama (NOT PicoClaw/edith).
 * Extracts structured facts (name, goal, preference, project, etc.) from conversation.
 * Falls back to regex extraction if Ollama is unavailable or returns invalid JSON.
 * Fire-and-forget: callers should not await this in the hot path.
 */
export async function extractMemoriesWithOllama(userId: string, userMessage: string, assistantResponse: string): Promise<void> {
  try {
    const prompt = `Extract facts about the user from this conversation. Return ONLY a valid JSON array of objects with {category, key, value}. Categories: preference, fact, goal, project. Max 5 items. If nothing notable, return [].

User said: "${userMessage.slice(0, 400)}"
Assistant said: "${assistantResponse.slice(0, 400)}"`;

    const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: [
          { role: 'system', content: 'You extract user facts from conversations. Return valid JSON array only. No markdown, no explanation.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: { temperature: 0.1, num_predict: 256 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      extractMemories(userId, userMessage);
      return;
    }

    const data = await response.json() as { message?: { content: string } };
    const raw = (data.message?.content || '').trim();

    // Strip optional markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let facts: Array<{ category: string; key: string; value: string }>;
    try {
      facts = JSON.parse(jsonStr);
      if (!Array.isArray(facts)) { extractMemories(userId, userMessage); return; }
    } catch {
      extractMemories(userId, userMessage);
      return;
    }

    let saved = 0;
    for (const fact of facts.slice(0, 5)) {
      if (!fact.category || !fact.key || !fact.value) continue;
      const val = String(fact.value);
      if (val.length < 2 || val.length > 300) continue;
      // Write to agent_memory (categorised store used by buildMemoryContext)
      upsertMemory(userId, fact.category, fact.key, val, 0.75, 'ollama-extract');
      // Also write to user_memories (used by /search, formatMemoryContext, and briefing)
      const umKey = fact.key.toLowerCase().replace(/\s+/g, '_').slice(0, 100);
      upsertUserMemory(userId, umKey, val.slice(0, 500), 'llm_extraction', 0.8);
      saved++;
    }

    logger.debug({ userId, count: facts.length, saved }, 'Ollama memory extraction complete');
  } catch (err) {
    // Non-fatal: fall back to regex extraction
    logger.debug({ error: (err as Error).message }, 'Ollama memory extraction failed (non-fatal), falling back to regex');
    try { extractMemories(userId, userMessage); } catch { /* ignore */ }
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

// ---- 79.8: Weekly Memory Summary ----

let weeklySummaryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Summarize all memories updated in the past 7 days into a single
 * "week_summary" entry. Uses Ollama (local, not PicoClaw).
 * Skips users with fewer than 3 memories. Runs Sunday 10:00 IST (04:30 UTC).
 */
async function runWeeklyMemorySummary(): Promise<void> {
  try {
    const now = new Date();
    // Only run on Sunday (0 = Sunday in JS) at 04:00–05:00 UTC (10:00–11:00 IST)
    if (now.getUTCDay() !== 0 || now.getUTCHours() < 4 || now.getUTCHours() >= 5) return;

    const activeUsers = db.prepare(`
      SELECT DISTINCT user_id FROM agent_memory
      WHERE updated_at >= datetime('now', '-7 days')
    `).all() as { user_id: string }[];

    logger.info({ count: activeUsers.length }, 'Weekly memory summary: processing users');

    for (const { user_id: userId } of activeUsers) {
      try {
        const memories = getMemories(userId, undefined, 50);
        if (memories.length < 3) continue;

        const memLines = memories
          .map(m => `[${m.category}] ${m.key}: ${m.value}`)
          .join('\n');

        const weekStart = now.toISOString().slice(0, 10);

        const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.ollamaModel,
            messages: [
              { role: 'system', content: 'You write concise user profile summaries from memory entries. Keep it under 100 words.' },
              { role: 'user', content: `Summarize what you know about this user in 1–2 sentences:\n${memLines}` },
            ],
            stream: false,
            options: { temperature: 0.3, num_predict: 150 },
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) continue;

        const data = await response.json() as { message?: { content: string } };
        const summary = (data.message?.content || '').trim();
        if (!summary || summary.length < 10) continue;

        upsertMemory(userId, 'summary', `week_${weekStart}`, summary, 0.9, 'weekly-cron');
        logger.debug({ userId, weekStart }, 'Weekly memory summary stored');
      } catch (err) {
        logger.debug({ userId, error: (err as Error).message }, 'Weekly summary failed for user (non-fatal)');
      }
    }

    logger.info({ count: activeUsers.length }, 'Weekly memory summary complete');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Weekly memory summary tick failed');
  }
}

export function startWeeklySummaryScheduler(): void {
  if (weeklySummaryInterval) return;

  // Check every hour whether it's the right time to run
  weeklySummaryInterval = setInterval(runWeeklyMemorySummary, 60 * 60_000);

  logger.info('Weekly memory summary scheduler started (checks hourly, runs Sunday 10:00 IST)');
}

// ============================================================
// Phase 94: User Memories — simple key-value long-term store
// Per-user facts like preferred_name, timezone, main_project, etc.
// Injected into every LLM prompt as a compact context block.
// ============================================================

export interface UserMemory {
  id: number;
  user_id: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  last_used: number | null;
  created_at: number;
  updated_at: number;
}

/** Return all memories for a user, sorted by last_used DESC */
export function getUserMemories(userId: string): UserMemory[] {
  return db.prepare(
    'SELECT * FROM user_memories WHERE user_id = ? ORDER BY last_used DESC NULLS LAST, updated_at DESC'
  ).all(userId) as UserMemory[];
}

/** Return top N most recently used memories */
export function getTopUserMemories(userId: string, limit = 10): UserMemory[] {
  return db.prepare(
    'SELECT * FROM user_memories WHERE user_id = ? ORDER BY last_used DESC NULLS LAST, updated_at DESC LIMIT ?'
  ).all(userId, limit) as UserMemory[];
}

/** Insert or update a user memory entry */
export function upsertUserMemory(
  userId: string,
  key: string,
  value: string,
  source = 'manual',
  confidence = 1.0,
): UserMemory {
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_memories (user_id, key, value, source, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, key)
    DO UPDATE SET
      value = excluded.value,
      source = excluded.source,
      confidence = excluded.confidence,
      updated_at = ?
  `).run(userId, key, value, source, confidence, now, now, now);

  // Async: push to Qdrant (semantic) + Meilisearch (instant search)
  if (!userId.startsWith('guest:')) {
    upsertMemoryVector(userId, key, value, source).catch(() => {});
    indexMemory(userId, key, value).catch(() => {});
  }

  return db.prepare(
    'SELECT * FROM user_memories WHERE user_id = ? AND key = ?'
  ).get(userId, key) as UserMemory;
}

/** Delete a specific user memory by id */
export function deleteUserMemory(userId: string, id: number): boolean {
  const result = db.prepare('DELETE FROM user_memories WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

/**
 * Mark a set of memories as "used" (update last_used timestamp).
 * Called when memories are injected into a prompt.
 */
function touchUserMemories(ids: number[]): void {
  if (!ids.length) return;
  const now = Date.now();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE user_memories SET last_used = ? WHERE id IN (${placeholders})`).run(now, ...ids);
}

/**
 * Format user memories as a compact string for injection into LLM system prompts.
 * Keeps it under 500 tokens. Updates last_used on the memories that are included.
 */
export function formatMemoryContext(userId: string): string {
  const memories = getTopUserMemories(userId, 15);
  if (!memories.length) return '';

  // Touch memories as "used"
  touchUserMemories(memories.map(m => m.id));

  const pairs = memories.map(m => `${m.key}=${m.value}`).join(', ');
  return `[User memories: ${pairs}]`;
}

/**
 * Scan recent messages for facts worth remembering.
 * Uses regex patterns — no LLM call needed.
 * Returns number of new memories extracted.
 */
const USER_MEMORY_PATTERNS: Array<{
  pattern: RegExp;
  keyFn: (m: RegExpMatchArray) => string;
  valueFn: (m: RegExpMatchArray) => string;
}> = [
  {
    pattern: /(?:call me|my name is|i(?:'m| am))\s+([A-Z][a-zA-Z]+)/i,
    keyFn: () => 'preferred_name',
    valueFn: (m) => m[1],
  },
  {
    pattern: /(?:my (?:timezone|tz) is|i(?:'m| am) in)\s+((?:UTC|GMT|IST|PST|EST|CST|MST|AEST|CET|[A-Z]{2,5})(?:[+-]\d+(?::\d+)?)?)/i,
    keyFn: () => 'timezone',
    valueFn: (m) => m[1],
  },
  {
    pattern: /(?:i(?:'m| am) working on|my (?:main |current )?project is|i(?:'m| am) building)\s+(.{5,80}?)(?:\.|,|$)/i,
    keyFn: () => 'main_project',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:i prefer|i (?:like|love|use|work with))\s+(.{3,60}?)(?:\.|,|$)/i,
    keyFn: () => 'preference',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:my (?:email|e-mail) is)\s+([\w.+-]+@[\w-]+\.[a-zA-Z]{2,})/i,
    keyFn: () => 'email',
    valueFn: (m) => m[1],
  },
  {
    pattern: /(?:i work (?:at|for)|i(?:'m| am) a[n]? .{1,30} at)\s+(.{3,60}?)(?:\.|,|$)/i,
    keyFn: () => 'company',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:i(?:'m| am) a[n]?)\s+(.{3,50}?)(?:\.|,|and |$)/i,
    keyFn: () => 'role',
    valueFn: (m) => m[1].trim(),
  },
  {
    pattern: /(?:i(?:'m| am) (?:from|based in|located in|living in))\s+(.{3,60}?)(?:\.|,|$)/i,
    keyFn: () => 'location',
    valueFn: (m) => m[1].trim(),
  },
];

export function extractMemoriesFromConversation(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): number {
  let count = 0;
  // Only scan user messages
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);

  for (const text of userMessages) {
    for (const { pattern, keyFn, valueFn } of USER_MEMORY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const key = keyFn(match);
        const value = valueFn(match);
        if (value.length >= 2 && value.length <= 200) {
          upsertUserMemory(userId, key, value, 'extracted', 0.8);
          count++;
        }
      }
    }
  }

  return count;
}
