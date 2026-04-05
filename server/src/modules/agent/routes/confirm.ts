/**
 * Confirmation Routes — Human-in-the-loop for agent tool actions
 */

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import {
  resolveConfirmation,
  getPendingConfirmation,
  listPendingConfirmations,
} from '../services/confirm-action.js';
import { logger } from '../../../logger.js';

const router = Router();

/**
 * POST /api/agent/confirm/:confirmId
 * Approve or reject a pending tool action.
 */
router.post('/:confirmId', requireAuth, (req: AuthRequest, res) => {
  try {
    const { confirmId } = req.params;
    const userId = req.userId!;
    const { approved, editedParams, rejectReason } = req.body as {
      approved: boolean;
      editedParams?: Record<string, unknown>;
      rejectReason?: string;
    };

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean) is required' });
    }

    const result = resolveConfirmation(confirmId, userId, approved, editedParams, rejectReason);
    if (!result) {
      return res.status(404).json({ error: 'Confirmation not found or already resolved' });
    }

    res.json({ confirmation: result });
  } catch (err) {
    logger.error({ err }, 'confirm:resolve failed');
    res.status(500).json({ error: 'Failed to resolve confirmation' });
  }
});

/**
 * GET /api/agent/confirm/pending
 * List all pending confirmations for the user.
 */
router.get('/pending', requireAuth, (req: AuthRequest, res) => {
  try {
    const pending = listPendingConfirmations(req.userId!);
    res.json({ confirmations: pending });
  } catch (err) {
    logger.error({ err }, 'confirm:list failed');
    res.status(500).json({ error: 'Failed to list confirmations' });
  }
});

/**
 * GET /api/agent/confirm/:confirmId
 * Get a specific confirmation status.
 */
router.get('/:confirmId', requireAuth, (req: AuthRequest, res) => {
  try {
    const confirmation = getPendingConfirmation(req.params.confirmId, req.userId!);
    if (!confirmation) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }
    res.json({ confirmation });
  } catch (err) {
    logger.error({ err }, 'confirm:get failed');
    res.status(500).json({ error: 'Failed to get confirmation' });
  }
});

export default router;
