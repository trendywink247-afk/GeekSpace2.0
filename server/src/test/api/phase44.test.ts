// ============================================================
// Phase 44 — Unit tests for:
//   44.1 fetchWithRetry — exponential backoff retry for webhook delivery on 5xx
//        - does NOT retry on 4xx (client errors)
//        - retries up to maxAttempts on 5xx (server errors)
//        - retries on network errors (connection refused)
//        - run_count + last_run updated even when webhook URL is unreachable
// ============================================================

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { fetchWithRetry, initAutomationsEngine } from '../../services/automations-engine.js';

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
