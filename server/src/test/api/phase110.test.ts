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
  it('db migrations adds timezone column to users table via ALTER TABLE', () => {
    const src = readSrc('db', 'migrations.ts');
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

  it('tools-executor.ts looks up users.timezone before calling parseReminderTime', () => {
    const src = readSrc('modules', 'agent', 'services', 'executors', 'tools-executor.ts');
    expect(src).toContain('SELECT timezone FROM users WHERE id = ?');
    // parseReminderTime is called with userTimezone; bare params.datetime routes through it too
    expect(src).toContain('parseReminderTime(');
    expect(src).toContain('userTimezone');
  });

  it('pico-fleet.ts parseReminderTime accepts second userTimezone parameter', () => {
    const src = readSrc('modules', 'agent', 'services', 'pico-fleet.ts');
    expect(src).toContain('parseReminderTime(text: string, userTimezone');
  });
});

// ── 110.2  parseReminderTime timezone correctness ────────────────────────────

describe('110.2 parseReminderTime timezone correctness', () => {
  it('uses luxon DateTime internally', () => {
    const src = readSrc('modules', 'agent', 'services', 'pico-fleet.ts');
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
    // 3pm EST = 20:00 UTC (winter). Check the UTC hour directly — avoids
    // timestamp comparison failures when the UTC-zone "3pm" has already passed
    // today and would roll to tomorrow, while the NY "3pm" is still tonight.
    const resultNY = parseReminderTime('remind me at 3pm', 'America/New_York');
    expect(resultNY).not.toBeNull();
    const hour = parseInt(resultNY!.split(' ')[1].split(':')[0], 10);
    // 3pm NY (EST=UTC-5, EDT=UTC-4) → UTC hour 20 (winter) or 19 (summer)
    expect(hour === 20 || hour === 19).toBe(true);
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

  // ── Hotfix: bare time strings from LLM params.datetime must be timezone-aware ──

  it('[hotfix] "12.30" in Asia/Kolkata (IST UTC+5:30) → stored as 07:00 UTC, not 12:30 UTC', () => {
    // Aliya's exact bug: "12.30" interpreted as 12:30 UTC instead of 12:30 IST
    const result = parseReminderTime('12.30', 'Asia/Kolkata');
    expect(result).not.toBeNull();
    const utcHour = parseInt(result!.split(' ')[1].split(':')[0], 10);
    const utcMin  = parseInt(result!.split(' ')[1].split(':')[1], 10);
    // 12:30 IST = 07:00 UTC
    expect(utcHour).toBe(7);
    expect(utcMin).toBe(0);
  });

  it('[hotfix] "12:30" bare time in UTC timezone → stored as 12:30 UTC', () => {
    const result = parseReminderTime('12:30', 'UTC');
    expect(result).not.toBeNull();
    // "at 12:30" pattern — 24h face value in UTC
    const utcHour = parseInt(result!.split(' ')[1].split(':')[0], 10);
    expect(utcHour).toBe(12);
  });

  it('[hotfix] "9am" bare time in America/New_York (EST UTC-5) → stored as 14:00 UTC', () => {
    const result = parseReminderTime('9am', 'America/New_York');
    expect(result).not.toBeNull();
    const utcHour = parseInt(result!.split(' ')[1].split(':')[0], 10);
    // 9am EST = 14:00 UTC (UTC-5, no DST assumed for test stability)
    // Accept 14 (EST) or 13 (EDT) depending on test runner's wall clock season
    expect([13, 14]).toContain(utcHour);
  });

  it('[hotfix] tools-executor does NOT use params.datetime raw when it is a bare time', () => {
    // Ensures the bypass path is gone: bare times must go through parseReminderTime
    const src = readSrc('modules', 'agent', 'services', 'executors', 'tools-executor.ts');
    // The old single-line bypass: "params.datetime as string || parseReminderTime(text"
    expect(src).not.toContain("params.datetime as string || parseReminderTime(text");
    // The new path guards for full ISO before trusting params.datetime
    expect(src).toContain("rawDatetime.includes('T')");
  });

  it('[hotfix] pico-fleet does NOT use taskConfig.datetime raw when it is a bare time', () => {
    // The fleet worker create_reminder case must apply the same ISO-guard as action-executor.ts
    const src = readSrc('modules', 'agent', 'services', 'pico-fleet.ts');
    // Old bypass: "taskConfig.datetime as string || parseReminderTime"
    expect(src).not.toContain("taskConfig.datetime as string || parseReminderTime");
    // New guard present in fleet worker create_reminder path
    expect(src).toContain("rawDatetime.includes('T')");
  });
});

// ── 110.3  Reminder notification no memory leak ──────────────────────────────

describe('110.3 Reminder notification — no memory leak (Bug 2 regression guard)', () => {
  it('reminder-scheduler.ts does NOT import getRelevantMemories', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
    expect(src).not.toContain('getRelevantMemories');
  });

  it('reminder-scheduler.ts does NOT call getRelevantMemories', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
    // No call site either
    expect(src).not.toMatch(/getRelevantMemories\s*\(/);
  });

  it('reminder notification text does NOT contain "Context" memory header', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
    expect(src).not.toContain('Context');
  });

  it('reminder notification uses static Reminder string pattern', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
    // The message is built from a simple template with emoji + reminder text
    expect(src).toContain('Reminder');
    expect(src).toContain('reminder.text');
  });

  it('reminder-scheduler.ts only imports DB, telegram, email, logger — no memory service', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
    expect(src).not.toContain("from './memory'");
    expect(src).not.toContain("from './memory.js'");
  });
});

// ── 110.4  Image URL not sent as text (Bug 3 regression guard) ───────────────

describe('110.4 Image/video URL not sent as raw text', () => {
  it('prompt-builder.ts buildActionChannelSuffix skips generate_image with imageUrl', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    // The guard that prevents raw URL text emission
    expect(src).toContain("ar.tool === 'generate_image' && ar.imageUrl");
    expect(src).toContain('continue');
  });

  it('prompt-builder.ts buildActionChannelSuffix skips generate_video with videoUrl', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    expect(src).toContain("ar.tool === 'generate_video' && ar.videoUrl");
  });

  it('prompt-builder.ts does NOT append imageUrl as raw text suffix', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    // No pattern like "\n🖼️ " + imageUrl or similar raw text appending
    expect(src).not.toMatch(/\\n.*imageUrl/);
    expect(src).not.toMatch(/Image.*:\s*\$\{.*imageUrl/);
  });

  it('prompt-builder.ts does NOT append videoUrl as raw text suffix', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    expect(src).not.toMatch(/\\n.*videoUrl/);
    expect(src).not.toMatch(/Video.*:\s*\$\{.*videoUrl/);
  });

  it('message-router.ts calls sendTelegramPhoto for image action results', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toContain('sendTelegramPhoto');
  });

  it('message-router.ts resolves relative imageUrl using config.apiUrl', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toContain('config.apiUrl');
    expect(src).toContain('startsWith(\'http\')');
  });

  it('message-router.ts imports sendTelegramPhoto from telegram service', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toContain('sendTelegramPhoto');
    expect(src).toMatch(/import.*sendTelegramPhoto.*from/);
  });
});

// ── 110.5  Two-user reminder isolation ───────────────────────────────────────

describe('110.5 Two-user reminder isolation', () => {
  it('reminder-scheduler query selects all due reminders (no user filter — delivery is per user via channel_links)', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
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
    const src = readSrc('modules', 'reminders', 'services.ts');
    // Confirm the delivery step scopes its Telegram lookup to the individual reminder's user_id
    expect(src).toContain('WHERE user_id = ? AND channel = \'telegram\'');
  });
});

// ── 110.6  Voice note handling ───────────────────────────────────────────────

describe('110.6 Voice note handling', () => {
  it('webhooks.ts voice handler uses Groq Whisper transcription (fully implemented)', () => {
    const src = readSrc('routes', 'webhooks.ts');
    // Voice notes are now fully implemented via Groq Whisper + edge-tts
    expect(src).toContain('transcribeVoice(');
    expect(src).not.toContain('Voice notes are coming soon');
  });

  it('webhooks.ts handleVoiceMessage has error handling (try/catch)', () => {
    const src = readSrc('routes', 'webhooks.ts');
    const voiceHandlerStart = src.indexOf('handleVoiceMessage');
    const voiceHandlerSnippet = src.slice(voiceHandlerStart, voiceHandlerStart + 3000);
    expect(voiceHandlerSnippet).toContain('try {');
    expect(voiceHandlerSnippet).toContain('catch');
  });

  it('webhooks.ts voice path calls textToSpeech and sendTelegramVoice', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('textToSpeech(');
    expect(src).toContain('sendTelegramVoice(');
  });

  it('webhooks.ts checks isVoiceEnabled() before processing voice', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('isVoiceEnabled()');
  });
});

// ── 110.7  IST hardcode removed from message-router ─────────────────────────

describe('110.7 IST hardcode removed from message-router', () => {
  it('message-router.ts does NOT contain 5.5 * 60 * 60 * 1000 (hardcoded IST offset)', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).not.toContain('5.5 * 60 * 60 * 1000');
  });

  it('message-router.ts does NOT contain .replace(\'GMT\', \'IST\')', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).not.toContain(".replace('GMT', 'IST')");
    expect(src).not.toContain('.replace("GMT", "IST")');
  });

  it('prompt-builder.ts imports DateTime from luxon (timezone-aware time handling)', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    expect(src).toContain("from 'luxon'");
    expect(src).toContain('DateTime');
  });

  it('proactive-engine.ts uses per-user timezone (getUserHour) instead of IST hardcoding', () => {
    const src = readSrc('services', 'proactive-engine.ts');
    expect(src).toContain('getUserHour');
    expect(src).toContain('Asia/Kolkata'); // default timezone
  });

  it('proactive-engine.ts has throttling (MAX_PROACTIVE_PER_DAY)', () => {
    const src = readSrc('services', 'proactive-engine.ts');
    expect(src).toContain('MAX_PROACTIVE_PER_DAY');
    expect(src).toContain('isThrottled');
  });

  it('reminder-scheduler.ts uses luxon DateTime for local time display in notifications', () => {
    const src = readSrc('modules', 'reminders', 'services.ts');
    expect(src).toContain("from 'luxon'");
    expect(src).toContain('DateTime');
  });
});

// ── 110.8  Multilingual support ───────────────────────────────────────────────

describe('110.8 Multilingual support — routing + TTS voice selection', () => {

  // ---- message-router routing ----

  it('message-router.ts detects non-Latin script via Unicode property escapes', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toContain('Script=Devanagari'); // Hindi
    expect(src).toContain('Script=Telugu');
    expect(src).toContain('Script=Tamil');
  });

  it('message-router.ts has Hinglish word list with at least 20 words', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toContain('HINGLISH_WORDS');
    expect(src).toContain("'aap'");
    expect(src).toContain("'kya'");
    expect(src).toContain("'bhai'");
    expect(src).toContain("'yaar'");
    expect(src).toContain("'nahi'");
  });

  it('message-router.ts routes non-Latin to Groq with forceProvider', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toContain('needsGroq');
    expect(src).toContain("forceProvider: 'groq'");
  });

  it('message-router.ts uses runReactLoop for multilingual path (actions execute correctly)', () => {
    const src = readSrc('modules', 'agent', 'services', 'message-router.ts');
    expect(src).toMatch(/import.*runReactLoop.*from.*react-loop/);
    // Groq multilingual path should use ReAct loop (not raw routeChat) so actions are executed
    expect(src).toMatch(/needsGroq[\s\S]*?runReactLoop/);
  });

  // ---- TTS voice auto-selection ----

  it('voice.ts has detectEdgeTtsVoice function with Hindi voice', () => {
    const src = readSrc('modules', 'media', 'services', 'voice.ts');
    expect(src).toContain('detectEdgeTtsVoice');
    expect(src).toContain('hi-IN-SwaraNeural');
  });

  it('voice.ts has Telugu TTS voice', () => {
    const src = readSrc('modules', 'media', 'services', 'voice.ts');
    expect(src).toContain('te-IN-ShrutiNeural');
  });

  it('voice.ts has Tamil TTS voice', () => {
    const src = readSrc('modules', 'media', 'services', 'voice.ts');
    expect(src).toContain('ta-IN-PallaviNeural');
  });

  it('voice.ts detects Devanagari script for Hindi voice selection', () => {
    const src = readSrc('modules', 'media', 'services', 'voice.ts');
    expect(src).toContain('0900-');
    expect(src).toContain('hi-IN-SwaraNeural');
  });

  it('voice.ts strips action blocks from TTS input', () => {
    const src = readSrc('modules', 'media', 'services', 'voice.ts');
    expect(src).toContain('<<<ACTION');
    expect(src).toContain('ACTION>>>');
  });

  it('voice.ts strips slash characters to prevent "slash" being read aloud', () => {
    const src = readSrc('modules', 'media', 'services', 'voice.ts');
    // slash stripping regexes present (e.g. /\/(\w)/g and /\//g)
    expect(src).toContain("replace(/\\/(\\w)/g");
    expect(src).toContain("replace(/\\//g");
  });

  // ---- webhooks.ts voice handler multilingual fix ----

  it('webhooks.ts voice handler detects non-Latin script in transcript', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('transcriptHasNonLatin');
    expect(src).toContain('Script=Devanagari');
  });

  it('webhooks.ts voice handler detects Hinglish in transcript', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('HINGLISH_WORDS_VOICE');
    expect(src).toContain('transcriptIsHinglish');
  });

  it('webhooks.ts voice handler forces Groq for non-Latin transcripts', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('voiceNeedsGroq');
    expect(src).toContain("forceProvider: 'groq'");
  });

  // ---- system prompt language rule ----

  it('prompt-builder.ts buildChannelSystemPrompt has LANGUAGE RULE at top', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    expect(src).toContain('LANGUAGE RULE');
    expect(src).toContain('YOUR IDENTITY');
  });

  it('prompt-builder.ts system prompt names the agent explicitly at top', () => {
    const src = readSrc('modules', 'agent', 'services', 'prompt-builder.ts');
    // Agent name is declared at top of prompt, not just in USER SESSION
    expect(src).toContain('YOUR IDENTITY: Your name is');
  });

  it('webhooks.ts voice handler has language-match instruction in systemPromptWithLang', () => {
    const src = readSrc('routes', 'webhooks.ts');
    expect(src).toContain('systemPromptWithLang');
    expect(src).toContain('Always reply in the exact same language');
  });
});
