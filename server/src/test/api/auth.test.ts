import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from '../../routes/auth.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { config } from '../../config.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createTestUser, cleanupTestUser, generateTestToken, resetDatabase } from '../setup.js';

// Create minimal app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = createTestUser('login-test@example.com');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(user.email);

      cleanupTestUser(user.id);
    });

    it('should reject invalid credentials', async () => {
      const user = createTestUser('login-fail@example.com');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'wrongpassword',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/signup', () => {
    it('should create new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          username: 'newuser123',
        })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.username).toBe('newuser123');

      // Cleanup
      if (response.body.user.id) {
        cleanupTestUser(response.body.user.id);
      }
    });

    it('should reject duplicate email', async () => {
      const user = createTestUser('duplicate@example.com');

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: user.email,
          password: 'password123',
          username: 'different123',
        })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'password123',
          username: 'testuser',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
