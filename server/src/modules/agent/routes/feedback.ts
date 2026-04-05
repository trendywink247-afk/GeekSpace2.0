/**
 * Feedback Routes — User ratings on agent responses
 */

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { recordFeedback, getFeedbackStats } from '../services/feedback-service.js';
import { logger } from '../../../logger.js';

const router = Router();

/**
 * POST /api/agent/feedback
 * Record thumbs up/down on an agent message.
 */
router.post('/', requireAuth, (req: AuthRequest, res) => {
  try {
    const { messageId, rating, comment } = req.body as {
      messageId: string;
      rating: 'up' | 'down';
      comment?: string;
    };

    if (!messageId || !['up', 'down'].includes(rating)) {
      return res.status(400).json({ error: 'messageId and rating (up/down) are required' });
    }

    recordFeedback(req.userId!, messageId, rating, comment);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'feedback:record failed');
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * GET /api/agent/feedback/stats
 * Get user's feedback summary.
 */
router.get('/stats', requireAuth, (req: AuthRequest, res) => {
  try {
    const stats = getFeedbackStats(req.userId!);
    res.json(stats);
  } catch (err) {
    logger.error({ err }, 'feedback:stats failed');
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

export default router;
