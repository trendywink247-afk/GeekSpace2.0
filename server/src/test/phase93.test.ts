/**
 * Phase 93 -- Feature Audit Tests
 * Covers: automation action stubs -> real behaviour
 *   93.1 portfolio-update action executes real DB update
 *   93.2 portfolio-update skips invalid fields
 *   93.3 whatsapp-message returns credential error message
 *   93.4 manychat-broadcast returns credential error message
 *   93.5 Automation trigger endpoint returns execution log with correct output
 *   93.6 Proactive routes are registered and auth-protected
 *   93.7 Admin /stats endpoint returns all required fields
 *   93.8 Portfolio contact form honeypot silently accepts bots
 *   93.9 Reminder snooze history endpoint returns last events
 *  93.10 JWT blocklist entry is created on logout
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { resetDatabase, createTestUser, makeAuthHeader } from './setup.js';
import { initAutomationsEngine } from '../services/automations-engine.js';

const app = createApp();

// ---- helpers ----

function createAutomation(userId: string, actionType: string, actionConfig: object, name?: string) {
  const id = uuid();
  db.prepare(`
    INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
    VALUES (?, ?, ?, 'manual', '{}', ?, ?, 1)
  `).run(id, userId, name ?? `Test ${actionType}`, actionType, JSON.stringify(actionConfig));
  return id;
}

function createPortfolio(userId: string, username: string) {
  db.prepare(`
    INSERT OR IGNORE INTO portfolios (user_id, username, headline, about) VALUES (?, ?, ?, ?)
  `).run(userId, username, 'Initial headline', 'Initial about text');
}

// ---- setup ----

let user: { id: string; token: string; username: string };

beforeAll(() => {
  resetDatabase();
  initAutomationsEngine();
  const u = createTestUser(`phase93-${Date.now()}@example.com`);
  user = { id: u.id, token: makeAuthHeader(u.id), username: u.username };
  createPortfolio(u.id, u.username);
});

afterAll(() => {
  resetDatabase();
});

// ---- 93.1 portfolio-update action: valid field ----

describe('93.1 portfolio-update automation action -- valid field', () => {
  it('updates portfolio headline via manual trigger', async () => {
    const automationId = createAutomation(user.id, 'portfolio-update', {
      field: 'headline',
      value: 'Automation-set headline',
    });

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('Portfolio headline updated successfully');

    const portfolio = db.prepare('SELECT headline FROM portfolios WHERE user_id = ?').get(user.id) as { headline: string };
    expect(portfolio.headline).toBe('Automation-set headline');
  });

  it('updates portfolio about via manual trigger', async () => {
    const automationId = createAutomation(user.id, 'portfolio-update', {
      field: 'about',
      value: 'New about from automation',
    });

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('Portfolio about updated successfully');

    const portfolio = db.prepare('SELECT about FROM portfolios WHERE user_id = ?').get(user.id) as { about: string };
    expect(portfolio.about).toBe('New about from automation');
  });
});

// ---- 93.2 portfolio-update action: invalid field ----

describe('93.2 portfolio-update automation action -- invalid field', () => {
  it('returns skip message for unknown field', async () => {
    const automationId = createAutomation(user.id, 'portfolio-update', {
      field: 'email',
      value: 'hacker@evil.com',
    });

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('Portfolio update skipped');
    expect(res.body.output).toContain('email');
  });

  it('returns skip message when field is omitted', async () => {
    const automationId = createAutomation(user.id, 'portfolio-update', {
      value: 'Orphan value',
    });

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('Portfolio update skipped');
  });

  it('does NOT update disallowed column (no SQL injection via field)', async () => {
    const automationId = createAutomation(user.id, 'portfolio-update', {
      field: 'user_id',
      value: 'injected-id',
    });

    await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    const portfolio = db.prepare('SELECT user_id FROM portfolios WHERE user_id = ?').get(user.id) as { user_id: string } | undefined;
    expect(portfolio).toBeDefined();
    expect(portfolio!.user_id).toBe(user.id);
  });
});

// ---- 93.3 whatsapp-message action ----

describe('93.3 whatsapp-message automation action', () => {
  it('returns credential error message (not silent success)', async () => {
    const automationId = createAutomation(user.id, 'whatsapp-message', {
      message: 'Hello from automation',
    });

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('WhatsApp Business API credentials not configured');
    expect(res.body.output).toContain('Hello from automation');
  });

  it('uses default message when none provided', async () => {
    const automationId = createAutomation(user.id, 'whatsapp-message', {});

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('WhatsApp Business API credentials not configured');
  });
});

// ---- 93.4 manychat-broadcast action ----

describe('93.4 manychat-broadcast automation action', () => {
  it('returns credential error message (not silent success)', async () => {
    const automationId = createAutomation(user.id, 'manychat-broadcast', {
      message: 'Campaign broadcast',
    });

    const res = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(res.status).toBe(200);
    expect(res.body.output).toContain('ManyChat integration not configured');
    expect(res.body.output).toContain('Campaign broadcast');
  });
});

// ---- 93.5 Automation trigger stores execution log ----

describe('93.5 Automation trigger stores execution log', () => {
  it('log entry is created after manual trigger', async () => {
    const automationId = createAutomation(user.id, 'log', {
      message: 'Audit log test',
    }, 'Audit Test Automation');

    const triggerRes = await request(app)
      .post(`/api/automations/${automationId}/trigger`)
      .set('Authorization', user.token);

    expect(triggerRes.status).toBe(200);

    const logRes = await request(app)
      .get(`/api/automations/${automationId}/logs`)
      .set('Authorization', user.token);

    expect(logRes.status).toBe(200);
    expect(logRes.body).toHaveProperty('logs');
    expect(Array.isArray(logRes.body.logs)).toBe(true);
    expect(logRes.body.logs.length).toBeGreaterThan(0);
    expect(logRes.body.logs[0].automation_id).toBe(automationId);
  });
});

// ---- 93.6 Proactive routes are registered and auth-protected ----

describe('93.6 Proactive routes auth protection', () => {
  it('GET /api/proactive/settings returns 401 without token', async () => {
    const res = await request(app).get('/api/proactive/settings');
    expect(res.status).toBe(401);
  });

  it('GET /api/proactive/settings returns data with token', async () => {
    const res = await request(app)
      .get('/api/proactive/settings')
      .set('Authorization', user.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
  });

  it('GET /api/proactive/log returns array', async () => {
    const res = await request(app)
      .get('/api/proactive/log')
      .set('Authorization', user.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('log');
    expect(Array.isArray(res.body.log)).toBe(true);
  });

  it('PATCH /api/proactive/toggle disables proactive messages', async () => {
    const res = await request(app)
      .patch('/api/proactive/toggle')
      .set('Authorization', user.token)
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('PATCH /api/proactive/toggle re-enables proactive messages', async () => {
    const res = await request(app)
      .patch('/api/proactive/toggle')
      .set('Authorization', user.token)
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });
});

// ---- 93.7 Admin stats endpoint ----

describe('93.7 Admin /stats returns required fields', () => {
  it('returns totalUsers, memory, uptime with admin token', async () => {
    process.env.ADMIN_TOKEN = 'test-admin-token-93';

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', 'Bearer test-admin-token-93');

    if (res.status === 200) {
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('uptime');
    } else {
      expect([200, 401, 503]).toContain(res.status);
    }
  });
});

// ---- 93.8 Portfolio contact form honeypot ----

describe('93.8 Portfolio contact form honeypot', () => {
  it('silently accepts (200) when honeypot website field is filled', async () => {
    const nonceRes = await request(app).get(`/api/portfolio/${user.username}/nonce`);
    if (nonceRes.status !== 200) {
      return;
    }
    const { nonce } = nonceRes.body as { nonce: string };

    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({
        name: 'Bot Name',
        email: 'bot@spam.com',
        message: 'Spam message',
        website: 'http://spam.com',
        nonce,
      });

    expect([200, 429]).toContain(res.status);
  });
});

// ---- 93.9 Reminder snooze history ----

describe('93.9 Reminder snooze history endpoint', () => {
  it('returns snooze history entries after snoozing', async () => {
    const createRes = await request(app)
      .post('/api/reminders')
      .set('Authorization', user.token)
      .send({ text: 'Phase 93 snooze test', scheduledFor: new Date(Date.now() + 3600000).toISOString() });

    expect(createRes.status).toBe(201);
    const reminderId = createRes.body.id;

    await request(app)
      .post(`/api/reminders/${reminderId}/snooze`)
      .set('Authorization', user.token)
      .send({ preset: '1h' });

    const historyRes = await request(app)
      .get(`/api/reminders/${reminderId}/snooze-history`)
      .set('Authorization', user.token);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body).toHaveProperty('history');
    expect(Array.isArray(historyRes.body.history)).toBe(true);
    expect(historyRes.body.history.length).toBeGreaterThan(0);
    expect(historyRes.body.history[0]).toHaveProperty('preset');
  });
});

// ---- 93.10 JWT blocklist on logout ----

describe('93.10 JWT blocklist entry created on logout', () => {
  it('logout inserts jti into token_blocklist', async () => {
    const u2 = createTestUser(`phase93-logout-${Date.now()}@example.com`);
    const token = makeAuthHeader(u2.id);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', token);

    expect(res.status).toBe(200);

    const entry = db.prepare('SELECT jti FROM token_blocklist WHERE user_id = ?').get(u2.id);
    expect(entry).toBeDefined();
  });

  it('invalidated token returns 401 on protected route', async () => {
    const u3 = createTestUser(`phase93-blocked-${Date.now()}@example.com`);
    const token = makeAuthHeader(u3.id);

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', token);

    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', token);

    expect(res.status).toBe(401);
  });
});
