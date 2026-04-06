/**
 * Cognitive Memory — Intelligent context assembly for LLM calls
 *
 * Instead of blindly injecting all facts, this service builds a ranked,
 * relevant, temporally-aware context block. It connects:
 *  - Structured memories (facts with confidence + decay)
 *  - Graph memory entities (people, companies, places + relations)
 *  - Active goals and their current status
 *  - Recent session summaries (cross-session continuity)
 *  - Time-sensitive context (reminders due, stale goals, calendar)
 *
 * The output is a single markdown block injected into the system prompt
 * before each LLM call, replacing the simpler buildMemoryContext().
 *
 * @module services/cognitive-memory
 */

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { getUserEntities, recallEntity, extractEntitiesFromText } from './graph-memory.js';
import { getTopUserMemories, type UserMemory } from './memory.js';
import { getUserFeedbackPatterns } from '../../agent/services/feedback-service.js';
import { formatLearnedRulesForPrompt } from '../../agent/services/meta-learning.js';
import { formatInferredGoalsForPrompt } from '../../agent/services/goal-inference.js';
import { formatSuggestedChainsForPrompt } from '../../agent/services/tool-chain-service.js';

// ── Types ────────────────────────────────────────────────────

interface AgentMemoryRow {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  access_count: number;
  updated_at: string;
  last_accessed_at: string | null;
}

interface GoalRow {
  id: string;
  title: string;
  status: string;
  progress: number;
  assigned_agent: string | null;
  updated_at: string;
}

interface GoalStepRow {
  title: string;
  status: string;
  effort: string | null;
}

interface ReminderRow {
  text: string;
  scheduled_for: number;
  channel: string;
}

interface SessionSummaryRow {
  id: string;
  summary: string;
  pending_items: string | null;
  accomplished: string | null;
  created_at: string;
}

interface CalendarEventRow {
  title: string;
  start_time: string;
  end_time: string | null;
}

// ── Configuration ────────────────────────────────────────────

const MAX_MEMORY_FACTS = 15;        // Top facts by relevance
const MAX_ENTITIES = 8;             // Top graph entities
const MAX_GOALS = 5;                // Active goals to show
const MAX_REMINDERS = 5;            // Upcoming reminders
const MAX_SESSION_SUMMARIES = 2;    // Recent session summaries
const STALE_GOAL_DAYS = 3;
const RELEVANCE_RECENCY_WEIGHT = 0.4;
const RELEVANCE_CONFIDENCE_WEIGHT = 0.3;
const RELEVANCE_ACCESS_WEIGHT = 0.15;
const RELEVANCE_KEYWORD_WEIGHT = 0.15;

// ── Memory Decay ─────────────────────────────────────────────

/**
 * Decay unused memories and boost accessed ones.
 * Should be called on a daily schedule.
 */
export function runMemoryDecay(userId: string): void {
  try {
    // Decay memories not accessed in 7+ days
    db.prepare(`
      UPDATE agent_memory
      SET confidence = MAX(0.1, confidence - 0.02)
      WHERE user_id = ? 
        AND (last_accessed_at IS NULL OR last_accessed_at < datetime('now', '-7 days'))
        AND confidence > 0.1
    `).run(userId);

    // Boost frequently accessed memories (cap at 1.0)
    db.prepare(`
      UPDATE agent_memory
      SET confidence = MIN(1.0, confidence + 0.01)
      WHERE user_id = ?
        AND last_accessed_at > datetime('now', '-1 day')
        AND confidence < 1.0
    `).run(userId);
  } catch (err) {
    logger.debug({ err, userId }, 'cognitive-memory: decay failed (non-fatal)');
  }
}

/**
 * Mark memories as accessed (updates last_accessed_at).
 */
function touchMemories(memoryIds: string[]): void {
  if (memoryIds.length === 0) return;
  try {
    const placeholders = memoryIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE agent_memory 
      SET last_accessed_at = datetime('now'), access_count = access_count + 1
      WHERE id IN (${placeholders})
    `).run(...memoryIds);
  } catch { /* non-fatal */ }
}

// ── Relevance Scoring ────────────────────────────────────────

function scoreMemory(memory: AgentMemoryRow, messageKeywords: Set<string>, now: number): number {
  // Recency score: how recently was this memory updated?
  const updatedAt = new Date(memory.updated_at).getTime();
  const daysSinceUpdate = Math.max(0, (now - updatedAt) / 86_400_000);
  const recencyScore = Math.max(0, 1 - (daysSinceUpdate / 30)); // decays over 30 days

  // Confidence score (already 0-1)
  const confidenceScore = memory.confidence;

  // Access frequency score (normalized, caps at 20 accesses)
  const accessScore = Math.min(1, memory.access_count / 20);

  // Keyword match score
  const memWords = `${memory.category} ${memory.key} ${memory.value}`.toLowerCase().split(/\s+/);
  const matchCount = memWords.filter(w => messageKeywords.has(w)).length;
  const keywordScore = Math.min(1, matchCount / 3);

  return (
    RELEVANCE_RECENCY_WEIGHT * recencyScore +
    RELEVANCE_CONFIDENCE_WEIGHT * confidenceScore +
    RELEVANCE_ACCESS_WEIGHT * accessScore +
    RELEVANCE_KEYWORD_WEIGHT * keywordScore
  );
}

// ── Main Context Builder ─────────────────────────────────────

/**
 * Build a ranked, relevant cognitive context block for the current message.
 * This replaces the simpler buildMemoryContext() with intelligent selection.
 *
 * @param userId - The user ID
 * @param currentMessage - The user's current message (for relevance scoring)
 * @returns A markdown string to inject into the system prompt
 */
export function buildCognitiveContext(userId: string, currentMessage: string, _agentId?: string): string {
  const sections: string[] = [];
  const now = Date.now();

  // Extract keywords from current message for relevance scoring
  const messageKeywords = new Set(
    currentMessage.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );

  // ── 1. Session Continuity (cross-session context) ──────────
  try {
    const summaries = db.prepare(`
      SELECT id, summary, pending_items, accomplished, created_at
      FROM session_summaries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, MAX_SESSION_SUMMARIES) as SessionSummaryRow[];

    if (summaries.length > 0) {
      const lines: string[] = [];
      for (const s of summaries) {
        const age = getTimeAgo(new Date(s.created_at).getTime(), now);
        lines.push(`[${age}] ${s.summary}`);
        if (s.pending_items) {
          try {
            const pending = JSON.parse(s.pending_items) as string[];
            if (pending.length > 0) lines.push(`  Still pending: ${pending.join(', ')}`);
          } catch { /* ignore */ }
        }
      }
      if (lines.length > 0) {
        sections.push(`## Recent Sessions\n${lines.join('\n')}`);
      }
    }
  } catch { /* table may not exist yet */ }

  // ── 2. Ranked Memory Facts ─────────────────────────────────
  try {
    const allMemories = db.prepare(`
      SELECT id, category, key, value, confidence, source, access_count, updated_at,
             last_accessed_at
      FROM agent_memory
      WHERE user_id = ? AND confidence > 0.2
      ORDER BY confidence DESC
      LIMIT 50
    `).all(userId) as AgentMemoryRow[];

    if (allMemories.length > 0) {
      // Score and rank
      const scored = allMemories.map(m => ({
        memory: m,
        score: scoreMemory(m, messageKeywords, now),
      }));
      scored.sort((a, b) => b.score - a.score);

      const topMemories = scored.slice(0, MAX_MEMORY_FACTS);

      // Touch accessed memories
      touchMemories(topMemories.map(s => s.memory.id));

      // Group by category
      const byCategory = new Map<string, string[]>();
      for (const { memory } of topMemories) {
        const cat = memory.category || 'general';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(`${memory.key}: ${memory.value}`);
      }

      const lines: string[] = [];
      for (const [cat, items] of byCategory) {
        lines.push(`**${cat}:** ${items.join('; ')}`);
      }
      if (lines.length > 0) {
        sections.push(`## What I Know About You\n${lines.join('\n')}`);
      }
    }
  } catch (err) {
    logger.debug({ err }, 'cognitive-memory: fact retrieval failed');
  }

  // ── 3. User Memories (flat key-value store) ────────────────
  try {
    const userMemories = getTopUserMemories(userId, 8);
    if (userMemories && userMemories.length > 0) {
      const memLines = userMemories.map((m: UserMemory) => `- ${m.key}: ${m.value}`);
      sections.push(`## Remembered Facts\n${memLines.join('\n')}`);
    }
  } catch { /* non-fatal */ }

  // ── 4. Graph Entities (people, companies, places) ──────────
  try {
    // First, check if current message mentions known entities
    const mentionedEntities = extractEntitiesFromText(currentMessage);
    const entityLines: string[] = [];

    for (const mention of mentionedEntities.slice(0, 3)) {
      const recalled = recallEntity(userId, mention.name);
      if (recalled && recalled.mentions > 1) {
        const props = Object.entries(recalled.entity.properties || {})
          .filter(([k]) => k !== 'id' && k !== 'user_id')
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        const relNames = recalled.relations
          .filter(r => r.related_name)
          .map(r => r.related_name)
          .slice(0, 3);
        let line = `**${mention.name}** (${mention.type}, mentioned ${recalled.mentions}×)`;
        if (props) line += ` — ${props}`;
        if (relNames.length > 0) line += ` [connected to: ${relNames.join(', ')}]`;
        entityLines.push(line);
      }
    }

    // Also show top entities if no message-specific ones found
    if (entityLines.length === 0) {
      const topEntities = getUserEntities(userId, MAX_ENTITIES);
      for (const e of topEntities) {
        if (e.mention_count > 2) {
          entityLines.push(`**${e.name}** (${e.type}, ${e.mention_count}× mentioned)`);
        }
      }
    }

    if (entityLines.length > 0) {
      sections.push(`## People & Context\n${entityLines.join('\n')}`);
    }
  } catch { /* non-fatal */ }

  // ── 5. Active Goals ────────────────────────────────────────
  try {
    const goals = db.prepare(`
      SELECT id, title, status, progress, assigned_agent, updated_at
      FROM goals
      WHERE user_id = ? AND status = 'active'
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(userId, MAX_GOALS) as GoalRow[];

    if (goals.length > 0) {
      const goalLines: string[] = [];
      for (const g of goals) {
        const emoji = g.progress >= 75 ? '🟢' : g.progress >= 25 ? '🟡' : '🔴';
        const daysSinceUpdate = Math.max(0, (now - new Date(g.updated_at).getTime()) / 86_400_000);
        const stale = daysSinceUpdate > STALE_GOAL_DAYS ? ' ⚠️ stale' : '';

        // Get next pending step
        const nextStep = db.prepare(`
          SELECT title, status, effort FROM goal_steps
          WHERE goal_id = ? AND status = 'pending'
          ORDER BY step_order ASC LIMIT 1
        `).get(g.id) as GoalStepRow | undefined;

        let line = `${emoji} **${g.title}** — ${g.progress}%${stale}`;
        if (nextStep) line += ` | Next: ${nextStep.title}`;
        if (g.assigned_agent) line += ` [${g.assigned_agent}]`;
        goalLines.push(line);
      }
      sections.push(`## Active Goals\n${goalLines.join('\n')}`);
    }
  } catch { /* goals table may not exist */ }

  // ── 6. Upcoming Reminders (due within 24h) ─────────────────
  try {
    const upcoming = db.prepare(`
      SELECT text, scheduled_for, channel
      FROM reminders
      WHERE user_id = ? AND completed = 0
        AND scheduled_for BETWEEN ? AND ?
      ORDER BY scheduled_for ASC
      LIMIT ?
    `).all(userId, now, now + 86_400_000, MAX_REMINDERS) as ReminderRow[];

    if (upcoming.length > 0) {
      const lines = upcoming.map(r => {
        const when = getTimeUntil(r.scheduled_for, now);
        return `- ${r.text} (${when})`;
      });
      sections.push(`## Upcoming Reminders\n${lines.join('\n')}`);
    }
  } catch { /* non-fatal */ }

  // ── 7. Calendar Events (today) ─────────────────────────────
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const events = db.prepare(`
      SELECT title, start_time, end_time
      FROM calendar_events
      WHERE user_id = ? AND start_time BETWEEN ? AND ?
      ORDER BY start_time ASC
      LIMIT 5
    `).all(userId, todayStart.toISOString(), todayEnd.toISOString()) as CalendarEventRow[];

    if (events.length > 0) {
      const lines = events.map(e => {
        const time = new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `- ${time}: ${e.title}`;
      });
      sections.push(`## Today's Schedule\n${lines.join('\n')}`);
    }
  } catch { /* calendar table may not exist */ }

  // ── Assemble ───────────────────────────────────────────────

  // ── Inject feedback anti-patterns ────────────────────────
  try {
    const feedbackBlock = getUserFeedbackPatterns(userId);
    if (feedbackBlock) sections.push(feedbackBlock);
  } catch { /* feedback service may not be ready */ }

  // ── Inject inferred goals (behaviour-detected, not explicitly stated) ──────
  try {
    const inferredGoalsBlock = formatInferredGoalsForPrompt(userId);
    if (inferredGoalsBlock) sections.push(inferredGoalsBlock);
  } catch { /* non-fatal */ }

  // ── Inject meta-learned rules (nightly reflection output) ──────────────
  try {
    const learnedRulesBlock = formatLearnedRulesForPrompt(userId);
    if (learnedRulesBlock) sections.push(learnedRulesBlock);
  } catch { /* non-fatal */ }

  // ── Inject tool composition suggestions ─────────────────────────────────
  try {
    const chainsBlock = formatSuggestedChainsForPrompt(userId, currentMessage);
    if (chainsBlock) sections.push(chainsBlock);
  } catch { /* non-fatal */ }

  if (sections.length === 0) return '';

  return `\n--- COGNITIVE CONTEXT (auto-generated, do not mention this block) ---\n${sections.join('\n\n')}\n--- END CONTEXT ---\n`;
}

// ── Helpers ──────────────────────────────────────────────────

function getTimeAgo(timestamp: number, now: number): string {
  const diffMs = now - timestamp;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getTimeUntil(timestamp: number, now: number): string {
  const diffMs = timestamp - now;
  if (diffMs < 0) return 'overdue';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

// ── DB Migration ─────────────────────────────────────────────

/**
 * Add cognitive memory columns and session_summaries table.
 * Safe to call multiple times (uses IF NOT EXISTS / try-catch for ALTER).
 */
export function initCognitiveMemoryTables(): void {
  // Add last_accessed_at to agent_memory
  try {
    db.exec("ALTER TABLE agent_memory ADD COLUMN last_accessed_at TEXT");
    logger.info('cognitive-memory: added last_accessed_at to agent_memory');
  } catch { /* column already exists */ }

  // Session summaries table for cross-session continuity
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_summaries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT,
      summary TEXT NOT NULL,
      accomplished TEXT,
      pending_items TEXT,
      new_facts TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_session_summaries_user
      ON session_summaries(user_id, created_at);
  `);

  logger.info('cognitive-memory: tables initialized');
}
