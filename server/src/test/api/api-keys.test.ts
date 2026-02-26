/**
 * API Keys Route Tests
 * CRUD operations, key rotation, default toggle, auth guard.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('API Keys', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
    db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
  });

  it('GET /api/api-keys returns empty array when no keys', async () => {
    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', authHeader)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/api-keys requires auth', async () => {
    await request(app).get('/api/api-keys').expect(401);
  });

  it('POST /api/api-keys creates a key and masks it', async () => {
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', label: 'My Key', key: 'sk-abcdefghijklmnop1234' })
      .expect(201);
    expect(res.body.provider).toBe('openai');
    expect(res.body.maskedKey).toBe('sk-...1234');
    expect(res.body.isDefault).toBe(true);
    expect(res.body.key_encrypted).toBeUndefined();
  });

  it('POST second key is not default', async () => {
    await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-firstkeyvalue12345678' })
      .expect(201);
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'anthropic', key: 'sk-ant-secondvalue123456' })
      .expect(201);
    expect(res.body.isDefault).toBe(false);
  });

  it('DELETE /api/api-keys/:id removes key', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-deleteme123456789012' })
      .expect(201);
    await request(app)
      .delete(`/api/api-keys/${create.body.id}`)
      .set('Authorization', authHeader)
      .expect(200);
    const list = await request(app)
      .get('/api/api-keys')
      .set('Authorization', authHeader)
      .expect(200);
    expect(list.body.length).toBe(0);
  });

  it('DELETE /api/api-keys/:id returns 404 for wrong user', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-otherperson12345678' })
      .expect(201);
    const otherUser = createTestUser();
    await request(app)
      .delete(`/api/api-keys/${create.body.id}`)
      .set('Authorization', makeAuthHeader(otherUser.id))
      .expect(404);
  });

  it('POST /api/api-keys/:id/rotate updates masked key', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-originalkey1234567890' })
      .expect(201);
    const res = await request(app)
      .post(`/api/api-keys/${create.body.id}/rotate`)
      .set('Authorization', authHeader)
      .send({ key: 'sk-newrotatedkey123456789' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.maskedKey).toBe('sk-...6789');
  });

  it('POST /api/api-keys/:id/rotate rejects short key', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-originalkey1234567890' })
      .expect(201);
    await request(app)
      .post(`/api/api-keys/${create.body.id}/rotate`)
      .set('Authorization', authHeader)
      .send({ key: 'short' })
      .expect(400);
  });

  it('PATCH /api/api-keys/:id/default switches default', async () => {
    const k1 = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-firstdefaultkey123456' })
      .expect(201);
    const k2 = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'anthropic', key: 'sk-ant-secondnotdefault12' })
      .expect(201);
    const res = await request(app)
      .patch(`/api/api-keys/${k2.body.id}/default`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(res.body.is_default).toBe(1);
    const list = await request(app)
      .get('/api/api-keys')
      .set('Authorization', authHeader)
      .expect(200);
    const first = list.body.find((k: Record<string, unknown>) => k.id === k1.body.id);
    expect(first.is_default).toBe(0);
  });
});
