/**
 * Phase 92 -- Security Hardening Tests
 * Covers: brute-force guard, CSP report endpoint, HSTS, JWT blocklist, webhook sig null-guard
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { generateTestToken, createTestUser } from './setup.js';
import {
  isLoginBlocked,
  recordFailedLogin,
  clearLoginAttempts,
  MAX_ATTEMPTS,
  WINDOW_MS,
  _resetForTesting,
} from '../services/login-guard.js';

// --- helpers ---

const srcPath = (...parts: string[]) => join(__dirname, '..', ...parts);
const readSrc = (...parts: string[]) => readFileSync(srcPath(...parts), 'utf-8');

// --- 92.2  Login-guard brute-force protection (unit) ---

describe('92.2 login-guard brute force protection', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it('exports MAX_ATTEMPTS = 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('exports WINDOW_MS = 900000 (15 min)', () => {
    expect(WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it('new IP is not blocked', () => {
    const result = isLoginBlocked('1.2.3.4');
    expect(result.blocked).toBe(false);
    expect(result.retryAfterMs).toBe(0);
  });

  it('does not block after 4 failed attempts', () => {
    for (let i = 0; i < 4; i++) recordFailedLogin('10.0.0.1');
    expect(isLoginBlocked('10.0.0.1').blocked).toBe(false);
  });

  it('blocks after MAX_ATTEMPTS (5) failed attempts', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedLogin('10.0.0.2');
    expect(isLoginBlocked('10.0.0.2').blocked).toBe(true);
  });

  it('recordFailedLogin returns blocked=true on the 5th call', () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordFailedLogin('10.0.0.3');
    const result = recordFailedLogin('10.0.0.3');
    expect(result.blocked).toBe(true);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('clearLoginAttempts removes block', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedLogin('10.0.0.4');
    expect(isLoginBlocked('10.0.0.4').blocked).toBe(true);
    clearLoginAttempts('10.0.0.4');
    expect(isLoginBlocked('10.0.0.4').blocked).toBe(false);
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedLogin('10.0.0.5');
    expect(isLoginBlocked('10.0.0.5').blocked).toBe(true);
    expect(isLoginBlocked('10.0.0.6').blocked).toBe(false);
  });
});

// --- 92.1 + 92.4  CSP configuration ---

describe('92.1 + 92.4 CSP configuration', () => {
  it('app.ts disables Helmet CSP (Caddy handles CSP)', () => {
    const src = readSrc('app.ts');
    expect(src).toMatch(/contentSecurityPolicy:\s*false/);
  });

  it('app.ts registers POST /api/csp-report route', () => {
    const src = readSrc('app.ts');
    expect(src).toMatch(/post.*csp-report/i);
  });

  it('POST /api/csp-report returns 204', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/json')
      .send({ 'csp-report': { 'blocked-uri': 'https://evil.example' } });
    expect(res.status).toBe(204);
  });
});

// --- 92.5  HSTS preload header ---

describe('92.5 HSTS preload header', () => {
  it('app.ts sets HSTS with preload + includeSubDomains + 1-year max-age', () => {
    const src = readSrc('app.ts');
    expect(src).toMatch(/preload/);
    expect(src).toMatch(/includeSubDomains/);
    expect(src).toMatch(/31536000/);
  });
});

// --- 92.6  JWT token blocklist ---

describe('92.6 JWT token blocklist', () => {
  it('signToken embeds jti in payload (middleware/auth.ts)', () => {
    const src = readSrc('middleware', 'auth.ts');
    expect(src).toMatch(/jti/);
    expect(src).toMatch(/uuid/);
  });

  it('requireAuth checks token_blocklist table', () => {
    const src = readSrc('middleware', 'auth.ts');
    expect(src).toMatch(/token_blocklist/);
    expect(src).toMatch(/Token has been invalidated/);
  });

  it('/logout endpoint exists in routes/auth.ts', () => {
    const src = readSrc('modules', 'auth', 'routes', 'auth.ts');
    expect(src).toMatch(/logout/);
    expect(src).toMatch(/token_blocklist/);
  });

  it('token_blocklist table exists in DB schema', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toMatch(/token_blocklist/);
    expect(src).toMatch(/jti TEXT PRIMARY KEY/);
  });

  it('token_blocklist table is created in the live DB', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='token_blocklist'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('token_blocklist');
  });
});

// --- 92.7  WhatsApp webhook signature null guard ---

describe('92.7 WhatsApp webhook signature null guard', () => {
  it('whatsapp.ts guards against null signature', () => {
    const src = readSrc('modules', 'integrations', 'services', 'whatsapp.ts');
    expect(src).toMatch(/null/);
    expect(src).toMatch(/sha256=/);
  });

  it('whatsapp.ts has try/catch around timingSafeEqual', () => {
    const src = readSrc('modules', 'integrations', 'services', 'whatsapp.ts');
    expect(src).toMatch(/try/);
    expect(src).toMatch(/timingSafeEqual/);
  });

  it('whatsapp.ts strips sha256= prefix before comparison', () => {
    const src = readSrc('modules', 'integrations', 'services', 'whatsapp.ts');
    expect(src).toMatch(/replace.*sha256=/);
  });
});

// --- 92.2  auth.ts login route integration (static) ---

describe('92.2 auth.ts login route brute-force integration', () => {
  it('imports isLoginBlocked, recordFailedLogin, clearLoginAttempts', () => {
    const src = readSrc('modules', 'auth', 'routes', 'auth.ts');
    expect(src).toMatch(/isLoginBlocked/);
    expect(src).toMatch(/recordFailedLogin/);
    expect(src).toMatch(/clearLoginAttempts/);
  });

  it('returns 429 when IP is already blocked', async () => {
    _resetForTesting();
    // Exhaust the limit for this IP
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailedLogin('127.0.0.1');
    }
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.1')
      .send({ email: 'x@x.com', password: 'wrong' });
    expect(res.status).toBe(429);
    _resetForTesting();
  });

  it('clears attempts on successful login', async () => {
    _resetForTesting();
    const user = await createTestUser();
    const app = createApp();
    recordFailedLogin('127.0.0.2');
    recordFailedLogin('127.0.0.2');
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '127.0.0.2')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(isLoginBlocked('127.0.0.2').blocked).toBe(false);
    _resetForTesting();
  });
});

// --- 92.6  Functional: logout endpoint ---

describe('92.6 JWT logout functional test', () => {
  it('POST /api/auth/login with wrong password returns 401', async () => {
    _resetForTesting();
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    _resetForTesting();
  });

  it('POST /api/auth/logout with valid token returns success', async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('token_blocklist table has jti column', () => {
    const cols = db
      .prepare("PRAGMA table_info(token_blocklist)")
      .all() as Array<{ name: string }>;
    const names = cols.map(c => c.name);
    expect(names).toContain('jti');
    expect(names).toContain('user_id');
    expect(names).toContain('expires_at');
  });
});
