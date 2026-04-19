// ============================================================
// Sandbox Routes — Cloud dev environment per user
//
// REST endpoints for creating, managing, and interacting with
// isolated sandbox environments. Requires JWT auth + paid tier.
// ============================================================

import { Router, type Response } from 'express';
import multer from 'multer';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from '../services/cache.js';
import { logActivity } from '../services/activity-log.js';
import { SandboxService } from '../services/sandbox/sandbox-service.js';

export const sandboxRouter = Router();

// ---- Constants ------------------------------------------------

const EXEC_RL_WINDOW_S = 60;
const EXEC_RL_LIMIT = 10;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PLANS = new Set(['monthly', 'halfyear', 'yearly', 'pro', 'team']);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_SIZE } });

// ---- Helpers --------------------------------------------------

function getUserPlan(userId: string): string {
  // Check subscriptions first (authoritative billing source), fall back to users table
  const subRow = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ? AND status = ?')
    .get(userId, 'active') as { plan: string } | undefined;
  if (subRow?.plan) return subRow.plan;
  const userRow = db.prepare('SELECT plan FROM users WHERE id = ?')
    .get(userId) as { plan: string } | undefined;
  return userRow?.plan || 'free';
}

/** Returns plan string if paid, sends 403 and returns null if not. */
function requirePaidTier(req: AuthRequest, res: Response): string | null {
  const plan = getUserPlan(req.userId!);
  if (!ALLOWED_PLANS.has(plan)) {
    res.status(403).json({ error: 'Sandbox requires a paid plan (Monthly or above)', code: 'PLAN_REQUIRED' });
    return null;
  }
  return plan;
}

async function checkExecRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `sandbox:rl:exec:${userId}`;
  try {
    const raw = await cacheGet(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= EXEC_RL_LIMIT) return { allowed: false, remaining: 0 };
    await cacheSet(key, String(count + 1), EXEC_RL_WINDOW_S);
    return { allowed: true, remaining: EXEC_RL_LIMIT - count - 1 };
  } catch {
    return { allowed: true, remaining: EXEC_RL_LIMIT }; // Redis fail = degrade
  }
}

function fail(res: Response, err: unknown, code: string, logMsg: string, userId?: string, status = 500) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error({ err, userId }, logMsg);
  if (!res.headersSent) res.status(status).json({ error: message, code });
}

// ---- POST /create — Create/get sandbox for user ---------------

sandboxRouter.post('/create', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const { template, name } = req.body || {};
    const sandbox = await SandboxService.createOrGet(userId, { template, name });
    logActivity(userId, 'Sandbox created', sandbox.id, 'terminal');
    logger.info({ userId, sandboxId: sandbox.id }, 'Sandbox created/retrieved');
    res.json({ sandbox });
  } catch (err) { fail(res, err, 'SANDBOX_CREATE_FAILED', 'Sandbox create failed', req.userId); }
});

// ---- POST /exec — Execute command in sandbox ------------------

sandboxRouter.post('/exec', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const rl = await checkExecRateLimit(userId);
    if (!rl.allowed) {
      res.status(429).json({ error: `Rate limit exceeded (${EXEC_RL_LIMIT}/min). Try again shortly.`, code: 'RATE_LIMITED' });
      return;
    }
    const { sandboxId, command, cwd } = req.body || {};
    if (!sandboxId || !command) {
      res.status(400).json({ error: 'sandboxId and command are required', code: 'INVALID_INPUT' });
      return;
    }
    const result = await SandboxService.exec(userId, sandboxId, command, cwd);
    logActivity(userId, 'Sandbox exec', command.slice(0, 80), 'terminal');
    res.set('X-RateLimit-Remaining', String(rl.remaining));
    res.json(result);
  } catch (err) { fail(res, err, 'EXEC_FAILED', 'Sandbox exec failed', req.userId); }
});

// ---- GET /stream/:id — SSE stream of terminal output ----------

sandboxRouter.get('/stream/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const sandboxId = req.params.id;

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const cleanup = await SandboxService.streamOutput(userId, sandboxId, (data: string) => {
      res.write(`data: ${JSON.stringify({ output: data })}\n\n`);
    });
    req.on('close', () => { cleanup(); });
  } catch (err) { fail(res, err, 'STREAM_FAILED', 'Sandbox stream failed', req.userId); }
});

// ---- POST /file/write — Write file to sandbox ----------------

sandboxRouter.post('/file/write', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const { sandboxId, path, content } = req.body || {};
    if (!sandboxId || !path || content === undefined) {
      res.status(400).json({ error: 'sandboxId, path, and content are required', code: 'INVALID_INPUT' });
      return;
    }
    await SandboxService.writeFile(userId, sandboxId, path, content);
    logActivity(userId, 'Sandbox file write', path.slice(0, 80), 'file');
    res.json({ ok: true, path });
  } catch (err) { fail(res, err, 'FILE_WRITE_FAILED', 'Sandbox file write failed', req.userId); }
});

// ---- POST /file/read — Read file from sandbox ----------------

sandboxRouter.post('/file/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const { sandboxId, path } = req.body || {};
    if (!sandboxId || !path) {
      res.status(400).json({ error: 'sandboxId and path are required', code: 'INVALID_INPUT' });
      return;
    }
    const result = await SandboxService.readFile(userId, sandboxId, path);
    res.json(result);
  } catch (err) { fail(res, err, 'FILE_READ_FAILED', 'Sandbox file read failed', req.userId); }
});

// ---- GET /file/list — List files in sandbox path --------------

sandboxRouter.get('/file/list', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const sandboxId = req.query.sandboxId as string;
    const dirPath = (req.query.path as string) || '/';
    if (!sandboxId) {
      res.status(400).json({ error: 'sandboxId query param is required', code: 'INVALID_INPUT' });
      return;
    }
    const files = await SandboxService.listFiles(userId, sandboxId, dirPath);
    res.json({ files, path: dirPath });
  } catch (err) { fail(res, err, 'FILE_LIST_FAILED', 'Sandbox file list failed', req.userId); }
});

// ---- POST /file/upload — Upload file (multipart) -------------

sandboxRouter.post('/file/upload', requireAuth, (req: AuthRequest, res, next) => {
  if (!requirePaidTier(req, res)) return;
  next();
}, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { sandboxId, path: destPath } = req.body || {};
    if (!sandboxId || !destPath || !req.file) {
      res.status(400).json({ error: 'sandboxId, path, and file are required', code: 'INVALID_INPUT' });
      return;
    }
    await SandboxService.uploadFile(userId, sandboxId, destPath, req.file.buffer, req.file.originalname);
    logActivity(userId, 'Sandbox file upload', `${req.file.originalname}`, 'upload');
    res.json({ ok: true, path: destPath, size: req.file.size });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
      return;
    }
    fail(res, err, 'FILE_UPLOAD_FAILED', 'Sandbox file upload failed', req.userId);
  }
});

// ---- GET /file/download — Download file from sandbox ----------

sandboxRouter.get('/file/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const sandboxId = req.query.sandboxId as string;
    const filePath = req.query.path as string;
    if (!sandboxId || !filePath) {
      res.status(400).json({ error: 'sandboxId and path query params are required', code: 'INVALID_INPUT' });
      return;
    }
    const { buffer, filename, mimeType } = await SandboxService.downloadFile(userId, sandboxId, filePath);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'Content-Length': String(buffer.length),
    });
    // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write — binary file download with explicit Content-Type + Content-Disposition attachment; not rendered as HTML
    res.send(buffer);
  } catch (err) { fail(res, err, 'FILE_DOWNLOAD_FAILED', 'Sandbox file download failed', req.userId); }
});

// ---- POST /git/clone — Git clone into sandbox -----------------

sandboxRouter.post('/git/clone', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const { sandboxId, repoUrl, branch, destPath } = req.body || {};
    if (!sandboxId || !repoUrl) {
      res.status(400).json({ error: 'sandboxId and repoUrl are required', code: 'INVALID_INPUT' });
      return;
    }
    const result = await SandboxService.gitClone(userId, sandboxId, repoUrl, { branch, destPath });
    logActivity(userId, 'Sandbox git clone', repoUrl.slice(0, 80), 'git');
    res.json(result);
  } catch (err) { fail(res, err, 'GIT_CLONE_FAILED', 'Sandbox git clone failed', req.userId); }
});

// ---- GET /status — Get user's sandbox status ------------------

sandboxRouter.get('/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const status = await SandboxService.getStatus(req.userId!);
    res.json(status);
  } catch (err) { fail(res, err, 'STATUS_FAILED', 'Sandbox status failed', req.userId); }
});

// ---- DELETE /destroy — Destroy user's sandbox -----------------

sandboxRouter.delete('/destroy', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!requirePaidTier(req, res)) return;
    const userId = req.userId!;
    const sandboxId = (req.query.sandboxId || req.body?.sandboxId) as string;
    if (!sandboxId) {
      res.status(400).json({ error: 'sandboxId is required', code: 'INVALID_INPUT' });
      return;
    }
    await SandboxService.destroy(userId, sandboxId);
    logActivity(userId, 'Sandbox destroyed', sandboxId, 'trash');
    logger.info({ userId, sandboxId }, 'Sandbox destroyed');
    res.json({ ok: true });
  } catch (err) { fail(res, err, 'DESTROY_FAILED', 'Sandbox destroy failed', req.userId); }
});

// ---- GET /health — Sandbox system health ----------------------

sandboxRouter.get('/health', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const health = await SandboxService.health();
    res.status(health.ok ? 200 : 503).json(health);
  } catch (err) { fail(res, err, 'HEALTH_CHECK_FAILED', 'Sandbox health check failed', undefined, 503); }
});
