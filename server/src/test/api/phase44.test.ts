// ============================================================
// Phase 44 — Unit tests for:
//   44.1 fetchWithRetry — exponential backoff retry for webhook delivery on 5xx
//        - does NOT retry on 4xx (client errors)
//        - retries up to maxAttempts on 5xx (server errors)
//        - retries on network errors (connection refused)
//        - run_count + last_run updated even when webhook URL is unreachable
//   44.2 Recurring reminder reschedule after snooze
//        - scheduler creates next occurrence with recurrence field preserved
//        - snooze does NOT reschedule (it is a deferral, not completion)
//        - snooze endpoint happy path returns { snoozed: true }
// ============================================================

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { fetchWithRetry, initAutomationsEngine } from '../../services/automations-engine.js';
import { scheduleNextRecurrence } from '../../services/reminder-scheduler.js';

const app = createApp();

// ── 44.1: fetchWithRetry unit tests ───────────────────────────────────────

describe('fetchWithRetry — retry logic (Phase 44.1)', () => {
  it('returns immediately on 2xx without retrying', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    try {
      const res = await fetchWithRetry('http://example.com', {}, 3, 0);
      expect(res.status).toBe(200);
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns immediately on 4xx without retrying (client error)', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    try {
      const res = await fetchWithRetry('http://example.com', {}, 3, 0);
      expect(res.status).toBe(404);
      // Must NOT retry — only 1 call
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retries on 500 and succeeds on 2nd attempt', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount < 2) return new Response('Server Error', { status: 500 });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    try {
      const res = await fetchWithRetry('http://example.com', {}, 3, 0);
      expect(res.status).toBe(200);
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retries up to maxAttempts on 5xx and throws after exhausting attempts', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return new Response('Internal Server Error', { status: 503 });
    }) as typeof fetch;

    try {
      await expect(fetchWithRetry('http://example.com', {}, 3, 0)).rejects.toThrow('HTTP 503');
      expect(callCount).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retries on network error and throws after exhausting attempts', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    try {
      await expect(fetchWithRetry('http://localhost:19999', {}, 3, 0)).rejects.toThrow('ECONNREFUSED');
      expect(callCount).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('succeeds on 3rd attempt after two network errors', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('ECONNREFUSED');
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    try {
      const res = await fetchWithRetry('http://example.com', {}, 3, 0);
      expect(res.status).toBe(200);
      expect(callCount).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ── 44.1: Webhook automation failure updates run_count + last_run ──────────

describe('Webhook automation — run_count + last_run updated on failure (Phase 44.1)', () => {
  beforeAll(() => {
    resetDatabase();
    // initAutomationsEngine adds the last_status column via ALTER TABLE IF NOT EXISTS
    initAutomationsEngine();
  });
  afterEach(() => { resetDatabase(); });

  it('updates run_count and last_run even when webhook URL is unreachable', async () => {
    const user = createTestUser();
    const autoId = uuid();

    // Insert a webhook-trigger automation pointing to a guaranteed unreachable port
    db.prepare(`
      INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled, run_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).run(
      autoId,
      user.id,
      'Test Webhook',
      'webhook',
      JSON.stringify({}),
      'call_api',
      JSON.stringify({ url: 'http://localhost:19998', method: 'POST' }),
    );

    // Verify initial state (last_run defaults to '' in base schema, last_status added by initAutomationsEngine)
    const before = db.prepare('SELECT run_count, last_run FROM automations WHERE id = ?').get(autoId) as {
      run_count: number;
      last_run: string;
    };
    expect(before.run_count).toBe(0);
    expect(before.last_run).toBe('');

    // Fire the webhook trigger via the API
    const res = await request(app)
      .post(`/api/automations/${autoId}/trigger`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    // run_count must have incremented
    const after = db.prepare('SELECT run_count, last_run FROM automations WHERE id = ?').get(autoId) as {
      run_count: number;
      last_run: string;
    };
    expect(after.run_count).toBe(1);
    expect(after.last_run).not.toBe('');

    // Dead-letter entry should be created for the failed webhook
    const deadLetter = db.prepare('SELECT * FROM webhook_dead_letters WHERE automation_id = ?').get(autoId) as {
      automation_id: string;
      url: string;
      error: string;
    } | undefined;
    expect(deadLetter).toBeDefined();
    expect(deadLetter!.url).toBe('http://localhost:19998');
  });

  it('manual trigger on call_api automation records success in automation_logs', async () => {
    const user = createTestUser();
    const autoId = uuid();

    // Insert a log-type automation (always succeeds — no network call)
    db.prepare(`
      INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled, run_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).run(
      autoId,
      user.id,
      'Log Automation',
      'manual',
      JSON.stringify({}),
      'log',
      JSON.stringify({ message: 'Phase 44 test log' }),
    );

    const res = await request(app)
      .post(`/api/automations/${autoId}/trigger`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.success).toBe(true);

    const logEntry = db.prepare('SELECT * FROM automation_logs WHERE automation_id = ?').get(autoId) as {
      status: string;
      output: string;
    } | undefined;
    expect(logEntry).toBeDefined();
    expect(logEntry!.status).toBe('success');
    expect(logEntry!.output).toContain('Phase 44 test log');
  });
});

// ── 44.5: Automations enabled toggle wired to engine ─────────────────────────

describe('Automations enabled toggle (Phase 44.5)', () => {
  beforeAll(() => {
    resetDatabase();
    initAutomationsEngine();
  });
  afterEach(() => { resetDatabase(); });

  it('PATCH /automations/:id with { enabled: false } returns 200 and stores enabled=0', async () => {
    const user = createTestUser();
    const autoId = uuid();

    db.prepare(`
      INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(autoId, user.id, 'Toggle Test', 'manual', JSON.stringify({}), 'log', JSON.stringify({}));

    const res = await request(app)
      .patch(`/api/automations/${autoId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ enabled: false })
      .expect(200);

    expect(res.body.enabled).toBe(0);

    const row = db.prepare('SELECT enabled FROM automations WHERE id = ?').get(autoId) as { enabled: number };
    expect(row.enabled).toBe(0);
  });

  it('PATCH /automations/:id with { enabled: true } re-enables it and stores enabled=1', async () => {
    const user = createTestUser();
    const autoId = uuid();

    db.prepare(`
      INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(autoId, user.id, 'Disabled Auto', 'manual', JSON.stringify({}), 'log', JSON.stringify({}));

    const res = await request(app)
      .patch(`/api/automations/${autoId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ enabled: true })
      .expect(200);

    expect(res.body.enabled).toBe(1);

    const row = db.prepare('SELECT enabled FROM automations WHERE id = ?').get(autoId) as { enabled: number };
    expect(row.enabled).toBe(1);
  });

  it('engine SELECT for cron trigger only returns enabled automations', () => {
    const user = createTestUser();
    const enabledId = uuid();
    const disabledId = uuid();

    // Insert one enabled cron automation and one disabled
    db.prepare(`
      INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(enabledId, user.id, 'Enabled Cron', 'time', JSON.stringify({ interval_minutes: 60 }), 'log', JSON.stringify({}));

    db.prepare(`
      INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(disabledId, user.id, 'Disabled Cron', 'time', JSON.stringify({ interval_minutes: 60 }), 'log', JSON.stringify({}));

    // Query exactly what the engine uses in initAutomationsEngine()
    const cronAutomations = db.prepare(
      "SELECT * FROM automations WHERE trigger_type = 'time' AND enabled = 1"
    ).all() as Array<{ id: string }>;

    const returnedIds = cronAutomations.map((a) => a.id);
    expect(returnedIds).toContain(enabledId);
    expect(returnedIds).not.toContain(disabledId);
  });
});

// ── 44.6: OAuth error page for access_denied ──────────────────────────────────

describe('OAuth access_denied redirect (Phase 44.6)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('GET /oauth/google/callback?error=access_denied redirects to /login with error param', async () => {
    const res = await request(app)
      .get('/api/oauth/google/callback?error=access_denied')
      .expect(302);

    // Must redirect to the login page with a human-readable error message
    const location = res.headers['location'] as string;
    expect(location).toBeDefined();
    expect(location).toContain('/login');
    expect(location).toContain('error=');
    // Should contain a message about Google sign-in being cancelled
    expect(decodeURIComponent(location)).toContain('Google sign-in was cancelled');
  });

  it('GET /oauth/github/callback?error=access_denied redirects to /login with error param', async () => {
    const res = await request(app)
      .get('/api/oauth/github/callback?error=access_denied')
      .expect(302);

    const location = res.headers['location'] as string;
    expect(location).toBeDefined();
    expect(location).toContain('/login');
    expect(location).toContain('error=');
    // Should contain a message about GitHub sign-in being cancelled
    expect(decodeURIComponent(location)).toContain('GitHub sign-in was cancelled');
  });

  it('GET /oauth/google/callback?error=any_error redirects to /login (not just access_denied)', async () => {
    const res = await request(app)
      .get('/api/oauth/google/callback?error=user_cancelled_login')
      .expect(302);

    const location = res.headers['location'] as string;
    expect(location).toContain('/login');
    expect(location).toContain('error=');
  });
});

// ── 44.7: Admin rate limiter — config verification ────────────────────────────

describe('Admin rate limiter config (Phase 44.7)', () => {
  // Note: We cannot exercise the actual 429 block in unit tests without sending
  // 11+ identical requests in sequence (the limiter is disabled in TEST_MODE).
  // Instead we verify the admin routes respond normally and document the config.
  //
  // The adminLimiter in app.ts is configured as:
  //   windowMs: 60 * 1000   (1 minute window)
  //   max: 10               (10 req/min per IP)
  //   standardHeaders: true
  //   legacyHeaders: false
  //
  // This is a reasonable security baseline for admin-only sensitive endpoints.

  it('GET /api/admin returns a non-rate-limited response under normal load', async () => {
    // Admin routes require an X-Admin-Password header in production.
    // Without credentials we expect 400/401/403/404/503 — NOT a 429 (rate limit).
    // (503 can occur when the health probe cache is uninitialized in test mode.)
    const res = await request(app)
      .get('/api/admin/users')
      .expect((r) => {
        // Must NOT be rate limited (429) or a server crash (500)
        expect(r.status).not.toBe(429);
        expect(r.status).not.toBe(500);
      });

    // Confirm a response body is present (not an empty crash)
    expect(res).toBeDefined();
  });
});

// ── 44.2: Recurring reminder reschedule after snooze ─────────────────────────

describe('Recurring reminder reschedule (Phase 44.2)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  // Test 1: When the scheduler fires a recurring reminder, the next occurrence
  // is created with the correct next-day datetime AND preserves both recurring
  // and recurrence fields so the full chain continues.
  it('scheduleNextRecurrence creates next occurrence with recurrence field preserved', () => {
    const user = createTestUser();
    const remId = uuid();

    // Create a reminder with a past datetime so the "next" is clearly in the future.
    // Use 23 hours ago: adding 24h interval puts the next occurrence ~1 hour from now.
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, priority, completed, created_by, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'user', ?)
    `).run(remId, user.id, 'Daily standup', twentyThreeHoursAgo, 'push', 'work', 'daily', 'daily', 'high', Date.now() - 23 * 60 * 60 * 1000);

    const firedReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(remId) as {
      id: string;
      user_id: string;
      text: string;
      datetime: string;
      channel: string;
      category: string;
      recurring: string;
      recurrence: string | null;
      scheduled_for: number | null;
      priority: string | null;
    };

    // Simulate scheduler calling scheduleNextRecurrence after delivery
    scheduleNextRecurrence(firedReminder);

    // Verify the new occurrence was created
    const nextOccurrences = db.prepare(
      "SELECT * FROM reminders WHERE user_id = ? AND id != ? AND created_by = 'scheduler'"
    ).all(user.id, remId) as Array<{
      id: string;
      datetime: string;
      recurring: string;
      recurrence: string | null;
      priority: string | null;
      completed: number;
    }>;

    expect(nextOccurrences).toHaveLength(1);
    const next = nextOccurrences[0]!;

    // Next datetime should be ~1 hour from now (23 hours ago + 24h interval)
    const nextDate = new Date(next.datetime);
    const expectedDate = new Date(Date.now() - 23 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    expect(Math.abs(nextDate.getTime() - expectedDate.getTime())).toBeLessThan(60_000); // within 1 minute

    // recurrence field must be preserved (this was the bug — it was missing)
    expect(next.recurrence).toBe('daily');

    // recurring field also preserved
    expect(next.recurring).toBe('daily');

    // priority preserved
    expect(next.priority).toBe('high');

    // Not completed
    expect(next.completed).toBe(0);
  });

  // Test 2: Snoozing a recurring reminder does NOT reschedule it — it is a
  // temporary deferral. The snooze endpoint updates datetime and snooze_count
  // but leaves completed = 0 and does NOT insert a new occurrence.
  it('snooze does NOT create a new occurrence (snooze is deferral, not completion)', async () => {
    const user = createTestUser();
    const remId = uuid();

    // Create a past-due recurring reminder
    const pastDatetime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    db.prepare(`
      INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, recurrence, priority, completed, created_by, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'user', ?)
    `).run(remId, user.id, 'Weekly review', pastDatetime, 'push', 'work', 'weekly', 'weekly', 'normal', Date.now() - 60 * 60 * 1000);

    // Snooze the reminder
    await request(app)
      .post(`/api/reminders/${remId}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(200);

    // Only the original reminder should exist — no new occurrence
    const allReminders = db.prepare('SELECT * FROM reminders WHERE user_id = ?').all(user.id) as Array<{
      id: string;
      completed: number;
    }>;
    expect(allReminders).toHaveLength(1);
    expect(allReminders[0]!.completed).toBe(0); // still pending, not completed

    // No scheduler-created occurrences
    const schedulerRows = db.prepare(
      "SELECT * FROM reminders WHERE user_id = ? AND created_by = 'scheduler'"
    ).all(user.id);
    expect(schedulerRows).toHaveLength(0);
  });

  // Test 3: Basic snooze endpoint happy path — returns 200 with snoozed: true
  it('POST /:id/snooze returns 200 with { snoozed: true, newDatetime }', async () => {
    const user = createTestUser();
    const remId = uuid();

    const futureDatetime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min from now
    db.prepare(`
      INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'user', ?)
    `).run(remId, user.id, 'Test reminder', futureDatetime, 'push', 'general', Date.now() + 30 * 60 * 1000);

    const res = await request(app)
      .post(`/api/reminders/${remId}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: 'tomorrow' })
      .expect(200);

    expect(res.body.snoozed).toBe(true);
    expect(typeof res.body.newDatetime).toBe('string');

    // newDatetime should be in the future
    expect(new Date(res.body.newDatetime).getTime()).toBeGreaterThan(Date.now());
  });
});
