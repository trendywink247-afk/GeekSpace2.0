/**
 * Phase 108 Tests — Agentin Gate API
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { resetDatabase } from '../setup.js';

const app = createApp();

async function getDemoToken(): Promise<string> {
  const res = await request(app).post('/api/auth/demo').expect(200);
  return res.body.token as string;
}

describe('Phase 108 — Gate key management', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('POST /api/gate/v1/keys creates a key with agtn_ prefix', async () => {
    const token = await getDemoToken();
    const res = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Test Key' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.key).toMatch(/^agtn_/);
    expect(res.body.data.key.length).toBeGreaterThan(10);
    expect(res.body.data.label).toBe('Test Key');
    expect(res.body.data).toHaveProperty('keyPrefix');
  });

  it('GET /api/gate/v1/keys lists user keys without plaintext key', async () => {
    const token = await getDemoToken();
    await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Key 1' })
      .expect(201);

    const res = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.keys)).toBe(true);
    expect(res.body.data.keys.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.keys[0]).not.toHaveProperty('key');
    expect(res.body.data.keys[0]).toHaveProperty('keyPrefix');
  });

  it('DELETE /api/gate/v1/keys/:id deactivates a key', async () => {
    const token = await getDemoToken();
    const createRes = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Delete Me' })
      .expect(201);

    const keyId = createRes.body.data.id as string;
    await request(app)
      .delete(`/api/gate/v1/keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const row = db.prepare('SELECT is_active FROM gate_api_keys WHERE id = ?').get(keyId) as { is_active: number };
    expect(row.is_active).toBe(0);
  });

  it('POST /api/gate/v1/keys requires auth', async () => {
    await request(app)
      .post('/api/gate/v1/keys')
      .send({ label: 'No Auth' })
      .expect(401);
  });

  it('POST /api/gate/v1/keys enforces 5-key limit', async () => {
    const token = await getDemoToken();
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/gate/v1/keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: `Key ${i}` })
        .expect(201);
    }
    const res = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Key 6' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Maximum 5');
  });
});
