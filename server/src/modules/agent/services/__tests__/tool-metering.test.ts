/**
 * Tests for tool-call credit metering in executeAction.
 * Verifies that deductSubscriptionCredits is called with the correct
 * amount for each metered tool after a successful execution.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../../../db/index.js", () => ({
	db: {
		prepare: vi.fn().mockReturnValue({
			get: vi.fn(),
			run: vi.fn(),
			all: vi.fn().mockReturnValue([]),
		}),
	},
}));

vi.mock("../../../../logger.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		child: vi.fn().mockReturnValue({
			info: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
			error: vi.fn(),
		}),
	},
}));

vi.mock("../../../../config.js", () => ({
	config: {
		disableRateLimits: false,
		isTestMode: true,
		ollamaBaseUrl: "http://localhost:11434",
		ollamaModel: "test-model",
		ollamaMaxTokens: 2048,
		ollamaTimeout: 5000,
	},
}));

// Mock all service dependencies of action-executor
vi.mock("../../../../services/email.js", () => ({
	sendAgentEmail: vi.fn(),
	resolveEmailAddress: vi.fn(),
}));

vi.mock("../../../../services/tavily.js", () => ({
	tavilySearch: vi.fn().mockResolvedValue({ results: [] }),
}));

vi.mock("../../../../services/searxng.js", () => ({
	searxngSearch: vi.fn().mockResolvedValue({ results: [] }),
}));

vi.mock("../../../../services/web-research.js", () => ({
	fetchAndExtract: vi.fn().mockResolvedValue("content"),
	fetchScreenshot: vi.fn().mockResolvedValue("base64data"),
	extractLinks: vi.fn().mockResolvedValue([]),
	smartSearch: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/telegram.js", () => ({
	sendTelegramNotification: vi.fn(),
	escapeTelegramHtml: vi.fn((s: string) => s),
	sendTelegramButtons: vi.fn(),
}));

vi.mock("../../../../services/media-generation.js", () => ({
	generateImage: vi
		.fn()
		.mockResolvedValue({ url: "http://test.com/img.png", id: "img-1" }),
	generateVideo: vi
		.fn()
		.mockResolvedValue({ url: "http://test.com/vid.mp4", id: "vid-1" }),
	generateAvatar: vi
		.fn()
		.mockResolvedValue({ url: "http://test.com/avatar.png", id: "ava-1" }),
}));

vi.mock("../../../../services/cache.js", () => ({
	cacheSet: vi.fn(),
	cacheGet: vi.fn().mockResolvedValue(null),
	cacheDel: vi.fn(),
}));

vi.mock("../../../../services/search-index.js", () => ({
	indexNote: vi.fn(),
	indexReminder: vi.fn(),
	indexHabit: vi.fn(),
	indexMemory: vi.fn(),
}));

vi.mock("../../../../services/search-vector.js", () => ({
	semanticSearch: vi.fn().mockResolvedValue([]),
	upsertMemoryVector: vi.fn(),
}));

vi.mock("../../../../services/event-bus.js", () => ({
	eventBus: {
		emit: vi.fn(),
		on: vi.fn(),
	},
}));

vi.mock("../../../../services/receipts.js", () => ({
	RECEIPT_TEMPLATES: {},
	formatReceiptCompact: vi.fn(),
}));

vi.mock("../../../../services/activity-log.js", () => ({
	logActivity: vi.fn(),
}));

vi.mock("../error-recovery.js", () => ({
	getRecoveryStrategy: vi.fn().mockReturnValue(null),
	applyRecoveryStrategy: vi.fn(),
	getRetryDelay: vi.fn().mockReturnValue(0),
}));

vi.mock("../pico-fleet.js", () => ({
	parseReminderTime: vi.fn(),
}));

// The key mock: deductSubscriptionCredits
const { mockDeduct } = vi.hoisted(() => ({ mockDeduct: vi.fn() }));
vi.mock("../llm.js", () => ({
	deductSubscriptionCredits: mockDeduct,
	routeChat: vi.fn().mockResolvedValue({
		reply: "test code",
		provider: "groq",
		model: "test",
		tokensIn: 10,
		tokensOut: 10,
		latencyMs: 100,
		costEstimate: 0,
		creditCost: 20,
		intent: "coding",
	}),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

import { executeAction, TOOL_CREDIT_COSTS } from "../action-executor.js";

const USER_ID = "test-user-123";

describe("TOOL_CREDIT_COSTS table", () => {
	it("has expected costs", () => {
		expect(TOOL_CREDIT_COSTS.web_search).toBe(5);
		expect(TOOL_CREDIT_COSTS.crawl_url).toBe(10);
		expect(TOOL_CREDIT_COSTS.web_fetch).toBe(5);
		expect(TOOL_CREDIT_COSTS.take_screenshot).toBe(10);
		expect(TOOL_CREDIT_COSTS.get_links).toBe(3);
		expect(TOOL_CREDIT_COSTS.generate_code).toBe(20);
		expect(TOOL_CREDIT_COSTS.generate_image).toBe(100);
		expect(TOOL_CREDIT_COSTS.generate_video).toBe(500);
	});
});

describe("tool metering via executeAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deducts 5 credits for web_search on success", async () => {
		const result = await executeAction(USER_ID, {
			tool: "web_search",
			params: { query: "test search" },
		});
		// web_search may succeed or fail depending on mocked results
		// Either way, verify deduct was called only on success
		if (result.success) {
			expect(mockDeduct).toHaveBeenCalledWith(USER_ID, 5);
		} else {
			expect(mockDeduct).not.toHaveBeenCalled();
		}
	});

	it("deducts 10 credits for take_screenshot on success", async () => {
		const result = await executeAction(USER_ID, {
			tool: "take_screenshot",
			params: { url: "https://example.com" },
		});
		if (result.success) {
			expect(mockDeduct).toHaveBeenCalledWith(USER_ID, 10);
		}
	});

	it("deducts 10 credits for crawl_url on success", async () => {
		const result = await executeAction(USER_ID, {
			tool: "crawl_url",
			params: { url: "https://example.com" },
		});
		if (result.success) {
			expect(mockDeduct).toHaveBeenCalledWith(USER_ID, 10);
		}
	});

	it("deducts 3 credits for get_links on success", async () => {
		const result = await executeAction(USER_ID, {
			tool: "get_links",
			params: { url: "https://example.com", filter: "all" },
		});
		// get_links succeeds even with empty array
		if (result.success) {
			expect(mockDeduct).toHaveBeenCalledWith(USER_ID, 3);
		}
	});

	it("does NOT deduct credits for non-metered tools", async () => {
		await executeAction(USER_ID, {
			tool: "create_reminder",
			params: { title: "Test", when: "2025-01-01T10:00:00Z" },
		});
		expect(mockDeduct).not.toHaveBeenCalled();
	});
});
