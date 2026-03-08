// ============================================================
// Phase 25 — Inbox API tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

describe('Inbox API — /api/inbox', () => {
  beforeEach(() => {
    resetDatabase();
  });

  // Auth guards
  it('GET / requires auth', async () => {
    await request(app).get('/api/inbox').expect(401);
  });

  it('GET /count requires auth', async () => {
    await request(app).get('/api/inbox/count').expect(401);
  });

  it('PATCH /:id/read requires auth', async () => {
    await request(app).patch('/api/inbox/1/read').expect(401);
  });

  it('PATCH /:id/archive requires auth', async () => {
    await request(app).patch('/api/inbox/1/archive').expect(401);
  });

  it('DELETE /:id requires auth', async () => {
    await request(app).delete('/api/inbox/1').expect(401);
  });

  // List
  it('GET / returns empty inbox for new user', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('messages');
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages).toHaveLength(0);

    cleanupTestUser(user.id);
  });

  it('GET /count returns 0 for new user', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/inbox/count')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('unread');
    expect(res.body.unread).toBe(0);

    cleanupTestUser(user.id);
  });

  // Add message (POST /)
  it('POST / creates a message', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system', content: 'Hello from system' })
      .expect(201);

    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toHaveProperty('source', 'system');
    expect(res.body.message).toHaveProperty('content', 'Hello from system');

    cleanupTestUser(user.id);
  });

  it('POST / rejects missing source', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ content: 'No source here' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / rejects missing content', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / rejects invalid source', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'invalid', content: 'Bad source' })
      .expect(400);

    cleanupTestUser(user.id);
  });

  it('POST / accepts optional sender field', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system', content: 'Hello', sender: 'bot-123' })
      .expect(201);

    expect(res.body.message).toHaveProperty('sender', 'bot-123');

    cleanupTestUser(user.id);
  });

  it('POST / accepts all valid sources', async () => {
    const user = createTestUser();
    for (const source of ['telegram', 'whatsapp', 'system', 'agent']) {
      const res = await request(app)
        .post('/api/inbox')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ source, content: `Message from ${source}` })
        .expect(201);

      expect(res.body.message.source).toBe(source);
    }

    cleanupTestUser(user.id);
  });

  // Mark read
  it('PATCH /:id/read marks message as read', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system', content: 'Test msg' })
      .expect(201);

    const msgId = createRes.body.message.id;

    const res = await request(app)
      .patch(`/api/inbox/${msgId}/read`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('success', true);

    cleanupTestUser(user.id);
  });

  it('PATCH /:id/read returns 404 for unknown id', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/inbox/99999/read')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);

    cleanupTestUser(user.id);
  });

  it('PATCH /:id/read returns 400 for non-numeric id', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/inbox/abc/read')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(400);

    cleanupTestUser(user.id);
  });

  // Archive
  it('PATCH /:id/archive archives the message', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system', content: 'Archive me' })
      .expect(201);

    const msgId = createRes.body.message.id;

    await request(app)
      .patch(`/api/inbox/${msgId}/archive`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    cleanupTestUser(user.id);
  });

  // Delete
  it('DELETE /:id removes the message', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'agent', content: 'Delete me' })
      .expect(201);

    const msgId = createRes.body.message.id;

    await request(app)
      .delete(`/api/inbox/${msgId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    cleanupTestUser(user.id);
  });

  it('DELETE /:id returns 404 for unknown id', async () => {
    const user = createTestUser();
    await request(app)
      .delete('/api/inbox/99999')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);

    cleanupTestUser(user.id);
  });

  // Unread count after adding messages
  it('unread count increases after adding a message', async () => {
    const user = createTestUser();

    await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system', content: 'Unread 1' })
      .expect(201);

    const res = await request(app)
      .get('/api/inbox/count')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.unread).toBeGreaterThan(0);

    cleanupTestUser(user.id);
  });

  // Cross-user isolation
  it('GET / does not return messages from another user', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user1.id))
      .send({ source: 'system', content: 'User1 private' })
      .expect(201);

    const res = await request(app)
      .get('/api/inbox')
      .set('Authorization', makeAuthHeader(user2.id))
      .expect(200);

    expect(res.body.messages).toHaveLength(0);

    cleanupTestUser(user1.id);
    cleanupTestUser(user2.id);
  });

  // Reply to non-telegram/whatsapp message
  it('POST /:id/reply returns 400 for system source', async () => {
    const user = createTestUser();
    const createRes = await request(app)
      .post('/api/inbox')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ source: 'system', content: 'System msg' })
      .expect(201);

    const msgId = createRes.body.message.id;

    await request(app)
      .post(`/api/inbox/${msgId}/reply`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ text: 'Hello back' })
      .expect(400);

    cleanupTestUser(user.id);
  });
});
