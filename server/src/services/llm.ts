// ============================================================
// GeekSpace LLM Router — Phase 76: AI Gateway + Smart Routing
//
// Routing Waterfall (Phase 76+, P3: dead providers removed):
//   1. Ollama local     — always try first (free, fast)
//   2. OpenRouter Free  — if Ollama fails
//   3. Edith/Moonshot   — PREMIUM ONLY, last resort
//   4. Builtin fallback — error message, no real AI
//
// Automation: picoclaw → ollama waterfall
// Edith: NEVER auto-selected for "complex" intent. Only when
//        user is premium AND all other providers have failed.
//
// Caching: L1 = in-memory (per-worker), L2 = Redis (shared)
// Deduplication: in-flight Map prevents duplicate API calls
// ============================================================

import { createHash } from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
import { getCurrentFreeModel, switchToNextFreeModel, getUserPreferredFreeModel } from './openrouter-models.js';
import { recordTokenUsage, shouldDegradeRouting, isOverDailyBudget } from './token-budget.js';
import { cacheGet, cacheSet } from './cache.js';

// ---- Types ----

export type Intent = 'simple' | 'planning' | 'coding' | 'automation' | 'complex';
// P3: Removed ollama-cloud and together — no API keys, dead providers
export type Provider = 'ollama' | 'openrouter' | 'openrouter-free' | 'edith' | 'picoclaw' | 'builtin';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  reply: string;
  provider: Provider;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costEstimate: number;
  creditCost: number;
  intent: Intent;
}

// ---- Routing Trace (for debugging/monitoring) ----

export interface RoutingTrace {
  timestamp: string;
  userId: string;
  routeDecision: Provider;
  reason:
    | 'ollama_healthy'
    | 'ollama_unreachable'
    | 'ollama_timeout'
    | 'openrouter_free_available'
    | 'openrouter_error'
    | 'budget_degradation'
    | 'daily_budget_exceeded'
    | 'manual_override'
    | 'fallback_chain';
  latencyMs: number;
  tokensEstimate: number;
  intent: Intent;
  ollamaAvailable: boolean;
  forcedProvider?: Provider;
  error?: string;
}

// In-memory routing traces (last 1000 for debugging)
const routingTraces: RoutingTrace[] = [];

export function getRoutingTraces(limit = 100): RoutingTrace[] {
  return routingTraces.slice(-limit);
}

export function clearRoutingTraces(): void {
  routingTraces.length = 0;
}

// ---- In-Memory LLM Response Cache (L1) ----
// Per-worker cache, fast, non-persistent. Max 100 entries, TTL 5 min.

const LLM_CACHE_TTL_MS = 5 * 60 * 1000;
const LLM_CACHE_TTL_SEC = 300;
const LLM_CACHE_MAX = 100;
const LLM_CACHE_KEY_PREFIX = 'llm:resp:';

interface LLMCacheEntry {
  reply: string;
  timestamp: number;
}

const llmCache = new Map<string, LLMCacheEntry>();

function makeCacheKey(messages: ChatMessage[], systemPrompt?: string): string {
  return createHash('md5')
    .update(JSON.stringify({ messages, systemPrompt: systemPrompt ?? '' }))
    .digest('hex');
}

function getMemCached(key: string): string | null {
  const entry = llmCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LLM_CACHE_TTL_MS) {
    llmCache.delete(key);
    return null;
  }
  return entry.reply;
}

function setMemCached(key: string, reply: string): void {
  if (!reply) return;
  if (llmCache.size >= LLM_CACHE_MAX) {
    const oldestKey = llmCache.keys().next().value;
    if (oldestKey) llmCache.delete(oldestKey);
  }
  llmCache.set(key, { reply, timestamp: Date.now() });
}

// ---- Redis Cache Layer (L2) ----
// Shared across PM2 workers. Survives worker restarts.

async function getRedisCached(key: string): Promise<string | null> {
  try {
    return await cacheGet(LLM_CACHE_KEY_PREFIX + key);
  } catch {
    return null;
  }
}

async function setRedisCached(key: string, reply: string): Promise<void> {
  try {
    await cacheSet(LLM_CACHE_KEY_PREFIX + key, reply, LLM_CACHE_TTL_SEC);
  } catch {
    // Redis failure is non-fatal
  }
}

export function getLLMCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: llmCache.size, maxSize: LLM_CACHE_MAX, ttlMs: LLM_CACHE_TTL_MS };
}

/** Clear the in-memory LLM cache. Exported for test isolation only. */
export function clearLLMCache(): void {
  llmCache.clear();
}

// ---- In-Flight Request Deduplication ----
// Prevents duplicate API calls for identical cacheable requests within the same worker.

const inFlightRequests = new Map<string, Promise<string>>();

// ---- Routing Trace Logger ----

function recordRoutingTrace(trace: RoutingTrace): void {
  routingTraces.push(trace);
  if (routingTraces.length > 1000) routingTraces.shift();
  logger.info({
    routing: {
      decision: trace.routeDecision,
      reason: trace.reason,
      intent: trace.intent,
      latency: trace.latencyMs,
      ollamaAvailable: trace.ollamaAvailable,
      forced: !!trace.forcedProvider,
    }
  }, 'LLM routing decision');
}

// ---- Intent Classifier ----

const COMPLEX_KEYWORDS = [
  'explain', 'analyze', 'compare', 'design', 'architect', 'strategy',
  'pros and cons', 'trade-off', 'deep dive', 'in detail', 'comprehensive',
];
const CODING_KEYWORDS = [
  'code', 'function', 'class', 'debug', 'error', 'bug', 'implement',
  'refactor', 'typescript', 'javascript', 'python', 'react', 'api',
  'sql', 'query', 'regex', 'algorithm', 'data structure',
];
const PLANNING_KEYWORDS = [
  'plan', 'schedule', 'roadmap', 'timeline', 'milestone', 'goal',
  'project', 'workflow', 'step by step', 'outline', 'organize',
];
const AUTOMATION_KEYWORDS = [
  'automate', 'automation', 'cron', 'trigger', 'webhook', 'workflow',
  'schedule task', 'batch', 'pipeline', 'n8n', 'zapier',
  'heartbeat', 'monitor', 'uptime', 'daily summary', 'notify', 'ping',
];

export function classifyIntent(message: string, userId?: string): Intent {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  if (wordCount > 80) {
    logger.info({ intent: 'complex', userId, messageLength: message.length, reason: 'word_count_exceeded' }, 'llm:intent_classified');
    return 'complex';
  }

  const matchCount = (keywords: string[]) =>
    keywords.filter((k) => lower.includes(k)).length;

  const codingScore = matchCount(CODING_KEYWORDS);
  const planningScore = matchCount(PLANNING_KEYWORDS);
  const automationScore = matchCount(AUTOMATION_KEYWORDS);
  const complexScore = matchCount(COMPLEX_KEYWORDS);

  let intent: Intent;
  if (codingScore >= 2) intent = 'coding';
  else if (automationScore >= 1) intent = 'automation';
  else if (planningScore >= 2) intent = 'planning';
  else if (complexScore >= 2 || wordCount > 40) intent = 'complex';
  else intent = 'simple';

  logger.info({ intent, userId, messageLength: message.length }, 'llm:intent_classified');
  return intent;
}

// ---- Provider Availability ----

let ollamaAvailable: boolean | null = null;
let ollamaCheckTime = 0;

/** Reset Ollama availability cache. Exported for test isolation only. */
export function clearOllamaCache(): void {
  ollamaAvailable = null;
  ollamaCheckTime = 0;
}

async function isOllamaAvailable(): Promise<boolean> {
  if (ollamaAvailable !== null && Date.now() - ollamaCheckTime < 30_000) {
    return ollamaAvailable;
  }
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timeout);
    ollamaAvailable = res.ok;
  } catch {
    ollamaAvailable = false;
  }
  ollamaCheckTime = Date.now();
  return ollamaAvailable;
}

function isOpenRouterAvailable(): boolean {
  return !!config.openrouterApiKey;
}

function isOpenRouterFreeAvailable(): boolean {
  return !!config.openrouterFreeApiKey && !!config.openrouterFreeModel;
}

function isEdithAvailable(): boolean {
  return !!config.openrouterApiKey && !!config.openrouterBaseUrl;
}

// Premium plans that can access Edith (Moonshot reasoning) as last resort
// FIX P1-1: Include 'monthly' and 'pilot' — paying subscribers deserve premium routing
function isPremiumPlan(plan?: string): boolean {
  return ['monthly', 'pilot', 'halfyear', 'yearly'].includes(plan || '');
}

// ---- Provider Callers ----

export async function streamOllama(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<{ tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages,
      stream: true,
      keep_alive: '5m',
      options: { temperature: 0.7, num_predict: config.ollamaMaxTokens },
    }),
    signal: AbortSignal.timeout(config.ollamaTimeout),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama stream returned ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let tokensIn = 0;
  let tokensOut = 0;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line) as {
          message?: { content: string };
          done?: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
        };
        if (data.message?.content) onChunk(data.message.content);
        if (data.done) {
          tokensIn = data.prompt_eval_count || 0;
          tokensOut = data.eval_count || 0;
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return { tokensIn, tokensOut };
}

async function callOllama(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const start = Date.now();
  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages,
      stream: false,
      keep_alive: '5m',
      options: {
        temperature: 0.7,
        num_predict: config.ollamaMaxTokens,
        top_p: 0.9,
        repeat_penalty: 1.1,
      },
    }),
    signal: AbortSignal.timeout(config.ollamaTimeout),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama returned ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    message?: { content: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };

  const content = data.message?.content || '';
  logger.debug({ provider: 'ollama', elapsed: Date.now() - start, model: config.ollamaModel }, 'Ollama response');

  return {
    content,
    tokensIn: data.prompt_eval_count || Math.ceil(messages.map(m => m.content).join('').length / 4),
    tokensOut: data.eval_count || Math.ceil(content.length / 4),
  };
}

// NOTE P3: callOllamaCloud and callTogether removed — no API keys configured, dead code

// ---- OpenRouter Calls (OpenAI-compatible) ----

async function callOpenRouterWithModel(
  messages: ChatMessage[],
  model: string,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'HTTP-Referer': config.publicUrl,
      'X-Title': 'GeekSpace AI OS',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: config.openrouterMaxTokens,
    }),
    signal: AbortSignal.timeout(config.openrouterTimeout),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenRouter returned ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content || '';
  return {
    content,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  };
}

async function callOpenRouter(messages: ChatMessage[]) {
  return callOpenRouterWithModel(messages, config.openrouterModel);
}

async function callOpenRouterFree(messages: ChatMessage[], userId?: string): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const baseUrl = config.openrouterFreeBaseUrl;
  const apiKey = config.openrouterFreeApiKey;
  const MAX_ATTEMPTS = 3;

  const preferredModel = userId ? getUserPreferredFreeModel(userId) : null;
  let lastError: Error = new Error('OpenRouter Free: no attempts made');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const model = (attempt === 0 && preferredModel) ? preferredModel : await getCurrentFreeModel();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'GeekSpace AI OS',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: config.openrouterMaxTokens,
      }),
      signal: AbortSignal.timeout(config.openrouterTimeout),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const isQuotaError =
        response.status === 429 ||
        response.status === 402 ||
        text.toLowerCase().includes('quota') ||
        text.toLowerCase().includes('rate_limit') ||
        text.toLowerCase().includes('insufficient');

      if (isQuotaError) {
        logger.warn({ model, status: response.status, attempt }, 'OpenRouter Free quota/rate error — switching model');
        await switchToNextFreeModel(model);
        lastError = new Error(`OpenRouter Free model ${model} quota exceeded (${response.status})`);
        continue;
      }

      throw new Error(`OpenRouter Free returned ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content || '';
    return {
      content,
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
    };
  }

  throw lastError;
}

// ---- Moonshot Reasoning Call (direct HTTP) ----

async function callMoonshotReasoning(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  if (!config.openrouterApiKey) {
    throw new Error('Moonshot API key not configured (OPENROUTER_API_KEY)');
  }

  const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterApiKey}`,
    },
    body: JSON.stringify({
      model: config.moonshotReasoningModel,
      messages,
      max_tokens: config.moonshotMaxTokens,
    }),
    signal: AbortSignal.timeout(config.moonshotTimeout),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Moonshot reasoning returned ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content || '';
  return {
    content,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  };
}


// ---- Waterfall Fallback Helper ----
// Tries each provider in order, skipping unavailable ones.
// Returns null if all fail (caller uses builtin fallback).

type CallResult = { content: string; tokensIn: number; tokensOut: number; provider: Provider };

async function tryFallbackChain(
  providers: Provider[],
  fullMessages: ChatMessage[],
  userId: string | undefined,
): Promise<CallResult | null> {
  for (const p of providers) {
    try {
      switch (p) {
        case 'ollama': {
          const ok = await isOllamaAvailable();
          if (!ok) continue;
          const r = await callOllama(fullMessages);
          return { ...r, provider: 'ollama' };
        }
        case 'openrouter-free': {
          if (!isOpenRouterFreeAvailable()) continue;
          const r = await callOpenRouterFree(fullMessages, userId);
          return { ...r, provider: 'openrouter-free' };
        }
        case 'edith': {
          if (!isEdithAvailable()) continue;
          const r = await callMoonshotReasoning(fullMessages);
          return { ...r, provider: 'edith' };
        }
        case 'openrouter': {
          if (!isOpenRouterAvailable()) continue;
          const r = await callOpenRouter(fullMessages);
          return { ...r, provider: 'openrouter' };
        }
      }
    } catch (e) {
      logger.warn({ provider: p, error: String(e) }, 'llm:fallback_chain_provider_failed');
    }
  }
  return null;
}

// ---- Credit Cost ----

import { db } from '../db/index.js';

const FLAT_CREDIT_COSTS: Partial<Record<Provider, number>> = {
  ollama:            1,
  'openrouter-free': 2,
  picoclaw:          1,
  builtin:           0,
};

const TOKEN_CREDIT_RATES: Partial<Record<Provider, number>> = {
  openrouter: 5,
  edith:      10,
};

const MIN_PREMIUM_CREDITS = 10;

export function computeCreditCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  const flat = FLAT_CREDIT_COSTS[provider];
  if (flat !== undefined) return flat;

  const rate = TOKEN_CREDIT_RATES[provider];
  if (rate) {
    const totalTokens = tokensIn + tokensOut;
    const cost = Math.ceil((totalTokens / 1000) * rate);
    return Math.max(cost, MIN_PREMIUM_CREDITS);
  }

  return 0;
}

export function deductSubscriptionCredits(userId: string, credits: number): void {
  if (credits <= 0) return;
  db.prepare(`
    UPDATE subscriptions
    SET credits_remaining = MAX(0, credits_remaining - ?),
        credits_used_this_cycle = credits_used_this_cycle + ?
    WHERE user_id = ?
  `).run(credits, credits, userId);
}

function estimateCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  switch (provider) {
    case 'ollama':          return 0;
    case 'openrouter-free': return 0;
    case 'openrouter':      return (tokensIn * 0.0000006) + (tokensOut * 0.000002);
    case 'edith':           return (tokensIn * 0.0000012) + (tokensOut * 0.000004);
    case 'picoclaw':        return 0;
    case 'builtin':         return 0;
    default:                return 0;
  }
}

// ---- Manual Override Helper (TEST_MODE only) ----

export function getManualOverride(): Provider | null {
  if (!config.isTestMode) return null;
  const envOverride = process.env.FORCE_LLM_PROVIDER as Provider;
  if (envOverride && ['ollama', 'openrouter', 'openrouter-free', 'edith', 'picoclaw', 'builtin'].includes(envOverride)) {
    return envOverride;
  }
  return null;
}

// ---- Main Router ----

export async function routeChat(
  messages: ChatMessage[],
  opts?: {
    forceProvider?: Provider;
    userCredits?: number;
    userPlan?: string;        // Used to gate Edith (premium-only last resort)
    systemPrompt?: string;
    agentName?: string;
    userId?: string;
    requestHeaders?: Record<string, string>;
  },
): Promise<LLMResponse> {
  const start = Date.now();
  const userMessage = messages[messages.length - 1]?.content || '';
  const intent = classifyIntent(userMessage, opts?.userId);
  const tokensEstimate = Math.ceil(userMessage.length / 4) + 100;

  const fullMessages: ChatMessage[] = [];
  if (opts?.systemPrompt) {
    fullMessages.push({ role: 'system', content: opts.systemPrompt });
  }
  fullMessages.push(...messages);

  // ---- Cache check (simple / single-turn queries only) ----
  const isCacheable =
    !opts?.forceProvider &&
    messages.length === 1 &&
    messages[0].role === 'user';

  const cacheKey = isCacheable ? makeCacheKey(messages, opts?.systemPrompt) : '';

  if (isCacheable && cacheKey) {
    // L1: in-memory cache (fastest)
    const memHit = getMemCached(cacheKey);
    if (memHit) {
      logger.debug({ cacheKey, intent, userId: opts?.userId, layer: 'memory' }, 'LLM cache hit');
      return { reply: memHit, provider: 'builtin', model: 'cache', tokensIn: 0, tokensOut: 0, latencyMs: 0, costEstimate: 0, creditCost: 0, intent };
    }

    // L2: Redis cache (shared across PM2 workers)
    const redisHit = await getRedisCached(cacheKey);
    if (redisHit) {
      logger.debug({ cacheKey, intent, userId: opts?.userId, layer: 'redis' }, 'LLM cache hit');
      setMemCached(cacheKey, redisHit); // warm L1
      return { reply: redisHit, provider: 'builtin', model: 'cache', tokensIn: 0, tokensOut: 0, latencyMs: 0, costEstimate: 0, creditCost: 0, intent };
    }

    // In-flight deduplication: if same request is in-flight, wait instead of double-calling
    const existing = inFlightRequests.get(cacheKey);
    if (existing) {
      logger.debug({ cacheKey, userId: opts?.userId }, 'LLM dedupe: waiting for in-flight request');
      try {
        const deduped = await existing;
        if (deduped) {
          return { reply: deduped, provider: 'builtin', model: 'cache', tokensIn: 0, tokensOut: 0, latencyMs: 0, costEstimate: 0, creditCost: 0, intent };
        }
      } catch {
        // In-flight failed — proceed with own request
      }
    }
  }

  // ---- Manual override (TEST_MODE only) ----
  let manualOverride: Provider | null = null;
  if (config.isTestMode) {
    const headerOverride = opts?.requestHeaders?.['x-model-route'] as Provider;
    if (headerOverride && ['ollama', 'openrouter', 'openrouter-free', 'edith', 'picoclaw', 'builtin'].includes(headerOverride)) {
      manualOverride = headerOverride;
    }
    if (!manualOverride) manualOverride = getManualOverride();
  }

  // ---- Provider Selection: Waterfall ----
  // Waterfall order: ollama → openrouter-free → edith (premium only)
  // Edith is NEVER auto-selected based on intent. It is only the last resort
  // for premium users when all other providers are unavailable or have failed.

  let provider: Provider = 'builtin';
  let routingReason: RoutingTrace['reason'] = 'ollama_unreachable';
  let ollamaOk = false;

  const overBudget = opts?.userId ? shouldDegradeRouting(opts.userId) : false;
  const overDailyBudget = opts?.userId ? isOverDailyBudget(opts.userId) : false;
  const isPremium = isPremiumPlan(opts?.userPlan);
  const hasCredits = opts?.userCredits === undefined || opts.userCredits > 0;

  // Daily budget exceeded: block edith + openrouter (paid), allow only free-tier providers
  if (overDailyBudget && opts?.userId) {
    logger.info({ userId: opts.userId }, 'Daily token budget exceeded — restricting to free-tier providers');
  }

  if (manualOverride || opts?.forceProvider) {
    provider = manualOverride || opts!.forceProvider!;
    routingReason = 'manual_override';
    ollamaOk = await isOllamaAvailable();

    // Budget degradation: downgrade premium forced calls when over monthly or daily budget
    if ((overBudget || overDailyBudget) && (provider === 'edith' || provider === 'openrouter')) {
      logger.info({ userId: opts?.userId, provider, overBudget, overDailyBudget }, 'Budget exceeded — degrading from premium provider');
      provider = 'openrouter-free';
      routingReason = overDailyBudget ? 'daily_budget_exceeded' : 'budget_degradation';
    }
  } else {
    ollamaOk = await isOllamaAvailable();
    const picoOk = await isPicoClawAvailable();

    // Automation intent → picoclaw first
    if (picoOk && intent === 'automation') {
      provider = 'picoclaw';
      routingReason = 'ollama_healthy';
    }
    // Waterfall: ollama → openrouter-free → edith (premium only) → builtin
    // FIX P1-7/P1-8: Removed Together AI and OllamaCloud dead branches (no API keys configured)
    else if (ollamaOk) {
      provider = 'ollama';
      routingReason = 'ollama_healthy';
    } else if (isOpenRouterFreeAvailable()) {
      provider = 'openrouter-free';
      routingReason = 'ollama_unreachable';
    } else if (isPremium && hasCredits && !overDailyBudget && isEdithAvailable()) {
      // Edith is last resort — premium users only when all free tiers unavailable AND daily budget not exceeded
      provider = 'edith';
      routingReason = 'fallback_chain';
    } else {
      provider = 'builtin';
      routingReason = overDailyBudget ? 'daily_budget_exceeded' : 'ollama_unreachable';
    }
  }

  logger.info({
    provider,
    model: provider === 'ollama' ? config.ollamaModel
      : provider === 'openrouter' ? config.openrouterModel
      : provider === 'edith' ? config.moonshotReasoningModel
      : provider,
    intent,
    userId: opts?.userId,
    credits: opts?.userCredits,
    isPremium,
    overBudget,
    routingReason,
    forced: !!(manualOverride || opts?.forceProvider),
  }, 'llm:provider_selected');

  recordRoutingTrace({
    timestamp: new Date().toISOString(),
    userId: opts?.userId || 'anonymous',
    routeDecision: provider,
    reason: routingReason,
    latencyMs: 0,
    tokensEstimate,
    intent,
    ollamaAvailable: ollamaOk,
    forcedProvider: manualOverride || opts?.forceProvider,
  });

  // ---- Execute with in-flight tracking ----
  let reply: string;
  let tokensIn = 0;
  let tokensOut = 0;
  let model = '';
  let finalProvider = provider;

  // Register in-flight entry for deduplication
  let resolveInFlight: ((reply: string) => void) | null = null;
  if (isCacheable && cacheKey) {
    const inFlightPromise = new Promise<string>((resolve) => { resolveInFlight = resolve; });
    inFlightRequests.set(cacheKey, inFlightPromise);
  }

  try {
    switch (provider) {
      case 'ollama': {
        const result = await callOllama(fullMessages);
        reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
        model = config.ollamaModel;
        break;
      }
      case 'openrouter': {
        const result = await callOpenRouter(fullMessages);
        reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
        model = config.openrouterModel;
        break;
      }
      case 'openrouter-free': {
        const result = await callOpenRouterFree(fullMessages, opts?.userId);
        reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
        model = await getCurrentFreeModel();
        break;
      }
      case 'edith': {
        const result = await callMoonshotReasoning(fullMessages);
        reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
        model = config.moonshotReasoningModel;
        break;
      }
      case 'picoclaw': {
        const userMsg = fullMessages[fullMessages.length - 1]?.content || '';
        const sysMsg = fullMessages.find(m => m.role === 'system')?.content;
        const result = await queryPicoClaw(userMsg, sysMsg);
        reply = result.text; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
        model = 'picoclaw-haiku';
        break;
      }
      default: {
        reply = `I'm currently running in offline mode — my AI backend isn't available right now. ` +
          `Please try again shortly, or use terminal commands like \`gs reminders list\` or \`gs credits\`.`;
        model = 'builtin-fallback';
        tokensIn = userMessage.length; tokensOut = reply.length;
        break;
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: errorMsg, provider, intent, userId: opts?.userId }, 'llm:provider_failed');

    // ---- Phase 76 Waterfall Fallback ----
    // Try remaining providers in waterfall order after the failed one.
    // Edith is included only for premium users with credits.
    const WATERFALL: Provider[] = ['ollama', 'openrouter-free', 'edith'];
    const failedIdx = WATERFALL.indexOf(provider);
    const remaining = WATERFALL.slice(failedIdx + 1).filter(p => {
      if (p === 'edith') return isPremium && hasCredits && !overDailyBudget;
      return true;
    });

    logger.info({ failedProvider: provider, chain: remaining, userId: opts?.userId }, 'llm:starting_fallback_chain');

    const fallback = await tryFallbackChain(remaining, fullMessages, opts?.userId);
    if (fallback) {
      reply = fallback.content;
      tokensIn = fallback.tokensIn;
      tokensOut = fallback.tokensOut;
      finalProvider = fallback.provider;
      model = finalProvider === 'ollama' ? config.ollamaModel
        : finalProvider === 'edith' ? config.moonshotReasoningModel
        : finalProvider;
      routingReason = 'fallback_chain';
    } else {
      reply = 'I had trouble connecting to my AI backends. Please try again shortly.';
      model = 'error-fallback';
      tokensIn = userMessage.length; tokensOut = reply.length;
      finalProvider = 'builtin';
      routingReason = 'ollama_unreachable';
    }
  } finally {
    if (isCacheable && cacheKey) inFlightRequests.delete(cacheKey);
  }

  // Resolve in-flight promise for deduplication waiters
  if (resolveInFlight && reply) (resolveInFlight as (r: string) => void)(reply);

  // Record token usage
  if (opts?.userId) recordTokenUsage(opts.userId, tokensIn + tokensOut);

  const latencyMs = Date.now() - start;
  const costEstimate = estimateCost(finalProvider, tokensIn, tokensOut);
  const creditCost = computeCreditCost(finalProvider, tokensIn, tokensOut);

  logger.info({ intent, provider: finalProvider, model, tokensIn, tokensOut, latencyMs, costEstimate, creditCost }, 'LLM response');

  // Write to L1 + L2 cache on success
  if (isCacheable && cacheKey && reply && model !== 'error-fallback' && finalProvider !== 'builtin') {
    setMemCached(cacheKey, reply);
    setRedisCached(cacheKey, reply).catch(() => {}); // non-blocking
  }

  return { reply, provider: finalProvider, model, tokensIn, tokensOut, latencyMs, costEstimate, creditCost, intent };
}

// ---- Ollama Keepalive ----

let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

async function pingOllama(): Promise<void> {
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.ollamaModel, prompt: 'ping', stream: false, options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) logger.debug({ model: config.ollamaModel }, 'Ollama keepalive ping OK');
  } catch {
    logger.debug('Ollama keepalive ping failed (non-fatal)');
  }
}

export function startOllamaKeepalive(): void {
  if (keepaliveInterval) return;
  pingOllama().catch(() => {});
  keepaliveInterval = setInterval(() => pingOllama().catch(() => {}), 3 * 60 * 1000);
  logger.info('Ollama keepalive started (every 3 minutes)');
}

// ---- Smart Provider Picker (used by chat routes for explicit plan-aware selection) ----

export type UserModelPreference = 'local' | 'cloud' | 'premium' | 'auto';

export async function pickProvider(
  userId: string,
  messageText: string,
  userPlan: string,
): Promise<Provider> {
  const agentConfig = db.prepare('SELECT model_preference FROM agent_configs WHERE user_id = ?')
    .get(userId) as { model_preference: string } | undefined;
  const preference = (agentConfig?.model_preference || 'auto') as UserModelPreference;

  const isPaidPlan = ['pilot', 'intro', 'halfyear', 'yearly', 'monthly'].includes(userPlan);

  if (preference === 'local') return 'ollama';
  if (preference === 'cloud') return isPaidPlan ? 'openrouter-free' : 'ollama';
  // 'premium' preference: still use openrouter-free; edith only via waterfall last-resort
  if (preference === 'premium') return isPaidPlan ? 'openrouter-free' : 'ollama';

  // Auto: prefer local. Edith is NEVER auto-selected by intent.
  // It is only a last resort in routeChat's waterfall when all
  // other providers have failed AND the user is premium.
  const intent = classifyIntent(messageText, userId);
  if (['planning', 'complex', 'coding'].includes(intent) && isPaidPlan) {
    return 'openrouter-free';
  }
  return 'ollama';
}
