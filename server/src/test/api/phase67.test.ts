import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createTestUser, generateTestToken } from '../setup';
import { v4 as uuid } from 'uuid';
import { db } from '../../db/index';

const app = createApp();

describe('Phase 67 — Suggestion Intelligence + Suggest & Earn', () => {
  beforeEach(() => { resetDatabase(); });

  // ── 67.2: User suggestion CRUD ────────────────────────────────────────────
  describe('POST /api/suggestions — create', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/suggestions').send({ title: 'Test', body: 'A'.repeat(20) });
      expect(res.status).toBe(401);
    });

    it('creates a suggestion and returns 201', async () => {
      const user = createTestUser(`phase67-create-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Dark Mode Calendar', body: 'A dark mode for the calendar view would be useful.', tags: ['calendar', 'ui'] });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.title).toBe('Dark Mode Calendar');
      expect(res.body.status).toBe('new');
    });

    it('returns 400 if title is missing', async () => {
      const user = createTestUser(`phase67-val-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'A'.repeat(20) });
      expect(res.status).toBe(400);
    });

    it('returns 400 if body is too short (< 20 chars)', async () => {
      const user = createTestUser(`phase67-short-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Short body', body: 'too short' });
      expect(res.status).toBe(400);
    });

    it('includes duplicate_warning when similar title exists', async () => {
      const user = createTestUser(`phase67-dup-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      // First suggestion
      await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Better Calendar', body: 'Improve the calendar view for better usability.' });
      // Second with same title
      const res = await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Better Calendar', body: 'Another description for the same calendar feature.' });
      expect(res.status).toBe(201);
      expect(res.body.duplicate_warning).toBe(true);
    });
  });

  describe('GET /api/suggestions/mine', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/suggestions/mine');
      expect(res.status).toBe(401);
    });

    it('returns only own suggestions', async () => {
      const user1 = createTestUser(`phase67-mine1-${Date.now()}@example.com`);
      const user2 = createTestUser(`phase67-mine2-${Date.now()}@example.com`);
      const token1 = generateTestToken(user1.id);
      const token2 = generateTestToken(user2.id);
      // User 2 creates a suggestion
      await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'User2 Feature', body: 'This is user2s feature request description.' });
      // User 1 lists — should not see user2's suggestion
      const res = await request(app)
        .get('/api/suggestions/mine')
        .set('Authorization', `Bearer ${token1}`);
      expect(res.status).toBe(200);
      // Route returns { suggestions: [...] }
      expect(res.body).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.suggestions).toHaveLength(0);
    });
  });

  describe('GET /api/suggestions/:id — multi-user isolation', () => {
    it('returns 404 when accessing another user\'s suggestion', async () => {
      const user1 = createTestUser(`phase67-iso1-${Date.now()}@example.com`);
      const user2 = createTestUser(`phase67-iso2-${Date.now()}@example.com`);
      const token1 = generateTestToken(user1.id);
      const token2 = generateTestToken(user2.id);
      // User1 creates suggestion
      const createRes = await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token1}`)
        .send({ title: 'Private Idea', body: 'This is a private suggestion from user1.' });
      expect(createRes.status).toBe(201);
      const suggId = createRes.body.id;
      // User2 cannot access it
      const res = await request(app)
        .get(`/api/suggestions/${suggId}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(404);
    });

    it('returns own suggestion', async () => {
      const user = createTestUser(`phase67-own-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const createRes = await request(app)
        .post('/api/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Feature', body: 'This feature would be great for productivity.' });
      const suggId = createRes.body.id;
      const res = await request(app)
        .get(`/api/suggestions/${suggId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('My Feature');
    });
  });

  // ── 67.4: Rewards engine idempotency (via direct service calls) ───────────
  describe('Reward idempotency — DB-level double-award prevention', () => {
    it('only creates one reward row for the same unique_key', async () => {
      const { issueReward } = await import('../../services/rewards.js');
      const user = createTestUser(`phase67-idem-${Date.now()}@example.com`);
      const suggId = uuid();
      // Issue same event twice
      const r1 = issueReward({ userId: user.id, suggestionId: suggId, eventType: 'ACCEPTED_EXPERIMENT' });
      const r2 = issueReward({ userId: user.id, suggestionId: suggId, eventType: 'ACCEPTED_EXPERIMENT' });
      expect(r1.issued).toBe(true);
      expect(r2.issued).toBe(false);
      // DB level: exactly one row
      const rewardRows = db.prepare(
        `SELECT COUNT(*) as cnt FROM suggestion_rewards WHERE suggestion_id = ? AND event_type = 'ACCEPTED_EXPERIMENT'`
      ).get(suggId) as { cnt: number };
      expect(rewardRows.cnt).toBe(1);
    });
  });

  // ── 67.4: Direct rewards engine test ──────────────────────────────────────
  describe('Rewards engine — direct unit tests', () => {
    it('issueReward returns issued=true on first call', async () => {
      const { issueReward } = await import('../../services/rewards.js');
      const user = createTestUser(`phase67-rew-${Date.now()}@example.com`);
      const suggId = uuid();
      const result = issueReward({ userId: user.id, suggestionId: suggId, eventType: 'ACCEPTED_EXPERIMENT' });
      expect(result.issued).toBe(true);
      expect(result.credits).toBe(10);
    });

    it('issueReward returns issued=false on duplicate call (idempotent)', async () => {
      const { issueReward } = await import('../../services/rewards.js');
      const user = createTestUser(`phase67-rew2-${Date.now()}@example.com`);
      const suggId = uuid();
      issueReward({ userId: user.id, suggestionId: suggId, eventType: 'SHIPPED_MAIN' });
      const result2 = issueReward({ userId: user.id, suggestionId: suggId, eventType: 'SHIPPED_MAIN' });
      expect(result2.issued).toBe(false);
      expect(result2.credits).toBe(0);
    });

    it('credits USER.credits only once for same event', async () => {
      const { issueReward } = await import('../../services/rewards.js');
      const user = createTestUser(`phase67-cred-${Date.now()}@example.com`);
      const beforeCredits = (db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id) as { credits: number }).credits;
      const suggId = uuid();
      issueReward({ userId: user.id, suggestionId: suggId, eventType: 'SHIPPED_PROD' });
      issueReward({ userId: user.id, suggestionId: suggId, eventType: 'SHIPPED_PROD' }); // duplicate
      const afterCredits = (db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id) as { credits: number }).credits;
      // Should only add 100 once (not 200)
      expect(afterCredits - beforeCredits).toBe(100);
    });
  });

  // ── 67.4: Triage worker in TEST_MODE ──────────────────────────────────────
  describe('Triage worker — TEST_MODE deterministic scores', () => {
    it('returns deterministic scores for new suggestions', async () => {
      const { triageSuggestions } = await import('../../services/suggestions-triage.js');
      const user = createTestUser(`phase67-triage-${Date.now()}@example.com`);
      const suggId = uuid();
      db.prepare(`INSERT INTO suggestions (id, user_id, title, body, status) VALUES (?, ?, ?, ?, 'new')`).run(
        suggId, user.id, 'Triage Test Feature', 'This is a test for the triage system in test mode.'
      );
      const results = await triageSuggestions([suggId]);
      expect(results).toHaveLength(1);
      expect(results[0].demandScore).toBe(7);
      expect(results[0].overallScore).toBe(7);
      expect(results[0].rationale).toContain('Test stub');
    });

    it('returns empty array for no suggestions', async () => {
      const { triageSuggestions } = await import('../../services/suggestions-triage.js');
      const results = await triageSuggestions([]);
      expect(results).toHaveLength(0);
    });
  });

  // ── 67.2: GET /api/suggestions/clusters ───────────────────────────────────
  describe('GET /api/suggestions/clusters', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/suggestions/clusters');
      expect(res.status).toBe(401);
    });

    it('returns clusters array', async () => {
      const user = createTestUser(`phase67-clust-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/suggestions/clusters')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clusters');
      expect(Array.isArray(res.body.clusters)).toBe(true);
    });
  });

  // ── 67.2: GET /api/suggestions/rewards/mine ───────────────────────────────
  describe('GET /api/suggestions/rewards/mine', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/suggestions/rewards/mine');
      expect(res.status).toBe(401);
    });

    it('returns user reward ledger', async () => {
      const user = createTestUser(`phase67-ledger-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      // Issue a reward directly
      const { issueReward } = await import('../../services/rewards.js');
      issueReward({ userId: user.id, suggestionId: uuid(), eventType: 'ACCEPTED_EXPERIMENT' });
      const res = await request(app)
        .get('/api/suggestions/rewards/mine')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      // Route returns { rewards: [...] }
      expect(res.body).toHaveProperty('rewards');
      expect(Array.isArray(res.body.rewards)).toBe(true);
      expect(res.body.rewards[0]).toHaveProperty('eventType');
      expect(res.body.rewards[0].credits).toBe(10);
    });
  });
});
