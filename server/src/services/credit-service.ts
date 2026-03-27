/**
 * CreditService -- Centralised Credit and Quota Logic
 *
 * Provides a single source of truth for credit balance queries, deductions,
 * and quota checks. Unifies credit-related logic previously scattered
 * across `routes/agent/chat.ts`, `routes/agent/premium.ts`,
 * `routes/webhooks.ts`, and `services/llm.ts`.
 *
 * Supports two storage backends transparently:
 *  - **Subscriptions table** -- for paid users with billing cycles,
 *    `credits_remaining`, `credits_used_this_cycle`, and `monthly_credits`.
 *  - **Users table fallback** -- legacy/free users who only have a
 *    `credits` column and no `subscriptions` row.
 *
 * This module is additive; it does not replace existing inline deduction
 * calls in the routes. Callers can gradually migrate to it.
 *
 * @module services/credit-service
 */

import { db } from '../db/index.js';
import { logger } from '../logger.js';

// ── Types ───────────────────────────────────────────────────

/** Unified credit balance returned by {@link getBalance}, normalised across paid and free users. */
export interface CreditBalance {
  /** Subscription plan: 'free' | 'pro' | 'team'. */
  plan: string;
  /** Credits left in the current billing cycle (or legacy users.credits). */
  creditsRemaining: number;
  /** Credits consumed since the cycle started (0 for legacy free users). */
  creditsUsedThisCycle: number;
  /** Total credits allocated per cycle (5000 for legacy free users). */
  monthlyCredits: number;
  /** ISO 8601 timestamp when the cycle renews; empty string for legacy free users. */
  billingCycleEnd: string;
}

/** Aggregated usage metrics for a user over a rolling time window. */
export interface UsageReport {
  /** Number of assistant messages generated in the period. */
  totalMessages: number;
  /** Total input tokens sent to LLMs. */
  totalTokensIn: number;
  /** Total output tokens received from LLMs. */
  totalTokensOut: number;
  /** Total inferred cost in USD (4 decimal places). */
  totalCostUsd: number;
  /** Length of the reporting window in days. */
  periodDays: number;
}

// ── Service ─────────────────────────────────────────────────

/**
 * Get the full credit balance for a user.
 *
 * Checks the `subscriptions` table first (paid plans with billing
 * cycles). Falls back to the `users.credits` column for legacy/free
 * users who have no subscription row, returning a synthetic balance
 * with 5000 monthly credits and an empty billing cycle end.
 *
 * @param userId - Authenticated user ID
 * @returns A normalised {@link CreditBalance} regardless of storage backend
 */
export function getBalance(userId: string): CreditBalance {
  const sub = db.prepare(
    'SELECT plan, credits_remaining, credits_used_this_cycle, monthly_credits, billing_cycle_end FROM subscriptions WHERE user_id = ?',
  ).get(userId) as {
    plan: string;
    credits_remaining: number;
    credits_used_this_cycle: number;
    monthly_credits: number;
    billing_cycle_end: string;
  } | undefined;

  if (sub) {
    return {
      plan: sub.plan,
      creditsRemaining: sub.credits_remaining,
      creditsUsedThisCycle: sub.credits_used_this_cycle,
      monthlyCredits: sub.monthly_credits,
      billingCycleEnd: sub.billing_cycle_end,
    };
  }

  // Fallback: legacy users without a subscriptions row
  const user = db.prepare('SELECT plan, credits FROM users WHERE id = ?')
    .get(userId) as { plan: string; credits: number } | undefined;

  return {
    plan: user?.plan || 'free',
    creditsRemaining: user?.credits ?? 0,
    creditsUsedThisCycle: 0,
    monthlyCredits: 5000,
    billingCycleEnd: '',
  };
}

/**
 * Deduct credits from a user's subscription balance.
 *
 * Updates the `subscriptions` table by decrementing `credits_remaining`
 * (floored at 0) and incrementing `credits_used_this_cycle`. Guest users
 * and zero/negative amounts are silently ignored.
 *
 * This mirrors the existing `deductSubscriptionCredits()` in
 * `services/llm.ts` and is intended as the canonical replacement.
 *
 * @param userId - Authenticated user ID (no-op if starts with `guest:`)
 * @param amount - Number of credits to deduct (must be positive)
 * @param reason - Human-readable audit reason, e.g. `"chat"`, `"voice-stt"`
 */
export function deduct(userId: string, amount: number, reason: string): void {
  if (userId.startsWith('guest:')) return;
  if (amount <= 0) return;

  db.prepare(`
    UPDATE subscriptions
    SET credits_remaining = MAX(0, credits_remaining - ?),
        credits_used_this_cycle = credits_used_this_cycle + ?
    WHERE user_id = ?
  `).run(amount, amount, userId);

  logger.debug({ userId, amount, reason }, 'credit:deduct');
}

/**
 * Check whether a user has enough credits for a given feature.
 * Returns true if the user can proceed.
 *
 * Feature cost thresholds (matches existing inline checks):
 *   - 'chat'           → 1 credit minimum
 *   - 'premium-agent'  → 100 credits minimum
 *   - 'voice'          → 10 credits minimum
 *   - default          → 1 credit minimum
 */
export function checkQuota(userId: string, feature: string): boolean {
  const thresholds: Record<string, number> = {
    chat: 1,
    'premium-agent': 100,
    voice: 10,
  };

  const required = thresholds[feature] ?? 1;

  const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?')
    .get(userId) as { credits_remaining: number } | undefined;

  if (sub) {
    return sub.credits_remaining >= required;
  }

  // Fallback to users.credits for legacy free users
  const user = db.prepare('SELECT credits FROM users WHERE id = ?')
    .get(userId) as { credits: number } | undefined;

  return (user?.credits ?? 0) >= required;
}

/**
 * Get usage report for a given period (in days).
 * Queries the usage_events table, mirroring the pattern in routes/usage.ts.
 */
export function getUsage(userId: string, periodDays = 30): UsageReport {
  const row = db.prepare(`
    SELECT
      COUNT(*) as messages,
      COALESCE(SUM(tokens_in), 0) as tokens_in,
      COALESCE(SUM(tokens_out), 0) as tokens_out,
      COALESCE(SUM(cost_usd), 0) as cost_usd
    FROM usage_events
    WHERE user_id = ? AND created_at >= datetime('now', ? || ' days')
  `).get(userId, `-${periodDays}`) as {
    messages: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
  };

  return {
    totalMessages: row.messages,
    totalTokensIn: row.tokens_in,
    totalTokensOut: row.tokens_out,
    totalCostUsd: Number(row.cost_usd.toFixed(4)),
    periodDays,
  };
}
