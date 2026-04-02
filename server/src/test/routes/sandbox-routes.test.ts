// ============================================================
// Sandbox Routes Tests
//
// Route-level integration tests using the real Express app
// (same pattern as all other API tests in this project).
// SandboxService, cache, and activity-log are mocked.
// Auth is handled by signing real JWTs via signToken().
// Plan gating uses the real db.prepare query, so we insert
// a subscription row for paid users.
// ============================================================

// Set TEST_MODE before any other imports so db/config pick it up.
// NOTE: setup.ts already does this, but we need it earlier because
// vi.mock factories run before test file imports in Vitest.
process.env.TEST_MODE = 'true';

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted() — variables available inside vi.mock factories
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  // SandboxService static method mocks
  const createOrGet  = vi.fn();
  const exec         = vi.fn();
  const streamOutput = vi.fn();
  const writeFile    = vi.fn();
  const readFile     = vi.fn();
  const listFiles    = vi.fn();
  const uploadFile   = vi.fn();
  const downloadFile = vi.fn();
  const gitClone     = vi.fn();
  const getStatus    = vi.fn();
  const destroy      = vi.fn();
  const health       = vi.fn();

  // Cache mocks
  const cacheGet = vi.fn().mockResolvedValue(null);
  const cacheSet = vi.fn().mockResolvedValue(undefined);

  return {
    createOrGet, exec, streamOutput,
    writeFile, readFile, listFiles,
    uploadFile, downloadFile, gitClone,
    getStatus, destroy, health,
    cacheGet, cacheSet,
  };
});

// ---------------------------------------------------------------------------
// Mocks — SandboxService, cache, activity-log, dockerode
// ---------------------------------------------------------------------------

vi.mock('../../services/sandbox/sandbox-service.js', () => ({
  SandboxService: {
    createOrGet:  mocks.createOrGet,
    exec:         mocks.exec,
    streamOutput: mocks.streamOutput,
    writeFile:    mocks.writeFile,
    readFile:     mocks.readFile,
    listFiles:    mocks.listFiles,
    uploadFile:   mocks.uploadFile,
    downloadFile: mocks.downloadFile,
    gitClone:     mocks.gitClone,
    getStatus:    mocks.getStatus,
    destroy:      mocks.destroy,
    health:       mocks.health,
  },
  SandboxError: class SandboxError extends Error {
    code: string; details?: unknown;
    constructor(message: string, code: string, details?: unknown) {
      super(message); this.name = 'SandboxError'; this.code = code; this.details = details;
    }
  },
}));

vi.mock('../../services/cache.js', () => ({
  cacheGet: mocks.cacheGet,
  cacheSet: mocks.cacheSet,
}));

vi.mock('../../services/activity-log.js', () => ({
  logActivity: vi.fn(),
}));

// Dockerode is still imported transitively by app.ts/sandbox-service (even though
// sandbox-service itself is mocked, the module graph may load dockerode).
// Guard against real Docker socket attempts.
vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('OK'),
    listNetworks: vi.fn().mockResolvedValue([]),
    createNetwork: vi.fn().mockResolvedValue({}),
    modem: { demuxStream: vi.fn() },
  })),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks are registered
// ---------------------------------------------------------------------------

import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { createApp } from '../../app.js';
import { signToken } from '../../middleware/auth.js';
import { db } from '../../db/index.js';

// ---------------------------------------------------------------------------
// App singleton — created once after mocks are in place
// ---------------------------------------------------------------------------

const app = createApp();

// ---------------------------------------------------------------------------
// DB helpers — insert/remove subscription rows to control plan gating
// ---------------------------------------------------------------------------

/**
 * Ensure a minimal user row exists, then upsert a subscription so
 * getUserPlan() (which queries the subscriptions table) returns the given plan.
 */
function setUserPlan(userId: string, plan: string): void {
  // Ensure a users row exists (FK required by subscriptions)
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, username, password_hash, name)
    VALUES (?, ?, ?, 'x', ?)
  `).run(userId, `${userId}@test.local`, `u_${userId.slice(0, 12)}`, 'Test');
  // Upsert subscription
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);
  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, credits_remaining, billing_cycle_start, billing_cycle_end)
    VALUES (?, ?, ?, 0, datetime('now'), datetime('now', '+30 days'))
  `).run(uuid(), userId, plan);
}

/** Remove subscription rows for a user (makes getUserPlan return 'free'). */
function clearUserPlan(userId: string): void {
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/** Make a valid Bearer token for the given userId. */
function makeToken(userId: string): string {
  return `Bearer ${signToken(userId)}`;
}

/** Minimal SandboxInfo fixture. */
function makeSandboxInfo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sbx-test-123',
    userId: 'user-paid',
    containerId: 'cnt-abc',
    tier: 'monthly',
    name: 'sandbox',
    template: 'default',
    memoryMb: 128,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    idleTimeoutMs: 30 * 60_000,
    browserAllowed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test IDs — stable across the test file so we can set plans easily
// ---------------------------------------------------------------------------

const USER_PAID  = `rte-paid-${uuid().slice(0, 8)}`;
const USER_FREE  = `rte-free-${uuid().slice(0, 8)}`;
const USER_INTRO = `rte-intro-${uuid().slice(0, 8)}`;
const USER_ANY   = `rte-any-${uuid().slice(0, 8)}`;

// ===========================================================================
// Tests
// ===========================================================================

describe('Sandbox Routes', () => {
  beforeAll(async () => {
    // Set up subscription rows
    setUserPlan(USER_PAID, 'monthly');
    clearUserPlan(USER_FREE);                // no subscription = 'free'
    setUserPlan(USER_INTRO, 'intro');
    setUserPlan(USER_ANY, 'monthly');
    // Give Dockerode's async ping time to resolve (sandbox-service init)
    await new Promise(r => setTimeout(r, 50));
  });

  afterAll(() => {
    clearUserPlan(USER_PAID);
    clearUserPlan(USER_INTRO);
    clearUserPlan(USER_ANY);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default resolved values after clearAllMocks resets them
    mocks.cacheGet.mockResolvedValue(null);
    mocks.cacheSet.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Auth — unauthenticated requests must be rejected
  // =========================================================================

  describe('Auth — rejects unauthenticated requests', () => {
    it('POST /api/sandbox/create rejects with no token', async () => {
      const res = await request(app).post('/api/sandbox/create').send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/sandbox/exec rejects with no token', async () => {
      const res = await request(app).post('/api/sandbox/exec').send({});
      expect(res.status).toBe(401);
    });

    it('GET /api/sandbox/stream/:id rejects with no token', async () => {
      const res = await request(app).get('/api/sandbox/stream/sbx-abc');
      expect(res.status).toBe(401);
    });

    it('POST /api/sandbox/file/write rejects with no token', async () => {
      const res = await request(app).post('/api/sandbox/file/write').send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/sandbox/file/read rejects with no token', async () => {
      const res = await request(app).post('/api/sandbox/file/read').send({});
      expect(res.status).toBe(401);
    });

    it('GET /api/sandbox/file/list rejects with no token', async () => {
      const res = await request(app).get('/api/sandbox/file/list');
      expect(res.status).toBe(401);
    });

    it('GET /api/sandbox/status rejects with no token', async () => {
      const res = await request(app).get('/api/sandbox/status');
      expect(res.status).toBe(401);
    });

    it('DELETE /api/sandbox/destroy rejects with no token', async () => {
      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .query({ sandboxId: 'sbx-x' });
      expect(res.status).toBe(401);
    });

    it('GET /api/sandbox/health rejects with no token', async () => {
      const res = await request(app).get('/api/sandbox/health');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // Tier gating — free/intro users get 403 on paid endpoints
  // =========================================================================

  describe('Tier gating — rejects free/intro users', () => {
    it('POST /api/sandbox/create returns 403 for free plan', async () => {
      const res = await request(app)
        .post('/api/sandbox/create')
        .set('Authorization', makeToken(USER_FREE))
        .send({ template: 'node18' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PLAN_REQUIRED');
    });

    it('POST /api/sandbox/create returns 403 for intro plan', async () => {
      const res = await request(app)
        .post('/api/sandbox/create')
        .set('Authorization', makeToken(USER_INTRO))
        .send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PLAN_REQUIRED');
    });

    it('POST /api/sandbox/exec returns 403 for free plan', async () => {
      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_FREE))
        .send({ sandboxId: 'sbx-x', command: 'ls' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PLAN_REQUIRED');
    });

    it('GET /api/sandbox/stream/:id returns 403 for free plan', async () => {
      const res = await request(app)
        .get('/api/sandbox/stream/sbx-x')
        .set('Authorization', makeToken(USER_FREE));
      expect(res.status).toBe(403);
    });

    it('POST /api/sandbox/file/write returns 403 for intro plan', async () => {
      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_INTRO))
        .send({ sandboxId: 'sbx-x', path: '/foo', content: 'bar' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/sandbox/destroy returns 403 for free plan', async () => {
      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .set('Authorization', makeToken(USER_FREE))
        .query({ sandboxId: 'sbx-x' });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // POST /api/sandbox/create
  // =========================================================================

  describe('POST /api/sandbox/create', () => {
    it('creates sandbox and returns sandbox info for paid user', async () => {
      const info = makeSandboxInfo();
      mocks.createOrGet.mockResolvedValue(info);

      const res = await request(app)
        .post('/api/sandbox/create')
        .set('Authorization', makeToken(USER_PAID))
        .send({ template: 'node18', name: 'my-env' });

      expect(res.status).toBe(200);
      expect(res.body.sandbox).toBeDefined();
      expect(res.body.sandbox.id).toBe('sbx-test-123');
      expect(mocks.createOrGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ template: 'node18', name: 'my-env' }),
      );
    });

    it('creates sandbox with empty body for paid user', async () => {
      mocks.createOrGet.mockResolvedValue(makeSandboxInfo({ tier: 'monthly' }));

      const res = await request(app)
        .post('/api/sandbox/create')
        .set('Authorization', makeToken(USER_PAID))
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.sandbox).toBeDefined();
    });

    it('returns 500 when SandboxService.createOrGet throws', async () => {
      mocks.createOrGet.mockRejectedValue(new Error('Docker daemon offline'));

      const res = await request(app)
        .post('/api/sandbox/create')
        .set('Authorization', makeToken(USER_PAID))
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('SANDBOX_CREATE_FAILED');
    });

    it('allows all valid paid plans', async () => {
      const plans: Array<{ id: string; plan: string }> = [
        { id: `pid-monthly-${uuid().slice(0,6)}`, plan: 'monthly' },
        { id: `pid-halfyear-${uuid().slice(0,6)}`, plan: 'halfyear' },
        { id: `pid-yearly-${uuid().slice(0,6)}`, plan: 'yearly' },
        { id: `pid-pro-${uuid().slice(0,6)}`, plan: 'pro' },
        { id: `pid-team-${uuid().slice(0,6)}`, plan: 'team' },
      ];
      for (const { id, plan } of plans) {
        setUserPlan(id, plan);
        mocks.createOrGet.mockResolvedValue(makeSandboxInfo({ tier: plan }));
        const res = await request(app)
          .post('/api/sandbox/create')
          .set('Authorization', makeToken(id))
          .send({});
        expect(res.status).toBe(200);
        clearUserPlan(id);
      }
    });
  });

  // =========================================================================
  // POST /api/sandbox/exec
  // =========================================================================

  describe('POST /api/sandbox/exec', () => {
    it('executes command and returns output', async () => {
      mocks.exec.mockResolvedValue({ exitCode: 0, stdout: 'hello\n', stderr: '' });

      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', command: 'echo hello' });

      expect(res.status).toBe(200);
      expect(res.body.exitCode).toBe(0);
      expect(res.body.stdout).toBe('hello\n');
      expect(res.body.stderr).toBe('');
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('returns 400 when sandboxId is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ command: 'echo hi' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 400 when command is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 429 when rate limit is exceeded', async () => {
      // Simulate counter already at limit (10)
      mocks.cacheGet.mockResolvedValue('10');

      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', command: 'ls' });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMITED');
    });

    it('degrades gracefully when cache throws (allows exec)', async () => {
      mocks.cacheGet.mockRejectedValue(new Error('Redis down'));
      mocks.exec.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });

      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', command: 'ls' });

      // Redis failure degrades gracefully: exec is allowed
      expect(res.status).toBe(200);
    });

    it('returns 500 when SandboxService.exec throws', async () => {
      mocks.exec.mockRejectedValue(new Error('Container error'));

      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', command: 'bad' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('EXEC_FAILED');
    });
  });

  // =========================================================================
  // File operations
  // =========================================================================

  describe('POST /api/sandbox/file/write', () => {
    it('writes file and returns ok + path', async () => {
      mocks.writeFile.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', path: '/workspace/app.js', content: 'console.log(1)' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.path).toBe('/workspace/app.js');
      expect(mocks.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        'sbx-test-123',
        '/workspace/app.js',
        'console.log(1)',
      );
    });

    it('returns 400 when sandboxId is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_PAID))
        .send({ path: '/foo', content: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 400 when path is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', content: 'bar' });
      expect(res.status).toBe(400);
    });

    it('accepts empty string content (content === undefined check, not falsy)', async () => {
      mocks.writeFile.mockResolvedValue(undefined);
      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', path: '/workspace/empty.txt', content: '' });
      expect(res.status).toBe(200);
    });

    it('returns 500 when writeFile throws', async () => {
      mocks.writeFile.mockRejectedValue(new Error('Disk full'));
      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', path: '/foo', content: 'bar' });
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('FILE_WRITE_FAILED');
    });
  });

  describe('POST /api/sandbox/file/read', () => {
    it('reads file and returns content + path', async () => {
      mocks.readFile.mockResolvedValue({ content: 'file contents', path: '/workspace/app.js' });

      const res = await request(app)
        .post('/api/sandbox/file/read')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', path: '/workspace/app.js' });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('file contents');
      expect(res.body.path).toBe('/workspace/app.js');
    });

    it('returns 400 when sandboxId is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/file/read')
        .set('Authorization', makeToken(USER_PAID))
        .send({ path: '/foo' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 400 when path is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/file/read')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(400);
    });

    it('returns 500 when readFile throws', async () => {
      mocks.readFile.mockRejectedValue(new Error('File not found'));
      const res = await request(app)
        .post('/api/sandbox/file/read')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', path: '/ghost.txt' });
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('FILE_READ_FAILED');
    });
  });

  describe('GET /api/sandbox/file/list', () => {
    it('lists files and returns files array + path', async () => {
      mocks.listFiles.mockResolvedValue([
        { name: 'app.js', type: 'file', size: 1024 },
        { name: 'node_modules', type: 'directory', size: 4096 },
      ]);

      const res = await request(app)
        .get('/api/sandbox/file/list')
        .set('Authorization', makeToken(USER_PAID))
        .query({ sandboxId: 'sbx-test-123', path: '/workspace' });

      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(2);
      expect(res.body.path).toBe('/workspace');
      expect(res.body.files[0].name).toBe('app.js');
      expect(res.body.files[0].type).toBe('file');
      expect(res.body.files[1].type).toBe('directory');
    });

    it('defaults path to / when not provided', async () => {
      mocks.listFiles.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/sandbox/file/list')
        .set('Authorization', makeToken(USER_PAID))
        .query({ sandboxId: 'sbx-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.path).toBe('/');
    });

    it('returns 400 when sandboxId query param is missing', async () => {
      const res = await request(app)
        .get('/api/sandbox/file/list')
        .set('Authorization', makeToken(USER_PAID));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 403 for free plan', async () => {
      const res = await request(app)
        .get('/api/sandbox/file/list')
        .set('Authorization', makeToken(USER_FREE))
        .query({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(403);
    });

    it('returns 500 when listFiles throws', async () => {
      mocks.listFiles.mockRejectedValue(new Error('Exec failed'));
      const res = await request(app)
        .get('/api/sandbox/file/list')
        .set('Authorization', makeToken(USER_PAID))
        .query({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('FILE_LIST_FAILED');
    });
  });

  // =========================================================================
  // GET /api/sandbox/status
  // =========================================================================

  describe('GET /api/sandbox/status', () => {
    it('returns active status for user with sandbox', async () => {
      const info = makeSandboxInfo();
      mocks.getStatus.mockResolvedValue({ active: true, sandbox: info, uptime: 42 });

      const res = await request(app)
        .get('/api/sandbox/status')
        .set('Authorization', makeToken(USER_PAID));

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(true);
      expect(res.body.sandbox.id).toBe('sbx-test-123');
      expect(res.body.uptime).toBe(42);
    });

    it('returns inactive status for user without sandbox', async () => {
      mocks.getStatus.mockResolvedValue({ active: false, sandbox: null, uptime: 0 });

      const res = await request(app)
        .get('/api/sandbox/status')
        .set('Authorization', makeToken(USER_ANY));

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      expect(res.body.sandbox).toBeNull();
    });

    it('does NOT require paid plan (no tier check on status endpoint)', async () => {
      // Status is available to any authenticated user regardless of plan
      mocks.getStatus.mockResolvedValue({ active: false, sandbox: null, uptime: 0 });

      const res = await request(app)
        .get('/api/sandbox/status')
        .set('Authorization', makeToken(USER_FREE));

      expect(res.status).toBe(200);
    });

    it('returns 500 when getStatus throws', async () => {
      mocks.getStatus.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .get('/api/sandbox/status')
        .set('Authorization', makeToken(USER_PAID));
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('STATUS_FAILED');
    });
  });

  // =========================================================================
  // DELETE /api/sandbox/destroy
  // =========================================================================

  describe('DELETE /api/sandbox/destroy', () => {
    it('destroys sandbox via query param and returns ok', async () => {
      mocks.destroy.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .set('Authorization', makeToken(USER_PAID))
        .query({ sandboxId: 'sbx-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mocks.destroy).toHaveBeenCalledWith(expect.any(String), 'sbx-test-123');
    });

    it('destroys sandbox via request body and returns ok', async () => {
      mocks.destroy.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('returns 400 when sandboxId is not provided', async () => {
      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .set('Authorization', makeToken(USER_PAID));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 403 for free plan', async () => {
      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .set('Authorization', makeToken(USER_FREE))
        .query({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(403);
    });

    it('returns 500 when destroy throws', async () => {
      mocks.destroy.mockRejectedValue(new Error('Container not found'));
      const res = await request(app)
        .delete('/api/sandbox/destroy')
        .set('Authorization', makeToken(USER_PAID))
        .query({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('DESTROY_FAILED');
    });
  });

  // =========================================================================
  // GET /api/sandbox/health
  // =========================================================================

  describe('GET /api/sandbox/health', () => {
    it('returns 200 with health info when Docker is available', async () => {
      mocks.health.mockResolvedValue({ ok: true, dockerAvailable: true, activeSandboxes: 3 });

      const res = await request(app)
        .get('/api/sandbox/health')
        .set('Authorization', makeToken(USER_ANY));

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.dockerAvailable).toBe(true);
      expect(res.body.activeSandboxes).toBe(3);
    });

    it('returns 503 when Docker is unavailable', async () => {
      mocks.health.mockResolvedValue({ ok: false, dockerAvailable: false, activeSandboxes: 0 });

      const res = await request(app)
        .get('/api/sandbox/health')
        .set('Authorization', makeToken(USER_ANY));

      expect(res.status).toBe(503);
      expect(res.body.ok).toBe(false);
    });

    it('returns 503 when health check throws', async () => {
      mocks.health.mockRejectedValue(new Error('Internal'));

      const res = await request(app)
        .get('/api/sandbox/health')
        .set('Authorization', makeToken(USER_ANY));

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('HEALTH_CHECK_FAILED');
    });
  });

  // =========================================================================
  // Error handling — invalid sandbox ID, unauthorized access
  // =========================================================================

  describe('Error handling', () => {
    it('returns error message when SandboxService throws a NOT_FOUND error', async () => {
      const { SandboxError } = await import('../../services/sandbox/sandbox-service.js');
      mocks.exec.mockRejectedValue(
        new SandboxError('Sandbox not found: sbx-ghost', 'NOT_FOUND'),
      );

      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-ghost', command: 'ls' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('not found');
    });

    it('returns error message when SandboxService throws a FORBIDDEN error', async () => {
      const { SandboxError } = await import('../../services/sandbox/sandbox-service.js');
      mocks.writeFile.mockRejectedValue(
        new SandboxError('Sandbox access denied', 'FORBIDDEN'),
      );

      const res = await request(app)
        .post('/api/sandbox/file/write')
        .set('Authorization', makeToken(USER_ANY))
        .send({ sandboxId: 'sbx-not-mine', path: '/foo', content: 'bar' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('access denied');
    });

    it('exec returns 400 when both sandboxId and command are missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/exec')
        .set('Authorization', makeToken(USER_PAID))
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });
  });

  // =========================================================================
  // GET /api/sandbox/stream/:id — SSE headers + tier check
  // =========================================================================

  describe('GET /api/sandbox/stream/:id', () => {
    it('sets SSE Content-Type header for paid user (verified via raw http)', async () => {
      // The SSE route calls res.flushHeaders() synchronously before awaiting
      // streamOutput, so the headers arrive before any body bytes.
      mocks.streamOutput.mockImplementation(
        (_uid: string, _sid: string, _onData: (d: string) => void) =>
          Promise.resolve(() => { /* cleanup noop */ }),
      );

      const server = (app as import('express').Express).listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => server.once('listening', resolve));
      try {
        const addr = server.address() as { port: number };
        const http = await import('http');
        const token = signToken(USER_PAID);
        const ct = await new Promise<string>((resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: addr.port,
              path: '/api/sandbox/stream/sbx-test-123',
              headers: { Authorization: `Bearer ${token}` },
            },
            (res: import('http').IncomingMessage) => {
              resolve(res.headers['content-type'] ?? '');
              res.destroy();
            },
          );
          req.on('error', reject);
          req.end();
        });
        expect(ct).toContain('text/event-stream');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }, 5000);

    it('returns 403 for free plan on stream endpoint', async () => {
      const res = await request(app)
        .get('/api/sandbox/stream/sbx-test-123')
        .set('Authorization', makeToken(USER_FREE));
      expect(res.status).toBe(403);
    });

    it('returns SSE headers even when streamOutput throws (headers already flushed)', async () => {
      // The route calls res.flushHeaders() before await streamOutput(), so when
      // streamOutput throws the fail() helper's `if (!res.headersSent)` guard
      // prevents writing a 500 status.  We verify headers arrive as SSE.
      mocks.streamOutput.mockRejectedValue(new Error('Stream attach failed'));

      const server = (app as import('express').Express).listen(0, '127.0.0.1');
      await new Promise<void>((resolve) => server.once('listening', resolve));
      try {
        const addr = server.address() as { port: number };
        const http = await import('http');
        const token = signToken(USER_PAID);
        const ct = await new Promise<string>((resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: addr.port,
              path: '/api/sandbox/stream/sbx-test-123',
              headers: { Authorization: `Bearer ${token}` },
            },
            (res: import('http').IncomingMessage) => {
              // Headers arrived — that's all we need to verify
              resolve(res.headers['content-type'] ?? '');
              res.destroy(); // don't wait for body, route may never end it
            },
          );
          req.on('error', reject);
          req.end();
        });
        // Headers were set as SSE (200) — the 500 cannot be sent after flush
        expect(ct).toContain('text/event-stream');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }, 5000);
  });

  // =========================================================================
  // POST /api/sandbox/git/clone
  // =========================================================================

  describe('POST /api/sandbox/git/clone', () => {
    it('clones repo and returns ok + path', async () => {
      mocks.gitClone.mockResolvedValue({ ok: true, path: '/workspace' });

      const res = await request(app)
        .post('/api/sandbox/git/clone')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', repoUrl: 'https://github.com/user/repo.git' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.path).toBe('/workspace');
    });

    it('returns 400 when sandboxId is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/git/clone')
        .set('Authorization', makeToken(USER_PAID))
        .send({ repoUrl: 'https://github.com/user/repo.git' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('returns 400 when repoUrl is missing', async () => {
      const res = await request(app)
        .post('/api/sandbox/git/clone')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for free plan', async () => {
      const res = await request(app)
        .post('/api/sandbox/git/clone')
        .set('Authorization', makeToken(USER_FREE))
        .send({ sandboxId: 'sbx-test-123', repoUrl: 'https://github.com/user/repo.git' });
      expect(res.status).toBe(403);
    });

    it('returns 500 when gitClone throws', async () => {
      mocks.gitClone.mockRejectedValue(new Error('Git auth failed'));
      const res = await request(app)
        .post('/api/sandbox/git/clone')
        .set('Authorization', makeToken(USER_PAID))
        .send({ sandboxId: 'sbx-test-123', repoUrl: 'https://github.com/user/repo.git' });
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('GIT_CLONE_FAILED');
    });
  });
});
