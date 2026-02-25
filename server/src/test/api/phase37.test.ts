// ============================================================
// Phase 37 — Unit tests for portfolio contact, custom snooze,
// daily briefing Telegram flag, dead-letter endpoint,
// notif_connections flag
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ---- 37.1: Portfolio Contact Endpoint ----

describe('Portfolio Contact — POST /api/portfolio/:username/contact (Phase 37.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns 404 for non-existent or private portfolio', async () => {
    await request(app)
      .post('/api/portfolio/nonexistent-user-xyz/contact')
      .send({ senderName: 'Alice', message: 'Hello!' })
      .expect(404);
  });

  it('returns 400 when senderName missing', async () => {
    const user = createTestUser();
    // createTestUser does not create a portfolio — insert one
    db.prepare('INSERT INTO portfolios (user_id, username, is_public) VALUES (?, ?, ?)').run(user.id, user.username, 1);
    await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({ message: 'Hello!' })
      .expect(400);
  });

  it('returns 400 when message missing', async () => {
    const user = createTestUser();
    db.prepare('INSERT INTO portfolios (user_id, username, is_public) VALUES (?, ?, ?)').run(user.id, user.username, 1);
    await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({ senderName: 'Alice' })
      .expect(400);
  });

  it('returns 400 when message exceeds 1000 chars', async () => {
    const user = createTestUser();
    db.prepare('INSERT INTO portfolios (user_id, username, is_public) VALUES (?, ?, ?)').run(user.id, user.username, 1);
    await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({ senderName: 'Alice', message: 'x'.repeat(1001) })
      .expect(400);
  });

  it('saves contact and returns success for public portfolio', async () => {
    const user = createTestUser();
    db.prepare('INSERT INTO portfolios (user_id, username, is_public) VALUES (?, ?, ?)').run(user.id, user.username, 1);
    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({ senderName: 'Alice', senderEmail: 'alice@example.com', message: 'Hello from test!' })
      .expect(200);
    expect(res.body.success).toBe(true);

    const contact = db.prepare('SELECT * FROM portfolio_contacts WHERE user_id = ?').get(user.id) as Record<string, unknown> | undefined;
    expect(contact).toBeDefined();
    expect(contact?.sender_name).toBe('Alice');
    expect(contact?.sender_email).toBe('alice@example.com');
    expect(contact?.message).toBe('Hello from test!');
  });
});

describe('Portfolio Contacts List — GET /api/portfolio/contacts (Phase 37.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('requires authentication', async () => {
    await request(app).get('/api/portfolio/contacts').expect(401);
  });

  it('returns empty list when no contacts', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/portfolio/contacts')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns contacts for authenticated owner', async () => {
    const user = createTestUser();
    // Insert contact directly
    db.prepare('INSERT INTO portfolio_contacts (id, username, user_id, sender_name, sender_email, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), user.username, user.id, 'Bob', 'bob@test.com', 'Hey there', Date.now()
    );
    const res = await request(app)
      .get('/api/portfolio/contacts')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].sender_name).toBe('Bob');
  });
});

// ---- 37.2: Custom Snooze Datetime ----

describe('Custom Snooze — POST /api/reminders/:id/snooze with customDatetime (Phase 37.2)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  const insertReminder = (userId: string) => {
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, 'Custom snooze test', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');
    return id;
  };

  it('returns 400 when neither preset nor customDatetime provided', async () => {
    const user = createTestUser();
    const id = insertReminder(user.id);
    await request(app)
      .post(`/api/reminders/${id}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({})
      .expect(400);
  });

  it('returns 400 for past customDatetime', async () => {
    const user = createTestUser();
    const id = insertReminder(user.id);
    await request(app)
      .post(`/api/reminders/${id}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ customDatetime: new Date(Date.now() - 60000).toISOString() })
      .expect(400);
  });

  it('snoozes to custom datetime and logs to snooze_log', async () => {
    const user = createTestUser();
    const id = insertReminder(user.id);
    const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/api/reminders/${id}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ customDatetime: future })
      .expect(200);
    expect(res.body.snoozed).toBe(true);
    expect(res.body.newDatetime).toBe(future);

    const logEntry = db.prepare('SELECT * FROM snooze_log WHERE reminder_id = ?').get(id) as Record<string, unknown> | undefined;
    expect(logEntry).toBeDefined();
    expect(logEntry?.preset).toBe('custom');
  });
});

// ---- 37.4: Dead-Letter Endpoint ----

describe('Dead Letters — GET /api/automations/dead-letters (Phase 37.4)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('requires authentication', async () => {
    await request(app).get('/api/automations/dead-letters').expect(401);
  });

  it('returns empty array when no dead letters', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/automations/dead-letters')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('returns only own dead letters', async () => {
    const user = createTestUser();
    const other = createTestUser();
    const autoId = uuid();
    // Insert dead letter for user
    db.prepare('INSERT INTO webhook_dead_letters (id, automation_id, user_id, url, error, payload, failed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), autoId, user.id, 'https://example.com/wh', 'Connection refused', null, Date.now()
    );
    // Insert dead letter for other user (should not appear)
    db.prepare('INSERT INTO webhook_dead_letters (id, automation_id, user_id, url, error, payload, failed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), uuid(), other.id, 'https://other.com/wh', 'Timeout', null, Date.now()
    );

    const res = await request(app)
      .get('/api/automations/dead-letters')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].url).toBe('https://example.com/wh');
    expect(res.body[0].error).toBe('Connection refused');
  });
});
