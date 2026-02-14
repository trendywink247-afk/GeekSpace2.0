// ============================================================
// EDITH / OpenClaw — calls the edith-bridge service
//
// The bridge (http://edith-bridge:8787) handles the WebSocket-RPC
// connection to OpenClaw and exposes an OpenAI-compatible HTTP
// endpoint.  This module simply makes standard chat-completion
// requests to that bridge.
//
// 120s timeout (LLM inference can be slow), 1 retry on transient
// failures.  If EDITH_GATEWAY_URL or EDITH_TOKEN is missing, all
// calls throw / probe returns false — the LLM router falls back
// to OpenRouter or Ollama.
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
  debug?: { endpointUsed: string; status: number };
  raw?: unknown;
}

const TIMEOUT_MS = 120_000;

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
 * Make a single chat-completions call to the bridge.
 * Returns the parsed response or throws on any failure.
 */
async function tryEndpoint(
  url: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; tokensIn: number; tokensOut: number; status: number; raw: unknown }> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.edithToken ? { Authorization: `Bearer ${config.edithToken}` } : {}),
      'x-openclaw-agent-id': 'main',
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  }, TIMEOUT_MS);

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || contentType.includes('text/html')) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`EDITH ${url} returned ${res.status} (${contentType}): ${snippet.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
    content?: string;
    response?: string;
  };

  const content =
    data.choices?.[0]?.message?.content ||
    data.content ||
    data.response ||
    '';

  return {
    content,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
    status: res.status,
    raw: data,
  };
}

/**
 * Send a chat message through EDITH/OpenClaw via the bridge.
 * Single endpoint, 1 retry on transient failure.
 */
export async function edithChat(
  message: string,
  systemPrompt?: string,
  _userId?: string,
  _agentId?: string,
): Promise<EdithResponse> {
  if (!config.edithGatewayUrl) {
    throw new Error('EDITH_GATEWAY_URL is not configured');
  }

  const baseUrl = config.edithGatewayUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/chat/completions`;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: message });

  const start = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await tryEndpoint(url, messages);
      const latencyMs = Date.now() - start;

      logger.info({ provider: 'edith', url, latencyMs, attempt }, 'EDITH response OK');

      return {
        text: result.content,
        provider: 'edith',
        route: 'edith',
        latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        debug: { endpointUsed: url, status: result.status },
        raw: result.raw,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ url, attempt, error: lastError.message }, 'EDITH request failed');
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw lastError || new Error('EDITH request failed');
}

/**
 * Lightweight probe — can we reach the bridge?
 * Returns true if the bridge health endpoint responds with ws_connected: true.
 */
export async function edithProbe(): Promise<boolean> {
  if (!config.edithGatewayUrl) return false;

  const baseUrl = config.edithGatewayUrl.replace(/\/+$/, '');

  try {
    const res = await fetchWithTimeout(`${baseUrl}/health`, {
      method: 'GET',
    }, 3000);

    if (!res.ok) return false;

    const data = await res.json() as { ws_connected?: boolean };
    return data.ws_connected === true;
  } catch {
    return false;
  }
}
