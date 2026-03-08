// Features (feature flags) route tests — Phase 30
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Features API', () => {
  let authHeader: string;
  let authHeader2: string;

  beforeEach(async () => {
    resetDatabase();
    const u1 = createTestUser();
    const u2 = createTestUser();
    authHeader = makeAuthHeader(u1.id);
    authHeader2 = makeAuthHeader(u2.id);
    // Initialize features rows for both users (GET auto-creates on first access)
    await request(app).get('/api/features').set('Authorization', authHeader);
    await request(app).get('/api/features').set('Authorization', authHeader2);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/features requires auth', async () => {
    const res = await request(app).get('/api/features');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/features requires auth', async () => {
    const res = await request(app).patch('/api/features').send({ socialDiscovery: true });
    expect(res.status).toBe(401);
  });

  // ── Get features ─────────────────────────────────────────────

  it('GET /api/features returns feature flags object', async () => {
    const res = await request(app)
      .get('/api/features')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('socialDiscovery');
    expect(res.body).toHaveProperty('portfolioChat');
    expect(res.body).toHaveProperty('automationBuilder');
    expect(res.body).toHaveProperty('websiteBuilder');
    expect(typeof res.body.socialDiscovery).toBe('boolean');
  });

  it('GET /api/features is isolated per user', async () => {
    // Update features for user 1
    await request(app)
      .patch('/api/features')
      .set('Authorization', authHeader)
      .send({ socialDiscovery: false });

    // User 2 should have default features
    const res2 = await request(app)
      .get('/api/features')
      .set('Authorization', authHeader2);
    expect(res2.status).toBe(200);
    // Default socialDiscovery is true (db schema default 1)
    expect(res2.body.socialDiscovery).toBe(true);
  });

  // ── Update features ──────────────────────────────────────────

  it('PATCH /api/features updates a feature flag', async () => {
    const res = await request(app)
      .patch('/api/features')
      .set('Authorization', authHeader)
      .send({ socialDiscovery: false });
    expect(res.status).toBe(200);
    expect(res.body.socialDiscovery).toBe(false);
  });

  it('PATCH /api/features persists changes', async () => {
    await request(app)
      .patch('/api/features')
      .set('Authorization', authHeader)
      .send({ portfolioChat: false });

    const res = await request(app)
      .get('/api/features')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.portfolioChat).toBe(false);
  });

  it('PATCH /api/features can enable multiple flags at once', async () => {
    const res = await request(app)
      .patch('/api/features')
      .set('Authorization', authHeader)
      .send({ socialDiscovery: true, websiteBuilder: true, n8nIntegration: false });
    expect(res.status).toBe(200);
    expect(res.body.socialDiscovery).toBe(true);
    expect(res.body.websiteBuilder).toBe(true);
    expect(res.body.n8nIntegration).toBe(false);
  });
});
