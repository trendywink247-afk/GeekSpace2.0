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
  // 46.8: Reduced default from 50 to 25 to lower initial payload size
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  // 64.3: text search — partial match on action or details
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : null;
  // 64.6: action type filter — exact prefix match on action field
  const actionType = typeof req.query.type === 'string' && req.query.type.trim() ? req.query.type.trim() : null;

  const whereClauses: string[] = ['user_id = ?'];
  const params: unknown[] = [userId];
  if (q) { whereClauses.push('(action LIKE ? OR details LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (actionType) { whereClauses.push('action = ?'); params.push(actionType); }
  const where = whereClauses.join(' AND ');

  const entries = db.prepare(`
    SELECT id, action, details, icon, created_at
    FROM activity_log
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM activity_log WHERE ${where}`
  ).get(...params) as { total: number };

  res.json({ activity: entries, total });
});

// ---- 40.4: DELETE /activity — clear all activity log entries for user ----
activityRouter.delete('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const result = db.prepare('DELETE FROM activity_log WHERE user_id = ?').run(userId);
  res.json({ deleted: result.changes });
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

// ---- 64.8: GET /activity/export — CSV download of last 500 activity entries ----
activityRouter.get('/export', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = db.prepare(`
    SELECT id, action, details, icon, created_at
    FROM activity_log WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 500
  `).all(userId) as Array<{ id: string; action: string; details: string; icon: string; created_at: string }>;

  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let csv = 'date,action,details\n';
  for (const r of rows) {
    csv += `${escape(r.created_at)},${escape(r.action)},${escape(r.details)}\n`;
  }
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="activity-log.csv"');
  res.send(csv);
});

// ---- 41.5: DELETE /activity/:id — delete single activity log entry ----
activityRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const result = db.prepare('DELETE FROM activity_log WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ deleted: 1 });
});
