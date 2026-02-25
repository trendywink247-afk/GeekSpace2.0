import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';

// Create the real app (same as production)
const app = createApp();

describe('Connection Invite Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('POST /api/integrations/invite', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/integrations/invite')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return inviteUrl, token, and expiresAt for authenticated user', async () => {
      const user = createTestUser();

      const response = await request(app)
        .post('/api/integrations/invite')
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('inviteUrl');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresAt');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
      expect(typeof response.body.expiresAt).toBe('number');
      expect(response.body.expiresAt).toBeGreaterThan(Date.now());

      cleanupTestUser(user.id);
    });

    it('should accept optional email in body', async () => {
      const user = createTestUser();

      const response = await request(app)
        .post('/api/integrations/invite')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ email: 'friend@example.com' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('inviteUrl');
      expect(response.body).toHaveProperty('token');

      cleanupTestUser(user.id);
    });
  });

  describe('GET /api/integrations/invites', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/integrations/invites')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return array of invites for authenticated user', async () => {
      const user = createTestUser();

      // Create an invite first
      await request(app)
        .post('/api/integrations/invite')
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect(200);

      const response = await request(app)
        .get('/api/integrations/invites')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      const invite = response.body[0];
      expect(invite).toHaveProperty('token');
      expect(invite).toHaveProperty('inviteUrl');
      expect(invite).toHaveProperty('expired');
      expect(invite).toHaveProperty('used');
      expect(invite.expired).toBe(false);
      expect(invite.used).toBe(false);

      cleanupTestUser(user.id);
    });

    it('should return empty array when user has no invites', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/integrations/invites')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);

      cleanupTestUser(user.id);
    });
  });

  // ── Phase 29.1: Invite Accept Flow ────────────────────────────────────────

  describe('GET /api/integrations/invite/:token/info', () => {
    it('should return 404 for unknown token', async () => {
      const response = await request(app)
        .get('/api/integrations/invite/nonexistent-token/info')
        .expect('Content-Type', /json/)
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return invite info for valid token (no auth required)', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/integrations/invite')
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect(200);

      const { token } = createRes.body as { token: string };

      const infoRes = await request(app)
        .get(`/api/integrations/invite/${token}/info`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(infoRes.body).toHaveProperty('token', token);
      expect(infoRes.body).toHaveProperty('ownerName');
      expect(infoRes.body).toHaveProperty('ownerUsername');
      expect(infoRes.body).toHaveProperty('expiresAt');

      cleanupTestUser(user.id);
    });
  });

  describe('POST /api/integrations/invite/:token/accept', () => {
    it('should return 404 for unknown token', async () => {
      const response = await request(app)
        .post('/api/integrations/invite/nonexistent-token/accept')
        .send({})
        .expect('Content-Type', /json/)
        .expect(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept a valid invite and mark it as used', async () => {
      const user = createTestUser();

      const createRes = await request(app)
        .post('/api/integrations/invite')
        .set('Authorization', makeAuthHeader(user.id))
        .send({})
        .expect(200);

      const { token } = createRes.body as { token: string };

      const acceptRes = await request(app)
        .post(`/api/integrations/invite/${token}/accept`)
        .send({ acceptorName: 'Test Acceptor', acceptorEmail: 'acceptor@test.com' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(acceptRes.body).toHaveProperty('success', true);

      // Second accept should return 409 (already used)
      await request(app)
        .post(`/api/integrations/invite/${token}/accept`)
        .send({})
        .expect(409);

      cleanupTestUser(user.id);
    });
  });
});
