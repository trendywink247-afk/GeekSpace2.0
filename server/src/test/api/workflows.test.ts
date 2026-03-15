/**
 * Workflows Route Tests — Phase 22
 * CRUD: list, create, get, patch, delete. Input validation. Cross-user isolation.
 * Workflow execution uses real LLM — only auth and validation paths tested here.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

const VALID_STEPS = [
  { agent: 'weebo', prompt_template: 'Summarise: {{input}}', output_key: 'summary' },
];

describe('Workflows Routes', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
    db.prepare('DELETE FROM user_workflows WHERE user_id = ?').run(userId);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/workflows requires auth', async () => {
    await request(app).get('/api/workflows').expect(401);
  });

  it('POST /api/workflows requires auth', async () => {
    await request(app).post('/api/workflows').send({ name: 'x', steps: VALID_STEPS }).expect(401);
  });

  it('GET /api/workflows/:id requires auth', async () => {
    await request(app).get('/api/workflows/1').expect(401);
  });

  it('PATCH /api/workflows/:id requires auth', async () => {
    await request(app).patch('/api/workflows/1').send({ name: 'y' }).expect(401);
  });

  it('DELETE /api/workflows/:id requires auth', async () => {
    await request(app).delete('/api/workflows/1').expect(401);
  });

  it('POST /api/workflows/:id/run requires auth', async () => {
    await request(app).post('/api/workflows/1/run').expect(401);
  });

  // ── List ─────────────────────────────────────────────────────

  it('GET /api/workflows returns array (seeded templates on first access)', async () => {
    const res = await request(app)
      .get('/api/workflows')
      .set('Authorization', authHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/workflows does not show another user\'s workflows', async () => {
    const other = createTestUser();

    // Create a workflow for other user
    await request(app)
      .post('/api/workflows')
      .set('Authorization', makeAuthHeader(other.id))
      .send({ name: 'Other Workflow', steps: VALID_STEPS })
      .expect(201);

    // Our user should not see other's custom workflows
    const res = await request(app)
      .get('/api/workflows')
      .set('Authorization', authHeader)
      .expect(200);

    const ownedByOther = (res.body as Array<{ userId?: string; user_id?: string }>)
      .filter(w => (w.userId ?? w.user_id) === other.id);
    expect(ownedByOther).toHaveLength(0);
  });

  // ── Create ───────────────────────────────────────────────────

  it('POST /api/workflows creates workflow with valid data', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({
        name: 'My Workflow',
        description: 'A test workflow',
        steps: VALID_STEPS,
        trigger: 'manual',
      })
      .expect(201);

    expect(res.body.name).toBe('My Workflow');
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.trigger).toBe('manual');
  });

  it('POST /api/workflows rejects missing name', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ steps: VALID_STEPS })
      .expect(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('POST /api/workflows rejects empty name', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: '   ', steps: VALID_STEPS })
      .expect(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('POST /api/workflows rejects missing steps', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'No Steps' })
      .expect(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('POST /api/workflows rejects invalid agent in step', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({
        name: 'Bad Agent',
        steps: [{ agent: 'gpt4', prompt_template: 'Hello', output_key: 'out' }],
      })
      .expect(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('POST /api/workflows rejects invalid trigger via Zod schema', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'Workflow', steps: VALID_STEPS, trigger: 'bogus_trigger' })
      .expect(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  // ── Get single ───────────────────────────────────────────────

  it('GET /api/workflows/:id returns workflow', async () => {
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'Get Me', steps: VALID_STEPS })
      .expect(201);

    const id = create.body.id as number;

    const res = await request(app)
      .get(`/api/workflows/${id}`)
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.name).toBe('Get Me');
  });

  it('GET /api/workflows/:id returns 404 for non-existent', async () => {
    await request(app)
      .get('/api/workflows/999999')
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('GET /api/workflows/:id returns 404 for another user\'s workflow', async () => {
    const other = createTestUser();
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', makeAuthHeader(other.id))
      .send({ name: 'Others', steps: VALID_STEPS })
      .expect(201);

    await request(app)
      .get(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('GET /api/workflows/:id rejects non-numeric id', async () => {
    await request(app)
      .get('/api/workflows/not-a-number')
      .set('Authorization', authHeader)
      .expect(400);
  });

  // ── Update ───────────────────────────────────────────────────

  it('PATCH /api/workflows/:id updates name', async () => {
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'Old Name', steps: VALID_STEPS })
      .expect(201);

    const res = await request(app)
      .patch(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'New Name' })
      .expect(200);

    expect(res.body.name).toBe('New Name');
  });

  it('PATCH /api/workflows/:id toggles enabled', async () => {
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'Toggle Me', steps: VALID_STEPS })
      .expect(201);

    const res = await request(app)
      .patch(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .send({ enabled: false })
      .expect(200);

    expect(res.body.enabled).toBe(false);
  });

  it('PATCH /api/workflows/:id returns 400 with no fields', async () => {
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'No Update', steps: VALID_STEPS })
      .expect(201);

    await request(app)
      .patch(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .send({})
      .expect(400);
  });

  it('PATCH /api/workflows/:id returns 404 for another user\'s workflow', async () => {
    const other = createTestUser();
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', makeAuthHeader(other.id))
      .send({ name: 'Mine', steps: VALID_STEPS })
      .expect(201);

    await request(app)
      .patch(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Hijack' })
      .expect(404);
  });

  // ── Delete ───────────────────────────────────────────────────

  it('DELETE /api/workflows/:id deletes workflow', async () => {
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'Delete Me', steps: VALID_STEPS })
      .expect(201);

    await request(app)
      .delete(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .expect(200);

    await request(app)
      .get(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('DELETE /api/workflows/:id returns 404 for non-existent', async () => {
    await request(app)
      .delete('/api/workflows/999999')
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('DELETE /api/workflows/:id returns 404 for another user\'s workflow', async () => {
    const other = createTestUser();
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', makeAuthHeader(other.id))
      .send({ name: 'Yours', steps: VALID_STEPS })
      .expect(201);

    await request(app)
      .delete(`/api/workflows/${create.body.id}`)
      .set('Authorization', authHeader)
      .expect(404);
  });

  // ── Runs list ─────────────────────────────────────────────────

  it('GET /api/workflows/:id/runs returns empty array for new workflow', async () => {
    const create = await request(app)
      .post('/api/workflows')
      .set('Authorization', authHeader)
      .send({ name: 'No Runs Yet', steps: VALID_STEPS })
      .expect(201);

    const res = await request(app)
      .get(`/api/workflows/${create.body.id}/runs`)
      .set('Authorization', authHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
