# Phase 74 — Test Coverage Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dedicated test suites for the 5 highest-risk untested routes, plus Vite chunk splitting and ops cleanup.

**Architecture:** Each route gets a dedicated `server/src/test/api/<name>.test.ts` file following the existing supertest + test DB pattern. External services (Telegram, WhatsApp, contactRouter) are mocked using `vi.mock()`. OAuth tests use Passport strategy mocking.

**Tech Stack:** Vitest, supertest, vi.mock, better-sqlite3 test DB, Express createApp()

---

### Task 1: CI Baseline Verification (74.1)

**Files:**
- None modified

**Step 1: Verify all tests pass**

Run: `cd /root/GeekSpace2.0/server && npm test`
Expected: 760 passed (760)

**Step 2: Verify lint + typecheck + build**

Run: `cd /root/GeekSpace2.0 && npm run lint && npx tsc --noEmit && cd server && npx tsc --noEmit && npm run build`
Expected: All clean, 0 warnings

**Step 3: Create branch**

```bash
cd /root/GeekSpace2.0
git checkout -b ai/phase-20260226-phase74
```

---

### Task 2: API Keys Tests (74.2)

**Files:**
- Create: `server/src/test/api/api-keys.test.ts`
- Reference: `server/src/routes/apiKeys.ts`

**Step 1: Write the test file**

```typescript
/**
 * API Keys Route Tests
 * CRUD operations, key rotation, default toggle, auth guard.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('API Keys', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
    // Clean api_keys for this user
    db.prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
  });

  // ── GET / — list keys ──────────────────────────────────────────────────────

  it('GET /api/api-keys returns empty array when no keys', async () => {
    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', authHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /api/api-keys requires auth', async () => {
    await request(app)
      .get('/api/api-keys')
      .expect(401);
  });

  // ── POST / — create key ────────────────────────────────────────────────────

  it('POST /api/api-keys creates a key and masks it', async () => {
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', label: 'My Key', key: 'sk-abcdefghijklmnop1234' })
      .expect(201);

    expect(res.body.provider).toBe('openai');
    expect(res.body.maskedKey).toBe('sk-...1234');
    expect(res.body.isDefault).toBe(true); // first key is default
    // key_encrypted should NOT be in response
    expect(res.body.key_encrypted).toBeUndefined();
  });

  it('POST second key is not default', async () => {
    await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-firstkeyvalue12345678' })
      .expect(201);

    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'anthropic', key: 'sk-ant-secondvalue123456' })
      .expect(201);

    expect(res.body.isDefault).toBe(false);
  });

  // ── DELETE /:id ─────────────────────────────────────────────────────────────

  it('DELETE /api/api-keys/:id removes key', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-deleteme123456789012' })
      .expect(201);

    await request(app)
      .delete(`/api/api-keys/${create.body.id}`)
      .set('Authorization', authHeader)
      .expect(200);

    const list = await request(app)
      .get('/api/api-keys')
      .set('Authorization', authHeader)
      .expect(200);

    expect(list.body.length).toBe(0);
  });

  it('DELETE /api/api-keys/:id returns 404 for wrong user', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-otherperson12345678' })
      .expect(201);

    const otherUser = createTestUser();
    await request(app)
      .delete(`/api/api-keys/${create.body.id}`)
      .set('Authorization', makeAuthHeader(otherUser.id))
      .expect(404);
  });

  // ── POST /:id/rotate ───────────────────────────────────────────────────────

  it('POST /api/api-keys/:id/rotate updates masked key', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-originalkey1234567890' })
      .expect(201);

    const res = await request(app)
      .post(`/api/api-keys/${create.body.id}/rotate`)
      .set('Authorization', authHeader)
      .send({ key: 'sk-newrotatedkey123456789' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.maskedKey).toBe('sk-...6789');
  });

  it('POST /api/api-keys/:id/rotate rejects short key', async () => {
    const create = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-originalkey1234567890' })
      .expect(201);

    await request(app)
      .post(`/api/api-keys/${create.body.id}/rotate`)
      .set('Authorization', authHeader)
      .send({ key: 'short' })
      .expect(400);
  });

  // ── PATCH /:id/default ─────────────────────────────────────────────────────

  it('PATCH /api/api-keys/:id/default switches default', async () => {
    const k1 = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'openai', key: 'sk-firstdefaultkey123456' })
      .expect(201);

    const k2 = await request(app)
      .post('/api/api-keys')
      .set('Authorization', authHeader)
      .send({ provider: 'anthropic', key: 'sk-ant-secondnotdefault12' })
      .expect(201);

    const res = await request(app)
      .patch(`/api/api-keys/${k2.body.id}/default`)
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.is_default).toBe(1);

    // Verify first key lost default
    const list = await request(app)
      .get('/api/api-keys')
      .set('Authorization', authHeader)
      .expect(200);

    const first = list.body.find((k: Record<string, unknown>) => k.id === k1.body.id);
    expect(first.is_default).toBe(0);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /root/GeekSpace2.0/server && npx vitest run src/test/api/api-keys.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/src/test/api/api-keys.test.ts
git commit -m "test: add API keys route tests (CRUD, rotate, default)"
```

---

### Task 3: Integrations Tests (74.3)

**Files:**
- Create: `server/src/test/api/integrations.test.ts`
- Reference: `server/src/routes/integrations.ts`

**Step 1: Write the test file**

```typescript
/**
 * Integrations Route Tests
 * CRUD, connect/disconnect, permissions, Telegram link, invite flow, events.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { v4 as uuid } from 'uuid';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

// ── Helpers ───────────────────────────────────────────────────────────────────

function insertIntegration(userId: string, type: string, name: string, status = 'disconnected'): string {
  const id = uuid();
  db.prepare(
    `INSERT INTO integrations (id, user_id, type, name, status, health, features, permissions, config)
     VALUES (?, ?, ?, ?, ?, 0, '[]', '[]', '{}')`
  ).run(id, userId, type, name, status);
  return id;
}

describe('Integrations', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);
  });

  // ── GET / — list integrations ──────────────────────────────────────────────

  it('GET /api/integrations returns user integrations', async () => {
    insertIntegration(userId, 'slack', 'Slack');

    const res = await request(app)
      .get('/api/integrations')
      .set('Authorization', authHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('userId');
    expect(res.body[0]).toHaveProperty('features');
  });

  it('GET /api/integrations requires auth', async () => {
    await request(app).get('/api/integrations').expect(401);
  });

  // ── POST /:type/connect ────────────────────────────────────────────────────

  it('POST /api/integrations/:type/connect sets status to connected', async () => {
    insertIntegration(userId, 'slack', 'Slack');

    const res = await request(app)
      .post('/api/integrations/slack/connect')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.status).toBe('connected');
    expect(res.body.health).toBe(100);
  });

  it('POST /api/integrations/:type/connect returns 404 for non-existent', async () => {
    await request(app)
      .post('/api/integrations/nonexistent/connect')
      .set('Authorization', authHeader)
      .expect(404);
  });

  // ── POST /:id/disconnect ───────────────────────────────────────────────────

  it('POST /api/integrations/:id/disconnect sets status to disconnected', async () => {
    const intId = insertIntegration(userId, 'slack', 'Slack', 'connected');

    const res = await request(app)
      .post(`/api/integrations/${intId}/disconnect`)
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.status).toBe('disconnected');
    expect(res.body.health).toBe(0);
  });

  // ── PATCH /:id/permissions ─────────────────────────────────────────────────

  it('PATCH /api/integrations/:id/permissions updates permissions', async () => {
    const intId = insertIntegration(userId, 'slack', 'Slack');

    const res = await request(app)
      .patch(`/api/integrations/${intId}/permissions`)
      .set('Authorization', authHeader)
      .send({ permissions: ['read', 'write'] })
      .expect(200);

    expect(res.body.permissions).toEqual(['read', 'write']);
  });

  // ── Telegram link ──────────────────────────────────────────────────────────

  it('POST /api/integrations/telegram/link returns 503 when bot not configured', async () => {
    const origToken = config.telegramBotToken;
    config.telegramBotToken = '';

    const res = await request(app)
      .post('/api/integrations/telegram/link')
      .set('Authorization', authHeader)
      .expect(503);

    expect(res.body.error).toContain('not configured');
    config.telegramBotToken = origToken;
  });

  it('GET /api/integrations/telegram/status returns linked: false when no link', async () => {
    const res = await request(app)
      .get('/api/integrations/telegram/status')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.linked).toBe(false);
  });

  // ── WhatsApp deprecated endpoint ───────────────────────────────────────────

  it('POST /api/integrations/whatsapp/link returns 410 deprecated', async () => {
    const res = await request(app)
      .post('/api/integrations/whatsapp/link')
      .set('Authorization', authHeader)
      .expect(410);

    expect(res.body.error).toContain('removed');
  });

  // ── Invite flow ────────────────────────────────────────────────────────────

  it('POST /api/integrations/invite creates an invite with token', async () => {
    const res = await request(app)
      .post('/api/integrations/invite')
      .set('Authorization', authHeader)
      .send({ email: 'friend@example.com' })
      .expect(200);

    expect(res.body).toHaveProperty('inviteUrl');
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('GET /api/integrations/invite/:token/info returns invite details', async () => {
    const invite = await request(app)
      .post('/api/integrations/invite')
      .set('Authorization', authHeader)
      .send({})
      .expect(200);

    const res = await request(app)
      .get(`/api/integrations/invite/${invite.body.token}/info`)
      .expect(200);

    expect(res.body).toHaveProperty('ownerName');
    expect(res.body).toHaveProperty('token', invite.body.token);
  });

  it('POST /api/integrations/invite/:token/accept marks invite as used', async () => {
    const invite = await request(app)
      .post('/api/integrations/invite')
      .set('Authorization', authHeader)
      .send({})
      .expect(200);

    const res = await request(app)
      .post(`/api/integrations/invite/${invite.body.token}/accept`)
      .send({ acceptorName: 'Bob' })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Second accept should be 409
    await request(app)
      .post(`/api/integrations/invite/${invite.body.token}/accept`)
      .send({ acceptorName: 'Bob' })
      .expect(409);
  });

  // ── Integration health test ────────────────────────────────────────────────

  it('POST /api/integrations/:type/test returns not_connected for disconnected', async () => {
    insertIntegration(userId, 'slack', 'Slack', 'disconnected');

    const res = await request(app)
      .post('/api/integrations/slack/test')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.healthy).toBe(false);
    expect(res.body.reason).toBe('not_connected');
  });

  // ── Events ─────────────────────────────────────────────────────────────────

  it('GET /api/integrations/events returns integration activity', async () => {
    // Seed an activity log entry
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
       VALUES (?, ?, 'Connected integration', 'Slack', 'link', datetime('now'))`
    ).run(uuid(), userId);

    const res = await request(app)
      .get('/api/integrations/events')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body).toHaveProperty('events');
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /root/GeekSpace2.0/server && npx vitest run src/test/api/integrations.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/src/test/api/integrations.test.ts
git commit -m "test: add integrations route tests (CRUD, link, invite, health)"
```

---

### Task 4: Contact Tests (74.4)

**Files:**
- Create: `server/src/test/api/contact.test.ts`
- Reference: `server/src/routes/contact.ts`, `server/src/services/contactRouter.ts`

**Step 1: Write the test file**

Note: The contact route imports from `contactRouter.ts` service which calls external services (Telegram). We need to mock it.

```typescript
/**
 * Contact Route Tests
 * Request creation, rate limiting, preferences, status polling.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock contactRouter service to avoid external calls
vi.mock('../../services/contactRouter.js', () => ({
  notifyUserOfContactRequest: vi.fn(async () => ({ success: true, channel: 'in_app' as const })),
  handleAcceptRequest: vi.fn(async () => ({ success: true, conversationId: 'test-conv-id' })),
  handleDeclineRequest: vi.fn(async () => ({ success: true })),
  getUserChannelStatus: vi.fn(async () => ({ telegram: false, whatsapp: false, email: false })),
  getAvailabilityResponse: vi.fn(async () => 'User is currently unavailable.'),
  isInQuietHours: vi.fn(() => false),
}));

import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { v4 as uuid } from 'uuid';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Contact', () => {
  let userId: string;
  let targetUserId: string;
  let authHeader: string;
  let targetAuthHeader: string;

  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(userId);

    const target = createTestUser();
    targetUserId = target.id;
    targetAuthHeader = makeAuthHeader(targetUserId);

    // Ensure contact tables are clean for this user
    db.prepare('DELETE FROM contact_requests WHERE from_user_id = ? OR to_user_id = ?').run(userId, targetUserId);
  });

  // ── POST /request — create contact request ─────────────────────────────────

  it('POST /api/contact/request creates a pending request (authenticated)', async () => {
    const res = await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ toUserId: targetUserId, source: 'portfolio' })
      .expect(201);

    expect(res.body.status).toBe('pending');
    expect(res.body).toHaveProperty('requestId');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('POST /api/contact/request returns 400 without required fields', async () => {
    await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ source: 'portfolio' }) // missing toUserId
      .expect(400);
  });

  it('POST /api/contact/request returns 404 for non-existent user', async () => {
    await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ toUserId: uuid(), source: 'portfolio' })
      .expect(404);
  });

  it('POST /api/contact/request returns 409 for duplicate pending request', async () => {
    await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ toUserId: targetUserId, source: 'portfolio' })
      .expect(201);

    await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ toUserId: targetUserId, source: 'portfolio' })
      .expect(409);
  });

  // ── GET /:id/status — poll request status ──────────────────────────────────

  it('GET /api/contact/:id/status returns request info', async () => {
    const create = await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ toUserId: targetUserId, source: 'portfolio' })
      .expect(201);

    const res = await request(app)
      .get(`/api/contact/${create.body.requestId}/status`)
      .expect(200);

    expect(res.body.status).toBe('pending');
    expect(res.body).toHaveProperty('toUser');
  });

  it('GET /api/contact/:id/status returns 404 for non-existent request', async () => {
    await request(app)
      .get(`/api/contact/${uuid()}/status`)
      .expect(404);
  });

  // ── GET /incoming — list pending requests ──────────────────────────────────

  it('GET /api/contact/incoming lists pending requests for target user', async () => {
    await request(app)
      .post('/api/contact/request')
      .set('Authorization', authHeader)
      .send({ toUserId: targetUserId, source: 'portfolio' })
      .expect(201);

    const res = await request(app)
      .get('/api/contact/incoming')
      .set('Authorization', targetAuthHeader)
      .expect(200);

    expect(res.body.requests.length).toBeGreaterThanOrEqual(1);
  });

  // ── Preferences ────────────────────────────────────────────────────────────

  it('GET /api/contact/preferences creates defaults if none exist', async () => {
    const res = await request(app)
      .get('/api/contact/preferences')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body).toHaveProperty('user_id', userId);
  });

  it('PUT /api/contact/preferences updates prefs', async () => {
    // Ensure defaults exist first
    await request(app)
      .get('/api/contact/preferences')
      .set('Authorization', authHeader)
      .expect(200);

    await request(app)
      .put('/api/contact/preferences')
      .set('Authorization', authHeader)
      .send({ availabilityMode: 'busy', allowGuestContacts: 0 })
      .expect(200);

    const res = await request(app)
      .get('/api/contact/preferences')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.availability_mode).toBe('busy');
    expect(res.body.allow_guest_contacts).toBe(0);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /root/GeekSpace2.0/server && npx vitest run src/test/api/contact.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/src/test/api/contact.test.ts
git commit -m "test: add contact route tests (request, status, preferences)"
```

---

### Task 5: OAuth Tests (74.5)

**Files:**
- Create: `server/src/test/api/oauth.test.ts`
- Reference: `server/src/routes/oauth.ts`

**Step 1: Write the test file**

OAuth routes use Passport redirects which are hard to test end-to-end. We test: status endpoint, callback error handling (query param error), and strategy registration detection.

```typescript
/**
 * OAuth Route Tests
 * Provider status, callback error redirect, strategy availability.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('OAuth', () => {
  beforeAll(() => {
    resetDatabase();
  });

  // ── GET /auth/status — provider availability ───────────────────────────────

  it('GET /auth/status returns google and github booleans', async () => {
    const res = await request(app)
      .get('/auth/status')
      .expect(200);

    expect(res.body).toHaveProperty('google');
    expect(res.body).toHaveProperty('github');
    expect(typeof res.body.google).toBe('boolean');
    expect(typeof res.body.github).toBe('boolean');
  });

  // ── Google callback error handling ─────────────────────────────────────────

  it('GET /auth/google/callback with error query redirects to login', async () => {
    const res = await request(app)
      .get('/auth/google/callback?error=access_denied')
      .expect(302);

    expect(res.headers.location).toContain('/login');
    expect(res.headers.location).toContain('error=');
    expect(res.headers.location).toContain('cancelled');
  });

  // ── GitHub callback error handling ─────────────────────────────────────────

  it('GET /auth/github/callback with error query redirects to login', async () => {
    const res = await request(app)
      .get('/auth/github/callback?error=access_denied')
      .expect(302);

    expect(res.headers.location).toContain('/login');
    expect(res.headers.location).toContain('error=');
    expect(res.headers.location).toContain('cancelled');
  });

  // ── Google OAuth initiation ────────────────────────────────────────────────

  it('GET /auth/google redirects to Google consent (if configured)', async () => {
    if (!config.googleClientId) {
      // Strategy not registered — Passport returns 500 or similar
      const res = await request(app).get('/auth/google');
      expect([302, 500]).toContain(res.status);
      return;
    }

    const res = await request(app)
      .get('/auth/google')
      .expect(302);

    expect(res.headers.location).toContain('accounts.google.com');
  });

  // ── GitHub OAuth initiation ────────────────────────────────────────────────

  it('GET /auth/github redirects to GitHub consent (if configured)', async () => {
    if (!config.githubClientId) {
      const res = await request(app).get('/auth/github');
      expect([302, 500]).toContain(res.status);
      return;
    }

    const res = await request(app)
      .get('/auth/github')
      .expect(302);

    expect(res.headers.location).toContain('github.com');
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /root/GeekSpace2.0/server && npx vitest run src/test/api/oauth.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/src/test/api/oauth.test.ts
git commit -m "test: add OAuth route tests (status, callback error handling)"
```

---

### Task 6: Webhooks Tests (74.6)

**Files:**
- Create: `server/src/test/api/webhooks.test.ts`
- Reference: `server/src/routes/webhooks.ts`

**Step 1: Write the test file**

Webhook routes call external services heavily. Mock Telegram, message-router, onboarding, escalation, voice, and cache services.

```typescript
/**
 * Webhook Route Tests
 * Telegram secret verification, bot-message filtering, n8n auth, WhatsApp signature.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const sentMessages: Array<{ chatId: number | string; text: string }> = [];

vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
  cacheDel: vi.fn(async () => {}),
}));

vi.mock('../../services/telegram.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/telegram.js')>();
  return {
    ...original,
    sendTelegramMessage: vi.fn(async (chatId: number | string, text: string) => {
      sentMessages.push({ chatId, text });
    }),
    sendTelegramButtons: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {}),
    getBotUsername: vi.fn(() => 'testbot'),
    initTelegramBot: vi.fn(async () => {}),
    sendTelegramVoice: vi.fn(async () => {}),
    sendTelegramNotification: vi.fn(async () => {}),
  };
});

vi.mock('../../services/message-router.js', () => ({
  handleIncomingMessage: vi.fn(async () => {}),
  sendChannelResponse: vi.fn(async () => {}),
}));

vi.mock('../../services/onboarding.js', () => ({
  getOrCreateOnboarding: vi.fn(() => ({ state: 'complete' })),
  handleOnboardingCallback: vi.fn(async () => false),
  startOnboarding: vi.fn(async () => {}),
  sendActionChips: vi.fn(async () => {}),
}));

vi.mock('../../services/escalation.js', () => ({
  handleEscalationReply: vi.fn(async () => false),
}));

vi.mock('../../services/voice.js', () => ({
  isVoiceEnabled: vi.fn(() => false),
  downloadTelegramVoice: vi.fn(async () => Buffer.from('')),
  transcribeVoice: vi.fn(async () => ''),
  textToSpeech: vi.fn(async () => Buffer.from('')),
  sendTelegramVoice: vi.fn(async () => {}),
  voiceCreditCost: vi.fn(() => 5),
}));

import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Webhooks', () => {
  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    sentMessages.length = 0;
  });

  // ── Telegram: secret verification ──────────────────────────────────────────

  it('POST /webhooks/telegram returns 401 when no secret configured', async () => {
    const origSecret = config.telegramWebhookSecret;
    config.telegramWebhookSecret = '';

    await request(app)
      .post('/webhooks/telegram')
      .send({ update_id: 1 })
      .expect(401);

    config.telegramWebhookSecret = origSecret;
  });

  it('POST /webhooks/telegram returns 403 with wrong secret', async () => {
    const origSecret = config.telegramWebhookSecret;
    config.telegramWebhookSecret = 'correct-secret';

    await request(app)
      .post('/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'wrong-secret')
      .send({ update_id: 1 })
      .expect(403);

    config.telegramWebhookSecret = origSecret;
  });

  it('POST /webhooks/telegram returns 200 with valid secret', async () => {
    const origSecret = config.telegramWebhookSecret;
    config.telegramWebhookSecret = 'test-secret-74';

    await request(app)
      .post('/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'test-secret-74')
      .send({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123, is_bot: false, first_name: 'Test' },
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Hello bot',
        },
      })
      .expect(200);

    config.telegramWebhookSecret = origSecret;
  });

  // ── Telegram: bot-message filter ───────────────────────────────────────────

  it('POST /webhooks/telegram silently drops bot messages', async () => {
    const origSecret = config.telegramWebhookSecret;
    config.telegramWebhookSecret = 'test-secret-74';

    await request(app)
      .post('/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'test-secret-74')
      .send({
        update_id: 2,
        message: {
          message_id: 2,
          from: { id: 999, is_bot: true, first_name: 'OtherBot' },
          chat: { id: 999, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Bot message',
        },
      })
      .expect(200);

    // Wait briefly for async processing
    await new Promise(r => setTimeout(r, 100));

    // No messages should have been sent in response to a bot message
    expect(sentMessages.length).toBe(0);
    config.telegramWebhookSecret = origSecret;
  });

  // ── N8N: secret verification ───────────────────────────────────────────────

  it('POST /webhooks/n8n/callback returns 503 when not configured', async () => {
    const origSecret = config.n8nWebhookSecret;
    config.n8nWebhookSecret = '';

    await request(app)
      .post('/webhooks/n8n/callback')
      .send({ userId: 'u1', channel: 'telegram', externalId: '123', message: 'hi' })
      .expect(503);

    config.n8nWebhookSecret = origSecret;
  });

  it('POST /webhooks/n8n/callback returns 401 with wrong secret', async () => {
    const origSecret = config.n8nWebhookSecret;
    config.n8nWebhookSecret = 'n8n-correct';

    await request(app)
      .post('/webhooks/n8n/callback')
      .set('x-n8n-secret', 'n8n-wrong')
      .send({ userId: 'u1', channel: 'telegram', externalId: '123', message: 'hi' })
      .expect(401);

    config.n8nWebhookSecret = origSecret;
  });

  it('POST /webhooks/n8n/callback returns 400 with missing fields', async () => {
    const origSecret = config.n8nWebhookSecret;
    config.n8nWebhookSecret = 'n8n-test';

    await request(app)
      .post('/webhooks/n8n/callback')
      .set('x-n8n-secret', 'n8n-test')
      .send({ userId: 'u1' }) // missing channel, externalId, message
      .expect(400);

    config.n8nWebhookSecret = origSecret;
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /root/GeekSpace2.0/server && npx vitest run src/test/api/webhooks.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/src/test/api/webhooks.test.ts
git commit -m "test: add webhook route tests (Telegram secret, bot filter, n8n auth)"
```

---

### Task 7: Vite Manual Chunks (74.8 — replaces 74.7 since pages are not orphaned)

**Files:**
- Modify: `vite.config.ts`

**Step 1: Add manual chunks configuration**

Add `build.rollupOptions.output.manualChunks` to split heavy vendor dependencies out of the 886kB index bundle:

```typescript
// In vite.config.ts, add to defineConfig:
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-charts': ['recharts'],
        'vendor-radix': [
          '@radix-ui/react-dialog',
          '@radix-ui/react-dropdown-menu',
          '@radix-ui/react-popover',
          '@radix-ui/react-select',
          '@radix-ui/react-tabs',
          '@radix-ui/react-tooltip',
        ],
        'vendor-motion': ['framer-motion'],
      },
    },
  },
},
```

**Step 2: Run build to verify chunk sizes improve**

Run: `cd /root/GeekSpace2.0 && npm run build`
Expected: index.js should be smaller than 886kB, new vendor chunks created

**Step 3: Verify lint + typecheck still pass**

Run: `cd /root/GeekSpace2.0 && npm run lint && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf: add Vite manual chunks for recharts, radix, framer-motion"
```

---

### Task 8: Update Ops Files (74.9 + 74.10)

**Files:**
- Modify: `ops/AI_FEATURE_MATRIX.md`
- Modify: `ops/AI_RISK_REGISTER.md`

**Step 1: Update AI_FEATURE_MATRIX.md**

Add test coverage notes for the 5 newly-tested routes. Update "Last Verified" columns.

**Step 2: Update AI_RISK_REGISTER.md**

- Close R13 (missing DB indexes) — resolved by Phase 73.6 and 73.9
- Add note about new test coverage for contact, apiKeys, integrations, webhooks, oauth

**Step 3: Commit**

```bash
git add ops/AI_FEATURE_MATRIX.md ops/AI_RISK_REGISTER.md
git commit -m "chore(ops): update feature matrix + risk register for Phase 74"
```

---

### Task 9: Phase 74 Meta Test (74.11)

**Files:**
- Create: `server/src/test/api/phase74.test.ts`

**Step 1: Write meta test verifying new test files exist**

```typescript
/**
 * Phase 74 Tests — Meta verification
 * Confirms that dedicated test files exist for previously-untested routes.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Phase 74 — Test Coverage Hardening', () => {
  const testDir = resolve(import.meta.dirname, '.');

  it('74.11a — api-keys.test.ts exists', () => {
    expect(existsSync(resolve(testDir, 'api-keys.test.ts'))).toBe(true);
  });

  it('74.11b — integrations.test.ts exists', () => {
    expect(existsSync(resolve(testDir, 'integrations.test.ts'))).toBe(true);
  });

  it('74.11c — contact.test.ts exists', () => {
    expect(existsSync(resolve(testDir, 'contact.test.ts'))).toBe(true);
  });

  it('74.11d — oauth.test.ts exists', () => {
    expect(existsSync(resolve(testDir, 'oauth.test.ts'))).toBe(true);
  });

  it('74.11e — webhooks.test.ts exists', () => {
    expect(existsSync(resolve(testDir, 'webhooks.test.ts'))).toBe(true);
  });
});
```

**Step 2: Run full test suite**

Run: `cd /root/GeekSpace2.0/server && npm test`
Expected: All new + existing tests pass

**Step 3: Commit**

```bash
git add server/src/test/api/phase74.test.ts
git commit -m "test: add Phase 74 meta test (test file existence)"
```

---

### Task 10: Verification + Brand Guard (74.12)

**Files:** None modified

**Step 1: Full verification suite**

```bash
cd /root/GeekSpace2.0
npm run lint
npx tsc --noEmit
cd server && npx tsc --noEmit
cd server && npm run build
cd .. && npm run build
npm run brand-guard
```

All must pass with 0 warnings/violations.

---

### Task 11: Ops + Commit + PR + Merge (74.13)

**Files:**
- Modify: `ops/AI_HANDOFF.md`
- Modify: `ops/AI_PHASE_PLAN.md`

**Step 1: Update AI_HANDOFF.md with Phase 74 completion**

**Step 2: Update AI_PHASE_PLAN.md with Phase 74 table**

**Step 3: Final commit + PR + merge**

```bash
git add ops/AI_HANDOFF.md ops/AI_PHASE_PLAN.md
git commit -m "chore(ops): update handoff + phase plan for Phase 74 completion"
git push -u origin ai/phase-20260226-phase74
gh pr create --title "feat(phase-74): test coverage hardening — 5 route test suites" --body "..."
gh pr merge <PR_NUMBER> --merge --delete-branch
git push
```
