// ============================================================
// Phase 25 — Focus sessions & Habits API tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

// ── Focus Sessions ─────────────────────────────────────────────────────────────

describe('Focus API — /api/focus', () => {
  beforeEach(() => {
    resetDatabase();
  });

  // Auth guards
  it('GET /active requires auth', async () => {
    const res = await request(app).get('/api/focus/active').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /start requires auth', async () => {
    const res = await request(app).post('/api/focus/start').send({}).expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /end requires auth', async () => {
    const res = await request(app).post('/api/focus/end').send({}).expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /history requires auth', async () => {
    const res = await request(app).get('/api/focus/history').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /summary requires auth', async () => {
    const res = await request(app).get('/api/focus/summary').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  // Active session
  it('GET /active returns null when no session active', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/focus/active')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('session');
    expect(res.body.session).toBeNull();

    cleanupTestUser(user.id);
  });

  // Start session
  it('POST /start creates a focus session', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ goal: 'Write tests', durationMin: 25 })
      .expect(201);

    expect(res.body).toHaveProperty('session');
    expect(res.body.session).toHaveProperty('goal', 'Write tests');
    expect(res.body.session).toHaveProperty('id');
    expect(res.body.session).toHaveProperty('started_at');

    cleanupTestUser(user.id);
  });

  it('POST /start stores goal string', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ goal: 'Short goal' })
      .expect(201);

    expect(res.body.session.goal).toBe('Short goal');

    cleanupTestUser(user.id);
  });

  it('POST /start ignores invalid durationMin', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ durationMin: 'bad' })
      .expect(201);

    expect(res.body).toHaveProperty('session');

    cleanupTestUser(user.id);
  });

  it('POST /start ignores out-of-range durationMin', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/focus/start')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ durationMin: 999 })
      .expect(201);

    expect(res.body).toHaveProperty('session');

    cleanupTestUser(user.id);
  });

  // End session
  it('POST /end returns 404 when no active session', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/focus/end')
      .set('Authorization', makeAuthHeader(user.id))
      .send({})
      .expect(404);

    expect(res.body).toHaveProperty('error');

    cleanupTestUser(user.id);
  });

  it('POST /end closes active session', async () => {
    const user = createTestUser();

    await request(app)
      .post('/api/focus/start')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ goal: 'Read docs', durationMin: 30 })
      .expect(201);

    const res = await request(app)
      .post('/api/focus/end')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ completed: true })
      .expect(200);

    expect(res.body).toHaveProperty('session');
    expect(res.body.session).toHaveProperty('ended_at');

    cleanupTestUser(user.id);
  });

  // History
  it('GET /history returns array', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/focus/history')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);

    cleanupTestUser(user.id);
  });

  // Summary
  it('GET /summary returns summary object', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/focus/summary')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('summary');

    cleanupTestUser(user.id);
  });

  // Deferred messages
  it('GET /deferred requires auth', async () => {
    await request(app).get('/api/focus/deferred').expect(401);
  });

  it('GET /deferred returns array', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/focus/deferred')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('messages');
    expect(Array.isArray(res.body.messages)).toBe(true);

    cleanupTestUser(user.id);
  });

  // Notification settings
  it('GET /settings requires auth', async () => {
    await request(app).get('/api/focus/settings').expect(401);
  });

  it('GET /settings returns settings object', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/focus/settings')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('settings');

    cleanupTestUser(user.id);
  });

  it('PATCH /settings updates focus_mode_active', async () => {
    const user = createTestUser();
    const res = await request(app)
      .patch('/api/focus/settings')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ focus_mode_active: 1 })
      .expect(200);

    expect(res.body).toHaveProperty('settings');

    cleanupTestUser(user.id);
  });
});

// ── Habits ─────────────────────────────────────────────────────────────────────

describe('Habits API — /api/habits', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('GET / requires auth', async () => {
    await request(app).get('/api/habits').expect(401);
  });

  it('POST / requires auth', async () => {
    await request(app).post('/api/habits').send({ name: 'Run' }).expect(401);
  });

  it('GET / returns empty array initially', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('habits');
    expect(Array.isArray(res.body.habits)).toBe(true);

    cleanupTestUser(user.id);
  });

  it('POST / creates habit with name', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ name: 'Morning run' })
      .expect(201);

    expect(res.body).toHaveProperty('habit');
    expect(res.body.habit).toHaveProperty('name', 'Morning run');
    expect(res.body.habit).toHaveProperty('frequency', 'daily'); // default

    cleanupTestUser(user.id);
  });

  it('POST / rejects missing name', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ description: 'No name' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / rejects empty name', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ name: '' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / accepts valid frequency values', async () => {
    const user = createTestUser();
    for (const freq of ['daily', 'weekly', 'monthly', 'weekdays']) {
      const res = await request(app)
        .post('/api/habits')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ name: `Habit ${freq}`, frequency: freq })
        .expect(201);

      expect(res.body.habit.frequency).toBe(freq);
    }

    cleanupTestUser(user.id);
  });

  it('POST / accepts optional description field', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ name: 'Some habit', description: 'Do it every day' })
      .expect(201);

    expect(res.body.habit).toHaveProperty('name', 'Some habit');

    cleanupTestUser(user.id);
  });

  it('DELETE /:id removes habit', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ name: 'Meditate' })
      .expect(201);

    const habitId = createRes.body.habit.id;

    await request(app)
      .delete(`/api/habits/${habitId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const listRes = await request(app)
      .get('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(listRes.body.habits.find((h: { id: number }) => h.id === habitId)).toBeUndefined();

    cleanupTestUser(user.id);
  });

  it('DELETE /:id returns 404 for non-existent habit', async () => {
    const user = createTestUser();
    await request(app)
      .delete('/api/habits/99999')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);

    cleanupTestUser(user.id);
  });

  it('POST /:id/log records completion', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ name: 'Read' })
      .expect(201);

    const habitId = createRes.body.habit.id;

    const res = await request(app)
      .post(`/api/habits/${habitId}/log`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({})
      .expect(201);

    expect(res.body).toHaveProperty('log');
    expect(res.body).toHaveProperty('streak');

    cleanupTestUser(user.id);
  });

  it('GET /:id/stats returns stats', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/habits')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ name: 'Exercise' })
      .expect(201);

    const habitId = createRes.body.habit.id;

    const res = await request(app)
      .get(`/api/habits/${habitId}/stats`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('stats');

    cleanupTestUser(user.id);
  });

  it('GET /:id/stats returns stats with null habit for non-existent id', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/habits/99999/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats.habit).toBeNull();

    cleanupTestUser(user.id);
  });
});
