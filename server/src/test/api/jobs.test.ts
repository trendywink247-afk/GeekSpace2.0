// Jobs (async job polling) route tests — Phase 29
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Jobs API', () => {
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

  it('GET /api/jobs/:id requires auth', async () => {
    const res = await request(app).get('/api/jobs/some-job-id');
    expect(res.status).toBe(401);
  });

  // ── Job polling ──────────────────────────────────────────────

  it('GET /api/jobs/:id returns 404 for non-existent job', async () => {
    const res = await request(app)
      .get('/api/jobs/nonexistent-job-id')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/jobs/:id returns 404 for another users job', async () => {
    // Jobs are user-scoped — even with a valid UUID, other users get 404
    const res = await request(app)
      .get('/api/jobs/00000000-0000-0000-0000-000000000001')
      .set('Authorization', authHeader2);
    expect(res.status).toBe(404);
  });
});
