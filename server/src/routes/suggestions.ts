// ============================================================
// Suggestions API — POST/GET /api/suggestions
// User-facing: submit, list own, view clusters, rewards ledger
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { getUserRewards } from '../services/rewards.js';
import { config } from '../config.js';

export const suggestionsRouter = Router();

// ── Word-overlap helper (Task 68.9) ──────────────────────────────────────────
function wordOverlap(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (!wordsA.length || !wordsB.length) return 0;
  const setA = new Set(wordsA);
  const common = wordsB.filter(w => setA.has(w)).length;
  return common / Math.max(wordsA.length, wordsB.length);
}

// ── Clusters cache (Task 68.11) ───────────────────────────────────────────────
const clustersCache: { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
export function invalidateClustersCache(): void {
  clustersCache.data = null;
  clustersCache.expiresAt = 0;
}

// ---- POST /api/suggestions — create a suggestion ----
suggestionsRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { title, body, tags } = req.body as { title?: unknown; body?: unknown; tags?: unknown };

  // Validate title
  if (typeof title !== 'string' || title.trim().length < 1) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (title.trim().length > 100) {
    res.status(400).json({ error: 'title must be 100 characters or fewer' });
    return;
  }

  // Validate body
  if (typeof body !== 'string' || body.trim().length < 20) {
    res.status(400).json({ error: 'body must be at least 20 characters' });
    return;
  }
  if (body.trim().length > 2000) {
    res.status(400).json({ error: 'body must be 2000 characters or fewer' });
    return;
  }

  // Validate tags
  let parsedTags: string[] = [];
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      res.status(400).json({ error: 'tags must be an array' });
      return;
    }
    if (tags.length > 5) {
      res.status(400).json({ error: 'tags must have 5 or fewer items' });
      return;
    }
    parsedTags = (tags as unknown[]).map(String);
  }

  // Rate limit: max 5 per user per hour (skip in test mode)
  if (!config.isTestMode) {
    const recentCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM suggestions WHERE user_id = ? AND created_at > datetime('now', '-1 hour')"
    ).get(userId) as { cnt: number };
    if (recentCount.cnt >= 5) {
      res.status(429).json({ error: 'Too many suggestions. Try again later.' });
      return;
    }
  }

  // Global cap: max 20 suggestions per user total (skip in test mode)
  if (!config.isTestMode) {
    const totalCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM suggestions WHERE user_id = ? AND deleted_at IS NULL`
    ).get(userId) as { cnt: number };
    if (totalCount.cnt >= 20) {
      res.status(429).json({ error: 'Suggestion limit reached', limit: 20 });
      return;
    }
  }

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const tagsJson = JSON.stringify(parsedTags);

  // Check for near-duplicate (Task 68.9): exact title match OR 60% word overlap on body
  const existingSuggestions = db.prepare(
    `SELECT id, title, body FROM suggestions WHERE user_id = ?`
  ).all(userId) as Array<{ id: string; title: string; body: string }>;

  let duplicateWarning = false;

  // Exact title match
  const exactTitleDup = existingSuggestions.find(
    s => s.title.toLowerCase().trim() === trimmedTitle.toLowerCase()
  );
  if (exactTitleDup) {
    duplicateWarning = true;
  }

  // Word overlap on body (>= 60%)
  if (!duplicateWarning) {
    for (const s of existingSuggestions) {
      if (wordOverlap(trimmedBody, s.body) >= 0.6) {
        duplicateWarning = true;
        break;
      }
    }
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO suggestions (id, user_id, title, body, tags, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))
  `).run(id, userId, trimmedTitle, trimmedBody, tagsJson);

  const suggestion = db.prepare(
    `SELECT id, user_id as userId, title, body, tags, status, created_at as createdAt, updated_at as updatedAt FROM suggestions WHERE id = ?`
  ).get(id) as Record<string, unknown>;

  // Task 68.10: Log activity for suggestion creation
  try {
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(uuid(), userId, 'Submitted suggestion', trimmedTitle, 'lightbulb');
  } catch { /* non-fatal */ }

  logger.info({ userId, suggestionId: id }, 'Suggestion created');

  // Invalidate clusters cache since a new suggestion was created
  invalidateClustersCache();

  res.status(201).json({
    ...suggestion,
    tags: (() => { try { return JSON.parse(suggestion.tags as string); } catch { return []; } })(),
    duplicate_warning: duplicateWarning ? true : undefined,
  });
});

// ---- GET /api/suggestions/rewards/mine — user reward ledger ----
// MUST be before /:id to prevent Express treating 'rewards' as an ID param
suggestionsRouter.get('/rewards/mine', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rewards = getUserRewards(userId);
  res.json({ rewards });
});

// ---- GET /api/suggestions/clusters — all clusters with scores (public summaries) ----
suggestionsRouter.get('/clusters', requireAuth, (req: AuthRequest, res) => {
  // Task 68.11: 30-second in-memory cache (skip in TEST_MODE)
  if (!config.isTestMode && clustersCache.data !== null && Date.now() < clustersCache.expiresAt) {
    res.json({ clusters: clustersCache.data });
    return;
  }

  // Task 68.6: include vote counts for each suggestion in the cluster
  // Task 70.5: include name field
  const clusters = db.prepare(`
    SELECT
      c.id,
      c.canonical_summary as canonicalSummary,
      c.name,
      c.tags,
      c.suggestion_ids as suggestionIds,
      c.created_at as createdAt,
      c.updated_at as updatedAt,
      s.demand_score as demandScore,
      s.impact_score as impactScore,
      s.effort_score as effortScore,
      s.risk_score as riskScore,
      s.overall_score as overallScore,
      s.rationale
    FROM suggestion_clusters c
    LEFT JOIN suggestion_scores s ON s.cluster_id = c.id
    ORDER BY s.overall_score DESC, c.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const parsed = clusters.map(c => {
    const suggestionIds: string[] = (() => {
      try { return JSON.parse(c.suggestionIds as string) as string[]; } catch { return []; }
    })();

    // Sum votes for all suggestions in this cluster
    let totalVotes = 0;
    if (suggestionIds.length > 0) {
      const placeholders = suggestionIds.map(() => '?').join(',');
      const voteRow = db.prepare(
        `SELECT COALESCE(SUM(vote), 0) as total_votes FROM suggestion_votes WHERE suggestion_id IN (${placeholders})`
      ).get(...suggestionIds) as { total_votes: number } | undefined;
      totalVotes = voteRow?.total_votes ?? 0;
    }

    return {
      ...c,
      tags: (() => { try { return JSON.parse(c.tags as string); } catch { return []; } })(),
      suggestionIds,
      total_votes: totalVotes,
    };
  });

  // Cache for 30s (skip in test mode)
  if (!config.isTestMode) {
    clustersCache.data = parsed;
    clustersCache.expiresAt = Date.now() + 30000;
  }

  res.json({ clusters: parsed });
});

// ---- GET /api/suggestions/mine — list user's own suggestions (paginated) ----
suggestionsRouter.get('/mine', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Task 68.3: pagination
  const rawPage = parseInt(String(req.query.page || '1'), 10);
  const rawLimit = parseInt(String(req.query.limit || '10'), 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit));
  const offset = (page - 1) * limit;

  const total = (db.prepare(
    `SELECT COUNT(*) as cnt FROM suggestions WHERE user_id = ? AND deleted_at IS NULL`
  ).get(userId) as { cnt: number }).cnt;

  const rows = db.prepare(
    `SELECT s.id, s.user_id as userId, s.title, s.body, s.tags, s.status, s.created_at as createdAt, s.updated_at as updatedAt,
            COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) as upvotes,
            COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) as downvotes
     FROM suggestions s
     LEFT JOIN suggestion_votes v ON v.suggestion_id = s.id
     WHERE s.user_id = ? AND s.deleted_at IS NULL
     GROUP BY s.id
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
  ).all(userId, limit, offset) as Array<Record<string, unknown>>;

  const suggestions = rows.map(r => ({
    ...r,
    tags: (() => { try { return JSON.parse(r.tags as string); } catch { return []; } })(),
    trending: (r.trending as number | null) ?? 0,
  }));

  res.json({ suggestions, total, page, limit });
});

// ---- POST /api/suggestions/:id/vote — vote on a suggestion ----
// MUST be before GET /:id to prevent route conflict
suggestionsRouter.post('/:id/vote', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { vote } = req.body as { vote?: unknown };

  if (vote !== 1 && vote !== -1) {
    res.status(400).json({ error: 'vote must be 1 or -1' });
    return;
  }

  const suggestion = db.prepare(`SELECT id FROM suggestions WHERE id = ?`).get(id) as { id: string } | undefined;
  if (!suggestion) {
    res.status(404).json({ error: 'Suggestion not found' });
    return;
  }

  // INSERT OR REPLACE to handle vote changes (UNIQUE constraint on suggestion_id + user_id)
  db.prepare(`
    INSERT OR REPLACE INTO suggestion_votes (id, suggestion_id, user_id, vote, created_at)
    VALUES (COALESCE((SELECT id FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?), ?), ?, ?, ?, datetime('now'))
  `).run(id, userId, uuid(), id, userId, vote as number);

  // Phase 69.2: Log vote activity
  try {
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(uuid(), userId, 'vote_suggestion', JSON.stringify({ suggestionId: id, vote }), 'thumbs-up');
  } catch { /* non-fatal */ }

  const upvotes = (db.prepare(
    `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND vote = 1`
  ).get(id) as { cnt: number }).cnt;

  const downvotes = (db.prepare(
    `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND vote = -1`
  ).get(id) as { cnt: number }).cnt;

  logger.info({ userId, suggestionId: id, vote }, 'Suggestion vote recorded');
  res.json({ upvotes, downvotes });
});

// ---- GET /api/suggestions/:id — get own suggestion by id ----
suggestionsRouter.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const row = db.prepare(
    `SELECT id, user_id as userId, title, body, tags, status, created_at as createdAt, updated_at as updatedAt
     FROM suggestions WHERE id = ?`
  ).get(id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Suggestion not found' });
    return;
  }

  if (row.userId !== userId) {
    res.status(404).json({ error: 'Suggestion not found' });
    return;
  }

  res.json({
    ...row,
    tags: (() => { try { return JSON.parse(row.tags as string); } catch { return []; } })(),
  });
});

// ---- GET /api/suggestions/:id/events — status history for own suggestion (Task 69.6) ----
// MUST be after POST /:id/vote and GET /:id to avoid route conflicts with /vote
suggestionsRouter.get('/:id/events', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  // Verify suggestion exists and belongs to user
  const suggestion = db.prepare(
    `SELECT id FROM suggestions WHERE id = ? AND user_id = ?`
  ).get(id, userId) as { id: string } | undefined;

  if (!suggestion) {
    res.status(404).json({ error: 'Suggestion not found' });
    return;
  }

  const events = db.prepare(`
    SELECT
      id,
      suggestion_id as suggestionId,
      from_status as oldStatus,
      to_status as newStatus,
      actor as changedBy,
      created_at as changedAt
    FROM suggestion_events
    WHERE suggestion_id = ?
    ORDER BY created_at ASC
  `).all(id) as Array<{
    id: string;
    suggestionId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    changedAt: string;
  }>;

  res.json({ events });
});
