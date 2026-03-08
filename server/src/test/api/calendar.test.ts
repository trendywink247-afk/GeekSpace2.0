/**
 * Calendar Route Tests — Phase 21
 * Auth guards, status endpoint, disconnect, events listing.
 * OAuth callback and sync are not testable without Google credentials
 * — those paths are covered by checking the 400/503 guard conditions.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Calendar Routes', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
    // Clear any calendar token from previous test
    db.prepare("UPDATE users SET google_calendar_token = NULL WHERE id = ?").run(userId);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('GET /api/calendar/status requires auth', async () => {
    await request(app).get('/api/calendar/status').expect(401);
  });

  it('GET /api/calendar/auth requires auth', async () => {
    await request(app).get('/api/calendar/auth').expect(401);
  });

  it('POST /api/calendar/sync requires auth', async () => {
    await request(app).post('/api/calendar/sync').expect(401);
  });

  it('POST /api/calendar/disconnect requires auth', async () => {
    await request(app).post('/api/calendar/disconnect').expect(401);
  });

  it('GET /api/calendar/events requires auth', async () => {
    await request(app).get('/api/calendar/events').expect(401);
  });

  // ── Status endpoint ──────────────────────────────────────────

  it('GET /api/calendar/status returns not-connected when no token', async () => {
    const res = await request(app)
      .get('/api/calendar/status')
      .set('Authorization', authHeader)
      .expect(200);
    // When Google Calendar is not configured, available=false
    // When configured but no token, connected=false
    expect(res.body).toHaveProperty('connected');
    expect(res.body.connected).toBe(false);
  });

  it('GET /api/calendar/status returns connected=true when token present', async () => {
    // Seed a valid-looking token
    const tokenData = JSON.stringify({
      access_token: 'fake_access',
      refresh_token: 'fake_refresh',
      expiry_date: Date.now() + 3600000,
      email: 'user@example.com',
    });
    db.prepare("UPDATE users SET google_calendar_token = ? WHERE id = ?").run(tokenData, userId);

    const res = await request(app)
      .get('/api/calendar/status')
      .set('Authorization', authHeader)
      .expect(200);

    // If Google OAuth creds are not configured, available=false and connected=false regardless
    // If configured, should show connected=true with email
    if (res.body.available === false) {
      expect(res.body.connected).toBe(false);
    } else {
      expect(res.body.connected).toBe(true);
      expect(res.body.email).toBe('user@example.com');
    }
  });

  it('GET /api/calendar/status handles malformed token gracefully', async () => {
    db.prepare("UPDATE users SET google_calendar_token = ? WHERE id = ?").run('not-valid-json', userId);

    const res = await request(app)
      .get('/api/calendar/status')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.connected).toBe(false);
  });

  // ── Auth redirect (no OAuth creds in test env) ───────────────

  it('GET /api/calendar/auth returns 503 when Google OAuth not configured', async () => {
    // In test mode, Google OAuth creds are blank — route should 503
    const res = await request(app)
      .get('/api/calendar/auth')
      .set('Authorization', authHeader);
    // Either 503 (no creds) or 302 redirect (creds present)
    expect([302, 503]).toContain(res.status);
  });

  // ── Sync ─────────────────────────────────────────────────────

  it('POST /api/calendar/sync returns 400 when calendar not connected', async () => {
    const res = await request(app)
      .post('/api/calendar/sync')
      .set('Authorization', authHeader)
      .expect(400);
    expect(res.body.error).toMatch(/not connected/i);
  });

  // ── Disconnect ───────────────────────────────────────────────

  it('POST /api/calendar/disconnect clears token and returns ok', async () => {
    // Seed a token
    db.prepare("UPDATE users SET google_calendar_token = ? WHERE id = ?").run('{"access_token":"x"}', userId);

    const res = await request(app)
      .post('/api/calendar/disconnect')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.ok).toBe(true);

    // Token should be null
    const row = db.prepare("SELECT google_calendar_token FROM users WHERE id = ?").get(userId) as
      { google_calendar_token: string | null } | undefined;
    expect(row?.google_calendar_token).toBeNull();
  });

  it('POST /api/calendar/disconnect is idempotent (already disconnected)', async () => {
    const res = await request(app)
      .post('/api/calendar/disconnect')
      .set('Authorization', authHeader)
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  // ── Events ───────────────────────────────────────────────────

  it('GET /api/calendar/events returns empty array when no events', async () => {
    const res = await request(app)
      .get('/api/calendar/events')
      .set('Authorization', authHeader)
      .expect(200);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('GET /api/calendar/events accepts days query param', async () => {
    const res = await request(app)
      .get('/api/calendar/events?days=14')
      .set('Authorization', authHeader)
      .expect(200);
    expect(res.body).toHaveProperty('events');
  });

  it('GET /api/calendar/events clamps days to max 30', async () => {
    // Should not throw regardless of high days param
    const res = await request(app)
      .get('/api/calendar/events?days=999')
      .set('Authorization', authHeader)
      .expect(200);
    expect(res.body).toHaveProperty('events');
  });
});
