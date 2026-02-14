// ============================================================
// EDITH / OpenClaw — Dedicated service for the OpenClaw gateway
//
// Tries the primary endpoint first (OpenAI-compatible /v1/chat/completions),
// falls back to /api/chat and /api/v1/chat/completions if 404.
// 10s timeout + 1 retry on transient failures.
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';

export interface EdithResponse {
  text: string;
  provider: 'edith';
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  raw?: unknown;
}

/** Ordered list of endpoint paths to try */
const ENDPOINT_PATHS = [
  '/v1/chat/completions',
  '/api/v1/chat/completions',
  '/api/chat',
];

const TIMEOUT_MS = 10_000;

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
): Promise<{ content: string; tokensIn: number; tokensOut: number; raw: unknown }> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.edithToken ? { Authorization: `Bearer ${config.edithToken}` } : {}),
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
    raw: data,
  };
}

/**
 * Primary export — send a chat message through EDITH/OpenClaw.
 *
 * Tries each endpoint path in order. On the first success, returns.
 * If the first call on the primary endpoint fails with a transient
 * error (timeout / 5xx), retries once before moving on.
 */
export async function edithChat(
  message: string,
  systemPrompt?: string,
): Promise<EdithResponse> {
  if (!config.edithGatewayUrl) {
    throw new Error('EDITH_GATEWAY_URL is not configured');
  }

  const baseUrl = config.edithGatewayUrl.replace(/\/+$/, '');

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: message });

  let lastError: Error | null = null;
  const start = Date.now();

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
          latencyMs,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
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
    }
  }

  throw lastError || new Error('All EDITH endpoints failed');
}

/**
 * Lightweight probe — can we reach the gateway at all?
 * Returns true if any response (even 401/405) comes back, meaning the host is up.
 * Returns false only on network error / timeout / HTML redirect.
 */
export async function edithProbe(): Promise<boolean> {
  if (!config.edithGatewayUrl) return false;

  const baseUrl = config.edithGatewayUrl.replace(/\/+$/, '');

  try {
    const res = await fetchWithTimeout(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }, 3000);

    const ct = res.headers.get('content-type') || '';
    // If we get JSON back (even an error), the gateway is alive
    if (ct.includes('application/json')) return true;
    // 401/403/405 with any content type still means the server is there
    if ([401, 403, 405, 422].includes(res.status)) return true;
    return false;
  } catch {
    return false;
  }
}
