// Suggestions route tests — Phase 27
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Suggestions API', () => {
  let authHeader: string;
  let authHeader2: string;

  beforeEach(() => {
    resetDatabase();
    const u1 = createTestUser();
    const u2 = createTestUser();
    authHeader = makeAuthHeader(u1.id);
    authHeader2 = makeAuthHeader(u2.id);
  });

  const validBody = {
    title: 'Add dark mode',
    body: 'Please add a dark mode toggle for better readability at night on all screens.',
  };

  // ── Auth guards ──────────────────────────────────────────────

  it('POST /api/suggestions requires auth', async () => {
    const res = await request(app).post('/api/suggestions').send(validBody);
    expect(res.status).toBe(401);
  });

  it('GET /api/suggestions/mine requires auth', async () => {
    const res = await request(app).get('/api/suggestions/mine');
    expect(res.status).toBe(401);
  });

  it('GET /api/suggestions/clusters requires auth', async () => {
    const res = await request(app).get('/api/suggestions/clusters');
    expect(res.status).toBe(401);
  });

  // ── Validation ───────────────────────────────────────────────

  it('POST /api/suggestions rejects missing title', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send({ body: validBody.body });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('POST /api/suggestions rejects body under 20 chars', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send({ title: 'My suggestion', body: 'too short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body/i);
  });

  it('POST /api/suggestions rejects title over 100 chars', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send({ title: 'A'.repeat(101), body: validBody.body });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('POST /api/suggestions rejects tags that is not an array', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send({ ...validBody, tags: 'not-array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tags/i);
  });

  // ── Create + List ────────────────────────────────────────────

  it('POST /api/suggestions creates a suggestion', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(Array.isArray(res.body.tags)).toBe(true);
  });

  it('POST /api/suggestions persists tags', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send({ ...validBody, tags: ['ui', 'accessibility'] });
    expect(res.status).toBe(201);
    expect(res.body.tags).toContain('ui');
  });

  it('GET /api/suggestions/mine lists own suggestions', async () => {
    await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);

    const res = await request(app)
      .get('/api/suggestions/mine')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBe(1);
    expect(res.body).toHaveProperty('total');
  });

  it('GET /api/suggestions/mine is isolated per user', async () => {
    await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);

    const res = await request(app)
      .get('/api/suggestions/mine')
      .set('Authorization', authHeader2);
    expect(res.status).toBe(200);
    expect(res.body.suggestions.length).toBe(0);
  });

  // ── Get by ID ────────────────────────────────────────────────

  it('GET /api/suggestions/:id returns own suggestion', async () => {
    const create = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    const id = create.body.id as string;

    const res = await request(app)
      .get(`/api/suggestions/${id}`)
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it("GET /api/suggestions/:id returns 404 for another user's suggestion", async () => {
    const create = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    const id = create.body.id as string;

    const res = await request(app)
      .get(`/api/suggestions/${id}`)
      .set('Authorization', authHeader2);
    expect(res.status).toBe(404);
  });

  // ── Voting ───────────────────────────────────────────────────

  it('POST /api/suggestions/:id/vote records upvote', async () => {
    const create = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    const id = create.body.id as string;

    const res = await request(app)
      .post(`/api/suggestions/${id}/vote`)
      .set('Authorization', authHeader2)
      .send({ vote: 1 });
    expect(res.status).toBe(200);
    expect(res.body.upvotes).toBe(1);
    expect(res.body.downvotes).toBe(0);
  });

  it('POST /api/suggestions/:id/vote rejects invalid vote value', async () => {
    const create = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    const id = create.body.id as string;

    const res = await request(app)
      .post(`/api/suggestions/${id}/vote`)
      .set('Authorization', authHeader2)
      .send({ vote: 5 });
    expect(res.status).toBe(400);
  });

  it('POST /api/suggestions/:id/vote returns 404 for non-existent suggestion', async () => {
    const res = await request(app)
      .post('/api/suggestions/nonexistent-id/vote')
      .set('Authorization', authHeader)
      .send({ vote: 1 });
    expect(res.status).toBe(404);
  });

  // ── Delete ───────────────────────────────────────────────────

  it('DELETE /api/suggestions/:id soft-deletes own suggestion', async () => {
    const create = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    const id = create.body.id as string;

    const del = await request(app)
      .delete(`/api/suggestions/${id}`)
      .set('Authorization', authHeader);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/api/suggestions/${id}`)
      .set('Authorization', authHeader);
    expect(get.status).toBe(404);
  });

  it("DELETE /api/suggestions/:id returns 404 for another user's suggestion", async () => {
    const create = await request(app)
      .post('/api/suggestions')
      .set('Authorization', authHeader)
      .send(validBody);
    const id = create.body.id as string;

    const res = await request(app)
      .delete(`/api/suggestions/${id}`)
      .set('Authorization', authHeader2);
    expect(res.status).toBe(404);
  });

  // ── Clusters ─────────────────────────────────────────────────

  it('GET /api/suggestions/clusters returns clusters array', async () => {
    const res = await request(app)
      .get('/api/suggestions/clusters')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clusters');
    expect(Array.isArray(res.body.clusters)).toBe(true);
  });
});
