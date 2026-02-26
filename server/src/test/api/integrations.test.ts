/**
 * Integrations Route Tests
 * CRUD, connect/disconnect, permissions, Telegram link, invite flow, events.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { v4 as uuid } from 'uuid';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

function insertIntegration(userId: string, type: string, name: string, status = 'disconnected'): string {
  const id = uuid();
  db.prepare(
    `INSERT INTO integrations (id, user_id, type, name, status, health, features, permissions, config)
     VALUES (?, ?, ?, ?, ?, 0, '[]', '[]', '{}')`
  ).run(id, userId, type, name, status);
  return id;
}

describe('Integrations', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => { resetDatabase(); });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
  });

  it('GET /api/integrations returns user integrations', async () => {
    insertIntegration(userId, 'slack', 'Slack');
    const res = await request(app).get('/api/integrations').set('Authorization', authHeader).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('userId');
    expect(res.body[0]).toHaveProperty('features');
  });

  it('GET /api/integrations requires auth', async () => {
    await request(app).get('/api/integrations').expect(401);
  });

  it('POST /api/integrations/:type/connect sets status to connected', async () => {
    insertIntegration(userId, 'slack', 'Slack');
    const res = await request(app).post('/api/integrations/slack/connect').set('Authorization', authHeader).expect(200);
    expect(res.body.status).toBe('connected');
    expect(res.body.health).toBe(100);
  });

  it('POST /api/integrations/:type/connect returns 404 for non-existent', async () => {
    await request(app).post('/api/integrations/nonexistent/connect').set('Authorization', authHeader).expect(404);
  });

  it('POST /api/integrations/:id/disconnect sets status to disconnected', async () => {
    const intId = insertIntegration(userId, 'slack', 'Slack', 'connected');
    const res = await request(app).post(`/api/integrations/${intId}/disconnect`).set('Authorization', authHeader).expect(200);
    expect(res.body.status).toBe('disconnected');
    expect(res.body.health).toBe(0);
  });

  it('PATCH /api/integrations/:id/permissions updates permissions', async () => {
    const intId = insertIntegration(userId, 'slack', 'Slack');
    const res = await request(app)
      .patch(`/api/integrations/${intId}/permissions`)
      .set('Authorization', authHeader)
      .send({ permissions: ['read', 'write'] })
      .expect(200);
    expect(res.body.permissions).toEqual(['read', 'write']);
  });

  it('POST /api/integrations/telegram/link returns 503 when bot not configured', async () => {
    const origToken = config.telegramBotToken;
    config.telegramBotToken = '';
    const res = await request(app).post('/api/integrations/telegram/link').set('Authorization', authHeader).expect(503);
    expect(res.body.error).toContain('not configured');
    config.telegramBotToken = origToken;
  });

  it('GET /api/integrations/telegram/status returns linked: false when no link', async () => {
    const res = await request(app).get('/api/integrations/telegram/status').set('Authorization', authHeader).expect(200);
    expect(res.body.linked).toBe(false);
  });

  it('POST /api/integrations/whatsapp/link returns 410 deprecated', async () => {
    const res = await request(app).post('/api/integrations/whatsapp/link').set('Authorization', authHeader).expect(410);
    expect(res.body.error).toContain('removed');
  });

  it('POST /api/integrations/invite creates an invite with token', async () => {
    const res = await request(app).post('/api/integrations/invite').set('Authorization', authHeader).send({ email: 'friend@example.com' }).expect(200);
    expect(res.body).toHaveProperty('inviteUrl');
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('GET /api/integrations/invite/:token/info returns invite details', async () => {
    const invite = await request(app).post('/api/integrations/invite').set('Authorization', authHeader).send({}).expect(200);
    const res = await request(app).get(`/api/integrations/invite/${invite.body.token}/info`).expect(200);
    expect(res.body).toHaveProperty('ownerName');
    expect(res.body).toHaveProperty('token', invite.body.token);
  });

  it('POST /api/integrations/invite/:token/accept marks invite as used', async () => {
    const invite = await request(app).post('/api/integrations/invite').set('Authorization', authHeader).send({}).expect(200);
    const res = await request(app).post(`/api/integrations/invite/${invite.body.token}/accept`).send({ acceptorName: 'Bob' }).expect(200);
    expect(res.body.success).toBe(true);
    await request(app).post(`/api/integrations/invite/${invite.body.token}/accept`).send({ acceptorName: 'Bob' }).expect(409);
  });

  it('POST /api/integrations/:type/test returns not_connected for disconnected', async () => {
    insertIntegration(userId, 'slack', 'Slack', 'disconnected');
    const res = await request(app).post('/api/integrations/slack/test').set('Authorization', authHeader).expect(200);
    expect(res.body.healthy).toBe(false);
    expect(res.body.reason).toBe('not_connected');
  });

  it('GET /api/integrations/events returns integration activity', async () => {
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon, created_at) VALUES (?, ?, 'Connected integration', 'Slack', 'link', datetime('now'))`).run(uuid(), userId);
    const res = await request(app).get('/api/integrations/events').set('Authorization', authHeader).expect(200);
    expect(res.body).toHaveProperty('events');
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });
});
