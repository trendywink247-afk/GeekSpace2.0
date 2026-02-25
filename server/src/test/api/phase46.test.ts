// ============================================================
// Phase 46 — Unit tests for:
//   46.1 Admin routes require auth middleware
//        - GET /api/admin/users without token returns 401
//        - GET /api/admin/stats without token returns 401
//   46.2 Webhook test-fire URL validation
//        - POST /:id/test with invalid URL returns 400
//   46.6 Portfolio contact form email validation (backend)
//        - POST /:username/contact with invalid email returns 400
//        - POST /:username/contact with valid email succeeds
//   46.8 Activity default limit 50 → 25
//        - GET /api/activity with no limit param returns ≤ 25 entries
//          even when 30+ entries exist
//   46.9 /api/ready endpoint
//        - GET /api/ready returns 200 with { status: 'ready' }
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 46.1: Admin routes require auth ────────────────────────────────────────
// NOTE: In test mode ADMIN_TOKEN is not configured, so requireAdminToken returns
// 503 "Admin token not configured" rather than 401 "Invalid admin token".
// The critical property is that unauthenticated callers are NEVER given 200/data.
// We accept 401, 403, or 503 — all indicate the route is protected.

describe('Phase 46.1 — Admin routes require auth middleware', () => {
  beforeAll(() => { resetDatabase(); });

  it('GET /api/admin/users without token is blocked (not 200)', async () => {
    const res = await request(app)
      .get('/api/admin/users');
    expect([401, 403, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/admin/stats without token is blocked (not 200)', async () => {
    const res = await request(app)
      .get('/api/admin/stats');
    expect([401, 403, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/admin/health without token is blocked (not 200)', async () => {
    const res = await request(app)
      .get('/api/admin/health');
    expect([401, 403, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/admin/tasks without token is blocked (not 200)', async () => {
    const res = await request(app)
      .get('/api/admin/tasks');
    expect([401, 403, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });
});

// ── 46.2: Webhook test-fire URL validation ─────────────────────────────────

describe('Phase 46.2 — Webhook test-fire URL validation', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns 400 with invalid URL "not-a-url"', async () => {
    const user = createTestUser(`webhook-test-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);

    // Create an automation with an invalid URL in action_config
    const autoId = uuid();
    db.prepare(
      `INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      autoId,
      user.id,
      'Test Webhook',
      'manual',
      'n8n-webhook',
      JSON.stringify({ url: 'not-a-url' })
    );

    const res = await request(app)
      .post(`/api/automations/${autoId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toHaveProperty('message', 'Invalid webhook URL');
  });

  it('returns 400 with javascript: scheme URL', async () => {
    const user = createTestUser(`webhook-test2-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);

    const autoId = uuid();
    db.prepare(
      `INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      autoId,
      user.id,
      'Test Webhook JS',
      'manual',
      'n8n-webhook',
      JSON.stringify({ url: 'javascript:alert(1)' })
    );

    const res = await request(app)
      .post(`/api/automations/${autoId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body.message).toBe('Invalid webhook URL');
  });

  it('returns 400 when no URL is configured', async () => {
    const user = createTestUser(`webhook-test3-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);

    const autoId = uuid();
    db.prepare(
      `INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      autoId,
      user.id,
      'Test No URL',
      'manual',
      'telegram-message',
      JSON.stringify({})
    );

    const res = await request(app)
      .post(`/api/automations/${autoId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toHaveProperty('message');
  });
});

// ── 46.6: Portfolio contact form email validation ──────────────────────────

describe('Phase 46.6 — Portfolio contact form email validation', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  function createPublicPortfolio(userId: string, username: string) {
    db.prepare(
      `INSERT INTO portfolios (user_id, username, is_public, skills, projects, milestones)
       VALUES (?, ?, 1, '[]', '[]', '[]')`
    ).run(userId, username);
  }

  it('returns 400 when email format is invalid', async () => {
    const user = createTestUser(`contact-test-${Date.now()}@example.com`);
    createPublicPortfolio(user.id, user.username);

    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({
        senderName: 'Jane Doe',
        senderEmail: 'not-an-email',
        message: 'Hello there!',
      })
      .expect(400);

    expect(res.body).toHaveProperty('error', 'Invalid email address');
  });

  it('returns 400 for email missing TLD', async () => {
    const user = createTestUser(`contact-test2-${Date.now()}@example.com`);
    createPublicPortfolio(user.id, user.username);

    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({
        senderName: 'Jane Doe',
        senderEmail: 'user@nodot',
        message: 'Hello!',
      })
      .expect(400);

    expect(res.body.error).toBe('Invalid email address');
  });

  it('succeeds with a valid email', async () => {
    const user = createTestUser(`contact-test3-${Date.now()}@example.com`);
    createPublicPortfolio(user.id, user.username);

    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({
        senderName: 'Jane Doe',
        senderEmail: 'jane@example.com',
        message: 'Hello there!',
      })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
  });

  it('succeeds with no email (optional field)', async () => {
    const user = createTestUser(`contact-test4-${Date.now()}@example.com`);
    createPublicPortfolio(user.id, user.username);

    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({
        senderName: 'Jane Doe',
        message: 'Hello there!',
      })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
  });
});

// ── 46.8: Activity default limit 50 → 25 ──────────────────────────────────

describe('Phase 46.8 — Activity default limit 50 → 25', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns at most 25 entries by default even when 30+ exist', async () => {
    const user = createTestUser(`activity-limit-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);

    // Insert 30 activity entries
    for (let i = 0; i < 30; i++) {
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run(uuid(), user.id, `Test action ${i}`, `Detail ${i}`, 'zap');
    }

    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.activity).toBeDefined();
    expect(res.body.activity.length).toBeLessThanOrEqual(25);
    // Total should reflect the full count
    expect(res.body.total).toBeGreaterThanOrEqual(30);
  });

  it('accepts explicit limit param to override the default', async () => {
    const user = createTestUser(`activity-limit2-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);

    for (let i = 0; i < 10; i++) {
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run(uuid(), user.id, `Action ${i}`, `Detail ${i}`, 'zap');
    }

    const res = await request(app)
      .get('/api/activity?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.activity.length).toBeLessThanOrEqual(5);
  });
});

// ── 46.9: /api/ready endpoint ──────────────────────────────────────────────

describe('Phase 46.9 — /api/ready endpoint', () => {
  it('returns 200 with { status: "ready", db: "ok" } when DB is up', async () => {
    const res = await request(app)
      .get('/api/ready')
      .expect(200);

    expect(res.body).toMatchObject({ status: 'ready', db: 'ok' });
  });

  it('is unauthenticated — no token required', async () => {
    // Should work without any Authorization header
    await request(app)
      .get('/api/ready')
      .expect(200);
  });
});
