// LEGACY — This bridge is deprecated. GeekSpace now uses direct API calls. Kept for reference.
// ============================================================
// EDITH Bridge — WebSocket-RPC ↔ HTTP bridge for OpenClaw
//
// OpenClaw uses JSON-RPC over WebSocket:
//   Request:  {"id":"<uuid>","method":"<name>","params":{...}}
//   Response: {"id":"<uuid>","ok":true,"result":{...}}
//             {"id":"<uuid>","ok":false,"error":"..."}
//
// This bridge accepts OpenAI-compatible HTTP requests, translates
// them into OpenClaw RPC calls, and returns OpenAI-compatible
// JSON responses.
//
// Endpoints:
//   POST /v1/chat/completions  — chat via RPC
//   GET  /v1/models            — model list
//   GET  /health               — WS + RPC liveness
// ============================================================

import express from 'express';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

// ---- Configuration ----

const PORT            = parseInt(process.env.BRIDGE_PORT || '8787', 10);
const OPENCLAW_WS_URL = process.env.EDITH_OPENCLAW_WS || 'ws://host.docker.internal:18789';
const TOKEN           = process.env.EDITH_TOKEN || '';
const CHAT_METHOD     = process.env.OPENCLAW_CHAT_METHOD || 'chat.completions';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || '120000', 10);
const RECONNECT_BASE  = 1000;   // 1 s
const RECONNECT_MAX   = 30000;  // 30 s
const PING_INTERVAL   = 30000;  // 30 s

// ---- Structured logger (never logs tokens/secrets) ----

function log(level, msg, meta = {}) {
  if (level === 'debug' && process.env.LOG_LEVEL !== 'debug') return;
  const entry = { time: new Date().toISOString(), level, msg, ...meta };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(entry));
}

// ============================================================
// OpenClaw WebSocket-RPC client
//
// Maintains a persistent WS connection and correlates
// request/response frames by their "id" field.  Supports
// concurrent in-flight RPC calls.
// ============================================================

class OpenClawClient {
  constructor() {
    /** @type {WebSocket|null} */
    this.ws = null;
    this.connected = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;

    /** In-flight RPC calls keyed by id — @type {Map<string, {resolve: Function, reject: Function, timer: any}>} */
    this.pending = new Map();
  }

  // ---- Connection lifecycle ----

  connect() {
    if (this.ws) {
      try { this.ws.terminate(); } catch { /* ignore */ }
    }

    // Pass token via query param AND Authorization header (cover both auth patterns)
    const sep = OPENCLAW_WS_URL.includes('?') ? '&' : '?';
    const wsUrl = TOKEN
      ? `${OPENCLAW_WS_URL}${sep}token=${encodeURIComponent(TOKEN)}`
      : OPENCLAW_WS_URL;

    log('info', 'Connecting to OpenClaw', { url: OPENCLAW_WS_URL });

    this.ws = new WebSocket(wsUrl, {
      headers: {
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        Host: 'localhost',
      },
      handshakeTimeout: 10_000,
    });

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      log('info', 'WebSocket connected');

      // Delay handshake to give the OpenClaw proxy time to establish
      // its internal WebSocket connection to the gateway (race condition fix)
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) return;

        // Send OpenClaw protocol v3 connect handshake
        const connectId = randomUUID();
        const connectFrame = JSON.stringify({
          type: 'req',
          id: connectId,
          method: 'connect',
          params: {
            minProtocol: 1,
            maxProtocol: 3,
            client: {
              id: 'gateway-client',
              version: '1.0.0',
              platform: 'linux',
              mode: 'backend',
            },
            auth: { token: TOKEN },
            scopes: ['operator.write'],
          },
        });

        try {
          this.ws.send(connectFrame);
          log('info', 'Connect handshake sent', { id: connectId });
        } catch (err) {
          log('error', 'Failed to send connect handshake', { error: err.message });
        }
      }, 1000);
    });

    this.ws.on('message', (data) => {
      const raw = data.toString();

      // Check for connect response to mark connection as ready
      if (!this.connected) {
        try {
          const frame = JSON.parse(raw);
          if (frame.type === 'res' && frame.ok !== false) {
            this.connected = true;
            log('info', 'Gateway handshake accepted', { protocol: frame.result?.protocol });
            this._startPing();
            return;
          } else if (frame.type === 'res' && frame.ok === false) {
            log('error', 'Gateway handshake rejected', { error: frame.error });
            return;
          }
        } catch { /* pass through to normal handler */ }
      }

      this._onMessage(raw);
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      this._stopPing();
      log('warn', 'WebSocket closed', { code, reason: reason?.toString() });

      // Reject all in-flight calls
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error(`WebSocket closed (code ${code})`));
      }
      this.pending.clear();

      this._scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      log('error', 'WebSocket error', { error: err.message });
    });
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.ping();
    }, PING_INTERVAL);
  }

  _stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  _scheduleReconnect() {
    const delay = Math.min(
      RECONNECT_BASE * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX,
    );
    this.reconnectAttempt++;
    log('info', 'Reconnecting', { attempt: this.reconnectAttempt, delayMs: delay });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // ---- RPC message handling ----

  _onMessage(raw) {
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      log('warn', 'Non-JSON WS frame', { preview: raw.slice(0, 120) });
      return;
    }

    const id = frame.id;
    if (!id || !this.pending.has(id)) {
      // Unsolicited message — log at debug (could be a broadcast/event)
      log('debug', 'Frame with unknown id', { id, keys: Object.keys(frame) });
      return;
    }

    const entry = this.pending.get(id);
    this.pending.delete(id);
    clearTimeout(entry.timer);

    if (frame.ok === false || frame.error) {
      const errMsg = typeof frame.error === 'string'
        ? frame.error
        : frame.error?.message || JSON.stringify(frame.error) || 'RPC error';
      entry.reject(new Error(errMsg));
      return;
    }

    entry.resolve(frame.result);
  }

  // ---- Public API ----

  /**
   * Make an RPC call to OpenClaw.
   * @param {string} method   — RPC method name (e.g. "chat.completions", "skills.status")
   * @param {object} params   — method parameters
   * @returns {Promise<any>}  — resolves with the "result" field from the response
   */
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected to OpenClaw'));
        return;
      }

      const id = randomUUID();

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RPC timeout (${REQUEST_TIMEOUT}ms) for ${method}`));
        }
      }, REQUEST_TIMEOUT);

      this.pending.set(id, { resolve, reject, timer });

      try {
        const frame = JSON.stringify({ type: 'req', id, method, params });
        this.ws.send(frame);
        log('debug', 'RPC sent', { id, method });
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new Error(`WS send failed: ${err.message}`));
      }
    });
  }

  get isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  get pendingCount() {
    return this.pending.size;
  }

  destroy() {
    this._stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Client destroyed'));
    }
    this.pending.clear();
    if (this.ws) { try { this.ws.terminate(); } catch { /* ignore */ } }
  }
}

// ============================================================
// Response extractors — normalise RPC result → content string
// ============================================================

/**
 * Extract chat content from an RPC result.
 * Handles multiple result shapes:
 *   - OpenAI-like: { choices: [{ message: { content } }], usage }
 *   - Flat fields:  { content } | { response } | { text } | { output } | { message }
 *   - Plain string: "hello"
 */
function extractContent(result) {
  if (result == null) {
    return { content: '', tokensIn: 0, tokensOut: 0 };
  }

  // String result
  if (typeof result === 'string') {
    return { content: result, tokensIn: 0, tokensOut: 0 };
  }

  // OpenAI choices format
  if (result.choices?.[0]?.message?.content !== undefined) {
    return {
      content:  result.choices[0].message.content,
      tokensIn:  result.usage?.prompt_tokens     || 0,
      tokensOut: result.usage?.completion_tokens  || 0,
    };
  }

  // Flat fields (try in priority order)
  const content =
    result.content  ??
    result.response ??
    result.text     ??
    result.output   ??
    result.message  ??
    '';

  if (content) {
    return {
      content: typeof content === 'string' ? content : JSON.stringify(content),
      tokensIn:  result.usage?.prompt_tokens     || result.tokens_in  || 0,
      tokensOut: result.usage?.completion_tokens  || result.tokens_out || 0,
    };
  }

  // Last resort: serialise the whole result
  return { content: JSON.stringify(result), tokensIn: 0, tokensOut: 0 };
}

function estimateTokens(messages) {
  return Math.ceil(
    messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) / 4,
  );
}

// ============================================================
// Express server
// ============================================================

const app = express();
const client = new OpenClawClient();

app.use(express.json({ limit: '2mb' }));

// ---- GET /health ----
app.get('/health', async (_req, res) => {
  let rpcOk = false;

  if (client.isConnected) {
    try {
      await Promise.race([
        client.call('skills.status', {}),
        new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 1500)),
      ]);
      rpcOk = true;
    } catch { /* RPC probe failed — WS may be up but RPC unresponsive */ }
  }

  res.json({
    status:       client.isConnected ? (rpcOk ? 'ok' : 'ws_only') : 'disconnected',
    ws_connected: client.isConnected,
    rpc_ok:       rpcOk,
    uptime:       Math.floor(process.uptime()),
    pending_calls: client.pendingCount,
  });
});

// ---- GET /v1/models ----
app.get('/v1/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [{
      id: 'openclaw',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openclaw',
    }],
  });
});

// ---- POST /v1/chat/completions ----
app.post('/v1/chat/completions', async (req, res) => {
  const start = Date.now();
  const rid = randomUUID();

  try {
    const { messages, max_tokens, temperature, model, stream } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: { message: 'messages array is required', type: 'invalid_request_error' },
      });
    }

    if (stream) {
      return res.status(400).json({
        error: { message: 'Streaming is not supported by this bridge', type: 'invalid_request_error' },
      });
    }

    log('info', 'Chat request', { rid, msgCount: messages.length, method: CHAT_METHOD });

    // ---- RPC call to OpenClaw ----
    const result = await client.call(CHAT_METHOD, {
      messages,
      max_tokens:  max_tokens  || 4096,
      temperature: temperature ?? 0.7,
      model:       model       || 'openclaw',
    });

    const { content, tokensIn, tokensOut } = extractContent(result);
    const latency = Date.now() - start;

    log('info', 'Chat response', { rid, latencyMs: latency, chars: content.length });

    const promptTokens     = tokensIn  || estimateTokens(messages);
    const completionTokens = tokensOut || Math.ceil(content.length / 4);

    // ---- Return OpenAI-compatible JSON ----
    res.json({
      id:      `chatcmpl-${rid}`,
      object:  'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model:   model || 'openclaw',
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens:     promptTokens,
        completion_tokens: completionTokens,
        total_tokens:      promptTokens + completionTokens,
      },
    });
  } catch (err) {
    const latency = Date.now() - start;
    log('error', 'Chat failed', { rid, latencyMs: latency, error: err.message });
    res.status(502).json({
      error: {
        message: `Bridge RPC error: ${err.message}`,
        type:    'bridge_error',
        code:    'openclaw_rpc_failed',
      },
    });
  }
});

// ---- Start ----
app.listen(PORT, () => {
  log('info', 'EDITH Bridge started', { port: PORT, chatMethod: CHAT_METHOD });
  client.connect();
});

// ---- Graceful shutdown ----
function shutdown(sig) {
  log('info', `${sig} received, shutting down`);
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
