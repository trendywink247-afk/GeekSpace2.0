// Report (flag AI response) route tests — Phase 28
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Report API', () => {
  let authHeader: string;

  beforeEach(() => {
    resetDatabase();
    const { id } = createTestUser();
    authHeader = makeAuthHeader(id);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('POST /api/report requires auth', async () => {
    const res = await request(app).post('/api/report').send({
      messageContent: 'some message content here',
      reason: 'harmful',
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/report requires auth', async () => {
    const res = await request(app).get('/api/report');
    expect(res.status).toBe(401);
  });

  // ── Validation ───────────────────────────────────────────────

  it('POST /api/report rejects missing messageContent', async () => {
    const res = await request(app)
      .post('/api/report')
      .set('Authorization', authHeader)
      .send({ reason: 'harmful' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messageContent/i);
  });

  it('POST /api/report rejects invalid reason', async () => {
    const res = await request(app)
      .post('/api/report')
      .set('Authorization', authHeader)
      .send({ messageContent: 'some message', reason: 'not-valid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/i);
  });

  it('POST /api/report accepts all valid reasons', async () => {
    const reasons = ['harmful', 'inaccurate', 'inappropriate', 'other'];
    for (const reason of reasons) {
      const res = await request(app)
        .post('/api/report')
        .set('Authorization', authHeader)
        .send({ messageContent: `report for ${reason}`, reason });
      expect(res.status).toBe(201);
    }
  });

  // ── Create + List ────────────────────────────────────────────

  it('POST /api/report creates a report', async () => {
    const res = await request(app)
      .post('/api/report')
      .set('Authorization', authHeader)
      .send({ messageContent: 'This AI response was harmful', reason: 'harmful' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('reportId');
    expect(res.body.status).toBe('received');
  });

  it('POST /api/report accepts optional additionalInfo', async () => {
    const res = await request(app)
      .post('/api/report')
      .set('Authorization', authHeader)
      .send({
        messageContent: 'Inaccurate info here',
        reason: 'inaccurate',
        additionalInfo: 'The model incorrectly stated X',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('reportId');
  });

  it('GET /api/report returns empty array for fresh user', async () => {
    const res = await request(app)
      .get('/api/report')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.reports.length).toBe(0);
  });

  it('GET /api/report lists own reports', async () => {
    await request(app)
      .post('/api/report')
      .set('Authorization', authHeader)
      .send({ messageContent: 'some bad message content', reason: 'inappropriate' });

    const res = await request(app)
      .get('/api/report')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.reports.length).toBe(1);
    expect(res.body.reports[0]).toHaveProperty('id');
    expect(res.body.reports[0]).toHaveProperty('reason');
    expect(res.body.reports[0]).toHaveProperty('status');
  });
});
