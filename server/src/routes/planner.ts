// ============================================================
// Planner API — daily time-block planner with backend persistence
// GAP-1: Replaces localStorage-only approach
// ============================================================

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export const plannerRouter = Router();

// ── Zod schemas ─────────────────────────────────────────────

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const createBlockSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  date: dateSchema,
  duration: z.number().int().min(1).max(1440).default(30),
  color: z.string().max(20).default('#00F0FF'),
  category: z.string().max(50).default('work'),
  completed: z.number().int().min(0).max(1).default(0),
  sort_order: z.number().int().min(0).default(0),
  source: z.string().max(50).default('manual'),
  source_id: z.string().max(200).nullable().optional(),
});

const updateBlockSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  date: dateSchema.optional(),
  duration: z.number().int().min(1).max(1440).optional(),
  color: z.string().max(20).optional(),
  category: z.string().max(50).optional(),
  completed: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().min(0).optional(),
  source: z.string().max(50).optional(),
  source_id: z.string().max(200).nullable().optional(),
});

// ── Prepared statements ─────────────────────────────────────

const stmts = {
  getByDate: db.prepare(`
    SELECT * FROM planner_blocks
    WHERE user_id = ? AND date = ?
    ORDER BY sort_order ASC, created_at ASC
  `),
  getByDateRange: db.prepare(`
    SELECT * FROM planner_blocks
    WHERE user_id = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, sort_order ASC, created_at ASC
  `),
  getById: db.prepare(`
    SELECT * FROM planner_blocks WHERE id = ?
  `),
  insert: db.prepare(`
    INSERT INTO planner_blocks (id, user_id, date, title, duration, color, category, completed, sort_order, source, source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  deleteById: db.prepare(`
    DELETE FROM planner_blocks WHERE id = ? AND user_id = ?
  `),
};

// ── Helper ──────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Routes ──────────────────────────────────────────────────

// GET /api/planner/week/:date — get 7 days of blocks starting from date
// Must be before /:date to avoid route conflict
plannerRouter.get('/week/:date', requireAuth, (req: AuthRequest, res) => {
  const parsed = dateSchema.safeParse(req.params.date);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    return;
  }

  const startDate = parsed.data;
  const endDate = addDays(startDate, 6);

  try {
    const rows = stmts.getByDateRange.all(req.userId!, startDate, endDate) as Record<string, unknown>[];

    // Group by date
    const byDate: Record<string, unknown[]> = {};
    for (let i = 0; i < 7; i++) {
      byDate[addDays(startDate, i)] = [];
    }
    for (const row of rows) {
      const d = row.date as string;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(row);
    }

    res.json({ blocks: byDate });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch weekly planner blocks');
    res.status(500).json({ error: 'Failed to fetch weekly blocks' });
  }
});

// GET /api/planner/:date — get blocks for a specific date
plannerRouter.get('/:date', requireAuth, (req: AuthRequest, res) => {
  const parsed = dateSchema.safeParse(req.params.date);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    return;
  }

  try {
    const rows = stmts.getByDate.all(req.userId!, parsed.data);
    res.json({ blocks: rows });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch planner blocks');
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});

// POST /api/planner — create a new block
plannerRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const parsed = createBlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    return;
  }

  const { title, date, duration, color, category, completed, sort_order, source, source_id } = parsed.data;
  const id = uuid();

  try {
    stmts.insert.run(id, req.userId!, date, title, duration, color, category, completed, sort_order, source, source_id ?? null);
    const block = stmts.getById.get(id);
    res.status(201).json({ block });
  } catch (err) {
    logger.error({ err }, 'Failed to create planner block');
    res.status(500).json({ error: 'Failed to create block' });
  }
});

// PATCH /api/planner/:id — update a block
plannerRouter.patch('/:id', requireAuth, (req: AuthRequest, res) => {
  const parsed = updateBlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    return;
  }

  const existing = stmts.getById.get(req.params.id) as { user_id: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Block not found' });
    return;
  }
  if (existing.user_id !== req.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const fields = parsed.data;
  const keys = Object.keys(fields).filter(k => fields[k as keyof typeof fields] !== undefined);
  if (keys.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  // Build dynamic UPDATE
  const setClauses = keys.map(k => `${k} = ?`);
  setClauses.push("updated_at = datetime('now')");
  const values = keys.map(k => {
    const val = fields[k as keyof typeof fields];
    return val === null ? null : val;
  });

  try {
    db.prepare(`UPDATE planner_blocks SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...values, req.params.id);
    const updated = stmts.getById.get(req.params.id);
    res.json({ block: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update planner block');
    res.status(500).json({ error: 'Failed to update block' });
  }
});

// DELETE /api/planner/:id — delete a block
plannerRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const existing = stmts.getById.get(req.params.id) as { user_id: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Block not found' });
    return;
  }
  if (existing.user_id !== req.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  try {
    stmts.deleteById.run(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to delete planner block');
    res.status(500).json({ error: 'Failed to delete block' });
  }
});
