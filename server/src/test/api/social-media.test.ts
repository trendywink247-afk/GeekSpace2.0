// Social media route tests — Phase 28
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { initSocialMediaTables } from '../../services/social-media.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

// Initialize social media tables once before all tests
beforeAll(() => {
  initSocialMediaTables();
});

describe('Social Media API', () => {
  let authHeader: string;
  let authHeader2: string;

  beforeEach(() => {
    resetDatabase();
    // Also clear social-media-specific tables (not in main resetDatabase)
    try { db.prepare('DELETE FROM content_plan_items').run(); } catch { /* table may not exist first run */ }
    try { db.prepare('DELETE FROM content_plans').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM social_accounts').run(); } catch { /* ignore */ }
    const u1 = createTestUser();
    const u2 = createTestUser();
    authHeader = makeAuthHeader(u1.id);
    authHeader2 = makeAuthHeader(u2.id);
  });

  const validAccount = {
    platform: 'instagram',
    account_name: 'My Business',
    posting_method: 'webhook',
    webhook_url: 'https://example.com/webhook',
  };

  // ── Auth guards — accounts ───────────────────────────────────

  it('GET /api/social-media/accounts requires auth', async () => {
    const res = await request(app).get('/api/social-media/accounts');
    expect(res.status).toBe(401);
  });

  it('POST /api/social-media/accounts requires auth', async () => {
    const res = await request(app).post('/api/social-media/accounts').send(validAccount);
    expect(res.status).toBe(401);
  });

  it('DELETE /api/social-media/accounts/:id requires auth', async () => {
    const res = await request(app).delete('/api/social-media/accounts/some-id');
    expect(res.status).toBe(401);
  });

  // ── Auth guards — plans ──────────────────────────────────────

  it('GET /api/social-media/plans requires auth', async () => {
    const res = await request(app).get('/api/social-media/plans');
    expect(res.status).toBe(401);
  });

  // ── Account CRUD ─────────────────────────────────────────────

  it('GET /api/social-media/accounts returns empty list for new user', async () => {
    const res = await request(app)
      .get('/api/social-media/accounts')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('POST /api/social-media/accounts creates account', async () => {
    const res = await request(app)
      .post('/api/social-media/accounts')
      .set('Authorization', authHeader)
      .send(validAccount);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.platform).toBe('instagram');
    expect(res.body.account_name).toBe('My Business');
  });

  it('GET /api/social-media/accounts lists created accounts', async () => {
    await request(app)
      .post('/api/social-media/accounts')
      .set('Authorization', authHeader)
      .send(validAccount);

    const res = await request(app)
      .get('/api/social-media/accounts')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('GET /api/social-media/accounts is isolated per user', async () => {
    await request(app)
      .post('/api/social-media/accounts')
      .set('Authorization', authHeader)
      .send(validAccount);

    const res = await request(app)
      .get('/api/social-media/accounts')
      .set('Authorization', authHeader2);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('DELETE /api/social-media/accounts/:id deletes own account', async () => {
    const create = await request(app)
      .post('/api/social-media/accounts')
      .set('Authorization', authHeader)
      .send(validAccount);
    const id = create.body.id as string;

    const del = await request(app)
      .delete(`/api/social-media/accounts/${id}`)
      .set('Authorization', authHeader);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const list = await request(app)
      .get('/api/social-media/accounts')
      .set('Authorization', authHeader);
    expect(list.body.length).toBe(0);
  });

  it('DELETE /api/social-media/accounts/:id returns 404 for non-existent', async () => {
    const res = await request(app)
      .delete('/api/social-media/accounts/nonexistent')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });

  // ── Plans ────────────────────────────────────────────────────

  it('GET /api/social-media/plans returns empty array for new user', async () => {
    const res = await request(app)
      .get('/api/social-media/plans')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});
