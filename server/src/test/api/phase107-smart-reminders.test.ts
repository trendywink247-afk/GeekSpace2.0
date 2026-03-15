/**
 * Phase 107: Smart Reminders Tests
 *
 * Tests for:
 * - Smart recurrence engine (weekdays, every N days, Nth weekday, last X of month)
 * - Batch reminder creation
 * - Snooze pattern detection
 * - Reminder templates
 * - create_memory tool (BLOCKER-006 fix)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, generateTestToken } from '../setup.js';

const app = createApp();
let token: string;

beforeEach(() => {
  resetDatabase();
  const user = createTestUser();
  token = generateTestToken(user.id);
});

// ---- Smart Recurrence via Complete Endpoint ----

describe('Phase 107: Smart Recurrence', () => {
  it('completes a daily recurring reminder and creates next occurrence', async () => {
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Daily standup',
        datetime: new Date(Date.now() + 3600000).toISOString(),
        recurrence: 'daily',
      });

    expect(create.status).toBe(201);
    const reminderId = create.body.id;

    const complete = await request(app)
      .post(`/api/reminders/${reminderId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(complete.status).toBe(200);
    expect(complete.body.completed).toBe(true);
    expect(complete.body.nextReminder).toBeTruthy();
    expect(complete.body.nextReminder.text).toBe('Daily standup');
    expect(complete.body.nextReminder.recurrence).toBe('daily');
  });

  it('completes a weekdays recurring reminder and skips weekends', async () => {
    // Set to a Friday
    const friday = new Date('2026-03-20T09:00:00Z'); // March 20, 2026 is a Friday
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Weekday standup',
        datetime: friday.toISOString(),
        recurrence: 'weekdays',
      });

    expect(create.status).toBe(201);
    const reminderId = create.body.id;

    const complete = await request(app)
      .post(`/api/reminders/${reminderId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(complete.status).toBe(200);
    if (complete.body.nextReminder) {
      const nextDay = new Date(complete.body.nextReminder.datetime).getDay();
      // Should not be Saturday (6) or Sunday (0)
      expect(nextDay).not.toBe(0);
      expect(nextDay).not.toBe(6);
    }
  });

  it('handles non-recurring reminder completion without next occurrence', async () => {
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'One-time task',
        datetime: new Date(Date.now() + 3600000).toISOString(),
      });

    const complete = await request(app)
      .post(`/api/reminders/${create.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(complete.status).toBe(200);
    expect(complete.body.completed).toBe(true);
    expect(complete.body.nextReminder).toBeNull();
  });
});

// ---- Batch Create ----

describe('Phase 107: Batch Create', () => {
  it('creates multiple reminders in a batch', async () => {
    const res = await request(app)
      .post('/api/reminders/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { text: 'Batch reminder 1', priority: 'high' },
          { text: 'Batch reminder 2', category: 'work' },
          { text: 'Batch reminder 3', recurrence: 'daily' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(3);
    expect(res.body.ids).toHaveLength(3);
  });

  it('rejects empty batch', async () => {
    const res = await request(app)
      .post('/api/reminders/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  it('rejects oversized batch (>50 items)', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ text: `Reminder ${i}` }));
    const res = await request(app)
      .post('/api/reminders/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ items });

    expect(res.status).toBe(400);
  });
});

// ---- Snooze Pattern Detection ----

describe('Phase 107: Snooze Pattern Detection', () => {
  it('detects no pattern when snooze count < 3', async () => {
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Low snooze test', datetime: new Date(Date.now() + 3600000).toISOString() });

    const res = await request(app)
      .get(`/api/reminders/${create.body.id}/snooze-pattern`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pattern_detected).toBe(false);
    expect(res.body.snooze_count).toBe(0);
  });

  it('detects pattern after 3+ snoozes', async () => {
    const create = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Frequent snooze test', datetime: new Date(Date.now() + 3600000).toISOString() });

    const reminderId = create.body.id;

    // Snooze 3 times
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/reminders/${reminderId}/snooze`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preset: '1h' });
    }

    const res = await request(app)
      .get(`/api/reminders/${reminderId}/snooze-pattern`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pattern_detected).toBe(true);
    expect(res.body.snooze_count).toBeGreaterThanOrEqual(3);
    expect(res.body.suggestion).toBeTruthy();
  });
});

// ---- Reminder Templates ----

describe('Phase 107: Reminder Templates', () => {
  it('returns available templates', async () => {
    const res = await request(app)
      .get('/api/reminders/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('items');
    expect(Array.isArray(res.body[0].items)).toBe(true);
  });
});

// ---- BLOCKER-006: create_memory Tool ----

describe('BLOCKER-006: create_memory tool in action parser', () => {
  it('create_memory schema exists in TOOL_SCHEMAS', async () => {
    const { TOOL_SCHEMAS } = await import('../../services/action-parser.js');
    expect(TOOL_SCHEMAS).toHaveProperty('create_memory');
  });

  it('create_memory schema validates correct input', async () => {
    const { TOOL_SCHEMAS } = await import('../../services/action-parser.js');
    const schema = TOOL_SCHEMAS['create_memory'];
    const result = schema.safeParse({
      key: 'language_preference',
      value: 'TypeScript',
      category: 'preference',
    });
    expect(result.success).toBe(true);
  });

  it('create_memory schema rejects empty key', async () => {
    const { TOOL_SCHEMAS } = await import('../../services/action-parser.js');
    const schema = TOOL_SCHEMAS['create_memory'];
    const result = schema.safeParse({
      key: '',
      value: 'TypeScript',
    });
    expect(result.success).toBe(false);
  });
});

// ---- BLOCKER-009: Usage Route Aliases ----

describe('BLOCKER-009: Usage route aliases', () => {
  it('GET /api/usage/stats returns data (alias for /summary)', async () => {
    const res = await request(app)
      .get('/api/usage/stats')
      .set('Authorization', `Bearer ${token}`);

    // Should return 200 (not 404)
    expect(res.status).toBe(200);
  });

  it('GET /api/usage/history returns data (alias for /events)', async () => {
    const res = await request(app)
      .get('/api/usage/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
