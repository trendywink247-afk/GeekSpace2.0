// ============================================================
// Phase 48 — Unit tests for:
//   48.1 GET /api/automations normalizes enabled (0/1 → boolean)
//        - list returns enabled as boolean true/false, never 0/1
//        - PATCH returns enabled as boolean after update
//   48.6 Portfolio contact origin validation
//        - POST /:username/contact with disallowed Origin returns 403
//        - POST /:username/contact with no Origin header passes through
//   48.8 GET /api/reminders returns ETag header + 304 on second request
//        - response includes ETag header
//        - second request with If-None-Match returns 304
//   48.9 Permissions-Policy header present in responses
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 48.1: Automation enabled normalization ──────────────────────────────────

describe('Phase 48.1 — Automation enabled field normalization', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser();
    userId = user.id;
    token = generateTestToken(userId);
  });

  it('GET /api/automations returns enabled as boolean', async () => {
    // Insert automation with SQLite integer 1 (enabled)
    const id = uuid();
    db.prepare(
      'INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, 'Test Auto', '', 'manual', '{}', 'log', '{}', 1);

    const res = await request(app)
      .get('/api/automations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const auto = res.body.find((a: { id: string; enabled: unknown }) => a.id === id);
    expect(auto).toBeDefined();
    expect(auto.enabled).toBe(true);        // must be boolean true, not 1
    expect(typeof auto.enabled).toBe('boolean');
  });

  it('GET /api/automations returns false for disabled automation', async () => {
    const id = uuid();
    db.prepare(
      'INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, 'Disabled Auto', '', 'manual', '{}', 'log', '{}', 0);

    const res = await request(app)
      .get('/api/automations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const auto = res.body.find((a: { id: string; enabled: unknown }) => a.id === id);
    expect(auto).toBeDefined();
    expect(auto.enabled).toBe(false);
    expect(typeof auto.enabled).toBe('boolean');
  });

  it('PATCH /api/automations/:id returns enabled as boolean', async () => {
    const id = uuid();
    db.prepare(
      'INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, 'Patch Auto', '', 'manual', '{}', 'log', '{}', 0);

    const res = await request(app)
      .patch(`/api/automations/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true })
      .expect(200);

    expect(res.body.enabled).toBe(true);
    expect(typeof res.body.enabled).toBe('boolean');
  });
});

// ── 48.6: Portfolio contact origin validation ───────────────────────────────

describe('Phase 48.6 — Portfolio contact origin validation', () => {
  let portfolioUsername: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser('portfolio48@example.com');
    portfolioUsername = user.username;
    db.prepare(
      "INSERT OR IGNORE INTO portfolios (user_id, username, headline, about, skills, projects, milestones, social, layout, agent_enabled, visibility, is_public) VALUES (?, ?, '', '', '[]', '[]', '[]', '{}', 'minimal', 0, '{}', 1)"
    ).run(user.id, portfolioUsername);
  });

  it('returns 403 when Origin is from a disallowed domain', async () => {
    await request(app)
      .post(`/api/portfolio/${portfolioUsername}/contact`)
      .set('Origin', 'https://evil.com')
      .send({ senderName: 'Bot', message: 'spam' })
      .expect(403);
  });

  it('allows request when no Origin header is present', async () => {
    const res = await request(app)
      .post(`/api/portfolio/${portfolioUsername}/contact`)
      // No Origin header — simulate server-side or non-browser request
      .send({ senderName: 'Server', message: 'Hello from server' });

    // Should not 403 — may 200 or 429 depending on rate limit state
    expect(res.status).not.toBe(403);
  });
});

// ── 48.8: Reminder list ETag + conditional GET ─────────────────────────────

describe('Phase 48.8 — GET /api/reminders ETag caching', () => {
  let token: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser();
    token = generateTestToken(user.id);
  });

  it('response includes an ETag header', async () => {
    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['etag']).toBeDefined();
    expect(res.headers['etag']).toMatch(/^"[a-f0-9]+"$/);
  });

  it('second request with matching If-None-Match returns 304', async () => {
    const first = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const etag = first.headers['etag'];
    expect(etag).toBeTruthy();

    await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', etag)
      .expect(304);
  });

  it('returns 200 after reminder list changes (ETag changes)', async () => {
    const first = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const oldEtag = first.headers['etag'];

    // Add a new reminder to change the data
    await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'ETag test reminder', datetime: '2030-01-01T10:00:00Z', channel: 'push', category: 'personal' })
      .expect(201);

    // ETag should differ → 200 not 304
    const second = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', oldEtag)
      .expect(200);

    expect(second.headers['etag']).toBeDefined();
    expect(second.headers['etag']).not.toBe(oldEtag);
  });
});

// ── 48.7: Permissions-Policy header ────────────────────────────────────────

describe('Phase 48.7 — Permissions-Policy header', () => {
  it('GET /api/health response includes Permissions-Policy header', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.headers['permissions-policy']).toBeDefined();
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['permissions-policy']).toContain('microphone=(self)');
  });
});
