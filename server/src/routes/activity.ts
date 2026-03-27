// ============================================================
// Activity Log Route — Redis-cached + SSE streaming
// GET  /api/activity          — cached activity feed
// GET  /api/activity/heatmap  — 90-day activity heatmap counts
// GET  /api/activity/stats    — 7-day daily counts
// GET  /api/activity/stream   — SSE real-time push
// GET  /api/activity/export   — CSV download (last 500)
// DELETE /api/activity        — clear all entries
// DELETE /api/activity/:id    — delete single entry
// ============================================================

import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';
import { logger } from '../logger.js';

export const activityRouter = Router();

// ── SSE client registry ──────────────────────────────────────
const sseClients = new Map<string, Set<Response>>();

export function pushActivityEvent(userId: string, event: { action: string; details: string; icon: string }) {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify({ ...event, created_at: new Date().toISOString() });
  for (const res of clients) {
    try { res.write(`data: ${data}\n\n`); } catch { clients.delete(res); }
  }
}

export function invalidateActivityCache(userId: string) {
  cacheDel(`activity:${userId}`).catch(() => {});
  cacheDel(`activity:stats:${userId}`).catch(() => {});
  cacheDel(`activity:heatmap:${userId}`).catch(() => {});
}

// ── Per-user rate limit (4s cooldown on polling) ─────────────
const lastFetch = new Map<string, number>();

// ── GET /api/activity ────────────────────────────────────────
activityRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const now = Date.now();
  const last = lastFetch.get(userId) ?? 0;
  if (now - last < 4000) {
    const cached = await cacheGet(`activity:${userId}`);
    if (cached) { res.json(JSON.parse(cached)); return; }
  }
  lastFetch.set(userId, now);

  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const q = rawQ || null;
  const rawType = typeof req.query.type === 'string' ? req.query.type.trim().slice(0, 50) : '';
  const actionType = rawType || null;
  const from = typeof req.query.from === 'string' && req.query.from.match(/^\d{4}-\d{2}-\d{2}$/) ? req.query.from : null;
  const to = typeof req.query.to === 'string' && req.query.to.match(/^\d{4}-\d{2}-\d{2}$/) ? req.query.to : null;

  // Server-side category filter — maps category name to icon values
  const CATEGORY_ICONS: Record<string, string[]> = {
    Portfolio: ['briefcase', 'portfolio', 'image', 'code', 'file'],
    Reminders: ['bell', 'clock', 'alarm', 'reminder'],
    Integrations: ['link', 'link2', 'webhook', 'zap', 'automation'],
    Agent: ['bot', 'brain', 'cpu', 'sparkles', 'message'],
  };
  const rawCategory = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const categoryIcons = CATEGORY_ICONS[rawCategory] ?? null;

  const whereClauses: string[] = ['user_id = ?'];
  const params: unknown[] = [userId];
  if (q) { whereClauses.push('(action LIKE ? OR details LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (actionType) { whereClauses.push('action = ?'); params.push(actionType); }
  if (from) { whereClauses.push("date(created_at) >= ?"); params.push(from); }
  if (to) { whereClauses.push("date(created_at) <= ?"); params.push(to); }
  if (categoryIcons) {
    const placeholders = categoryIcons.map(() => '?').join(', ');
    whereClauses.push(`icon IN (${placeholders})`);
    params.push(...categoryIcons);
  }
  const where = whereClauses.join(' AND ');

  try {
    const entries = db.prepare(`
      SELECT id, action, details, icon, created_at
      FROM activity_log WHERE ${where}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM activity_log WHERE ${where}`
    ).get(...params) as { total: number };

    const payload = { activity: entries, total };

    if (!q && !actionType && !from && !to && !categoryIcons && offset === 0) {
      cacheSet(`activity:${userId}`, JSON.stringify(payload), 8).catch(() => {});
    }

    res.json(payload);
  } catch (err) {
    logger.error({ err, userId }, 'Activity fetch error');
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ── DELETE /api/activity — clear all entries ─────────────────
activityRouter.delete('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const result = db.prepare('DELETE FROM activity_log WHERE user_id = ?').run(userId);
  invalidateActivityCache(userId);
  res.json({ deleted: result.changes });
});

// ── GET /api/activity/heatmap — 90 days of activity counts ──
activityRouter.get('/heatmap', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const cacheKey = `activity:heatmap:${userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.json(JSON.parse(cached)); return; }

  try {
    const rows = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM activity_log
      WHERE user_id = ? AND created_at >= datetime('now', '-90 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all(userId) as Array<{ date: string; count: number }>;
    const payload = { heatmap: rows };
    cacheSet(cacheKey, JSON.stringify(payload), 30).catch(() => {});
    res.json(payload);
  } catch (err) {
    logger.error({ err, userId }, 'Activity heatmap error');
    res.status(500).json({ error: 'Failed to fetch heatmap' });
  }
});

// ── GET /api/activity/stats — 7-day daily counts ────────────
activityRouter.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const cached = await cacheGet(`activity:stats:${userId}`);
  if (cached) { res.json(JSON.parse(cached)); return; }

  try {
    const days: { date: string; messages: number; reminders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const msgs = db.prepare(
        `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user' AND created_at LIKE ?`
      ).get(userId, `${dateStr}%`) as { c: number };
      const rems = db.prepare(
        `SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND created_at LIKE ?`
      ).get(userId, `${dateStr}%`) as { c: number };
      days.push({ date: dateStr, messages: msgs.c, reminders: rems.c });
    }

    const payload = { days };
    cacheSet(`activity:stats:${userId}`, JSON.stringify(payload), 30).catch(() => {});
    res.json(payload);
  } catch (err) {
    logger.error({ err, userId }, 'Activity stats error');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/activity/stream (SSE) ───────────────────────────
activityRouter.get('/stream', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(':ok\n\n');

  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId)!.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(userId)?.delete(res);
    if (sseClients.get(userId)?.size === 0) sseClients.delete(userId);
  });
});

// ── GET /api/activity/export — CSV download (last 500) ──────
activityRouter.get('/export', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = db.prepare(`
    SELECT id, action, details, icon, created_at
    FROM activity_log WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 500
  `).all(userId) as Array<{ id: string; action: string; details: string; icon: string; created_at: string }>;

  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let csv = 'date,time,type,description\n';
  for (const r of rows) {
    const ts = r.created_at.includes('T') ? r.created_at : r.created_at.replace(' ', 'T') + 'Z';
    const d = new Date(ts);
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = d.toISOString().slice(11, 19);
    csv += `${escape(dateStr)},${escape(timeStr)},${escape(r.action)},${escape(r.details)}\n`;
  }
  const today = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="agentin-activity-${today}.csv"`);
  res.send(csv);
});

// ── DELETE /api/activity/:id — delete single entry ──────────
activityRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const result = db.prepare('DELETE FROM activity_log WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  invalidateActivityCache(userId);
  res.json({ deleted: 1 });
});
