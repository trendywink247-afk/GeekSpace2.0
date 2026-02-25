import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, generateTestToken } from '../setup.js';

/**
 * Bulk Snooze Tests (Phase 29.4)
 * POST /api/reminders/bulk-snooze
 */

const app = createApp();

describe('Reminder bulk-snooze', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    resetDatabase();
    const user = createTestUser();
    userId = user.id;
    token = generateTestToken(userId);
  });

  const createReminder = async (text: string) => {
    const res = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ text, datetime: new Date(Date.now() - 60000).toISOString(), channel: 'push' });
    return res.body as { id: string };
  };

  test('bulk snooze +1h updates datetime for owned active reminders', async () => {
    const r1 = await createReminder('Test snooze 1');
    const r2 = await createReminder('Test snooze 2');
    const before = new Date(Date.now() + 60 * 60 * 1000 - 5000);

    const res = await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r1.id, r2.id], preset: '1h' });

    expect(res.status).toBe(200);
    expect(res.body.snoozed).toBe(2);
    const snoozeTime = new Date(res.body.newDatetime);
    expect(snoozeTime.getTime()).toBeGreaterThan(before.getTime());
  });

  test('bulk snooze tomorrow sets 9am next day', async () => {
    const r = await createReminder('Tomorrow snooze');

    const res = await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r.id], preset: 'tomorrow' });

    expect(res.status).toBe(200);
    expect(res.body.snoozed).toBe(1);
    const snoozeTime = new Date(res.body.newDatetime);
    expect(snoozeTime.getHours()).toBe(9);
    expect(snoozeTime.getMinutes()).toBe(0);
  });

  test('bulk snooze next-week sets 9am 7 days from now', async () => {
    const r = await createReminder('Next week snooze');

    const res = await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r.id], preset: 'next-week' });

    expect(res.status).toBe(200);
    const snoozeTime = new Date(res.body.newDatetime);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    expect(snoozeTime.getDate()).toBe(weekFromNow.getDate());
    expect(snoozeTime.getHours()).toBe(9);
  });

  test('returns 400 for invalid preset', async () => {
    const r = await createReminder('Bad preset');
    const res = await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r.id], preset: 'invalid' });
    expect(res.status).toBe(400);
  });

  test('does not snooze reminders owned by other users', async () => {
    const otherUser = createTestUser(`other-bulk-snooze-${Date.now()}@test.com`);
    const otherToken = generateTestToken(otherUser.id);
    const r = await (async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ text: 'Other user reminder', datetime: new Date().toISOString(), channel: 'push' });
      return res.body as { id: string };
    })();

    const res = await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r.id], preset: '1h' });

    expect(res.status).toBe(200);
    expect(res.body.snoozed).toBe(0);
  });
});
