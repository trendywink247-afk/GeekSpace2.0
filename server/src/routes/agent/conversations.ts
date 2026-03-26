/**
 * @fileoverview Conversation history routes — message retrieval, export, reactions, and quality rating.
 *
 * Endpoints:
 * - GET    /conversations                    — Recent conversation history (default 50, max 200)
 * - GET    /conversations/export             — Export history as JSON or Markdown attachment
 * - GET    /conversations/starred            — All starred messages, newest first
 * - GET    /conversations/ratings            — Paginated assistant messages with quality scores
 * - GET    /conversations/reactions/summary  — Top 10 emoji reactions grouped by count
 * - POST   /conversations/reactions          — Record an emoji reaction on a message (upsert)
 * - POST   /conversations/:id/star           — Toggle star status on a message
 * - POST   /conversations/:id/rating         — Set a 1–5 quality score on an assistant message
 *
 * All endpoints require authentication. Row-level access is enforced on per-ID operations.
 */
// Extracted from agent.ts — Sprint 3 decomposition
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { db } from '../../db/index.js';
import { logger } from '../../logger.js';
import { getRecentConversations, getConversationContext } from '../../services/memory.js';

const router = Router();

/**
 * Maps a raw `conversation_log` DB row to the camelCase API response shape.
 * Coerces the SQLite integer `starred` field to a boolean.
 * @param row - Raw row from `conversation_log` (keys are snake_case).
 * @returns Camelcase conversation object suitable for JSON responses.
 */
function mapConversation(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    summary: row.summary,
    tags: row.tags,
    createdAt: row.created_at,
    starred: !!row.starred,
  };
}

/**
 * GET /api/agent/conversations
 * Returns the authenticated user's recent conversation history.
 * @query limit - Number of messages to return (default 50, max 200).
 * @query search - Optional substring filter applied by the memory service.
 */
router.get('/conversations', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const search = req.query.search as string | undefined;
  const conversations = getRecentConversations(req.userId!, limit, search);
  res.json((conversations as unknown as Record<string, unknown>[]).map(mapConversation));
});

// ---- Conversation Export ----

/**
 * GET /api/agent/conversations/export
 * Exports conversation history as a downloadable file.
 * @query days - Rolling window in days (0 = all time, default 0).
 * @query format - 'json' (default) or 'md' (Markdown with role headers).
 * @returns File attachment: `conversations.json` or `geekspace-chat.md`.
 */
router.get('/conversations/export', requireAuth, (req: AuthRequest, res) => {
  try {
    const allConversations = getRecentConversations(req.userId!, 1000);
    const days = Math.max(0, parseInt(req.query.days as string, 10) || 0);
    const conversations = days > 0
      ? allConversations.filter(c => {
          if (!c.created_at) return false;
          const cutoff = new Date(Date.now() - days * 86400000).toISOString();
          return c.created_at >= cutoff;
        })
      : allConversations;
    const format = (req.query.format as string | undefined) ?? 'json';

    if (format === 'md') {
      // Render as Markdown — oldest first, role headers, blank line between turns
      const sorted = [...conversations].reverse();
      const lines: string[] = ['# GeekSpace Chat Export\n'];
      for (const c of sorted) {
        const role = c.role === 'user' ? '**You**' : '**Assistant**';
        const ts = c.created_at ? `  \n_${c.created_at}_` : '';
        lines.push(`### ${role}${ts}\n\n${c.content}\n`);
      }
      const md = lines.join('\n---\n\n');
      res.setHeader('Content-Disposition', 'attachment; filename="geekspace-chat.md"');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(md);
      return;
    }

    const data = (conversations as unknown as Record<string, unknown>[]).map(mapConversation);
    res.setHeader('Content-Disposition', 'attachment; filename="conversations.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) {
    logger.error({ err }, 'conversations/export failed');
    res.status(500).json({ error: 'Failed to export conversations' });
  }
});

// ---- Message Reactions ----

/**
 * POST /api/agent/conversations/reactions
 * Records an emoji reaction for a conversation message (upsert by user+message).
 * @body messageId - ID of the `conversation_log` message being reacted to.
 * @body reaction - Emoji string representing the reaction (e.g. '👍').
 */
router.post('/conversations/reactions', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { messageId, reaction } = req.body as { messageId?: string; reaction?: string };
  if (!messageId || !reaction) {
    res.status(400).json({ error: 'messageId and reaction are required' });
    return;
  }
  try {
    db.prepare(
      'INSERT OR REPLACE INTO message_reactions (id, user_id, message_id, reaction, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(`${userId}-${messageId}`, userId, messageId, reaction);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to save reaction');
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

// ---- Reactions Summary ----

/**
 * GET /api/agent/conversations/reactions/summary
 * Returns the top 10 emoji reactions for the authenticated user, sorted by count.
 * @returns { reactions: Array<{ reaction: string; count: number }> }
 */
router.get('/conversations/reactions/summary', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    // Get top reactions grouped by reaction emoji with count
    const rows = db.prepare(
      `SELECT reaction, COUNT(*) as count
       FROM message_reactions
       WHERE user_id = ?
       GROUP BY reaction
       ORDER BY count DESC
       LIMIT 10`
    ).all(userId) as { reaction: string; count: number }[];
    res.json({ reactions: rows });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to get reaction summary');
    res.status(500).json({ error: 'Failed to get reaction summary' });
  }
});

// ---- 60.2: Star/unstar a conversation message ----

/**
 * POST /api/agent/conversations/:id/star
 * Toggles the star status of a conversation message (must belong to the caller).
 * @param id - `conversation_log` message UUID.
 * @returns { starred: boolean } — new starred state after toggle.
 */
router.post('/conversations/:id/star', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const row = db.prepare('SELECT id, user_id, starred FROM conversation_log WHERE id = ? AND user_id = ?').get(req.params.id, userId) as { id: string; user_id: string; starred: number } | undefined;
  if (!row) { res.status(404).json({ error: 'Message not found' }); return; }
  const newStarred = row.starred ? 0 : 1;
  db.prepare('UPDATE conversation_log SET starred = ? WHERE id = ? AND user_id = ?').run(newStarred, req.params.id, userId);
  res.json({ starred: !!newStarred });
});

/**
 * GET /api/agent/conversations/starred
 * Returns all starred messages for the authenticated user, newest first.
 * Must be declared before /:id routes to avoid Express treating "starred" as an id param.
 * @query limit - Max messages to return (default 50, max 200).
 * @returns { messages: ConversationRow[] }
 */
router.get('/conversations/starred', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const rows = db.prepare(
    'SELECT * FROM conversation_log WHERE user_id = ? AND starred = 1 ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as Record<string, unknown>[];
  res.json({ messages: rows.map(mapConversation) });
});

// ── Phase 109: Conversation Quality Rating ─────────────────────────────────

/**
 * GET /api/agent/conversations/ratings
 * Returns paginated assistant messages with their quality scores and the preceding user message.
 * Used by the Quality Review UI to rate LLM response quality (1–5 stars).
 * @query page - Page number (default 1).
 * @query limit - Items per page (default 20, max 50).
 * @returns { conversations, total, page, limit, totalPages }
 */
router.get('/conversations/ratings', requireAuth, (req: AuthRequest, res): void => {
  const userId = req.userId!;
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const rows = db.prepare(`
      SELECT
        a.id,
        a.content AS assistant_content,
        a.provider,
        a.model,
        a.quality_score,
        a.created_at,
        u.content AS user_content
      FROM conversation_log a
      LEFT JOIN conversation_log u ON (
        u.user_id = a.user_id
        AND u.role = 'user'
        AND u.created_at = (
          SELECT MAX(x.created_at) FROM conversation_log x
          WHERE x.user_id = a.user_id AND x.role = 'user' AND x.created_at <= a.created_at
        )
      )
      WHERE a.user_id = ? AND a.role = 'assistant'
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as Array<{
      id: string;
      assistant_content: string;
      provider: string;
      model: string;
      quality_score: number | null;
      created_at: string;
      user_content: string | null;
    }>;

    const total = (db.prepare(`SELECT COUNT(*) as count FROM conversation_log WHERE user_id = ? AND role = 'assistant'`).get(userId) as { count: number }).count;

    res.json({
      conversations: rows.map(r => ({
        id: r.id,
        userMessage: r.user_content ?? '',
        assistantMessage: r.assistant_content,
        provider: r.provider,
        model: r.model,
        qualityScore: r.quality_score,
        createdAt: r.created_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch conversations for rating');
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/agent/conversations/:id/rating
 * Sets a quality score (1–5) on an assistant message owned by the caller.
 * @param id - `conversation_log` UUID of an assistant-role message.
 * @body score - Integer 1–5 inclusive.
 * @returns { success: true, id, score } on success.
 */
router.post('/conversations/:id/rating', requireAuth, (req: AuthRequest, res): void => {
  const userId = req.userId!;
  const { id } = req.params;
  const { score } = req.body as { score?: unknown };

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    res.status(400).json({ error: 'score must be an integer between 1 and 5' });
    return;
  }

  try {
    const row = db.prepare('SELECT id FROM conversation_log WHERE id = ? AND user_id = ? AND role = ?').get(id, userId, 'assistant') as { id: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    db.prepare('UPDATE conversation_log SET quality_score = ? WHERE id = ? AND user_id = ?').run(score, id, userId);
    res.json({ success: true, id, score });
  } catch (err) {
    logger.error({ err, userId, id }, 'Failed to update conversation rating');
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

export default router;
