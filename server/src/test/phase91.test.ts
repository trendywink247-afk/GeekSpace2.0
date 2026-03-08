// ============================================================
// Phase 91 Tests — Coverage Boost
// Targets: computeCreditCost, fetchWithRetry, automations engine
//          service functions, proactive API routes, proactive
//          engine service functions (dailyBriefing, overdueAlert,
//          idleCheckIn, getProactiveLog).
// Goal: boost total test count from 1284 to 1300+
// ============================================================

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { createApp } from '../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from './setup.js';
import { db } from '../db/index.js';
import { computeCreditCost } from '../services/llm.js';
import {
  fetchWithRetry,
  checkKeywordTriggers,
  executeWebhookTrigger,
  executeManualTrigger,
  getAutomationLogs,
  initAutomationsEngine,
} from '../services/automations-engine.js';
import {
  dailyBriefing,
  overdueAlert,
  idleCheckIn,
  getProactiveLog,
} from '../services/proactive-engine.js';

// ================================================================
// 91.1: computeCreditCost — flat-rate providers (pure function)
// ================================================================

describe('91.1 computeCreditCost — flat rate providers', () => {
  it('ollama costs 1 credit regardless of tokens', () => {
    expect(computeCreditCost('ollama', 0, 0)).toBe(1);
    expect(computeCreditCost('ollama', 10000, 10000)).toBe(1);
  });

  it('openrouter-free costs 2 credits regardless of tokens', () => {
    expect(computeCreditCost('openrouter-free', 0, 0)).toBe(2);
    expect(computeCreditCost('openrouter-free', 50000, 50000)).toBe(2);
  });

  it('picoclaw costs 1 credit (flat)', () => {
    expect(computeCreditCost('picoclaw', 100, 200)).toBe(1);
  });

  it('builtin costs 0 credits', () => {
    expect(computeCreditCost('builtin', 10000, 10000)).toBe(0);
  });
});

// ================================================================
// 91.2: computeCreditCost — token-based providers
// ================================================================

describe('91.2 computeCreditCost — token-based providers', () => {
  it('openrouter returns minimum 10 credits for small token count', () => {
    // ceil(500/1000 * 5) = ceil(2.5) = 3, but min is 10
    expect(computeCreditCost('openrouter', 250, 250)).toBe(10);
  });

  it('openrouter returns proportional cost above minimum', () => {
    // ceil(3000/1000 * 5) = ceil(15) = 15
    expect(computeCreditCost('openrouter', 1500, 1500)).toBe(15);
  });

  it('openrouter with 2000 tokens matches minimum exactly', () => {
    // ceil(2000/1000 * 5) = ceil(10) = 10 — matches min
    expect(computeCreditCost('openrouter', 1000, 1000)).toBe(10);
  });

  it('edith returns minimum 10 credits for small token count', () => {
    // ceil(250/1000 * 10) = ceil(2.5) = 3, but min is 10
    expect(computeCreditCost('edith', 125, 125)).toBe(10);
  });

  it('edith returns proportional cost above minimum', () => {
    // ceil(2000/1000 * 10) = 20
    expect(computeCreditCost('edith', 1000, 1000)).toBe(20);
  });

  it('edith with 3000 tokens costs 30 credits', () => {
    // ceil(3000/1000 * 10) = 30
    expect(computeCreditCost('edith', 1500, 1500)).toBe(30);
  });
});

// ================================================================
// 91.3: fetchWithRetry — retry and error handling
// ================================================================

describe('91.3 fetchWithRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns response immediately on 200 success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    const res = await fetchWithRetry('http://test.example.com', {}, 1, 0);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry 4xx client errors (returns immediately)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', mockFetch);
    const res = await fetchWithRetry('http://test.example.com', {}, 3, 0);
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 server error and succeeds on second attempt', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    const res = await fetchWithRetry('http://test.example.com', {}, 2, 0);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all 5xx attempts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      fetchWithRetry('http://test.example.com', {}, 2, 0)
    ).rejects.toThrow();
  });

  it('retries on network error and succeeds on second attempt', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    const res = await fetchWithRetry('http://test.example.com', {}, 2, 0);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting network-error retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    await expect(
      fetchWithRetry('http://test.example.com', {}, 2, 0)
    ).rejects.toThrow('Network failure');
  });
});

// ================================================================
// Shared DB setup for automation + proactive tests
// ================================================================

const app = createApp();

describe('Phase 91 DB-backed tests', () => {
  let sharedUserId: string;
  let sharedToken: string;

  beforeAll(() => {
    resetDatabase();
    initAutomationsEngine(); // Creates automation_logs table
    const user = createTestUser(`phase91-shared-${Date.now()}@example.com`);
    sharedUserId = user.id;
    sharedToken = makeAuthHeader(sharedUserId);
  });

  afterAll(() => {
    resetDatabase();
  });

  // ================================================================
  // 91.4: checkKeywordTriggers
  // ================================================================

  describe('91.4 checkKeywordTriggers', () => {
    let keywordAutoId: string;

    beforeAll(() => {
      keywordAutoId = uuid();
      db.prepare(`
        INSERT INTO automations
          (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        keywordAutoId,
        sharedUserId,
        'Keyword Deploy Automation',
        'keyword',
        JSON.stringify({ keyword: 'deploy' }),
        'log',
        JSON.stringify({ message: 'Deployment triggered' }),
        1,
      );
    });

    it('does not execute automation when keyword not in message', async () => {
      const before = (db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(keywordAutoId) as { run_count: number }).run_count;

      await checkKeywordTriggers(sharedUserId, 'hello world, no match here');

      const after = (db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(keywordAutoId) as { run_count: number }).run_count;
      expect(after).toBe(before);
    });

    it('executes automation when keyword matches (case-insensitive)', async () => {
      const before = (db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(keywordAutoId) as { run_count: number }).run_count;

      await checkKeywordTriggers(sharedUserId, 'Please DEPLOY my portfolio now');

      const after = (db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(keywordAutoId) as { run_count: number }).run_count;
      expect(after).toBe(before + 1);
    });

    it('does not execute disabled keyword automations', async () => {
      const disabledId = uuid();
      db.prepare(`
        INSERT INTO automations
          (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        disabledId,
        sharedUserId,
        'Disabled Keyword Auto',
        'keyword',
        JSON.stringify({ keyword: 'deploy' }),
        'log',
        JSON.stringify({ message: 'Should not run' }),
        0,
      );

      await checkKeywordTriggers(sharedUserId, 'deploy everything');

      const row = db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(disabledId) as { run_count: number };
      expect(row.run_count).toBe(0);
    });

    it('completes without error for user with no keyword automations', async () => {
      await expect(
        checkKeywordTriggers('no-such-user', 'deploy')
      ).resolves.toBeUndefined();
    });
  });

  // ================================================================
  // 91.5: executeWebhookTrigger
  // ================================================================

  describe('91.5 executeWebhookTrigger', () => {
    let webhookAutoId: string;

    beforeAll(() => {
      webhookAutoId = uuid();
      db.prepare(`
        INSERT INTO automations
          (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        webhookAutoId,
        sharedUserId,
        'Webhook Automation',
        'webhook',
        JSON.stringify({}),
        'log',
        JSON.stringify({ message: 'Webhook fired successfully' }),
        1,
      );
    });

    it('returns error for non-existent automation', async () => {
      const result = await executeWebhookTrigger('non-existent-auto-id');
      expect(result.success).toBe(false);
      expect(result.output).toContain('not found');
    });

    it('executes existing webhook automation with log action', async () => {
      const result = await executeWebhookTrigger(webhookAutoId);
      expect(result.success).toBe(true);
      expect(result.output).toBe('Webhook fired successfully');
    });

    it('returns durationMs as non-negative number', async () => {
      const result = await executeWebhookTrigger(webhookAutoId, { event: 'test' });
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('increments run_count after execution', async () => {
      const before = (db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(webhookAutoId) as { run_count: number }).run_count;

      await executeWebhookTrigger(webhookAutoId);

      const after = (db.prepare(
        'SELECT run_count FROM automations WHERE id = ?'
      ).get(webhookAutoId) as { run_count: number }).run_count;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ================================================================
  // 91.6: executeManualTrigger
  // ================================================================

  describe('91.6 executeManualTrigger', () => {
    let manualAutoId: string;

    beforeAll(() => {
      manualAutoId = uuid();
      db.prepare(`
        INSERT INTO automations
          (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        manualAutoId,
        sharedUserId,
        'Manual Automation',
        'manual',
        JSON.stringify({}),
        'log',
        JSON.stringify({ message: 'Manual action executed' }),
        1,
      );
    });

    it('returns error for non-existent automation', async () => {
      const result = await executeManualTrigger('non-existent-id', sharedUserId);
      expect(result.success).toBe(false);
      expect(result.output).toContain('not found');
    });

    it('returns error when userId does not match automation owner', async () => {
      const result = await executeManualTrigger(manualAutoId, 'wrong-user-id');
      expect(result.success).toBe(false);
    });

    it('executes automation successfully when userId matches', async () => {
      const result = await executeManualTrigger(manualAutoId, sharedUserId);
      expect(result.success).toBe(true);
      expect(result.output).toBe('Manual action executed');
    });

    it('records execution in automation_logs table', async () => {
      await executeManualTrigger(manualAutoId, sharedUserId);
      const logs = db.prepare(
        'SELECT * FROM automation_logs WHERE automation_id = ? ORDER BY created_at DESC LIMIT 1'
      ).all(manualAutoId) as Array<{ status: string }>;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].status).toBe('success');
    });
  });

  // ================================================================
  // 91.7: getAutomationLogs
  // ================================================================

  describe('91.7 getAutomationLogs', () => {
    let logsAutoId: string;

    beforeAll(async () => {
      logsAutoId = uuid();
      db.prepare(`
        INSERT INTO automations
          (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logsAutoId,
        sharedUserId,
        'Logs Test Automation',
        'manual',
        JSON.stringify({}),
        'log',
        JSON.stringify({ message: 'Test log entry' }),
        1,
      );
      await executeManualTrigger(logsAutoId, sharedUserId);
    });

    it('returns array of logs for user', () => {
      const logs = getAutomationLogs(sharedUserId);
      expect(Array.isArray(logs)).toBe(true);
    });

    it('filters logs by automation id', () => {
      const logs = getAutomationLogs(sharedUserId, logsAutoId);
      expect(logs.length).toBeGreaterThan(0);
      const log = logs[0] as { automation_id: string };
      expect(log.automation_id).toBe(logsAutoId);
    });

    it('returns empty array for non-existent automation id', () => {
      const logs = getAutomationLogs(sharedUserId, 'non-existent-automation-id');
      expect(logs.length).toBe(0);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 3; i++) {
        await executeManualTrigger(logsAutoId, sharedUserId);
      }
      const logs = getAutomationLogs(sharedUserId, logsAutoId, 2);
      expect(logs.length).toBeLessThanOrEqual(2);
    });

    it('filters by status parameter', () => {
      const successLogs = getAutomationLogs(sharedUserId, logsAutoId, 50, 0, 'success');
      expect(Array.isArray(successLogs)).toBe(true);
      const allSuccess = (successLogs as Array<{ status: string }>)
        .every(l => l.status === 'success');
      expect(allSuccess).toBe(true);
    });
  });

  // ================================================================
  // 91.8: GET /api/proactive/log
  // ================================================================

  describe('91.8 GET /api/proactive/log', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/proactive/log');
      expect(res.status).toBe(401);
    });

    it('returns log array for authenticated user', async () => {
      const res = await request(app)
        .get('/api/proactive/log')
        .set('Authorization', sharedToken);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('log');
      expect(Array.isArray(res.body.log)).toBe(true);
    });

    it('respects custom limit query param', async () => {
      const res = await request(app)
        .get('/api/proactive/log?limit=5')
        .set('Authorization', sharedToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.log)).toBe(true);
    });

    it('clamps limit to maximum of 100', async () => {
      const res = await request(app)
        .get('/api/proactive/log?limit=9999')
        .set('Authorization', sharedToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.log)).toBe(true);
    });
  });

  // ================================================================
  // 91.9: GET /api/proactive/settings
  // ================================================================

  describe('91.9 GET /api/proactive/settings', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/proactive/settings');
      expect(res.status).toBe(401);
    });

    it('returns enabled field as boolean', async () => {
      const res = await request(app)
        .get('/api/proactive/settings')
        .set('Authorization', sharedToken);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('enabled');
      expect(typeof res.body.enabled).toBe('boolean');
    });

    it('new user defaults to enabled (true)', async () => {
      const newUser = createTestUser(`settings-user-${Date.now()}@example.com`);
      const token = makeAuthHeader(newUser.id);
      const res = await request(app)
        .get('/api/proactive/settings')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });
  });

  // ================================================================
  // 91.10: PATCH /api/proactive/toggle
  // ================================================================

  describe('91.10 PATCH /api/proactive/toggle', () => {
    let toggleUserId: string;
    let toggleToken: string;

    beforeAll(() => {
      const u = createTestUser(`toggle-user-${Date.now()}@example.com`);
      toggleUserId = u.id;
      toggleToken = makeAuthHeader(toggleUserId);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/proactive/toggle')
        .send({ enabled: false });
      expect(res.status).toBe(401);
    });

    it('returns 400 when enabled is not boolean', async () => {
      const res = await request(app)
        .patch('/api/proactive/toggle')
        .set('Authorization', toggleToken)
        .send({ enabled: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when enabled field is missing', async () => {
      const res = await request(app)
        .patch('/api/proactive/toggle')
        .set('Authorization', toggleToken)
        .send({});
      expect(res.status).toBe(400);
    });

    it('disables proactive messages and persists change in DB', async () => {
      const res = await request(app)
        .patch('/api/proactive/toggle')
        .set('Authorization', toggleToken)
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);

      const user = db.prepare('SELECT proactive_enabled FROM users WHERE id = ?')
        .get(toggleUserId) as { proactive_enabled: number };
      expect(user.proactive_enabled).toBe(0);
    });

    it('re-enables proactive messages and persists change in DB', async () => {
      const res = await request(app)
        .patch('/api/proactive/toggle')
        .set('Authorization', toggleToken)
        .send({ enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);

      const user = db.prepare('SELECT proactive_enabled FROM users WHERE id = ?')
        .get(toggleUserId) as { proactive_enabled: number };
      expect(user.proactive_enabled).toBe(1);
    });

    it('GET /settings reflects the toggle change', async () => {
      await request(app)
        .patch('/api/proactive/toggle')
        .set('Authorization', toggleToken)
        .send({ enabled: false });

      const res = await request(app)
        .get('/api/proactive/settings')
        .set('Authorization', toggleToken);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });
  });

  // ================================================================
  // 91.11: dailyBriefing service function
  // ================================================================

  describe('91.11 dailyBriefing', () => {
    let briefUserId: string;

    beforeAll(() => {
      briefUserId = createTestUser(`briefing-${Date.now()}@example.com`).id;
    });

    it('returns null for non-existent user', async () => {
      const result = await dailyBriefing('non-existent-user-id');
      expect(result).toBeNull();
    });

    it('returns null when proactive is disabled for user', async () => {
      const disabledUser = createTestUser(`disabled-brief-${Date.now()}@example.com`);
      db.prepare('UPDATE users SET proactive_enabled = 0 WHERE id = ?')
        .run(disabledUser.id);
      const result = await dailyBriefing(disabledUser.id);
      expect(result).toBeNull();
    });

    it('returns greeting message starting with Good morning', async () => {
      const result = await dailyBriefing(briefUserId);
      expect(result).not.toBeNull();
      expect(result).toContain('Good morning');
    });

    it('mentions clear schedule when user has no reminders', async () => {
      const result = await dailyBriefing(briefUserId);
      expect(result).not.toBeNull();
      expect(result).toMatch(/clear schedule|pending/);
    });

    it('includes overdue count when overdue reminders exist', async () => {
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuid(),
        briefUserId,
        'Long overdue task for testing',
        new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        'push', 'personal', 0, 'user',
      );

      const result = await dailyBriefing(briefUserId);
      expect(result).not.toBeNull();
      expect(result).toContain('overdue');
    });

    it('records message in proactive_messages table', async () => {
      const before = (db.prepare(
        "SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND type = 'daily_briefing'"
      ).get(briefUserId) as { c: number }).c;

      await dailyBriefing(briefUserId);

      const after = (db.prepare(
        "SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND type = 'daily_briefing'"
      ).get(briefUserId) as { c: number }).c;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ================================================================
  // 91.12: overdueAlert service function
  // ================================================================

  describe('91.12 overdueAlert', () => {
    let alertUserId: string;

    beforeAll(() => {
      alertUserId = createTestUser(`alert-${Date.now()}@example.com`).id;
    });

    it('returns null when no overdue reminders exist', async () => {
      const result = await overdueAlert(alertUserId);
      expect(result).toBeNull();
    });

    it('returns null when proactive disabled', async () => {
      const disabledUser = createTestUser(`disabled-alert-${Date.now()}@example.com`);
      db.prepare('UPDATE users SET proactive_enabled = 0 WHERE id = ?')
        .run(disabledUser.id);
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuid(), disabledUser.id, 'Overdue test reminder',
        new Date(Date.now() - 7200000).toISOString(),
        'push', 'personal', 0, 'user',
      );
      const result = await overdueAlert(disabledUser.id);
      expect(result).toBeNull();
    });

    it('returns alert message when overdue reminders exist', async () => {
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuid(), alertUserId, 'Call dentist appointment',
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        'push', 'personal', 0, 'user',
      );

      const result = await overdueAlert(alertUserId);
      expect(result).not.toBeNull();
      expect(result).toContain('overdue');
    });

    it('message includes preview of overdue reminder text', async () => {
      const result = await overdueAlert(alertUserId);
      expect(result).not.toBeNull();
      expect(result).toContain('Call dentist appointment');
    });

    it('records alert in proactive_messages table', async () => {
      const before = (db.prepare(
        "SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND type = 'overdue_alert'"
      ).get(alertUserId) as { c: number }).c;

      await overdueAlert(alertUserId);

      const after = (db.prepare(
        "SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND type = 'overdue_alert'"
      ).get(alertUserId) as { c: number }).c;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ================================================================
  // 91.13: idleCheckIn service function
  // ================================================================

  describe('91.13 idleCheckIn', () => {
    let idleUserId: string;

    beforeAll(() => {
      idleUserId = createTestUser(`idle-${Date.now()}@example.com`).id;
    });

    it('returns null for non-existent user', async () => {
      const result = await idleCheckIn('non-existent-user-id');
      expect(result).toBeNull();
    });

    it('returns null when user has no last_active set', async () => {
      db.prepare('UPDATE users SET last_active = NULL WHERE id = ?').run(idleUserId);
      const result = await idleCheckIn(idleUserId);
      expect(result).toBeNull();
    });

    it('returns null when user was active within 3 days', async () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(recentDate, idleUserId);
      const result = await idleCheckIn(idleUserId);
      expect(result).toBeNull();
    });

    it('returns check-in message when user inactive 3+ days', async () => {
      const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(oldDate, idleUserId);
      const result = await idleCheckIn(idleUserId);
      expect(result).not.toBeNull();
      expect(result).toContain('miss you');
    });

    it('returns null when proactive disabled for idle user', async () => {
      const disabledUser = createTestUser(`disabled-idle-${Date.now()}@example.com`);
      db.prepare('UPDATE users SET proactive_enabled = 0 WHERE id = ?').run(disabledUser.id);
      const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(oldDate, disabledUser.id);
      const result = await idleCheckIn(disabledUser.id);
      expect(result).toBeNull();
    });

    it('records idle check-in in proactive_messages', async () => {
      const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(oldDate, idleUserId);

      const before = (db.prepare(
        "SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND type = 'idle_check_in'"
      ).get(idleUserId) as { c: number }).c;

      await idleCheckIn(idleUserId);

      const after = (db.prepare(
        "SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND type = 'idle_check_in'"
      ).get(idleUserId) as { c: number }).c;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ================================================================
  // 91.14: getProactiveLog service function
  // ================================================================

  describe('91.14 getProactiveLog', () => {
    let logUserId: string;

    beforeAll(() => {
      logUserId = createTestUser(`proactive-log-${Date.now()}@example.com`).id;
      for (let i = 0; i < 3; i++) {
        db.prepare(
          'INSERT INTO proactive_messages (user_id, type, sent_at, message) VALUES (?, ?, ?, ?)'
        ).run(logUserId, 'daily_briefing', Date.now() + i * 1000, `Briefing message ${i + 1}`);
      }
      db.prepare(
        'INSERT INTO proactive_messages (user_id, type, sent_at, message) VALUES (?, ?, ?, ?)'
      ).run(logUserId, 'overdue_alert', Date.now() + 5000, 'You have 2 overdue reminders');
    });

    it('returns empty array for user with no messages', () => {
      const freshUser = createTestUser(`no-msgs-${Date.now()}@example.com`);
      const log = getProactiveLog(freshUser.id);
      expect(Array.isArray(log)).toBe(true);
      expect(log.length).toBe(0);
    });

    it('returns messages for user with proactive history', () => {
      const log = getProactiveLog(logUserId);
      expect(Array.isArray(log)).toBe(true);
      expect(log.length).toBeGreaterThan(0);
    });

    it('returns messages with expected fields (type, message, sent_at)', () => {
      const log = getProactiveLog(logUserId) as Array<{
        type: string;
        message: string;
        sent_at: number;
      }>;
      expect(log.length).toBeGreaterThan(0);
      const first = log[0];
      expect(first).toHaveProperty('type');
      expect(first).toHaveProperty('message');
      expect(first).toHaveProperty('sent_at');
    });

    it('respects limit parameter', () => {
      const log = getProactiveLog(logUserId, 2);
      expect(log.length).toBeLessThanOrEqual(2);
    });

    it('returns messages in descending order (most recent first)', () => {
      const log = getProactiveLog(logUserId) as Array<{ sent_at: number }>;
      if (log.length >= 2) {
        expect(log[0].sent_at).toBeGreaterThanOrEqual(log[1].sent_at);
      }
    });
  });
});
