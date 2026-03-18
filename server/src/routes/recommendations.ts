// ============================================================
// Smart Recommendations Routes — Personalized feature suggestions
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getRecommendations, dismissRecommendation } from '../services/smart-recommendations.js';

export const recommendationsRouter = Router();

// GET /api/recommendations — get personalized feature recommendations
recommendationsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const recs = await getRecommendations(req.userId!, limit);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// POST /api/recommendations/dismiss — dismiss a recommendation
recommendationsRouter.post('/dismiss', requireAuth, (req: AuthRequest, res) => {
  const { feature } = req.body as { feature: string };
  if (!feature) {
    res.status(400).json({ error: 'feature is required' });
    return;
  }
  dismissRecommendation(req.userId!, feature);
  res.json({ success: true });
});
