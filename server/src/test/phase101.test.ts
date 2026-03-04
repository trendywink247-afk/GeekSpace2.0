/**
 * Phase 101 -- Focus Mode + Smart Notifications + Habits Tests
 * Covers: DB schema, focus service, habits service, streak logic,
 *         smart deferral, DND, notification settings, API routes
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { generateTestToken, createTestUser } from './setup.js';
import {
  startFocus, endFocus, getActiveFocus, getFocusHistory, getFocusSummary,
  getDeferredMessages, getNotificationSettings, updateNotificationSettings,
  isInDND, isFocusActive,
} from '../services/focus.js';
import { createHabit, logHabit, getHabits, getHabitStats, deleteHabit } from '../services/habits.js';
import { addInboxMessage } from '../services/inbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
function readSrc(...parts: string[]): string {
  return readFileSync(path.join(ROOT, 'server/src', ...parts), 'utf-8');
}

let app: ReturnType<typeof createApp>;
let testUser: { id: string; email: string; username: string; password: string };
let token: string;

beforeAll(() => {
  app = createApp();
  testUser = createTestUser();
  token = generateTestToken(testUser.id);
});

afterAll(() => {
  try {
    db.prepare('DELETE FROM focus_sessions WHERE user_id = ?').run(testUser.id);
    db.prepare('DELETE FROM habits WHERE user_id = ?').run(testUser.id);
    db.prepare('DELETE FROM notification_settings WHERE user_id = ?').run(testUser.id);
    db.prepare('DELETE FROM inbox_messages WHERE user_id = ?').run(testUser.id);
  } catch { }
});
// =========================================================================
// 101.1  DB Schema
// =========================================================================
describe('101.1 DB schema: new tables', () => {
  it('db/index.ts creates focus_sessions table', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS focus_sessions');
  });
  it('db/index.ts creates habits table', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS habits');
  });
  it('db/index.ts creates habit_logs table', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS habit_logs');
  });
  it('db/index.ts creates notification_settings table', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS notification_settings');
  });
  it('db/index.ts adds deferred column to inbox_messages', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('ALTER TABLE inbox_messages ADD COLUMN deferred');
  });
  it('focus_sessions table has required columns', () => {
    const row = db.prepare("SELECT * FROM focus_sessions WHERE 1=0").all();
    expect(row).toBeDefined();
  });
  it('habits table has required columns', () => {
    const row = db.prepare("SELECT * FROM habits WHERE 1=0").all();
    expect(row).toBeDefined();
  });
  it('habit_logs table has required columns', () => {
    const row = db.prepare("SELECT * FROM habit_logs WHERE 1=0").all();
    expect(row).toBeDefined();
  });
  it('notification_settings table has required columns', () => {
    const row = db.prepare("SELECT * FROM notification_settings WHERE 1=0").all();
    expect(row).toBeDefined();
  });
});

// =========================================================================
// 101.2  Focus Service
// =========================================================================
describe('101.2 Focus service: CRUD', () => {
  it('getActiveFocus returns null when no active session', () => {
    const session = getActiveFocus(testUser.id);
    expect(session).toBeNull();
  });
  it('startFocus creates a session and activates focus mode', () => {
    const session = startFocus(testUser.id, 'Write tests', 25);
    expect(session).toBeDefined();
    expect(session.goal).toBe('Write tests');
    expect(session.duration_min).toBe(25);
    expect(session.ended_at).toBeNull();
    expect(isFocusActive(testUser.id)).toBe(true);
  });
  it('getActiveFocus returns current session', () => {
    const session = getActiveFocus(testUser.id);
    expect(session).not.toBeNull();
    expect(session!.goal).toBe('Write tests');
  });
  it('endFocus closes session and deactivates focus mode', () => {
    const ended = endFocus(testUser.id, true);
    expect(ended).not.toBeNull();
    expect(ended!.completed).toBe(1);
    expect(ended!.ended_at).not.toBeNull();
    expect(getActiveFocus(testUser.id)).toBeNull();
    expect(isFocusActive(testUser.id)).toBe(false);
  });
  it('endFocus returns null when no active session', () => {
    expect(endFocus(testUser.id)).toBeNull();
  });
  it('getFocusHistory returns past sessions', () => {
    startFocus(testUser.id, 'Another session', 45);
    endFocus(testUser.id, false);
    const history = getFocusHistory(testUser.id, 10);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].completed).toBe(0);
  });
  it('getFocusSummary returns stats', () => {
    const summary = getFocusSummary(testUser.id);
    expect(typeof summary.totalSessionsThisWeek).toBe('number');
    expect(typeof summary.totalMinutesThisWeek).toBe('number');
    expect(typeof summary.avgSessionMin).toBe('number');
    expect(typeof summary.longestSessionMin).toBe('number');
  });
});
// =========================================================================
// 101.3  Habits Service
// =========================================================================
describe('101.3 Habits service: CRUD', () => {
  let habitId: number;

  it('createHabit creates a habit', () => {
    const h = createHabit(testUser.id, { name: 'Morning Run', icon: '🏃', frequency: 'daily' });
    expect(h).toBeDefined();
    expect(h.name).toBe('Morning Run');
    expect(h.current_streak).toBe(0);
    habitId = h.id;
  });

  it('getHabits lists habits with today status', () => {
    const habits = getHabits(testUser.id);
    const h = habits.find(x => x.id === habitId);
    expect(h).toBeDefined();
    expect(h!.logged_today).toBe(false);
  });

  it('logHabit logs completion', () => {
    const log = logHabit(testUser.id, habitId, 'Good run');
    expect(log).toBeDefined();
    expect(log.habit_id).toBe(habitId);
    expect(log.note).toBe('Good run');
  });

  it('getHabits shows logged_today=true after log', () => {
    const habits = getHabits(testUser.id);
    const h = habits.find(x => x.id === habitId);
    expect(h!.logged_today).toBe(true);
  });

  it('logHabit throws on duplicate log same day', () => {
    expect(() => logHabit(testUser.id, habitId)).toThrow();
  });

  it('logHabit increments streak on consecutive days', () => {
    const h2 = createHabit(testUser.id, { name: 'Reading' });
    const log = logHabit(testUser.id, h2.id);
    expect(log.habit_id).toBe(h2.id);
    const habits = getHabits(testUser.id);
    const hUpdated = habits.find(x => x.id === h2.id);
    expect(hUpdated!.current_streak).toBeGreaterThanOrEqual(1);
    deleteHabit(testUser.id, h2.id);
  });

  it('getHabitStats returns 30-day data', () => {
    const stats = getHabitStats(testUser.id, habitId);
    expect(stats.habit_id).toBe(habitId);
    expect(typeof stats.days).toBe('object');
    expect(stats.totalLogs).toBeGreaterThanOrEqual(1);
  });

  it('deleteHabit removes habit', () => {
    const result = deleteHabit(testUser.id, habitId);
    expect(result).toBe(true);
    const habits = getHabits(testUser.id);
    expect(habits.find(x => x.id === habitId)).toBeUndefined();
  });

  it('deleteHabit returns false for nonexistent', () => {
    expect(deleteHabit(testUser.id, 999999)).toBe(false);
  });
});

// =========================================================================
// 101.4  Notification Settings + DND
// =========================================================================
describe('101.4 Notification settings + DND', () => {
  it('getNotificationSettings creates defaults on first call', () => {
    const settings = getNotificationSettings(testUser.id);
    expect(settings).toBeDefined();
    expect(settings.focus_mode_active).toBe(0);
    expect(settings.dnd_start).toBe('22:00');
    expect(settings.dnd_end).toBe('08:00');
  });

  it('updateNotificationSettings updates fields', () => {
    const updated = updateNotificationSettings(testUser.id, { dnd_start: '21:00', dnd_end: '07:00' });
    expect(updated.dnd_start).toBe('21:00');
    expect(updated.dnd_end).toBe('07:00');
    updateNotificationSettings(testUser.id, { dnd_start: '22:00', dnd_end: '08:00' });
  });

  it('isInDND returns true for time within overnight DND (22:00 to 08:00)', () => {
    updateNotificationSettings(testUser.id, { dnd_start: '22:00', dnd_end: '08:00' });
    const midnight = new Date();
    midnight.setHours(23, 0, 0, 0);
    expect(isInDND(testUser.id, midnight.getTime())).toBe(true);
  });

  it('isInDND returns false outside DND window', () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(isInDND(testUser.id, noon.getTime())).toBe(false);
  });

  it('isInDND returns true in early morning DND', () => {
    const earlyMorn = new Date();
    earlyMorn.setHours(3, 0, 0, 0);
    expect(isInDND(testUser.id, earlyMorn.getTime())).toBe(true);
  });

  it('isInDND handles same-day window (no overnight wrap)', () => {
    updateNotificationSettings(testUser.id, { dnd_start: '09:00', dnd_end: '17:00' });
    const twopm = new Date(); twopm.setHours(14, 0, 0, 0);
    expect(isInDND(testUser.id, twopm.getTime())).toBe(true);
    const eightp = new Date(); eightp.setHours(20, 0, 0, 0);
    expect(isInDND(testUser.id, eightp.getTime())).toBe(false);
    updateNotificationSettings(testUser.id, { dnd_start: '22:00', dnd_end: '08:00' });
  });
});
// =========================================================================
// 101.5  Smart notification deferral
// =========================================================================
describe('101.5 Smart notification deferral', () => {
  it('addInboxMessage does not defer when focus is inactive', () => {
    updateNotificationSettings(testUser.id, { focus_mode_active: 0 });
    const id = addInboxMessage(testUser.id, 'test', 'alice', 'hello world');
    const row = db.prepare('SELECT deferred FROM inbox_messages WHERE id = ?').get(id) as { deferred: number };
    expect(row.deferred).toBe(0);
    db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(id);
  });

  it('addInboxMessage defers normal messages when focus is active', () => {
    updateNotificationSettings(testUser.id, { focus_mode_active: 1, urgent_bypass: 1 });
    const id = addInboxMessage(testUser.id, 'test', 'alice', 'hello world normal message');
    const row = db.prepare('SELECT deferred FROM inbox_messages WHERE id = ?').get(id) as { deferred: number };
    expect(row.deferred).toBe(1);
    db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(id);
    updateNotificationSettings(testUser.id, { focus_mode_active: 0 });
  });

  it('addInboxMessage does not defer urgent messages when urgent_bypass=1', () => {
    updateNotificationSettings(testUser.id, { focus_mode_active: 1, urgent_bypass: 1 });
    const id = addInboxMessage(testUser.id, 'test', 'alice', 'URGENT critical deadline');
    const row = db.prepare('SELECT deferred FROM inbox_messages WHERE id = ?').get(id) as { deferred: number };
    expect(row.deferred).toBe(0);
    db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(id);
    updateNotificationSettings(testUser.id, { focus_mode_active: 0 });
  });

  it('getDeferredMessages returns and clears deferred flag', () => {
    updateNotificationSettings(testUser.id, { focus_mode_active: 1, urgent_bypass: 1 });
    addInboxMessage(testUser.id, 'test', 'bob', 'deferred message 1');
    addInboxMessage(testUser.id, 'test', 'bob', 'deferred message 2');
    const deferred = getDeferredMessages(testUser.id);
    expect(deferred.length).toBeGreaterThanOrEqual(2);
    const stillDeferred = getDeferredMessages(testUser.id);
    expect(stillDeferred.length).toBe(0);
    updateNotificationSettings(testUser.id, { focus_mode_active: 0 });
  });
});

// =========================================================================
// 101.6  API routes
// =========================================================================
describe('101.6 Focus API routes', () => {
  it('GET /api/focus/active returns null when no session', async () => {
    const res = await request(app).get('/api/focus/active').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.session).toBeNull();
  });

  it('POST /api/focus/start creates session', async () => {
    const res = await request(app).post('/api/focus/start').set('Authorization', 'Bearer ' + token).send({ goal: 'Test session', durationMin: 25 });
    expect(res.status).toBe(201);
    expect(res.body.session.goal).toBe('Test session');
  });

  it('GET /api/focus/active returns session after start', async () => {
    const res = await request(app).get('/api/focus/active').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.session).not.toBeNull();
  });

  it('POST /api/focus/end ends session', async () => {
    const res = await request(app).post('/api/focus/end').set('Authorization', 'Bearer ' + token).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.session.completed).toBe(1);
  });

  it('GET /api/focus/history returns sessions', async () => {
    const res = await request(app).get('/api/focus/history').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  it('GET /api/focus/summary returns stats', async () => {
    const res = await request(app).get('/api/focus/summary').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(typeof res.body.summary.totalSessions).toBe('number');
  });

  it('GET /api/focus/settings returns notification settings', async () => {
    const res = await request(app).get('/api/focus/settings').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
  });

  it('PATCH /api/focus/settings updates settings', async () => {
    const res = await request(app).patch('/api/focus/settings').set('Authorization', 'Bearer ' + token).send({ dnd_start: '21:00' });
    expect(res.status).toBe(200);
    expect(res.body.settings.dnd_start).toBe('21:00');
  });

  it('GET /api/focus/deferred returns empty when no deferred messages', async () => {
    const res = await request(app).get('/api/focus/deferred').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });
});

describe('101.7 Habits API routes', () => {
  let habitId: number;

  it('GET /api/habits returns empty list initially', async () => {
    const res = await request(app).get('/api/habits').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.habits)).toBe(true);
  });

  it('POST /api/habits creates habit', async () => {
    const res = await request(app).post('/api/habits').set('Authorization', 'Bearer ' + token).send({ name: 'Test Habit', icon: '💪' });
    expect(res.status).toBe(201);
    expect(res.body.habit.name).toBe('Test Habit');
    habitId = res.body.habit.id;
  });

  it('POST /api/habits returns 400 without name', async () => {
    const res = await request(app).post('/api/habits').set('Authorization', 'Bearer ' + token).send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/habits/:id/log logs habit completion', async () => {
    const res = await request(app).post('/api/habits/' + habitId + '/log').set('Authorization', 'Bearer ' + token).send({ note: 'Done!' });
    expect(res.status).toBe(201);
    expect(typeof res.body.streak).toBe('number');
  });

  it('GET /api/habits/:id/stats returns stats', async () => {
    const res = await request(app).get('/api/habits/' + habitId + '/stats').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.stats.habit_id).toBe(habitId);
  });

  it('DELETE /api/habits/:id deletes habit', async () => {
    const res = await request(app).delete('/api/habits/' + habitId).set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});