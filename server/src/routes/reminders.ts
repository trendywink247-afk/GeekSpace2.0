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
  const { text, datetime, channel, category, recurring, recurrence, priority } = req.body;

  const id = uuid();
  const scheduledFor = datetime ? new Date(datetime).getTime() : Date.now();

  db.prepare('INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, text, datetime || '', channel || 'push', category || 'general', recurring || '', recurrence || null, 'user', scheduledFor, priority || 'normal'
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
  for (const key of ['text', 'datetime', 'channel', 'category', 'recurring', 'completed', 'priority', 'recurrence']) {
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

// ── Complete endpoint with recurrence support ───────────────────────────────
remindersRouter.post('/:id/complete', requireAuth, (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  // Mark this reminder as completed (with timestamp for streak tracking)
  db.prepare('UPDATE reminders SET completed = 1, completed_at = ? WHERE id = ? AND user_id = ?').run(Date.now(), req.params.id, req.userId!);

  // If it has a recurrence, create the next occurrence
  const recurrence = existing.recurrence as string | null | undefined;
  if (recurrence && ['daily', 'weekly', 'monthly'].includes(recurrence)) {
    const currentDatetime = new Date((existing.datetime as string) || new Date().toISOString());
    let nextDatetime: Date;
    if (recurrence === 'daily') {
      nextDatetime = new Date(currentDatetime.getTime() + 1 * 24 * 60 * 60 * 1000);
    } else if (recurrence === 'weekly') {
      nextDatetime = new Date(currentDatetime.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // monthly: +30 days
      nextDatetime = new Date(currentDatetime.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const newId = uuid();
    const scheduledFor = nextDatetime.getTime();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      newId,
      req.userId!,
      existing.text,
      nextDatetime.toISOString(),
      existing.channel || 'push',
      existing.category || 'general',
      existing.recurring || '',
      recurrence,
      'user',
      scheduledFor,
      existing.priority || 'normal',
    );

    const nextReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(newId);
    res.json({ completed: true, nextReminder });
    return;
  }

  res.json({ completed: true, nextReminder: null });
});

// ── Streak endpoint (35.1) ──────────────────────────────────────────────────
remindersRouter.get('/streak', requireAuth, (req: AuthRequest, res) => {
  // Get distinct completion days (YYYY-MM-DD) in descending order
  const rows = db.prepare(`
    SELECT DISTINCT date(completed_at / 1000, 'unixepoch') AS day
    FROM reminders
    WHERE user_id = ? AND completed = 1 AND completed_at IS NOT NULL
    ORDER BY day DESC
  `).all(req.userId!) as Array<{ day: string }>;

  if (rows.length === 0) {
    res.json({ streak: 0, longestStreak: 0, completedToday: false });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const completedToday = rows[0].day === today;

  // Walk backwards counting consecutive days
  let streak = 0;
  let longestStreak = 0;
  let currentStreak = 0;
  let expectedDate = completedToday ? today : yesterday;

  for (const row of rows) {
    if (row.day === expectedDate) {
      currentStreak++;
      if (streak === 0 || completedToday || expectedDate !== today) streak = currentStreak;
      // Move to previous day
      const d = new Date(expectedDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      expectedDate = d.toISOString().slice(0, 10);
    } else {
      if (currentStreak > longestStreak) longestStreak = currentStreak;
      currentStreak = 0;
      break;
    }
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;
  streak = completedToday ? currentStreak : (rows[0].day === yesterday ? currentStreak : 0);

  res.json({ streak, longestStreak, completedToday });
});

remindersRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

// ── Bulk Snooze (29.4) ─────────────────────────────────────────────────────
remindersRouter.post('/bulk-snooze', requireAuth, (req: AuthRequest, res) => {
  const { ids, preset } = req.body as { ids: string[]; preset: '1h' | 'tomorrow' | 'next-week' };

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    res.status(400).json({ error: 'ids must be a non-empty array of max 100' });
    return;
  }
  if (!['1h', 'tomorrow', 'next-week'].includes(preset)) {
    res.status(400).json({ error: 'Invalid preset' });
    return;
  }

  const now = new Date();
  let newDatetime: string;
  if (preset === '1h') {
    newDatetime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  } else if (preset === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    newDatetime = d.toISOString();
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    newDatetime = d.toISOString();
  }

  const placeholders = ids.map(() => '?').join(', ');
  const owned = db.prepare(
    `SELECT id FROM reminders WHERE id IN (${placeholders}) AND user_id = ? AND completed = 0`
  ).all(...ids, req.userId!) as Array<{ id: string }>;

  if (owned.length === 0) {
    res.json({ snoozed: 0 });
    return;
  }

  const ownedIds = owned.map((r) => r.id);
  const updPlaceholders = ownedIds.map(() => '?').join(', ');
  db.prepare(`UPDATE reminders SET datetime = ?, snooze_count = COALESCE(snooze_count, 0) + 1 WHERE id IN (${updPlaceholders})`).run(newDatetime, ...ownedIds);

  res.json({ snoozed: owned.length, newDatetime });
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
