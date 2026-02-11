import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

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
    pricePerYear: user?.plan === 'pro' ? 50 : 0,
    credits: user?.credits || 0,
    monthlyAllowance: user?.plan === 'pro' ? 15000 : 5000,
    resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0],
    usageThisMonth: {
      totalCostUSD: +((monthUsage.cost as number) || 0).toFixed(2),
      totalTokensIn: (monthUsage.tin as number) || 0,
      totalTokensOut: (monthUsage.tout as number) || 0,
      totalMessages: (monthUsage.messages as number) || 0,
    },
  });
});

usageRouter.get('/events', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const events = db.prepare('SELECT * FROM usage_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(userId, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM usage_events WHERE user_id = ?').get(userId) as Record<string, unknown>;

  res.json({ events, total: (total.count as number) || 0 });
});
