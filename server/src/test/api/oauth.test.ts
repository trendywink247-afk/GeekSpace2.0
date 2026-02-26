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
  beforeAll(() => { resetDatabase(); });

  it('GET /api/oauth/status returns google and github booleans', async () => {
    const res = await request(app).get('/api/oauth/status').expect(200);
    expect(res.body).toHaveProperty('google');
    expect(res.body).toHaveProperty('github');
    expect(typeof res.body.google).toBe('boolean');
    expect(typeof res.body.github).toBe('boolean');
  });

  it('GET /api/oauth/google/callback with error query redirects to login', async () => {
    const res = await request(app).get('/api/oauth/google/callback?error=access_denied').expect(302);
    expect(res.headers.location).toContain('/login');
    expect(res.headers.location).toContain('Google%20sign-in%20was%20cancelled');
  });

  it('GET /api/oauth/github/callback with error query redirects to login', async () => {
    const res = await request(app).get('/api/oauth/github/callback?error=access_denied').expect(302);
    expect(res.headers.location).toContain('/login');
    expect(res.headers.location).toContain('GitHub%20sign-in%20was%20cancelled');
  });

  it('GET /api/oauth/google redirects or errors depending on config', async () => {
    if (!config.googleClientId) {
      const res = await request(app).get('/api/oauth/google');
      expect([302, 500]).toContain(res.status);
      return;
    }
    const res = await request(app).get('/api/oauth/google').expect(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  it('GET /api/oauth/github redirects or errors depending on config', async () => {
    if (!config.githubClientId) {
      const res = await request(app).get('/api/oauth/github');
      expect([302, 500]).toContain(res.status);
      return;
    }
    const res = await request(app).get('/api/oauth/github').expect(302);
    expect(res.headers.location).toContain('github.com');
  });
});
