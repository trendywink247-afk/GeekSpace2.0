/**
 * Phase 109 Tests — Conversation Quality Rating
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { resetDatabase } from '../setup.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

async function getDemoToken(): Promise<string> {
  const res = await request(app).post('/api/auth/demo').expect(200);
  return res.body.token as string;
}

function seedConversation(userId: string): { userMsgId: string; assistantId: string } {
  const userMsgId = uuid();
  const assistantId = uuid();
  db.prepare(`INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'user', ?, datetime('now', '-1 second'))`).run(userMsgId, userId, 'What is AI?');
  db.prepare(`INSERT INTO conversation_log (id, user_id, role, content, provider, model, created_at) VALUES (?, ?, 'assistant', ?, 'openrouter', 'gpt-4o', datetime('now'))`).run(assistantId, userId, 'AI stands for Artificial Intelligence.');
  return { userMsgId, assistantId };
}

describe('Phase 109 — Conversation Quality Rating', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('GET /api/agent/conversations/ratings requires auth', async () => {
    await request(app).get('/api/agent/conversations/ratings').expect(401);
  });

  it('GET /api/agent/conversations/ratings returns empty list when no conversations', async () => {
    const token = await getDemoToken();
    const res = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.conversations).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
  });

  it('GET /api/agent/conversations/ratings returns conversation pairs', async () => {
    const token = await getDemoToken();
    seedConversation('demo-1');
    const res = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.conversations).toHaveLength(1);
    const conv = res.body.conversations[0];
    expect(conv).toHaveProperty('id');
    expect(conv).toHaveProperty('userMessage');
    expect(conv).toHaveProperty('assistantMessage');
    expect(conv).toHaveProperty('qualityScore');
    expect(conv.qualityScore).toBeNull();
    expect(conv.assistantMessage).toBe('AI stands for Artificial Intelligence.');
  });

  it('POST /api/agent/conversations/:id/rating requires auth', async () => {
    await request(app).post('/api/agent/conversations/abc/rating').send({ score: 4 }).expect(401);
  });

  it('POST /api/agent/conversations/:id/rating returns 400 for invalid score', async () => {
    const token = await getDemoToken();
    seedConversation('demo-1');
    const listRes = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const id = listRes.body.conversations[0].id as string;

    await request(app)
      .post(`/api/agent/conversations/${id}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 6 })
      .expect(400);

    await request(app)
      .post(`/api/agent/conversations/${id}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 0 })
      .expect(400);

    await request(app)
      .post(`/api/agent/conversations/${id}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 'good' })
      .expect(400);
  });

  it('POST /api/agent/conversations/:id/rating returns 404 for unknown id', async () => {
    const token = await getDemoToken();
    await request(app)
      .post('/api/agent/conversations/nonexistent-id/rating')
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 3 })
      .expect(404);
  });

  it('POST /api/agent/conversations/:id/rating persists score', async () => {
    const token = await getDemoToken();
    seedConversation('demo-1');
    const listRes = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const id = listRes.body.conversations[0].id as string;

    const scoreRes = await request(app)
      .post(`/api/agent/conversations/${id}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 4 })
      .expect(200);
    expect(scoreRes.body.success).toBe(true);
    expect(scoreRes.body.score).toBe(4);

    const afterRes = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterRes.body.conversations[0].qualityScore).toBe(4);
  });

  it('POST /api/agent/conversations/:id/rating allows updating score', async () => {
    const token = await getDemoToken();
    seedConversation('demo-1');
    const listRes = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const id = listRes.body.conversations[0].id as string;

    await request(app)
      .post(`/api/agent/conversations/${id}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 3 })
      .expect(200);

    await request(app)
      .post(`/api/agent/conversations/${id}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 5 })
      .expect(200);

    const afterRes = await request(app)
      .get('/api/agent/conversations/ratings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterRes.body.conversations[0].qualityScore).toBe(5);
  });

  it('GET /api/agent/conversations/ratings supports pagination', async () => {
    const token = await getDemoToken();
    seedConversation('demo-1');
    seedConversation('demo-1');
    seedConversation('demo-1');

    const res = await request(app)
      .get('/api/agent/conversations/ratings?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.conversations).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.totalPages).toBe(2);
  });
});
