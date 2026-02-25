// ============================================================
// Activity Log Route — GET /api/activity
// Returns recent activity_log entries for the authenticated user
// GET /api/activity/stats — 7-day daily counts (Phase 34.2)
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const activityRouter = Router();

activityRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const entries = db.prepare(`
    SELECT id, action, details, icon, created_at
    FROM activity_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);

  const { total } = db.prepare(
    'SELECT COUNT(*) AS total FROM activity_log WHERE user_id = ?'
  ).get(userId) as { total: number };

  res.json({ activity: entries, total });
});

// ---- 34.2: 7-day daily activity stats (messages sent + reminders created) ----
activityRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const days: { date: string; messages: number; reminders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const msgs = db.prepare(
      `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user' AND created_at LIKE ?`
    ).get(userId, `${dateStr}%`) as { c: number };
    const rems = db.prepare(
      `SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND created_at LIKE ?`
    ).get(userId, `${dateStr}%`) as { c: number };
    days.push({ date: dateStr, messages: msgs.c, reminders: rems.c });
  }
  res.json({ days });
});
