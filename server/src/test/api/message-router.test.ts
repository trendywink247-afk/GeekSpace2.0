// ============================================================
// Message Router Unit Tests
// Tests the channel reply builder (action dedup + URL appending)
// and the reminder snooze PATCH endpoint.
// Pure function tests — no DB or external deps for action dedup.
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { buildActionChannelSuffix } from '../../services/message-router.js';
import type { ActionResult } from '../../services/action-executor.js';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

// ── buildActionChannelSuffix — pure function tests ──────────────

describe('buildActionChannelSuffix', () => {
  it('returns finalReply unchanged when no action results', () => {
    const result = buildActionChannelSuffix('Hello world', []);
    expect(result).toBe('Hello world');
  });

  it('skips failed actions', () => {
    const ar: ActionResult = { tool: 'set_reminder', success: false, message: 'Failed' };
    const result = buildActionChannelSuffix('Some reply', [ar]);
    expect(result).toBe('Some reply');
  });

  it('appends generate_image URL with emoji', () => {
    const ar: ActionResult = {
      tool: 'generate_image',
      success: true,
      message: 'Image generated',
      imageUrl: 'https://cdn.example.com/img/abc123.png',
    };
    const result = buildActionChannelSuffix('Here is your image!', [ar]);
    expect(result).toContain('🖼️ https://cdn.example.com/img/abc123.png');
  });

  it('appends generate_video URL with emoji', () => {
    const ar: ActionResult = {
      tool: 'generate_video',
      success: true,
      message: 'Video started',
      videoUrl: 'https://cdn.example.com/vid/xyz.mp4',
      data: { estimatedTime: 30 },
    };
    const result = buildActionChannelSuffix('Your video is being generated.', [ar]);
    expect(result).toContain('🎬 Video: https://cdn.example.com/vid/xyz.mp4');
    expect(result).toContain('renders in ~30s');
  });

  it('does not append estimatedTime when it is 0', () => {
    const ar: ActionResult = {
      tool: 'generate_video',
      success: true,
      message: 'Video started',
      videoUrl: 'https://cdn.example.com/vid/xyz.mp4',
      data: { estimatedTime: 0 },
    };
    const result = buildActionChannelSuffix('Generating.', [ar]);
    expect(result).not.toContain('renders in');
  });

  it('appends generate_code preview URL when artifactId and previewUrl present', () => {
    const ar: ActionResult = {
      tool: 'generate_code',
      success: true,
      message: 'Code generated',
      artifactId: 'art-001',
      previewUrl: 'https://api.example.com/preview/art-001',
    };
    const result = buildActionChannelSuffix('Built your page!', [ar]);
    expect(result).toContain('🔗 Preview: https://api.example.com/preview/art-001');
    expect(result).toContain('Also saved to your Projects');
  });

  it('appends "saved to dashboard" when generate_code has artifactId but no previewUrl', () => {
    const ar: ActionResult = {
      tool: 'generate_code',
      success: true,
      message: 'Code saved',
      artifactId: 'art-002',
    };
    const result = buildActionChannelSuffix('Done!', [ar]);
    expect(result).toContain('Saved to your Projects');
    expect(result).not.toContain('🔗 Preview');
  });

  it('skips generate_code without artifactId entirely', () => {
    const ar: ActionResult = { tool: 'generate_code', success: true, message: 'Done' };
    const result = buildActionChannelSuffix('Done!', [ar]);
    // No preview link, no projects link — just the original reply
    expect(result).toBe('Done!');
  });

  it('appends set_reminder confirmation when not already in reply (dedup miss)', () => {
    const ar: ActionResult = {
      tool: 'set_reminder',
      success: true,
      message: 'Reminder set: "Check email"',
    };
    const result = buildActionChannelSuffix('Sure, I can help!', [ar]);
    expect(result).toContain('✅ Reminder set: "Check email"');
  });

  it('deduplicates: skips confirmation already present in finalReply', () => {
    const confirmationMsg = 'Reminder set: "Check email"';
    const ar: ActionResult = {
      tool: 'set_reminder',
      success: true,
      message: confirmationMsg,
    };
    // LLM already echoed the confirmation in its text
    const finalReply = `Done! ${confirmationMsg}`;
    const result = buildActionChannelSuffix(finalReply, [ar]);
    // Should NOT have a second copy of the message
    const occurrences = (result.match(/Reminder set: "Check email"/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('deduplicates: skips second identical confirmation from two actions', () => {
    const ar1: ActionResult = { tool: 'set_reminder', success: true, message: 'Reminder set: "A"' };
    const ar2: ActionResult = { tool: 'set_reminder', success: true, message: 'Reminder set: "A"' };
    const result = buildActionChannelSuffix('Reply', [ar1, ar2]);
    const occurrences = (result.match(/Reminder set: "A"/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('appends both image and video URLs when both actions succeed', () => {
    const arImg: ActionResult = {
      tool: 'generate_image',
      success: true,
      message: 'Image done',
      imageUrl: 'https://img.example.com/1.png',
    };
    const arVid: ActionResult = {
      tool: 'generate_video',
      success: true,
      message: 'Video done',
      videoUrl: 'https://vid.example.com/1.mp4',
      data: { estimatedTime: 15 },
    };
    const result = buildActionChannelSuffix('Generating both!', [arImg, arVid]);
    expect(result).toContain('🖼️ https://img.example.com/1.png');
    expect(result).toContain('🎬 Video: https://vid.example.com/1.mp4');
  });
});

// ── Reminder snooze PATCH endpoint ──────────────────────────────

const app = createApp();

describe('PATCH /api/reminders/:id (snooze)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('updates reminder datetime (snooze)', async () => {
    const user = createTestUser();

    const remId = uuid();
    db.prepare(`
      INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
      VALUES (?, ?, ?, datetime('now', '+1 hour'), 'push', 'personal', 0, 'user')
    `).run(remId, user.id, 'Test snooze reminder');

    const newDatetime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h

    const response = await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ datetime: newDatetime })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('datetime');
    // The returned datetime should reflect the update (SQLite may store in different format)
    const returned = new Date(response.body.datetime).getTime();
    const expected = new Date(newDatetime).getTime();
    expect(Math.abs(returned - expected)).toBeLessThan(2000); // within 2s

    cleanupTestUser(user.id);
  });

  it('cannot snooze another user\'s reminder', async () => {
    const owner = createTestUser();
    const attacker = createTestUser(`attacker-${Date.now()}@example.com`);

    const remId = uuid();
    db.prepare(`
      INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
      VALUES (?, ?, ?, datetime('now', '+1 hour'), 'push', 'personal', 0, 'user')
    `).run(remId, owner.id, 'Private reminder');

    await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(attacker.id))
      .send({ datetime: new Date().toISOString() })
      .expect(404);

    cleanupTestUser(owner.id);
    cleanupTestUser(attacker.id);
  });

  it('requires authentication to snooze', async () => {
    await request(app)
      .patch('/api/reminders/fake-id')
      .send({ datetime: new Date().toISOString() })
      .expect(401);
  });
});
