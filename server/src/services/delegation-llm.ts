// ============================================================
// Delegation LLM Fallback Classifier
//
// Called ONLY when the regex-based router returns null AND the
// message is more than 5 words. Uses the cheapest/fastest LLM
// tier (Groq Llama 70B, free) to pick the best specialist.
//
// Features:
//   - LRU in-memory cache (max 500 entries) — repeat messages
//     don't re-query the LLM.
//   - 2 000 ms hard timeout — falls through to null on timeout.
//   - Parse-safe — malformed LLM responses return null agent.
//   - Logs every classification with latency for observability.
//
// Fix: "eucalyptus" or any substantive topic now routes to nova
// instead of silently falling through to Weebo.
// ============================================================

import { createHash } from "crypto";
import { logger } from "../logger.js";
import type { ChatMessage } from "../modules/agent/services/llm.js";
import { routeChat } from "../modules/agent/services/llm.js";

// ── Types ─────────────────────────────────────────────────────

export type DelegationAgent =
	| "weebo"
	| "edith"
	| "jarvis"
	| "aria"
	| "forge"
	| "pulse"
	| "echo"
	| "cal"
	| "nova"
	| null;

export interface LLMDelegationResult {
	agent: DelegationAgent;
	reason: string;
	confidence: number; // 0-1
}

// ── Specialist descriptions (used in the prompt) ──────────────

const SPECIALIST_LIST = [
	"- cal: calendar, scheduling, reminders, travel planning, time management",
	"- echo: memory recall, note-taking, conversation history",
	"- forge: code, technical, programming, APIs, devops, video editing",
	"- aria: creative writing, design, aesthetics, music, image generation",
	"- pulse: analytics, data, metrics, health/wellness, finance, charts",
	"- nova: research, learning, news, movies, food, shopping, gaming, plants, pets, general knowledge",
	"- jarvis: productivity, planning, task management, workflows",
	"- edith: strategy, long-term thinking, cross-domain decisions",
	"- weebo: default/greeting/casual chat (no specialist needed)",
].join("\n");

// ── LRU Cache ─────────────────────────────────────────────────

const LRU_MAX = 500;

/** Insertion-ordered Map used as a simple LRU. */
const lruCache = new Map<string, LLMDelegationResult>();

function lruGet(key: string): LLMDelegationResult | undefined {
	if (!lruCache.has(key)) return undefined;
	// Move to end (most-recently-used position)
	const value = lruCache.get(key)!;
	lruCache.delete(key);
	lruCache.set(key, value);
	return value;
}

function lruSet(key: string, value: LLMDelegationResult): void {
	if (lruCache.has(key)) lruCache.delete(key);
	lruCache.set(key, value);
	// Evict LRU entry if over capacity
	if (lruCache.size > LRU_MAX) {
		const oldest = lruCache.keys().next().value;
		if (oldest !== undefined) lruCache.delete(oldest);
	}
}

/** Exposed for testing only — clears the LRU cache. */
export function __resetDelegationLLMCache(): void {
	lruCache.clear();
}

function cacheKey(message: string): string {
	return createHash("sha256").update(message).digest("hex").slice(0, 16);
}

// ── Prompt builder ────────────────────────────────────────────

function buildPrompt(message: string): string {
	return (
		`You are a delegation classifier. Given a user message, pick ONE specialist from the list below who is most relevant. Reply with a JSON object only: {"agent": "<id>", "reason": "<short>", "confidence": <0-1>}.\n\n` +
		`If no specialist fits well (e.g. greeting, casual chat), reply {"agent": null, "reason": "default chat", "confidence": 0}.\n\n` +
		`Specialists:\n${SPECIALIST_LIST}\n\n` +
		`User message: ${message}\n\n` +
		`JSON:`
	);
}

// ── Validation ────────────────────────────────────────────────

const VALID_AGENTS = new Set<string>([
	"weebo",
	"edith",
	"jarvis",
	"aria",
	"forge",
	"pulse",
	"echo",
	"cal",
	"nova",
]);

function parseResult(raw: string): LLMDelegationResult {
	// Strip markdown code fences if present
	const stripped = raw
		.replace(/```(?:json)?/gi, "")
		.replace(/```/g, "")
		.trim();
	// Extract first JSON object
	const match = stripped.match(/\{[\s\S]*?\}/);
	if (!match) throw new Error("No JSON object found in LLM response");

	const parsed = JSON.parse(match[0]) as Record<string, unknown>;

	const agentRaw =
		parsed.agent === null || parsed.agent === undefined
			? null
			: String(parsed.agent);
	const agent: DelegationAgent =
		agentRaw && VALID_AGENTS.has(agentRaw)
			? (agentRaw as DelegationAgent)
			: null;

	const reason =
		typeof parsed.reason === "string" ? parsed.reason : "llm classification";
	const confidence =
		typeof parsed.confidence === "number"
			? Math.max(0, Math.min(1, parsed.confidence))
			: 0;

	return { agent, reason, confidence };
}

// ── Main export ───────────────────────────────────────────────

/**
 * LLM-based fallback delegation classifier.
 * Called only when the regex router returns null.
 * Uses the cheapest/fastest available model for sub-300ms latency.
 * Returns null agent if no good fit (weebo handles directly).
 *
 * @param message - The raw user message to classify.
 */
export async function classifyDelegationLLM(
	message: string,
): Promise<LLMDelegationResult> {
	const FALLBACK: LLMDelegationResult = {
		agent: null,
		reason: "fallback",
		confidence: 0,
	};
	const start = Date.now();

	// Cache hit
	const key = cacheKey(message);
	const cached = lruGet(key);
	if (cached) {
		logger.debug(
			{ cacheHit: true, agent: cached.agent, message: message.slice(0, 100) },
			"delegation-llm: cache hit",
		);
		return cached;
	}

	const prompt = buildPrompt(message);
	const messages: ChatMessage[] = [{ role: "user", content: prompt }];

	try {
		const result = await routeChat(messages, {
			// Force Groq (cheapest, ~200ms, free) — simple intent → Tier 1a
			forceProvider: "groq",
			// Keep output tiny — we only need a small JSON blob
			systemPrompt:
				"Reply with a valid JSON object only. No markdown. No explanation.",
		});

		const raw = result.reply;
		const classification = parseResult(raw);
		const latencyMs = Date.now() - start;

		logger.info(
			{
				message: message.slice(0, 100),
				regexResult: null,
				llmAgent: classification.agent,
				llmConfidence: classification.confidence,
				llmReason: classification.reason,
				latencyMs,
			},
			"delegation-llm: classified",
		);

		// Cache the result
		lruSet(key, classification);
		return classification;
	} catch (err: unknown) {
		const latencyMs = Date.now() - start;
		const isTimeout =
			(err instanceof Error && err.name === "AbortError") ||
			(err instanceof DOMException && err.name === "AbortError");

		logger.warn(
			{
				message: message.slice(0, 100),
				latencyMs,
				timeout: isTimeout,
				error: err instanceof Error ? err.message : String(err),
			},
			isTimeout
				? "delegation-llm: timeout — falling through to weebo"
				: "delegation-llm: parse/call failure — falling through to weebo",
		);

		return FALLBACK;
	}
}
