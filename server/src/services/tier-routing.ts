/**
 * @module tier-routing
 *
 * Maps subscription plan tiers to preferred LLM providers.
 *
 * Free users always route to ollama (local, zero cost).
 * Paid users route to Groq (fast, free quota) or OpenRouter for complex tasks.
 * Premium users get the best available models.
 *
 * Used by {@link routeChat} to derive a provider when no explicit
 * `forceProvider` is given.
 */

import type { Provider } from "../modules/agent/services/llm.js";

export type PlanTier =
	| "free"
	| "pilot"
	| "intro"
	| "halfyear"
	| "yearly"
	| "pro"
	| "team"
	| "monthly"; // alias for pilot

export interface TierPreference {
	primary: Provider;
	fallbacks: Provider[];
	/** Better model selected when intent is 'complex' or 'coding' */
	complexPrimary?: Provider;
}

/**
 * Tier → provider preference map.
 *
 * | Tier      | Primary      | Complex primary | Fallbacks                      |
 * |-----------|--------------|-----------------|--------------------------------|
 * | free      | ollama       | —               | picoclaw, builtin              |
 * | pilot     | groq         | —               | ollama, picoclaw               |
 * | intro     | groq         | —               | ollama, picoclaw               |
 * | monthly   | groq         | —               | ollama, picoclaw               |
 * | halfyear  | groq         | openrouter      | openrouter-free, ollama        |
 * | yearly    | groq         | openrouter      | openrouter-free, ollama        |
 * | pro       | groq         | openrouter      | openrouter-free                |
 * | team      | groq         | openrouter      | openrouter-free, together      |
 */
export const TIER_PREFERENCES: Record<PlanTier, TierPreference> = {
	free: {
		primary: "ollama",
		fallbacks: ["picoclaw", "builtin"],
	},
	pilot: {
		primary: "groq",
		fallbacks: ["ollama", "picoclaw"],
	},
	monthly: {
		// alias for pilot
		primary: "groq",
		fallbacks: ["ollama", "picoclaw"],
	},
	intro: {
		primary: "groq",
		fallbacks: ["ollama", "picoclaw"],
	},
	halfyear: {
		primary: "groq",
		fallbacks: ["openrouter-free", "ollama"],
		complexPrimary: "openrouter",
	},
	yearly: {
		primary: "groq",
		fallbacks: ["openrouter-free", "ollama"],
		complexPrimary: "openrouter",
	},
	pro: {
		primary: "groq",
		fallbacks: ["openrouter-free"],
		complexPrimary: "openrouter",
	},
	team: {
		primary: "groq",
		fallbacks: ["openrouter-free", "together"],
		complexPrimary: "openrouter",
	},
};

/**
 * Selects the preferred LLM provider for a given subscription plan and
 * message intent.
 *
 * - `undefined` or unknown plan → free defaults (ollama)
 * - Paid plan + complex intent → `complexPrimary` if defined, otherwise `primary`
 * - Otherwise → `primary`
 *
 * @param plan   - User's subscription plan slug (e.g. "free", "pilot", "yearly").
 * @param intent - Whether the request is 'simple' or 'complex'.
 * @returns The preferred {@link Provider} for this tier/intent combination.
 *
 * @example
 * selectProviderForTier('free')              // 'ollama'
 * selectProviderForTier('pilot')             // 'groq'
 * selectProviderForTier('halfyear', 'complex') // 'openrouter'
 * selectProviderForTier(undefined)            // 'ollama'
 */
export function selectProviderForTier(
	plan: string | undefined,
	intent: "simple" | "complex" = "simple",
): Provider {
	const tier = (plan as PlanTier) ?? "free";
	const pref = TIER_PREFERENCES[tier] ?? TIER_PREFERENCES.free;
	if (intent === "complex" && pref.complexPrimary) return pref.complexPrimary;
	return pref.primary;
}

/**
 * Returns the full fallback chain for a tier, starting from the primary
 * provider. Used to construct the waterfall in routeChat.
 */
export function getFallbackChainForTier(plan: string | undefined): Provider[] {
	const tier = (plan as PlanTier) ?? "free";
	const pref = TIER_PREFERENCES[tier] ?? TIER_PREFERENCES.free;
	return [pref.primary, ...(pref.fallbacks ?? [])];
}

/**
 * Returns true when the plan is considered paid (non-free).
 */
export function isPaidTier(plan: string | undefined): boolean {
	if (!plan || plan === "free") return false;
	return plan in TIER_PREFERENCES && plan !== "free";
}
