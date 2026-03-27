/**
 * Phase 94 -- Long-term Agent Memory Tests
 * Covers: user_memories CRUD, service functions, API routes, context injection
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { generateTestToken, createTestUser, resetDatabase } from './setup.js';
import {
  getUserMemories,
  upsertUserMemory,
  deleteUserMemory,
  formatMemoryContext,
  extractMemoriesFromConversation,
} from '../services/memory.js';

// --- helpers ---

const srcPath = (...parts: string[]) => join(__dirname, '..', ...parts);
const readSrc = (...parts: string[]) => readFileSync(srcPath(...parts), 'utf-8');

beforeAll(() => {
  resetDatabase();
});

beforeEach(() => {
  try {
    db.prepare('DELETE FROM user_memories').run();
  } catch {
    // ignore
  }
});

// ─────────────────────────────────────────────
// 94.1  DB schema
// ─────────────────────────────────────────────

describe('94.1 user_memories DB schema', () => {
  it('user_memories table exists', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_memories'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('user_memories');
  });

  it('user_memories has required columns', () => {
    const cols = db
      .prepare('PRAGMA table_info(user_memories)')
      .all() as Array<{ name: string }>;
    const names = cols.map(c => c.name);
    expect(names).toContain('id');
    expect(names).toContain('user_id');
    expect(names).toContain('key');
    expect(names).toContain('value');
    expect(names).toContain('source');
    expect(names).toContain('confidence');
    expect(names).toContain('last_used');
    expect(names).toContain('created_at');
    expect(names).toContain('updated_at');
  });

  it('idx_user_memories_key unique index exists', () => {
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_user_memories_key'")
      .get() as { name: string } | undefined;
    expect(idx?.name).toBe('idx_user_memories_key');
  });
});

// ─────────────────────────────────────────────
// 94.2  Service: getUserMemories / upsertUserMemory / deleteUserMemory
// ─────────────────────────────────────────────

describe('94.2 getUserMemories service', () => {
  it('returns empty array for new user', () => {
    const mems = getUserMemories('no-such-user-999');
    expect(Array.isArray(mems)).toBe(true);
    expect(mems.length).toBe(0);
  });

  it('returns memories for a user', () => {
    const user = createTestUser(`mem-get-${Date.now()}@example.com`);
    upsertUserMemory(user.id, 'timezone', 'IST');
    const mems = getUserMemories(user.id);
    expect(mems.length).toBeGreaterThanOrEqual(1);
    expect(mems[0].key).toBe('timezone');
    expect(mems[0].value).toBe('IST');
  });

  it('returns all memories for a user', () => {
    const user = createTestUser(`mem-all-${Date.now()}@example.com`);
    upsertUserMemory(user.id, 'key1', 'val1');
    upsertUserMemory(user.id, 'key2', 'val2');
    upsertUserMemory(user.id, 'key3', 'val3');
    const mems = getUserMemories(user.id);
    expect(mems.length).toBe(3);
  });

  it('does not return memories of other users', () => {
    const u1 = createTestUser(`mem-u1-${Date.now()}@example.com`);
    const u2 = createTestUser(`mem-u2-${Date.now()}@example.com`);
    upsertUserMemory(u1.id, 'private_key', 'secret');
    const mems = getUserMemories(u2.id);
    expect(mems.every(m => m.key !== 'private_key')).toBe(true);
  });
});

describe('94.2 upsertUserMemory service', () => {
  it('creates a new memory', () => {
    const user = createTestUser(`mem-create-${Date.now()}@example.com`);
    const mem = upsertUserMemory(user.id, 'pref', 'TypeScript');
    expect(mem.id).toBeGreaterThan(0);
    expect(mem.key).toBe('pref');
    expect(mem.value).toBe('TypeScript');
    expect(mem.source).toBe('manual');
    expect(mem.confidence).toBe(1.0);
  });

  it('updates an existing memory with same key (upsert)', () => {
    const user = createTestUser(`mem-upsert-${Date.now()}@example.com`);
    upsertUserMemory(user.id, 'timezone', 'PST');
    upsertUserMemory(user.id, 'timezone', 'IST');
    const mems = getUserMemories(user.id);
    const tzMems = mems.filter(m => m.key === 'timezone');
    expect(tzMems.length).toBe(1);
    expect(tzMems[0].value).toBe('IST');
  });

  it('stores source and confidence', () => {
    const user = createTestUser(`mem-src-${Date.now()}@example.com`);
    const mem = upsertUserMemory(user.id, 'location', 'Mumbai', 'extracted', 0.8);
    expect(mem.source).toBe('extracted');
    expect(mem.confidence).toBeCloseTo(0.8);
  });

  it('returns the upserted memory object', () => {
    const user = createTestUser(`mem-ret-${Date.now()}@example.com`);
    const mem = upsertUserMemory(user.id, 'email_addr', 'test@test.com');
    expect(typeof mem.id).toBe('number');
    expect(mem.user_id).toBe(user.id);
  });
});

describe('94.2 deleteUserMemory service', () => {
  it('returns true when memory is deleted', () => {
    const user = createTestUser(`mem-del-${Date.now()}@example.com`);
    const mem = upsertUserMemory(user.id, 'to_delete', 'yes');
    const result = deleteUserMemory(user.id, mem.id);
    expect(result).toBe(true);
    const mems = getUserMemories(user.id);
    expect(mems.every(m => m.id !== mem.id)).toBe(true);
  });

  it('returns false when memory does not exist', () => {
    const user = createTestUser(`mem-del-miss-${Date.now()}@example.com`);
    const result = deleteUserMemory(user.id, 99999999);
    expect(result).toBe(false);
  });

  it('cannot delete another user memory', () => {
    const u1 = createTestUser(`mem-del-u1-${Date.now()}@example.com`);
    const u2 = createTestUser(`mem-del-u2-${Date.now()}@example.com`);
    const mem = upsertUserMemory(u1.id, 'secret', 'data');
    const result = deleteUserMemory(u2.id, mem.id);
    expect(result).toBe(false);
    const mems = getUserMemories(u1.id);
    expect(mems.some(m => m.id === mem.id)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 94.3  formatMemoryContext
// ─────────────────────────────────────────────

describe('94.3 formatMemoryContext', () => {
  it('returns empty string for user with no memories', () => {
    const ctx = formatMemoryContext('no-user-xyz-999');
    expect(ctx).toBe('');
  });

  it('returns formatted [User memories: ...] string', () => {
    const user = createTestUser(`mem-ctx-${Date.now()}@example.com`);
    upsertUserMemory(user.id, 'timezone', 'IST');
    const ctx = formatMemoryContext(user.id);
    expect(ctx).toMatch(/\[User memories:/);
    expect(ctx).toMatch(/timezone=IST/);
  });

  it('includes multiple key=value pairs separated by commas', () => {
    const user = createTestUser(`mem-ctx2-${Date.now()}@example.com`);
    upsertUserMemory(user.id, 'uname', 'Alex');
    upsertUserMemory(user.id, 'role', 'developer');
    const ctx = formatMemoryContext(user.id);
    expect(ctx).toMatch(/uname=Alex/);
    expect(ctx).toMatch(/role=developer/);
    expect(ctx).toContain(',');
  });
});

// ─────────────────────────────────────────────
// 94.4  extractMemoriesFromConversation
// ─────────────────────────────────────────────

describe('94.4 extractMemoriesFromConversation', () => {
  it('returns 0 for empty messages', () => {
    const user = createTestUser(`mem-extract-empty-${Date.now()}@example.com`);
    const count = extractMemoriesFromConversation(user.id, []);
    expect(count).toBe(0);
  });

  it('extracts preferred_name from "call me X"', () => {
    const user = createTestUser(`mem-extract-name-${Date.now()}@example.com`);
    extractMemoriesFromConversation(user.id, [
      { role: 'user', content: 'Call me Arjun' },
    ]);
    const mems = getUserMemories(user.id);
    const nameMem = mems.find(m => m.key === 'preferred_name');
    expect(nameMem?.value).toBe('Arjun');
  });

  it('extracts timezone from "my timezone is X"', () => {
    const user = createTestUser(`mem-extract-tz-${Date.now()}@example.com`);
    extractMemoriesFromConversation(user.id, [
      { role: 'user', content: 'My timezone is IST' },
    ]);
    const mems = getUserMemories(user.id);
    const tzMem = mems.find(m => m.key === 'timezone');
    expect(tzMem?.value).toBe('IST');
  });

  it('extracts location from "I am based in X"', () => {
    const user = createTestUser(`mem-extract-loc-${Date.now()}@example.com`);
    extractMemoriesFromConversation(user.id, [
      { role: 'user', content: 'I am based in Mumbai' },
    ]);
    const mems = getUserMemories(user.id);
    const locMem = mems.find(m => m.key === 'location');
    expect(locMem).toBeTruthy();
  });

  it('ignores assistant messages', () => {
    const user = createTestUser(`mem-extract-asst-${Date.now()}@example.com`);
    const count = extractMemoriesFromConversation(user.id, [
      { role: 'assistant', content: 'Call me GPT' },
    ]);
    expect(count).toBe(0);
    const mems = getUserMemories(user.id);
    expect(mems.length).toBe(0);
  });

  it('returns count of extracted memories', () => {
    const user = createTestUser(`mem-extract-count-${Date.now()}@example.com`);
    const count = extractMemoriesFromConversation(user.id, [
      { role: 'user', content: 'Call me Ravi. My timezone is IST' },
    ]);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('sets source to extracted with confidence 0.8', () => {
    const user = createTestUser(`mem-extract-src-${Date.now()}@example.com`);
    extractMemoriesFromConversation(user.id, [
      { role: 'user', content: 'My name is Priya' },
    ]);
    const mems = getUserMemories(user.id);
    const mem = mems.find(m => m.key === 'preferred_name');
    expect(mem?.source).toBe('extracted');
    expect(mem?.confidence).toBeCloseTo(0.8);
  });
});

// ─────────────────────────────────────────────
// 94.5  Static: source-code checks
// ─────────────────────────────────────────────

describe('94.5 static: memory routes and service files exist', () => {
  it('routes/memory.ts exports memoryRouter', () => {
    const src = readSrc('modules', 'memory', 'routes', 'memory.ts');
    expect(src).toMatch(/memoryRouter/);
    expect(src).toMatch(/Router/);
  });

  it('routes/memory.ts has GET / route', () => {
    const src = readSrc('modules', 'memory', 'routes', 'memory.ts');
    expect(src).toMatch(/get\(/);
  });

  it('routes/memory.ts has POST / route', () => {
    const src = readSrc('modules', 'memory', 'routes', 'memory.ts');
    expect(src).toMatch(/post\(/);
  });

  it('routes/memory.ts has DELETE route', () => {
    const src = readSrc('modules', 'memory', 'routes', 'memory.ts');
    expect(src).toMatch(/delete\(/);
  });

  it('routes/memory.ts has context route', () => {
    const src = readSrc('modules', 'memory', 'routes', 'memory.ts');
    expect(src).toMatch(/context/);
  });

  it('app.ts registers memoryModule (which registers memory routes)', () => {
    const src = readSrc('app.ts');
    expect(src).toMatch(/memoryModule/);
  });

  it('agent.ts imports formatMemoryContext', () => {
    const src = readSrc('routes', 'agent.ts');
    expect(src).toMatch(/formatMemoryContext/);
  });

  it('agent.ts calls formatMemoryContext in system prompt logic', () => {
    const src = readSrc('routes', 'agent.ts');
    expect(src).toMatch(/formatMemoryContext\s*\(/);
  });

  it('agent.ts imports extractMemoriesFromConversation', () => {
    const src = readSrc('routes', 'agent.ts');
    expect(src).toMatch(/extractMemoriesFromConversation/);
  });

  it('db/index.ts has user_memories CREATE TABLE', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toMatch(/user_memories/);
    expect(src).toMatch(/key TEXT NOT NULL/);
  });

  it('services/memory.ts exports getUserMemories', () => {
    const src = readSrc('modules', 'memory', 'services', 'memory.ts');
    expect(src).toMatch(/export function getUserMemories/);
  });

  it('services/memory.ts exports upsertUserMemory', () => {
    const src = readSrc('modules', 'memory', 'services', 'memory.ts');
    expect(src).toMatch(/export function upsertUserMemory/);
  });

  it('services/memory.ts exports deleteUserMemory', () => {
    const src = readSrc('modules', 'memory', 'services', 'memory.ts');
    expect(src).toMatch(/export function deleteUserMemory/);
  });

  it('services/memory.ts exports formatMemoryContext', () => {
    const src = readSrc('modules', 'memory', 'services', 'memory.ts');
    expect(src).toMatch(/export function formatMemoryContext/);
  });

  it('services/memory.ts exports extractMemoriesFromConversation', () => {
    const src = readSrc('modules', 'memory', 'services', 'memory.ts');
    expect(src).toMatch(/export function extractMemoriesFromConversation/);
  });
});

// ─────────────────────────────────────────────
// 94.6  API integration tests
// ─────────────────────────────────────────────

describe('94.6 GET /api/memory', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/memory');
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty memories for new user', async () => {
    const user = createTestUser(`mem-api-get-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .get('/api/memory')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.memories)).toBe(true);
  });

  it('returns user memories after creation', async () => {
    const user = createTestUser(`mem-api-get2-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    upsertUserMemory(user.id, 'test_key', 'test_value');
    const app = createApp();
    const res = await request(app)
      .get('/api/memory')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.memories.some((m: { key: string }) => m.key === 'test_key')).toBe(true);
  });
});

describe('94.6 POST /api/memory', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/memory')
      .send({ key: 'x', value: 'y' });
    expect(res.status).toBe(401);
  });

  it('creates a new memory (201)', async () => {
    const user = createTestUser(`mem-api-post-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .post('/api/memory')
      .set('Authorization', 'Bearer ' + token)
      .send({ key: 'favorite_lang', value: 'TypeScript' });
    expect(res.status).toBe(201);
    expect(res.body.memory.key).toBe('favorite_lang');
    expect(res.body.memory.value).toBe('TypeScript');
  });

  it('returns 400 when key is missing', async () => {
    const user = createTestUser(`mem-api-post-nokey-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .post('/api/memory')
      .set('Authorization', 'Bearer ' + token)
      .send({ value: 'something' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when value is missing', async () => {
    const user = createTestUser(`mem-api-post-noval-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .post('/api/memory')
      .set('Authorization', 'Bearer ' + token)
      .send({ key: 'something' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when key exceeds 100 chars', async () => {
    const user = createTestUser(`mem-api-post-longkey-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .post('/api/memory')
      .set('Authorization', 'Bearer ' + token)
      .send({ key: 'a'.repeat(101), value: 'val' });
    expect(res.status).toBe(400);
  });

  it('upserts on duplicate key', async () => {
    const user = createTestUser(`mem-api-upsert-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    await request(app)
      .post('/api/memory')
      .set('Authorization', 'Bearer ' + token)
      .send({ key: 'city', value: 'Delhi' });
    const res2 = await request(app)
      .post('/api/memory')
      .set('Authorization', 'Bearer ' + token)
      .send({ key: 'city', value: 'Mumbai' });
    expect(res2.status).toBe(201);
    const listRes = await request(app)
      .get('/api/memory')
      .set('Authorization', 'Bearer ' + token);
    const cityMems = listRes.body.memories.filter((m: { key: string }) => m.key === 'city');
    expect(cityMems.length).toBe(1);
    expect(cityMems[0].value).toBe('Mumbai');
  });
});

describe('94.6 DELETE /api/memory/:id', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/memory/1');
    expect(res.status).toBe(401);
  });

  it('deletes an existing memory', async () => {
    const user = createTestUser(`mem-api-del-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const mem = upsertUserMemory(user.id, 'to_del_api', 'delete_me');
    const app = createApp();
    const res = await request(app)
      .delete('/api/memory/' + mem.id)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 when memory does not exist', async () => {
    const user = createTestUser(`mem-api-del-miss-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .delete('/api/memory/99999999')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const user = createTestUser(`mem-api-del-inv-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .delete('/api/memory/not-a-number')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(400);
  });
});

describe('94.6 GET /api/memory/context', () => {
  it('returns 401 without auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/memory/context');
    expect(res.status).toBe(401);
  });

  it('returns context string with memories', async () => {
    const user = createTestUser(`mem-api-ctx-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    upsertUserMemory(user.id, 'ctx_key', 'ctx_val');
    const app = createApp();
    const res = await request(app)
      .get('/api/memory/context')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(typeof res.body.context).toBe('string');
    expect(res.body.context).toMatch(/ctx_key=ctx_val/);
  });

  it('returns empty string context when no memories', async () => {
    const user = createTestUser(`mem-api-ctx-empty-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const app = createApp();
    const res = await request(app)
      .get('/api/memory/context')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.context).toBe('');
  });
});
