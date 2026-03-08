// Images gallery route tests — Phase 28
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Images API', () => {
  let authHeader: string;
  let authHeader2: string;

  beforeEach(() => {
    resetDatabase();
    const u1 = createTestUser();
    const u2 = createTestUser();
    authHeader = makeAuthHeader(u1.id);
    authHeader2 = makeAuthHeader(u2.id);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/images requires auth', async () => {
    const res = await request(app).get('/api/images');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/images/:id requires auth', async () => {
    const res = await request(app).delete('/api/images/some-id');
    expect(res.status).toBe(401);
  });

  // ── Gallery ──────────────────────────────────────────────────

  it('GET /api/images returns empty gallery for new user', async () => {
    const res = await request(app)
      .get('/api/images')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(res.body.images.length).toBe(0);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('max');
  });

  it('DELETE /api/images/:id returns 404 for non-existent image', async () => {
    const res = await request(app)
      .delete('/api/images/nonexistent-id')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });

  it('DELETE /api/images/:id returns 404 for another users image', async () => {
    const res = await request(app)
      .delete('/api/images/some-other-users-image')
      .set('Authorization', authHeader2);
    expect(res.status).toBe(404);
  });

  // ── Model endpoints (no-auth guard) ─────────────────────────

  it('GET /api/images/models/available requires auth', async () => {
    const res = await request(app).get('/api/images/models/available');
    expect(res.status).toBe(401);
  });

  it('GET /api/images/models/available returns model list', async () => {
    const res = await request(app)
      .get('/api/images/models/available')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
  });
});
