// ============================================================
// SubscriptionRepository — centralised DB access for `subscriptions`
//
// Extracts queries verbatim from existing inline route usage.
// Does NOT replace any route code yet — additive only.
// ============================================================

import type Database from 'better-sqlite3';

/** Raw row shape from the `subscriptions` table. One active row per paid user. */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  /** Plan tier: 'free' | 'pro' | 'team'. */
  plan: string;
  /** Billing status: 'active' | 'cancelled' | 'past_due'. */
  status: string;
  /** Credits granted at the start of each billing cycle. */
  monthly_credits: number;
  /** Credits left in the current cycle. Floor: 0. */
  credits_remaining: number;
  /** Credits consumed since billing_cycle_start. */
  credits_used_this_cycle: number;
  /** Billing period length in days (typically 30). */
  billing_interval_days: number;
  /** ISO 8601 timestamp. Start of current billing window. */
  billing_cycle_start: string;
  /** ISO 8601 timestamp. End of current billing window (auto-renews here). */
  billing_cycle_end: string;
  price_usd: number;
  price_inr: number;
  /** ISO 4217 currency code, e.g. 'USD' | 'INR'. */
  currency: string;
  /** ISO 8601 timestamp. */
  created_at: string;
}

/**
 * Centralised data-access layer for the `subscriptions` table.
 * Paid users have one row here; free users fall back to `users.credits`.
 */
export class SubscriptionRepository {
  constructor(private readonly db: Database.Database) {}

  /**
   * Fetch the full subscription row for a user.
   * @param userId - UUID of the user.
   * @returns The matching SubscriptionRow, or undefined for free-plan users without a row.
   */
  getByUserId(userId: string): SubscriptionRow | undefined {
    return this.db
      .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
      .get(userId) as SubscriptionRow | undefined;
  }

  /**
   * Lightweight lookup of remaining credits for credit-check routes.
   * @param userId - UUID of the user.
   * @returns Object with `credits_remaining`, or undefined for free-plan users without a subscription row.
   */
  getCreditsRemaining(userId: string): { credits_remaining: number } | undefined {
    return this.db
      .prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?')
      .get(userId) as { credits_remaining: number } | undefined;
  }

  /**
   * Lightweight lookup used by chat routes for quota checks.
   * @param userId - UUID of the user.
   * @returns Plan, remaining credits, and cycle end date; or undefined if no subscription row exists.
   */
  getPlanAndCredits(userId: string): { plan: string; credits_remaining: number; billing_cycle_end: string } | undefined {
    return this.db
      .prepare('SELECT plan, credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?')
      .get(userId) as { plan: string; credits_remaining: number; billing_cycle_end: string } | undefined;
  }

  /**
   * Full credit info used by the `/credits` Telegram command response.
   * @param userId - UUID of the user.
   * @returns Plan, remaining credits, cycle usage, and cycle end date; or undefined if no subscription row exists.
   */
  getCreditInfo(userId: string): { plan: string; credits_remaining: number; credits_used_this_cycle: number; billing_cycle_end: string } | undefined {
    return this.db
      .prepare('SELECT plan, credits_remaining, credits_used_this_cycle, billing_cycle_end FROM subscriptions WHERE user_id = ?')
      .get(userId) as { plan: string; credits_remaining: number; credits_used_this_cycle: number; billing_cycle_end: string } | undefined;
  }

  /**
   * Deduct credits from a subscription.
   * Matches the pattern in services/llm.ts deductSubscriptionCredits().
   */
  deductCredits(userId: string, amount: number): void {
    if (userId.startsWith('guest:')) return;
    if (amount <= 0) return;

    this.db
      .prepare(`
        UPDATE subscriptions
        SET credits_remaining = MAX(0, credits_remaining - ?),
            credits_used_this_cycle = credits_used_this_cycle + ?
        WHERE user_id = ?
      `)
      .run(amount, amount, userId);
  }
}
