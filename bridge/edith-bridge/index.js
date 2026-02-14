// ============================================================
// EDITH Bridge — WebSocket ↔ HTTP bridge for OpenClaw
//
// Connects to OpenClaw via WebSocket (ws://...:18789)
// Exposes OpenAI-compatible HTTP endpoints so that GeekSpace's
// edith.ts can call it exactly like any OpenAI provider.
//
// Endpoints:
//   POST /v1/chat/completions  — chat (forwards via WS)
//   GET  /v1/models            — model list
//   GET  /health               — liveness / WS status
// ============================================================

import express from 'express';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

// ---- Configuration (no defaults that leak secrets) ----

const PORT             = parseInt(process.env.BRIDGE_PORT || '8787', 10);
const OPENCLAW_WS_URL  = process.env.EDITH_OPENCLAW_WS || 'ws://host.docker.internal:18789';
const TOKEN            = process.env.EDITH_TOKEN || '';
const REQUEST_TIMEOUT  = parseInt(process.env.REQUEST_TIMEOUT_MS || '120000', 10);
const IDLE_TIMEOUT     = parseInt(process.env.IDLE_TIMEOUT_MS || '5000', 10);
const RECONNECT_BASE   = 1000;   // 1 s
const RECONNECT_MAX    = 30000;  // 30 s
const PING_INTERVAL    = 30000;  // 30 s

// ---- Structured logger (never logs tokens/secrets) ----

function log(level, msg, meta = {}) {
  if (level === 'debug' && process.env.LOG_LEVEL !== 'debug') return;
  const entry = { time: new Date().toISOString(), level, msg, ...meta };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(entry));
}

// ============================================================
// WebSocket client — persistent connection with reconnect
// ============================================================

class OpenClawClient {
  constructor() {
    /** @type {WebSocket|null} */
    this.ws = null;
    this.connected = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;

    // Current in-flight request
    /** @type {{ resolve: Function, reject: Function, timer: any, idleTimer: any, chunks: string[] } | null} */
    this.pending = null;

    // Queued requests waiting for the current one to finish
    /** @type {{ payload: object, resolve: Function, reject: Function }[]} */
    this.queue = [];
  }

  // ---- Connection lifecycle ----

  connect() {
    if (this.ws) {
      try { this.ws.terminate(); } catch { /* ignore */ }
    }

    // Build WS URL — pass token as query param AND header (cover both patterns)
    const sep = OPENCLAW_WS_URL.includes('?') ? '&' : '?';
    const wsUrl = TOKEN
      ? `${OPENCLAW_WS_URL}${sep}token=${encodeURIComponent(TOKEN)}`
      : OPENCLAW_WS_URL;

    log('info', 'Connecting to OpenClaw', { url: OPENCLAW_WS_URL });

    this.ws = new WebSocket(wsUrl, {
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
      handshakeTimeout: 10_000,
    });

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectAttempt = 0;
      log('info', 'WebSocket connected');
      this._startPing();
      this._drainQueue();
    });

    this.ws.on('message', (data) => this._onMessage(data.toString()));

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      this._stopPing();
      log('warn', 'WebSocket closed', { code, reason: reason?.toString() });

      // If a request was in-flight, resolve with whatever we have or reject
      if (this.pending) {
        if (this.pending.chunks.length > 0) {
          this._completePending();
        } else {
          this._rejectPending(new Error(`WebSocket closed (code ${code})`));
        }
      }

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

  // ---- Message handling ----

  _onMessage(raw) {
    if (!this.pending) {
      log('debug', 'Message received with no pending request');
      return;
    }

    // Reset idle timer on every message
    if (this.pending.idleTimer) clearTimeout(this.pending.idleTimer);

    const trimmed = raw.trim();

    // ---- Streaming completion signals ----
    if (trimmed === '[DONE]' || trimmed === 'data: [DONE]') {
      this._completePending();
      return;
    }

    // Strip SSE "data: " prefix if present
    let cleaned = trimmed;
    if (cleaned.startsWith('data: ')) cleaned = cleaned.slice(6);

    this.pending.chunks.push(cleaned);

    // ---- Detect complete (non-streaming) response ----
    try {
      const parsed = JSON.parse(cleaned);
      if (
        parsed.choices?.[0]?.finish_reason ||
        parsed.choices?.[0]?.message?.content !== undefined ||
        parsed.content !== undefined ||
        parsed.response !== undefined ||
        parsed.text !== undefined ||
        parsed.output !== undefined
      ) {
        this._completePending();
        return;
      }
    } catch { /* not JSON or partial — that's fine */ }

    // If we haven't detected completion, wait for more data or idle timeout
    this.pending.idleTimer = setTimeout(() => this._completePending(), IDLE_TIMEOUT);
  }

  // ---- Request lifecycle ----

  _completePending() {
    if (!this.pending) return;
    const { resolve, timer, idleTimer, chunks } = this.pending;
    clearTimeout(timer);
    if (idleTimer) clearTimeout(idleTimer);
    this.pending = null;
    resolve(chunks);
    this._drainQueue();
  }

  _rejectPending(err) {
    if (!this.pending) return;
    const { reject, timer, idleTimer } = this.pending;
    clearTimeout(timer);
    if (idleTimer) clearTimeout(idleTimer);
    this.pending = null;
    reject(err);
    this._drainQueue();
  }

  _drainQueue() {
    if (this.queue.length === 0 || this.pending || !this.connected) return;
    const next = this.queue.shift();
    this._dispatch(next.payload, next.resolve, next.reject);
  }

  _dispatch(payload, resolve, reject) {
    const timer = setTimeout(() => {
      if (!this.pending) return;
      if (this.pending.chunks.length > 0) {
        this._completePending();
      } else {
        this._rejectPending(new Error(`Request timed out (${REQUEST_TIMEOUT}ms)`));
      }
    }, REQUEST_TIMEOUT);

    this.pending = { resolve, reject, timer, idleTimer: null, chunks: [] };

    try {
      this.ws.send(JSON.stringify(payload));
      log('debug', 'Request sent to OpenClaw');
    } catch (err) {
      this._rejectPending(new Error(`WS send failed: ${err.message}`));
    }
  }

  /**
   * Send a request payload and wait for the response.
   * Returns an array of raw response chunks (strings).
   * Rejects immediately if WS is not connected.
   */
  send(payload) {
    return new Promise((resolve, reject) => {
      if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected to OpenClaw'));
        return;
      }
      if (this.pending) {
        this.queue.push({ payload, resolve, reject });
        return;
      }
      this._dispatch(payload, resolve, reject);
    });
  }

  get isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  destroy() {
    this._stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pending) this._rejectPending(new Error('Client destroyed'));
    for (const q of this.queue) q.reject(new Error('Client destroyed'));
    this.queue = [];
    if (this.ws) { try { this.ws.terminate(); } catch { /* ignore */ } }
  }
}

// ============================================================
// Response parser — handles many OpenClaw response formats
// ============================================================

function parseChunks(chunks) {
  if (chunks.length === 0) {
    return { content: '', tokensIn: 0, tokensOut: 0 };
  }

  // --- Single-frame response ---
  if (chunks.length === 1) {
    try {
      return extractJSON(JSON.parse(chunks[0]));
    } catch {
      // Plain text response
      return { content: chunks[0], tokensIn: 0, tokensOut: 0 };
    }
  }

  // --- Multi-frame (streaming) response ---
  let content = '';
  let tokensIn = 0;
  let tokensOut = 0;

  for (const chunk of chunks) {
    try {
      const d = JSON.parse(chunk);
      if (d.choices?.[0]?.delta?.content)        content += d.choices[0].delta.content;
      else if (d.choices?.[0]?.message?.content)  content += d.choices[0].message.content;
      else if (d.content)                         content += d.content;
      else if (d.response)                        content += d.response;
      else if (d.text)                            content += d.text;
      else if (d.output)                          content += d.output;
      if (d.usage) {
        tokensIn  = d.usage.prompt_tokens      || tokensIn;
        tokensOut = d.usage.completion_tokens   || tokensOut;
      }
    } catch {
      content += chunk; // plain text chunk
    }
  }

  if (!content) content = chunks.join('');
  return { content, tokensIn, tokensOut };
}

function extractJSON(data) {
  const content =
    data.choices?.[0]?.message?.content ??
    data.choices?.[0]?.delta?.content ??
    data.content ??
    data.response ??
    data.text ??
    data.output ??
    (typeof data === 'string' ? data : '');
  return {
    content,
    tokensIn:  data.usage?.prompt_tokens     || 0,
    tokensOut: data.usage?.completion_tokens  || 0,
  };
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
app.get('/health', (_req, res) => {
  res.json({
    status: client.isConnected ? 'ok' : 'degraded',
    ws_connected: client.isConnected,
    uptime: Math.floor(process.uptime()),
    queue_depth: client.queue.length,
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

    log('info', 'Request received', { rid, msgCount: messages.length });

    const chunks = await client.send({
      messages,
      max_tokens:  max_tokens  || 4096,
      temperature: temperature ?? 0.7,
      model:       model       || 'openclaw',
    });

    const { content, tokensIn, tokensOut } = parseChunks(chunks);
    const latency = Date.now() - start;

    log('info', 'Response ready', { rid, latencyMs: latency, chars: content.length });

    const promptTokens     = tokensIn  || estimateTokens(messages);
    const completionTokens = tokensOut || Math.ceil(content.length / 4);

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
    log('error', 'Request failed', { rid, latencyMs: latency, error: err.message });
    res.status(502).json({
      error: {
        message: 'Bridge could not reach OpenClaw',
        type:    'bridge_error',
        code:    'openclaw_unavailable',
      },
    });
  }
});

// ---- Start ----
app.listen(PORT, () => {
  log('info', 'EDITH Bridge started', { port: PORT });
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
