/**
 * Goal Inference Service — Detect implicit goals from behavior
 *
 * Analyzes recent conversations, repeated themes, frustrations, and aspirations
 * to detect goals the user hasn't explicitly stated. Suggests them gently.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage, type Provider } from './llm.js';

export interface InferredGoal {
  id: string;
  user_id: string;
  title: string;
  reasoning: string;
  confidence: number;
  evidence: string[];
  status: 'suggested' | 'accepted' | 'rejected' | 'converted';
  suggested_at: string;
  user_response: string | null;
  converted_goal_id: string | null;
}

interface InferredGoalRow extends Omit<InferredGoal, 'evidence'> {
  evidence: string;
}

function parseRow(row: InferredGoalRow): InferredGoal {
  return {
    ...row,
    evidence: (() => { try { return JSON.parse(row.evidence); } catch { return []; } })(),
  };
}

/**
 * Run goal inference for a user. Analyzes recent conversations.
 */
export async function inferGoalsForUser(userId: string): Promise<InferredGoal[]> {
  try {
    const recent = db.prepare(`
      SELECT role, content, created_at FROM conversation_log
      WHERE user_id = ? AND created_at >= datetime('now', '-14 days')
      ORDER BY created_at DESC LIMIT 80
    `).all(userId) as Array<{ role: string; content: string; created_at: string }>;

    if (recent.length < 8) return [];

    // Get already-suggested goals to avoid duplicates
    const existing = db.prepare(`
      SELECT title FROM inferred_goals WHERE user_id = ? AND status != 'rejected'
    `).all(userId) as Array<{ title: string }>;

    const conversationText = recent.reverse()
      .map(r => `${r.role}: ${r.content.slice(0, 250)}`)
      .join('\n');

    const prompt = `Analyze this user's recent conversations. Look for IMPLICIT goals they haven't explicitly stated:

1. Recurring frustrations (suggests they want to FIX something)
2. Repeated themes (suggests focus area)
3. Aspirations mentioned in passing (suggests want to achieve)
4. Skills they're trying to learn (suggests learning goal)
5. Habits they're struggling with (suggests behavior change goal)

DO NOT suggest these (already known):
${existing.map(e => '- ' + e.title).join('\n') || '(none)'}

Conversations (last 14 days):
${conversationText.slice(0, 8000)}

Return JSON array of NEW inferred goals (max 3). Empty array if nothing significant:
[
  {
    "title": "short goal title (e.g., 'Improve sleep schedule')",
    "reasoning": "why you think this is a goal (1-2 sentences)",
    "confidence": 0.0-1.0,
    "evidence": ["quote 1 from conversation", "quote 2"]
  }
]

Only suggest goals with confidence ≥ 0.6. JSON only:`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You analyze user behavior to find implicit goals. Return JSON array only.' },
      { role: 'user', content: prompt },
    ];

    const result = await routeChat(messages, { userId, forceProvider: 'groq' as Provider });

    const jsonMatch = result.reply.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const goals = JSON.parse(jsonMatch[0]) as Array<{
      title: string;
      reasoning: string;
      confidence: number;
      evidence: string[];
    }>;

    const created: InferredGoal[] = [];
    for (const goal of goals.slice(0, 3)) {
      if (goal.confidence < 0.6) continue;
      if (!goal.title || goal.title.length < 5) continue;

      const id = uuid();
      db.prepare(`
        INSERT INTO inferred_goals (id, user_id, title, reasoning, confidence, evidence)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, goal.title.slice(0, 200), goal.reasoning.slice(0, 500), goal.confidence, JSON.stringify(goal.evidence.slice(0, 5)));

      const created_row = db.prepare('SELECT * FROM inferred_goals WHERE id = ?').get(id) as InferredGoalRow;
      created.push(parseRow(created_row));
    }

    if (created.length > 0) {
      logger.info({ userId, count: created.length }, 'goal-inference: new goals detected');
    }
    return created;
  } catch (err) {
    logger.warn({ err, userId }, 'goal-inference: failed');
    return [];
  }
}

/**
 * Get recent suggestions to surface in chat or agent context.
 */
export function getPendingInferredGoals(userId: string, limit = 3): InferredGoal[] {
  const rows = db.prepare(`
    SELECT * FROM inferred_goals
    WHERE user_id = ? AND status = 'suggested'
    ORDER BY confidence DESC, suggested_at DESC LIMIT ?
  `).all(userId, limit) as InferredGoalRow[];
  return rows.map(parseRow);
}

/**
 * Format inferred goals as context for the LLM to potentially mention.
 */
export function formatInferredGoalsForPrompt(userId: string): string {
  const pending = getPendingInferredGoals(userId, 2);
  if (pending.length === 0) return '';

  const lines = ['## Inferred Goals (mention naturally if relevant)'];
  for (const g of pending) {
    lines.push(`- ${g.title} (confidence: ${(g.confidence * 100).toFixed(0)}%) — ${g.reasoning}`);
  }
  return '\n' + lines.join('\n');
}

/**
 * User accepted/rejected an inferred goal.
 */
export function respondToInferredGoal(id: string, response: 'accepted' | 'rejected', convertedGoalId?: string): void {
  db.prepare(`
    UPDATE inferred_goals
    SET status = ?, user_response = ?, converted_goal_id = ?
    WHERE id = ?
  `).run(response === 'accepted' && convertedGoalId ? 'converted' : response, response, convertedGoalId || null, id);
}

/**
 * Run inference for all active users (called from cron 3am).
 */
export async function runNightlyGoalInference(): Promise<void> {
  try {
    const users = db.prepare(`
      SELECT DISTINCT user_id FROM conversation_log
      WHERE created_at >= datetime('now', '-7 days')
    `).all() as Array<{ user_id: string }>;

    logger.info({ count: users.length }, 'goal-inference: starting nightly run');

    for (const { user_id } of users) {
      await inferGoalsForUser(user_id);
      await new Promise(r => setTimeout(r, 2000));
    }

    logger.info('goal-inference: nightly run complete');
  } catch (err) {
    logger.error({ err }, 'goal-inference: nightly run failed');
  }
}
