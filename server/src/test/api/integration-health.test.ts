// ============================================================
// 25.4 — Integration health endpoint + portfolio sanitization
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// Helper: seed a portfolio row for a test user
function createTestPortfolio(userId: string): void {
  // Only insert if it doesn't already exist
  const existing = db.prepare('SELECT user_id FROM portfolios WHERE user_id = ?').get(userId);
  if (existing) return;

  db.prepare(`
    INSERT INTO portfolios (user_id, username, headline, about, avatar, location, role, company, skills, projects, milestones, social, layout, agent_enabled, visibility)
    VALUES (?, ?, ?, ?, '', '', '', '', '[]', '[]', '[]', '{}', 'default', 0, '{}')
  `).run(userId, `testuser_${userId.slice(0, 8)}_${Date.now()}`, '', '');
}

// Helper: seed default integrations for a test user
function seedTestIntegrations(userId: string): void {
  for (const [type, name] of [
    ['telegram', 'Telegram'],
    ['whatsapp', 'WhatsApp'],
    ['email', 'Email'],
  ]) {
    db.prepare(`
      INSERT OR IGNORE INTO integrations (id, user_id, type, name, description, status, health, requests_today, last_sync, features, permissions)
      VALUES (?, ?, ?, ?, '', 'disconnected', 0, 0, '', '[]', '[]')
    `).run(uuid(), userId, type, name);
  }
}

// ── Integration Health ────────────────────────────────────────────────────────

describe('Integration Health — POST /api/integrations/:type/test', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('should return 401 without auth — telegram', async () => {
    const res = await request(app)
      .post('/api/integrations/telegram/test')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 without auth — whatsapp', async () => {
    const res = await request(app)
      .post('/api/integrations/whatsapp/test')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });

  it('should return { healthy: boolean } for authenticated user — telegram (not connected)', async () => {
    const user = createTestUser();
    seedTestIntegrations(user.id);

    const res = await request(app)
      .post('/api/integrations/telegram/test')
      .set('Authorization', makeAuthHeader(user.id))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('healthy');
    expect(typeof res.body.healthy).toBe('boolean');
    // Not connected → not healthy
    expect(res.body.healthy).toBe(false);
    expect(res.body).toHaveProperty('reason', 'not_connected');

    cleanupTestUser(user.id);
  });

  it('should return { healthy: boolean } for authenticated user — whatsapp (not connected)', async () => {
    const user = createTestUser();
    seedTestIntegrations(user.id);

    const res = await request(app)
      .post('/api/integrations/whatsapp/test')
      .set('Authorization', makeAuthHeader(user.id))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('healthy');
    expect(typeof res.body.healthy).toBe('boolean');
    expect(res.body.healthy).toBe(false);
    expect(res.body).toHaveProperty('reason', 'not_connected');

    cleanupTestUser(user.id);
  });

  it('should return healthy: false when integration connected but not linked (telegram)', async () => {
    const user = createTestUser();
    seedTestIntegrations(user.id);

    // Mark telegram integration as connected
    db.prepare(
      "UPDATE integrations SET status = 'connected' WHERE user_id = ? AND type = 'telegram'"
    ).run(user.id);

    const res = await request(app)
      .post('/api/integrations/telegram/test')
      .set('Authorization', makeAuthHeader(user.id))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('healthy');
    expect(typeof res.body.healthy).toBe('boolean');
    // Telegram bot token is not configured in test env, so it will be not healthy
    expect(res.body.healthy).toBe(false);
    expect(res.body).toHaveProperty('reason');

    cleanupTestUser(user.id);
  });

  it('should return { healthy: false } for whatsapp when connected but not linked', async () => {
    const user = createTestUser();
    seedTestIntegrations(user.id);

    // Mark whatsapp integration as connected
    db.prepare(
      "UPDATE integrations SET status = 'connected' WHERE user_id = ? AND type = 'whatsapp'"
    ).run(user.id);

    const res = await request(app)
      .post('/api/integrations/whatsapp/test')
      .set('Authorization', makeAuthHeader(user.id))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('healthy');
    expect(typeof res.body.healthy).toBe('boolean');
    expect(res.body.healthy).toBe(false);
    expect(res.body).toHaveProperty('reason', 'not_linked');

    cleanupTestUser(user.id);
  });

  it('should include type in response when integration is connected', async () => {
    const user = createTestUser();
    seedTestIntegrations(user.id);

    // Mark whatsapp connected (easier to test — just checks channel_links)
    db.prepare(
      "UPDATE integrations SET status = 'connected' WHERE user_id = ? AND type = 'whatsapp'"
    ).run(user.id);

    const res = await request(app)
      .post('/api/integrations/whatsapp/test')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    // type is only in response when integration is connected
    expect(res.body).toHaveProperty('type', 'whatsapp');

    cleanupTestUser(user.id);
  });
});

// ── Portfolio Sanitization ────────────────────────────────────────────────────

describe('Portfolio Sanitization — PATCH /api/portfolio/me', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .patch('/api/portfolio/me')
      .send({ headline: 'Test' })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });

  it('should strip HTML tags from headline', async () => {
    const user = createTestUser();
    createTestPortfolio(user.id);

    const res = await request(app)
      .patch('/api/portfolio/me')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ headline: '<script>alert(1)</script>My Headline' })
      .expect('Content-Type', /json/)
      .expect(200);

    // Tags should be stripped — the stored value should NOT contain angle brackets
    const headline: string = res.body.headline ?? '';
    expect(headline).not.toContain('<script>');
    expect(headline).not.toContain('</script>');
    // Should still contain the plain text content
    expect(headline).toContain('My Headline');

    cleanupTestUser(user.id);
  });

  it('should strip HTML tags from about field', async () => {
    const user = createTestUser();
    createTestPortfolio(user.id);

    const res = await request(app)
      .patch('/api/portfolio/me')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ about: '<b>Bold</b> text with <img src=x onerror=alert(1)> injected' })
      .expect('Content-Type', /json/)
      .expect(200);

    const about: string = res.body.about ?? '';
    expect(about).not.toContain('<b>');
    expect(about).not.toContain('<img');
    expect(about).toContain('Bold');
    expect(about).toContain('text with');

    cleanupTestUser(user.id);
  });

  it('should strip HTML tags from location field', async () => {
    const user = createTestUser();
    createTestPortfolio(user.id);

    const testId = uuid();
    const res = await request(app)
      .patch('/api/portfolio/me')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ location: `<em>San Francisco</em> ${testId}` })
      .expect('Content-Type', /json/)
      .expect(200);

    const location: string = res.body.location ?? '';
    expect(location).not.toContain('<em>');
    expect(location).toContain('San Francisco');

    cleanupTestUser(user.id);
  });
});
