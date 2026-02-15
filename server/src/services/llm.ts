// ============================================================
// Quad-Brain LLM Router
//
// Brain 1: Ollama (local) — fast/cheap, handles simple tasks
// Brain 2: OpenRouter (global) — handles complex/coding/planning
// Brain 3: EDITH/OpenClaw (Moonshot) — heavy reasoning
// Brain 4: PicoClaw (sidecar) — lightweight automation tasks
//
// Flow: Intent classify → Route → Call → Log usage
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';

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
      options: {
        temperature: 0.7,
        num_predict: config.ollamaMaxTokens,
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

async function callOpenRouterFree(messages: ChatMessage[]) {
  return callOpenRouterWithModel(messages, config.openrouterFreeModel);
}

function isOpenRouterFreeAvailable(): boolean {
  return !!config.openrouterApiKey && !!config.openrouterFreeModel;
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
// Credits are the user-facing currency.  1 credit ≈ processing
// ~200 tokens on the standard cloud model.  Ollama is always free.
//
// Rates (credits per 1K tokens, input+output combined):
//   ollama / builtin  →  0  (free, local)
//   openrouter (k2.5) →  5
//   edith (k2-think)  → 10
//
// Minimum per premium call: 10 credits (prevents zero-cost micro-queries).

const CREDIT_RATES: Record<Provider, number> = {
  ollama:              0,
  'openrouter-free':   0,   // free cloud models (Llama 3.3 70B etc.)
  openrouter:          5,   // kimi-k2.5 — standard cloud
  edith:               10,  // kimi-k2-thinking — heavy reasoning
  picoclaw:            0,   // lightweight sidecar — free
  builtin:             0,
};

const MIN_PREMIUM_CREDITS = 10;

export function computeCreditCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  const rate = CREDIT_RATES[provider] ?? 0;
  if (rate === 0) return 0;
  const totalTokens = tokensIn + tokensOut;
  const cost = Math.ceil((totalTokens / 1000) * rate);
  return Math.max(cost, MIN_PREMIUM_CREDITS);
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
        model = config.openrouterFreeModel;
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
