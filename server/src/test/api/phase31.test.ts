import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { config } from '../../config.js';
import { resetDatabase, createTestUser, generateTestToken } from '../setup.js';

/**
 * Phase 31 Unit Tests
 * - 31.2: Reminder recurrence (create with recurrence, complete creates next occurrence)
 * - 31.4: Admin export endpoints (users CSV, activity summary)
 */

const ADMIN_TOKEN = 'test-admin-token-phase31';
// Patch config directly (same pattern as admin.test.ts)
config.adminToken = ADMIN_TOKEN;

const app = createApp();

describe('Phase 31 — Recurrence, Admin Export', () => {
  let token: string;
  let userId: string;

  beforeEach(() => {
    resetDatabase();
    const user = createTestUser();
    userId = user.id;
    token = generateTestToken(userId);
  });

  // ── 31.2: Reminder recurrence ─────────────────────────────────────────────

  test('POST /reminders creates reminder with recurrence field', async () => {
    const res = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Daily standup',
        datetime: new Date(Date.now() + 60000).toISOString(),
        channel: 'push',
        recurrence: 'daily',
      });

    expect(res.status).toBe(201);
    expect(res.body.recurrence).toBe('daily');
  });

  test('POST /reminders/:id/complete with daily recurrence creates next occurrence', async () => {
    // Create a reminder with recurrence
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Daily standup',
        datetime: futureDate,
        channel: 'push',
        recurrence: 'daily',
      });
    expect(create.status).toBe(201);
    const reminderId = create.body.id as string;

    // Update the recurrence field via PATCH (since POST creates with recurrence)
    // Complete the reminder
    const complete = await request(app)
      .post(`/api/reminders/${reminderId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(complete.status).toBe(200);
    expect(complete.body.completed).toBe(true);
    expect(complete.body.nextReminder).not.toBeNull();
    expect(complete.body.nextReminder.recurrence).toBe('daily');

    // Verify next reminder is ~1 day after original
    const originalTime = new Date(futureDate).getTime();
    const nextTime = new Date(complete.body.nextReminder.datetime as string).getTime();
    const diffMs = nextTime - originalTime;
    expect(diffMs).toBeCloseTo(24 * 60 * 60 * 1000, -4); // within 16 seconds
  });

  test('POST /reminders/:id/complete without recurrence returns null nextReminder', async () => {
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'One-time task',
        datetime: new Date(Date.now() + 60000).toISOString(),
        channel: 'push',
      });
    expect(create.status).toBe(201);

    const complete = await request(app)
      .post(`/api/reminders/${create.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(complete.status).toBe(200);
    expect(complete.body.completed).toBe(true);
    expect(complete.body.nextReminder).toBeNull();
  });

  test('PATCH /reminders/:id can update recurrence field', async () => {
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Weekly report',
        datetime: new Date(Date.now() + 60000).toISOString(),
        channel: 'push',
      });
    expect(create.status).toBe(201);

    const patch = await request(app)
      .patch(`/api/reminders/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recurrence: 'weekly' });

    expect(patch.status).toBe(200);
    expect(patch.body.recurrence).toBe('weekly');
  });

  // ── 31.4: Admin export endpoints ─────────────────────────────────────────

  test('GET /admin/export/users returns CSV with correct headers', async () => {
    const res = await request(app)
      .get('/api/admin/export/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/geekspace-users\.csv/);
    // CSV should have header row
    const firstLine = (res.text as string).split('\n')[0];
    expect(firstLine).toBe('id,email,plan,created_at,last_active_at,messages_sent');
  });

  test('GET /admin/export/users includes the test user', async () => {
    const res = await request(app)
      .get('/api/admin/export/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    // Should contain the test user's id
    expect(res.text).toContain(userId);
  });

  test('GET /admin/export/users requires admin token', async () => {
    const res = await request(app)
      .get('/api/admin/export/users')
      .set('Authorization', `Bearer wrong-token`);

    expect(res.status).toBe(401);
  });

  test('GET /admin/export/activity returns JSON activity summary', async () => {
    const res = await request(app)
      .get('/api/admin/export/activity')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('activeLastSevenDays');
    expect(res.body).toHaveProperty('totalMessages');
    expect(res.body).toHaveProperty('topUsersByMessageCount');
    expect(Array.isArray(res.body.topUsersByMessageCount)).toBe(true);
    expect(res.body).toHaveProperty('generatedAt');
  });

  test('GET /admin/export/activity requires admin token', async () => {
    const res = await request(app)
      .get('/api/admin/export/activity');

    expect(res.status).toBe(401);
  });

  test('GET /admin/export/activity totalUsers reflects test user count', async () => {
    const res = await request(app)
      .get('/api/admin/export/activity')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
  });
});
