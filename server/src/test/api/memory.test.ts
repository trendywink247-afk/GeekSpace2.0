// ============================================================
// Phase 26 — Memory API tests (/api/memory)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

describe('Memory API — /api/memory', () => {
  beforeEach(() => {
    resetDatabase();
  });

  // Auth guards
  it('GET / requires auth', async () => {
    const res = await request(app).get('/api/memory').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /context requires auth', async () => {
    const res = await request(app).get('/api/memory/context').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST / requires auth', async () => {
    const res = await request(app).post('/api/memory').send({ key: 'k', value: 'v' }).expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /:id requires auth', async () => {
    const res = await request(app).delete('/api/memory/1').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  // List
  it('GET / returns empty array for new user', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('memories');
    expect(Array.isArray(res.body.memories)).toBe(true);

    cleanupTestUser(user.id);
  });

  // Context
  it('GET /context returns context string', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/memory/context')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('context');
    expect(typeof res.body.context).toBe('string');

    cleanupTestUser(user.id);
  });

  // Create
  it('POST / creates a memory entry', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'name', value: 'Alice' })
      .expect(201);

    expect(res.body).toHaveProperty('memory');
    expect(res.body.memory).toHaveProperty('key', 'name');
    expect(res.body.memory).toHaveProperty('value', 'Alice');

    cleanupTestUser(user.id);
  });

  it('POST / rejects missing key', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ value: 'no key' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / rejects missing value', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'mykey' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / rejects key over 100 chars', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'k'.repeat(101), value: 'v' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / rejects value over 2000 chars', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'k', value: 'x'.repeat(2001) })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / upserts on same key', async () => {
    const user = createTestUser();

    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'color', value: 'blue' })
      .expect(201);

    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'color', value: 'red' })
      .expect(201);

    const listRes = await request(app)
      .get('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const colorEntries = listRes.body.memories.filter((m: { key: string }) => m.key === 'color');
    expect(colorEntries).toHaveLength(1);
    expect(colorEntries[0].value).toBe('red');

    cleanupTestUser(user.id);
  });

  // Delete
  it('DELETE /:id removes memory entry', async () => {
    const user = createTestUser();

    const createRes = await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ key: 'to-delete', value: 'bye' })
      .expect(201);

    const memId = createRes.body.memory.id;

    await request(app)
      .delete(`/api/memory/${memId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const listRes = await request(app)
      .get('/api/memory')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const found = listRes.body.memories.find((m: { id: number }) => m.id === memId);
    expect(found).toBeUndefined();

    cleanupTestUser(user.id);
  });

  it('DELETE /:id returns 404 for non-existent entry', async () => {
    const user = createTestUser();
    await request(app)
      .delete('/api/memory/99999')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);

    cleanupTestUser(user.id);
  });

  it('DELETE /:id returns 400 for non-numeric id', async () => {
    const user = createTestUser();
    await request(app)
      .delete('/api/memory/abc')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(400);

    cleanupTestUser(user.id);
  });

  // Cross-user isolation
  it('GET / does not return memories from another user', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    await request(app)
      .post('/api/memory')
      .set('Authorization', makeAuthHeader(user1.id))
      .send({ key: 'secret', value: 'user1-only' })
      .expect(201);

    const res = await request(app)
      .get('/api/memory')
      .set('Authorization', makeAuthHeader(user2.id))
      .expect(200);

    expect(res.body.memories).toHaveLength(0);

    cleanupTestUser(user1.id);
    cleanupTestUser(user2.id);
  });
});
