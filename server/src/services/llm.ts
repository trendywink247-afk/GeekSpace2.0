// ============================================================
// Three-Agent LLM Router
//
// Edith  (premium):  OpenClaw via Bridge → Moonshot fallback
// Jarvis (cloud):    OpenRouter free tier (Llama 3.3 70B etc.)
// Weebo  (local):    Ollama on VPS (qwen2.5-coder)
//
// Flow: Intent classify → Route to agent → Call provider → Log usage
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
import { edithProbe } from './edith.js';
import { sanitizeResponse } from '../prompts/openclaw-system.js';

// ---- Types ----

export type AgentName = 'edith' | 'jarvis' | 'weebo';
export type Intent = 'simple' | 'planning' | 'coding' | 'automation' | 'complex';
export type Provider = 'openclaw' | 'openrouter' | 'openrouter-free' | 'ollama' | 'picoclaw' | 'builtin';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  reply: string;
  agent: AgentName;
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

// ---- Max tokens per agent/intent ----

function getMaxTokens(agent: AgentName, intent: Intent): number {
  switch (agent) {
    case 'weebo':
      return 256;
    case 'jarvis':
      return intent === 'coding' ? 2048 : 1024;
    case 'edith':
      return 4096;
    default:
      return 1024;
  }
}

// ---- Provider Availability ----

let ollamaAvailable: boolean | null = null;
let ollamaCheckTime = 0;

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

async function isEdithAvailable(): Promise<boolean> {
  return edithProbe();
}

function isOpenRouterFreeAvailable(): boolean {
  return !!config.openrouterFreeApiKey && !!config.openrouterFreeModel;
}

function isOpenRouterAvailable(): boolean {
  return !!config.openrouterApiKey;
}

// ---- Ollama Streaming ----

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

async function callOllama(messages: ChatMessage[], maxTokens?: number): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: maxTokens || config.ollamaMaxTokens,
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

  return {
    content: data.message?.content || '',
    tokensIn: data.prompt_eval_count || Math.ceil(messages.map(m => m.content).join('').length / 4),
    tokensOut: data.eval_count || Math.ceil((data.message?.content || '').length / 4),
  };
}

// ---- OpenClaw via Bridge ----

async function callOpenClaw(messages: ChatMessage[], maxTokens?: number): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const bridgeUrl = config.edithGatewayUrl || 'http://edith-bridge:8787';

  const response = await fetch(`${bridgeUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.edithToken ? { Authorization: `Bearer ${config.edithToken}` } : {}),
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages,
      max_tokens: maxTokens || 4096,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Bridge returned ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  };
}

// ---- OpenRouter Call (OpenAI-compatible) ----

async function callOpenRouterWithModel(
  messages: ChatMessage[],
  model: string,
  maxTokens?: number,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'HTTP-Referer': config.publicUrl,
      'X-Title': 'GeekSpace',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens || config.openrouterMaxTokens,
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

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  };
}

async function callOpenRouter(messages: ChatMessage[], maxTokens?: number) {
  return callOpenRouterWithModel(messages, config.openrouterModel, maxTokens);
}

async function callOpenRouterFree(messages: ChatMessage[], maxTokens?: number): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.openrouterFreeBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterFreeApiKey}`,
      'HTTP-Referer': config.publicUrl,
      'X-Title': 'GeekSpace',
    },
    body: JSON.stringify({
      model: config.openrouterFreeModel,
      messages,
      max_tokens: maxTokens || config.openrouterMaxTokens,
    }),
    signal: AbortSignal.timeout(config.openrouterTimeout),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenRouter Free returned ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  };
}

// ---- Credit Cost ----

const CREDIT_RATES: Record<Provider, number> = {
  openclaw:            10,  // Edith — premium via OpenClaw bridge
  openrouter:          5,   // paid cloud model
  'openrouter-free':   0,   // Jarvis — included in plan
  ollama:              0,   // Weebo — included in plan
  picoclaw:            0,   // Weebo automation — included in plan
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

function estimateCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  switch (provider) {
    case 'ollama': return 0;
    case 'openrouter-free': return 0;
    case 'openrouter': return (tokensIn * 0.0000006) + (tokensOut * 0.000002);
    case 'openclaw': return (tokensIn * 0.0000012) + (tokensOut * 0.000004);
    case 'picoclaw': return 0;
    case 'builtin': return 0;
    default: return 0;
  }
}

// ---- Agent resolver ----

function resolveAgent(intent: Intent, forceAgent?: AgentName): AgentName {
  if (forceAgent) return forceAgent;

  switch (intent) {
    case 'simple':
    case 'automation':
      return 'weebo';
    case 'coding':
    case 'planning':
      return 'jarvis';
    case 'complex':
      return 'edith';
    default:
      return 'jarvis';
  }
}

// ---- Main Router ----

export async function routeChat(
  messages: ChatMessage[],
  opts?: {
    forceProvider?: Provider;
    forceAgent?: AgentName;
    userCredits?: number;
    systemPrompt?: string;
    agentName?: string;
    maxTokensOverride?: number;
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

  // Resolve agent and provider
  const agent = resolveAgent(intent, opts?.forceAgent);
  const maxTokens = opts?.maxTokensOverride || getMaxTokens(agent, intent);
  let provider: Provider = opts?.forceProvider || 'ollama';

  if (!opts?.forceProvider) {
    const ollamaOk = await isOllamaAvailable();
    const picoOk = await isPicoClawAvailable();
    const hasCredits = opts?.userCredits === undefined || opts.userCredits > 0;

    switch (agent) {
      case 'edith': {
        // Premium: OpenClaw via bridge → Moonshot → Jarvis fallback → Weebo
        const edithOk = await isEdithAvailable();
        if (edithOk && hasCredits) {
          provider = 'openclaw';
        } else if (hasCredits && isOpenRouterAvailable()) {
          provider = 'openrouter'; // Moonshot direct fallback
        } else if (isOpenRouterFreeAvailable()) {
          provider = 'openrouter-free'; // Downgrade to Jarvis
        } else if (ollamaOk) {
          provider = 'ollama';
        } else {
          provider = 'builtin';
        }
        break;
      }
      case 'jarvis': {
        // Cloud: OpenRouter free → Ollama fallback
        if (isOpenRouterFreeAvailable()) {
          provider = 'openrouter-free';
        } else if (ollamaOk) {
          provider = 'ollama';
        } else {
          provider = 'builtin';
        }
        break;
      }
      case 'weebo': {
        // Local: PicoClaw for automation, else Ollama → cloud fallback
        if (picoOk && intent === 'automation') {
          provider = 'picoclaw';
        } else if (ollamaOk) {
          provider = 'ollama';
        } else if (isOpenRouterFreeAvailable()) {
          provider = 'openrouter-free';
        } else {
          provider = 'builtin';
        }
        break;
      }
    }
  }

  // Execute
  let reply: string;
  let tokensIn = 0;
  let tokensOut = 0;
  let model = '';
  let actualAgent = agent;

  try {
    switch (provider) {
      case 'ollama': {
        const result = await callOllama(fullMessages, maxTokens);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = config.ollamaModel;
        if (agent !== 'weebo') actualAgent = 'weebo';
        break;
      }
      case 'openclaw': {
        const result = await callOpenClaw(fullMessages, maxTokens);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = 'openclaw';
        actualAgent = 'edith';
        break;
      }
      case 'openrouter': {
        const result = await callOpenRouter(fullMessages, maxTokens);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = config.openrouterModel;
        actualAgent = 'edith';
        break;
      }
      case 'openrouter-free': {
        const result = await callOpenRouterFree(fullMessages, maxTokens);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = config.openrouterFreeModel;
        if (agent !== 'jarvis') actualAgent = 'jarvis';
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
        actualAgent = 'weebo';
        break;
      }
      default: {
        reply = "I'm having a moment. Try again shortly, or use terminal commands for quick tasks.";
        model = 'builtin-fallback';
        tokensIn = userMessage.length;
        tokensOut = reply.length;
        break;
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ provider, intent, agent, error: errorMsg }, 'LLM call failed, attempting fallback');

    // Fallback chain based on agent
    reply = await attemptFallback(fullMessages, provider, agent, maxTokens);
    if (reply) {
      // Determine which provider handled the fallback
      if (provider === 'openclaw' || provider === 'openrouter') {
        // Edith failed → try Jarvis → Weebo
        if (isOpenRouterFreeAvailable()) {
          provider = 'openrouter-free';
          model = config.openrouterFreeModel;
          actualAgent = 'jarvis';
        } else {
          provider = 'ollama';
          model = config.ollamaModel;
          actualAgent = 'weebo';
        }
      } else if (provider === 'openrouter-free') {
        provider = 'ollama';
        model = config.ollamaModel;
        actualAgent = 'weebo';
      } else {
        provider = 'openrouter-free';
        model = config.openrouterFreeModel;
        actualAgent = 'jarvis';
      }
      tokensIn = Math.ceil(userMessage.length / 4);
      tokensOut = Math.ceil(reply.length / 4);
    } else {
      reply = "Sorry, couldn't process that. Let's try again!";
      model = 'error-fallback';
      provider = 'builtin';
      tokensIn = userMessage.length;
      tokensOut = reply.length;
    }
  }

  // Sanitize response — strip any leaked internal terms
  reply = sanitizeResponse(reply);

  const latencyMs = Date.now() - start;
  const costEstimate = estimateCost(provider, tokensIn, tokensOut);
  const creditCost = computeCreditCost(provider, tokensIn, tokensOut);

  logger.info({
    intent, agent: actualAgent, provider, model,
    tokensIn, tokensOut, latencyMs, creditCost,
  }, 'LLM response');

  return { reply, agent: actualAgent, provider, model, tokensIn, tokensOut, latencyMs, costEstimate, creditCost, intent };
}

// ---- Fallback helper ----

async function attemptFallback(
  messages: ChatMessage[],
  failedProvider: Provider,
  agent: AgentName,
  maxTokens: number,
): Promise<string | null> {
  // Edith/paid failed → try Jarvis (free cloud) → Weebo (local)
  if (failedProvider === 'openclaw' || failedProvider === 'openrouter') {
    if (isOpenRouterFreeAvailable()) {
      try {
        const result = await callOpenRouterFree(messages, maxTokens);
        return result.content;
      } catch { /* continue */ }
    }
    const ollamaOk = await isOllamaAvailable();
    if (ollamaOk) {
      try {
        const result = await callOllama(messages, maxTokens);
        return result.content;
      } catch { /* continue */ }
    }
  }

  // Jarvis (free cloud) failed → try Weebo (local)
  if (failedProvider === 'openrouter-free') {
    const ollamaOk = await isOllamaAvailable();
    if (ollamaOk) {
      try {
        const result = await callOllama(messages, maxTokens);
        return result.content;
      } catch { /* continue */ }
    }
  }

  // Weebo (local) failed → try Jarvis (free cloud)
  if (failedProvider === 'ollama' || failedProvider === 'picoclaw') {
    if (isOpenRouterFreeAvailable()) {
      try {
        const result = await callOpenRouterFree(messages, maxTokens);
        return result.content;
      } catch { /* continue */ }
    }
  }

  return null;
}
