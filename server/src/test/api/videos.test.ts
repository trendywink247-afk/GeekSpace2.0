// Video gallery route tests — Phase 29
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Videos API', () => {
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

  it('GET /api/videos requires auth', async () => {
    const res = await request(app).get('/api/videos');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/videos/:id requires auth', async () => {
    const res = await request(app).delete('/api/videos/some-id');
    expect(res.status).toBe(401);
  });

  it('GET /api/videos/models/available requires auth', async () => {
    const res = await request(app).get('/api/videos/models/available');
    expect(res.status).toBe(401);
  });

  // ── Gallery ──────────────────────────────────────────────────

  it('GET /api/videos returns empty gallery for new user', async () => {
    const res = await request(app)
      .get('/api/videos')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.videos)).toBe(true);
    expect(res.body.videos.length).toBe(0);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('max');
  });

  it('GET /api/videos is isolated per user', async () => {
    const res1 = await request(app)
      .get('/api/videos')
      .set('Authorization', authHeader);
    const res2 = await request(app)
      .get('/api/videos')
      .set('Authorization', authHeader2);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Each user sees their own empty gallery
    expect(res1.body.count).toBe(0);
    expect(res2.body.count).toBe(0);
  });

  it('DELETE /api/videos/:id returns 404 for non-existent video', async () => {
    const res = await request(app)
      .delete('/api/videos/nonexistent-id')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });

  // ── Models ───────────────────────────────────────────────────

  it('GET /api/videos/models/available returns model list', async () => {
    const res = await request(app)
      .get('/api/videos/models/available')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models.length).toBeGreaterThan(0);
  });

  it('GET /api/videos/models/available includes auto model', async () => {
    const res = await request(app)
      .get('/api/videos/models/available')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    const auto = res.body.models.find((m: { id: string }) => m.id === 'auto');
    expect(auto).toBeDefined();
  });
});
