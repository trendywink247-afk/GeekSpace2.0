// Analytics Routes -- Phase 102
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  getDailySnapshots,
  getWeeklySummary,
  getActivityHeatmap,
  getAgentUsage,
  getTopics,
} from '../services/analytics.js';
import { logger } from '../logger.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

// GET /api/analytics/snapshot -- last 30 days of DailySnapshot
analyticsRouter.get('/snapshot', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const days = Math.max(1, Math.min(parseInt((req.query.days as string) || '30', 10), 365));
  try {
    const snapshots = await getDailySnapshots(userId, days);
    res.json({ snapshots });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics snapshot failed');
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// GET /api/analytics/weekly -- current week summary with AI insight
analyticsRouter.get('/weekly', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  try {
    const summary = await getWeeklySummary(userId);
    res.json({ summary });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics weekly summary failed');
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// GET /api/analytics/heatmap -- last 365 days activity heatmap
analyticsRouter.get('/heatmap', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  try {
    const heatmap = await getActivityHeatmap(userId);
    res.json({ heatmap });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics heatmap failed');
    res.status(500).json({ error: 'Failed to fetch heatmap' });
  }
});

// GET /api/analytics/agents -- agent usage last 30 days
analyticsRouter.get('/agents', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const days = Math.max(1, Math.min(parseInt((req.query.days as string) || '30', 10), 365));
  try {
    const agents = await getAgentUsage(userId, days);
    res.json({ agents });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics agent usage failed');
    res.status(500).json({ error: 'Failed to fetch agent usage' });
  }
});

// GET /api/analytics/topics -- top topics from memories + notes
analyticsRouter.get('/topics', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  try {
    const topics = await getTopics(userId);
    res.json({ topics });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics topics failed');
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});
