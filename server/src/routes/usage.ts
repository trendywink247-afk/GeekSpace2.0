import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { getTokenBudget, getDailyTokenUsage } from '../services/token-budget.js';

export const usageRouter = Router();

usageRouter.get('/summary', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const range = (req.query.range as string) || 'month';

  const dateFilter = range === 'day'
    ? "AND created_at >= datetime('now', '-1 day')"
    : range === 'week'
    ? "AND created_at >= datetime('now', '-7 days')"
    : "AND created_at >= datetime('now', '-30 days')";

  const totals = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as totalCost, COALESCE(SUM(tokens_in), 0) as totalIn,
           COALESCE(SUM(tokens_out), 0) as totalOut, COUNT(*) as totalMessages,
           COUNT(CASE WHEN tool != 'ai.chat' AND tool != '' THEN 1 END) as totalToolCalls
    FROM usage_events WHERE user_id = ? ${dateFilter}
  `).get(userId) as Record<string, unknown>;

  const byProvider = db.prepare(`
    SELECT provider, COALESCE(SUM(cost_usd), 0) as cost FROM usage_events WHERE user_id = ? ${dateFilter} GROUP BY provider
  `).all(userId) as Record<string, unknown>[];

  const byChannel = db.prepare(`
    SELECT channel, COUNT(*) as count FROM usage_events WHERE user_id = ? ${dateFilter} GROUP BY channel
  `).all(userId) as Record<string, unknown>[];

  const byTool = db.prepare(`
    SELECT tool, COALESCE(SUM(cost_usd), 0) as cost FROM usage_events WHERE user_id = ? ${dateFilter} AND tool != '' GROUP BY tool
  `).all(userId) as Record<string, unknown>[];

  const daysUsed = range === 'day' ? 1 : range === 'week' ? 7 : 30;
  const dailyCost = ((totals.totalCost as number) || 0) / daysUsed;
  const forecastUSD = +(dailyCost * 30).toFixed(2);

  res.json({
    totalCostUSD: +((totals.totalCost as number) || 0).toFixed(2),
    totalTokensIn: (totals.totalIn as number) || 0,
    totalTokensOut: (totals.totalOut as number) || 0,
    totalMessages: (totals.totalMessages as number) || 0,
    totalToolCalls: (totals.totalToolCalls as number) || 0,
    byProvider: Object.fromEntries(byProvider.map(r => [r.provider, +((r.cost as number) || 0).toFixed(2)])),
    byChannel: Object.fromEntries(byChannel.map(r => [r.channel, r.count])),
    byTool: Object.fromEntries(byTool.map(r => [r.tool, +((r.cost as number) || 0).toFixed(2)])),
    forecastUSD,
  });
});

usageRouter.get('/billing', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const user = db.prepare('SELECT plan, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
  const monthUsage = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as cost, COALESCE(SUM(tokens_in), 0) as tin,
           COALESCE(SUM(tokens_out), 0) as tout, COUNT(*) as messages
    FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
  `).get(userId) as Record<string, unknown>;

  res.json({
    plan: user?.plan || 'free',
    pricePerYear: ['halfyear', 'yearly'].includes(user?.plan as string) ? 50 : 0,
    credits: user?.credits || 0,
    monthlyAllowance: ['halfyear', 'yearly'].includes(user?.plan as string) ? 15000 : 5000,
    resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0],
    usageThisMonth: {
      totalCostUSD: +((monthUsage.cost as number) || 0).toFixed(2),
      totalTokensIn: (monthUsage.tin as number) || 0,
      totalTokensOut: (monthUsage.tout as number) || 0,
      totalMessages: (monthUsage.messages as number) || 0,
    },
  });
});

// ---- Chart Data: Time-series for Recharts ----

usageRouter.get('/chart', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const range = (req.query.range as string) || '7d';
  const _group = (req.query.group as string) || 'day';

  const days = range === '30d' ? 30 : range === '14d' ? 14 : 7;

  // Daily aggregation
  const rows = db.prepare(`
    SELECT date(created_at) as day,
           COUNT(*) as requests,
           COALESCE(SUM(tokens_in + tokens_out), 0) as tokens,
           COALESCE(SUM(cost_usd), 0) as cost,
           provider
    FROM usage_events
    WHERE user_id = ? AND created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at), provider
    ORDER BY day ASC
  `).all(userId) as Array<{ day: string; requests: number; tokens: number; cost: number; provider: string }>;

  // Reshape for Recharts: one entry per day with provider breakdown
  const dayMap = new Map<string, Record<string, unknown>>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dayMap.set(key, { day: key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), requests: 0, tokens: 0, cost: 0 });
  }

  for (const row of rows) {
    const entry = dayMap.get(row.day);
    if (entry) {
      entry.requests = (entry.requests as number) + row.requests;
      entry.tokens = (entry.tokens as number) + row.tokens;
      entry.cost = (entry.cost as number) + row.cost;
      // Add provider-specific counts
      entry[`requests_${row.provider}`] = row.requests;
      entry[`tokens_${row.provider}`] = row.tokens;
    }
  }

  res.json(Array.from(dayMap.values()));
});

// ---- Provider breakdown (pie/donut chart) ----

usageRouter.get('/providers', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const days = Math.max(1, Math.min(parseInt(req.query.days as string, 10) || 30, 90));

  const rows = db.prepare(`
    SELECT provider, COUNT(*) as requests,
           COALESCE(SUM(tokens_in + tokens_out), 0) as tokens,
           COALESCE(SUM(cost_usd), 0) as cost
    FROM usage_events
    WHERE user_id = ? AND created_at >= datetime('now', '-${days} days')
    GROUP BY provider
  `).all(userId);

  res.json(rows);
});

// ---- Latency stats ----

usageRouter.get('/latency', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // We don't have latency in usage_events directly, so return request counts per hour
  const rows = db.prepare(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as requests
    FROM usage_events
    WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY strftime('%H', created_at)
    ORDER BY hour ASC
  `).all(userId);

  res.json(rows);
});

usageRouter.get('/events', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  const rows = db.prepare('SELECT * FROM usage_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(userId, limit, offset) as Record<string, unknown>[];
  const total = db.prepare('SELECT COUNT(*) as count FROM usage_events WHERE user_id = ?').get(userId) as Record<string, unknown>;

  const events = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    provider: r.provider,
    model: r.model,
    tokensIn: r.tokens_in ?? 0,
    tokensOut: r.tokens_out ?? 0,
    costUSD: r.cost_usd ?? 0,
    channel: r.channel,
    tool: r.tool,
    createdAt: r.created_at,
  }));

  res.json({ events, total: (total.count as number) || 0 });
});

// ---- Today's usage vs per-day limits (for usage widget + limit banners) ----
// Returns message/voice/image counts for today vs plan limits.

const DAILY_MSG_LIMITS: Record<string, number> = {
  free: 30,
  pilot: 150,
  monthly: 150,
  intro: 200,
  halfyear: 300,
  yearly: 500,
};
const DAILY_VOICE_LIMITS: Record<string, number> = {
  free: 5,
  pilot: 30,
  monthly: 30,
  intro: 30,
  halfyear: 60,
  yearly: 100,
};
const DAILY_IMAGE_LIMITS: Record<string, number> = {
  free: 3,
  pilot: 10,
  monthly: 10,
  intro: 15,
  halfyear: 50,
  yearly: 100,
};

usageRouter.get('/today', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: string } | undefined;
  const plan = user?.plan || 'free';

  // Today's counts from usage_events
  const today = db.prepare(`
    SELECT
      COUNT(CASE WHEN tool = 'ai.chat' OR tool = '' OR tool IS NULL THEN 1 END) as messages,
      COUNT(CASE WHEN tool LIKE 'voice:%' THEN 1 END) as voice,
      COUNT(CASE WHEN tool LIKE 'image:%' THEN 1 END) as images
    FROM usage_events
    WHERE user_id = ? AND date(created_at) = date('now')
  `).get(userId) as { messages: number; voice: number; images: number } | undefined;

  const msgLimit = DAILY_MSG_LIMITS[plan] ?? DAILY_MSG_LIMITS.free;
  const voiceLimit = DAILY_VOICE_LIMITS[plan] ?? DAILY_VOICE_LIMITS.free;
  const imageLimit = DAILY_IMAGE_LIMITS[plan] ?? DAILY_IMAGE_LIMITS.free;

  // Token budget percentage (from token-budget service)
  const tokenUsage = getDailyTokenUsage(userId);
  const tokenBudget = getTokenBudget(plan);

  res.json({
    plan,
    tokenBudget,
    tokenUsed: tokenUsage.used,
    tokenPercentage: Math.min(tokenUsage.percentage, 1),
    messages: {
      used: today?.messages ?? 0,
      limit: msgLimit,
      percentage: Math.min((today?.messages ?? 0) / msgLimit, 1),
    },
    voice: {
      used: today?.voice ?? 0,
      limit: voiceLimit,
      percentage: Math.min((today?.voice ?? 0) / voiceLimit, 1),
    },
    images: {
      used: today?.images ?? 0,
      limit: imageLimit,
      percentage: Math.min((today?.images ?? 0) / imageLimit, 1),
    },
  });
});

// ---- Daily usage for last 7 days (messages + credits burned) ----

usageRouter.get('/daily', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const days = Math.max(1, Math.min(parseInt(req.query.days as string, 10) || 7, 30));

  // Build a map of the last N days
  const dayMap = new Map<string, { day: string; label: string; messages: number; credits: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dayMap.set(key, {
      day: key,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      messages: 0,
      credits: 0,
    });
  }

  const rows = db.prepare(`
    SELECT date(created_at) as day,
           COUNT(*) as messages,
           COALESCE(SUM(tokens_in + tokens_out), 0) as credits
    FROM usage_events
    WHERE user_id = ? AND created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(userId) as Array<{ day: string; messages: number; credits: number }>;

  for (const row of rows) {
    const entry = dayMap.get(row.day);
    if (entry) {
      entry.messages = row.messages;
      entry.credits = row.credits;
    }
  }

  res.json(Array.from(dayMap.values()));
});

// ---- Route aliases (BLOCKER-009 fix) ----
// Frontend may call /stats or /history — redirect to canonical routes
usageRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  // Alias for /summary
  const userId = req.userId!;
  const range = (req.query.range as string) || 'month';
  const dateFilter = range === 'day'
    ? "AND created_at >= datetime('now', '-1 day')"
    : range === 'week'
    ? "AND created_at >= datetime('now', '-7 days')"
    : "AND created_at >= datetime('now', '-30 days')";

  const totals = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as totalCost, COALESCE(SUM(tokens_in), 0) as totalIn,
           COALESCE(SUM(tokens_out), 0) as totalOut, COUNT(*) as totalMessages
    FROM usage_events WHERE user_id = ? ${dateFilter}
  `).get(userId) as Record<string, unknown>;

  res.json({
    totalCostUSD: +((totals.totalCost as number) || 0).toFixed(2),
    totalTokensIn: (totals.totalIn as number) || 0,
    totalTokensOut: (totals.totalOut as number) || 0,
    totalMessages: (totals.totalMessages as number) || 0,
  });
});

usageRouter.get('/history', requireAuth, (req: AuthRequest, res) => {
  // Alias for /events
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  const rows = db.prepare(
    'SELECT * FROM usage_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(userId, limit, offset) as Record<string, unknown>[];

  res.json({ events: rows, total: rows.length });
});
