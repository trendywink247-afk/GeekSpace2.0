// ============================================================
// Activity Log Route — GET /api/activity
// Returns recent activity_log entries for the authenticated user
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const activityRouter = Router();

activityRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const entries = db.prepare(`
    SELECT id, action, details, icon, created_at
    FROM activity_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit);

  res.json({ activity: entries });
});
