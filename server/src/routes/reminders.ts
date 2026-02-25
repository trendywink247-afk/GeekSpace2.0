import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, reminderCreateSchema, reminderUpdateSchema, bulkReminderDeleteSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';

export const remindersRouter = Router();

remindersRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY datetime ASC').all(req.userId!) as Array<Record<string, unknown>>;
  // Map snake_case DB fields to camelCase for frontend consistency
  const reminders = rows.map(r => ({
    ...r,
    createdBy: r.created_by,
    createdAt: r.created_at,
    userId: r.user_id,
    picoTaskId: r.pico_task_id,
  }));
  res.json(reminders);
});

remindersRouter.post('/', requireAuth, validateBody(reminderCreateSchema), (req: AuthRequest, res) => {
  const { text, datetime, channel, category, recurring } = req.body;

  const id = uuid();
  const scheduledFor = datetime ? new Date(datetime).getTime() : Date.now();

  db.prepare('INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, text, datetime || '', channel || 'push', category || 'general', recurring || '', 'user', scheduledFor
  );
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`).run(uuid(), req.userId, text);

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  res.status(201).json(reminder);
});

remindersRouter.patch('/:id', requireAuth, validateBody(reminderUpdateSchema), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updates = req.body as Record<string, unknown>;
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ['text', 'datetime', 'channel', 'category', 'recurring', 'completed']) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(typeof updates[key] === 'boolean' ? (updates[key] ? 1 : 0) : updates[key]);
    }
  }
  if (fields.length) {
    values.push(req.params.id, req.userId);
    db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
  res.json(reminder);
});

remindersRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

// ── Bulk Delete (25.5) ─────────────────────────────────────────────────────
remindersRouter.delete('/bulk', requireAuth, validateBody(bulkReminderDeleteSchema), (req: AuthRequest, res) => {
  const { ids } = req.body as { ids: string[] };

  // Validate all IDs belong to the requesting user before deleting
  const placeholders = ids.map(() => '?').join(', ');
  const owned = db.prepare(
    `SELECT id FROM reminders WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, req.userId!) as Array<{ id: string }>;

  if (owned.length === 0) {
    res.json({ deleted: 0 });
    return;
  }

  const ownedIds = owned.map((r) => r.id);
  const delPlaceholders = ownedIds.map(() => '?').join(', ');
  const result = db.prepare(`DELETE FROM reminders WHERE id IN (${delPlaceholders})`).run(...ownedIds);

  res.json({ deleted: result.changes });
});
