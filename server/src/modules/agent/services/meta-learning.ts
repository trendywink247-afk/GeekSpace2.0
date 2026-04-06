/**
 * Meta-Learning Service — Nightly reflection on agent performance
 *
 * Each night, analyzes the day's conversations + feedback ratings.
 * Identifies patterns: what worked, what failed, what to do differently.
 * Generates LEARNED RULES that get injected into future system prompts.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage, type Provider } from './llm.js';

export interface MetaReflection {
  id: string;
  user_id: string;
  reflection_date: string;
  summary: string;
  what_worked: string[];
  what_failed: string[];
  learned_rules: string[];
  messages_analyzed: number;
  positive_feedback: number;
  negative_feedback: number;
  created_at: string;
}

interface MetaReflectionRow extends Omit<MetaReflection, 'what_worked' | 'what_failed' | 'learned_rules'> {
  what_worked: string;
  what_failed: string;
  learned_rules: string;
}

function parseRow(row: MetaReflectionRow): MetaReflection {
  const parseJSON = <T>(s: string, fallback: T): T => { try { return JSON.parse(s); } catch { return fallback; } };
  return {
    ...row,
    what_worked: parseJSON(row.what_worked, []),
    what_failed: parseJSON(row.what_failed, []),
    learned_rules: parseJSON(row.learned_rules, []),
  };
}

/**
 * Run reflection for one user. Called nightly from cron.
 */
export async function reflectOnUserDay(userId: string): Promise<MetaReflection | null> {
  try {
    // Get conversations from last 24h
    const messages = db.prepare(`
      SELECT id, role, content, confidence, created_at
      FROM conversation_log
      WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at ASC
    `).all(userId) as Array<{ id: string; role: string; content: string; confidence: number | null; created_at: string }>;

    if (messages.length < 4) return null;

    // Get feedback for these messages
    const messageIds = messages.map(m => m.id);
    const placeholders = messageIds.map(() => '?').join(',');
    const feedback = db.prepare(`
      SELECT message_id, rating, comment FROM message_feedback
      WHERE message_id IN (${placeholders})
    `).all(...messageIds) as Array<{ message_id: string; rating: string; comment: string }>;

    const positive = feedback.filter(f => f.rating === 'up').length;
    const negative = feedback.filter(f => f.rating === 'down').length;

    // Build the reflection prompt
    const conversationSummary = messages.slice(0, 50).map(m => {
      const fb = feedback.find(f => f.message_id === m.id);
      const fbMark = fb ? (fb.rating === 'up' ? ' [👍]' : ` [👎: ${fb.comment || 'no comment'}]`) : '';
      const conf = m.confidence !== null ? ` (conf: ${m.confidence.toFixed(2)})` : '';
      return `${m.role}: ${m.content.slice(0, 200)}${conf}${fbMark}`;
    }).join('\n');

    const prompt = `Reflect on this AI assistant's performance over the last day with this user. Identify what worked, what failed, and what should be done differently.

Conversations (with feedback markers):
${conversationSummary.slice(0, 6000)}

Return JSON:
{
  "summary": "1-2 sentence overall assessment",
  "what_worked": ["specific things that got positive feedback or seemed effective"],
  "what_failed": ["specific things that got negative feedback or seemed off"],
  "learned_rules": ["actionable rules to apply tomorrow, e.g.: 'When user asks about code, lead with code not explanations'"]
}

Max 5 items per array. Be specific. JSON only:`;

    const messages_arr: ChatMessage[] = [
      { role: 'system', content: 'You analyze AI assistant performance and extract learnings. Return JSON only.' },
      { role: 'user', content: prompt },
    ];

    const result = await routeChat(messages_arr, { userId, forceProvider: 'groq' as Provider });

    const jsonMatch = result.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const reflection = JSON.parse(jsonMatch[0]) as {
      summary: string;
      what_worked: string[];
      what_failed: string[];
      learned_rules: string[];
    };

    const id = uuid();
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO meta_reflections (id, user_id, reflection_date, summary, what_worked, what_failed, learned_rules, messages_analyzed, positive_feedback, negative_feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, today,
      reflection.summary.slice(0, 500),
      JSON.stringify(reflection.what_worked.slice(0, 5)),
      JSON.stringify(reflection.what_failed.slice(0, 5)),
      JSON.stringify(reflection.learned_rules.slice(0, 5)),
      messages.length, positive, negative,
    );

    logger.info({ userId, positive, negative, rules: reflection.learned_rules.length }, 'meta-learning: reflection complete');

    const row = db.prepare('SELECT * FROM meta_reflections WHERE id = ?').get(id) as MetaReflectionRow;
    return parseRow(row);
  } catch (err) {
    logger.warn({ err, userId }, 'meta-learning: reflection failed');
    return null;
  }
}

/**
 * Get accumulated learned rules from recent reflections (last 14 days).
 * Returns deduplicated list for system prompt injection.
 */
export function getLearnedRules(userId: string): string[] {
  try {
    const reflections = db.prepare(`
      SELECT learned_rules FROM meta_reflections
      WHERE user_id = ? AND reflection_date >= date('now', '-14 days')
      ORDER BY reflection_date DESC
    `).all(userId) as Array<{ learned_rules: string }>;

    const allRules: string[] = [];
    for (const r of reflections) {
      try {
        const rules = JSON.parse(r.learned_rules) as string[];
        allRules.push(...rules);
      } catch { /* skip */ }
    }

    // Deduplicate (case-insensitive) and limit
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const rule of allRules) {
      const key = rule.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rule);
      }
    }

    return unique.slice(0, 8);
  } catch (err) {
    logger.debug({ err }, 'meta-learning: get rules failed');
    return [];
  }
}

/**
 * Format learned rules as a context block.
 */
export function formatLearnedRulesForPrompt(userId: string): string {
  const rules = getLearnedRules(userId);
  if (rules.length === 0) return '';

  const lines = ['## Learned Rules (apply these based on past feedback)'];
  for (const rule of rules) {
    lines.push(`- ${rule}`);
  }
  return '\n' + lines.join('\n');
}

/**
 * Run reflection for all active users (called from cron 2am).
 */
export async function runNightlyReflection(): Promise<void> {
  try {
    const users = db.prepare(`
      SELECT DISTINCT user_id FROM conversation_log
      WHERE created_at >= datetime('now', '-24 hours')
    `).all() as Array<{ user_id: string }>;

    logger.info({ count: users.length }, 'meta-learning: starting nightly reflection');

    for (const { user_id } of users) {
      await reflectOnUserDay(user_id);
      await new Promise(r => setTimeout(r, 2000));
    }

    logger.info('meta-learning: nightly reflection complete');
  } catch (err) {
    logger.error({ err }, 'meta-learning: nightly run failed');
  }
}
