// ============================================================
// Phase 45 — Unit tests for:
//   45.1 OG HTML template entity-escaping in portfolio routes
//        - User-controlled fields (name, headline) with XSS payloads
//          must be entity-encoded in the crawler HTML response
//   45.2 Duplicate DB index removed
//        - idx_reminders_user_due no longer exists
//        - idx_reminders_datetime (the canonical one) still exists
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';

const app = createApp();

// ── 45.1: OG HTML entity-escaping ─────────────────────────────────────────

describe('Phase 45.1 — OG HTML entity-escaping in portfolio crawler response', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });
  it('entity-encodes <script> in name when crawler requests portfolio', async () => {
    // Create a user with XSS payload in name
    const user = createTestUser(`xss-${Date.now()}@example.com`);

    // Update the user's name with an XSS payload directly in the DB
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run('<script>alert(1)</script>', user.id);

    // Create a portfolio for this user so the route finds it
    const username = `xss-user-${Date.now()}`;
    const existingPortfolio = db.prepare('SELECT user_id FROM portfolios WHERE user_id = ?').get(user.id);
    if (!existingPortfolio) {
      db.prepare(
        `INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, agent_enabled)
         VALUES (?, ?, ?, ?, '[]', '[]', '[]', 0)`
      ).run(user.id, username, 'Test headline <b>bold</b>', 'About me & more');
    } else {
      db.prepare('UPDATE portfolios SET username = ? WHERE user_id = ?').run(username, user.id);
    }

    // Request the portfolio page as a known crawler (Twitterbot)
    const res = await request(app)
      .get(`/api/portfolio/${username}`)
      .set('User-Agent', 'Twitterbot/1.0')
      .expect(200);

    const html = res.text;

    // The raw <script> tag must NOT appear in the response body
    expect(html).not.toContain('<script>alert(1)</script>');

    // The entity-encoded form must be present instead
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
  });

  it('entity-encodes double-quotes in headline to prevent attribute injection', async () => {
    const user = createTestUser(`quotes-${Date.now()}@example.com`);
    const username = `quote-user-${Date.now()}`;

    // headline with quotes that would break an HTML attribute
    const maliciousHeadline = 'Senior Dev " onload="alert(1)';
    db.prepare(
      `INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, agent_enabled)
       VALUES (?, ?, ?, ?, '[]', '[]', '[]', 0)`
    ).run(user.id, username, maliciousHeadline, 'Bio');

    const res = await request(app)
      .get(`/api/portfolio/${username}`)
      .set('User-Agent', 'facebookexternalhit/1.1')
      .expect(200);

    const html = res.text;

    // The raw quote must not appear unencoded inside an attribute
    // The encoded form must be present
    expect(html).toContain('&quot;');
    // The raw injection attempt must not appear verbatim
    expect(html).not.toContain('" onload="alert(1)');
  });

  it('entity-encodes ampersands in description', async () => {
    const user = createTestUser(`amp-${Date.now()}@example.com`);
    const username = `amp-user-${Date.now()}`;

    db.prepare(
      `INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, agent_enabled)
       VALUES (?, ?, ?, ?, '[]', '[]', '[]', 0)`
    ).run(user.id, username, 'Rock & Roll Dev', 'R&D engineer');

    const res = await request(app)
      .get(`/api/portfolio/${username}`)
      .set('User-Agent', 'Googlebot/2.1')
      .expect(200);

    const html = res.text;
    expect(html).toContain('&amp;');
    // Raw unencoded & should not appear (there will be &amp; instead)
    // Note: HTML entities like &amp; contain & so we check the specific pattern
    expect(html).not.toMatch(/content="[^"]*Rock & Roll/);
  });
});

// ── 45.2: Duplicate DB index removed ──────────────────────────────────────

describe('Phase 45.2 — duplicate reminders index cleanup', () => {
  beforeAll(() => { resetDatabase(); });
  it('idx_reminders_datetime still exists (canonical index from Phase 30)', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_reminders%'"
    ).all() as { name: string }[];
    const names = new Set(indexes.map((i) => i.name));
    expect(names.has('idx_reminders_datetime')).toBe(true);
  });

  it('idx_reminders_user_due no longer exists (removed as duplicate in Phase 45.2)', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name = 'idx_reminders_user_due'"
    ).all() as { name: string }[];
    expect(indexes).toHaveLength(0);
  });

  it('no two indexes on reminders table cover the exact same columns', () => {
    const indexes = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name = 'reminders'"
    ).all() as { name: string; sql: string | null }[];

    // Build a map of column-set → index names to detect true duplicates
    const colMap = new Map<string, string[]>();
    for (const idx of indexes) {
      if (!idx.sql) continue; // auto-index (primary key etc.)
      // Extract columns from CREATE INDEX sql: "CREATE INDEX ... ON table(col1, col2)"
      const match = idx.sql.match(/\(([^)]+)\)/);
      if (!match) continue;
      // Normalize: lowercase, strip whitespace and direction keywords
      const cols = match[1]
        .split(',')
        .map((c) => c.trim().toLowerCase().replace(/\s+(asc|desc)$/i, ''))
        .sort()
        .join(',');
      if (!colMap.has(cols)) colMap.set(cols, []);
      colMap.get(cols)!.push(idx.name);
    }

    // No column set should be covered by more than one user-defined index
    for (const [cols, names] of colMap) {
      expect(names, `Duplicate indexes on reminders(${cols}): ${names.join(', ')}`).toHaveLength(1);
    }
  });
});

// ── 45.8: ETag caching for portfolio public endpoint ──────────────────────

describe('Phase 45.8 — ETag caching for portfolio public endpoint', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns ETag header on GET /portfolio/:username', async () => {
    const user = createTestUser(`etag-${Date.now()}@example.com`);
    const username = `etag-user-${Date.now()}`;
    db.prepare(
      `INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, agent_enabled)
       VALUES (?, ?, ?, ?, '[]', '[]', '[]', 0)`
    ).run(user.id, username, 'ETag Test Headline', 'About me');

    const res = await request(app)
      .get(`/api/portfolio/${username}`)
      .set('User-Agent', 'Mozilla/5.0 (compatible browser)')
      .expect(200);

    // ETag header must be present and non-empty
    expect(res.headers['etag']).toBeDefined();
    expect(typeof res.headers['etag']).toBe('string');
    expect(res.headers['etag'].length).toBeGreaterThan(0);

    // Cache-Control must be set for public caching
    expect(res.headers['cache-control']).toBeDefined();
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('max-age=300');
  });

  it('returns 304 when ETag matches (If-None-Match)', async () => {
    const user = createTestUser(`etag304-${Date.now()}@example.com`);
    const username = `etag304-user-${Date.now()}`;
    db.prepare(
      `INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, agent_enabled)
       VALUES (?, ?, ?, ?, '[]', '[]', '[]', 0)`
    ).run(user.id, username, 'ETag 304 Headline', 'About 304');

    // First request — get the ETag
    const firstRes = await request(app)
      .get(`/api/portfolio/${username}`)
      .set('User-Agent', 'Mozilla/5.0 (compatible browser)')
      .expect(200);

    const etag = firstRes.headers['etag'] as string;
    expect(etag).toBeDefined();

    // Second request — send the ETag back via If-None-Match → expect 304
    const secondRes = await request(app)
      .get(`/api/portfolio/${username}`)
      .set('User-Agent', 'Mozilla/5.0 (compatible browser)')
      .set('If-None-Match', etag)
      .expect(304);

    // 304 must have no body
    expect(secondRes.text).toBe('');
  });
});
