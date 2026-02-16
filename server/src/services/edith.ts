// ============================================================
// EDITH / Moonshot Reasoning — direct HTTP to Moonshot API
//
// Previously routed through the EDITH WebSocket bridge to OpenClaw.
// Now calls the Moonshot API directly via standard OpenAI-compatible
// HTTP endpoints, using the kimi-k2-thinking model for heavy
// reasoning tasks.
//
// 120s timeout, 1 retry on transient failure.  If OPENROUTER_API_KEY
// is missing, calls throw / probe returns false — the LLM router
// falls back to OpenRouter (kimi-k2.5) or Ollama.
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';

export interface EdithResponse {
  text: string;
  provider: 'edith';
  route: 'edith';
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  debug?: { endpointUsed: string; status: number; model: string };
  raw?: unknown;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make a single chat-completions call directly to Moonshot API.
 */
async function tryMoonshot(
  url: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; tokensIn: number; tokensOut: number; status: number; raw: unknown }> {
  const res = await fetchWithTimeout(url, {
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
  }, config.moonshotTimeout);

  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`Moonshot ${url} returned ${res.status}: ${snippet.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
    status: res.status,
    raw: data,
  };
}

/**
 * Send a chat message via Moonshot reasoning model (kimi-k2-thinking).
 * 1 retry on transient failure.
 */
export async function edithChat(
  message: string,
  systemPrompt?: string,
  _userId?: string,
  _agentId?: string,
): Promise<EdithResponse> {
  if (!config.openrouterApiKey) {
    throw new Error('Moonshot API key not configured (OPENROUTER_API_KEY)');
  }

  const baseUrl = config.openrouterBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: message });

  const start = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await tryMoonshot(url, messages);
      const latencyMs = Date.now() - start;

      logger.info({ provider: 'edith', model: config.moonshotReasoningModel, latencyMs, attempt }, 'Moonshot reasoning response OK');

      return {
        text: result.content,
        provider: 'edith',
        route: 'edith',
        latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        debug: { endpointUsed: url, status: result.status, model: config.moonshotReasoningModel },
        raw: result.raw,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ url, attempt, error: lastError.message }, 'Moonshot reasoning request failed');
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw lastError || new Error('Moonshot reasoning request failed');
}

/**
 * Lightweight probe — can we reach the Moonshot API?
 * Sends a tiny completions request to verify the key works.
 */
export async function edithProbe(): Promise<boolean> {
  if (!config.openrouterApiKey || !config.openrouterBaseUrl) return false;

  const baseUrl = config.openrouterBaseUrl.replace(/\/+$/, '');

  try {
    const res = await fetchWithTimeout(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.openrouterApiKey}`,
      },
    }, 5000);

    return res.ok;
  } catch {
    return false;
  }
}
