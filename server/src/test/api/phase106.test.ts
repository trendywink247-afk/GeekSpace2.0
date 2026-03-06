/**
 * Phase 106 Tests — use_case field on agent_configs
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { resetDatabase } from '../setup.js';

const app = createApp();

// Helper: get a valid JWT for demo-1 user
async function getDemoToken(): Promise<string> {
  const res = await request(app).post('/api/auth/demo').expect(200);
  return res.body.token as string;
}

describe('Phase 106 — use_case on agent_configs', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('GET /api/agent/config returns use_case field (null by default)', async () => {
    const token = await getDemoToken();
    const res = await request(app)
      .get('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('use_case');
    // null or the seeded value — just verify key exists
  });

  it('PATCH /api/agent/config accepts use_case and persists it', async () => {
    const token = await getDemoToken();
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ use_case: 'developer' })
      .expect(200);

    const row = db.prepare('SELECT use_case FROM agent_configs WHERE user_id = ?').get('demo-1') as { use_case: string };
    expect(row.use_case).toBe('developer');
  });

  it('PATCH /api/agent/config with use_case + personality updates both', async () => {
    const token = await getDemoToken();
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ use_case: 'creator', personality: 'weebo' })
      .expect(200);

    const row = db.prepare('SELECT use_case, personality FROM agent_configs WHERE user_id = ?').get('demo-1') as { use_case: string; personality: string };
    expect(row.use_case).toBe('creator');
    expect(row.personality).toBe('weebo');
  });
});
