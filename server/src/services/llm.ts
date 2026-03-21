// ============================================================
// GeekSpace LLM Router — Phase 110: Multi-Provider Waterfall
//
// FREE users:
//   Tier 1+6: Race(OpenRouter-free, Ollama qwen3:8b) → first wins
//   Tier 2:   Groq Llama 3.3 70B (free quota)
//   Tier 3:   Groq Kimi K2 (paid, system $5/mo budget)
//   Tier 0:   Builtin error
//
// PAID users:
//   Tier 1: OpenRouter-free (user's chosen model)
//   Tier 2: Groq Llama 3.3 70B (free)
//   Tier 3: Groq Kimi K2 (paid, system budget)
//   Tier 4: Together AI Maverick (paid)
//   Tier 5: Edith/Kimi K2.5 (paid, true last resort)
//   Tier 0: Builtin error
//
// Budget exceeded (overBudget / overDailyBudget):
//   → degrade to free providers only (T1+T6 race or T2 Groq)
//
// Special: automation intent → PicoClaw sidecar (all users)
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
export type Provider = 'ollama' | 'openrouter' | 'openrouter-free' | 'groq' | 'kimi' | 'gemini' | 'together' | 'edith' | 'picoclaw' | 'builtin';

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
    | 'fallback_chain'
    | 'race_free_tier';
  latencyMs: number;
  tokensEstimate: number;
  intent: Intent;
  ollamaAvailable: boolean;
  forcedProvider?: Provider;
  error?: string;
}

const routingTraces: RoutingTrace[] = [];

export function getRoutingTraces(limit = 100): RoutingTrace[] {
  return routingTraces.slice(-limit);
}

export function clearRoutingTraces(): void {
  routingTraces.length = 0;
}

// ---- In-Memory LLM Response Cache (L1) ----

const LLM_CACHE_TTL_MS = 5 * 60 * 1000;
const LLM_CACHE_TTL_SEC = 300;
const LLM_CACHE_MAX = 100;
const LLM_CACHE_KEY_PREFIX = 'llm:resp:';

interface LLMCacheEntry {
  reply: string;
  timestamp: number;
}

const llmCache = new Map<string, LLMCacheEntry>();

function makeCacheKey(messages: ChatMessage[], systemPrompt?: string, userId?: string): string {
  return createHash('md5')
    .update(JSON.stringify({ messages, systemPrompt: systemPrompt ?? '', userId: userId ?? '' }))
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

export function clearLLMCache(): void {
  llmCache.clear();
}

// ---- In-Flight Request Deduplication ----

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

  // URL detection: treat messages with a URL as automation so tool-use path fires
  if (/https?:\/\/\S+/.test(message)) {
    logger.info({ intent: 'automation', userId, messageLength: message.length, reason: 'url_detected' }, 'llm:intent_classified');
    return 'automation';
  }

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

function isGroqAvailable(): boolean {
  return !!(config.groqApiKey || config.groqApiKey2 || config.groqApiKey3);
}

function isTogetherAvailable(): boolean {
  return !!config.togetherApiKey;
}

function isPremiumPlan(plan?: string): boolean {
  return ['monthly', 'pilot', 'halfyear', 'yearly', 'pro'].includes(plan || '');
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

// ---- Groq (T2: Llama 3.3 70B free) — 3-key round-robin pool ----
// 3 accounts × 14,400 req/day free = ~43,200 req/day total

let groqKeyIndex = 0;

function getGroqKeys(): string[] {
  return [config.groqApiKey, config.groqApiKey2, config.groqApiKey3].filter(Boolean);
}


function nextGroqKey(): string {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error('No Groq API keys configured');
  const key = keys[groqKeyIndex % keys.length];
  groqKeyIndex = (groqKeyIndex + 1) % keys.length;
  return key;
}

async function callGroq(
  messages: ChatMessage[],
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error('No Groq API keys configured');

  // Try keys in round-robin order; on 429 rotate to next key
  let lastError: Error = new Error('Groq: no attempts made');
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = nextGroqKey();
    const response = await fetch(`${config.groqBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.groqModel,
        messages,
        max_tokens: config.groqMaxTokens,
      }),
      signal: AbortSignal.timeout(config.groqTimeoutMs),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) {
        logger.warn({ keyIndex: groqKeyIndex, attempt }, 'Groq 429 — rotating to next key');
        lastError = new Error(`Groq key ${attempt + 1} rate-limited (429)`);
        continue; // try next key
      }
      throw new Error(`Groq returned ${response.status}: ${text}`);
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

  throw lastError; // all keys rate-limited → fall to next tier
}

// ---- Together AI (T4: Llama 4 Maverick, paid) ----

async function callTogether(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  if (!config.togetherApiKey) throw new Error('Together AI API key not configured');

  const response = await fetch(`${config.togetherBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.togetherApiKey}`,
    },
    body: JSON.stringify({
      model: config.togetherModel,
      messages,
      max_tokens: config.togetherMaxTokens,
    }),
    signal: AbortSignal.timeout(config.togetherTimeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Together AI returned ${response.status}: ${text}`);
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

// ---- Moonshot/Edith Reasoning Call (T5: last resort, premium only) ----

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

// ---- Kimi K2 (T3) System Budget ----
// Direct Moonshot API (same endpoint as Edith, but kimi-k2 base model, not kimi-k2.5)
// Shared system-level monthly budget: $5 = 50,000 units (1 unit = $0.0001)
// Pricing: $0.50/M input, $2.50/M output

const KIMI_BASE_MODEL = config.moonshotBaseModel ?? 'kimi-k2';
const KIMI_BUDGET_KEY_PREFIX = 'system:kimi:spend:';
const KIMI_MONTHLY_BUDGET_UNITS = 50_000; // $5.00

function computeKimiSpendUnits(tokensIn: number, tokensOut: number): number {
  // units = cost * 10000 → (tokensIn * 0.5 + tokensOut * 2.5) / 1M * 10000
  return Math.ceil((tokensIn * 5 + tokensOut * 25) / 1000);
}

async function getKimiMonthlySpendUnits(): Promise<number> {
  const key = KIMI_BUDGET_KEY_PREFIX + new Date().toISOString().slice(0, 7);
  try {
    const val = await cacheGet(key);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

async function recordKimiSpend(tokensIn: number, tokensOut: number): Promise<void> {
  const units = computeKimiSpendUnits(tokensIn, tokensOut);
  const key = KIMI_BUDGET_KEY_PREFIX + new Date().toISOString().slice(0, 7);
  try {
    const current = await getKimiMonthlySpendUnits();
    await cacheSet(key, String(current + units), 31 * 24 * 60 * 60);
    logger.debug({ units, total: current + units, budget: KIMI_MONTHLY_BUDGET_UNITS }, 'kimi:spend_recorded');
  } catch {
    // Non-fatal
  }
}

async function isKimiWithinBudget(): Promise<boolean> {
  const spend = await getKimiMonthlySpendUnits();
  return spend < KIMI_MONTHLY_BUDGET_UNITS;
}

// ---- Free Tier Race (T1 + T6 simultaneously) ----
// Runs OpenRouter-free and Ollama in parallel — returns first successful response.

type CallResult = { content: string; tokensIn: number; tokensOut: number; provider: Provider };

async function raceFreeTier(
  messages: ChatMessage[],
  userId: string | undefined,
  ollamaOk: boolean,
): Promise<CallResult | null> {
  const promises: Array<Promise<CallResult>> = [];

  if (isOpenRouterFreeAvailable()) {
    promises.push(
      callOpenRouterFree(messages, userId)
        .then(r => ({ ...r, provider: 'openrouter-free' as Provider }))
    );
  }

  if (ollamaOk) {
    promises.push(
      callOllama(messages)
        .then(r => ({ ...r, provider: 'ollama' as Provider }))
    );
  }

  if (promises.length === 0) return null;

  try {
    return await Promise.any(promises);
  } catch {
    return null; // AggregateError: all failed
  }
}

// ---- Waterfall Fallback Helper ----

async function tryFallbackChain(
  providers: Provider[],
  fullMessages: ChatMessage[],
  userId: string | undefined,
  isPremium: boolean,
  overDailyBudget: boolean,
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
        case 'groq': {
          if (!isGroqAvailable()) continue;
          const r = await callGroq(fullMessages);
          return { ...r, provider: 'groq' };
        }
        case 'kimi': {
          if (!isEdithAvailable()) continue; // same API key / endpoint as Edith
          if (!await isKimiWithinBudget()) {
            logger.info({ budget: KIMI_MONTHLY_BUDGET_UNITS }, 'kimi:monthly_budget_exhausted — skipping T3');
            continue;
          }
          const r = await callOpenRouterWithModel(fullMessages, KIMI_BASE_MODEL);
          recordKimiSpend(r.tokensIn, r.tokensOut).catch(() => {});
          return { ...r, provider: 'kimi' };
        }
        case 'together': {
          if (!isPremium || !isTogetherAvailable() || overDailyBudget) continue;
          const r = await callTogether(fullMessages);
          return { ...r, provider: 'together' };
        }
        case 'edith': {
          if (!isPremium || !isEdithAvailable() || overDailyBudget) continue;
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
  groq:              2,
  'kimi':       5,
  picoclaw:          1,
  builtin:           0,
};

const TOKEN_CREDIT_RATES: Partial<Record<Provider, number>> = {
  openrouter: 5,
  together:   8,
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
  // Skip for guest/visitor users — no FK row in users or subscriptions table
  if (userId.startsWith('guest:')) return;
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
    case 'groq':            return 0;
    case 'kimi':       return (tokensIn * 0.0000005) + (tokensOut * 0.0000025);
    case 'together':        return (tokensIn * 0.00000027) + (tokensOut * 0.00000085);
    case 'openrouter':      return (tokensIn * 0.0000006) + (tokensOut * 0.000002);
    case 'edith':           return (tokensIn * 0.0000012) + (tokensOut * 0.000004);
    case 'picoclaw':        return 0;
    case 'builtin':         return 0;
    default:                return 0;
  }
}

function getModelForProvider(provider: Provider, userId?: string): string {
  switch (provider) {
    case 'ollama':          return config.ollamaModel;
    case 'groq':            return config.groqModel;
    case 'kimi':            return KIMI_BASE_MODEL;
    case 'together':        return config.togetherModel;
    case 'openrouter':      return config.openrouterModel;
    case 'edith':           return config.moonshotReasoningModel;
    case 'picoclaw':        return 'picoclaw-haiku';
    case 'builtin':         return 'builtin-fallback';
    default:                return provider;
  }
}

// ---- Manual Override Helper (TEST_MODE only) ----

export function getManualOverride(): Provider | null {
  if (!config.isTestMode) return null;
  const envOverride = process.env.FORCE_LLM_PROVIDER as Provider;
  const allowed: Provider[] = ['ollama', 'openrouter', 'openrouter-free', 'groq', 'kimi', 'together', 'edith', 'picoclaw', 'builtin'];
  if (envOverride && allowed.includes(envOverride)) {
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
    userPlan?: string;
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

  // ---- Cache check ----
  const NEVER_CACHE = /^(hi+|hey|hello|test(?:ing)?|ok|okay|sup|yo|thanks|ty|yes|no|sure|nope)[\s!.?]*$/i;
  const lastMsgContent = (messages[messages.length - 1]?.content as string) || '';
  const isCacheable =
    !opts?.forceProvider &&
    messages.length === 1 &&
    messages[0].role === 'user' &&
    !NEVER_CACHE.test(lastMsgContent.trim());

  const cacheKey = isCacheable ? makeCacheKey(messages, opts?.systemPrompt, opts?.userId) : '';

  if (isCacheable && cacheKey) {
    const memHit = getMemCached(cacheKey);
    if (memHit) {
      logger.debug({ cacheKey, intent, userId: opts?.userId, layer: 'memory' }, 'LLM cache hit');
      return { reply: memHit, provider: 'builtin', model: 'cache', tokensIn: 0, tokensOut: 0, latencyMs: 0, costEstimate: 0, creditCost: 0, intent };
    }

    const redisHit = await getRedisCached(cacheKey);
    if (redisHit) {
      logger.debug({ cacheKey, intent, userId: opts?.userId, layer: 'redis' }, 'LLM cache hit');
      setMemCached(cacheKey, redisHit);
      return { reply: redisHit, provider: 'builtin', model: 'cache', tokensIn: 0, tokensOut: 0, latencyMs: 0, costEstimate: 0, creditCost: 0, intent };
    }

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
    const allowed: Provider[] = ['ollama', 'openrouter', 'openrouter-free', 'groq', 'kimi', 'together', 'edith', 'picoclaw', 'builtin'];
    if (headerOverride && allowed.includes(headerOverride)) {
      manualOverride = headerOverride;
    }
    if (!manualOverride) manualOverride = getManualOverride();
  }

  // ---- Budget & Plan State ----
  const overBudget = opts?.userId ? shouldDegradeRouting(opts.userId) : false;
  const overDailyBudget = opts?.userId ? isOverDailyBudget(opts.userId) : false;
  const isPremium = isPremiumPlan(opts?.userPlan);
  const hasCredits = opts?.userCredits === undefined || opts.userCredits > 0;

  if (overDailyBudget && opts?.userId) {
    logger.info({ userId: opts.userId }, 'Daily token budget exceeded — restricting to free-tier providers');
  }

  // ---- Provider Selection ----
  let provider: Provider = 'builtin';
  let useRace = false; // race T1+T6 for free users
  let routingReason: RoutingTrace['reason'] = 'ollama_unreachable';

  const ollamaOk = await isOllamaAvailable();
  const picoOk = await isPicoClawAvailable();

  if (manualOverride || opts?.forceProvider) {
    provider = manualOverride || opts!.forceProvider!;
    routingReason = 'manual_override';

    // Budget degradation: downgrade paid providers when over budget
    if ((overBudget || overDailyBudget) && (provider === 'edith' || provider === 'openrouter' || provider === 'together' || provider === 'kimi')) {
      logger.info({ userId: opts?.userId, provider, overBudget, overDailyBudget }, 'Budget exceeded — degrading from paid provider');
      provider = 'openrouter-free';
      routingReason = overDailyBudget ? 'daily_budget_exceeded' : 'budget_degradation';
    }

  } else if (picoOk && intent === 'automation') {
    provider = 'picoclaw';
    routingReason = 'ollama_healthy';

  } else if (!isPremium || overBudget || overDailyBudget) {
    // Free users + budget-exceeded premium: Ollama first, cloud fallback
    if (ollamaOk) {
      provider = 'ollama';
      routingReason = 'ollama_healthy';
    } else if (isGroqAvailable()) {
      provider = 'groq';
      routingReason = 'fallback_chain';
    } else if (isOpenRouterFreeAvailable()) {
      provider = 'openrouter-free';
      routingReason = 'openrouter_free_available';
    } else {
      provider = 'builtin';
      routingReason = overDailyBudget ? 'daily_budget_exceeded' : 'ollama_unreachable';
    }

  } else {
    // Premium users, no budget issues: Ollama → Groq → OpenRouter → paid
    if (ollamaOk) {
      provider = 'ollama';
      routingReason = 'ollama_healthy';
    } else if (isGroqAvailable()) {
      provider = 'groq';
      routingReason = 'fallback_chain';
    } else if (isOpenRouterFreeAvailable()) {
      provider = 'openrouter-free';
      routingReason = 'openrouter_free_available';
    } else {
      provider = 'builtin';
      routingReason = 'ollama_unreachable';
    }
  }

  logger.info({
    provider: useRace ? 'race(openrouter-free+ollama)' : provider,
    intent,
    userId: opts?.userId,
    credits: opts?.userCredits,
    isPremium,
    overBudget,
    overDailyBudget,
    useRace,
    ollamaOk,
    routingReason,
    forced: !!(manualOverride || opts?.forceProvider),
  }, 'llm:provider_selected');

  // ---- Execute with in-flight tracking ----
  let reply: string;
  let tokensIn = 0;
  let tokensOut = 0;
  let model = '';
  let finalProvider = provider;

  let resolveInFlight: ((reply: string) => void) | null = null;
  if (isCacheable && cacheKey) {
    const inFlightPromise = new Promise<string>((resolve) => { resolveInFlight = resolve; });
    inFlightRequests.set(cacheKey, inFlightPromise);
  }

  try {
    if (useRace) {
      // ---- Free tier race: T1(OpenRouter-free) + T6(Ollama) ----
      const raceResult = await raceFreeTier(fullMessages, opts?.userId, ollamaOk);
      if (!raceResult) throw new Error('Free-tier race: all providers failed');

      reply = raceResult.content;
      tokensIn = raceResult.tokensIn;
      tokensOut = raceResult.tokensOut;
      finalProvider = raceResult.provider;
      model = finalProvider === 'ollama' ? config.ollamaModel : await getCurrentFreeModel();
      routingReason = finalProvider === 'ollama' ? 'ollama_healthy' : 'openrouter_free_available';

    } else {
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
        case 'groq': {
          const result = await callGroq(fullMessages);
          reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
          model = config.groqModel;
          break;
        }
        case 'kimi': {
          const result = await callOpenRouterWithModel(fullMessages, KIMI_BASE_MODEL);
          reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
          model = KIMI_BASE_MODEL;
          recordKimiSpend(tokensIn, tokensOut).catch(() => {});
          break;
        }
        case 'together': {
          const result = await callTogether(fullMessages);
          reply = result.content; tokensIn = result.tokensIn; tokensOut = result.tokensOut;
          model = config.togetherModel;
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
      finalProvider = provider;
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: errorMsg, provider: useRace ? 'race-free' : provider, intent, userId: opts?.userId }, 'llm:provider_failed');

    // ---- Fallback chains ----
    // Free / budget-degraded premium: T2(Groq free) → T3(Kimi, budget check) → error
    // Premium normal: T2(Groq) → T3(Kimi) → T4(Together) → T5(Edith) → error
    // (after primary T1 failure, chain starts from T2)

    let chain: Provider[];
    if (overBudget || overDailyBudget) {
      // Budget exceeded: free providers only
      chain = ['groq'];
    } else if (isPremium) {
      // Premium sequential: start from T2 (T1 just failed)
      const PAID_CHAIN: Provider[] = ['groq', 'kimi', 'together', 'edith'];
      const failedIdx = PAID_CHAIN.indexOf(provider);
      chain = failedIdx >= 0 ? PAID_CHAIN.slice(failedIdx + 1) : PAID_CHAIN;
    } else {
      // Free users (race failed): T2 → T3
      chain = ['groq', 'kimi'];
    }

    logger.info({ failedProvider: useRace ? 'race-free' : provider, chain, userId: opts?.userId }, 'llm:starting_fallback_chain');

    const fallback = await tryFallbackChain(chain, fullMessages, opts?.userId, isPremium, overDailyBudget);
    if (fallback) {
      reply = fallback.content;
      tokensIn = fallback.tokensIn;
      tokensOut = fallback.tokensOut;
      finalProvider = fallback.provider;
      model = getModelForProvider(finalProvider);
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

  if (resolveInFlight && reply) (resolveInFlight as (r: string) => void)(reply);

  if (opts?.userId) recordTokenUsage(opts.userId, tokensIn + tokensOut);

  const latencyMs = Date.now() - start;
  const costEstimate = estimateCost(finalProvider, tokensIn, tokensOut);
  const creditCost = computeCreditCost(finalProvider, tokensIn, tokensOut);

  // Record trace AFTER execution so routeDecision reflects the actual provider used
  recordRoutingTrace({
    timestamp: new Date().toISOString(),
    userId: opts?.userId || 'anonymous',
    routeDecision: finalProvider,
    reason: routingReason,
    latencyMs,
    tokensEstimate,
    intent,
    ollamaAvailable: ollamaOk,
    forcedProvider: manualOverride || opts?.forceProvider,
  });

  logger.info({ intent, provider: finalProvider, model, tokensIn, tokensOut, latencyMs, costEstimate, creditCost }, 'LLM response');

  if (isCacheable && cacheKey && reply && model !== 'error-fallback' && finalProvider !== 'builtin') {
    setMemCached(cacheKey, reply);
    setRedisCached(cacheKey, reply).catch(() => {});
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
      body: JSON.stringify({ model: config.ollamaModel, prompt: 'hi', stream: false, keep_alive: '5m', options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) logger.debug({ model: config.ollamaModel }, 'Ollama keepalive ping OK — model warm');
    else logger.warn({ model: config.ollamaModel, status: res.status }, 'Ollama keepalive ping failed');
  } catch (err) {
    logger.debug({ err: String(err) }, 'Ollama keepalive ping failed (non-fatal)');
  }
}

export function startOllamaKeepalive(): void {
  if (keepaliveInterval) return;
  pingOllama().catch(() => {});
  keepaliveInterval = setInterval(() => pingOllama().catch(() => {}), 2 * 60 * 1000);
  logger.info({ model: config.ollamaModel }, 'Ollama keepalive started (every 2 min, keep_alive=-1)');
}

// ---- Smart Provider Picker (used by chat routes) ----

export type UserModelPreference = 'local' | 'cloud' | 'premium' | 'auto';

export async function pickProvider(
  userId: string,
  messageText: string,
  userPlan: string,
): Promise<Provider> {
  const agentConfig = db.prepare('SELECT model_preference FROM agent_configs WHERE user_id = ?')
    .get(userId) as { model_preference: string } | undefined;
  const preference = (agentConfig?.model_preference || 'auto') as UserModelPreference;

  const isPaidPlan = ['pilot', 'intro', 'halfyear', 'yearly', 'monthly', 'pro'].includes(userPlan);

  if (preference === 'local') return 'ollama';
  if (preference === 'cloud') return 'openrouter-free';
  if (preference === 'premium') return isPaidPlan ? 'openrouter-free' : 'ollama';

  // Auto: routeChat waterfall handles everything — return openrouter-free as default
  // (routeChat will apply the full waterfall including race for free users)
  return 'openrouter-free';
}
