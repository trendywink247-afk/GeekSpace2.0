// ============================================================
// Global Search Route — queries notes, reminders, habits, memories
// GET /api/search?q=<term>
//
// Pipeline: Meilisearch (typo-tolerant, instant) first,
//           SQLite LIKE fallback, merged + deduplicated.
// ============================================================

import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { searchContent } from '../services/search-index.js';

const searchRouter = Router();

interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  created_at?: string;
  source?: string;
}

searchRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) {
    res.json({ results: [] });
    return;
  }

  const userId = req.userId!;
  const query = q.trim();
  const term = `%${query}%`;

  try {
    // ── Meilisearch (typo-tolerant, instant) ───────────────────
    let meiliResults: SearchResult[] = [];
    try {
      const meili = await searchContent(userId, query, { limit: 15 });
      meiliResults = (meili.hits || []).map(h => ({
        id: h.id,
        type: h.type,
        title: h.title,
        snippet: (h.content || '').slice(0, 200),
        source: 'meilisearch',
      }));
    } catch {
      // Meilisearch unavailable -- fall through to SQLite
    }

    // ── SQLite LIKE fallback ───────────────────────────────────
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

    const reminders = db.prepare(`
      SELECT id, 'reminder' AS type, text AS title, text AS snippet, created_at
      FROM reminders
      WHERE user_id = ? AND completed = 0 AND text LIKE ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId, term) as Array<{
      id: string; type: string; title: string; snippet: string; created_at: string;
    }>;

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

    const sqliteResults: SearchResult[] = [
      ...notes.map(r => ({ ...r, id: String(r.id), source: 'sqlite' })),
      ...reminders.map(r => ({ ...r, source: 'sqlite' })),
      ...habits.map(r => ({ ...r, id: String(r.id), source: 'sqlite' })),
      ...memories.map(r => ({ ...r, id: String(r.id), source: 'sqlite' })),
    ];

    // ── Merge: Meilisearch first, deduplicate by id ────────────
    const seenIds = new Set(meiliResults.map(r => r.id));
    const sqliteFiltered = sqliteResults.filter(r => !seenIds.has(r.id));
    const merged = [...meiliResults, ...sqliteFiltered].slice(0, 20);

    res.json({ results: merged });
  } catch (err) {
    logger.error({ err, userId }, 'Global search query failed');
    res.status(500).json({ error: 'Search failed' });
  }
});

export default searchRouter;
