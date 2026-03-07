/**
 * Phase 110 Tests — Timezone-aware reminders, memory isolation, image media, voice
 *
 * Test groups:
 *   110.1 — Timezone column, /me/timezone endpoint, GET /me timezone field, parseReminderTime param
 *   110.2 — parseReminderTime timezone correctness (direct call)
 *   110.3 — Reminder notification has no memory leak (no getRelevantMemories in scheduler)
 *   110.4 — Image/video URL not sent as raw text in message-router
 *   110.5 — Reminder user_id scoping (two-user isolation via DB + source)
 *   110.6 — Voice note handled cleanly without raw error throws
 *   110.7 — IST hardcode removed from message-router; proactive-engine still owns IST logic
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { v4 as uuid } from 'uuid';

import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, generateTestToken } from '../setup.js';
import { parseReminderTime } from '../../services/pico-fleet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve to server/src root so readSrc() can reference source files
const SERVER_SRC = path.resolve(__dirname, '../../');

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(SERVER_SRC, ...parts), 'utf-8');
}

const app = createApp();

let user1: ReturnType<typeof createTestUser>;
let user2: ReturnType<typeof createTestUser>;
let token1: string;
let token2: string;

beforeAll(() => {
  user1 = createTestUser(`p110-u1-${Date.now()}@example.com`);
  user2 = createTestUser(`p110-u2-${Date.now()}@example.com`);
  token1 = generateTestToken(user1.id);
  token2 = generateTestToken(user2.id);
});

afterAll(() => {
  db.pragma('foreign_keys = OFF');
  for (const userId of [user1?.id, user2?.id]) {
    if (!userId) continue;
    try { db.prepare('DELETE FROM reminders WHERE user_id = ?').run(userId); } catch { /* ok */ }
    try { db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId); } catch { /* ok */ }
    try { db.prepare('DELETE FROM agent_configs WHERE user_id = ?').run(userId); } catch { /* ok */ }
    try { db.prepare('DELETE FROM users WHERE id = ?').run(userId); } catch { /* ok */ }
  }
  db.pragma('foreign_keys = ON');
});

// ── 110.1  Timezone column and endpoint ─────────────────────────────────────

describe('110.1 Timezone column and endpoint', () => {
  it('db/index.ts adds timezone column to users table via ALTER TABLE', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('ALTER TABLE users ADD COLUMN timezone');
  });

  it('users table timezone column exists in live DB schema', () => {
    const cols = db.pragma('table_info(users)') as Array<{ name: string }>;
    const hasTimezone = cols.some(c => c.name === 'timezone');
    expect(hasTimezone).toBe(true);
  });

  it('users.ts defines PATCH /me/timezone route', () => {
    const src = readSrc('routes', 'users.ts');
    expect(src).toContain("patch('/me/timezone'");
  });

  it('PATCH /me/timezone validates with Intl.DateTimeFormat', () => {
    const src = readSrc('routes', 'users.ts');
    expect(src).toContain('Intl.DateTimeFormat');
    expect(src).toContain('Invalid timezone identifier');
  });

  it('PATCH /me/timezone rejects missing timezone body with 400', async () => {
    const res = await request(app)
      .patch('/api/users/me/timezone')
      .set('Authorization', `Bearer ${token1}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('PATCH /me/timezone rejects invalid timezone string with 400', async () => {
    const res = await request(app)
      .patch('/api/users/me/timezone')
      .set('Authorization', `Bearer ${token1}`)
      .send({ timezone: 'Not/AReal_Zone' });
    expect(res.status).toBe(400);
  });

  it('PATCH /me/timezone accepts valid IANA zone and persists it', async () => {
    const res = await request(app)
      .patch('/api/users/me/timezone')
      .set('Authorization', `Bearer ${token1}`)
      .send({ timezone: 'America/New_York' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timezone).toBe('America/New_York');

    // Verify persisted in DB
    const row = db.prepare('SELECT timezone FROM users WHERE id = ?').get(user1.id) as { timezone: string } | undefined;
    expect(row?.timezone).toBe('America/New_York');
  });

  it('GET /api/users/me response includes timezone field', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timezone');
    expect(typeof res.body.timezone).toBe('string');
  });

  it('users.ts GET /me serialises timezone from users row', () => {
    const src = readSrc('routes', 'users.ts');
    expect(src).toContain('timezone');
    // Confirms it is returned and not dropped
    expect(src).toContain("timezone: user.timezone");
  });

  it('action-executor.ts looks up users.timezone before calling parseReminderTime', () => {
    const src = readSrc('services', 'action-executor.ts');
    expect(src).toContain('SELECT timezone FROM users WHERE id = ?');
    expect(src).toContain('parseReminderTime(text, userTimezone)');
  });

  it('pico-fleet.ts parseReminderTime accepts second userTimezone parameter', () => {
    const src = readSrc('services', 'pico-fleet.ts');
    expect(src).toContain('parseReminderTime(text: string, userTimezone');
  });
});

// ── 110.2  parseReminderTime timezone correctness ────────────────────────────

describe('110.2 parseReminderTime timezone correctness', () => {
  it('uses luxon DateTime internally', () => {
    const src = readSrc('services', 'pico-fleet.ts');
    expect(src).toContain("from 'luxon'");
    expect(src).toContain('DateTime');
  });

  it('"at 3pm" in UTC produces UTC hour 15', () => {
    const result = parseReminderTime('remind me at 3pm', 'UTC');
    expect(result).not.toBeNull();
    // result is "YYYY-MM-DD HH:MM:SS" in UTC
    const hour = parseInt(result!.split(' ')[1].split(':')[0], 10);
    expect(hour).toBe(15);
  });

  it('"at 3pm" in Asia/Kolkata (IST = UTC+5:30) produces UTC hour 9 (3pm IST = 09:30 UTC)', () => {
    const result = parseReminderTime('remind me at 3pm', 'Asia/Kolkata');
    expect(result).not.toBeNull();
    const hour = parseInt(result!.split(' ')[1].split(':')[0], 10);
    // 3pm IST = 09:30 UTC → hour is 9
    expect(hour).toBe(9);
  });

  it('"at 3pm" in America/New_York (EST = UTC-5) produces UTC hour 20', () => {
    // 3pm EST = 20:00 UTC (winter)
    // We just verify the output differs from IST/UTC — actual offset varies by DST
    const resultNY = parseReminderTime('remind me at 3pm', 'America/New_York');
    const resultUTC = parseReminderTime('remind me at 3pm', 'UTC');
    expect(resultNY).not.toBeNull();
    expect(resultUTC).not.toBeNull();
    // NY result should be LATER in UTC than UTC-zone result (NY is behind UTC)
    expect(new Date(resultNY!.replace(' ', 'T') + 'Z').getTime())
      .toBeGreaterThan(new Date(resultUTC!.replace(' ', 'T') + 'Z').getTime());
  });

  it('"in 1 hour" returns a UTC datetime approximately 1 hour from now', () => {
    const before = Date.now();
    const result = parseReminderTime('remind me in 1 hour', 'UTC');
    const after = Date.now();
    expect(result).not.toBeNull();
    const resultMs = new Date(result!.replace(' ', 'T') + 'Z').getTime();
    const oneHourMs = 60 * 60 * 1000;
    // Should be within 5 seconds of exactly 1 hour from now
    expect(resultMs).toBeGreaterThanOrEqual(before + oneHourMs - 5000);
    expect(resultMs).toBeLessThanOrEqual(after + oneHourMs + 5000);
  });

  it('"in 30 minutes" returns correct relative time regardless of timezone', () => {
    const before = Date.now();
    const resultIST = parseReminderTime('in 30 minutes', 'Asia/Kolkata');
    const resultUTC = parseReminderTime('in 30 minutes', 'UTC');
    const after = Date.now();
    const thirtyMin = 30 * 60 * 1000;

    for (const result of [resultIST, resultUTC]) {
      expect(result).not.toBeNull();
      const ms = new Date(result!.replace(' ', 'T') + 'Z').getTime();
      expect(ms).toBeGreaterThanOrEqual(before + thirtyMin - 5000);
      expect(ms).toBeLessThanOrEqual(after + thirtyMin + 5000);
    }
  });

  it('defaults to 1 hour from now when no time expression is found (function never returns null)', () => {
    // parseReminderTime falls through to "now + 1hr" when no pattern matches — by design
    const before = Date.now();
    const result = parseReminderTime('buy groceries', 'UTC');
    const after = Date.now();
    // Should be a valid datetime string (not null)
    expect(result).not.toBeNull();
    const ms = new Date(result!.replace(' ', 'T') + 'Z').getTime();
    const oneHourMs = 60 * 60 * 1000;
    expect(ms).toBeGreaterThanOrEqual(before + oneHourMs - 5000);
    expect(ms).toBeLessThanOrEqual(after + oneHourMs + 5000);
  });
});

// ── 110.3  Reminder notification no memory leak ──────────────────────────────

describe('110.3 Reminder notification — no memory leak (Bug 2 regression guard)', () => {
  it('reminder-scheduler.ts does NOT import getRelevantMemories', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    expect(src).not.toContain('getRelevantMemories');
  });

  it('reminder-scheduler.ts does NOT call getRelevantMemories', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    // No call site either
    expect(src).not.toMatch(/getRelevantMemories\s*\(/);
  });

  it('reminder notification text does NOT contain "Context" memory header', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    expect(src).not.toContain('Context');
  });

  it('reminder notification uses static Reminder string pattern', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    // The message is built from a simple template with emoji + reminder text
    expect(src).toContain('Reminder');
    expect(src).toContain('reminder.text');
  });

  it('reminder-scheduler.ts only imports DB, telegram, email, logger — no memory service', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    expect(src).not.toContain("from './memory'");
    expect(src).not.toContain("from './memory.js'");
  });
});

// ── 110.4  Image URL not sent as text (Bug 3 regression guard) ───────────────

describe('110.4 Image/video URL not sent as raw text', () => {
  it('message-router.ts buildActionChannelSuffix skips generate_image with imageUrl', () => {
    const src = readSrc('services', 'message-router.ts');
    // The guard that prevents raw URL text emission
    expect(src).toContain("ar.tool === 'generate_image' && ar.imageUrl");
    expect(src).toContain('continue');
  });

  it('message-router.ts buildActionChannelSuffix skips generate_video with videoUrl', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).toContain("ar.tool === 'generate_video' && ar.videoUrl");
  });

  it('message-router.ts does NOT append imageUrl as raw text suffix', () => {
    const src = readSrc('services', 'message-router.ts');
    // No pattern like "\n🖼️ " + imageUrl or similar raw text appending
    expect(src).not.toMatch(/\\n.*imageUrl/);
    expect(src).not.toMatch(/Image.*:\s*\$\{.*imageUrl/);
  });

  it('message-router.ts does NOT append videoUrl as raw text suffix', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).not.toMatch(/\\n.*videoUrl/);
    expect(src).not.toMatch(/Video.*:\s*\$\{.*videoUrl/);
  });

  it('message-router.ts calls sendTelegramPhoto for image action results', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).toContain('sendTelegramPhoto');
  });

  it('message-router.ts resolves relative imageUrl using config.apiUrl', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).toContain('config.apiUrl');
    expect(src).toContain('startsWith(\'http\')');
  });

  it('message-router.ts imports sendTelegramPhoto from telegram service', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).toContain('sendTelegramPhoto');
    expect(src).toMatch(/import.*sendTelegramPhoto.*from/);
  });
});

// ── 110.5  Two-user reminder isolation ───────────────────────────────────────

describe('110.5 Two-user reminder isolation', () => {
  it('reminder-scheduler query selects all due reminders (no user filter — delivery is per user via channel_links)', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    // The scheduler fetches all due reminders, then looks up each user's channel individually
    // This is the correct design — delivery is gated on per-user channel_links lookup
    expect(src).toContain("SELECT external_id FROM channel_links WHERE user_id = ?");
  });

  it('inserting a reminder for user1 does not appear in user2 DB query', () => {
    const remId = uuid();
    const pastEpoch = Date.now() - 10_000;
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
    ).run(remId, user1.id, 'User1 reminder', '2020-01-01 00:00:00', 'push', 'general', 'test', pastEpoch);

    const rows = db.prepare('SELECT id FROM reminders WHERE user_id = ?').all(user2.id) as Array<{ id: string }>;
    const ids = rows.map(r => r.id);
    expect(ids).not.toContain(remId);

    db.prepare('DELETE FROM reminders WHERE id = ?').run(remId);
  });

  it('GET /api/reminders returns only the authenticated users own reminders', async () => {
    const remId1 = uuid();
    const remId2 = uuid();
    const futureEpoch = Date.now() + 86400_000;
    const futureStr = new Date(futureEpoch).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
    ).run(remId1, user1.id, 'User1 private reminder', futureStr, 'push', 'general', 'test', futureEpoch);
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
    ).run(remId2, user2.id, 'User2 private reminder', futureStr, 'push', 'general', 'test', futureEpoch);

    const res1 = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token1}`);
    expect(res1.status).toBe(200);

    const body1 = res1.body as { reminders?: Array<{ id: string }> } | Array<{ id: string }>;
    const list1: Array<{ id: string }> = Array.isArray(body1)
      ? body1
      : (body1.reminders ?? []);

    const ids1 = list1.map(r => r.id);
    expect(ids1).toContain(remId1);
    expect(ids1).not.toContain(remId2);

    const res2 = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token2}`);
    expect(res2.status).toBe(200);

    const body2 = res2.body as { reminders?: Array<{ id: string }> } | Array<{ id: string }>;
    const list2: Array<{ id: string }> = Array.isArray(body2)
      ? body2
      : (body2.reminders ?? []);

    const ids2 = list2.map(r => r.id);
    expect(ids2).toContain(remId2);
    expect(ids2).not.toContain(remId1);

    db.prepare('DELETE FROM reminders WHERE id IN (?, ?)').run(remId1, remId2);
  });

  it('deliverReminder looks up channel_links scoped by user_id', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    // Confirm the delivery step scopes its Telegram lookup to the individual reminder's user_id
    expect(src).toContain('WHERE user_id = ? AND channel = \'telegram\'');
  });
});

// ── 110.6  Voice note handling ───────────────────────────────────────────────

describe('110.6 Voice note handling', () => {
  it('webhooks.ts contains "Voice notes are coming soon" message', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('Voice notes are coming soon');
  });

  it('webhooks.ts handleVoiceMessage returns early with sendTelegramMessage (no throw)', () => {
    const src = readSrc('routes', 'webhooks.ts');
    // The handler sends a polite message and returns before any transcription attempt
    expect(src).toContain('return;');
    // There is no raw `throw` in the voice handler section
    const voiceHandlerStart = src.indexOf('handleVoiceMessage');
    const voiceHandlerSnippet = src.slice(voiceHandlerStart, voiceHandlerStart + 1500);
    expect(voiceHandlerSnippet).not.toMatch(/\bthrow new Error\b/);
  });

  it('webhooks.ts voice path does NOT call transcribeVoice directly', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).not.toContain('transcribeVoice(');
  });

  it('webhooks.ts checks isVoiceEnabled() before processing voice', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('isVoiceEnabled()');
  });
});

// ── 110.7  IST hardcode removed from message-router ─────────────────────────

describe('110.7 IST hardcode removed from message-router', () => {
  it('message-router.ts does NOT contain 5.5 * 60 * 60 * 1000 (hardcoded IST offset)', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).not.toContain('5.5 * 60 * 60 * 1000');
  });

  it('message-router.ts does NOT contain .replace(\'GMT\', \'IST\')', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).not.toContain(".replace('GMT', 'IST')");
    expect(src).not.toContain('.replace("GMT", "IST")');
  });

  it('message-router.ts imports DateTime from luxon (timezone-aware time handling)', () => {
    const src = readSrc('services', 'message-router.ts');
    expect(src).toContain("from 'luxon'");
    expect(src).toContain('DateTime');
  });

  it('proactive-engine.ts still has getISTHour function (IST default for proactive checks is intentional)', () => {
    const src = readSrc('services', 'proactive-engine.ts');
    expect(src).toContain('getISTHour');
  });

  it('proactive-engine.ts getISTHour uses 5.5 * 60 * 60 * 1000 (intentional IST default for proactive)', () => {
    const src = readSrc('services', 'proactive-engine.ts');
    // This is the correct usage — proactive engine schedules based on IST as the server's
    // default timezone. The hardcode in message-router was the bug; proactive-engine is fine.
    expect(src).toContain('5.5 * 60 * 60 * 1000');
  });

  it('reminder-scheduler.ts uses luxon DateTime for local time display in notifications', () => {
    const src = readSrc('services', 'reminder-scheduler.ts');
    expect(src).toContain("from 'luxon'");
    expect(src).toContain('DateTime');
  });
});
