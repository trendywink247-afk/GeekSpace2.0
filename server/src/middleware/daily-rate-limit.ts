/**
 * @module middleware/daily-rate-limit
 *
 * Per-tier daily message cap for web-channel chat requests.
 *
 * Caps are enforced only on `channel: 'web'` requests. Telegram, automation,
 * and background jobs bypass this middleware entirely — it is only mounted on
 * `POST /api/agent/chat` and `POST /api/agent/chat/stream`.
 *
 * Counts are persisted in the `daily_message_counts` SQLite table with a
 * (user_id, date) composite primary key. The date is UTC ISO string
 * (YYYY-MM-DD), so counters auto-reset at midnight UTC.
 *
 * Set `DISABLE_RATE_LIMITS=1` to short-circuit all checks (useful in tests
 * and local development).
 */

import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { logger } from "../logger.js";
import type { AuthRequest } from "./auth.js";

/** Daily message cap per plan tier. */
export const DAILY_CAPS: Record<string, number> = {
	free: 20,
	pilot: 200,
	monthly: 200, // alias for pilot
	intro: 200,
	halfyear: 500,
	yearly: 1000,
	pro: 2000,
	team: 5000,
};

/** Fallback cap for unknown/unrecognised plan slugs. */
const DEFAULT_CAP = DAILY_CAPS.free;

/**
 * Returns today's UTC date as a YYYY-MM-DD string.
 * Exported for test mocking.
 */
export function getTodayUTC(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Fetches the current daily count for `userId` on `date`.
 * Returns 0 if no row exists yet.
 */
export function getDailyCount(userId: string, date: string): number {
	const row = db
		.prepare(
			"SELECT count FROM daily_message_counts WHERE user_id = ? AND date = ?",
		)
		.get(userId, date) as { count: number } | undefined;
	return row?.count ?? 0;
}

/**
 * Atomically increments (or creates) the daily counter for `userId`.
 * Uses INSERT OR REPLACE to handle the first message of the day.
 */
export function incrementDailyCount(userId: string, date: string): number {
	db.prepare(
		`
    INSERT INTO daily_message_counts (user_id, date, count)
    VALUES (?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
  `,
	).run(userId, date);

	const row = db
		.prepare(
			"SELECT count FROM daily_message_counts WHERE user_id = ? AND date = ?",
		)
		.get(userId, date) as { count: number };
	return row.count;
}

/**
 * Express middleware that enforces daily per-tier message caps.
 *
 * - Skipped when `config.disableRateLimits` is true (DISABLE_RATE_LIMITS=1).
 * - Skipped when the request body has `channel` other than `'web'`.
 * - Returns HTTP 429 with `{ error, limit, remaining, resetAt }` when exceeded.
 * - On success, increments the counter **before** passing through so the
 *   counter is always accurate even if the handler fails.
 */
export function dailyRateLimit(
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): void {
	// Kill-switch for testing / local dev
	if (config.disableRateLimits) {
		next();
		return;
	}

	// Only apply to web-channel requests
	const channel = req.body?.channel as string | undefined;
	if (channel && channel !== "web") {
		next();
		return;
	}

	const userId = req.userId;
	if (!userId) {
		// Unauthenticated — let auth middleware handle it
		next();
		return;
	}

	// Fetch user plan
	const sub = db
		.prepare("SELECT plan FROM subscriptions WHERE user_id = ?")
		.get(userId) as { plan: string } | undefined;
	const plan = sub?.plan ?? "free";
	const cap = DAILY_CAPS[plan] ?? DEFAULT_CAP;

	const today = getTodayUTC();
	const current = getDailyCount(userId, today);

	if (current >= cap) {
		const resetAt = `${today}T23:59:59Z`;
		logger.warn(
			{ userId, plan, count: current, cap, today },
			"daily_rate_limit: cap exceeded",
		);
		res.status(429).json({
			error: "daily_limit",
			limit: cap,
			remaining: 0,
			resetAt,
		});
		return;
	}

	// Increment before forwarding — ensures we count even if handler errors
	const newCount = incrementDailyCount(userId, today);
	logger.debug(
		{ userId, plan, count: newCount, cap, today },
		"daily_rate_limit: allowed",
	);

	next();
}
