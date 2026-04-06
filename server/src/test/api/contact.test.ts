import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock contactRouter service BEFORE any other imports
vi.mock('../../services/contact-router.js', () => ({
  notifyUserOfContactRequest: vi.fn(async () => ({ success: true, channel: 'in_app' as const })),
  handleAcceptRequest: vi.fn(async () => ({ success: true, conversationId: 'test-conv-id' })),
  handleDeclineRequest: vi.fn(async () => ({ success: true })),
  getUserChannelStatus: vi.fn(async () => ({ telegram: false, whatsapp: false, email: false })),
  getAvailabilityResponse: vi.fn(async () => 'User is currently unavailable.'),
  isInQuietHours: vi.fn(() => false),
}));

import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { v4 as uuid } from 'uuid';
import { optionalAuth } from '../../middleware/auth.js';

// Ensure test mode is on
(config as Record<string, unknown>).isTestMode = true;

// Import the contact router (after mock is in place)
import { contactRouter } from '../../routes/contact.js';

// Build a minimal Express app that mounts the contact router at /api/contact.
// The contact router is not yet mounted in the main app.ts, so we build a
// dedicated app here. optionalAuth is applied globally so that req.userId is
// populated when an Authorization header is present (the /request endpoint
// reads req.userId without using requireAuth middleware).
function buildApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use(optionalAuth);
  app.use('/api/contact', contactRouter);
  // Error handler to surface errors in test output
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Test app error:', err.message);
    res.status(500).json({ error: err.message });
  });
  return app;
}

const app = buildApp();

// SQL to create the contact-related tables needed for tests.
// These tables are defined in migrations/001_contact_requests.sql but are not
// executed by the main db/index.ts schema initialization.
const CONTACT_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS contact_requests (
    id TEXT PRIMARY KEY,
    from_user_id TEXT,
    from_name TEXT NOT NULL,
    from_phone TEXT,
    from_email TEXT,
    to_user_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('explore', 'portfolio', 'agent_referral')),
    intention TEXT,
    initial_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'timed_out', 'cancelled')),
    decided_at TEXT,
    expires_at TEXT NOT NULL,
    channel_notified TEXT CHECK (channel_notified IN ('telegram', 'whatsapp', 'none')),
    y_response_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_contact_preferences (
    user_id TEXT PRIMARY KEY,
    availability_mode TEXT DEFAULT 'auto_reply_on' CHECK (availability_mode IN ('auto_reply_on', 'auto_reply_off')),
    share_availability_level TEXT DEFAULT 'preferences_only' CHECK (share_availability_level IN ('none', 'coarse', 'preferences_only')),
    default_response_template TEXT DEFAULT 'I''m currently unavailable. I''ll respond when I can.',
    quiet_hours_start INTEGER,
    quiet_hours_end INTEGER,
    working_hours_start INTEGER DEFAULT 9,
    working_hours_end INTEGER DEFAULT 18,
    allow_guest_contacts INTEGER DEFAULT 1,
    require_mutual_connection INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contact_request_audit (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'channel_notified', 'viewed_by_y', 'accepted', 'declined', 'timed_out', 'cancelled', 'message_sent')),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'x_user', 'y_user', 'agent')),
    actor_id TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES contact_requests(id) ON DELETE CASCADE
  );
`;

// Helpers
let requester: { id: string; email: string; username: string; password: string };
let target: { id: string; email: string; username: string; password: string };

function cleanContactData() {
  db.pragma('foreign_keys = OFF');
  try {
    for (const table of ['contact_request_audit', 'contact_requests', 'user_contact_preferences']) {
      try { db.prepare(`DELETE FROM ${table}`).run(); } catch { /* ignore */ }
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

describe('Contact Route Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
    // Ensure contact tables exist (they are not created by the main schema)
    db.exec(CONTACT_TABLES_SQL);
  });

  beforeEach(() => {
    cleanContactData();
    // Also clear users, then re-create fresh test users
    resetDatabase();
    // Re-create contact tables after resetDatabase clears everything
    db.exec(CONTACT_TABLES_SQL);
    requester = createTestUser(`requester-${Date.now()}@test.com`);
    target = createTestUser(`target-${Date.now()}@test.com`);
  });

  // ── 1. POST /api/contact/request — creates pending request (authenticated) ──
  describe('POST /api/contact/request', () => {
    it('creates a pending contact request when authenticated', async () => {
      const res = await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: target.id, source: 'explore' })
        .expect(201);

      expect(res.body).toHaveProperty('requestId');
      expect(res.body.status).toBe('pending');
      expect(res.body.nextStep).toBe('waiting_for_accept');
      expect(res.body).toHaveProperty('expiresAt');

      // Verify DB row
      const row = db.prepare('SELECT * FROM contact_requests WHERE id = ?').get(res.body.requestId) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.to_user_id).toBe(target.id);
      expect(row.from_user_id).toBe(requester.id);
      expect(row.status).toBe('pending');
    });

    // ── 2. Returns 400 without required fields ──
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({})
        .expect(400);

      expect(res.body.error).toMatch(/Missing required fields/);
    });

    // ── 3. Returns 404 for non-existent target user ──
    it('returns 404 when target user does not exist', async () => {
      const res = await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: 'nonexistent-user-id', source: 'explore' })
        .expect(404);

      expect(res.body.error).toMatch(/User not found/);
    });

    // ── 4. Returns 409 for duplicate pending request ──
    it('returns 409 for duplicate pending request', async () => {
      // Create the first request
      await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: target.id, source: 'explore' })
        .expect(201);

      // Try to create a duplicate
      const res = await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: target.id, source: 'explore' })
        .expect(409);

      expect(res.body.error).toMatch(/pending request already exists/);
      expect(res.body).toHaveProperty('requestId');
      expect(res.body.status).toBe('pending');
    });
  });

  // ── 5. GET /api/contact/:id/status — returns request info ──
  describe('GET /api/contact/:id/status', () => {
    it('returns request status and toUser info', async () => {
      // Create a contact request
      const createRes = await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: target.id, source: 'explore' })
        .expect(201);

      const requestId = createRes.body.requestId;

      const res = await request(app)
        .get(`/api/contact/${requestId}/status`)
        .expect(200);

      expect(res.body.requestId).toBe(requestId);
      expect(res.body.status).toBe('pending');
      expect(res.body.toUser).toBeDefined();
      expect(res.body.toUser).toHaveProperty('name');
    });

    // ── 6. Returns 404 for non-existent request ──
    it('returns 404 for non-existent request id', async () => {
      const fakeId = uuid();
      const res = await request(app)
        .get(`/api/contact/${fakeId}/status`)
        .expect(404);

      expect(res.body.error).toMatch(/Request not found/);
    });
  });

  // ── 7. GET /api/contact/incoming — lists pending requests ──
  describe('GET /api/contact/incoming', () => {
    it('lists pending incoming requests for the target user', async () => {
      // Create a contact request to the target
      await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: target.id, source: 'portfolio', intention: 'collaboration' })
        .expect(201);

      const res = await request(app)
        .get('/api/contact/incoming')
        .set('Authorization', makeAuthHeader(target.id))
        .expect(200);

      expect(res.body).toHaveProperty('requests');
      expect(res.body.requests).toBeInstanceOf(Array);
      expect(res.body.requests.length).toBe(1);
      expect(res.body.requests[0]).toHaveProperty('id');
      expect(res.body.requests[0].source).toBe('portfolio');
    });
  });

  // ── 8. GET /api/contact/preferences — creates defaults ──
  describe('GET /api/contact/preferences', () => {
    it('creates and returns default preferences when none exist', async () => {
      const res = await request(app)
        .get('/api/contact/preferences')
        .set('Authorization', makeAuthHeader(target.id))
        .expect(200);

      expect(res.body).toHaveProperty('user_id', target.id);
      expect(res.body).toHaveProperty('availability_mode', 'auto_reply_on');
      expect(res.body).toHaveProperty('allow_guest_contacts', 1);
    });
  });

  // ── 9. PUT /api/contact/preferences — updates prefs ──
  describe('PUT /api/contact/preferences', () => {
    it('updates contact preferences', async () => {
      // First create defaults by GET
      await request(app)
        .get('/api/contact/preferences')
        .set('Authorization', makeAuthHeader(target.id))
        .expect(200);

      // Now update
      const res = await request(app)
        .put('/api/contact/preferences')
        .set('Authorization', makeAuthHeader(target.id))
        .send({
          availabilityMode: 'auto_reply_off',
          allowGuestContacts: 0,
          quietHoursStart: 22,
          quietHoursEnd: 7,
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify persisted
      const prefs = db.prepare('SELECT * FROM user_contact_preferences WHERE user_id = ?').get(target.id) as Record<string, unknown>;
      expect(prefs.availability_mode).toBe('auto_reply_off');
      expect(prefs.allow_guest_contacts).toBe(0);
      expect(prefs.quiet_hours_start).toBe(22);
      expect(prefs.quiet_hours_end).toBe(7);
    });
  });

  // ── 10. POST /api/contact/:id/accept — returns success ──
  describe('POST /api/contact/:id/accept', () => {
    it('accepts a contact request and returns conversationId', async () => {
      // Create a contact request
      const createRes = await request(app)
        .post('/api/contact/request')
        .set('Authorization', makeAuthHeader(requester.id))
        .send({ toUserId: target.id, source: 'explore' })
        .expect(201);

      const requestId = createRes.body.requestId;

      // Accept as the target user
      const res = await request(app)
        .post(`/api/contact/${requestId}/accept`)
        .set('Authorization', makeAuthHeader(target.id))
        .send({ responseMessage: 'Sure, let us connect!' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.conversationId).toBe('test-conv-id');
      expect(res.body.redirectUrl).toContain('test-conv-id');
    });
  });
});
