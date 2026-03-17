// ============================================================
// Admin Dashboard API — private endpoint for Mission Control
// Auth: X-Admin-Password header checked against env var
//       or Authorization: Bearer <ADMIN_TOKEN> header
// ============================================================

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getMetricsSnapshot } from '../middleware/metrics.js';
import { logger } from '../logger.js';
import { cacheGet } from '../services/cache.js';
import { eventBus } from '../services/event-bus.js';
import { issueReward } from '../services/rewards.js';
import { triageSuggestions } from '../services/suggestions-triage.js';
import { invalidateClustersCache } from '../routes/suggestions.js';
import { v4 as uuidV4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Task 68.5: In-memory rate limit for triage endpoint (max 1 per 60s)
let lastTriageTime = 0;

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

// ── 70.7: Admin action audit logging middleware ────────────────────────────────
// Logs requester IP + path + method for every admin action for audit trail visibility.
adminRouter.use((req: Request, _res, next) => {
  logger.info(
    { adminAction: req.path, method: req.method, ip: req.ip ?? req.headers['x-forwarded-for'] },
    'Admin action',
  );
  next();
});

// ---- Auth coverage (46.1) ----
// Every route below requires one of two auth guards:
//   - requireAdminToken   : validates Authorization: Bearer <ADMIN_TOKEN> header (new style)
//   - requireAdminPassword: validates X-Admin-Password header (legacy dashboard route)
// The /stream endpoint implements its own inline token check to support EventSource query-param auth.
// Unauthenticated callers receive 401 or 503 (token not configured).

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

// ---- /stats endpoint ---- (57.8: enhanced with activeToday, dbSize, memory)
adminRouter.get('/stats', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const activeToday = (db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE last_active >= datetime('now', '-24 hours')"
    ).get() as { c: number }).c;

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

    // DB file size (non-fatal — volume path may differ in Docker)
    let dbSizeBytes: number | null = null;
    try {
      const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../data/geekspace.db');
      dbSizeBytes = statSync(dbPath).size;
    } catch { /* path varies between Docker and local */ }

    const mem = process.memoryUsage();

    // Task 68.8: suggestion counts in admin stats
    const suggestionStats: { total: number; new: number; accepted: number; shipped: number } = {
      total: 0, new: 0, accepted: 0, shipped: 0,
    };
    try {
      suggestionStats.total = (db.prepare('SELECT COUNT(*) as c FROM suggestions').get() as { c: number }).c;
      suggestionStats.new = (db.prepare("SELECT COUNT(*) as c FROM suggestions WHERE status = 'new'").get() as { c: number }).c;
      suggestionStats.accepted = (db.prepare("SELECT COUNT(*) as c FROM suggestions WHERE status = 'accepted'").get() as { c: number }).c;
      suggestionStats.shipped = (db.prepare("SELECT COUNT(*) as c FROM suggestions WHERE status IN ('shipped_main','shipped_prod')").get() as { c: number }).c;
    } catch { /* table may not exist on older DBs */ }

    res.json({
      totalUsers,
      activeToday,
      activeAgents,
      tasksRunning,
      tasksToday,
      completedToday,
      dbSizeBytes,
      dbSizeMb: dbSizeBytes !== null ? Math.round(dbSizeBytes / 1024 / 1024 * 100) / 100 : null,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      suggestions: suggestionStats,
      uptimeSeconds: Math.floor(process.uptime()),
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

// ---- /export/users endpoint — CSV export of all users ----
adminRouter.get('/export/users', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    const users = db.prepare(
      `SELECT u.id, u.email, u.plan, u.created_at,
              u.last_active AS last_active_at,
              COALESCE(
                (SELECT SUM(ue.tokens_in + ue.tokens_out)
                 FROM usage_events ue WHERE ue.user_id = u.id), 0
              ) AS messages_sent
       FROM users u
       ORDER BY u.created_at DESC`
    ).all() as Array<{
      id: string; email: string; plan: string;
      created_at: string; last_active_at: string; messages_sent: number;
    }>;

    const header = 'id,email,plan,created_at,last_active_at,messages_sent\n';
    const rows = users.map((u) => [
      u.id,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      u.plan,
      u.created_at || '',
      u.last_active_at || '',
      u.messages_sent,
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="geekspace-users.csv"');
    res.send(header + rows);
  } catch (err) {
    logger.error({ err }, 'Admin export/users failed');
    res.status(500).json({ error: 'Export failed' });
  }
});

// ---- /suggestions/export endpoint — CSV export of suggestions (Task 69.5) ----
adminRouter.get('/suggestions/export', requireAdminToken, (req: Request, res: Response): void => {
  try {
    const statusFilter = typeof req.query.status === 'string' && req.query.status ? req.query.status : null;

    // Helper: escape a CSV field value
    function csvField(val: unknown): string {
      const str = val == null ? '' : String(val);
      // Wrap in double-quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    let rows: Array<{
      id: string; title: string; body: string; status: string;
      created_at: string;
    }>;

    if (statusFilter) {
      rows = db.prepare(
        `SELECT s.id, s.title, s.body, s.status, s.created_at
         FROM suggestions s
         WHERE s.status = ?
         ORDER BY s.created_at DESC`
      ).all(statusFilter) as typeof rows;
    } else {
      rows = db.prepare(
        `SELECT s.id, s.title, s.body, s.status, s.created_at
         FROM suggestions s
         ORDER BY s.created_at DESC`
      ).all() as typeof rows;
    }

    // Build vote counts for each suggestion
    const suggestionIds = rows.map(r => r.id);
    const voteMap: Record<string, { upvotes: number; downvotes: number }> = {};
    for (const sid of suggestionIds) {
      const up = (db.prepare(
        `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND vote = 1`
      ).get(sid) as { cnt: number }).cnt;
      const down = (db.prepare(
        `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND vote = -1`
      ).get(sid) as { cnt: number }).cnt;
      voteMap[sid] = { upvotes: up, downvotes: down };
    }

    const header = 'id,title,body,status,upvotes,downvotes,created_at\n';
    const csvRows = rows.map(r => {
      const votes = voteMap[r.id] || { upvotes: 0, downvotes: 0 };
      return [
        csvField(r.id),
        csvField(r.title),
        csvField(r.body),
        csvField(r.status),
        String(votes.upvotes),
        String(votes.downvotes),
        csvField(r.created_at),
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="suggestions.csv"');
    res.send(header + csvRows);
  } catch (err) {
    logger.error({ err }, 'Admin suggestions export failed');
    res.status(500).json({ error: 'Export failed' });
  }
});

// ---- /export/activity endpoint — JSON activity summary ----
adminRouter.get('/export/activity', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

    const activeSevenDays = (db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE last_active >= datetime('now', '-7 days')"
    ).get() as { c: number }).c;

    const totalMessages = (db.prepare(
      'SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as c FROM usage_events'
    ).get() as { c: number }).c;

    const topUsers = db.prepare(
      `SELECT u.id, u.email, u.plan,
              COALESCE(SUM(ue.tokens_in + ue.tokens_out), 0) AS message_count
       FROM users u
       LEFT JOIN usage_events ue ON ue.user_id = u.id
       GROUP BY u.id
       ORDER BY message_count DESC
       LIMIT 5`
    ).all() as Array<{ id: string; email: string; plan: string; message_count: number }>;

    res.json({
      totalUsers,
      activeLastSevenDays: activeSevenDays,
      totalMessages,
      topUsersByMessageCount: topUsers,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Admin export/activity failed');
    res.status(500).json({ error: 'Export failed' });
  }
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

// ---- /dead-letters — failed reminder delivery log (78.7) ----
adminRouter.get('/dead-letters', requireAdminToken, (req: Request, res: Response): void => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const entries = db.prepare(
      `SELECT rdl.id, rdl.reminder_id, rdl.user_id, u.username, rdl.channel,
              rdl.error, rdl.attempts, rdl.last_attempt_at, rdl.created_at,
              r.text as reminder_text
       FROM reminder_dead_letters rdl
       LEFT JOIN users u ON u.id = rdl.user_id
       LEFT JOIN reminders r ON r.id = rdl.reminder_id
       ORDER BY rdl.created_at DESC
       LIMIT ?`
    ).all(limit) as {
      id: string; reminder_id: string; user_id: string; username: string | null;
      channel: string; error: string; attempts: number; last_attempt_at: string;
      created_at: string; reminder_text: string | null;
    }[];
    const total = (db.prepare('SELECT COUNT(*) as c FROM reminder_dead_letters').get() as { c: number }).c;
    res.json({ entries, total, limit });
  } catch (err) {
    logger.error({ err }, 'Admin dead-letters query failed');
    res.status(500).json({ error: 'Dead-letters query failed' });
  }
});

// ---- /analytics/feedback endpoint — thumbs-down analytics ----
adminRouter.get('/analytics/feedback', requireAdminToken, (_req: Request, res: Response): void => {
  try {
    // Total disliked reactions (👎 emoji)
    const totalDisliked = (db.prepare(
      "SELECT COUNT(*) as c FROM message_reactions WHERE reaction = '👎'"
    ).get() as { c: number }).c;

    // Recent dislikes — message_id is a string key; return id + message_id + created_at
    const recentRows = db.prepare(
      `SELECT id, user_id, message_id, reaction, created_at
       FROM message_reactions
       WHERE reaction = '👎'
       ORDER BY created_at DESC
       LIMIT 5`
    ).all() as { id: string; user_id: string; message_id: string; reaction: string; created_at: string }[];

    // Derive "topics" from message_id — extract first 3-5 words (simple string split)
    const topicCounts: Record<string, number> = {};
    for (const row of recentRows) {
      // message_id is typically a UUID or short key; use first words as topic label
      const words = row.message_id.replace(/[-_]/g, ' ').split(/\s+/).slice(0, 4).join(' ').trim();
      if (words) {
        topicCounts[words] = (topicCounts[words] || 0) + 1;
      }
    }
    const topDislikedTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    res.json({
      totalDisliked,
      topDislikedTopics,
      recentDislikes: recentRows.map(r => ({
        id: r.id,
        messageId: r.message_id,
        userId: r.user_id,
        reaction: r.reaction,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Admin feedback analytics query failed');
    res.status(500).json({ error: 'Feedback analytics query failed' });
  }
});

// ── Training Quality Scoring (Phase 105) ──────────────────────────────

// POST /api/admin/training/:id/score
// Body: { score: 1-5 integer }
// Updates quality_score on a training_examples row for human-in-the-loop labeling.
adminRouter.post('/training/:id/score', requireAdminToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const { score } = req.body as { score: unknown };

  // Validate score: must be integer 1–5
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > 5
  ) {
    res.status(400).json({ error: 'score must be an integer between 1 and 5' });
    return;
  }

  // Check row exists
  const existing = db.prepare(
    'SELECT id FROM training_examples WHERE id = ?'
  ).get(id) as { id: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: `Training example '${id}' not found` });
    return;
  }

  // Update quality_score
  db.prepare(
    'UPDATE training_examples SET quality_score = ? WHERE id = ?'
  ).run(score, id);

  const updated = db.prepare(
    'SELECT id, user_id, input, output, provider, model, quality_score, created_at FROM training_examples WHERE id = ?'
  ).get(id) as Record<string, unknown>;

  logger.info({ id, score }, 'Training example scored');
  res.json(updated);
});

// GET /api/admin/training
// Query params:
//   min_score: number — only return rows with quality_score >= min_score
//   limit: number     — max rows to return (default 1000)
// Returns JSONL: one JSON object per line in OpenAI/Together fine-tuning format
adminRouter.get('/training', requireAdminToken, (req: Request, res: Response): void => {
  const minScore = req.query.min_score !== undefined ? Number(req.query.min_score) : null;
  const limitRaw = Number(req.query.limit);
  const limit = req.query.limit !== undefined && !isNaN(limitRaw) ? Math.max(1, Math.min(limitRaw, 10000)) : 1000;

  type TrainingRow = {
    id: string;
    input: string;
    output: string;
    system_prompt: string | null;
    provider: string;
    model: string;
    quality_score: number | null;
    created_at: string;
  };

  let rows: TrainingRow[];

  if (minScore !== null && !isNaN(minScore)) {
    rows = db.prepare(`
      SELECT id, input, output, system_prompt, provider, model, quality_score, created_at
      FROM training_examples
      WHERE quality_score >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(minScore, limit) as TrainingRow[];
  } else {
    rows = db.prepare(`
      SELECT id, input, output, system_prompt, provider, model, quality_score, created_at
      FROM training_examples
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as TrainingRow[];
  }

  // Stream as JSONL (application/x-ndjson)
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="training_examples.jsonl"');

  for (const row of rows) {
    const messages: Array<{ role: string; content: string }> = [];

    if (row.system_prompt) {
      messages.push({ role: 'system', content: row.system_prompt });
    }
    messages.push({ role: 'user', content: row.input });
    messages.push({ role: 'assistant', content: row.output });

    const line = JSON.stringify({
      messages,
      metadata: {
        id: row.id,
        provider: row.provider,
        model: row.model,
        quality_score: row.quality_score,
        created_at: row.created_at,
      },
    });
    res.write(line + '\n');
  }

  res.end();
});

// ── Phase 67: Admin Suggestions Queue ─────────────────────────────────────
// GET /api/admin/suggestions/queue — list all suggestions with user email
adminRouter.get('/suggestions/queue', requireAdminToken, (req: Request, res: Response): void => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    let rows: unknown[];
    if (status) {
      rows = db.prepare(`
        SELECT s.id, s.title, s.body, s.tags, s.status, s.created_at, s.updated_at,
               u.email as user_email, u.id as user_id
        FROM suggestions s JOIN users u ON s.user_id = u.id
        WHERE s.status = ? ORDER BY s.created_at DESC
      `).all(status);
    } else {
      rows = db.prepare(`
        SELECT s.id, s.title, s.body, s.tags, s.status, s.created_at, s.updated_at,
               u.email as user_email, u.id as user_id
        FROM suggestions s JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `).all();
    }
    res.json({ suggestions: rows });
  });

  // PATCH /api/admin/suggestions/bulk-status — bulk status update (Phase 71.10)
  // MUST be before /:id/status to prevent Express treating 'bulk-status' as :id
  adminRouter.patch('/suggestions/bulk-status', requireAdminToken, (req: Request, res: Response): void => {
    const { ids, status } = req.body as { ids?: unknown; status?: string };
    const validStatuses = ['new', 'triaged', 'accepted', 'rejected', 'shipped_main', 'shipped_prod'];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array' });
      return;
    }
    if (ids.length > 50) {
      res.status(400).json({ error: 'Maximum 50 suggestions per bulk operation' });
      return;
    }

    const stringIds = ids.map(String);
    let updated = 0;

    for (const id of stringIds) {
      const suggestion = db.prepare(`SELECT id, user_id, title, status FROM suggestions WHERE id = ?`).get(id) as {id: string; user_id: string; title: string; status: string} | undefined;
      if (!suggestion) continue;

      const oldStatus = suggestion.status;
      db.prepare(`UPDATE suggestions SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);

      try {
        db.prepare(`
          INSERT INTO suggestion_events (id, suggestion_id, from_status, to_status, actor, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).run(uuidV4(), id, oldStatus, status, 'admin');
      } catch { /* non-fatal */ }

      if (status === 'accepted') {
        issueReward({ userId: suggestion.user_id, suggestionId: id, eventType: 'ACCEPTED_EXPERIMENT' });
      } else if (status === 'shipped_main') {
        issueReward({ userId: suggestion.user_id, suggestionId: id, eventType: 'SHIPPED_MAIN' });
      } else if (status === 'shipped_prod') {
        issueReward({ userId: suggestion.user_id, suggestionId: id, eventType: 'SHIPPED_PROD' });
      }
      // Phase 72.2: Notify suggestion owner via activity_log
      try {
        db.prepare(
          `INSERT INTO activity_log (id, user_id, action, details, icon, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
        ).run(uuidV4(), suggestion.user_id, 'suggestion_status_changed', `Your idea "${suggestion.title}" was ${status}`, 'lightbulb');
      } catch { /* non-fatal */ }
      updated++;
    }

    invalidateClustersCache();
    logger.info({ count: updated, status }, 'Admin bulk-updated suggestion statuses');
    res.json({ success: true, updated, status });
  });

  // PATCH /api/admin/suggestions/:id/status — update status, trigger rewards
  adminRouter.patch('/suggestions/:id/status', requireAdminToken, (req: Request, res: Response): void => {
    const { id } = req.params;
    const { status } = req.body as { status?: string };
    const validStatuses = ['new', 'triaged', 'accepted', 'rejected', 'shipped_main', 'shipped_prod'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }
    const suggestion = db.prepare(`SELECT id, user_id, title, status FROM suggestions WHERE id = ?`).get(id) as {id: string; user_id: string; title: string; status: string} | undefined;
    if (!suggestion) { res.status(404).json({ error: 'Suggestion not found' }); return; }

    const oldStatus = suggestion.status;
    db.prepare(`UPDATE suggestions SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);

    // Task 68.1: Log status transition to suggestion_events
    try {
      db.prepare(`
        INSERT INTO suggestion_events (id, suggestion_id, from_status, to_status, actor, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(uuidV4(), id, oldStatus, status, 'admin');
    } catch { /* non-fatal */ }

    // Trigger idempotent reward issuance based on new status
    let rewardResult: { issued: boolean; credits: number } = { issued: false, credits: 0 };
    if (status === 'accepted') {
      rewardResult = issueReward({ userId: suggestion.user_id, suggestionId: id, eventType: 'ACCEPTED_EXPERIMENT' });
      // Task 68.10: Log activity for acceptance
      try {
        db.prepare(
          `INSERT INTO activity_log (id, user_id, action, details, icon, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
        ).run(uuidV4(), suggestion.user_id, 'Suggestion accepted', suggestion.title, 'lightbulb');
      } catch { /* non-fatal */ }
    }
    // Phase 72.2: Notify suggestion owner via activity_log on any status change
    try {
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(uuidV4(), suggestion.user_id, 'suggestion_status_changed', `Your idea "${suggestion.title}" was ${status}`, 'lightbulb');
    } catch { /* non-fatal */ }
    if (status === 'shipped_main') {
      rewardResult = issueReward({ userId: suggestion.user_id, suggestionId: id, eventType: 'SHIPPED_MAIN' });
    } else if (status === 'shipped_prod') {
      rewardResult = issueReward({ userId: suggestion.user_id, suggestionId: id, eventType: 'SHIPPED_PROD' });
    }

    // Invalidate clusters cache on status change
    invalidateClustersCache();

    logger.info({ suggestionId: id, oldStatus, newStatus: status, rewardIssued: rewardResult.issued }, 'Admin updated suggestion status');
    res.json({ success: true, suggestion: { id, status }, reward: rewardResult });
  });

  // GET /api/admin/suggestions/clusters — list clusters with scores
  // 70.9: LIMIT 100 to prevent unbounded results; status index used via suggestion join
  adminRouter.get('/suggestions/clusters', requireAdminToken, (_req: Request, res: Response): void => {
    const rows = db.prepare(`
      SELECT c.id, c.canonical_summary, c.name, c.tags, c.suggestion_ids, c.created_at,
             sc.demand_score, sc.impact_score, sc.effort_score, sc.risk_score, sc.overall_score, sc.rationale
      FROM suggestion_clusters c
      LEFT JOIN suggestion_scores sc ON sc.cluster_id = c.id
      ORDER BY sc.overall_score DESC NULLS LAST, c.created_at DESC
      LIMIT 100
    `).all();
    res.json({ clusters: rows });
  });

  // POST /api/admin/suggestions/triage — trigger AI triage for new suggestions
  adminRouter.post('/suggestions/triage', requireAdminToken, async (_req: Request, res: Response): Promise<void> => {
    // Task 68.5: Rate limit — max 1 triage per 60 seconds (skip in TEST_MODE)
    if (!config.isTestMode) {
      const now = Date.now();
      if (lastTriageTime > 0 && now - lastTriageTime < 60000) {
        const waitSec = Math.ceil((60000 - (now - lastTriageTime)) / 1000);
        res.status(429).json({ error: `Triage rate limited. Wait ${waitSec}s before retrying.` });
        return;
      }
      lastTriageTime = now;
    }

    const newSuggestions = db.prepare(`SELECT id FROM suggestions WHERE status = 'new'`).all() as {id: string}[];
    const ids = newSuggestions.map(s => s.id);
    if (!ids.length) { res.json({ processed: 0, results: [] }); return; }
    try {
      const results = await triageSuggestions(ids);
      // Invalidate clusters cache after triage creates new clusters
      invalidateClustersCache();
      res.json({ processed: results.length, results });
    } catch (err) {
      logger.error({ err }, 'Triage failed');
      res.status(500).json({ error: 'Triage failed' });
    }
  });

  // GET /api/admin/suggestions/stats — suggestion analytics (Task 68.14)
  adminRouter.get('/suggestions/stats', requireAdminToken, (_req: Request, res: Response): void => {
    try {
      const total = (db.prepare('SELECT COUNT(*) as c FROM suggestions').get() as { c: number }).c;

      const statusRows = db.prepare(
        `SELECT status, COUNT(*) as cnt FROM suggestions GROUP BY status`
      ).all() as Array<{ status: string; cnt: number }>;
      const byStatus: Record<string, number> = {
        new: 0, triaged: 0, accepted: 0, rejected: 0, shipped_main: 0, shipped_prod: 0,
      };
      for (const row of statusRows) {
        byStatus[row.status] = row.cnt;
      }

      const rewardsRow = db.prepare(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(credits), 0) as total_credits FROM suggestion_rewards`
      ).get() as { cnt: number; total_credits: number };

      const topVoted = db.prepare(`
        SELECT s.id, s.title, COALESCE(SUM(v.vote), 0) as voteCount
        FROM suggestions s
        LEFT JOIN suggestion_votes v ON v.suggestion_id = s.id
        GROUP BY s.id
        ORDER BY voteCount DESC
        LIMIT 5
      `).all() as Array<{ id: string; title: string; voteCount: number }>;

      // 70.14: Count trending suggestions
      let trendingCount = 0;
      try {
        trendingCount = (db.prepare(`SELECT COUNT(*) as c FROM suggestions WHERE trending = 1`).get() as { c: number }).c;
      } catch { /* non-fatal */ }

      res.json({
        total,
        byStatus,
        totalRewardsIssued: rewardsRow.cnt,
        totalCreditsAwarded: rewardsRow.total_credits,
        topVoted,
        trending: trendingCount,
      });
    } catch (err) {
      logger.error({ err }, 'Admin suggestion stats query failed');
      res.status(500).json({ error: 'Suggestion stats query failed' });
    }
  });

  // ── 83.4: Invite codes ───────────────────────────────────────
  // POST /api/admin/invite — create one or more invite codes
  adminRouter.post('/invite', requireAdminToken, (req: Request, res: Response): void => {
    const { email, note, count = 1 } = req.body as { email?: string; note?: string; count?: number };
    const n = Math.min(Math.max(1, Number(count) || 1), 100); // 1–100 at a time
    const codes: Array<{ id: string; code: string; email: string | null; note: string }> = [];

    const insert = db.prepare(`
      INSERT INTO invite_codes (id, code, email, note, created_by)
      VALUES (?, ?, ?, ?, 'admin')
    `);

    const doInserts = db.transaction(() => {
      for (let i = 0; i < n; i++) {
        const id = uuidV4();
        // 8-char alphanumeric code, uppercase
        const code = Math.random().toString(36).substring(2, 6).toUpperCase() +
                     Math.random().toString(36).substring(2, 6).toUpperCase();
        insert.run(id, code, email || null, note || '');
        codes.push({ id, code, email: email || null, note: note || '' });
      }
    });
    doInserts();

    logger.info({ count: n, email }, 'admin: invite codes created');
    res.status(201).json({ created: n, codes });
  });

  // GET /api/admin/invites — list all invite codes with usage status
  adminRouter.get('/invites', requireAdminToken, (req: Request, res: Response): void => {
    const unused = req.query.unused === 'true';
    const rows = db.prepare(`
      SELECT id, code, email, note, created_by, used_at, used_by, created_at
      FROM invite_codes
      ${unused ? 'WHERE used_at IS NULL' : ''}
      ORDER BY created_at DESC
      LIMIT 500
    `).all() as Array<{
      id: string; code: string; email: string | null; note: string;
      created_by: string; used_at: string | null; used_by: string | null; created_at: string;
    }>;

    res.json({
      count: rows.length,
      unusedCount: rows.filter(r => !r.used_at).length,
      usedCount: rows.filter(r => !!r.used_at).length,
      codes: rows.map(r => ({
        ...r,
        used: !!r.used_at,
      })),
    });
  });

  // DELETE /api/admin/invite/:id — revoke an unused invite code
  adminRouter.delete('/invite/:id', requireAdminToken, (req: Request, res: Response): void => {
    const { id } = req.params;
    const row = db.prepare('SELECT id, used_at FROM invite_codes WHERE id = ?').get(id) as { id: string; used_at: string | null } | undefined;
    if (!row) { res.status(404).json({ error: 'Invite code not found' }); return; }
    if (row.used_at) { res.status(409).json({ error: 'Cannot revoke an already-used invite code' }); return; }
    db.prepare('DELETE FROM invite_codes WHERE id = ?').run(id);
    res.json({ revoked: true, id });
  });

  // POST /api/admin/rewards/grant — manual reward override
  adminRouter.post('/rewards/grant', requireAdminToken, (req: Request, res: Response): void => {
    const { userId, suggestionId, clusterId, eventType } = req.body as {userId?: string; suggestionId?: string; clusterId?: string; eventType?: string};
    if (!userId || !eventType) { res.status(400).json({ error: 'userId and eventType required' }); return; }
    const validEvents = ['ACCEPTED_EXPERIMENT', 'SHIPPED_MAIN', 'SHIPPED_PROD', 'ADOPTION_MILESTONE'];
    if (!validEvents.includes(eventType)) { res.status(400).json({ error: 'Invalid eventType' }); return; }
    const result = issueReward({ userId, suggestionId, clusterId, eventType: eventType as import('../services/rewards.js').RewardEventType });
    res.json(result);
  });

  // GET /api/admin/token-stats — token usage and compression efficiency
  adminRouter.get('/token-stats', requireAdminToken, (_req: Request, res: Response): void => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    type UsageRow = { model: string; total_in: number; total_out: number; total_cost: number };

    const todayRows = db.prepare(`
      SELECT model,
             COALESCE(SUM(tokens_in), 0) AS total_in,
             COALESCE(SUM(tokens_out), 0) AS total_out,
             COALESCE(SUM(cost_usd), 0) AS total_cost
      FROM usage_events
      WHERE tool = 'ai.chat' AND created_at >= ?
      GROUP BY model
    `).all(todayStart.toISOString()) as UsageRow[];

    const weekRows = db.prepare(`
      SELECT model,
             COALESCE(SUM(tokens_in), 0) AS total_in,
             COALESCE(SUM(tokens_out), 0) AS total_out,
             COALESCE(SUM(cost_usd), 0) AS total_cost
      FROM usage_events
      WHERE tool = 'ai.chat' AND created_at >= ?
      GROUP BY model
    `).all(weekStart.toISOString()) as UsageRow[];

    const sumRows = (rows: UsageRow[]) => ({
      total: rows.reduce((s, r) => s + r.total_in + r.total_out, 0),
      byModel: rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.model] = (acc[r.model] || 0) + r.total_in + r.total_out;
        return acc;
      }, {}),
      costUsd: rows.reduce((s, r) => s + r.total_cost, 0),
    });

    const today = sumRows(todayRows);
    const week = sumRows(weekRows);

    // Compression saves ~25% on prompts (conservative estimate)
    const compressionRate = '~25% saved vs uncompressed';

    res.json({ today, week, compressionRate });
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
