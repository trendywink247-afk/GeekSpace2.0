// ============================================================
// Global Search Route — queries notes, reminders, habits, memories, conversations
// GET /api/search?q=<term>&types=notes,reminders,memories,habits,conversations&limit=20
//
// Pipeline: Meilisearch (typo-tolerant, instant) first,
//           SQLite LIKE fallback, merged + deduplicated.
// ============================================================

import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { searchContent } from '../services/search-index.js';

const searchRouter = Router();

const ALL_TYPES = ['notes', 'reminders', 'memories', 'habits', 'conversations'] as const;
type SearchType = typeof ALL_TYPES[number];

// Map result types to their dashboard URLs
const TYPE_URLS: Record<string, string> = {
  note:         '/dashboard/chat',
  reminder:     '/dashboard/reminders',
  habit:        '/dashboard/focus',
  memory:       '/dashboard/personal-memory',
  conversation: '/dashboard/chat',
};

interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  url: string;
  created_at?: string;
  source?: string;
}

searchRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q, types: typesParam, limit: limitParam } = req.query as {
    q?: string;
    types?: string;
    limit?: string;
  };

  if (!q || q.trim().length < 2) {
    res.json({ results: [] });
    return;
  }

  const userId = req.userId!;
  const query = q.trim();
  const term = `%${query}%`;

  // Parse types filter — default to all types
  const requestedTypes = new Set<SearchType>(
    typesParam
      ? (typesParam.split(',').filter(t => (ALL_TYPES as readonly string[]).includes(t)) as SearchType[])
      : [...ALL_TYPES]
  );

  // Parse limit — default 20, max 50
  const maxResults = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50);

  // Per-type sub-limit derived from total
  const perTypeLimit = Math.min(Math.ceil(maxResults / requestedTypes.size), 10);

  try {
    // ── Meilisearch (typo-tolerant, instant) ───────────────────
    let meiliResults: SearchResult[] = [];
    try {
      const meili = await searchContent(userId, query, { limit: maxResults });
      meiliResults = (meili.hits || []).map(h => ({
        id: h.id,
        type: h.type,
        title: h.title,
        snippet: (h.content || '').slice(0, 200),
        url: TYPE_URLS[h.type] || '/dashboard',
        source: 'meilisearch',
      }));
    } catch {
      // Meilisearch unavailable -- fall through to SQLite
    }

    // ── SQLite LIKE fallback ───────────────────────────────────
    const sqliteResults: SearchResult[] = [];

    if (requestedTypes.has('notes')) {
      const notes = db.prepare(`
        SELECT id, 'note' AS type, title, substr(content, 1, 120) AS snippet,
               datetime(created_at / 1000, 'unixepoch') AS created_at
        FROM notes
        WHERE user_id = ? AND archived = 0
          AND (title LIKE ? OR content LIKE ?)
        ORDER BY pinned DESC, updated_at DESC
        LIMIT ?
      `).all(userId, term, term, perTypeLimit) as Array<{
        id: number; type: string; title: string; snippet: string; created_at: string;
      }>;
      sqliteResults.push(
        ...notes.map(r => ({
          ...r,
          id: String(r.id),
          url: '/dashboard/chat',
          source: 'sqlite',
        })),
      );
    }

    if (requestedTypes.has('reminders')) {
      const reminders = db.prepare(`
        SELECT id, 'reminder' AS type, text AS title, text AS snippet, created_at
        FROM reminders
        WHERE user_id = ? AND completed = 0 AND text LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, term, perTypeLimit) as Array<{
        id: string; type: string; title: string; snippet: string; created_at: string;
      }>;
      sqliteResults.push(
        ...reminders.map(r => ({
          ...r,
          url: '/dashboard/reminders',
          source: 'sqlite',
        })),
      );
    }

    if (requestedTypes.has('habits')) {
      const habits = db.prepare(`
        SELECT id, 'habit' AS type, name AS title,
               coalesce(description, name) AS snippet,
               datetime(created_at / 1000, 'unixepoch') AS created_at
        FROM habits
        WHERE user_id = ? AND (name LIKE ? OR description LIKE ?)
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, term, term, perTypeLimit) as Array<{
        id: number; type: string; title: string; snippet: string; created_at: string;
      }>;
      sqliteResults.push(
        ...habits.map(r => ({
          ...r,
          id: String(r.id),
          url: '/dashboard/focus',
          source: 'sqlite',
        })),
      );
    }

    if (requestedTypes.has('memories')) {
      const memories = db.prepare(`
        SELECT id, 'memory' AS type, key AS title, substr(value, 1, 120) AS snippet,
               datetime(created_at / 1000, 'unixepoch') AS created_at
        FROM user_memories
        WHERE user_id = ? AND (key LIKE ? OR value LIKE ?)
        ORDER BY last_used DESC, created_at DESC
        LIMIT ?
      `).all(userId, term, term, perTypeLimit) as Array<{
        id: number; type: string; title: string; snippet: string; created_at: string;
      }>;
      sqliteResults.push(
        ...memories.map(r => ({
          ...r,
          id: String(r.id),
          url: '/dashboard/personal-memory',
          source: 'sqlite',
        })),
      );
    }

    if (requestedTypes.has('conversations')) {
      const conversations = db.prepare(`
        SELECT id, 'conversation' AS type,
               substr(content, 1, 80) AS title,
               substr(content, 1, 120) AS snippet,
               created_at
        FROM conversation_log
        WHERE user_id = ? AND role = 'user' AND content LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, term, perTypeLimit) as Array<{
        id: string; type: string; title: string; snippet: string; created_at: string;
      }>;
      sqliteResults.push(
        ...conversations.map(r => ({
          ...r,
          url: '/dashboard/chat',
          source: 'sqlite',
        })),
      );
    }

    // ── Merge: Meilisearch first, deduplicate by id+type ─────
    const seenKeys = new Set(meiliResults.map(r => `${r.type}:${r.id}`));
    const sqliteFiltered = sqliteResults.filter(r => !seenKeys.has(`${r.type}:${r.id}`));
    const merged = [...meiliResults, ...sqliteFiltered].slice(0, maxResults);

    res.json({ results: merged });
  } catch (err) {
    logger.error({ err, userId }, 'Global search query failed');
    res.status(500).json({ error: 'Search failed' });
  }
});

export default searchRouter;
