// ============================================================
// Gate API — Public REST API for external developers
//
// Auth: Authorization: Bearer agtn_<32hex>
// Response: always { success: true, data: {...} } or { success: false, error: "..." }
// Rate limit: 60 req/min per key (Redis sliding window)
// ============================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from '../services/cache.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { runReactLoop } from '../services/react-loop.js';
import { generateImage } from '../services/media-generation.js';
import { OPENCLAW_IDENTITY_COMPACT } from '../prompts/openclaw-system.js';
import type { ChatMessage } from '../services/llm.js';

export const gateRouter = Router();

// ── Types ───────────────────────────────────────────────────

interface GateRequest extends Request {
  gateUserId?: string;
  gateKeyId?: string;
}

// ── Helpers ─────────────────────────────────────────────────

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function gateOk(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function gateErr(res: Response, error: string, status = 400): void {
  res.status(status).json({ success: false, error });
}

// ── Gate key auth middleware ─────────────────────────────────

async function requireGateKey(req: GateRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer agtn_')) {
    gateErr(res, 'Missing or invalid Gate API key. Use: Authorization: Bearer agtn_...', 401);
    return;
  }

  const key = authHeader.slice('Bearer '.length);
  const keyHash = hashKey(key);

  const row = db.prepare(
    'SELECT id, user_id FROM gate_api_keys WHERE key_hash = ? AND is_active = 1'
  ).get(keyHash) as { id: string; user_id: string } | undefined;

  if (!row) {
    gateErr(res, 'Invalid or revoked API key', 401);
    return;
  }

  // Rate limiting: 60 req/min per key using Redis sliding window
  const rateKey = `gate:rate:${row.id}`;
  const countStr = await cacheGet(rateKey);
  const count = countStr ? parseInt(countStr, 10) : 0;
  if (count >= 60) {
    gateErr(res, 'Rate limit exceeded: 60 requests per minute', 429);
    return;
  }
  await cacheSet(rateKey, String(count + 1), 60);

  // Update last_used_at (non-blocking fire-and-forget)
  try {
    db.prepare("UPDATE gate_api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
  } catch { /* non-fatal */ }

  req.gateUserId = row.user_id;
  req.gateKeyId = row.id;
  next();
}

// ── Key management (requires dashboard JWT auth) ─────────────

// POST /api/gate/v1/keys — create a new Gate API key
gateRouter.post('/keys', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!;
  const bodyLabel = (req.body as { label?: unknown }).label;
  const label = typeof bodyLabel === 'string' ? bodyLabel.trim() : 'My API Key';

  if (label.length > 100) {
    gateErr(res, 'label must be 100 characters or fewer');
    return;
  }

  const count = (db.prepare(
    'SELECT COUNT(*) as c FROM gate_api_keys WHERE user_id = ? AND is_active = 1'
  ).get(userId) as { c: number }).c;

  if (count >= 5) {
    gateErr(res, 'Maximum 5 active API keys allowed. Delete an existing key first.');
    return;
  }

  const rawKey = `agtn_${randomBytes(16).toString('hex')}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO gate_api_keys (id, user_id, label, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, label, keyHash, keyPrefix, now);

  logger.info({ userId, keyId: id }, 'gate:key:created');
  gateOk(res, { id, label, key: rawKey, keyPrefix, createdAt: now }, 201);
});

// GET /api/gate/v1/keys — list user's Gate keys (no plaintext key)
gateRouter.get('/keys', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!;
  const rows = db.prepare(
    'SELECT id, label, key_prefix, created_at, last_used_at, is_active FROM gate_api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as Array<{
    id: string; label: string; key_prefix: string;
    created_at: string; last_used_at: string | null; is_active: number;
  }>;

  gateOk(res, {
    keys: rows.map(r => ({
      id: r.id,
      label: r.label,
      keyPrefix: r.key_prefix,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      isActive: r.is_active === 1,
    })),
  });
});

// DELETE /api/gate/v1/keys/:id — soft-delete (deactivate) a key
gateRouter.delete('/keys/:id', requireAuth, (req: AuthRequest, res: Response): void => {
  const userId = req.userId!;
  const { id } = req.params;

  const row = db.prepare(
    'SELECT id FROM gate_api_keys WHERE id = ? AND user_id = ?'
  ).get(id, userId) as { id: string } | undefined;

  if (!row) {
    gateErr(res, 'Key not found', 404);
    return;
  }

  db.prepare('UPDATE gate_api_keys SET is_active = 0 WHERE id = ?').run(id);
  logger.info({ userId, keyId: id }, 'gate:key:revoked');
  gateOk(res, { revoked: true });
});

// ── Public API endpoints (Gate key auth) ─────────────────────

// GET /api/gate/v1/usage — credits and plan info
gateRouter.get('/usage', requireGateKey, (req: GateRequest, res: Response): void => {
  const userId = req.gateUserId!;
  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number } | undefined;
  const sub = db.prepare(
    'SELECT plan, credits_remaining, monthly_credits FROM subscriptions WHERE user_id = ?'
  ).get(userId) as { plan: string; credits_remaining: number; monthly_credits: number } | undefined;

  gateOk(res, {
    plan: sub?.plan ?? 'free',
    creditsRemaining: sub?.credits_remaining ?? user?.credits ?? 0,
    monthlyCredits: sub?.monthly_credits ?? 100,
    walletCredits: user?.credits ?? 0,
  });
});

// GET /api/gate/v1/models — list available free models in routing waterfall
gateRouter.get('/models', requireGateKey, (_req: GateRequest, res: Response): void => {
  const rows = db.prepare(
    `SELECT id, display_name, provider, context_length, status, curated
     FROM free_models WHERE status IN ('active', 'new')
     ORDER BY curated DESC, context_length DESC LIMIT 50`
  ).all() as Array<{
    id: string; display_name: string; provider: string;
    context_length: number; status: string; curated: number;
  }>;

  gateOk(res, {
    models: rows.map(r => ({
      id: r.id,
      displayName: r.display_name,
      provider: r.provider,
      contextLength: r.context_length,
      status: r.status,
      curated: r.curated === 1,
    })),
    totalCount: rows.length,
  });
});

// POST /api/gate/v1/chat — send a message, get agent response
gateRouter.post('/chat', requireGateKey, async (req: GateRequest, res: Response): Promise<void> => {
  const userId = req.gateUserId!;
  const body = req.body as { message?: unknown; history?: unknown; system_prompt?: unknown };

  const message = body.message;
  if (typeof message !== 'string' || !message.trim()) {
    gateErr(res, 'message is required and must be a non-empty string');
    return;
  }
  if (message.length > 10000) {
    gateErr(res, 'message too long (max 10000 chars)');
    return;
  }

  type HistoryItem = { role: string; content: string };
  const history = Array.isArray(body.history)
    ? (body.history as HistoryItem[])
        .filter((h): h is HistoryItem => typeof h?.role === 'string' && typeof h?.content === 'string')
        .slice(-20)
    : [];

  const messages: ChatMessage[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  const systemPrompt = typeof body.system_prompt === 'string'
    ? body.system_prompt.slice(0, 2000)
    : OPENCLAW_IDENTITY_COMPACT;

  try {
    const result = await runReactLoop(messages, { systemPrompt, userId });

    if (result.creditCost > 0) {
      db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
      db.prepare('UPDATE subscriptions SET credits_remaining = MAX(0, credits_remaining - ?) WHERE user_id = ?').run(result.creditCost, userId);
    }

    gateOk(res, {
      text: result.text,
      provider: result.provider,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      creditCost: result.creditCost,
      actions: result.actions.map(a => ({ tool: a.tool, success: a.success, message: a.message })),
    });
  } catch (err) {
    logger.error({ err, userId }, 'gate:chat:error');
    gateErr(res, 'Chat request failed. Please try again.', 500);
  }
});

// POST /api/gate/v1/image — generate an image
gateRouter.post('/image', requireGateKey, async (req: GateRequest, res: Response): Promise<void> => {
  const userId = req.gateUserId!;
  const body = req.body as { prompt?: unknown; width?: unknown; height?: unknown };

  const prompt = body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    gateErr(res, 'prompt is required and must be a non-empty string');
    return;
  }
  if (prompt.length > 1000) {
    gateErr(res, 'prompt too long (max 1000 chars)');
    return;
  }

  const width = typeof body.width === 'number' ? Math.min(2048, Math.max(256, body.width)) : 1024;
  const height = typeof body.height === 'number' ? Math.min(2048, Math.max(256, body.height)) : 1024;

  try {
    const result = await generateImage(prompt, { width, height });
    if (!result.success) {
      gateErr(res, result.error ?? 'Image generation failed', 500);
      return;
    }

    const IMAGE_CREDIT_COST = 5;
    db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(IMAGE_CREDIT_COST, userId);
    db.prepare('UPDATE subscriptions SET credits_remaining = MAX(0, credits_remaining - ?) WHERE user_id = ?').run(IMAGE_CREDIT_COST, userId);

    gateOk(res, {
      url: result.url,
      provider: result.provider,
      prompt,
      width,
      height,
      creditCost: IMAGE_CREDIT_COST,
    });
  } catch (err) {
    logger.error({ err, userId }, 'gate:image:error');
    gateErr(res, 'Image generation failed. Please try again.', 500);
  }
});
