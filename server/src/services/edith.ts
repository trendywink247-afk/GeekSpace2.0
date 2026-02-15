// ============================================================
// EDITH — Premium AI via OpenClaw Bridge
//
// Routes through the EDITH Bridge (HTTP ↔ WebSocket-RPC) to
// reach the OpenClaw container.  Falls back to Moonshot API
// direct if bridge is unavailable.
//
// 120s timeout, 1 retry on transient failure.
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

// ---- Bridge health cache ----

let bridgeHealthy: boolean | null = null;
let bridgeCheckTime = 0;
const BRIDGE_CACHE_TTL = 15_000; // 15s

/**
 * Check if the EDITH Bridge is healthy and connected to OpenClaw.
 */
export async function edithProbe(): Promise<boolean> {
  // Cache check
  if (bridgeHealthy !== null && Date.now() - bridgeCheckTime < BRIDGE_CACHE_TTL) {
    return bridgeHealthy;
  }

  const bridgeUrl = config.edithGatewayUrl || 'http://edith-bridge:8787';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${bridgeUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      bridgeHealthy = false;
      bridgeCheckTime = Date.now();
      return false;
    }

    const data = await res.json() as { ws_connected?: boolean; rpc_ok?: boolean };
    bridgeHealthy = data.ws_connected === true;
    bridgeCheckTime = Date.now();
    return bridgeHealthy;
  } catch {
    bridgeHealthy = false;
    bridgeCheckTime = Date.now();
    return false;
  }
}

/**
 * Call OpenClaw via the EDITH Bridge.
 */
async function callViaBridge(
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; tokensIn: number; tokensOut: number; status: number; raw: unknown }> {
  const bridgeUrl = config.edithGatewayUrl || 'http://edith-bridge:8787';
  const url = `${bridgeUrl}/v1/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.edithToken ? { Authorization: `Bearer ${config.edithToken}` } : {}),
    },
    body: JSON.stringify({
      model: 'openclaw',
      messages,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`Bridge ${url} returned ${res.status}: ${snippet.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
    status: res.status,
    raw: data,
  };
}

/**
 * Call Moonshot API directly (fallback when bridge is down).
 */
async function callMoonshotDirect(
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; tokensIn: number; tokensOut: number; status: number; raw: unknown }> {
  if (!config.openrouterApiKey) {
    throw new Error('No API key configured for Moonshot fallback');
  }

  const baseUrl = config.openrouterBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openrouterApiKey}`,
    },
    body: JSON.stringify({
      model: config.moonshotReasoningModel,
      messages,
      max_tokens: config.moonshotMaxTokens,
    }),
    signal: AbortSignal.timeout(config.moonshotTimeout),
  });

  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    throw new Error(`Moonshot ${url} returned ${res.status}: ${snippet.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
    status: res.status,
    raw: data,
  };
}

/**
 * Send a chat message via EDITH (OpenClaw bridge → Moonshot fallback).
 * 1 retry on transient failure.
 */
export async function edithChat(
  message: string,
  systemPrompt?: string,
  _userId?: string,
  _agentId?: string,
): Promise<EdithResponse> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: message });

  const start = Date.now();
  let lastError: Error | null = null;
  const useBridge = await edithProbe();

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let result: { content: string; tokensIn: number; tokensOut: number; status: number; raw: unknown };
      let endpointUsed: string;
      let modelUsed: string;

      if (useBridge) {
        result = await callViaBridge(messages);
        endpointUsed = `${config.edithGatewayUrl || 'http://edith-bridge:8787'}/v1/chat/completions`;
        modelUsed = 'openclaw';
      } else {
        result = await callMoonshotDirect(messages);
        endpointUsed = `${config.openrouterBaseUrl}/chat/completions`;
        modelUsed = config.moonshotReasoningModel;
      }

      const latencyMs = Date.now() - start;
      logger.info({ provider: 'edith', model: modelUsed, latencyMs, attempt, viaBridge: useBridge }, 'Edith response OK');

      return {
        text: result.content,
        provider: 'edith',
        route: 'edith',
        latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        debug: { endpointUsed, status: result.status, model: modelUsed },
        raw: result.raw,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ attempt, error: lastError.message, viaBridge: useBridge }, 'Edith request failed');
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }

  // If bridge failed, try Moonshot direct as last resort
  if (useBridge && config.openrouterApiKey) {
    try {
      const result = await callMoonshotDirect(messages);
      const latencyMs = Date.now() - start;
      logger.info({ provider: 'edith', model: config.moonshotReasoningModel, latencyMs, fallback: true }, 'Edith response via Moonshot fallback');

      return {
        text: result.content,
        provider: 'edith',
        route: 'edith',
        latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        debug: { endpointUsed: `${config.openrouterBaseUrl}/chat/completions`, status: result.status, model: config.moonshotReasoningModel },
        raw: result.raw,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ error: lastError.message }, 'Edith Moonshot fallback also failed');
    }
  }

  throw lastError || new Error('Edith request failed');
}
