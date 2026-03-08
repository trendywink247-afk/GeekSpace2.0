// ============================================================
// Phase 26 — Briefings API tests (/api/briefings)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

describe('Briefings API — /api/briefings', () => {
  beforeEach(() => {
    resetDatabase();
  });

  // Auth guards
  it('GET / requires auth', async () => {
    const res = await request(app).get('/api/briefings').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /trigger requires auth', async () => {
    const res = await request(app).post('/api/briefings/trigger').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  // List
  it('GET / returns array for authenticated user', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/briefings')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    cleanupTestUser(user.id);
  });

  it('GET / respects limit param', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/briefings?limit=5')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(5);

    cleanupTestUser(user.id);
  });

  // Trigger (POST /trigger)
  it('POST /trigger returns content string', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/briefings/trigger')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('content');
    expect(typeof res.body.content).toBe('string');

    cleanupTestUser(user.id);
  });

  // Cross-user isolation (GET returns only own briefings)
  it('GET / returns empty array for fresh user (no briefings yet)', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/briefings')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    // Fresh user has no briefings
    expect(res.body.length).toBe(0);

    cleanupTestUser(user.id);
  });
});
