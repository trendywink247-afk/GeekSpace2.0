/**
 * Session Summary — Auto-summarize conversations for cross-session continuity
 *
 * At the end of each conversation (idle timeout or explicit close),
 * generates a structured summary using PicoClaw (fast, free) and stores it.
 * Next session, the cognitive memory layer injects relevant summaries
 * so the agent can say "Welcome back! Last time we were working on..."
 *
 * @module services/session-summary
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from '../../../services/picoclaw.js';
import { upsertMemory } from './memory.js';

// ── Types ────────────────────────────────────────────────────

interface ConversationRow {
  role: string;
  content: string;
  created_at: string;
}

interface SummaryResult {
  summary: string;
  accomplished: string[];
  pending: string[];
  newFacts: Array<{ category: string; key: string; value: string }>;
}

// ── Configuration ────────────────────────────────────────────

const MIN_MESSAGES_FOR_SUMMARY = 4;    // Don't summarize trivial conversations
const MAX_MESSAGES_TO_SUMMARIZE = 30;  // Cap to keep prompt size manageable
const IDLE_TIMEOUT_MS = 30 * 60_000;   // 30 min idle = session end

// Track per-user last message time for idle detection
const lastMessageTime = new Map<string, number>();

// ── Core Functions ───────────────────────────────────────────

/**
 * Record that a user sent/received a message (for idle detection).
 */
export function touchSession(userId: string): void {
  lastMessageTime.set(userId, Date.now());
}

/**
 * Check if a user's session has gone idle and needs summarization.
 * Called periodically (e.g., every 5 minutes from a scheduler).
 */
export async function checkAndSummarizeIdleSessions(): Promise<void> {
  const now = Date.now();
  const toSummarize: string[] = [];

  for (const [userId, lastTime] of lastMessageTime) {
    if (now - lastTime >= IDLE_TIMEOUT_MS) {
      toSummarize.push(userId);
    }
  }

  for (const userId of toSummarize) {
    lastMessageTime.delete(userId);
    try {
      await summarizeSession(userId);
    } catch (err) {
      logger.debug({ err, userId }, 'session-summary: idle summarization failed (non-fatal)');
    }
  }
}

/**
 * Summarize the recent conversation for a user.
 * Stores the summary in session_summaries and extracts new facts into memory.
 */
export async function summarizeSession(userId: string): Promise<string | null> {
  try {
    // Get recent messages
    const messages = db.prepare(`
      SELECT role, content, created_at
      FROM conversation_log
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, MAX_MESSAGES_TO_SUMMARIZE) as ConversationRow[];

    if (messages.length < MIN_MESSAGES_FOR_SUMMARY) {
      return null;
    }

    // Reverse to chronological order
    messages.reverse();

    // Check if we already summarized these messages
    const lastSummary = db.prepare(`
      SELECT created_at FROM session_summaries
      WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(userId) as { created_at: string } | undefined;

    if (lastSummary) {
      const oldestMsg = messages[0].created_at;
      if (oldestMsg <= lastSummary.created_at) {
        return null; // Already summarized
      }
    }

    // Build conversation text (truncated)
    const conversationText = messages
      .map(m => `${m.role}: ${m.content.slice(0, 300)}`)
      .join('\n');

    // Summarize with PicoClaw (fast + free) or fallback to regex extraction
    let result: SummaryResult;

    if (await isPicoClawAvailable()) {
      result = await summarizeWithLLM(conversationText);
    } else {
      result = extractSummaryHeuristic(messages);
    }

    // Store summary
    const summaryId = uuid();
    db.prepare(`
      INSERT INTO session_summaries (id, user_id, summary, accomplished, pending_items, new_facts)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      summaryId,
      userId,
      result.summary,
      JSON.stringify(result.accomplished),
      JSON.stringify(result.pending),
      JSON.stringify(result.newFacts),
    );

    // Extract new facts into memory
    for (const fact of result.newFacts) {
      try {
        upsertMemory(userId, fact.category, fact.key, fact.value, 0.8, 'session_summary');
      } catch { /* non-fatal */ }
    }

    // Clean up old summaries (keep last 10)
    db.prepare(`
      DELETE FROM session_summaries
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM session_summaries
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 10
      )
    `).run(userId, userId);

    logger.info({ userId, summaryId, messageCount: messages.length }, 'session-summary: created');
    return result.summary;

  } catch (err) {
    logger.warn({ err, userId }, 'session-summary: failed');
    return null;
  }
}

// ── LLM Summarization (PicoClaw) ────────────────────────────

async function summarizeWithLLM(conversationText: string): Promise<SummaryResult> {
  const prompt = `Summarize this conversation between a user and an AI assistant. Be concise (2-3 sentences max).

Extract:
1. A brief summary of what was discussed
2. What was accomplished (list)
3. What is still pending or unfinished (list)
4. Any new facts learned about the user (category/key/value triples)

Conversation:
${conversationText.slice(0, 3000)}

Respond in JSON only, no markdown:
{"summary":"...","accomplished":["..."],"pending":["..."],"newFacts":[{"category":"...","key":"...","value":"..."}]}`;

  try {
    const response = await queryPicoClaw(prompt);
    
    // Try to parse JSON from response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as SummaryResult;
      return {
        summary: parsed.summary || 'Session ended.',
        accomplished: Array.isArray(parsed.accomplished) ? parsed.accomplished : [],
        pending: Array.isArray(parsed.pending) ? parsed.pending : [],
        newFacts: Array.isArray(parsed.newFacts) ? parsed.newFacts : [],
      };
    }
  } catch (err) {
    logger.debug({ err }, 'session-summary: LLM parse failed, using heuristic');
  }

  // Fallback to heuristic if LLM fails
  return {
    summary: `Conversation with ${conversationText.split('\n').length} exchanges.`,
    accomplished: [],
    pending: [],
    newFacts: [],
  };
}

// ── Heuristic Summarization (no LLM needed) ─────────────────

function extractSummaryHeuristic(messages: ConversationRow[]): SummaryResult {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // Extract topics from user messages
  const topics = new Set<string>();
  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();
    // Extract key nouns/verbs
    const topicPatterns = [
      /(?:help|assist|create|build|fix|update|change|add|remove|set up|configure)\s+(\w+(?:\s+\w+)?)/gi,
      /(?:about|regarding|for)\s+(\w+(?:\s+\w+)?)/gi,
      /(?:my|the)\s+(\w+(?:\s+\w+)?)/gi,
    ];
    for (const pattern of topicPatterns) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(content)) !== null) {
        const topic = m[1].trim();
        if (topic.length > 2 && topic.length < 30) topics.add(topic);
      }
    }
  }

  const topicList = [...topics].slice(0, 5);
  const summary = topicList.length > 0
    ? `Discussed: ${topicList.join(', ')}. ${userMessages.length} user messages, ${assistantMessages.length} responses.`
    : `Conversation with ${messages.length} messages.`;

  // Detect pending items (questions without clear resolution)
  const pending: string[] = [];
  const lastUserMsg = userMessages[userMessages.length - 1];
  if (lastUserMsg && lastUserMsg.content.includes('?')) {
    pending.push(lastUserMsg.content.slice(0, 100));
  }

  return {
    summary,
    accomplished: topicList.map(t => `Discussed ${t}`),
    pending,
    newFacts: [],
  };
}

// ── Session Continuity Greeting ──────────────────────────────

/**
 * Build a continuity context string for the start of a new session.
 * Injected into the system prompt so the agent can reference previous work.
 */
export function getSessionContinuityContext(userId: string): string {
  try {
    const lastSummary = db.prepare(`
      SELECT summary, pending_items, accomplished, created_at
      FROM session_summaries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId) as {
      summary: string;
      pending_items: string | null;
      accomplished: string | null;
      created_at: string;
    } | undefined;

    if (!lastSummary) return '';

    const age = getSessionAge(lastSummary.created_at);
    const parts: string[] = [`Last session (${age}): ${lastSummary.summary}`];

    if (lastSummary.pending_items) {
      try {
        const pending = JSON.parse(lastSummary.pending_items) as string[];
        if (pending.length > 0) {
          parts.push(`Still pending: ${pending.slice(0, 3).join('; ')}`);
        }
      } catch { /* ignore */ }
    }

    if (lastSummary.accomplished) {
      try {
        const accomplished = JSON.parse(lastSummary.accomplished) as string[];
        if (accomplished.length > 0) {
          parts.push(`Accomplished: ${accomplished.slice(0, 3).join('; ')}`);
        }
      } catch { /* ignore */ }
    }

    return parts.join('\n');
  } catch {
    return '';
  }
}

function getSessionAge(created_at: string): string {
  const diffMs = Date.now() - new Date(created_at).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ── Idle Session Checker (scheduler) ─────────────────────────

let idleCheckTimer: ReturnType<typeof setInterval> | null = null;

export function startSessionSummaryScheduler(): void {
  if (idleCheckTimer) return;

  idleCheckTimer = setInterval(() => {
    void checkAndSummarizeIdleSessions().catch(err =>
      logger.debug({ err }, 'session-summary: idle check failed')
    );
  }, 5 * 60_000); // Check every 5 minutes

  logger.info('session-summary: idle checker started (5min interval)');
}

export function stopSessionSummaryScheduler(): void {
  if (idleCheckTimer) {
    clearInterval(idleCheckTimer);
    idleCheckTimer = null;
  }
}
