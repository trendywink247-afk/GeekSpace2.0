// ============================================================
// GAP-1 — Planner API tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

const app = createApp();

describe('Planner API — /api/planner', () => {
  beforeEach(() => {
    resetDatabase();
  });

  // ── Auth guards ─────────────────────────────────────────

  it('GET /:date requires auth', async () => {
    const res = await request(app).get('/api/planner/2026-03-18').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST / requires auth', async () => {
    const res = await request(app)
      .post('/api/planner')
      .send({ title: 'Test', date: '2026-03-18' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('PATCH /:id requires auth', async () => {
    const res = await request(app)
      .patch('/api/planner/some-id')
      .send({ title: 'Updated' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /:id requires auth', async () => {
    const res = await request(app)
      .delete('/api/planner/some-id')
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /week/:date requires auth', async () => {
    const res = await request(app)
      .get('/api/planner/week/2026-03-18')
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  // ── Create block ────────────────────────────────────────

  it('POST / creates a block and returns 201', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({
        title: 'Deep work session',
        date: '2026-03-18',
        duration: 60,
        color: '#8B5CF6',
        category: 'focus',
      })
      .expect(201);

    expect(res.body).toHaveProperty('block');
    expect(res.body.block).toHaveProperty('id');
    expect(res.body.block.title).toBe('Deep work session');
    expect(res.body.block.date).toBe('2026-03-18');
    expect(res.body.block.duration).toBe(60);
    expect(res.body.block.color).toBe('#8B5CF6');
    expect(res.body.block.category).toBe('focus');
    expect(res.body.block.completed).toBe(0);
    expect(res.body.block.user_id).toBe(user.id);

    cleanupTestUser(user.id);
  });

  it('POST / rejects missing title', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ date: '2026-03-18' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
    cleanupTestUser(user.id);
  });

  it('POST / rejects invalid date format', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Test', date: 'March 18' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
    cleanupTestUser(user.id);
  });

  it('POST / uses defaults for optional fields', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Quick task', date: '2026-03-18' })
      .expect(201);

    expect(res.body.block.duration).toBe(30);
    expect(res.body.block.color).toBe('#00F0FF');
    expect(res.body.block.category).toBe('work');
    expect(res.body.block.source).toBe('manual');

    cleanupTestUser(user.id);
  });

  // ── Get blocks by date ──────────────────────────────────

  it('GET /:date returns blocks for that date', async () => {
    const user = createTestUser();

    // Create two blocks
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Morning standup', date: '2026-03-18', sort_order: 0 });
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Code review', date: '2026-03-18', sort_order: 1 });

    // Block on a different date (should not appear)
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Friday meeting', date: '2026-03-22' });

    const res = await request(app)
      .get('/api/planner/2026-03-18')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('blocks');
    expect(Array.isArray(res.body.blocks)).toBe(true);
    expect(res.body.blocks).toHaveLength(2);
    expect(res.body.blocks[0].title).toBe('Morning standup');
    expect(res.body.blocks[1].title).toBe('Code review');

    cleanupTestUser(user.id);
  });

  it('GET /:date returns empty array for date with no blocks', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/planner/2026-01-01')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.blocks).toEqual([]);
    cleanupTestUser(user.id);
  });

  it('GET /:date rejects invalid date format', async () => {
    const user = createTestUser();
    await request(app)
      .get('/api/planner/not-a-date')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(400);

    cleanupTestUser(user.id);
  });

  // ── Update block ────────────────────────────────────────

  it('PATCH /:id updates block fields', async () => {
    const user = createTestUser();

    const create = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Original', date: '2026-03-18' })
      .expect(201);

    const blockId = create.body.block.id;

    const res = await request(app)
      .patch(`/api/planner/${blockId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Updated title', duration: 90, completed: 1 })
      .expect(200);

    expect(res.body.block.title).toBe('Updated title');
    expect(res.body.block.duration).toBe(90);
    expect(res.body.block.completed).toBe(1);

    cleanupTestUser(user.id);
  });

  it('PATCH /:id returns 404 for non-existent block', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/planner/non-existent-id')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Nope' })
      .expect(404);

    cleanupTestUser(user.id);
  });

  it('PATCH /:id marks block as completed', async () => {
    const user = createTestUser();

    const create = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Task to complete', date: '2026-03-18' })
      .expect(201);

    const res = await request(app)
      .patch(`/api/planner/${create.body.block.id}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ completed: 1 })
      .expect(200);

    expect(res.body.block.completed).toBe(1);
    cleanupTestUser(user.id);
  });

  // ── Delete block ────────────────────────────────────────

  it('DELETE /:id deletes the block', async () => {
    const user = createTestUser();

    const create = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'To delete', date: '2026-03-18' })
      .expect(201);

    await request(app)
      .delete(`/api/planner/${create.body.block.id}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    // Verify it's gone
    const res = await request(app)
      .get('/api/planner/2026-03-18')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.blocks).toHaveLength(0);
    cleanupTestUser(user.id);
  });

  it('DELETE /:id returns 404 for non-existent block', async () => {
    const user = createTestUser();
    await request(app)
      .delete('/api/planner/non-existent-id')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);

    cleanupTestUser(user.id);
  });

  // ── User isolation ──────────────────────────────────────

  it('User cannot see another user\'s blocks', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    // User 1 creates a block
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user1.id))
      .send({ title: 'User1 task', date: '2026-03-18' })
      .expect(201);

    // User 2 queries the same date — should see nothing
    const res = await request(app)
      .get('/api/planner/2026-03-18')
      .set('Authorization', makeAuthHeader(user2.id))
      .expect(200);

    expect(res.body.blocks).toHaveLength(0);

    cleanupTestUser(user1.id);
    cleanupTestUser(user2.id);
  });

  it('User cannot update another user\'s block', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    const create = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user1.id))
      .send({ title: 'Private block', date: '2026-03-18' })
      .expect(201);

    await request(app)
      .patch(`/api/planner/${create.body.block.id}`)
      .set('Authorization', makeAuthHeader(user2.id))
      .send({ title: 'Hacked!' })
      .expect(403);

    cleanupTestUser(user1.id);
    cleanupTestUser(user2.id);
  });

  it('User cannot delete another user\'s block', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();

    const create = await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user1.id))
      .send({ title: 'Private block', date: '2026-03-18' })
      .expect(201);

    await request(app)
      .delete(`/api/planner/${create.body.block.id}`)
      .set('Authorization', makeAuthHeader(user2.id))
      .expect(403);

    cleanupTestUser(user1.id);
    cleanupTestUser(user2.id);
  });

  // ── Week endpoint ───────────────────────────────────────

  it('GET /week/:date returns 7 days of blocks', async () => {
    const user = createTestUser();

    // Create blocks on different days in the week
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Monday task', date: '2026-03-16' });
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Wednesday task', date: '2026-03-18' });
    await request(app)
      .post('/api/planner')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ title: 'Sunday task', date: '2026-03-22' });

    const res = await request(app)
      .get('/api/planner/week/2026-03-16')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('blocks');

    // Should have keys for all 7 days
    const dates = Object.keys(res.body.blocks);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-03-16');
    expect(dates[6]).toBe('2026-03-22');

    // Verify blocks are in correct days
    expect(res.body.blocks['2026-03-16']).toHaveLength(1);
    expect(res.body.blocks['2026-03-16'][0].title).toBe('Monday task');
    expect(res.body.blocks['2026-03-17']).toHaveLength(0);
    expect(res.body.blocks['2026-03-18']).toHaveLength(1);
    expect(res.body.blocks['2026-03-22']).toHaveLength(1);

    cleanupTestUser(user.id);
  });

  it('GET /week/:date rejects invalid date', async () => {
    const user = createTestUser();
    await request(app)
      .get('/api/planner/week/bad-date')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(400);

    cleanupTestUser(user.id);
  });
});
