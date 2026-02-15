// ============================================================
// Tri-Brain LLM Router
//
// Brain 1: Ollama (local) — fast/cheap, handles simple tasks
// Brain 2: OpenRouter (global) — handles complex/coding/planning
// Brain 3: EDITH/OpenClaw (via edith-bridge) — heavy reasoning
//
// Flow: Intent classify → Route → Call → Log usage
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';

// ---- Types ----

export type Intent = 'simple' | 'planning' | 'coding' | 'automation' | 'complex';
export type Provider = 'ollama' | 'openrouter' | 'edith' | 'builtin';

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
  return !!config.edithGatewayUrl && !!config.edithToken;
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

async function callOpenRouter(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'HTTP-Referer': config.publicUrl,
      'X-Title': 'GeekSpace AI OS',
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(config.ollamaTimeout),
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

// ---- EDITH / OpenClaw Call (via edith-bridge) ----

async function callEdith(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const response = await fetch(`${config.edithGatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.edithToken}`,
    },
    body: JSON.stringify({
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`EDITH returned ${response.status}: ${text}`);
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

// ---- Cost Estimation ----

function estimateCost(provider: Provider, tokensIn: number, tokensOut: number): number {
  switch (provider) {
    case 'ollama': return 0; // local, free
    case 'openrouter': return (tokensIn * 0.000003) + (tokensOut * 0.000015); // rough estimate
    case 'edith': return (tokensIn * 0.000002) + (tokensOut * 0.00001);
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

  // Determine routing
  let provider: Provider = opts?.forceProvider || 'ollama';

  if (!opts?.forceProvider) {
    const ollamaOk = await isOllamaAvailable();

    if (intent === 'simple') {
      provider = ollamaOk ? 'ollama' : (isOpenRouterAvailable() ? 'openrouter' : 'builtin');
    } else if (intent === 'coding' || intent === 'complex' || intent === 'planning') {
      // Prefer EDITH for heavy tasks, then OpenRouter, then Ollama
      if (isEdithAvailable()) {
        provider = 'edith';
      } else if (isOpenRouterAvailable() && (opts?.userCredits === undefined || opts.userCredits > 0)) {
        provider = 'openrouter';
      } else {
        provider = ollamaOk ? 'ollama' : 'builtin';
      }
    } else if (intent === 'automation') {
      provider = ollamaOk ? 'ollama' : (isOpenRouterAvailable() ? 'openrouter' : 'builtin');
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
      case 'edith': {
        const result = await callEdith(fullMessages);
        reply = result.content;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        model = 'openclaw';
        break;
      }
      default: {
        // Builtin fallback — no LLM available
        reply = `I'm currently running in offline mode — my AI brain (Ollama) isn't reachable at ${config.ollamaBaseUrl}. ` +
          `Please check that Ollama is running and accessible. In the meantime, you can use terminal commands like \`gs reminders list\` or \`gs credits\`.`;
        model = 'builtin-fallback';
        tokensIn = userMessage.length;
        tokensOut = reply.length;
        break;
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ provider, intent, error: errorMsg }, 'LLM call failed, attempting fallback');

    // Fallback chain: ollama → openrouter → builtin
    if (provider === 'edith' || provider === 'openrouter') {
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
          reply = `I had trouble connecting to my AI backends. Error: ${errorMsg}. Please try again shortly.`;
          model = 'error-fallback';
          tokensIn = userMessage.length;
          tokensOut = reply.length;
          provider = 'builtin';
        }
      } else {
        reply = `I had trouble connecting to my AI backends. Error: ${errorMsg}. Please try again shortly.`;
        model = 'error-fallback';
        tokensIn = userMessage.length;
        tokensOut = reply.length;
        provider = 'builtin';
      }
    } else {
      reply = `I had trouble processing your request. Error: ${errorMsg}. Please try again.`;
      model = 'error-fallback';
      tokensIn = userMessage.length;
      tokensOut = reply.length;
      provider = 'builtin';
    }
  }

  const latencyMs = Date.now() - start;
  const costEstimate = estimateCost(provider, tokensIn, tokensOut);

  logger.info({
    intent,
    provider,
    model,
    tokensIn,
    tokensOut,
    latencyMs,
    costEstimate,
  }, 'LLM response');

  return { reply, provider, model, tokensIn, tokensOut, latencyMs, costEstimate, intent };
}
