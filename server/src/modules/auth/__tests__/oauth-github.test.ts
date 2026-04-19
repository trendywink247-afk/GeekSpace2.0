import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { http, HttpResponse } from 'msw';
import { createApp } from '../../../app.js';
import { db } from '../../../db/index.js';
import { resetDatabase } from '../../../test/setup.js';
import { server } from '../../../test/mocks/server.js';
import { TEST_GITHUB_USER } from '../../../test/mocks/handlers/github.js';

const app = createApp();

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, b64] = token.split('.');
  return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
}

describe('GitHub OAuth Callback — GET /api/oauth/github/callback', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  // ── Error path: user denied consent ────────────────────────────────

  it('redirects to login when GitHub returns an error param (user denied)', async () => {
    const res = await request(app)
      .get('/api/oauth/github/callback?error=access_denied&error_description=User+denied+access');

    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.location as string)).toContain('GitHub sign-in was cancelled');
    expect(res.headers.location).toContain('/login?error=');
  });

  // ── Happy path: new user ────────────────────────────────────────────

  it('creates a new user with github details and redirects with JWT on first login', async () => {
    let tokenExchangeCount = 0;
    server.use(
      http.post('https://github.com/login/oauth/access_token', () => {
        tokenExchangeCount++;
        return HttpResponse.json({
          access_token: 'mock-github-access-token',
          token_type: 'bearer',
          scope: 'read:user,user:email',
        });
      }),
    );

    const res = await request(app)
      .get('/api/oauth/github/callback?code=test-auth-code&state=test-state');

    expect(res.status).toBe(302);

    const location = res.headers.location as string;
    expect(location).toContain('/oauth/callback?token=');

    // Token endpoint called exactly once
    expect(tokenExchangeCount).toBe(1);

    // User persisted with GitHub identifiers
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(TEST_GITHUB_USER.email) as Record<string, unknown>;

    expect(user).toBeDefined();
    expect(user.github_id).toBe(String(TEST_GITHUB_USER.id));
    expect(user.github_username).toBe(TEST_GITHUB_USER.login);
    expect(user.password_hash).toBe('oauth:github:no-password');

    // JWT in redirect URL references the new user
    const token = new URL(location, 'http://localhost').searchParams.get('token')!;
    expect(decodeJwtPayload(token).sub).toBe(user.id);
  });

  // ── Happy path: existing user (linking) ────────────────────────────

  it('links github_id to an existing account and does not create a duplicate', async () => {
    const userId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, username, password_hash, name) VALUES (?, ?, 'preexist_gh', 'some-hash', 'Pre Existing')`
    ).run(userId, TEST_GITHUB_USER.email);

    const res = await request(app)
      .get('/api/oauth/github/callback?code=test-auth-code&state=test-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/oauth/callback?token=');

    // github_id was linked
    const updated = db
      .prepare('SELECT github_id, github_username FROM users WHERE id = ?')
      .get(userId) as { github_id: string; github_username: string };
    expect(updated.github_id).toBe(String(TEST_GITHUB_USER.id));

    // No duplicate user created
    const { cnt } = db
      .prepare('SELECT COUNT(*) as cnt FROM users WHERE email = ?')
      .get(TEST_GITHUB_USER.email) as { cnt: number };
    expect(cnt).toBe(1);

    // JWT references the pre-existing user
    const token = new URL(res.headers.location as string, 'http://localhost').searchParams.get('token')!;
    expect(decodeJwtPayload(token).sub).toBe(userId);
  });

  // ── Email visibility edge case ──────────────────────────────────────

  it('uses primary email from /user/emails when GitHub profile email is private (null)', async () => {
    // GitHub returns null email on /user when the user has made it private;
    // passport-github2 falls back to /user/emails (always fetched with user:email scope).
    server.use(
      http.get('https://api.github.com/user', () => {
        return HttpResponse.json({
          id: TEST_GITHUB_USER.id,
          login: TEST_GITHUB_USER.login,
          name: TEST_GITHUB_USER.name,
          email: null,
          avatar_url: TEST_GITHUB_USER.avatar_url,
        });
      }),
    );

    const res = await request(app)
      .get('/api/oauth/github/callback?code=test-auth-code&state=test-state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/oauth/callback?token=');

    // User created using email from /user/emails handler (testuser@github.com)
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(TEST_GITHUB_USER.email) as Record<string, unknown>;

    expect(user).toBeDefined();
    expect(user.github_id).toBe(String(TEST_GITHUB_USER.id));
    expect(user.email).toBe(TEST_GITHUB_USER.email);
  });

  // ── Error path: token exchange failure ─────────────────────────────

  it('returns 500 when the GitHub token exchange endpoint fails', async () => {
    server.use(
      http.post('https://github.com/login/oauth/access_token', () => {
        return HttpResponse.json({ error: 'bad_verification_code' }, { status: 400 });
      }),
    );

    const res = await request(app)
      .get('/api/oauth/github/callback?code=bad-code&state=test-state');

    // passport-oauth2 calls next(err) on token exchange failure;
    // the global error handler converts this to 500.
    expect(res.status).toBe(500);
  });
});
