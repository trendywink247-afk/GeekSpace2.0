import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const remindersRouter = Router();

remindersRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY datetime ASC').all(req.userId!);
  res.json(reminders);
});

remindersRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const { text, datetime, channel, category, recurring } = req.body;
  if (!text) { res.status(400).json({ error: 'Text is required' }); return; }

  const id = uuid();
  db.prepare('INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, text, datetime || '', channel || 'push', category || 'general', recurring || '', 'user'
  );
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`).run(uuid(), req.userId, text);

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  res.status(201).json(reminder);
});

remindersRouter.patch('/:id', requireAuth, (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updates = req.body;
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
