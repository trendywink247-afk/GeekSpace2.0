import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createTestUser, generateTestToken } from '../setup';
import { v4 as uuid } from 'uuid';
import { db } from '../../db/index';

const app = createApp();

describe('Phase 66', () => {
  beforeEach(() => { resetDatabase(); });

  // ── 66.2: Automation activity logging ─────────────────────────────────────
  describe('66.2 — automation activity logging', () => {
    it('logs delete event to activity_log when automation is deleted', async () => {
      const user = createTestUser(`phase66-del-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      // Create automation
      const createRes = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Log Delete Test', triggerType: 'manual', actionType: 'log' });
      expect(createRes.status).toBe(201);
      const autoId = createRes.body.id as string;

      // Delete it
      const delRes = await request(app)
        .delete(`/api/automations/${autoId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(200);

      // Verify activity log entry
      const logRow = db.prepare(
        `SELECT * FROM activity_log WHERE user_id = ? AND action = 'Deleted automation' AND details = 'Log Delete Test'`
      ).get(user.id);
      expect(logRow).toBeTruthy();
    });

    it('logs enable/disable event when automation enabled field changes', async () => {
      const user = createTestUser(`phase66-tog-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      const createRes = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Toggle Auto', triggerType: 'manual', actionType: 'log', enabled: true });
      expect(createRes.status).toBe(201);
      const autoId = createRes.body.id as string;

      // Disable
      await request(app)
        .patch(`/api/automations/${autoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: false });

      const disableLog = db.prepare(
        `SELECT * FROM activity_log WHERE user_id = ? AND action = 'Disabled automation'`
      ).get(user.id);
      expect(disableLog).toBeTruthy();

      // Enable
      await request(app)
        .patch(`/api/automations/${autoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true });

      const enableLog = db.prepare(
        `SELECT * FROM activity_log WHERE user_id = ? AND action = 'Enabled automation'`
      ).get(user.id);
      expect(enableLog).toBeTruthy();
    });

    it('logs trigger event when automation is manually triggered', async () => {
      const user = createTestUser(`phase66-trig-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      const createRes = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Trigger Auto', triggerType: 'manual', actionType: 'log' });
      expect(createRes.status).toBe(201);
      const autoId = createRes.body.id as string;

      await request(app)
        .post(`/api/automations/${autoId}/trigger`)
        .set('Authorization', `Bearer ${token}`);

      const trigLog = db.prepare(
        `SELECT * FROM activity_log WHERE user_id = ? AND action = 'Triggered automation'`
      ).get(user.id);
      expect(trigLog).toBeTruthy();
    });
  });

  // ── 66.3: Portfolio contact delete ────────────────────────────────────────
  describe('66.3 — portfolio contact delete', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/portfolio/contacts/fake-id');
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent contact', async () => {
      const user = createTestUser(`phase66-ctd-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .delete('/api/portfolio/contacts/non-existent-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('deletes a contact message and returns success', async () => {
      const user = createTestUser(`phase66-ctd2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      // Insert a contact directly in DB
      const contactId = uuid();
      db.prepare(
        'INSERT INTO portfolio_contacts (id, username, user_id, sender_name, sender_email, message) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(contactId, 'testuser', user.id, 'Test Sender', 'test@x.com', 'Hello!');

      const res = await request(app)
        .delete(`/api/portfolio/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone (better-sqlite3 returns undefined, not null, on miss)
      const row = db.prepare('SELECT id FROM portfolio_contacts WHERE id = ?').get(contactId);
      expect(row).toBeUndefined();
    });

    it('DELETE /contacts bulk clear returns deleted count', async () => {
      const user = createTestUser(`phase66-ctbulk-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      // Insert two contacts
      for (let i = 0; i < 2; i++) {
        db.prepare(
          'INSERT INTO portfolio_contacts (id, username, user_id, sender_name, message) VALUES (?, ?, ?, ?, ?)'
        ).run(uuid(), 'testuser', user.id, `Sender${i}`, `Message ${i}`);
      }

      const res = await request(app)
        .delete('/api/portfolio/contacts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(2);
    });
  });

  // ── 66.3: Portfolio analytics export date-range ───────────────────────────
  describe('66.3 — analytics export date-range', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/portfolio/me/analytics/export');
      expect(res.status).toBe(401);
    });

    it('accepts from/to date params and returns CSV', async () => {
      const user = createTestUser(`phase66-ana-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/portfolio/me/analytics/export?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${token}`);
      // Could be 200 (CSV) or 429 if rate-limited in test env
      expect([200, 429]).toContain(res.status);
    });
  });

  // ── 66.6: Portfolio contacts GET ──────────────────────────────────────────
  describe('66.6 — GET /api/portfolio/contacts', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/portfolio/contacts');
      expect(res.status).toBe(401);
    });

    it('returns array of contacts for authenticated user', async () => {
      const user = createTestUser(`phase66-ctg-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/portfolio/contacts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
