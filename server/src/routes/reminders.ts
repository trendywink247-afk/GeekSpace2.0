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

  // 65.4: Near-duplicate warning — check for incomplete reminder with same text (case-insensitive) in next 48h
  const normalized = (text as string).toLowerCase().trim();
  const existing = db.prepare(
    `SELECT id, text, datetime FROM reminders WHERE user_id = ? AND completed = 0 AND LOWER(TRIM(text)) = ? LIMIT 1`
  ).get(req.userId!, normalized) as { id: string; text: string; datetime: string } | undefined;

  const id = uuid();
  const scheduledFor = datetime ? new Date(datetime).getTime() : Date.now();

  db.prepare('INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, text, datetime || '', channel || 'push', category || 'general', recurring || '', recurrence || null, 'user', scheduledFor, priority || 'normal'
  );
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`).run(uuid(), req.userId, text);
  // 48.9: Structured lifecycle log
  logger.info({ event: 'reminder.created', userId: req.userId, reminderId: id, channel: channel || 'push', priority: priority || 'normal' });

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  res.status(201).json({
    ...(reminder as Record<string, unknown>),
    duplicate_warning: existing ? `A similar reminder already exists: "${existing.text}"` : null,
  });
});

// ── 62.10: Batch Edit (priority/category) — must come BEFORE PATCH /:id ─────
remindersRouter.patch('/batch-edit', requireAuth, (req: AuthRequest, res) => {
  const { ids, priority, category } = req.body as {
    ids: string[];
    priority?: string;
    category?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    res.status(400).json({ error: 'ids must be a non-empty array of max 100' });
    return;
  }

  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  const validCategories = ['personal', 'work', 'health', 'finance', 'general'];

  if (priority && !validPriorities.includes(priority)) {
    res.status(400).json({ error: 'Invalid priority value' });
    return;
  }
  if (category && !validCategories.includes(category)) {
    res.status(400).json({ error: 'Invalid category value' });
    return;
  }
  if (!priority && !category) {
    res.status(400).json({ error: 'At least one of priority or category must be provided' });
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  const owned = (db.prepare(
    `SELECT id FROM reminders WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, req.userId!) as Array<{ id: string }>).map((r) => r.id);

  if (owned.length === 0) {
    res.json({ updated: 0 });
    return;
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  if (priority) { sets.push('priority = ?'); values.push(priority); }
  if (category) { sets.push('category = ?'); values.push(category); }

  const updPlaceholders = owned.map(() => '?').join(', ');
  db.prepare(
    `UPDATE reminders SET ${sets.join(', ')} WHERE id IN (${updPlaceholders})`
  ).run(...values, ...owned);

  res.json({ updated: owned.length });
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

// ── 64.4: Duplicate reminder ────────────────────────────────────────────────
remindersRouter.post('/:id/duplicate', requireAuth, (req: AuthRequest, res) => {
  const src = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as Record<string, unknown> | undefined;
  if (!src) { res.status(404).json({ error: 'Not found' }); return; }

  const newId = uuid();
  db.prepare(`
    INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, created_by, scheduled_for, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId, req.userId!, src.text, src.datetime || '', src.channel || 'push',
    src.category || 'general', src.recurring || '', src.recurrence ?? null,
    'user', src.scheduled_for ?? Date.now(), src.priority || 'normal'
  );
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`).run(uuid(), req.userId!, `Duplicate: ${src.text}`);
  logger.info({ event: 'reminder.duplicated', userId: req.userId, sourceId: req.params.id, newId });

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(newId);
  res.status(201).json(reminder);
});

// ── Complete endpoint with recurrence support ───────────────────────────────
remindersRouter.post('/:id/complete', requireAuth, (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  // Mark this reminder as completed (with timestamp for streak tracking)
  db.prepare('UPDATE reminders SET completed = 1, completed_at = ? WHERE id = ? AND user_id = ?').run(Date.now(), req.params.id, req.userId!);
  // 48.9: Structured lifecycle log
  logger.info({ event: 'reminder.completed', userId: req.userId, reminderId: req.params.id });

  // If it has a recurrence, create the next occurrence using smart engine
  const recurrence = existing.recurrence as string | null | undefined;
  if (recurrence) {
    const currentDatetime = new Date((existing.datetime as string) || new Date().toISOString());
    const nextDatetime = computeNextOccurrence(currentDatetime, recurrence);
    if (!nextDatetime) {
      // Unknown recurrence pattern — complete without creating next
      res.json({ completed: true, nextReminder: null });
      return;
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

// 58.2: /bulk must come before /:id to avoid Express matching bulk as an id param
remindersRouter.delete('/bulk', requireAuth, validateBody(bulkReminderDeleteSchema), (req: AuthRequest, res) => {
  const { ids } = req.body as { ids: string[] };
  const placeholders = ids.map(() => '?').join(', ');
  const owned = db.prepare(
    `SELECT id FROM reminders WHERE id IN (${placeholders}) AND user_id = ?`
  ).all(...ids, req.userId!) as Array<{ id: string }>;
  if (owned.length === 0) { res.json({ deleted: 0 }); return; }
  const ownedIds = owned.map((r) => r.id);
  const delPlaceholders = ownedIds.map(() => '?').join(', ');
  const result = db.prepare(`DELETE FROM reminders WHERE id IN (${delPlaceholders})`).run(...ownedIds);
  res.json({ deleted: result.changes });
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
  const bulkSnoozeUntilMs = new Date(newDatetime).getTime();
  db.prepare(`UPDATE reminders SET datetime = ?, snooze_until = ?, snooze_count = COALESCE(snooze_count, 0) + 1 WHERE id IN (${updPlaceholders})`).run(newDatetime, bulkSnoozeUntilMs, ...ownedIds);

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

  const snoozeUntilMs = new Date(newDatetime).getTime();
  db.prepare(`UPDATE reminders SET datetime = ?, snooze_until = ?, snooze_count = COALESCE(snooze_count, 0) + 1 WHERE id = ? AND user_id = ?`).run(newDatetime, snoozeUntilMs, req.params.id, req.userId!);
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

// ── 60.3: iCalendar Export ────────────────────────────────────────────────────
remindersRouter.get('/export.ics', requireAuth, (req: AuthRequest, res) => {
  const status = (req.query.status as string) || 'all';
  let query = 'SELECT id, text, datetime, category, priority, channel, recurring FROM reminders WHERE user_id = ? AND completed = 0';
  const params: unknown[] = [req.userId!];
  if (status === 'completed') {
    query = 'SELECT id, text, datetime, category, priority, channel, recurring FROM reminders WHERE user_id = ? AND completed = 1';
  } else if (status === 'all') {
    query = 'SELECT id, text, datetime, category, priority, channel, recurring FROM reminders WHERE user_id = ?';
  }
  query += ' ORDER BY datetime ASC';

  const rows = db.prepare(query).all(...params) as Array<{
    id: string; text: string; datetime: string; category: string;
    priority: string; channel: string; recurring: string | null;
  }>;

  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const toIcalDate = (dt: string) => {
    // dt may be ISO 8601 "2025-06-01T09:00:00.000Z" or "2025-06-01 09:00"
    const d = new Date(dt);
    if (isNaN(d.getTime())) return now;
    return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  };

  const foldLine = (line: string) => {
    // RFC 5545 §3.1: fold lines longer than 75 octets
    const chunks: string[] = [];
    while (line.length > 75) { chunks.push(line.slice(0, 75)); line = ' ' + line.slice(75); }
    chunks.push(line);
    return chunks.join('\r\n');
  };

  const events = rows.map((r) => {
    const dtstart = toIcalDate(r.datetime);
    const dtend = toIcalDate(r.datetime); // single-instant event
    const summary = r.text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    const desc = `Category: ${r.category} | Priority: ${r.priority || 'normal'} | Channel: ${r.channel}`;
    const rrule = r.recurring === 'daily' ? 'RRULE:FREQ=DAILY'
      : r.recurring === 'weekly' ? 'RRULE:FREQ=WEEKLY'
      : r.recurring === 'monthly' ? 'RRULE:FREQ=MONTHLY'
      : null;
    const lines = [
      'BEGIN:VEVENT',
      foldLine(`UID:${r.id}@geekspace`),
      `DTSTAMP:${now}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      foldLine(`SUMMARY:${summary}`),
      foldLine(`DESCRIPTION:${desc}`),
    ];
    if (rrule) lines.push(rrule);
    lines.push('END:VEVENT');
    return lines.join('\r\n');
  });

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GeekSpace//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="reminders-${date}.ics"`);
  res.send(cal);
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

// ── Phase 107: Smart Recurrence Engine ───────────────────────────────────────

/**
 * Compute next occurrence for complex recurrence rules.
 * Supported patterns: daily, weekly, monthly, weekdays, biweekly,
 * "every N days", "every Nth weekday" (e.g. "2nd Tuesday")
 */
function computeNextOccurrence(
  currentDatetime: Date,
  recurrenceRule: string
): Date | null {
  const rule = recurrenceRule.toLowerCase().trim();
  const now = new Date();
  const base = currentDatetime > now ? currentDatetime : now;

  // Simple patterns
  if (rule === 'daily') {
    return new Date(base.getTime() + 86400000);
  }
  if (rule === 'weekly') {
    return new Date(base.getTime() + 7 * 86400000);
  }
  if (rule === 'biweekly' || rule === 'every 2 weeks') {
    return new Date(base.getTime() + 14 * 86400000);
  }
  if (rule === 'monthly') {
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  // "weekdays" or "every weekday"
  if (rule === 'weekdays' || rule === 'every weekday') {
    const next = new Date(base.getTime() + 86400000);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // "every N days"
  const everyNDays = rule.match(/^every\s+(\d+)\s+days?$/);
  if (everyNDays) {
    return new Date(base.getTime() + parseInt(everyNDays[1], 10) * 86400000);
  }

  // "every N weeks"
  const everyNWeeks = rule.match(/^every\s+(\d+)\s+weeks?$/);
  if (everyNWeeks) {
    return new Date(base.getTime() + parseInt(everyNWeeks[1], 10) * 7 * 86400000);
  }

  // "every N months"
  const everyNMonths = rule.match(/^every\s+(\d+)\s+months?$/);
  if (everyNMonths) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + parseInt(everyNMonths[1], 10));
    return next;
  }

  // "last day of month" or "last friday of month"
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const lastOfMonth = rule.match(/^last\s+(day|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+of\s+month$/);
  if (lastOfMonth) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1, 0); // last day of current month

    if (lastOfMonth[1] === 'day') return next;

    const targetDay = dayNames.indexOf(lastOfMonth[1]);
    // find last occurrence of targetDay in the month
    const nextMonth = new Date(base);
    nextMonth.setMonth(nextMonth.getMonth() + 2, 0); // last day of next month
    while (nextMonth.getDay() !== targetDay) {
      nextMonth.setDate(nextMonth.getDate() - 1);
    }
    nextMonth.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return nextMonth;
  }

  // "Nth weekday" e.g. "2nd tuesday", "1st monday", "3rd friday"
  const nthWeekday = rule.match(/^(\d)(?:st|nd|rd|th)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nthWeekday) {
    const nth = parseInt(nthWeekday[1], 10);
    const targetDay = dayNames.indexOf(nthWeekday[2]);

    // Find in next month
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1, 1); // 1st of next month
    let count = 0;
    while (count < nth) {
      if (next.getDay() === targetDay) count++;
      if (count < nth) next.setDate(next.getDate() + 1);
    }
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return next;
  }

  return null;
}

// ── Batch Create (Phase 107) ─────────────────────────────────────────────────
remindersRouter.post('/batch', requireAuth, (req: AuthRequest, res) => {
  const { items } = req.body as {
    items: Array<{ text: string; datetime?: string; category?: string; priority?: string; recurrence?: string }>;
  };

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    res.status(400).json({ error: 'items must be an array of 1-50 reminders' });
    return;
  }

  const insertStmt = db.prepare(
    'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const created: string[] = [];
  const insertAll = db.transaction(() => {
    for (const item of items) {
      if (!item.text || typeof item.text !== 'string') continue;
      const id = uuid();
      const dt = item.datetime ? new Date(item.datetime).toISOString() : '';
      const scheduledFor = item.datetime ? new Date(item.datetime).getTime() : Date.now();
      insertStmt.run(
        id, req.userId!, item.text.trim(), dt, 'push',
        item.category || 'general', '', item.recurrence || null,
        'user', scheduledFor, item.priority || 'normal'
      );
      created.push(id);
    }
  });
  insertAll();

  logger.info({ event: 'reminder.batch_created', userId: req.userId, count: created.length });
  res.status(201).json({ created: created.length, ids: created });
});

// ── Snooze Pattern Detection (Phase 107) ──────────────────────────────────────
remindersRouter.get('/:id/snooze-pattern', requireAuth, (req: AuthRequest, res) => {
  const existing = db.prepare(
    'SELECT id, text, snooze_count FROM reminders WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as { id: string; text: string; snooze_count: number } | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const snoozeCount = existing.snooze_count || 0;
  if (snoozeCount < 3) {
    res.json({ pattern_detected: false, snooze_count: snoozeCount });
    return;
  }

  // Analyze snooze times to find pattern
  const snoozeLogs = db.prepare(
    'SELECT new_datetime FROM snooze_log WHERE reminder_id = ? ORDER BY snoozed_at DESC LIMIT 10'
  ).all(req.params.id) as Array<{ new_datetime: string }>;

  // Find most common hour across snoozes
  const hourCounts: Record<number, number> = {};
  for (const log of snoozeLogs) {
    const hour = new Date(log.new_datetime).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const suggestedHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  res.json({
    pattern_detected: true,
    snooze_count: snoozeCount,
    suggestion: suggestedHour
      ? `This reminder has been snoozed ${snoozeCount} times. Maybe ${parseInt(suggestedHour, 10) > 12 ? `${parseInt(suggestedHour, 10) - 12}pm` : `${suggestedHour}am`} works better?`
      : `This reminder has been snoozed ${snoozeCount} times. Consider a different time.`,
    suggested_hour: suggestedHour ? parseInt(suggestedHour, 10) : null,
  });
});

// ── Reminder Templates (Phase 107) ────────────────────────────────────────────
remindersRouter.get('/templates', requireAuth, (_req: AuthRequest, res) => {
  const templates = [
    {
      id: 'morning-routine',
      name: 'Morning Routine',
      items: [
        { text: 'Wake up and hydrate', time: '06:00', recurrence: 'daily' },
        { text: 'Morning exercise', time: '06:30', recurrence: 'weekdays' },
        { text: 'Review today\'s agenda', time: '08:00', recurrence: 'weekdays' },
      ],
    },
    {
      id: 'weekly-review',
      name: 'Weekly Review',
      items: [
        { text: 'Review weekly goals', time: '17:00', recurrence: 'weekly' },
        { text: 'Plan next week', time: '17:30', recurrence: 'weekly' },
      ],
    },
    {
      id: 'health-pack',
      name: 'Health Pack',
      items: [
        { text: 'Take vitamins', time: '09:00', recurrence: 'daily' },
        { text: 'Drink 8 glasses of water', time: '10:00', recurrence: 'daily' },
        { text: 'Stretch break', time: '14:00', recurrence: 'weekdays' },
      ],
    },
    {
      id: 'bill-payments',
      name: 'Bill Payments',
      items: [
        { text: 'Pay rent', time: '10:00', recurrence: 'monthly' },
        { text: 'Pay electricity bill', time: '10:00', recurrence: 'monthly' },
        { text: 'Review subscriptions', time: '10:00', recurrence: 'last day of month' },
      ],
    },
  ];

  res.json(templates);
});

// Export computeNextOccurrence for use in the reminder scheduler
export { computeNextOccurrence };

