import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Search Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    // Clean search-related tables
    try { db.prepare('DELETE FROM notes').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM reminders').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM habits').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM user_memories').run(); } catch { /* ignore */ }
    try { db.prepare('DELETE FROM conversation_log').run(); } catch { /* ignore */ }
    resetDatabase();
  });

  // ── Notes search ──────────────────────────────────────────

  it('should return notes matching query', async () => {
    const user = createTestUser();

    db.prepare(`
      INSERT INTO notes (user_id, title, content, archived)
      VALUES (?, ?, ?, 0)
    `).run(user.id, 'Meeting Notes', 'Discussed the quarterly budget review');

    db.prepare(`
      INSERT INTO notes (user_id, title, content, archived)
      VALUES (?, ?, ?, 0)
    `).run(user.id, 'Shopping List', 'Buy groceries and supplies');

    const res = await request(app)
      .get('/api/search?q=budget')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);

    const noteResults = res.body.results.filter((r: { type: string }) => r.type === 'note');
    expect(noteResults.length).toBeGreaterThanOrEqual(1);
    expect(noteResults[0]).toHaveProperty('title', 'Meeting Notes');
    expect(noteResults[0]).toHaveProperty('url');

    cleanupTestUser(user.id);
  });

  // ── Reminders search ──────────────────────────────────────

  it('should return reminders matching query', async () => {
    const user = createTestUser();

    const remId = uuid();
    db.prepare(`
      INSERT INTO reminders (id, user_id, text, completed)
      VALUES (?, ?, ?, 0)
    `).run(remId, user.id, 'Call dentist appointment tomorrow');

    const res = await request(app)
      .get('/api/search?q=dentist')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const reminderResults = res.body.results.filter((r: { type: string }) => r.type === 'reminder');
    expect(reminderResults.length).toBeGreaterThanOrEqual(1);
    expect(reminderResults[0].title).toContain('dentist');
    expect(reminderResults[0]).toHaveProperty('url', '/dashboard/reminders');

    cleanupTestUser(user.id);
  });

  // ── Memories search ───────────────────────────────────────

  it('should return memories matching query', async () => {
    const user = createTestUser();

    db.prepare(`
      INSERT INTO user_memories (user_id, key, value)
      VALUES (?, ?, ?)
    `).run(user.id, 'favorite_food', 'Pizza with extra cheese');

    const res = await request(app)
      .get('/api/search?q=pizza')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const memoryResults = res.body.results.filter((r: { type: string }) => r.type === 'memory');
    expect(memoryResults.length).toBeGreaterThanOrEqual(1);
    expect(memoryResults[0]).toHaveProperty('url', '/dashboard/personal-memory');

    cleanupTestUser(user.id);
  });

  // ── Empty query ───────────────────────────────────────────

  it('should return empty results for empty query', async () => {
    const user = createTestUser();

    const res = await request(app)
      .get('/api/search?q=')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toEqual({ results: [] });

    cleanupTestUser(user.id);
  });

  it('should return empty results for single character query', async () => {
    const user = createTestUser();

    const res = await request(app)
      .get('/api/search?q=a')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toEqual({ results: [] });

    cleanupTestUser(user.id);
  });

  // ── User scoping ─────────────────────────────────────────

  it('should not return results from other users', async () => {
    const user1 = createTestUser({ prefix: 'search-user1' });
    const user2 = createTestUser({ prefix: 'search-user2' });

    db.prepare(`
      INSERT INTO notes (user_id, title, content, archived)
      VALUES (?, ?, ?, 0)
    `).run(user1.id, 'Secret Project Alpha', 'Top secret information about Alpha');

    db.prepare(`
      INSERT INTO notes (user_id, title, content, archived)
      VALUES (?, ?, ?, 0)
    `).run(user2.id, 'Public Note', 'This is a public note');

    // User2 should NOT see user1's notes
    const res = await request(app)
      .get('/api/search?q=Alpha')
      .set('Authorization', makeAuthHeader(user2.id))
      .expect(200);

    const noteResults = res.body.results.filter((r: { type: string }) => r.type === 'note');
    expect(noteResults.length).toBe(0);

    // User1 SHOULD see their own note
    const res1 = await request(app)
      .get('/api/search?q=Alpha')
      .set('Authorization', makeAuthHeader(user1.id))
      .expect(200);

    const user1Notes = res1.body.results.filter((r: { type: string }) => r.type === 'note');
    expect(user1Notes.length).toBe(1);

    cleanupTestUser(user1.id);
    cleanupTestUser(user2.id);
  });

  // ── Types filter ──────────────────────────────────────────

  it('should filter results by types parameter', async () => {
    const user = createTestUser();

    db.prepare(`
      INSERT INTO notes (user_id, title, content, archived)
      VALUES (?, ?, ?, 0)
    `).run(user.id, 'Testing Search', 'Testing the search feature');

    const remId = uuid();
    db.prepare(`
      INSERT INTO reminders (id, user_id, text, completed)
      VALUES (?, ?, ?, 0)
    `).run(remId, user.id, 'Testing reminder search');

    // Only request reminders type
    const res = await request(app)
      .get('/api/search?q=testing&types=reminders')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const noteResults = res.body.results.filter((r: { type: string }) => r.type === 'note');
    const reminderResults = res.body.results.filter((r: { type: string }) => r.type === 'reminder');

    // Should have reminders but no notes
    expect(noteResults.length).toBe(0);
    expect(reminderResults.length).toBeGreaterThanOrEqual(1);

    cleanupTestUser(user.id);
  });

  // ── Limit parameter ──────────────────────────────────────

  it('should cap results with limit parameter', async () => {
    const user = createTestUser();

    // Insert multiple notes
    for (let i = 0; i < 8; i++) {
      db.prepare(`
        INSERT INTO notes (user_id, title, content, archived)
        VALUES (?, ?, ?, 0)
      `).run(user.id, `Searchable Note ${i}`, `This is searchable content number ${i}`);
    }

    const res = await request(app)
      .get('/api/search?q=searchable&limit=3')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.results.length).toBeLessThanOrEqual(3);

    cleanupTestUser(user.id);
  });

  // ── Authentication required ───────────────────────────────

  it('should require authentication', async () => {
    await request(app)
      .get('/api/search?q=test')
      .expect(401);
  });
});
