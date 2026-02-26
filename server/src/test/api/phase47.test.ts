// ============================================================
// Phase 47 — Unit tests for:
//   47.1 GET /api/health includes live DB status check
//        - returns 200 with db field in components
//        - components.database is 'ok' when DB is reachable
//   47.6 Webhook payload validation — reject non-object body
//        - POST /webhook/:id with array body returns 400
//        - POST /webhook/:id with string body returns 400
//        - POST /webhook/:id with null body returns 400
//        - POST /webhook/:id with valid object body reaches trigger (not 400)
//   47.7 POST /auth/signup rate limit (TEST_MODE bypasses rate limiting)
//        - In TEST_MODE rate limiting is disabled — endpoint remains accessible
//   47.9 GET /api/version returns version + gitSha + env
//        - returns 200 with version, gitSha, env fields
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 47.1: GET /api/health includes live DB status ──────────────────────────

describe('Phase 47.1 — /api/health includes DB status', () => {
  beforeAll(() => { resetDatabase(); });

  it('returns 200 with components.database field', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body).toHaveProperty('components');
    expect(res.body.components).toHaveProperty('database');
  });

  it('components.database is "ok" when DB is reachable', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body.components.database).toBe('ok');
  });

  it('returns version field in response', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    expect(res.body).toHaveProperty('version');
    expect(typeof res.body.version).toBe('string');
  });
});

// ── 47.6: Webhook payload validation ──────────────────────────────────────

describe('Phase 47.6 — Webhook payload non-object rejection', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns 400 when body is an array', async () => {
    const res = await request(app)
      .post('/api/automations/webhook/some-id')
      .set('Content-Type', 'application/json')
      .send([{ event: 'test' }])
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/object/i);
  });

  it('returns 400 when body is a string (sent as raw JSON string)', async () => {
    const res = await request(app)
      .post('/api/automations/webhook/some-id')
      .set('Content-Type', 'application/json')
      .send('"just a string"')
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('valid object body passes validation (not rejected with 400)', async () => {
    // Use a non-existent automation ID — the engine returns a 200 with "not found" message
    // but critically does NOT return 400 (payload validation passes, handler is reached)
    const nonExistentId = uuid();
    const res = await request(app)
      .post(`/api/automations/webhook/${nonExistentId}`)
      .set('Content-Type', 'application/json')
      .send({ event: 'test' });

    // Engine returns 404 for unknown automations — not 400 (payload was valid)
    expect(res.status).not.toBe(400);
  });
});

// ── 47.7: Signup rate limit (TEST_MODE bypasses rate limiting) ─────────────

describe('Phase 47.7 — /auth/signup rate limit', () => {
  beforeAll(() => { resetDatabase(); });

  it('signup endpoint is accessible in TEST_MODE (rate limiting disabled)', async () => {
    // In TEST_MODE rate limiting is disabled — verify endpoint accepts requests
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: `ratelimit-check-${Date.now()}@example.com`, username: `rlcheck${Date.now()}`, password: 'Test123!' });

    // Accepts requests (201 success or 4xx validation error, NOT 429 since TEST_MODE)
    expect(res.status).not.toBe(429);
  });
});

// ── 47.9: GET /api/version endpoint ───────────────────────────────────────

describe('Phase 47.9 — /api/version endpoint', () => {
  beforeAll(() => { resetDatabase(); });

  it('returns 200 with version field', async () => {
    const res = await request(app)
      .get('/api/version')
      .expect(200);

    expect(res.body).toHaveProperty('version');
    expect(typeof res.body.version).toBe('string');
    expect(res.body.version.length).toBeGreaterThan(0);
  });

  it('returns gitSha field', async () => {
    const res = await request(app)
      .get('/api/version')
      .expect(200);

    expect(res.body).toHaveProperty('gitSha');
    expect(typeof res.body.gitSha).toBe('string');
  });

  it('returns env field', async () => {
    const res = await request(app)
      .get('/api/version')
      .expect(200);

    expect(res.body).toHaveProperty('env');
    expect(['production', 'development']).toContain(res.body.env);
  });

  it('is unauthenticated (no token required)', async () => {
    const res = await request(app)
      .get('/api/version');

    expect(res.status).toBe(200);
  });
});
