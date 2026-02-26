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

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const tagsJson = JSON.stringify(parsedTags);

  // Check for near-duplicate (same LOWER(TRIM(title)) for this user)
  const duplicate = db.prepare(
    `SELECT id FROM suggestions WHERE user_id = ? AND LOWER(TRIM(title)) = LOWER(TRIM(?))`
  ).get(userId, trimmedTitle) as { id: string } | undefined;

  const id = uuid();
  db.prepare(`
    INSERT INTO suggestions (id, user_id, title, body, tags, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'new', datetime('now'), datetime('now'))
  `).run(id, userId, trimmedTitle, trimmedBody, tagsJson);

  const suggestion = db.prepare(
    `SELECT id, user_id as userId, title, body, tags, status, created_at as createdAt, updated_at as updatedAt FROM suggestions WHERE id = ?`
  ).get(id) as Record<string, unknown>;

  logger.info({ userId, suggestionId: id }, 'Suggestion created');

  res.status(201).json({
    ...suggestion,
    tags: (() => { try { return JSON.parse(suggestion.tags as string); } catch { return []; } })(),
    duplicate_warning: duplicate ? true : undefined,
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
  const clusters = db.prepare(`
    SELECT
      c.id,
      c.canonical_summary as canonicalSummary,
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

  const parsed = clusters.map(c => ({
    ...c,
    tags: (() => { try { return JSON.parse(c.tags as string); } catch { return []; } })(),
    suggestionIds: (() => { try { return JSON.parse(c.suggestionIds as string); } catch { return []; } })(),
  }));

  res.json({ clusters: parsed });
});

// ---- GET /api/suggestions/mine — list user's own suggestions ----
suggestionsRouter.get('/mine', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = db.prepare(
    `SELECT id, user_id as userId, title, body, tags, status, created_at as createdAt, updated_at as updatedAt
     FROM suggestions WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId) as Array<Record<string, unknown>>;

  const suggestions = rows.map(r => ({
    ...r,
    tags: (() => { try { return JSON.parse(r.tags as string); } catch { return []; } })(),
  }));

  res.json({ suggestions });
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
