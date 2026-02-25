// ============================================================
// Phase 43 — Unit tests for:
//   43.3 PATCH /reminders/:id — resets remind_before_sent_at when due_at (datetime) is rescheduled
//   43.7 POST /portfolio/:username/view — deduplicates view_count within 1h per IP
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

// ── 43.7: Portfolio view_count dedup per IP within 1h ─────────────────────

describe('Portfolio view dedup — POST /api/portfolio/:username/view (Phase 43.7)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('second call from same IP does not increment view_count (dedup within 1h)', async () => {
    const user = createTestUser();
    // Use a globally unique username to avoid collisions with the module-level Map
    const username = `dedup_same_${uuid().replace(/-/g, '').slice(0, 8)}`;
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, user.id);
    db.prepare('INSERT INTO portfolios (user_id, username, view_count) VALUES (?, ?, ?)').run(user.id, username, 0);

    // First request — should increment
    await request(app)
      .post(`/api/portfolio/${username}/view`)
      .expect(200);

    // Second request from same IP — should be deduped
    await request(app)
      .post(`/api/portfolio/${username}/view`)
      .expect(200);

    const row = db.prepare('SELECT view_count FROM portfolios WHERE user_id = ?').get(user.id) as { view_count: number };
    expect(row.view_count).toBe(1);
  });

  it('request from a different IP increments view_count again', async () => {
    const user = createTestUser();
    const username = `dedup_diff_${uuid().replace(/-/g, '').slice(0, 8)}`;
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, user.id);
    db.prepare('INSERT INTO portfolios (user_id, username, view_count) VALUES (?, ?, ?)').run(user.id, username, 0);

    // First GET from default loopback IP → view_count becomes 1
    await request(app)
      .post(`/api/portfolio/${username}/view`)
      .expect(200);

    // Second GET with a spoofed different IP via X-Forwarded-For → view_count becomes 2
    await request(app)
      .post(`/api/portfolio/${username}/view`)
      .set('X-Forwarded-For', '1.2.3.4')
      .expect(200);

    const row = db.prepare('SELECT view_count FROM portfolios WHERE user_id = ?').get(user.id) as { view_count: number };
    expect(row.view_count).toBe(2);
  });

  it('returns 404 for unknown username', async () => {
    await request(app)
      .post('/api/portfolio/nonexistent_user_xyz/view')
      .expect(404);
  });
});
