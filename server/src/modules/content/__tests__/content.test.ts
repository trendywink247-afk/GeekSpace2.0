/**
 * Content Module — Integration Tests
 *
 * Tests artifact and template endpoints: auth guards, listing, CRUD basics.
 * Deploy and export endpoints are excluded (require external provider setup).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../../../test/setup.js';

const app = createApp();

describe('Content Module', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  // ==== Artifacts ====

  describe('GET /api/artifacts', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/artifacts')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/artifacts')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 with artifacts list when authenticated', async () => {
      const user = createTestUser();

      const res = await request(app)
        .get('/api/artifacts')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('artifacts');
      expect(Array.isArray(res.body.artifacts)).toBe(true);
    });

    it('should return empty artifacts for a new user', async () => {
      const user = createTestUser();

      const res = await request(app)
        .get('/api/artifacts')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(res.body.artifacts).toHaveLength(0);
    });
  });

  // ==== Templates ====

  describe('GET /api/templates', () => {
    it('should return 200 without authentication (public endpoint)', async () => {
      const res = await request(app)
        .get('/api/templates')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);
    });

    it('should support category query parameter', async () => {
      const res = await request(app)
        .get('/api/templates?category=portfolio')
        .expect(200);

      expect(res.body).toHaveProperty('templates');
      expect(Array.isArray(res.body.templates)).toBe(true);
    });

    it('should support search query parameter', async () => {
      const res = await request(app)
        .get('/api/templates?search=nonexistent-xyz')
        .expect(200);

      expect(res.body.templates).toHaveLength(0);
    });
  });

  describe('GET /api/templates/categories/list', () => {
    it('should return available template categories', async () => {
      const res = await request(app)
        .get('/api/templates/categories/list')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('categories');
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThan(0);

      for (const cat of res.body.categories) {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
      }
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return 404 for a non-existent template', async () => {
      const res = await request(app)
        .get('/api/templates/non-existent-id')
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ==== Artifact CRUD (auth required) ====

  describe('POST /api/artifacts', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/artifacts')
        .send({ title: 'Test', html: '<p>Hi</p>' })
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should create an artifact when authenticated', async () => {
      const user = createTestUser();

      const res = await request(app)
        .post('/api/artifacts')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ title: 'Test Artifact', html: '<p>Hello</p>', css: 'p { color: red; }', js: '' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title', 'Test Artifact');
      expect(res.body).toHaveProperty('previewUrl');

      // Verify it appears in the list
      const listRes = await request(app)
        .get('/api/artifacts')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(listRes.body.artifacts).toHaveLength(1);
      expect(listRes.body.artifacts[0].id).toBe(res.body.id);
    });
  });

  describe('DELETE /api/artifacts/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete('/api/artifacts/some-id')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for a non-existent artifact', async () => {
      const user = createTestUser();

      const res = await request(app)
        .delete('/api/artifacts/non-existent-id')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ==== Template cloning (auth required) ====

  describe('POST /api/templates/:id/clone', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/templates/some-id/clone')
        .send({})
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 when cloning a non-existent template', async () => {
      const user = createTestUser();

      const res = await request(app)
        .post('/api/templates/non-existent-id/clone')
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });
  });
});
