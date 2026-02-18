// ============================================================
// Admin Dashboard API — private endpoint for Mission Control
// Auth: X-Admin-Password header checked against env var
// ============================================================

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { getMetricsSnapshot } from '../middleware/metrics.js';
import { logger } from '../logger.js';

export const adminRouter = Router();

// ---- Password middleware ----
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

// ---- Main dashboard endpoint ----
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
