// ============================================================
// CreditService — centralised credit/quota logic
//
// Extracts and unifies credit-related queries scattered across
// routes/agent/chat.ts, routes/agent/premium.ts, routes/webhooks.ts,
// and services/llm.ts.
//
// Does NOT replace any existing route code — additive only.
// ============================================================

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
 * Checks the subscriptions table first (paid plans), falls back
 * to the users table credits column (legacy/free users).
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
 * Deduct credits from a user's subscription.
 * Matches the existing deductSubscriptionCredits() in services/llm.ts.
 * Logs the deduction for audit purposes.
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
