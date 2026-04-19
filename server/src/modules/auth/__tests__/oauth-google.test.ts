import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { createApp } from '../../../app.js';
import { db } from '../../../db/index.js';
import { resetDatabase } from '../../../test/setup.js';
import { server } from '../../../test/mocks/server.js';
import { TEST_GOOGLE_USER, GOOGLE_TOKEN_URL } from '../../../test/mocks/handlers/google.js';

const app = createApp();

// Decode a JWT payload without verifying the signature.
function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, b64] = token.split('.');
  return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
}

describe('Google OAuth Callback — GET /api/oauth/google/callback', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  // ── Error path: user denied consent ────────────────────────────────

  it('redirects to login when Google returns an error param (user denied)', async () => {
    const res = await request(app)
      .get('/api/oauth/google/callback?error=access_denied&error_description=Permissions+denied');

    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.location as string)).toContain('Google sign-in was cancelled');
    expect(res.headers.location).toContain('/login?error=');
  });

  it('redirects to login for any OAuth provider error', async () => {
    const res = await request(app)
      .get('/api/oauth/google/callback?error=server_error');

    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.location as string)).toContain('Google sign-in was cancelled');
  });

  // ── Happy path: new user ────────────────────────────────────────────

  it('creates a new user in the DB and redirects with JWT on first login', async () => {
    let tokenExchangeCount = 0;
    server.use(
      http.post(GOOGLE_TOKEN_URL, () => {
        tokenExchangeCount++;
        return HttpResponse.json({
          access_token: 'mock-google-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        });
      }),
    );

    const res = await request(app)
      .get('/api/oauth/google/callback?code=test-auth-code&state=test-state');

    expect(res.status).toBe(302);

    const location = res.headers.location as string;
    expect(location).toContain('/oauth/callback?token=');

    // Token endpoint called exactly once
    expect(tokenExchangeCount).toBe(1);

    // User persisted in DB
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(TEST_GOOGLE_USER.email) as Record<string, unknown>;

    expect(user).toBeDefined();
    expect(user.email).toBe(TEST_GOOGLE_USER.email);
    expect(user.name).toBe(TEST_GOOGLE_USER.name);
    expect(user.google_id).toBe(TEST_GOOGLE_USER.id);
    expect(user.password_hash).toBe('oauth:google:no-password');

    // JWT in redirect URL references the new user
    const token = new URL(location, 'http://localhost').searchParams.get('token')!;
    const payload = decodeJwtPayload(token);
    expect(payload.sub).toBe(user.id);
  });

  // ── Happy path: existing user (linking) ────────────────────────────

  it('links google_id to an existing account and does not create a duplicate', async () => {
    // Pre-existing user with same email but no google_id
    const userId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, username, password_hash, name) VALUES (?, ?, 'preexist_g', 'some-hash', 'Pre Existing')`
    ).run(userId, TEST_GOOGLE_USER.email);

    const res = await request(app)
      .get('/api/oauth/google/callback?code=test-auth-code&state=test-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/oauth/callback?token=');

    // google_id was linked
    const updated = db
      .prepare('SELECT google_id FROM users WHERE id = ?')
      .get(userId) as { google_id: string };
    expect(updated.google_id).toBe(TEST_GOOGLE_USER.id);

    // No duplicate user created
    const { cnt } = db
      .prepare('SELECT COUNT(*) as cnt FROM users WHERE email = ?')
      .get(TEST_GOOGLE_USER.email) as { cnt: number };
    expect(cnt).toBe(1);

    // JWT references the pre-existing user, not a new one
    const token = new URL(res.headers.location as string, 'http://localhost').searchParams.get('token')!;
    expect(decodeJwtPayload(token).sub).toBe(userId);
  });

  // ── Error path: token exchange failure ─────────────────────────────

  it('returns 500 when the Google token exchange endpoint fails', async () => {
    server.use(
      http.post(GOOGLE_TOKEN_URL, () => {
        return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }),
    );

    const res = await request(app)
      .get('/api/oauth/google/callback?code=bad-code&state=test-state');

    // passport-oauth2 calls next(err) on token exchange failure;
    // the global error handler converts this to 500.
    expect(res.status).toBe(500);
  });
});
