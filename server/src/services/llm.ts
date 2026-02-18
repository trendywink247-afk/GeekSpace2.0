// ============================================================
// GeekSpace LLM Router
//
// Local Engine: Ollama — fast/cheap, handles simple tasks
// Cloud Engine: OpenRouter — handles complex/coding/planning
// Premium Engine: Moonshot Reasoning — heavy reasoning
// Automation Engine: PicoClaw — lightweight automation tasks
// Orchestration: Pico-Kimi Bridge — multi-agent workflows
//
// Flow: Intent classify → Route → Call → Log usage
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
import { getCurrentFreeModel, switchToNextFreeModel } from './openrouter-models.js';

// ---- Types ----

export type Intent = 'simple' | 'planning' | 'coding' | 'automation' | 'complex';
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

export function classifyIntent(message: string): Intent {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;

  // Long messages are more likely complex
  if (wordCount > 80) return 'complex';

  const matchCount = (keywords: string[]) =>
    keywords.filter((k) => lower.includes(k)).length;

  const codingScore = matchCount(CODING_KEYWORDS);
  const planningScore = matchCount(PLANNING_KEYWORDS);
  const automationScore = matchCount(AUTOMATION_KEYWORDS);
  const complexScore = matchCount(COMPLEX_KEYWORDS);

  if (codingScore >= 2) return 'coding';
  if (automationScore >= 1) return 'automation';
  if (planningScore >= 2) return 'planning';
  if (complexScore >= 2 || wordCount > 40) return 'complex';

  return 'simple';
}

// ---- Provider Availability ----

let ollamaAvailable: boolean | null = null;
let ollamaCheckTime = 0;

async function isOllamaAvailable(): Promise<boolean> {
  // Cache check for 30 seconds
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

function isEdithAvailable(): boolean {
  // Now checks for direct Moonshot API access (no longer needs EDITH bridge)
  return !!config.openrouterApiKey && !!config.openrouterBaseUrl;
}

// ---- Ollama Streaming Call ----

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

    // Ollama sends newline-delimited JSON
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
        if (data.message?.content) {
          onChunk(data.message.content);
        }
        if (data.done) {
          tokensIn = data.prompt_eval_count || 0;
          tokensOut = data.eval_count || 0;
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return { tokensIn, tokensOut };
}

// ---- Ollama Call ----

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
  const elapsed = Date.now() - start;
  logger.debug({ provider: 'ollama', elapsed, model: config.ollamaModel }, 'Ollama response');

  return {
    content,
    tokensIn: data.prompt_eval_count || Math.ceil(messages.map(m => m.content).join('').length / 4),
    tokensOut: data.eval_count || Math.ceil(content.length / 4),
  };
}

// ---- OpenRouter Call (OpenAI-compatible) ----

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

async function callOpenRouterFree(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const baseUrl = config.openrouterFreeBaseUrl;
  const apiKey = config.openrouterFreeApiKey;
  const MAX_ATTEMPTS = 3;

  let lastError: Error = new Error('OpenRouter Free: no attempts made');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const model = await getCurrentFreeModel();

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

    // On quota/rate-limit errors, switch model and retry immediately
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
        continue; // retry with next model
      }

      // Non-quota error — throw immediately without retrying
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

function isOpenRouterFreeAvailable(): boolean {
  return !!config.openrouterFreeApiKey && !!config.openrouterFreeModel;
}

// ---- Moonshot Reasoning Call (direct HTTP — replaces broken EDITH/WS bridge) ----

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

// ---- Credit Cost ----
//
// Every AI call costs at least 1 credit so the meter always moves.
//
// Flat costs per call:
//   ollama           →  1 (local, cheap)
//   openrouter-free  →  2 (free cloud models)
//   picoclaw         →  1 (automation sidecar)
//   builtin          →  0 (fallback, no real AI)
//
// Token-based costs (per 1K tokens):
//   openrouter (k2.5)       →  5
//   edith (k2-thinking)     → 10
//
// Minimum per premium call: 10 credits.

import { db } from '../db/index.js';

const FLAT_CREDIT_COSTS: Partial<Record<Provider, number>> = {
  ollama:            1,
  'openrouter-free': 2,
  picoclaw:          1,
  builtin:           0,
};

const TOKEN_CREDIT_RATES: Partial<Record<Provider, number>> = {
  openrouter: 5,   // kimi-k2.5 — standard cloud
  edith:      10,  // kimi-k2-thinking — heavy reasoning
};

const MIN_PREMIUM_CREDITS = 10;

export function computeCreditCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  // Flat-cost providers
  const flat = FLAT_CREDIT_COSTS[provider];
  if (flat !== undefined) return flat;

  // Token-based providers
  const rate = TOKEN_CREDIT_RATES[provider];
  if (rate) {
    const totalTokens = tokensIn + tokensOut;
    const cost = Math.ceil((totalTokens / 1000) * rate);
    return Math.max(cost, MIN_PREMIUM_CREDITS);
  }

  return 0;
}

// Deduct credits from the subscription table after each LLM call
export function deductSubscriptionCredits(userId: string, credits: number): void {
  if (credits <= 0) return;
  db.prepare(`
    UPDATE subscriptions
    SET credits_remaining = MAX(0, credits_remaining - ?),
        credits_used_this_cycle = credits_used_this_cycle + ?
    WHERE user_id = ?
  `).run(credits, credits, userId);
}

// Legacy USD estimate (kept for usage_events.cost_usd column)
function estimateCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  switch (provider) {
    case 'ollama': return 0;
    case 'openrouter-free': return 0;
    case 'openrouter': return (tokensIn * 0.0000006) + (tokensOut * 0.000002);
    case 'edith': return (tokensIn * 0.0000012) + (tokensOut * 0.000004);
    case 'picoclaw': return 0;
    case 'builtin': return 0;
    default: return 0;
  }
}

// ---- Main Router ----

export async function routeChat(
  messages: ChatMessage[],
  opts?: {
    forceProvider?: Provider;
    userCredits?: number;
    systemPrompt?: string;
    agentName?: string;
  },
): Promise<LLMResponse> {
  const start = Date.now();
  const userMessage = messages[messages.length - 1]?.content || '';
  const intent = classifyIntent(userMessage);

  // Build full message list with system prompt
  const fullMessages: ChatMessage[] = [];
  if (opts?.systemPrompt) {
    fullMessages.push({ role: 'system', content: opts.systemPrompt });
  }
  fullMessages.push(...messages);

  // Determine routing — two-tier system:
  //   Tier 1 (free):    Ollama local — default for ALL queries
  //   Tier 2 (premium): Moonshot cloud — only when explicitly forced or Ollama unavailable
  let provider: Provider = opts?.forceProvider || 'ollama';

  if (!opts?.forceProvider) {
    const ollamaOk = await isOllamaAvailable();
    const picoOk = await isPicoClawAvailable();
    const hasCredits = opts?.userCredits === undefined || opts.userCredits > 0;

    if (picoOk && intent === 'automation') {
      provider = 'picoclaw';
    } else if (intent === 'simple' && ollamaOk) {
      // Simple queries → always local (fast, free)
      provider = 'ollama';
    } else if (intent === 'coding' || intent === 'planning' || intent === 'complex') {
      // Complex queries → try free cloud first, then paid, then local fallback
      if (isOpenRouterFreeAvailable()) {
        provider = 'openrouter-free';
      } else if (hasCredits && isEdithAvailable() && intent === 'complex') {
        provider = 'edith';
      } else if (hasCredits && isOpenRouterAvailable()) {
        provider = 'openrouter';
      } else if (ollamaOk) {
        provider = 'ollama';
      } else {
        provider = 'builtin';
      }
    } else if (ollamaOk) {
      provider = 'ollama';
    } else if (picoOk) {
      provider = 'picoclaw';
    } else {
      provider = 'builtin';
    }
  }

  // Execute
  let reply: string;
  let tokensIn = 0;
  let tokensOut = 0;
  let model = '';

  try {
    switch (provider) {
      case 'ollama': {
        const result = await callOllama(fullMessages);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = config.ollamaModel;
        break;
      }
      case 'openrouter': {
        const result = await callOpenRouter(fullMessages);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = config.openrouterModel;
        break;
      }
      case 'openrouter-free': {
        const result = await callOpenRouterFree(fullMessages);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = await getCurrentFreeModel();
        break;
      }
      case 'edith': {
        const result = await callMoonshotReasoning(fullMessages);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = config.moonshotReasoningModel;
        break;
      }
      case 'picoclaw': {
        const userMsg = fullMessages[fullMessages.length - 1]?.content || '';
        const sysMsg = fullMessages.find(m => m.role === 'system')?.content;
        const result = await queryPicoClaw(userMsg, sysMsg);
        reply = result.text;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = 'picoclaw-haiku';
        break;
      }
      default: {
        // Builtin fallback — no LLM available
        reply = `I'm currently running in offline mode — my AI backend isn't available right now. ` +
          `Please try again shortly, or use terminal commands like \`gs reminders list\` or \`gs credits\`.`;
        model = 'builtin-fallback';
        tokensIn = userMessage.length;
        tokensOut = reply.length;
        break;
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ provider, intent, error: errorMsg }, 'LLM call failed, attempting fallback');

    // Fallback chain: cloud → ollama → builtin
    if (provider === 'edith' || provider === 'openrouter' || provider === 'openrouter-free') {
      const ollamaOk = await isOllamaAvailable();
      if (ollamaOk) {
        try {
          const result = await callOllama(fullMessages);
          reply = result.content;
          tokensIn = result.tokensIn;
          tokensOut = result.tokensOut;
          model = config.ollamaModel;
          provider = 'ollama';
        } catch {
          reply = 'I had trouble connecting to my AI backends. Please try again shortly.';
          model = 'error-fallback';
          tokensIn = userMessage.length;
          tokensOut = reply.length;
          provider = 'builtin';
        }
      } else {
        reply = 'I had trouble connecting to my AI backends. Please try again shortly.';
        model = 'error-fallback';
        tokensIn = userMessage.length;
        tokensOut = reply.length;
        provider = 'builtin';
      }
    } else {
      reply = 'I had trouble processing your request. Please try again shortly.';
      model = 'error-fallback';
      tokensIn = userMessage.length;
      tokensOut = reply.length;
      provider = 'builtin';
    }
  }

  const latencyMs = Date.now() - start;
  const costEstimate = estimateCost(provider, tokensIn, tokensOut);
  const creditCost = computeCreditCost(provider, tokensIn, tokensOut);

  logger.info({
    intent,
    provider,
    model,
    tokensIn,
    tokensOut,
    latencyMs,
    costEstimate,
    creditCost,
  }, 'LLM response');

  return { reply, provider, model, tokensIn, tokensOut, latencyMs, costEstimate, creditCost, intent };
}

// ---- Smart Provider Picker ----

export type UserModelPreference = 'local' | 'cloud' | 'premium' | 'auto';

export async function pickProvider(
  userId: string,
  messageText: string,
  userPlan: string,
): Promise<Provider> {
  // Read user preference
  const agentConfig = db.prepare('SELECT model_preference FROM agent_configs WHERE user_id = ?')
    .get(userId) as { model_preference: string } | undefined;
  const preference = (agentConfig?.model_preference || 'auto') as UserModelPreference;

  // Plan-based access
  const isPremiumPlan = ['halfyear', 'yearly'].includes(userPlan);
  const isPaidPlan = ['pilot', 'intro', 'halfyear', 'yearly', 'monthly'].includes(userPlan);

  if (preference === 'local') return 'ollama';
  if (preference === 'cloud') return isPaidPlan ? 'openrouter-free' : 'ollama';
  if (preference === 'premium') return isPremiumPlan ? 'edith' : (isPaidPlan ? 'openrouter-free' : 'ollama');

  // Auto: check complexity + plan
  const intent = classifyIntent(messageText);
  if (['planning', 'complex'].includes(intent)) {
    if (isPremiumPlan) return 'edith';
    if (isPaidPlan) return 'openrouter-free';
    return 'ollama';
  }

  // Simple queries: default to ollama
  return 'ollama';
}
