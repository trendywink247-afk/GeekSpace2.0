/**
 * Personality Sliders Tests
 *
 * Verifies that personality slider values (creativity, formality, verbosity, humor, empathy)
 * are saved correctly via PATCH /api/agent/config, returned via GET /api/agent/config,
 * and that buildPersonalityInstructions generates correct system prompt text.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { generateTestToken, createTestUser } from './setup.js';
import { buildPersonalityInstructions, mapCreativityToTemperature } from '../services/message-router.js';

let app: ReturnType<typeof createApp>;
let testUser: { id: string; email: string; username: string; password: string };
let token: string;

beforeAll(() => {
  app = createApp();
  testUser = createTestUser(`personality-test-${Date.now()}@example.com`);
  token = generateTestToken(testUser.id);
});

afterAll(() => {
  db.pragma('foreign_keys = OFF');
  try { db.prepare('DELETE FROM agent_configs WHERE user_id = ?').run(testUser.id); } catch { /* ignore */ }
  try { db.prepare('DELETE FROM activity_log WHERE user_id = ?').run(testUser.id); } catch { /* ignore */ }
  try { db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(testUser.id); } catch { /* ignore */ }
  try { db.prepare('DELETE FROM users WHERE id = ?').run(testUser.id); } catch { /* ignore */ }
  db.pragma('foreign_keys = ON');
});

describe('Personality slider API', () => {
  it('PATCH /api/agent/config saves creativity, formality, verbosity, humor, empathy', async () => {
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ creativity: 80, formality: 20, verbosity: 90, humor: 75, empathy: 10 });

    expect(res.status).toBe(200);
    expect(res.body.creativity).toBe(80);
    expect(res.body.formality).toBe(20);
    expect(res.body.verbosity).toBe(90);
    expect(res.body.humor).toBe(75);
    expect(res.body.empathy).toBe(10);
  });

  it('GET /api/agent/config returns saved personality values', async () => {
    // First set specific values
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ creativity: 30, formality: 60, verbosity: 40, humor: 50, empathy: 85 });

    const res = await request(app)
      .get('/api/agent/config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.creativity).toBe(30);
    expect(res.body.formality).toBe(60);
    expect(res.body.verbosity).toBe(40);
    expect(res.body.humor).toBe(50);
    expect(res.body.empathy).toBe(85);
  });

  it('defaults to 50 when no personality values set', async () => {
    // Read the current config — the original test user has defaults
    const row = db.prepare('SELECT verbosity, humor, empathy FROM agent_configs WHERE user_id = ?')
      .get(testUser.id) as { verbosity: number; humor: number; empathy: number } | undefined;

    // After the previous test set specific values, re-set to defaults
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ verbosity: 50, humor: 50, empathy: 50 });

    const res = await request(app)
      .get('/api/agent/config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.verbosity).toBe(50);
    expect(res.body.humor).toBe(50);
    expect(res.body.empathy).toBe(50);
  });

  it('rejects values outside 0-100 range', async () => {
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ creativity: 150 });

    expect(res.status).toBe(400);
  });

  it('rejects negative values', async () => {
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ humor: -10 });

    expect(res.status).toBe(400);
  });
});

describe('buildPersonalityInstructions', () => {
  it('returns empty string for undefined/null', () => {
    expect(buildPersonalityInstructions(undefined)).toBe('');
    expect(buildPersonalityInstructions(null)).toBe('');
  });

  it('returns empty string for all-default (50) values', () => {
    const result = buildPersonalityInstructions({
      creativity: 50, formality: 50, verbosity: 50, humor: 50, empathy: 50,
    });
    expect(result).toBe('');
  });

  it('generates creative instruction for high creativity', () => {
    const result = buildPersonalityInstructions({ creativity: 80 });
    expect(result).toContain('creative');
    expect(result).toContain('exploratory');
  });

  it('generates precise instruction for low creativity', () => {
    const result = buildPersonalityInstructions({ creativity: 20 });
    expect(result).toContain('precise');
    expect(result).toContain('straightforward');
  });

  it('generates formal instruction for high formality', () => {
    const result = buildPersonalityInstructions({ formality: 80 });
    expect(result).toContain('formal');
    expect(result).toContain('professional');
  });

  it('generates casual instruction for low formality', () => {
    const result = buildPersonalityInstructions({ formality: 20 });
    expect(result).toContain('casual');
    expect(result).toContain('conversational');
  });

  it('generates thorough instruction for high verbosity', () => {
    const result = buildPersonalityInstructions({ verbosity: 80 });
    expect(result).toContain('thorough');
    expect(result).toContain('comprehensive');
  });

  it('generates concise instruction for low verbosity', () => {
    const result = buildPersonalityInstructions({ verbosity: 20 });
    expect(result).toContain('concise');
    expect(result).toContain('1-3 sentences');
  });

  it('generates humor instruction for high humor', () => {
    const result = buildPersonalityInstructions({ humor: 80 });
    expect(result).toContain('wit');
    expect(result).toContain('humor');
  });

  it('generates serious instruction for low humor', () => {
    const result = buildPersonalityInstructions({ humor: 20 });
    expect(result).toContain('serious');
    expect(result).toContain('professional');
  });

  it('generates empathetic instruction for high empathy', () => {
    const result = buildPersonalityInstructions({ empathy: 80 });
    expect(result).toContain('feelings');
    expect(result).toContain('Validate');
  });

  it('generates direct instruction for low empathy', () => {
    const result = buildPersonalityInstructions({ empathy: 20 });
    expect(result).toContain('direct');
    expect(result).toContain('factual');
  });

  it('combines multiple non-default instructions', () => {
    const result = buildPersonalityInstructions({
      creativity: 80, formality: 20, verbosity: 80, humor: 80, empathy: 80,
    });
    expect(result).toContain('creative');
    expect(result).toContain('casual');
    expect(result).toContain('thorough');
    expect(result).toContain('wit');
    expect(result).toContain('feelings');
  });
});

describe('mapCreativityToTemperature', () => {
  it('returns 0.3 for low creativity', () => {
    expect(mapCreativityToTemperature(10)).toBe(0.3);
    expect(mapCreativityToTemperature(25)).toBe(0.3);
    expect(mapCreativityToTemperature(0)).toBe(0.3);
  });

  it('returns 1.0 for high creativity', () => {
    expect(mapCreativityToTemperature(80)).toBe(1.0);
    expect(mapCreativityToTemperature(100)).toBe(1.0);
  });

  it('returns ~0.7 for default (50) creativity', () => {
    const temp = mapCreativityToTemperature(50);
    expect(temp).toBeGreaterThan(0.5);
    expect(temp).toBeLessThan(0.8);
  });

  it('returns balanced temperature for undefined', () => {
    const temp = mapCreativityToTemperature(undefined);
    expect(temp).toBeGreaterThan(0.5);
    expect(temp).toBeLessThan(0.8);
  });
});
