// ============================================================
// Token Budget Service — Monthly token tracking and smart routing
//
// Tracks per-user token consumption with monthly reset.
// Enforces budget limits and triggers degradation to cheaper
// providers when users exceed their allocation.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import crypto from 'crypto';

const PLAN_TOKEN_BUDGETS: Record<string, number> = {
  free: 50000,
  intro: 300000,
  monthly: 300000,
  halfyear: 750000,
  yearly: 1000000,
};

const WARNING_THRESHOLDS = [0.7, 0.9, 1.0];

export function getTokenBudget(plan: string): number {
  return PLAN_TOKEN_BUDGETS[plan] || PLAN_TOKEN_BUDGETS.free;
}

export function getUserTokenUsage(userId: string): { used: number; budget: number; percentage: number } {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const row = db.prepare(
    'SELECT tokens_used, tokens_budget FROM token_usage WHERE user_id = ? AND month = ?'
  ).get(userId, month) as { tokens_used: number; tokens_budget: number } | undefined;

  const sub = db.prepare(
    'SELECT plan, tokens_budget, tokens_used_this_cycle FROM subscriptions WHERE user_id = ?'
  ).get(userId) as { plan: string; tokens_budget: number; tokens_used_this_cycle: number } | undefined;

  const budget = row?.tokens_budget || sub?.tokens_budget || getTokenBudget(sub?.plan || 'free');
  const used = row?.tokens_used || sub?.tokens_used_this_cycle || 0;

  return { used, budget, percentage: used / budget };
}

export function recordTokenUsage(userId: string, tokens: number): void {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  db.prepare(`
    INSERT INTO token_usage (id, user_id, month, tokens_used, tokens_budget)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, month) DO UPDATE SET
      tokens_used = tokens_used + excluded.tokens_used
  `).run(crypto.randomUUID(), userId, month, tokens, 0);

  // Also update subscription for real-time tracking
  db.prepare(`
    UPDATE subscriptions SET tokens_used_this_cycle = tokens_used_this_cycle + ?
    WHERE user_id = ?
  `).run(tokens, userId);

  checkWarningThresholds(userId);
}

function checkWarningThresholds(userId: string): void {
  const { used, budget, percentage } = getUserTokenUsage(userId);

  for (const threshold of WARNING_THRESHOLDS) {
    if (percentage >= threshold && percentage < threshold + 0.05) {
      logger.info({ userId, threshold, used, budget }, 'Token budget warning threshold reached');
      break;
    }
  }
}

export function shouldDegradeRouting(userId: string): boolean {
  const { percentage } = getUserTokenUsage(userId);
  return percentage >= 1.0;
}
