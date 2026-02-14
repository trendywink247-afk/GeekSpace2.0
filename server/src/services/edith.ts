// ============================================================
// EDITH / OpenClaw — calls the edith-bridge service
//
// The bridge (http://edith-bridge:8787) handles the WebSocket
// connection to OpenClaw and exposes an OpenAI-compatible HTTP
// endpoint. This module simply makes standard chat-completion
// requests to that bridge.
//
// 120s timeout (LLM inference can be slow), 1 retry on transient
// failures. If EDITH_GATEWAY_URL or EDITH_TOKEN is missing, all
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
 * Make a single chat-completions call to the given URL.
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
      max_tokens: 512,
      temperature: 0.2,
    }),
  }, TIMEOUT_MS);

  // If HTML comes back (UI page) or 404, throw so we try the next endpoint
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || contentType.includes('text/html')) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`EDITH ${url} returned ${res.status} (${contentType}): ${snippet.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
    // Some gateways return flat content
    content?: string;
    response?: string;
  };

  // Support both OpenAI-format and flat-response gateways
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
 * Primary export — send a chat message through EDITH/OpenClaw.
 *
 * Makes a standard OpenAI-compatible POST to the bridge. Retries once on
 * transient errors (timeout / 5xx).
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

  for (const path of ENDPOINT_PATHS) {
    const url = `${baseUrl}${path}`;

    // Try with 1 retry on the primary endpoint
    const maxAttempts = path === ENDPOINT_PATHS[0] ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        logger.warn({ url, attempt, error: lastError.message }, 'EDITH endpoint failed');

        // Small delay before retry
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - start;

      logger.info({ provider: 'edith', latencyMs, attempt }, 'EDITH response OK');

      return {
        text: content,
        provider: 'edith',
        latencyMs,
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
        raw: data,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ attempt, error: lastError.message }, 'EDITH request failed');
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw lastError || new Error('EDITH request failed');
}

/**
 * Lightweight probe — can we reach the bridge?
 * Returns true if the bridge health endpoint responds with JSON.
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
