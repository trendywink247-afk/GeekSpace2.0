// ============================================================
// Admin Dashboard API — private endpoint for Mission Control
// Auth: X-Admin-Password header checked against env var
//       or Authorization: Bearer <ADMIN_TOKEN> header
// ============================================================

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getMetricsSnapshot } from '../middleware/metrics.js';
import { logger } from '../logger.js';
import { cacheGet } from '../services/cache.js';
import { eventBus } from '../services/event-bus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cache the admin dashboard HTML in memory (read once at startup)
let adminDashboardHtml: string | null = null;
function getAdminDashboardHtml(): string | null {
  if (adminDashboardHtml) return adminDashboardHtml;
  try {
    const htmlPath = path.join(__dirname, '../../../admin-dashboard/index.html');
    adminDashboardHtml = readFileSync(htmlPath, 'utf-8');
    return adminDashboardHtml;
  } catch {
    return null;
  }
}

export const adminRouter = Router();

// ---- Password middleware (legacy X-Admin-Password) ----
function requireAdminPassword(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminDashboardPassword) {
    res.status(503).json({ error: 'Admin dashboard not configured' });
    return;
  }
  const provided = req.headers['x-admin-password'] as string;
  if (!provided || provided !== config.adminDashboardPassword) {
    res.status(401).json({ error: 'Invalid admin password' });
    return;
  }
  next();
}

// ---- Bearer token middleware (new ADMIN_TOKEN) ----
function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(503).json({ error: 'Admin token not configured' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== config.adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  next();
}

// ---- /health endpoint ----
adminRouter.get('/health', requireAdminToken, async (_req: Request, res: Response): Promise<void> => {
  // DB check
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    dbOk = row?.ok === 1;
  } catch { /* db not ready */ }

  // Redis check — cacheGet swallows errors so use ping via raw fetch to redis URL
  // Simpler: if REDIS_URL is set, attempt cacheGet and treat reaching it as "ok"
  let redisOk = false;
  if (process.env.REDIS_URL) {
    try {
      await cacheGet('__admin_ping__');
      // If we get here without throwing, redis client is available
      redisOk = true;
    } catch {
      redisOk = false;
    }
  }

  // Ollama check (2s timeout)
  let ollamaOk = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    ollamaOk = r.ok;
  } catch { /* unreachable */ }

  // PicoClaw check (2s timeout)
  let picoOk = false;
  if (config.picoClawEnabled && config.picoClawUrl) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch(`${config.picoClawUrl}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      picoOk = r.ok;
    } catch { /* unreachable */ }
  }

  res.json({
    timestamp: new Date().toISOString(),
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'down',
    ollama: ollamaOk ? 'ok' : 'down',
    picoclaw: config.picoClawEnabled ? (picoOk ? 'ok' : 'down') : 'not_configured',
  });
});

// ---- /stats endpoint ----
adminRouter.get('/stats', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

    const activeAgents = (db.prepare('SELECT COUNT(*) as c FROM agent_configs').get() as { c: number }).c;

    let tasksRunning = 0;
    let tasksToday = 0;
    let completedToday = 0;
    try {
      tasksRunning = (db.prepare(
        "SELECT COUNT(*) as c FROM pico_tasks WHERE status IN ('queued', 'running')"
      ).get() as { c: number }).c;

      tasksToday = (db.prepare(
        "SELECT COUNT(*) as c FROM pico_tasks WHERE created_at >= date('now')"
      ).get() as { c: number }).c;

      completedToday = (db.prepare(
        "SELECT COUNT(*) as c FROM pico_tasks WHERE status = 'completed' AND completed_at >= date('now')"
      ).get() as { c: number }).c;
    } catch { /* pico_tasks table may not exist */ }

    res.json({
      totalUsers,
      activeAgents,
      tasksRunning,
      tasksToday,
      completedToday,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Admin stats query failed');
    res.status(500).json({ error: 'Stats query failed' });
  }
});

// ---- /tasks endpoint (paginated) ----
adminRouter.get('/tasks', requireAdminToken, (req: Request, res: Response): void => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const offset = parseInt(String(req.query.offset || '0'), 10);

    let tasks: unknown[] = [];
    let total = 0;
    try {
      tasks = db.prepare(
        `SELECT pt.id, pt.user_id, u.username, pt.agent_slot, pt.agent_name,
                pt.task_type, pt.description, pt.status, pt.result,
                pt.planned_by, pt.created_at, pt.started_at, pt.completed_at
         FROM pico_tasks pt
         LEFT JOIN users u ON u.id = pt.user_id
         ORDER BY pt.created_at DESC
         LIMIT ? OFFSET ?`
      ).all(limit, offset);

      total = (db.prepare('SELECT COUNT(*) as c FROM pico_tasks').get() as { c: number }).c;
    } catch { /* pico_tasks table may not exist */ }

    res.json({ tasks, total, limit, offset });
  } catch (err) {
    logger.error({ err }, 'Admin tasks query failed');
    res.status(500).json({ error: 'Tasks query failed' });
  }
});

// ---- /stream endpoint (SSE) — accepts token via Authorization header OR ?token= query param ----
adminRouter.get('/stream', (req: Request, res: Response): void => {
  // Allow token via query param for EventSource (browsers can't set headers)
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = headerToken || queryToken;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connected event
  res.write('data: {"type":"connected"}\n\n');

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Listen for pico task events
  const onPicoTask = (data: unknown) => {
    res.write(`data: ${JSON.stringify({ type: 'pico:task', payload: data })}\n\n`);
  };
  eventBus.on('pico:task', onPicoTask);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('pico:task', onPicoTask);
  });
});

// ---- Main dashboard endpoint (legacy) ----
adminRouter.get('/dashboard', requireAdminPassword, (_req: Request, res: Response) => {
  try {
    // -- User analytics --
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const todayUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now')").get() as { c: number }).c;
    const weekUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-7 days')").get() as { c: number }).c;
    const monthUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-30 days')").get() as { c: number }).c;

    // Auth provider breakdown (future-ready)
    const byProvider: Record<string, number> = { email: totalUsers, google: 0, facebook: 0, mobile: 0 };

    // Active sessions (users with usage in last 30 min)
    const activeSessions = (db.prepare(
      "SELECT COUNT(DISTINCT user_id) as c FROM usage_events WHERE created_at >= datetime('now', '-30 minutes')"
    ).get() as { c: number }).c;

    // -- Onboarding funnel --
    const funnelRows = db.prepare(
      'SELECT onboarding_step, COUNT(*) as c FROM users GROUP BY onboarding_step ORDER BY onboarding_step'
    ).all() as { onboarding_step: number; c: number }[];

    const completedCount = (db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE onboarding_completed = 1'
    ).get() as { c: number }).c;

    // Build funnel: [signed_up, step1, step2, step3, step4, step5, completed]
    const funnel = [totalUsers, 0, 0, 0, 0, 0, completedCount];
    for (const row of funnelRows) {
      if (row.onboarding_step >= 1 && row.onboarding_step <= 5) {
        for (let i = 1; i <= row.onboarding_step; i++) {
          funnel[i] += row.c;
        }
      }
      if (row.onboarding_step === 6) {
        for (let i = 1; i <= 5; i++) funnel[i] += row.c;
      }
    }

    // Stuck users
    const stuckUsers = db.prepare(
      "SELECT id, username, email, onboarding_step, created_at FROM users WHERE onboarding_completed = 0 AND created_at < datetime('now', '-1 hour') ORDER BY created_at DESC LIMIT 20"
    ).all() as { id: string; username: string; email: string; onboarding_step: number; created_at: string }[];

    // -- System metrics --
    const metrics = getMetricsSnapshot();

    // -- Recent usage events --
    const recentEvents = db.prepare(
      'SELECT id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at FROM usage_events ORDER BY created_at DESC LIMIT 50'
    ).all() as { id: string; user_id: string; provider: string; model: string; tokens_in: number; tokens_out: number; cost_usd: number; channel: string; tool: string; created_at: string }[];

    // Resolve usernames
    const userIds = [...new Set(recentEvents.map(e => e.user_id))];
    const userMap: Record<string, string> = {};
    for (const uid of userIds) {
      const u = db.prepare('SELECT username FROM users WHERE id = ?').get(uid) as { username: string } | undefined;
      if (u) userMap[uid] = u.username;
    }

    const recentLogs = recentEvents.map(e => ({
      ...e,
      username: userMap[e.user_id] || 'unknown',
    }));

    // -- Billing --
    const creditsToday = (db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as c FROM usage_events WHERE created_at >= date('now')"
    ).get() as { c: number }).c;

    const creditsWeek = (db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as c FROM usage_events WHERE created_at >= date('now', '-7 days')"
    ).get() as { c: number }).c;

    const topConsumers = db.prepare(
      "SELECT u.username, SUM(ue.cost_usd) as total_credits FROM usage_events ue JOIN users u ON u.id = ue.user_id WHERE ue.created_at >= date('now', '-7 days') GROUP BY ue.user_id ORDER BY total_credits DESC LIMIT 10"
    ).all() as { username: string; total_credits: number }[];

    const planDistribution = db.prepare(
      'SELECT plan, COUNT(*) as count FROM subscriptions GROUP BY plan'
    ).all() as { plan: string; count: number }[];

    // -- Signup timeline (30 days) --
    const signupTimeline = db.prepare(
      "SELECT date(created_at) as day, COUNT(*) as count FROM users WHERE created_at >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY day"
    ).all() as { day: string; count: number }[];

    // -- Top endpoints --
    const topEndpoints = Object.entries(metrics.endpoints)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        errors: stats.errors,
        avgMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      }));

    res.json({
      timestamp: new Date().toISOString(),
      users: { total: totalUsers, today: todayUsers, week: weekUsers, month: monthUsers, byProvider, activeSessions },
      onboarding: { funnel, stuckUsers },
      system: { uptime: metrics.uptime, memoryMb: metrics.memoryMb },
      metrics: {
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        avgLatencyMs: metrics.avgLatencyMs,
        requestsPerMinute: metrics.requestsPerMinute,
        activeConnections: metrics.activeConnections,
        windowStart: metrics.windowStart,
      },
      topEndpoints,
      recentLogs,
      billing: { creditsToday, creditsWeek, topConsumers, planDistribution },
      signupTimeline,
    });
  } catch (err) {
    logger.error({ err }, 'Admin dashboard query failed');
    res.status(500).json({ error: 'Dashboard query failed' });
  }
});


// ---- /users endpoint (paginated user list) ----
adminRouter.get('/users', requireAdminToken, (req: Request, res: Response): void => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const offset = (page - 1) * limit;

    const users = db.prepare(
      `SELECT u.id, u.username, u.email, u.created_at, u.plan,
              COALESCE(s.plan, u.plan, 'free') AS subscription_plan,
              s.credits_remaining, s.monthly_credits
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset) as {
      id: string; username: string; email: string; created_at: string;
      plan: string; subscription_plan: string;
      credits_remaining: number | null; monthly_credits: number | null;
    }[];

    const total = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

    res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error({ err }, 'Admin users query failed');
    res.status(500).json({ error: 'Users query failed' });
  }
});

// ---- /usage endpoint (aggregate LLM usage stats) ----
adminRouter.get('/usage', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    // Total tokens + cost
    const totals = db.prepare(
      `SELECT
         COALESCE(SUM(tokens_in), 0) AS total_tokens_in,
         COALESCE(SUM(tokens_out), 0) AS total_tokens_out,
         COALESCE(SUM(cost_usd), 0) AS total_cost_usd
       FROM usage_events`
    ).get() as { total_tokens_in: number; total_tokens_out: number; total_cost_usd: number };

    // Breakdown by provider
    const byProvider = db.prepare(
      `SELECT provider,
         COUNT(*) AS event_count,
         COALESCE(SUM(tokens_in), 0) AS tokens_in,
         COALESCE(SUM(tokens_out), 0) AS tokens_out,
         COALESCE(SUM(cost_usd), 0) AS cost_usd
       FROM usage_events
       GROUP BY provider
       ORDER BY cost_usd DESC`
    ).all() as { provider: string; event_count: number; tokens_in: number; tokens_out: number; cost_usd: number }[];

    // Top 10 users by usage cost
    const topUsers = db.prepare(
      `SELECT u.username,
         COUNT(ue.id) AS event_count,
         COALESCE(SUM(ue.tokens_in + ue.tokens_out), 0) AS total_tokens,
         COALESCE(SUM(ue.cost_usd), 0) AS total_cost_usd
       FROM usage_events ue
       JOIN users u ON u.id = ue.user_id
       GROUP BY ue.user_id
       ORDER BY total_cost_usd DESC
       LIMIT 10`
    ).all() as { username: string; event_count: number; total_tokens: number; total_cost_usd: number }[];

    res.json({
      timestamp: new Date().toISOString(),
      totals,
      byProvider,
      topUsers,
    });
  } catch (err) {
    logger.error({ err }, 'Admin usage query failed');
    res.status(500).json({ error: 'Usage query failed' });
  }
});


// ---- /audit endpoint (cross-user activity log) ----
adminRouter.get('/audit', requireAdminToken, (req: Request, res: Response): void => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10)));

    const entries = db.prepare(
      `SELECT al.id, al.user_id, u.username, al.action, al.details, al.icon, al.created_at
       FROM activity_log al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT ?`
    ).all(limit) as {
      id: string;
      user_id: string;
      username: string | null;
      action: string;
      details: string;
      icon: string;
      created_at: string;
    }[];

    res.json({ entries, total: entries.length, limit });
  } catch (err) {
    logger.error({ err }, 'Admin audit query failed');
    res.status(500).json({ error: 'Audit query failed' });
  }
});

// ---- serveAdminDashboard — GET /admin (HTML page) ----
export function serveAdminDashboard(_req: Request, res: Response): void {
  // Admin dashboard is a standalone HTML file with inline scripts.
  // Override Helmet's strict CSP for this route only — the page is already
  // protected by admin password/token auth so unsafe-inline is acceptable here.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
  );

  // Serve the comprehensive standalone admin dashboard HTML file
  const html = getAdminDashboardHtml();
  if (html) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
    return;
  }

  // Fallback: file not found — serve minimal redirect to login
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>GeekSpace Admin</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#05050A;color:#F4F6FF;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh}
.c{background:#0B0B10;border:1px solid #7B61FF40;border-radius:12px;padding:40px;width:360px}h1{font-size:1.5rem;margin-bottom:8px}
p{color:#A7ACB8;font-size:.875rem;margin-bottom:24px}input{width:100%;padding:10px 14px;background:#05050A;border:1px solid #7B61FF40;border-radius:8px;color:#F4F6FF;font-size:.875rem;margin-bottom:12px}
input:focus{outline:none;border-color:#7B61FF}button{width:100%;padding:10px;background:#7B61FF;border:none;border-radius:8px;color:#fff;font-size:.875rem;font-weight:600;cursor:pointer}
button:hover{background:#6B51EF}.e{color:#FF6161;font-size:.8rem;margin-top:8px;display:none}</style></head>
<body><div class="c"><h1>GeekSpace Admin</h1><p>Admin dashboard file not found. Check deployment.</p></div></body></html>`);
}
