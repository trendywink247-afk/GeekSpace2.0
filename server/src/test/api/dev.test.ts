import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase } from '../setup.js';
import { config } from '../../config.js';
import { isAllowedCommand } from '../../services/dev-runner.js';
import { validateBranchName } from '../../services/dev-github.js';

const app = createApp();
const ADMIN_TOKEN = config.adminToken || 'test-admin-token';

// Ensure config has a token for tests
if (!config.adminToken) {
  // Temporarily set it for test purposes
  Object.defineProperty(config, 'adminToken', { value: 'test-admin-token', writable: false });
}

function authHeader() {
  return `Bearer ${ADMIN_TOKEN}`;
}

describe('Dev API Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  // ---- Auth rejection tests ----
  describe('Authentication', () => {
    it('should reject requests with no token', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .expect(401);

      expect(res.body.error).toBe('Missing admin token');
    });

    it('should reject requests with wrong token', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .set('Authorization', 'Bearer wrong-token-here')
        .expect(401);

      expect(res.body.error).toBe('Invalid admin token');
    });

    it('should reject requests with wrong header scheme', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .set('Authorization', `Basic ${ADMIN_TOKEN}`)
        .expect(401);

      expect(res.body.error).toBe('Missing admin token');
    });
  });

  // ---- Status endpoint ----
  describe('GET /api/dev/status', () => {
    it('should return expected status fields', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('gitSha');
      expect(res.body).toHaveProperty('branch');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('nodeVersion');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.nodeVersion).toMatch(/^v\d+/);
    });

    it('should write an audit log entry', async () => {
      // Hit status endpoint
      await request(app)
        .get('/api/dev/status')
        .set('Authorization', authHeader())
        .expect(200);

      // Check audit log
      const res = await request(app)
        .get('/api/dev/audit-log')
        .set('Authorization', authHeader())
        .expect(200);

      const statusEntries = res.body.entries.filter(
        (e: { action: string }) => e.action === 'status',
      );
      expect(statusEntries.length).toBeGreaterThanOrEqual(1);
      expect(statusEntries[0].status).toBe('success');
    });
  });

  // ---- Audit log endpoint ----
  describe('GET /api/dev/audit-log', () => {
    it('should return entries array', async () => {
      const res = await request(app)
        .get('/api/dev/audit-log')
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body).toHaveProperty('entries');
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body).toHaveProperty('count');
    });

    it('should respect limit param', async () => {
      // Create a few audit entries by hitting status
      await request(app).get('/api/dev/status').set('Authorization', authHeader());
      await request(app).get('/api/dev/status').set('Authorization', authHeader());
      await request(app).get('/api/dev/status').set('Authorization', authHeader());

      const res = await request(app)
        .get('/api/dev/audit-log?limit=2')
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body.entries.length).toBeLessThanOrEqual(2);
      expect(res.body.count).toBeLessThanOrEqual(2);
    });
  });

  // ---- Run checks endpoint ----
  describe('POST /api/dev/run-checks', () => {
    it('should reject unknown command', async () => {
      const res = await request(app)
        .post('/api/dev/run-checks')
        .set('Authorization', authHeader())
        .send({ command: 'rm -rf /' })
        .expect(400);

      expect(res.body.error).toMatch(/Unknown command/);
      expect(res.body).toHaveProperty('allowed');
    });

    it('should reject empty body', async () => {
      const res = await request(app)
        .post('/api/dev/run-checks')
        .set('Authorization', authHeader())
        .send({})
        .expect(400);

      expect(res.body.error).toMatch(/Missing required field/);
    });

    it('should reject without auth', async () => {
      await request(app)
        .post('/api/dev/run-checks')
        .send({ command: 'lint' })
        .expect(401);
    });

    it('should reject arbitrary strings via isAllowedCommand', () => {
      expect(isAllowedCommand('lint')).toBe(true);
      expect(isAllowedCommand('test')).toBe(true);
      expect(isAllowedCommand('build')).toBe(true);
      expect(isAllowedCommand('typecheck')).toBe(true);
      expect(isAllowedCommand('e2e')).toBe(true);
      expect(isAllowedCommand('rm -rf /')).toBe(false);
      expect(isAllowedCommand('')).toBe(false);
      expect(isAllowedCommand('cat /etc/passwd')).toBe(false);
      expect(isAllowedCommand('lint && rm -rf /')).toBe(false);
    });
  });

  // ---- Create PR endpoint ----
  describe('POST /api/dev/create-pr', () => {
    describe('validateBranchName', () => {
      it('should accept valid branch names', () => {
        expect(validateBranchName('feature/my-branch')).toBeNull();
        expect(validateBranchName('devclaw/test-123')).toBeNull();
        expect(validateBranchName('fix_something')).toBeNull();
        expect(validateBranchName('abc')).toBeNull();
      });

      it('should reject protected branches', () => {
        expect(validateBranchName('main')).toMatch(/protected/i);
        expect(validateBranchName('master')).toMatch(/protected/i);
        expect(validateBranchName('live-production')).toMatch(/protected/i);
      });

      it('should reject invalid characters', () => {
        expect(validateBranchName('branch name')).toMatch(/alphanumeric/i);
        expect(validateBranchName('branch..name')).toMatch(/alphanumeric/i);
        expect(validateBranchName('$(whoami)')).toMatch(/alphanumeric/i);
        expect(validateBranchName('; rm -rf /')).toMatch(/alphanumeric/i);
      });

      it('should reject empty names', () => {
        expect(validateBranchName('')).toMatch(/empty/i);
        expect(validateBranchName('  ')).toMatch(/empty/i);
      });

      it('should reject names that are too long', () => {
        const longName = 'a'.repeat(101);
        expect(validateBranchName(longName)).toMatch(/too long/i);
      });
    });

    it('should require auth', async () => {
      await request(app)
        .post('/api/dev/create-pr')
        .send({ branchName: 'test-branch', title: 'Test PR' })
        .expect(401);
    });

    it('should reject invalid branch name', async () => {
      // Set a token so we get past the 503 check
      const original = config.githubDevToken;
      Object.defineProperty(config, 'githubDevToken', { value: 'fake-token', writable: true, configurable: true });

      const res = await request(app)
        .post('/api/dev/create-pr')
        .set('Authorization', authHeader())
        .send({ branchName: 'main', title: 'Test PR' })
        .expect(400);

      expect(res.body.error).toMatch(/protected/i);

      Object.defineProperty(config, 'githubDevToken', { value: original, writable: true, configurable: true });
    });

    it('should reject missing title', async () => {
      const original = config.githubDevToken;
      Object.defineProperty(config, 'githubDevToken', { value: 'fake-token', writable: true, configurable: true });

      const res = await request(app)
        .post('/api/dev/create-pr')
        .set('Authorization', authHeader())
        .send({ branchName: 'test/valid-branch' })
        .expect(400);

      expect(res.body.error).toMatch(/title/i);

      Object.defineProperty(config, 'githubDevToken', { value: original, writable: true, configurable: true });
    });

    it('should return 503 when GITHUB_DEV_TOKEN is not configured', async () => {
      const original = config.githubDevToken;
      Object.defineProperty(config, 'githubDevToken', { value: '', writable: true, configurable: true });

      const res = await request(app)
        .post('/api/dev/create-pr')
        .set('Authorization', authHeader())
        .send({ branchName: 'test/some-branch', title: 'Test PR' })
        .expect(503);

      expect(res.body.error).toMatch(/GITHUB_DEV_TOKEN/);

      Object.defineProperty(config, 'githubDevToken', { value: original, writable: true, configurable: true });
    });
  });
});
