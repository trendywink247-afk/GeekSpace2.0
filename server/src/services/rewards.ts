import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { logger } from '../logger.js';

export type RewardEventType = 'ACCEPTED_EXPERIMENT' | 'SHIPPED_MAIN' | 'SHIPPED_PROD' | 'ADOPTION_MILESTONE';

const CREDIT_AMOUNTS: Record<RewardEventType, number> = {
  ACCEPTED_EXPERIMENT: 10,
  SHIPPED_MAIN: 50,
  SHIPPED_PROD: 100,
  ADOPTION_MILESTONE: 100,
};

interface IssueRewardParams {
  userId: string;
  suggestionId?: string;
  clusterId?: string;
  eventType: RewardEventType;
}

export function issueReward(params: IssueRewardParams): { issued: boolean; credits: number } {
  const { userId, suggestionId, clusterId, eventType } = params;
  const credits = CREDIT_AMOUNTS[eventType];
  // uniqueKey prevents double-awards (INSERT OR IGNORE)
  const uniqueKey = `${eventType}:${clusterId || suggestionId || 'unknown'}:${userId}`;

  try {
    const result = db.prepare(`
      INSERT OR IGNORE INTO suggestion_rewards (id, user_id, suggestion_id, cluster_id, event_type, credits, unique_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), userId, suggestionId ?? null, clusterId ?? null, eventType, credits, uniqueKey);

    if (result.changes > 0) {
      // Only add credits if the reward row was actually inserted (not ignored)
      db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ?`).run(credits, userId);
      logger.info({ userId, eventType, credits, uniqueKey }, 'Suggestion reward issued');
      return { issued: true, credits };
    }
    return { issued: false, credits: 0 };
  } catch (err) {
    logger.error({ err, userId, eventType, uniqueKey }, 'Failed to issue suggestion reward');
    return { issued: false, credits: 0 };
  }
}

export function getUserRewards(userId: string): Array<{id: string; eventType: string; credits: number; suggestionId: string | null; clusterId: string | null; createdAt: string}> {
  return db.prepare(`
    SELECT id, event_type as eventType, credits, suggestion_id as suggestionId, cluster_id as clusterId, created_at as createdAt
    FROM suggestion_rewards WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as Array<{id: string; eventType: string; credits: number; suggestionId: string | null; clusterId: string | null; createdAt: string}>;
}
