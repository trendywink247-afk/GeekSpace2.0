// Extracted from agent.ts — Sprint 3 decomposition
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, memoryCreateSchema, memoryUpdateSchema } from '../../../middleware/validate.js';
import { db } from '../../../db/index.js';
import { getMemories, getRelevantMemories, deleteMemory, upsertMemory } from '../../../services/memory.js';

const router = Router();

/**
 * Maps a raw `agent_memory` DB row to the camelCase API response shape.
 * Normalises `access_count` to 0 when null (fresh entries never accessed via lookup).
 * @param row - Raw row from `agent_memory` (keys are snake_case).
 * @returns Camelcase memory object suitable for JSON responses.
 */
function mapMemory(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    source: row.source,
    accessCount: row.access_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/agent/memory
 * Returns the authenticated user's stored memories.
 * @query category - Filter by category (e.g. 'preference', 'context'). Omit for all categories.
 * @query search   - Semantic/substring search query. When provided, returns relevant memories ranked by relevance.
 * @query limit    - Maximum results to return (default 100, max 500).
 * @returns Array of memory objects in camelCase.
 */
router.get('/memory', requireAuth, (req: AuthRequest, res) => {
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);

  if (search) {
    const memories = getRelevantMemories(req.userId!, search, limit);
    res.json((memories as unknown as Record<string, unknown>[]).map(mapMemory));
    return;
  }
  const memories = getMemories(req.userId!, category, limit);
  res.json((memories as unknown as Record<string, unknown>[]).map(mapMemory));
});

/**
 * POST /api/agent/memory
 * Creates or updates a memory entry (upsert on category+key).
 * @body category   - Memory category (e.g. 'preference', 'context').
 * @body key        - Unique key within the category.
 * @body value      - Memory value (plain text or JSON string).
 * @body confidence - Confidence score 0–1 (default 1.0).
 * @body source     - Origin of this memory (e.g. 'user', 'assistant', 'system').
 * @returns 201 with the upserted memory object.
 */
router.post('/memory', requireAuth, validateBody(memoryCreateSchema), (req: AuthRequest, res) => {
  const { category, key, value, confidence, source } = req.body;
  upsertMemory(req.userId!, category, key, value, confidence, source);

  const memory = db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? AND category = ? AND key = ?'
  ).get(req.userId!, category, key) as Record<string, unknown>;
  res.status(201).json(mapMemory(memory));
});

/**
 * PUT /api/agent/memory/:id
 * Fully replaces a memory entry by ID.
 * If category or key changes, the old row is deleted and re-inserted to preserve the unique constraint.
 * @param id - UUID of the memory entry to update.
 * @body Partial memory fields (category, key, value, confidence). Missing fields keep existing values.
 * @returns 200 with updated memory object | 404 if not found.
 */
router.put('/memory/:id', requireAuth, validateBody(memoryUpdateSchema), (req: AuthRequest, res) => {
  const existing = db.prepare(
    'SELECT * FROM agent_memory WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as Record<string, unknown> | undefined;

  if (!existing) { res.status(404).json({ error: 'Memory not found' }); return; }

  const category = req.body.category ?? existing.category;
  const key = req.body.key ?? existing.key;
  const value = req.body.value ?? existing.value;
  const confidence = req.body.confidence ?? existing.confidence;

  // Delete old entry if category or key changed (unique constraint)
  if (category !== existing.category || key !== existing.key) {
    db.prepare('DELETE FROM agent_memory WHERE id = ?').run(req.params.id);
  }

  upsertMemory(req.userId!, category as string, key as string, value as string, confidence as number, existing.source as string);

  const updated = db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? AND category = ? AND key = ?'
  ).get(req.userId!, category, key) as Record<string, unknown>;
  res.json(mapMemory(updated));
});

/**
 * DELETE /api/agent/memory/bulk-all
 * Permanently deletes ALL memories for the authenticated user.
 * Requires `?confirm=yes` as a safety gate. Also logs the deletion to the activity log.
 * @query confirm - Must be 'yes' or request is rejected with 400.
 * @returns { deleted: number } count of rows removed.
 */
router.delete('/memory/bulk-all', requireAuth, (req: AuthRequest, res) => {
  if (req.query.confirm !== 'yes') {
    res.status(400).json({ error: 'Must pass ?confirm=yes to clear all memories' });
    return;
  }
  const userId = req.userId!;
  const result = db.prepare('DELETE FROM agent_memory WHERE user_id = ?').run(userId);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Cleared all memories', ?, 'trash')`).run(uuid(), userId, `Deleted ${result.changes} memories`);
  res.json({ deleted: result.changes });
});

/**
 * DELETE /api/agent/memory/bulk
 * Deletes all memories belonging to a specific category for the authenticated user.
 * Must be registered before the `/:id` route to avoid path conflicts.
 * @query category - Required. Category to clear (e.g. 'preference', 'context').
 * @returns { deleted: number } count of rows removed | 400 if category is missing.
 */
router.delete('/memory/bulk', requireAuth, (req: AuthRequest, res) => {
  const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : null;
  const userId = req.userId!;
  if (!category) { res.status(400).json({ error: 'category query param is required' }); return; }
  const result = db.prepare('DELETE FROM agent_memory WHERE user_id = ? AND category = ?').run(userId, category);
  res.json({ deleted: result.changes });
});

/**
 * DELETE /api/agent/memory/:id
 * Deletes a single memory entry owned by the authenticated user.
 * @param id - UUID of the memory to delete.
 * @returns { success: true } | 404 if not found or not owned by the user.
 */
router.delete('/memory/:id', requireAuth, (req: AuthRequest, res) => {
  const deleted = deleteMemory(req.userId!, req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Memory not found' }); return; }
  res.json({ success: true });
});

export default router;
