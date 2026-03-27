import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import {
  resetDatabase,
  createTestUser,
  generateTestToken,
  makeAuthHeader,
} from '../../../test/setup.js';

const app = createApp();

describe('Users Module', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  // -- GET /api/users/me --------------------------------------------------

  describe('GET /api/users/me', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
    });

    it('should return user data with valid auth token', async () => {
      const user = createTestUser();
      const token = generateTestToken(user.id);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        email: user.email,
        username: user.username,
        name: 'Test User',
        plan: 'premium',
      });
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('theme');
      expect(res.body).toHaveProperty('notifications');
      expect(res.body).toHaveProperty('privacy');
      expect(res.body).toHaveProperty('credits');
    });

    it('should return user data using makeAuthHeader helper', async () => {
      const user = createTestUser();

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', makeAuthHeader(user.id));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.id);
    });
  });

  // -- PATCH /api/users/me ------------------------------------------------

  describe('PATCH /api/users/me', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ name: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('should update user profile fields', async () => {
      const user = createTestUser();
      const token = generateTestToken(user.id);

      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', bio: 'A short bio' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.bio).toBe('A short bio');
    });
  });

  // -- GET /api/users/:username/public ------------------------------------

  describe('GET /api/users/:username/public', () => {
    it('should return public profile for an existing user', async () => {
      const user = createTestUser();

      const res = await request(app)
        .get(`/api/users/${user.username}/public`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        username: user.username,
        name: 'Test User',
        plan: 'premium',
      });
      expect(res.body).toHaveProperty('createdAt');
      // Public profile should not expose email
      expect(res.body).not.toHaveProperty('email');
    });

    it('should return 404 for non-existent username', async () => {
      const res = await request(app)
        .get('/api/users/nonexistent_user_12345/public');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});
