// ============================================================
// Phase 43 — Unit tests for:
//   43.3 PATCH /reminders/:id — resets remind_before_sent_at when due_at (datetime) is rescheduled
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 43.3: remind_before_sent_at reset on reschedule ───────────────────────

describe('Reminders — PATCH /api/reminders/:id resets remind_before_sent_at on reschedule (Phase 43.3)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('resets remind_before_sent_at to NULL when due_at (datetime) is changed', async () => {
    const user = createTestUser();
    const remId = uuid();
    const now = Date.now();
    const oldDatetime = new Date(now + 3600000).toISOString();
    const newDatetime = new Date(now + 7200000).toISOString();
    const sentAt = now - 60000; // pretend heads-up was already sent

    // Insert reminder with remind_before_sent_at already set (non-NULL)
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for, remind_before_sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test reminder', oldDatetime, 'push', 'general', 'user', now + 3600000, sentAt);

    // Verify it is set before patching
    const before = db.prepare('SELECT remind_before_sent_at FROM reminders WHERE id = ?').get(remId) as { remind_before_sent_at: number | null };
    expect(before.remind_before_sent_at).toBe(sentAt);

    // PATCH with a new datetime (reschedule)
    await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ datetime: newDatetime })
      .expect(200);

    // remind_before_sent_at must be NULL so the heads-up will fire again
    const after = db.prepare('SELECT remind_before_sent_at FROM reminders WHERE id = ?').get(remId) as { remind_before_sent_at: number | null };
    expect(after.remind_before_sent_at).toBeNull();
  });

  it('does NOT reset remind_before_sent_at when datetime is not changed', async () => {
    const user = createTestUser();
    const remId = uuid();
    const now = Date.now();
    const datetimeVal = new Date(now + 3600000).toISOString();
    const sentAt = now - 60000;

    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for, remind_before_sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test reminder', datetimeVal, 'push', 'general', 'user', now + 3600000, sentAt);

    // PATCH without changing datetime (only update text)
    await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ text: 'Updated text only' })
      .expect(200);

    // remind_before_sent_at should remain unchanged
    const after = db.prepare('SELECT remind_before_sent_at FROM reminders WHERE id = ?').get(remId) as { remind_before_sent_at: number | null };
    expect(after.remind_before_sent_at).toBe(sentAt);
  });

  it('returns 404 when reminder does not exist', async () => {
    const user = createTestUser();

    await request(app)
      .patch(`/api/reminders/${uuid()}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ datetime: new Date(Date.now() + 3600000).toISOString() })
      .expect(404);
  });
});
