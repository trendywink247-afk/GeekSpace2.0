import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';

const app = createApp();

describe('Agent Config Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  // ---- GET /api/agent/config ----

  describe('GET /api/agent/config', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/agent/config')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return agent config for authenticated user', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('user_id', user.id);
      expect(response.body).toHaveProperty('name');

      cleanupTestUser(user.id);
    });
  });

  // ---- PATCH /api/agent/config ----

  describe('PATCH /api/agent/config', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/agent/config')
        .send({ personality: 'weebo' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should update personality', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ personality: 'weebo' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('personality', 'weebo');

      // Verify persisted in DB
      const config = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(user.id) as { personality: string } | undefined;
      expect(config?.personality).toBe('weebo');

      cleanupTestUser(user.id);
    });

    it('should update model_preference', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model_preference: 'cloud' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('model_preference', 'cloud');

      // Verify persisted in DB
      const config = db.prepare('SELECT model_preference FROM agent_configs WHERE user_id = ?').get(user.id) as { model_preference: string } | undefined;
      expect(config?.model_preference).toBe('cloud');

      cleanupTestUser(user.id);
    });

    it('should update multiple fields at once', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ personality: 'edith', voice: 'professional', creativity: 0.8 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('personality', 'edith');
      expect(response.body).toHaveProperty('voice', 'professional');
      expect(response.body).toHaveProperty('creativity', 0.8);

      cleanupTestUser(user.id);
    });

    it('should reject unknown fields (strict schema)', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ unknownField: 'value' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should not allow patching another user config', async () => {
      const user1 = createTestUser();
      const user2 = createTestUser();

      // user2 updates their own config
      await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user2.id))
        .send({ personality: 'weebo' })
        .expect(200);

      // user1's config should be unchanged
      const config1 = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(user1.id) as { personality: string | null } | undefined;
      expect(config1?.personality).not.toBe('weebo');

      cleanupTestUser(user1.id);
      cleanupTestUser(user2.id);
    });
  });
});

describe('Agent Config Validation — 23.2', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('PATCH /api/agent/config — invalid personality', () => {
    it('should return 400 for invalid personality value', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ personality: 'hacker' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should return 400 for empty string personality', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ personality: '' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should accept valid personality values: jarvis, edith, weebo', async () => {
      for (const personality of ['jarvis', 'edith', 'weebo']) {
        const user = createTestUser(`val-${personality}-${Date.now()}@example.com`);

        await request(app)
          .patch('/api/agent/config')
          .set('Authorization', makeAuthHeader(user.id))
          .send({ personality })
          .expect(200);

        cleanupTestUser(user.id);
      }
    });
  });

  describe('PATCH /api/agent/config — invalid model_preference', () => {
    it('should return 400 for invalid model_preference value', async () => {
      const user = createTestUser();

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model_preference: 'turbo' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should accept valid model_preference values: auto, local, cloud, premium', async () => {
      for (const pref of ['auto', 'local', 'cloud', 'premium']) {
        const user = createTestUser(`pref-${pref}-${Date.now()}@example.com`);

        await request(app)
          .patch('/api/agent/config')
          .set('Authorization', makeAuthHeader(user.id))
          .send({ model_preference: pref })
          .expect(200);

        cleanupTestUser(user.id);
      }
    });
  });

  describe('PATCH /api/agent/config — systemPrompt length', () => {
    it('should return 400 for systemPrompt longer than 2000 chars', async () => {
      const user = createTestUser();
      const longPrompt = 'a'.repeat(2001);

      const response = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ systemPrompt: longPrompt })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });

    it('should accept systemPrompt of exactly 2000 chars', async () => {
      const user = createTestUser();
      const exactPrompt = 'b'.repeat(2000);

      await request(app)
        .patch('/api/agent/config')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ systemPrompt: exactPrompt })
        .expect(200);

      cleanupTestUser(user.id);
    });
  });
});
