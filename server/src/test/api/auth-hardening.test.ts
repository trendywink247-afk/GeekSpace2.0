/**
 * Auth Hardening Tests
 * Covers: rate limiting, refresh token rotation, session management,
 * no password_hash leakage, forgot-password enumeration protection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, generateTestToken } from '../setup.js';
import {
  _resetForTesting,
  recordFailedLogin,
  MAX_ATTEMPTS,
} from '../../services/login-guard.js';
import { db } from '../../db/index.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
} from '../../services/refresh-token.js';

const app = createApp();

// ── Rate Limiting ────────────────────────────────────────────────────────────

describe('FIX-AUTH-001: Login rate limiting', () => {
  beforeEach(() => {
    resetDatabase();
    _resetForTesting();
  });

  it('login with correct creds returns 200 + JWT', async () => {
    const user = createTestUser('rate-test-ok@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(10);
  });

  it('login with wrong password returns 401', async () => {
    const user = createTestUser('rate-test-fail@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('6th attempt returns 429 with Retry-After header', async () => {
    // Exhaust the in-memory limit for this IP
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailedLogin('127.0.0.1');
    }

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.1')
      .send({ email: 'any@example.com', password: 'any' });

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.body.error).toMatch(/Too many attempts/);
  });

  it('lockout message shows dynamic countdown', async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailedLogin('127.0.0.2');
    }
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.2')
      .send({ email: 'any@example.com', password: 'any' });
    expect(res.status).toBe(429);
    // Should contain "Xm Xs" pattern
    expect(res.body.error).toMatch(/\d+m \d+s/);
  });
});

// ── Refresh Token Rotation ──────────────────────────────────────────────────

describe('FIX-AUTH-002: JWT refresh token rotation', () => {
  beforeEach(() => {
    resetDatabase();
    _resetForTesting();
  });

  it('login returns a refreshToken alongside the access token', async () => {
    const user = createTestUser('refresh-login@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken.length).toBeGreaterThan(20);
  });

  it('POST /api/auth/refresh rotates correctly (new access + refresh token)', async () => {
    const user = createTestUser('refresh-rotate@example.com');
    const { refreshToken } = issueRefreshToken(user.id);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    // New refresh token should be different from the old one
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('revoked refresh token is rejected', async () => {
    const user = createTestUser('refresh-revoked@example.com');
    const { refreshToken } = issueRefreshToken(user.id);

    // First rotation should succeed
    const res1 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res1.status).toBe(200);

    // Second rotation with the same (now-revoked) token should fail
    const res2 = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res2.status).toBe(401);
    expect(res2.body.error).toMatch(/Invalid or expired/);
  });

  it('reuse of revoked token revokes entire family', () => {
    const user = createTestUser('reuse-detect@example.com');
    const { refreshToken: token1 } = issueRefreshToken(user.id);

    // Rotate: token1 -> token2
    const result2 = rotateRefreshToken(token1);
    expect(result2).not.toBeNull();

    // Reuse token1 (already revoked) — should revoke entire family
    const result3 = rotateRefreshToken(token1);
    expect(result3).toBeNull();

    // token2 should also now be revoked
    const result4 = rotateRefreshToken(result2!.refreshToken);
    expect(result4).toBeNull();
  });

  it('revokeAllRefreshTokens invalidates all tokens for a user', () => {
    const user = createTestUser('revoke-all@example.com');
    const { refreshToken: rt1 } = issueRefreshToken(user.id);
    const { refreshToken: rt2 } = issueRefreshToken(user.id);

    const count = revokeAllRefreshTokens(user.id);
    expect(count).toBe(2);

    // Both tokens should now be rejected
    expect(rotateRefreshToken(rt1)).toBeNull();
    expect(rotateRefreshToken(rt2)).toBeNull();
  });

  it('refresh without body returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshToken is required/);
  });

  it('refresh with garbage token returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage-token-value' });
    expect(res.status).toBe(401);
  });
});

// ── No password_hash leakage ────────────────────────────────────────────────

describe('Auth response security', () => {
  beforeEach(() => {
    resetDatabase();
    _resetForTesting();
  });

  it('login response does not contain password_hash', async () => {
    const user = createTestUser('noleak-login@example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('passwordHash');
  });

  it('signup response does not contain password_hash', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'noleak-signup@example.com',
        password: 'test-password-123',
        username: 'noleak_user',
      });
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('passwordHash');
  });

  it('GET /api/auth/me does not contain password_hash', async () => {
    const user = createTestUser('noleak-me@example.com');
    const token = generateTestToken(user.id);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('passwordHash');
  });
});

// ── Session Management ──────────────────────────────────────────────────────

describe('FIX-AUTH-003: Session management', () => {
  beforeEach(() => {
    resetDatabase();
    _resetForTesting();
  });

  it('GET /api/auth/sessions returns active sessions', async () => {
    const user = createTestUser('session-list@example.com');
    const token = generateTestToken(user.id);

    // First request creates a session via requireAuth middleware
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'Mozilla/5.0 Chrome/120');

    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'Mozilla/5.0 Chrome/120');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);

    // Each session should have device and masked IP
    const session = res.body.sessions[0];
    expect(session).toHaveProperty('device');
    expect(session).toHaveProperty('ip_masked');
    expect(session).toHaveProperty('last_seen');
  });

  it('DELETE /api/auth/sessions/:id revokes a specific session', async () => {
    const user = createTestUser('session-revoke@example.com');
    const token = generateTestToken(user.id);

    // Create a session
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // List sessions
    const listRes = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body.sessions.length).toBeGreaterThanOrEqual(1);
    const sessionId = listRes.body.sessions[0].id;

    // Revoke the session
    const revokeRes = await request(app)
      .delete(`/api/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);
  });

  it('sessions contain device parsing from user-agent', async () => {
    const user = createTestUser('session-device@example.com');
    const token = generateTestToken(user.id);

    // Hit an authed endpoint with a Chrome user-agent
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    expect(res.status).toBe(200);
    const session = res.body.sessions[0];
    expect(session.device).toBe('Chrome Desktop');
  });
});

// ── Forgot Password hardening ───────────────────────────────────────────────

describe('FIX-AUTH-005: Forgot password hardening', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('forgot-password always returns success regardless of email existence', async () => {
    // Non-existent email should still return success (enumeration protection)
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent-xyz@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/If that email is registered/i);
  });

  it('forgot-password for existing user also returns same generic message', async () => {
    const user = createTestUser('forgot-exists@example.com');
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Message should be the same as for non-existent users
    expect(res.body.message).toMatch(/If that email is registered/i);
  });

  it('forgot-password requires email field', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Email is required/i);
  });
});

// ── Refresh tokens DB table ─────────────────────────────────────────────────

describe('refresh_tokens table', () => {
  it('exists in the database', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('refresh_tokens');
  });

  it('has required columns', () => {
    const cols = db
      .prepare('PRAGMA table_info(refresh_tokens)')
      .all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('user_id');
    expect(names).toContain('token_hash');
    expect(names).toContain('family');
    expect(names).toContain('expires_at');
    expect(names).toContain('revoked_at');
  });
});
