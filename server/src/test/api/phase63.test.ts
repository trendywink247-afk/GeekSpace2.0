import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createTestUser, generateTestToken } from '../setup';
import { initAutomationsEngine } from '../../services/automations-engine.js';

const app = createApp();

describe('Phase 63', () => {
  beforeAll(() => { initAutomationsEngine(); }); // ensures automation_logs table exists
  beforeEach(() => { resetDatabase(); });

  // ── 63.2: Portfolio analytics CSV export ───────────────────────────────────
  describe('63.2 — GET /api/portfolio/me/analytics/export', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/portfolio/me/analytics/export');
      expect(res.status).toBe(401);
    });

    it('returns CSV with header row', async () => {
      const user = createTestUser(`phase63-csv-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/portfolio/me/analytics/export')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('date,views');
    });
  });

  // ── 63.4: Automation log status filter ─────────────────────────────────────
  describe('63.4 — GET /api/automations/logs?status=', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/automations/logs?status=success');
      expect(res.status).toBe(401);
    });

    it('accepts valid status filter and returns logs array', async () => {
      const user = createTestUser(`phase63-logs-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/automations/logs?status=success')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('ignores invalid status filter (returns all logs)', async () => {
      const user = createTestUser(`phase63-logs2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/automations/logs?status=invalid-status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  // ── 63.6: Reminder datetime validation ─────────────────────────────────────
  describe('63.6 — POST /api/reminders datetime validation', () => {
    it('rejects invalid datetime format', async () => {
      const user = createTestUser(`phase63-dt-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Test reminder', datetime: 'not-a-date', channel: 'push' });
      expect(res.status).toBe(400);
    });

    it('accepts valid ISO datetime', async () => {
      const user = createTestUser(`phase63-dt2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Valid datetime test', datetime: '2030-06-15T10:00:00.000Z', channel: 'push' });
      expect(res.status).toBe(201);
    });

    it('accepts datetime without timezone (local datetime)', async () => {
      const user = createTestUser(`phase63-dt3-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Local datetime test', datetime: '2030-06-15T10:00', channel: 'push' });
      expect(res.status).toBe(201);
    });

    it('accepts missing datetime (optional field)', async () => {
      const user = createTestUser(`phase63-dt4-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'No datetime test', channel: 'push' });
      expect(res.status).toBe(201);
    });
  });
});
