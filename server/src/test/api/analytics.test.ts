// Analytics route tests — Phase 27
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Analytics API', () => {
  let authHeader: string;

  beforeEach(() => {
    resetDatabase();
    const { id } = createTestUser();
    authHeader = makeAuthHeader(id);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/analytics/snapshot requires auth', async () => {
    const res = await request(app).get('/api/analytics/snapshot');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/weekly requires auth', async () => {
    const res = await request(app).get('/api/analytics/weekly');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/heatmap requires auth', async () => {
    const res = await request(app).get('/api/analytics/heatmap');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/agents requires auth', async () => {
    const res = await request(app).get('/api/analytics/agents');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/topics requires auth', async () => {
    const res = await request(app).get('/api/analytics/topics');
    expect(res.status).toBe(401);
  });

  // ── Authenticated responses ──────────────────────────────────

  it('GET /api/analytics/snapshot returns snapshots array', async () => {
    const res = await request(app)
      .get('/api/analytics/snapshot')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('snapshots');
    expect(Array.isArray(res.body.snapshots)).toBe(true);
  });

  it('GET /api/analytics/snapshot accepts days param', async () => {
    const res = await request(app)
      .get('/api/analytics/snapshot?days=7')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.snapshots)).toBe(true);
  });

  it('GET /api/analytics/weekly returns summary', async () => {
    const res = await request(app)
      .get('/api/analytics/weekly')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /api/analytics/heatmap returns heatmap', async () => {
    const res = await request(app)
      .get('/api/analytics/heatmap')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('heatmap');
  });

  it('GET /api/analytics/agents returns agents array', async () => {
    const res = await request(app)
      .get('/api/analytics/agents')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
  });

  it('GET /api/analytics/topics returns topics array', async () => {
    const res = await request(app)
      .get('/api/analytics/topics')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('topics');
    expect(Array.isArray(res.body.topics)).toBe(true);
  });
});
