/**
 * Tests for tier-based LLM routing — selectProviderForTier, isPaidTier,
 * TIER_PREFERENCES completeness.
 */

import { describe, expect, it } from "vitest";
import {
	getFallbackChainForTier,
	isPaidTier,
	type PlanTier,
	selectProviderForTier,
	TIER_PREFERENCES,
} from "../../../../services/tier-routing.js";

describe("selectProviderForTier", () => {
	it("free plan → ollama", () => {
		expect(selectProviderForTier("free")).toBe("ollama");
		expect(selectProviderForTier("free", "simple")).toBe("ollama");
		expect(selectProviderForTier("free", "complex")).toBe("ollama");
	});

	it("undefined plan → free defaults (ollama)", () => {
		expect(selectProviderForTier(undefined)).toBe("ollama");
		expect(selectProviderForTier(undefined, "complex")).toBe("ollama");
	});

	it("unknown plan → free defaults (ollama)", () => {
		expect(selectProviderForTier("unknown-future-plan")).toBe("ollama");
		expect(selectProviderForTier("enterprise")).toBe("ollama");
	});

	it("pilot plan → groq", () => {
		expect(selectProviderForTier("pilot")).toBe("groq");
		expect(selectProviderForTier("pilot", "simple")).toBe("groq");
		expect(selectProviderForTier("pilot", "complex")).toBe("groq"); // no complexPrimary
	});

	it("intro plan → groq", () => {
		expect(selectProviderForTier("intro")).toBe("groq");
	});

	it("monthly plan → groq (pilot alias)", () => {
		expect(selectProviderForTier("monthly")).toBe("groq");
	});

	it("halfyear plan + simple intent → groq", () => {
		expect(selectProviderForTier("halfyear", "simple")).toBe("groq");
	});

	it("halfyear plan + complex intent → openrouter", () => {
		expect(selectProviderForTier("halfyear", "complex")).toBe("openrouter");
	});

	it("yearly plan + complex intent → openrouter", () => {
		expect(selectProviderForTier("yearly", "complex")).toBe("openrouter");
	});

	it("yearly plan + simple intent → groq", () => {
		expect(selectProviderForTier("yearly", "simple")).toBe("groq");
	});

	it("pro plan + complex intent → openrouter", () => {
		expect(selectProviderForTier("pro", "complex")).toBe("openrouter");
	});

	it("team plan + complex intent → openrouter", () => {
		expect(selectProviderForTier("team", "complex")).toBe("openrouter");
	});
});

describe("isPaidTier", () => {
	it("free → false", () => {
		expect(isPaidTier("free")).toBe(false);
		expect(isPaidTier(undefined)).toBe(false);
		expect(isPaidTier("")).toBe(false);
	});

	it("pilot, intro, halfyear, yearly, pro, team → true", () => {
		for (const plan of [
			"pilot",
			"monthly",
			"intro",
			"halfyear",
			"yearly",
			"pro",
			"team",
		]) {
			expect(isPaidTier(plan)).toBe(true);
		}
	});
});

describe("TIER_PREFERENCES completeness", () => {
	const expectedTiers: PlanTier[] = [
		"free",
		"pilot",
		"monthly",
		"intro",
		"halfyear",
		"yearly",
		"pro",
		"team",
	];

	it("all expected tiers have a primary provider", () => {
		for (const tier of expectedTiers) {
			expect(TIER_PREFERENCES[tier]).toBeDefined();
			expect(TIER_PREFERENCES[tier].primary).toBeTruthy();
		}
	});

	it("all tiers have a non-empty fallbacks array", () => {
		for (const tier of expectedTiers) {
			expect(Array.isArray(TIER_PREFERENCES[tier].fallbacks)).toBe(true);
			expect(TIER_PREFERENCES[tier].fallbacks.length).toBeGreaterThan(0);
		}
	});
});

describe("getFallbackChainForTier", () => {
	it("free plan → [ollama, picoclaw, builtin]", () => {
		const chain = getFallbackChainForTier("free");
		expect(chain[0]).toBe("ollama");
		expect(chain).toContain("picoclaw");
	});

	it("pilot plan starts with groq", () => {
		const chain = getFallbackChainForTier("pilot");
		expect(chain[0]).toBe("groq");
		expect(chain).toContain("ollama");
	});

	it("undefined → free chain", () => {
		const chain = getFallbackChainForTier(undefined);
		expect(chain[0]).toBe("ollama");
	});
});
