import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { getPendingInferredGoals, respondToInferredGoal } from '../services/goal-inference.js';
import { logger } from '../../../logger.js';

const router = Router();

router.get('/', requireAuth, (req: AuthRequest, res) => {
  try {
    const goals = getPendingInferredGoals(req.userId!, 10);
    res.json({ goals });
  } catch (err) {
    logger.error({ err }, 'inferred-goals:list failed');
    res.status(500).json({ error: 'Failed to list inferred goals' });
  }
});

router.post('/:id/respond', requireAuth, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { response, convertedGoalId } = req.body as { response: 'accepted' | 'rejected'; convertedGoalId?: string };
    if (!['accepted', 'rejected'].includes(response)) {
      return res.status(400).json({ error: 'response must be accepted or rejected' });
    }
    respondToInferredGoal(id, response, convertedGoalId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'inferred-goals:respond failed');
    res.status(500).json({ error: 'Failed to respond' });
  }
});

export default router;
