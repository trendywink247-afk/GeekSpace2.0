// Proactive messages route tests — Phase 29
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Proactive API', () => {
  let authHeader: string;

  beforeEach(() => {
    resetDatabase();
    const { id } = createTestUser();
    authHeader = makeAuthHeader(id);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/proactive/log requires auth', async () => {
    const res = await request(app).get('/api/proactive/log');
    expect(res.status).toBe(401);
  });

  it('GET /api/proactive/settings requires auth', async () => {
    const res = await request(app).get('/api/proactive/settings');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/proactive/toggle requires auth', async () => {
    const res = await request(app).patch('/api/proactive/toggle').send({ enabled: false });
    expect(res.status).toBe(401);
  });

  // ── Log ──────────────────────────────────────────────────────

  it('GET /api/proactive/log returns log array', async () => {
    const res = await request(app)
      .get('/api/proactive/log')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('log');
    expect(Array.isArray(res.body.log)).toBe(true);
  });

  it('GET /api/proactive/log returns empty for fresh user', async () => {
    const res = await request(app)
      .get('/api/proactive/log')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.log.length).toBe(0);
  });

  // ── Settings ─────────────────────────────────────────────────

  it('GET /api/proactive/settings returns enabled flag', async () => {
    const res = await request(app)
      .get('/api/proactive/settings')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(typeof res.body.enabled).toBe('boolean');
  });

  it('PATCH /api/proactive/toggle rejects non-boolean enabled', async () => {
    const res = await request(app)
      .patch('/api/proactive/toggle')
      .set('Authorization', authHeader)
      .send({ enabled: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boolean/i);
  });

  it('PATCH /api/proactive/toggle updates enabled state', async () => {
    const disable = await request(app)
      .patch('/api/proactive/toggle')
      .set('Authorization', authHeader)
      .send({ enabled: false });
    expect(disable.status).toBe(200);
    expect(disable.body.enabled).toBe(false);

    const settings = await request(app)
      .get('/api/proactive/settings')
      .set('Authorization', authHeader);
    expect(settings.body.enabled).toBe(false);
  });
});
