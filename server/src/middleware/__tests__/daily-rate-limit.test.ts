/**
 * Tests for daily per-tier message rate limiting middleware.
 */

import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRequest } from "../auth.js";

// ── Mock dependencies before importing middleware ────────────────────────────

vi.mock("../../db/index.js", () => ({
	db: {
		prepare: vi.fn().mockReturnValue({
			get: vi.fn(),
			run: vi.fn(),
		}),
	},
}));

vi.mock("../../config.js", () => ({
	config: {
		disableRateLimits: false,
	},
}));

vi.mock("../../logger.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { config } from "../../config.js";
import { db } from "../../db/index.js";
import {
	DAILY_CAPS,
	dailyRateLimit,
	getDailyCount,
	getTodayUTC,
	incrementDailyCount,
} from "../daily-rate-limit.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(
	userId: string | undefined,
	plan: string,
	channel = "web",
): AuthRequest {
	return {
		userId,
		body: { channel },
	} as unknown as AuthRequest;
}

function makeRes(): Response {
	const res = {
		status: vi.fn().mockReturnThis(),
		json: vi.fn().mockReturnThis(),
	};
	return res as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DAILY_CAPS", () => {
	it("free plan cap = 20", () => {
		expect(DAILY_CAPS.free).toBe(20);
	});

	it("pilot plan cap = 200", () => {
		expect(DAILY_CAPS.pilot).toBe(200);
	});

	it("yearly plan cap = 1000", () => {
		expect(DAILY_CAPS.yearly).toBe(1000);
	});

	it("pro plan cap = 2000", () => {
		expect(DAILY_CAPS.pro).toBe(2000);
	});
});

describe("getTodayUTC", () => {
	it("returns a YYYY-MM-DD string", () => {
		const today = getTodayUTC();
		expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("dailyRateLimit middleware", () => {
	const mockNext = vi.fn() as unknown as NextFunction;
	const userId = "user-123";

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset disableRateLimits
		(config as Record<string, unknown>).disableRateLimits = false;
	});

	it("skips when DISABLE_RATE_LIMITS is true", () => {
		(config as Record<string, unknown>).disableRateLimits = true;
		const req = makeReq(userId, "free");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();
	});

	it("skips when channel is not web (e.g. telegram)", () => {
		const req = makeReq(userId, "free", "telegram");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();
	});

	it("skips when userId is undefined", () => {
		const req = makeReq(undefined, "free");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);
		expect(mockNext).toHaveBeenCalled();
	});

	it("allows request when under cap", () => {
		// Mock: plan=free, count=10 (under cap 20)
		const mockPrepare = vi.mocked(db.prepare);
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ plan: "free" }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ count: 10 }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		// 3: INSERT OR REPLACE
		mockPrepare.mockReturnValueOnce({
			get: vi.fn(),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		// 4: SELECT count after insert → 11
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ count: 11 }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);

		const req = makeReq(userId, "free");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();
	});

	it("returns 429 when at cap with correct body shape", () => {
		const mockPrepare = vi.mocked(db.prepare);
		// First call: get plan
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ plan: "free" }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		// Second call: get count (at cap)
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ count: 20 }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);

		const req = makeReq(userId, "free");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);

		expect(mockNext).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(429);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				error: "daily_limit",
				limit: 20,
				remaining: 0,
				resetAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T23:59:59Z$/),
			}),
		);
	});

	it("uses DEFAULT_CAP for unknown plan", () => {
		const mockPrepare = vi.mocked(db.prepare);
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ plan: "unknown-plan" }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ count: 25 }), // over free cap of 20
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);

		const req = makeReq(userId, "unknown-plan");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);

		expect(res.status).toHaveBeenCalledWith(429);
	});

	it("new day resets: count 0 on new date passes for free user", () => {
		const mockPrepare = vi.mocked(db.prepare);
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ plan: "free" }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		// No row for today → count 0
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue(undefined),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		// INSERT OR REPLACE
		mockPrepare.mockReturnValueOnce({
			get: vi.fn(),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);
		// SELECT count after insert
		mockPrepare.mockReturnValueOnce({
			get: vi.fn().mockReturnValue({ count: 1 }),
			run: vi.fn(),
		} as ReturnType<typeof db.prepare>);

		const req = makeReq(userId, "free");
		const res = makeRes();
		dailyRateLimit(req, res, mockNext);
		expect(mockNext).toHaveBeenCalled();
	});
});
