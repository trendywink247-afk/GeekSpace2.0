import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetDatabase, createTestUser, generateTestToken } from '../../../test/setup.js';

const app = createApp();

describe('Media Module', () => {
  beforeAll(() => resetDatabase());

  // ---- GET /api/images (requires auth) ----
  describe('GET /api/images', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/images')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 with valid auth', async () => {
      const user = createTestUser({ prefix: 'media-img' });
      const token = generateTestToken(user.id);

      const res = await request(app)
        .get('/api/images')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('images');
      expect(Array.isArray(res.body.images)).toBe(true);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('max');
    });
  });

  // ---- GET /api/videos (requires auth) ----
  describe('GET /api/videos', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/videos')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 200 with valid auth', async () => {
      const user = createTestUser({ prefix: 'media-vid' });
      const token = generateTestToken(user.id);

      const res = await request(app)
        .get('/api/videos')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('videos');
      expect(Array.isArray(res.body.videos)).toBe(true);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('max');
    });
  });

  // ---- POST /api/voice/transcribe (requires auth) ----
  describe('POST /api/voice/transcribe', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/voice/transcribe')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ---- POST /api/voice/speak (requires auth) ----
  describe('POST /api/voice/speak', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/voice/speak')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });
});
