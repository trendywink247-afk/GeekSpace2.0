// ============================================================
// Global Search Route — queries notes, reminders, habits, memories
// GET /api/search?q=<term>
// ============================================================

import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

const searchRouter = Router();

searchRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) {
    res.json({ results: [] });
    return;
  }

  const userId = req.userId!;
  const term = `%${q.trim()}%`;

  try {
    // notes: title TEXT, content TEXT, created_at INTEGER (ms epoch)
    const notes = db.prepare(`
      SELECT id, 'note' AS type, title, substr(content, 1, 120) AS snippet,
             datetime(created_at / 1000, 'unixepoch') AS created_at
      FROM notes
      WHERE user_id = ? AND archived = 0
        AND (title LIKE ? OR content LIKE ?)
      ORDER BY pinned DESC, updated_at DESC
      LIMIT 5
    `).all(userId, term, term) as Array<{
      id: number; type: string; title: string; snippet: string; created_at: string;
    }>;

    // reminders: text TEXT, datetime TEXT, completed INTEGER
    const reminders = db.prepare(`
      SELECT id, 'reminder' AS type, text AS title, text AS snippet, created_at
      FROM reminders
      WHERE user_id = ? AND completed = 0 AND text LIKE ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId, term) as Array<{
      id: string; type: string; title: string; snippet: string; created_at: string;
    }>;

    // habits: name TEXT, description TEXT, created_at INTEGER (ms epoch)
    const habits = db.prepare(`
      SELECT id, 'habit' AS type, name AS title,
             coalesce(description, name) AS snippet,
             datetime(created_at / 1000, 'unixepoch') AS created_at
      FROM habits
      WHERE user_id = ? AND (name LIKE ? OR description LIKE ?)
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId, term, term) as Array<{
      id: number; type: string; title: string; snippet: string; created_at: string;
    }>;

    // user_memories: key TEXT, value TEXT, created_at INTEGER (ms epoch)
    const memories = db.prepare(`
      SELECT id, 'memory' AS type, key AS title, substr(value, 1, 120) AS snippet,
             datetime(created_at / 1000, 'unixepoch') AS created_at
      FROM user_memories
      WHERE user_id = ? AND (key LIKE ? OR value LIKE ?)
      ORDER BY last_used DESC, created_at DESC
      LIMIT 5
    `).all(userId, term, term) as Array<{
      id: number; type: string; title: string; snippet: string; created_at: string;
    }>;

    const results = [
      ...notes.map(r => ({ ...r, id: String(r.id) })),
      ...reminders,
      ...habits.map(r => ({ ...r, id: String(r.id) })),
      ...memories.map(r => ({ ...r, id: String(r.id) })),
    ];

    res.json({ results });
  } catch (err) {
    logger.error({ err, userId }, 'Global search query failed');
    res.status(500).json({ error: 'Search failed' });
  }
});

export default searchRouter;
