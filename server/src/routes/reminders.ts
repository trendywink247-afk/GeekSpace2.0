import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, reminderCreateSchema, reminderUpdateSchema, bulkReminderDeleteSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

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

  // 48.8: ETag-based conditional GET — avoid re-sending unchanged reminder lists
  const etag = `"${createHash('sha256').update(JSON.stringify(reminders)).digest('hex').slice(0, 16)}"`;
  res.set('ETag', etag);
  res.set('Cache-Control', 'private, no-cache');
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

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
  // 48.9: Structured lifecycle log
  logger.info({ event: 'reminder.created', userId: req.userId, reminderId: id, channel: channel || 'push', priority: priority || 'normal' });

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
  // When datetime is rescheduled, reset remind_before_sent_at so the
  // heads-up alert fires again for the new time.
  if (updates['datetime'] !== undefined) {
    fields.push('remind_before_sent_at = NULL');
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
  // 48.9: Structured lifecycle log
  logger.info({ event: 'reminder.completed', userId: req.userId, reminderId: req.params.id });

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
  // 48.9: Structured lifecycle log
  logger.info({ event: 'reminder.deleted', userId: req.userId, reminderId: req.params.id });
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

  // 36.1: Log each snooze event
  const logStmt = db.prepare('INSERT INTO snooze_log (id, reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?, ?)');
  const snoozedAt = Date.now();
  for (const rid of ownedIds) {
    logStmt.run(uuid(), rid, req.userId!, snoozedAt, preset, newDatetime);
  }

  res.json({ snoozed: owned.length, newDatetime });
});

// ── 53.4: Bulk restore-and-snooze for completed reminders ────────────────────
remindersRouter.post('/bulk-restore-snooze', requireAuth, (req: AuthRequest, res) => {
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
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    newDatetime = d.toISOString();
  } else {
    const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0);
    newDatetime = d.toISOString();
  }

  const placeholders = ids.map(() => '?').join(', ');
  // Verify ownership (includes completed ones)
  const owned = db.prepare(
    `SELECT id FROM reminders WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, req.userId!) as Array<{ id: string }>;

  if (owned.length === 0) { res.json({ restored: 0 }); return; }

  const ownedIds = owned.map((r) => r.id);
  const updPlaceholders = ownedIds.map(() => '?').join(', ');
  db.prepare(
    `UPDATE reminders SET completed = 0, datetime = ?, snooze_count = COALESCE(snooze_count, 0) + 1 WHERE id IN (${updPlaceholders})`
  ).run(newDatetime, ...ownedIds);

  const logStmt = db.prepare('INSERT INTO snooze_log (id, reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?, ?)');
  const snoozedAt = Date.now();
  for (const rid of ownedIds) {
    logStmt.run(uuid(), rid, req.userId!, snoozedAt, `restore-${preset}`, newDatetime);
  }

  res.json({ restored: ownedIds.length, newDatetime });
});

// ── Individual Snooze (36.1 + 37.2) — preset or custom datetime ──────────────
remindersRouter.post('/:id/snooze', requireAuth, (req: AuthRequest, res) => {
  const { preset, customDatetime } = req.body as { preset?: string; customDatetime?: string };

  if (!preset && !customDatetime) {
    res.status(400).json({ error: 'preset or customDatetime required' });
    return;
  }
  if (preset && !['1h', 'tomorrow', 'next-week'].includes(preset)) {
    res.status(400).json({ error: 'Invalid preset' });
    return;
  }

  const existing = db.prepare('SELECT id FROM reminders WHERE id = ? AND user_id = ? AND completed = 0').get(req.params.id, req.userId!) as { id: string } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  let newDatetime: string;
  if (customDatetime) {
    const parsed = new Date(customDatetime);
    if (isNaN(parsed.getTime()) || parsed <= new Date()) {
      res.status(400).json({ error: 'customDatetime must be a valid future datetime' });
      return;
    }
    newDatetime = parsed.toISOString();
  } else {
    const now = new Date();
    if (preset === '1h') {
      newDatetime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (preset === 'tomorrow') {
      const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); newDatetime = d.toISOString();
    } else {
      const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); newDatetime = d.toISOString();
    }
  }

  db.prepare(`UPDATE reminders SET datetime = ?, snooze_count = COALESCE(snooze_count, 0) + 1 WHERE id = ? AND user_id = ?`).run(newDatetime, req.params.id, req.userId!);
  db.prepare('INSERT INTO snooze_log (id, reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), req.params.id, req.userId!, Date.now(), preset || 'custom', newDatetime);
  // 48.9: Structured lifecycle log
  logger.info({ event: 'reminder.snoozed', userId: req.userId, reminderId: req.params.id, preset: preset || 'custom', newDatetime });

  res.json({ snoozed: true, newDatetime });
});

// ── Snooze History (36.1) ────────────────────────────────────────────────────
remindersRouter.get('/:id/snooze-history', requireAuth, (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT id FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as { id: string } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const history = db.prepare(
    'SELECT id, snoozed_at, preset, new_datetime FROM snooze_log WHERE reminder_id = ? ORDER BY snoozed_at DESC LIMIT 10'
  ).all(req.params.id) as Array<{ id: string; snoozed_at: number; preset: string; new_datetime: string }>;

  res.json({ history });
});

// ── Bulk Delete (25.5) ─────────────────────────────────────────────────────
// ── 38.3: CSV Export ─────────────────────────────────────────────────────────
remindersRouter.get('/export.csv', requireAuth, (req: AuthRequest, res) => {
  const status = (req.query.status as string) || 'all';
  let query = 'SELECT text, datetime, category, priority, channel, recurring, completed FROM reminders WHERE user_id = ?';
  const params: unknown[] = [req.userId!];
  if (status === 'active') { query += ' AND completed = 0'; }
  else if (status === 'completed') { query += ' AND completed = 1'; }
  query += ' ORDER BY datetime ASC';

  const rows = db.prepare(query).all(...params) as Array<{
    text: string; datetime: string; category: string; priority: string;
    channel: string; recurring: string; completed: number;
  }>;

  const header = 'text,datetime,category,priority,channel,recurring,completed';
  const lines = rows.map((r) => [
    `"${r.text.replace(/"/g, '""')}"`,
    r.datetime,
    r.category,
    r.priority,
    r.channel,
    r.recurring || '',
    r.completed ? 'true' : 'false',
  ].join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="reminders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header, ...lines].join('\n'));
});

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

// ── 41.1: Bulk Complete ────────────────────────────────────────────────────
remindersRouter.post('/bulk-complete', requireAuth, (req: AuthRequest, res) => {
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    res.status(400).json({ error: 'ids must be a non-empty array of max 100' });
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  const owned = db.prepare(
    `SELECT id FROM reminders WHERE id IN (${placeholders}) AND user_id = ? AND completed = 0`
  ).all(...ids, req.userId!) as Array<{ id: string }>;

  if (owned.length === 0) {
    res.json({ updated: 0 });
    return;
  }

  const ownedIds = owned.map((r) => r.id);
  const updPlaceholders = ownedIds.map(() => '?').join(', ');
  db.prepare(
    `UPDATE reminders SET completed = 1, completed_at = ? WHERE id IN (${updPlaceholders})`
  ).run(Date.now(), ...ownedIds);

  res.json({ updated: owned.length });
});

// ── 41.4: Reminder Stats ───────────────────────────────────────────────────
remindersRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const now = Date.now();

  const total = (db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ?').get(req.userId!) as { c: number }).c;
  const completed = (db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 1').get(req.userId!) as { c: number }).c;
  const overdue = (db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND scheduled_for < ?').get(req.userId!, now) as { c: number }).c;
  const active = (db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND scheduled_for >= ?').get(req.userId!, now) as { c: number }).c;

  const byPriority = { low: 0, normal: 0, high: 0, urgent: 0 };
  const priorityRows = db.prepare(
    `SELECT priority, COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 GROUP BY priority`
  ).all(req.userId!) as Array<{ priority: string; c: number }>;
  for (const row of priorityRows) {
    if (row.priority in byPriority) {
      byPriority[row.priority as keyof typeof byPriority] = row.c;
    }
  }

  res.json({ total, active, completed, overdue, byPriority });
});
