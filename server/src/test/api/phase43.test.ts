// ============================================================
// Phase 43 — Unit tests for:
//   43.3 PATCH /reminders/:id — resets remind_before_sent_at when due_at (datetime) is rescheduled
//   43.7 POST /portfolio/:username/view — deduplicates view_count within 1h per IP
//   43.8 XSS hardening — strip HTML in portfolio fields + contact form
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

// ── 43.9: DB performance indexes ──────────────────────────────────────────

describe('Phase 43.9 — DB indexes', () => {
  it('all performance indexes exist', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all() as { name: string }[];
    const names = new Set(indexes.map((i) => i.name));
    // idx_reminders_user_due was removed in Phase 45.2 (duplicate of idx_reminders_datetime)
    expect(names.has('idx_reminders_datetime')).toBe(true);
    expect(names.has('idx_activity_log_user_created')).toBe(true);
    expect(names.has('idx_snooze_log_reminder')).toBe(true);
    expect(names.has('idx_conversations_user_updated')).toBe(true);
    expect(names.has('idx_automations_user_active')).toBe(true);
  });
});

// ── 43.8: XSS hardening — stripDangerousHtml in portfolio fields ───────────

describe('XSS hardening — portfolio bio + projects + contact form (Phase 43.8)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('strips script tags from portfolio bio (about field)', async () => {
    const user = createTestUser();
    // Insert portfolio row so PATCH /me has something to update
    db.prepare(
      'INSERT INTO portfolios (user_id, username, about, headline, skills, projects, milestones, social, layout, agent_enabled, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.id, user.username, '', '', '[]', '[]', '[]', '{}', 'classic', 0, '{}');

    // Send bio containing a script block
    const res = await request(app)
      .patch('/api/portfolio/me')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ about: 'Hello <script>alert(1)</script> World' })
      .expect(200);

    const about: string = res.body.about ?? '';
    // Script tags (and the entire block) must be stripped — no executable markup
    expect(about).not.toContain('<script>');
    expect(about).not.toContain('</script>');
    // Surrounding plain text should survive
    expect(about).toContain('Hello');
    expect(about).toContain('World');
  });

  it('strips onclick event handlers from project description', async () => {
    const user = createTestUser();
    db.prepare(
      'INSERT INTO portfolios (user_id, username, about, headline, skills, projects, milestones, social, layout, agent_enabled, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.id, user.username, '', '', '[]', '[]', '[]', '{}', 'classic', 0, '{}');

    const maliciousProject = {
      name: 'MyProject',
      description: '<div onclick="evil()">Click me</div>',
    };

    const res = await request(app)
      .patch('/api/portfolio/me')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ projects: [maliciousProject] })
      .expect(200);

    const projects: Array<{ name: string; description?: string }> = res.body.projects ?? [];
    expect(projects).toHaveLength(1);
    const desc = projects[0].description ?? '';
    expect(desc).not.toContain('onclick');
    expect(desc).not.toContain('evil()');
    // The text content should be preserved
    expect(desc).toContain('Click me');
  });

  it('preserves safe HTML tags in bio (strong, em, b)', async () => {
    const user = createTestUser();
    db.prepare(
      'INSERT INTO portfolios (user_id, username, about, headline, skills, projects, milestones, social, layout, agent_enabled, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.id, user.username, '', '', '[]', '[]', '[]', '{}', 'classic', 0, '{}');

    // Note: the Zod schema already runs a basic stripHtml on 'about', so we test via
    // project description (not stripped by Zod) to verify stripDangerousHtml preserves safe tags
    const safeProject = {
      name: 'SafeProject',
      description: '<strong>Bold text</strong> and <em>italic</em>',
    };

    const res = await request(app)
      .patch('/api/portfolio/me')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ projects: [safeProject] })
      .expect(200);

    const projects: Array<{ name: string; description?: string }> = res.body.projects ?? [];
    expect(projects).toHaveLength(1);
    const desc = projects[0].description ?? '';
    expect(desc).toContain('<strong>');
    expect(desc).toContain('<em>');
    expect(desc).toContain('Bold text');
    expect(desc).toContain('italic');
  });

  it('strips script from contact form message', async () => {
    const user = createTestUser();
    // Portfolio must be public for contact form to accept submissions
    db.prepare(
      'INSERT INTO portfolios (user_id, username, is_public) VALUES (?, ?, ?)'
    ).run(user.id, user.username, 1);

    const contactId = uuid();
    // Send message with embedded script tag
    const res = await request(app)
      .post(`/api/portfolio/${user.username}/contact`)
      .send({
        senderName: 'Alice<script>evil()</script>',
        message: 'Hello <script>alert("xss")</script> there',
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify stored record in DB does NOT contain <script>
    const stored = db.prepare(
      'SELECT sender_name, message FROM portfolio_contacts WHERE user_id = ?'
    ).get(user.id) as { sender_name: string; message: string } | undefined;

    expect(stored).toBeDefined();
    expect(stored!.message).not.toContain('<script>');
    expect(stored!.message).not.toContain('alert(');
    expect(stored!.message).toContain('Hello');
    expect(stored!.message).toContain('there');
    expect(stored!.sender_name).not.toContain('<script>');
    expect(stored!.sender_name).toContain('Alice');
  });
});
