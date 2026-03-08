/**
 * Users Route Tests — Phase 22
 * GET/PATCH /me, timezone, public profile, model preference, change-password.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Users Routes', () => {
  let userId: string;
  let authHeader: string;
  let username: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
    username = user.username;
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/users/me requires auth', async () => {
    await request(app).get('/api/users/me').expect(401);
  });

  it('PATCH /api/users/me requires auth', async () => {
    await request(app).patch('/api/users/me').send({ name: 'X' }).expect(401);
  });

  it('POST /api/users/me/change-password requires auth', async () => {
    await request(app)
      .post('/api/users/me/change-password')
      .send({ currentPassword: 'a', newPassword: 'b' })
      .expect(401);
  });

  // ── GET /me ──────────────────────────────────────────────────

  it('GET /api/users/me returns user profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.id).toBe(userId);
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('username');
    expect(res.body).toHaveProperty('notifications');
    expect(res.body).toHaveProperty('privacy');
    expect(res.body).toHaveProperty('theme');
    // password_hash must never be exposed
    expect(res.body.password_hash).toBeUndefined();
  });

  it('GET /api/users/me returns X-Cache header', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', authHeader)
      .expect(200);
    // Either MISS (Redis not available or cold) or HIT (cached)
    expect(['MISS', 'HIT']).toContain(res.headers['x-cache']);
  });

  // ── PATCH /me ────────────────────────────────────────────────

  it('PATCH /api/users/me updates name', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ name: 'Jane Doe' })
      .expect(200);

    expect(res.body.name).toBe('Jane Doe');
  });

  it('PATCH /api/users/me updates bio', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ bio: 'Full-stack dev' })
      .expect(200);

    expect(res.body.bio).toBe('Full-stack dev');
  });

  it('PATCH /api/users/me updates tags', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ tags: ['React', 'TypeScript'] })
      .expect(200);

    expect(res.body.tags).toEqual(['React', 'TypeScript']);
  });

  it('PATCH /api/users/me rejects unknown username', async () => {
    // Username must pass schema regex (letters/numbers/_/-)
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ username: 'a' }) // too short (min 2)
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  it('PATCH /api/users/me rejects duplicate username', async () => {
    const other = createTestUser();
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ username: other.username })
      .expect(409);
    expect(res.body.error).toMatch(/taken/i);
  });

  it('PATCH /api/users/me accepts notification preferences (updates saved to DB)', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ notifications: { email: false, push: true } })
      .expect(200);

    // PATCH /me returns core fields; verify response has expected shape
    expect(res.body.id).toBe(userId);
    // Verify preferences were actually saved by fetching via GET
    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', authHeader)
      .expect(200);
    expect(me.body.notifications.email).toBe(false);
    expect(me.body.notifications.push).toBe(true);
  });

  it('PATCH /api/users/me updates theme', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', authHeader)
      .send({ theme: { mode: 'light', accentColor: '#FF0000' } })
      .expect(200);

    expect(res.body.theme.mode).toBe('light');
    expect(res.body.theme.accentColor).toBe('#FF0000');
  });

  // ── Timezone ─────────────────────────────────────────────────

  it('PATCH /api/users/me/timezone requires auth', async () => {
    await request(app)
      .patch('/api/users/me/timezone')
      .send({ timezone: 'UTC' })
      .expect(401);
  });

  it('PATCH /api/users/me/timezone updates timezone', async () => {
    const res = await request(app)
      .patch('/api/users/me/timezone')
      .set('Authorization', authHeader)
      .send({ timezone: 'America/New_York' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.timezone).toBe('America/New_York');
  });

  it('PATCH /api/users/me/timezone rejects missing timezone field', async () => {
    const res = await request(app)
      .patch('/api/users/me/timezone')
      .set('Authorization', authHeader)
      .send({})
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  // ── Public profile ───────────────────────────────────────────

  it('GET /api/users/:username/public returns public profile', async () => {
    // Make the user public
    db.prepare("UPDATE users SET privacy_show_profile = 1 WHERE id = ?").run(userId);
    db.prepare("UPDATE portfolios SET is_public = 1 WHERE user_id = ?").run(userId);

    const res = await request(app)
      .get(`/api/users/${username}/public`)
      .expect(200);

    expect(res.body).toHaveProperty('username');
    // Password hash must never be in public response
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('GET /api/users/:username/public returns 404 for unknown username', async () => {
    await request(app)
      .get('/api/users/no-such-user-xyz-987/public')
      .expect(404);
  });

  // ── Model preference ─────────────────────────────────────────

  it('PUT /api/users/me/model requires auth', async () => {
    await request(app).put('/api/users/me/model').send({ model: 'auto' }).expect(401);
  });

  it('PUT /api/users/me/model sets model preference', async () => {
    const res = await request(app)
      .put('/api/users/me/model')
      .set('Authorization', authHeader)
      .send({ model: 'local' })
      .expect(200);

    expect(res.body.preferredModel).toBe('local');
  });

  it('GET /api/users/me/model returns model preference', async () => {
    const res = await request(app)
      .get('/api/users/me/model')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body).toHaveProperty('preferredModel');
  });

  // ── Change password ──────────────────────────────────────────

  it('POST /api/users/me/change-password rejects wrong current password', async () => {
    const res = await request(app)
      .post('/api/users/me/change-password')
      .set('Authorization', authHeader)
      .send({ currentPassword: 'wrong-password', newPassword: 'NewSecure123!' })
      .expect(400);
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it('POST /api/users/me/change-password rejects too-short new password', async () => {
    const res = await request(app)
      .post('/api/users/me/change-password')
      .set('Authorization', authHeader)
      .send({ currentPassword: 'any', newPassword: 'short' })
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/users/me/change-password succeeds with correct current password', async () => {
    const user = createTestUser();
    const header = makeAuthHeader(user.id);

    const res = await request(app)
      .post('/api/users/me/change-password')
      .set('Authorization', header)
      .send({ currentPassword: 'test-password-123', newPassword: 'NewSecure456!' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
