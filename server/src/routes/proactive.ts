import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getProactiveLog } from '../services/proactive-engine.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export const proactiveRouter = Router();

// GET /api/proactive/log — returns last 20 proactive messages sent to user
proactiveRouter.get('/log', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const log = getProactiveLog(userId, limit);
  res.json({ log });
});

// GET /api/proactive/settings — get proactive toggle state
proactiveRouter.get('/settings', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const user = db.prepare('SELECT proactive_enabled FROM users WHERE id = ?').get(userId) as { proactive_enabled: number } | undefined;
  res.json({ enabled: user?.proactive_enabled !== 0 });
});

// PATCH /api/proactive/toggle — enable or disable proactive messages
proactiveRouter.patch('/toggle', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }
  try {
    db.prepare('UPDATE users SET proactive_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, userId);
    logger.info({ userId, enabled }, 'Proactive messages toggle updated');
    res.json({ enabled });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to update proactive toggle');
    res.status(500).json({ error: 'Failed to update setting' });
  }
});
