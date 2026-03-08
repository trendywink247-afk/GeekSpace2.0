/**
 * Gate API Route Tests — Phase 21
 * Key CRUD, auth guards, usage endpoint, models endpoint.
 * LLM/image endpoints require external services — only auth guard tested.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { createHash, randomBytes } from 'crypto';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Insert a gate key directly into the DB and return the raw key */
function seedGateKey(userId: string, label = 'Test Key'): string {
  const rawKey = `agtn_${randomBytes(16).toString('hex')}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);
  const id = randomBytes(8).toString('hex');
  db.prepare(
    "INSERT INTO gate_api_keys (id, user_id, label, key_hash, key_prefix, created_at, is_active) VALUES (?, ?, ?, ?, ?, datetime('now'), 1)"
  ).run(id, userId, label, keyHash, keyPrefix);
  return rawKey;
}

describe('Gate API — Key Management', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
    db.prepare('DELETE FROM gate_api_keys WHERE user_id = ?').run(userId);
  });

  // ── Auth guards (key management uses JWT auth) ────────────────

  it('POST /api/gate/v1/keys requires JWT auth', async () => {
    await request(app).post('/api/gate/v1/keys').expect(401);
  });

  it('GET /api/gate/v1/keys requires JWT auth', async () => {
    await request(app).get('/api/gate/v1/keys').expect(401);
  });

  it('DELETE /api/gate/v1/keys/:id requires JWT auth', async () => {
    await request(app).delete('/api/gate/v1/keys/some-id').expect(401);
  });

  // ── Gate-key auth guards (Gate API endpoints) ─────────────────

  it('GET /api/gate/v1/usage rejects missing Authorization header', async () => {
    const res = await request(app).get('/api/gate/v1/usage').expect(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/gate/v1/usage rejects JWT token (not a gate key)', async () => {
    const res = await request(app)
      .get('/api/gate/v1/usage')
      .set('Authorization', authHeader)
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/gate/v1/usage rejects invalid gate key', async () => {
    const res = await request(app)
      .get('/api/gate/v1/usage')
      .set('Authorization', 'Bearer agtn_invalid_key_12345678901234567890123456789012')
      .expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid|revoked/i);
  });

  // ── Key creation ──────────────────────────────────────────────

  it('POST /api/gate/v1/keys creates a key with agtn_ prefix', async () => {
    const res = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .send({ label: 'My Integration' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.key).toMatch(/^agtn_/);
    expect(res.body.data.label).toBe('My Integration');
    expect(res.body.data.keyPrefix).toMatch(/^agtn_/);
  });

  it('POST /api/gate/v1/keys uses default label when none provided', async () => {
    const res = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .send({})
      .expect(201);

    expect(res.body.data.label).toBe('My API Key');
  });

  it('POST /api/gate/v1/keys rejects label over 100 chars', async () => {
    const res = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .send({ label: 'x'.repeat(101) })
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/gate/v1/keys enforces max 5 active keys', async () => {
    // Seed 5 keys
    for (let i = 0; i < 5; i++) {
      seedGateKey(userId, `Key ${i}`);
    }

    const res = await request(app)
      .post('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .send({ label: 'Overflow Key' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/maximum 5/i);
  });

  // ── Key listing ───────────────────────────────────────────────

  it('GET /api/gate/v1/keys returns empty array with no keys', async () => {
    const res = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.keys).toEqual([]);
  });

  it('GET /api/gate/v1/keys lists active keys without plaintext secret', async () => {
    const rawKey = seedGateKey(userId, 'Listed Key');

    const res = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.data.keys).toHaveLength(1);
    const k = res.body.data.keys[0];
    expect(k.label).toBe('Listed Key');
    expect(k.keyPrefix).toMatch(/^agtn_/);
    expect(k.isActive).toBe(true);
    // Raw key must NOT be exposed in listing
    expect(JSON.stringify(res.body)).not.toContain(rawKey);
  });

  it('GET /api/gate/v1/keys does not show another user\'s keys', async () => {
    const other = createTestUser();
    seedGateKey(other.id, 'Other Key');

    const res = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.data.keys).toHaveLength(0);
  });

  // ── Key deletion ──────────────────────────────────────────────

  it('DELETE /api/gate/v1/keys/:id soft-deletes the key', async () => {
    seedGateKey(userId, 'ToDelete');
    const listRes = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .expect(200);
    const keyId = listRes.body.data.keys[0].id as string;

    const delRes = await request(app)
      .delete(`/api/gate/v1/keys/${keyId}`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(delRes.body.data.revoked).toBe(true);

    // Key should appear as inactive in listing (soft delete)
    const afterRes = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', authHeader)
      .expect(200);
    const deactivated = afterRes.body.data.keys.find((k: { id: string }) => k.id === keyId) as
      { isActive: boolean } | undefined;
    expect(deactivated?.isActive).toBe(false);
  });

  it('DELETE /api/gate/v1/keys/:id returns 404 for unknown key', async () => {
    const res = await request(app)
      .delete('/api/gate/v1/keys/does-not-exist')
      .set('Authorization', authHeader)
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/gate/v1/keys/:id prevents deleting another user\'s key', async () => {
    const other = createTestUser();
    const rawKey = seedGateKey(other.id, 'Other Key');
    void rawKey;

    const otherListRes = await request(app)
      .get('/api/gate/v1/keys')
      .set('Authorization', makeAuthHeader(other.id))
      .expect(200);
    const otherId = otherListRes.body.data.keys[0].id as string;

    const res = await request(app)
      .delete(`/api/gate/v1/keys/${otherId}`)
      .set('Authorization', authHeader)
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  // ── Usage endpoint with valid gate key ────────────────────────

  it('GET /api/gate/v1/usage returns plan info with valid gate key', async () => {
    const rawKey = seedGateKey(userId, 'Usage Key');

    const res = await request(app)
      .get('/api/gate/v1/usage')
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan');
    expect(res.body.data).toHaveProperty('creditsRemaining');
    expect(res.body.data).toHaveProperty('monthlyCredits');
  });

  // ── Models endpoint ───────────────────────────────────────────

  it('GET /api/gate/v1/models returns model list with valid gate key', async () => {
    const rawKey = seedGateKey(userId, 'Models Key');

    const res = await request(app)
      .get('/api/gate/v1/models')
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('models');
    expect(Array.isArray(res.body.data.models)).toBe(true);
  });

  // ── Chat/Image — only auth guard (real LLM calls not made in tests) ──

  it('POST /api/gate/v1/chat rejects missing gate key', async () => {
    const res = await request(app)
      .post('/api/gate/v1/chat')
      .send({ messages: [{ role: 'user', content: 'Hello' }] })
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/gate/v1/image rejects missing gate key', async () => {
    const res = await request(app)
      .post('/api/gate/v1/image')
      .send({ prompt: 'a cat' })
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});
