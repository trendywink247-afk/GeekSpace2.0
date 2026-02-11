import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const usageRouter = Router();

usageRouter.get('/summary', requireAuth, (req, res) => {
  const range = req.query.range || 'month';
  const multiplier = range === 'day' ? 0.1 : range === 'week' ? 0.35 : 1;

  res.json({
    totalCostUSD: +(3.2 * multiplier).toFixed(2),
    totalTokensIn: Math.round(520000 * multiplier),
    totalTokensOut: Math.round(180000 * multiplier),
    totalMessages: Math.round(1247 * multiplier),
    totalToolCalls: Math.round(340 * multiplier),
    byProvider: {
      openai: +(1.8 * multiplier).toFixed(2),
      qwen: +(0.9 * multiplier).toFixed(2),
      anthropic: +(0.5 * multiplier).toFixed(2),
    },
    byChannel: {
      web: Math.round(480 * multiplier),
      telegram: Math.round(320 * multiplier),
      terminal: Math.round(280 * multiplier),
      'portfolio-chat': Math.round(167 * multiplier),
    },
    byTool: {
      'reminders.create': +(0.8 * multiplier).toFixed(2),
      'ai.chat': +(1.1 * multiplier).toFixed(2),
      'portfolio.update': +(0.6 * multiplier).toFixed(2),
      'usage.summary': +(0.2 * multiplier).toFixed(2),
      'schedule.get': +(0.5 * multiplier).toFixed(2),
    },
    forecastUSD: 4.1,
  });
});

usageRouter.get('/billing', requireAuth, (_req, res) => {
  res.json({
    plan: 'pro',
    pricePerYear: 50,
    credits: 12450,
    monthlyAllowance: 15000,
    resetDate: '2026-03-01',
    usageThisMonth: {
      totalCostUSD: 3.2,
      totalTokensIn: 520000,
      totalTokensOut: 180000,
      totalMessages: 1247,
      totalToolCalls: 340,
      byProvider: { openai: 1.8, qwen: 0.9, anthropic: 0.5 },
      byChannel: { web: 480, telegram: 320, terminal: 280, 'portfolio-chat': 167 },
      byTool: {},
      forecastUSD: 4.1,
    },
  });
});

usageRouter.get('/events', requireAuth, (_req, res) => {
  res.json({ events: [], total: 0 });
});
