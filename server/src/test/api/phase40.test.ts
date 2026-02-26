// ============================================================
// Phase 40 — Unit tests for:
//   40.2 Portfolio contact honeypot (silent 200 when honeypot filled)
//   40.4 DELETE /activity — clear all activity log entries
//   40.6 remind_before_sent_at column exists on reminders table
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 40.4: DELETE /activity ─────────────────────────────────────────────────

describe('Activity — DELETE /api/activity (Phase 40.4)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('deletes all activity entries and returns deleted count', async () => {
    const user = createTestUser();
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
        .run(uuid(), user.id, `Action ${i}`, 'detail', 'bell');
    }
    const res = await request(app)
      .delete('/api/activity')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body.deleted).toBe(5);
    // Verify DB is empty for this user
    const count = (db.prepare('SELECT COUNT(*) as c FROM activity_log WHERE user_id = ?').get(user.id) as { c: number }).c;
    expect(count).toBe(0);
  });

  it('returns deleted=0 when no entries exist', async () => {
    const user = createTestUser();
    const res = await request(app)
      .delete('/api/activity')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body.deleted).toBe(0);
  });

  it('requires authentication', async () => {
    await request(app)
      .delete('/api/activity')
      .expect(401);
  });

  it('only deletes entries for the authenticated user', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), user1.id, 'Action u1', 'detail', 'bell');
    db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), user2.id, 'Action u2', 'detail', 'bell');
    await request(app)
      .delete('/api/activity')
      .set('Authorization', makeAuthHeader(user1.id))
      .expect(200);
    // user2's entry must remain
    const count = (db.prepare('SELECT COUNT(*) as c FROM activity_log WHERE user_id = ?').get(user2.id) as { c: number }).c;
    expect(count).toBe(1);
  });
});

// ── 40.2: Portfolio contact honeypot ──────────────────────────────────────

describe('Portfolio — Contact honeypot (Phase 40.2)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('silently accepts and discards submissions with honeypot filled', async () => {
    const user = createTestUser();
    // Insert portfolio (user_id is PK, no separate id column)
    db.prepare(`INSERT OR IGNORE INTO portfolios (user_id, username, headline, about, is_public) VALUES (?, ?, ?, ?, 1)`)
      .run(user.id, 'testuser40', 'Test', 'Test bio');
    db.prepare(`UPDATE users SET username = ? WHERE id = ?`).run('testuser40', user.id);

    const res = await request(app)
      .post('/api/portfolio/testuser40/contact')
      .send({ senderName: 'Bot', senderEmail: 'bot@spam.com', message: 'spam message', honeypot: 'filled' })
      .expect(200);
    expect(res.body.success).toBe(true);

    // Verify no contact was stored
    const contacts = db.prepare(`SELECT COUNT(*) as c FROM portfolio_contacts WHERE user_id = ?`).get(user.id) as { c: number } | undefined;
    expect(contacts?.c ?? 0).toBe(0);
  });

  it('accepts legitimate submissions (no honeypot)', async () => {
    const user = createTestUser();
    db.prepare(`INSERT OR IGNORE INTO portfolios (user_id, username, headline, about, is_public) VALUES (?, ?, ?, ?, 1)`)
      .run(user.id, 'legituser40', 'Test', 'Test bio');
    db.prepare(`UPDATE users SET username = ? WHERE id = ?`).run('legituser40', user.id);

    await request(app)
      .post('/api/portfolio/legituser40/contact')
      .send({ senderName: 'Alice', senderEmail: 'alice@example.com', message: 'Great portfolio!' })
      .expect(200);
  });
});

// ── 40.6: remind_before_sent_at column exists ─────────────────────────────

describe('Reminders — remind_before_sent_at column (Phase 40.6)', () => {
  it('column exists on reminders table after migration', () => {
    const cols = db.prepare(`PRAGMA table_info(reminders)`).all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain('remind_before_sent_at');
  });

  it('defaults to NULL for existing reminders', () => {
    resetDatabase();
    const user = createTestUser();
    const id = uuid();
    db.prepare(`INSERT INTO reminders (id, user_id, text, datetime, scheduled_for) VALUES (?, ?, ?, ?, ?)`)
      .run(id, user.id, 'Test reminder', new Date(Date.now() + 3600000).toISOString(), Date.now() + 3600000);
    const row = db.prepare('SELECT remind_before_sent_at FROM reminders WHERE id = ?').get(id) as { remind_before_sent_at: number | null };
    expect(row.remind_before_sent_at).toBeNull();
  });
});
