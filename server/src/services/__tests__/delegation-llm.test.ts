/**
 * Tests for the LLM-based delegation fallback classifier (GS-013).
 *
 * All LLM calls are mocked — no real API calls are made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the LLM router BEFORE importing the module under test ──────────────

vi.mock("../../modules/agent/services/llm.js", () => ({
	routeChat: vi.fn(),
}));

import { routeChat } from "../../modules/agent/services/llm.js";
import { detectDelegationTarget, routeDelegationAsync } from "../delegation.js";
import {
	__resetDelegationLLMCache,
	classifyDelegationLLM,
} from "../delegation-llm.js";

// ── Mock the DB layer used by routeDelegationAsync ──────────────────────────

vi.mock("../../db/index.js", () => ({
	db: {
		prepare: vi.fn(() => ({
			run: vi.fn(() => ({ changes: 1 })),
			get: vi.fn(() => ({ count: 1 })),
		})),
	},
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockRouteChat = routeChat as ReturnType<typeof vi.fn>;

function makeLLMReply(
	agent: string | null,
	reason: string,
	confidence: number,
) {
	return {
		reply: JSON.stringify({ agent, reason, confidence }),
		provider: "groq",
		model: "llama-3.3-70b",
		tokensIn: 50,
		tokensOut: 20,
		latencyMs: 150,
		costEstimate: 0,
		creditCost: 0,
		intent: "simple",
	};
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	__resetDelegationLLMCache();
	mockRouteChat.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("detectDelegationTarget (regex — fast path)", () => {
	it('matches "schedule a meeting" → cal', () => {
		const result = detectDelegationTarget("schedule a meeting with the team");
		expect(result).not.toBeNull();
		expect(result?.agent).toBe("cal");
	});

	it('matches "write a python script" → forge', () => {
		const result = detectDelegationTarget(
			"write a python script that parses JSON",
		);
		expect(result).not.toBeNull();
		expect(result?.agent).toBe("forge");
	});

	it("returns null for single-word message", () => {
		const result = detectDelegationTarget("hello");
		expect(result).toBeNull();
	});

	it("returns null for a plain topic with no action words", () => {
		// "eucalyptus trees" has no regex trigger — should fall through to LLM fallback
		const result = detectDelegationTarget("eucalyptus trees");
		expect(result).toBeNull();
	});
});

describe("classifyDelegationLLM", () => {
	it("classifies a substantive topic and routes to nova via LLM", async () => {
		mockRouteChat.mockResolvedValue(
			makeLLMReply("nova", "general knowledge", 0.9),
		);
		const result = await classifyDelegationLLM("eucalyptus");
		expect(mockRouteChat).toHaveBeenCalledTimes(1);
		expect(result.agent).toBe("nova");
	});

	it('routes "I wanna learn about eucalyptus" to nova via LLM', async () => {
		mockRouteChat.mockResolvedValue(
			makeLLMReply("nova", "general knowledge — plants", 0.92),
		);
		const result = await classifyDelegationLLM(
			"I wanna learn about eucalyptus",
		);
		expect(result.agent).toBe("nova");
		expect(result.confidence).toBeGreaterThanOrEqual(0.9);
		expect(mockRouteChat).toHaveBeenCalledTimes(1);
	});

	it("LLM parse failure → returns null agent without crashing", async () => {
		mockRouteChat.mockResolvedValue({
			...makeLLMReply(null, "", 0),
			reply: "This is not valid JSON at all!!!",
		});

		const result = await classifyDelegationLLM(
			"tell me something completely random please",
		);
		expect(result.agent).toBeNull();
		expect(result.reason).toBe("fallback");
		expect(result.confidence).toBe(0);
	});

	it("LLM timeout (AbortError) → returns null agent without crashing", async () => {
		const abortErr = new DOMException(
			"The operation was aborted",
			"AbortError",
		);
		mockRouteChat.mockRejectedValue(abortErr);

		const result = await classifyDelegationLLM(
			"what is the capital of france honestly speaking",
		);
		expect(result.agent).toBeNull();
		expect(result.confidence).toBe(0);
	});

	it("cache hit on second identical message — LLM called only once", async () => {
		mockRouteChat.mockResolvedValue(
			makeLLMReply("nova", "general knowledge", 0.88),
		);

		const msg = "tell me about quantum computing and its applications";
		const first = await classifyDelegationLLM(msg);
		const second = await classifyDelegationLLM(msg);

		expect(mockRouteChat).toHaveBeenCalledTimes(1);
		expect(second.agent).toBe(first.agent);
		expect(second.confidence).toBe(first.confidence);
	});

	it("rejects unknown agent names returned by LLM — coerced to null", async () => {
		mockRouteChat.mockResolvedValue({
			...makeLLMReply(null, "", 0),
			reply: JSON.stringify({
				agent: "unknown_agent_xyz",
				reason: "test",
				confidence: 0.9,
			}),
		});

		const result = await classifyDelegationLLM(
			"something about an unknown agent",
		);
		expect(result.agent).toBeNull();
	});

	it("strips markdown code fences from LLM response", async () => {
		mockRouteChat.mockResolvedValue({
			...makeLLMReply(null, "", 0),
			reply:
				'```json\n{"agent":"nova","reason":"research","confidence":0.85}\n```',
		});

		const result = await classifyDelegationLLM(
			"explain how black holes form in detail",
		);
		expect(result.agent).toBe("nova");
		expect(result.confidence).toBe(0.85);
	});
});

describe("routeDelegationAsync — integration with LLM fallback", () => {
	it("regex hit → short-circuits, no LLM call", async () => {
		const result = await routeDelegationAsync(
			"test-user",
			"free",
			"schedule a meeting for tomorrow afternoon",
		);
		expect(mockRouteChat).not.toHaveBeenCalled();
		expect(result?.agent).toBe("cal");
		expect(result?.source).toBe("regex");
	});

	it("regex miss + short message (≤ 5 words) → no LLM call, returns null", async () => {
		// 2 words — below the 5-word guard
		const result = await routeDelegationAsync(
			"test-user",
			"free",
			"eucalyptus plant",
		);
		expect(mockRouteChat).not.toHaveBeenCalled();
		expect(result).toBeNull();
	});

	it("regex miss + long message → LLM called, high confidence routes to nova", async () => {
		mockRouteChat.mockResolvedValue(
			makeLLMReply("nova", "general knowledge — plants", 0.92),
		);

		// "eucalyptus trees are fascinating organisms found in australia" — no regex trigger, 8 words
		const result = await routeDelegationAsync(
			"test-user",
			"free",
			"eucalyptus trees are fascinating organisms found in australia",
		);
		expect(mockRouteChat).toHaveBeenCalledTimes(1);
		expect(result).not.toBeNull();
		expect(result?.agent).toBe("nova");
		expect(result?.source).toBe("llm");
	});

	it("regex miss + long message + LLM low confidence → returns null (weebo handles)", async () => {
		mockRouteChat.mockResolvedValue(
			makeLLMReply("nova", "general knowledge", 0.3), // below 0.5 threshold
		);

		const result = await routeDelegationAsync(
			"test-user",
			"free",
			"hey there how is it going today",
		);
		expect(result).toBeNull();
	});

	it("LLM parse failure in routeDelegationAsync → returns null gracefully", async () => {
		mockRouteChat.mockResolvedValue({
			...makeLLMReply(null, "", 0),
			reply: "¡MALFORMED JSON!",
		});

		const result = await routeDelegationAsync(
			"test-user",
			"free",
			"tell me something very interesting about space and galaxies",
		);
		expect(result).toBeNull();
	});
});
