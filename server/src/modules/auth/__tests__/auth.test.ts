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

describe('Auth Module', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  // ── POST /api/auth/signup ────────────────────────────────────────

  describe('POST /api/auth/signup', () => {
    it('should create a new user and return 200 with token', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'securePass123',
          username: 'newuser',
          name: 'New User',
        });

      // The signup endpoint uses res.json() without explicit 200/201,
      // so Express defaults to 200
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toMatchObject({
        email: 'newuser@example.com',
        username: 'newuser',
        name: 'New User',
        plan: 'free',
      });
      expect(res.body.user.id).toBeDefined();
    });

    it('should reject duplicate email or username with 409', async () => {
      const existing = createTestUser();

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: existing.email,
          password: 'anotherPass123',
          username: 'uniqueuser',
          name: 'Duplicate',
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid payload with 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'short',
          username: '',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── POST /api/auth/login ─────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return token', async () => {
      const user = createTestUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.id).toBe(user.id);
    });

    it('should return 401 for wrong password', async () => {
      const user = createTestUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'wrong-password-999',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'does-not-matter1',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid credentials/i);
    });
  });

  // ── GET /api/auth/me ─────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return user info with a valid token', async () => {
      const user = createTestUser();
      const token = generateTestToken(user.id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        email: user.email,
        username: user.username,
      });
      expect(res.body).toHaveProperty('plan');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
    });
  });
});
