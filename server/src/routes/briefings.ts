import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getRecentBriefings, createBriefing } from '../services/daily-briefing.js';

export const briefingsRouter = Router();

briefingsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
  const briefings = getRecentBriefings(req.userId!, limit);
  res.json(briefings);
});

briefingsRouter.post('/trigger', requireAuth, async (req: AuthRequest, res) => {
  try {
    const content = await createBriefing(req.userId!);
    res.json({ content });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});
