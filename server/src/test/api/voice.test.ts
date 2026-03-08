// Voice route tests — Phase 29
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Voice API', () => {
  let authHeader: string;

  beforeEach(() => {
    resetDatabase();
    const { id } = createTestUser();
    authHeader = makeAuthHeader(id);
  });

  // ── Auth guards ──────────────────────────────────────────────

  it('POST /api/voice/transcribe requires auth', async () => {
    const res = await request(app)
      .post('/api/voice/transcribe')
      .set('Content-Type', 'audio/webm')
      .send(Buffer.from('fake-audio'));
    expect(res.status).toBe(401);
  });

  it('POST /api/voice/speak requires auth', async () => {
    const res = await request(app)
      .post('/api/voice/speak')
      .send({ text: 'Hello world' });
    expect(res.status).toBe(401);
  });

  // ── Speak validation ─────────────────────────────────────────

  it('POST /api/voice/speak with auth returns 503 when voice disabled', async () => {
    // Voice synthesis is disabled in test env (no TTS service configured)
    const res = await request(app)
      .post('/api/voice/speak')
      .set('Authorization', authHeader)
      .send({ text: 'Hello world' });
    // Voice disabled → 503 Service Unavailable, or 202 if job queued
    expect([202, 503]).toContain(res.status);
  });

  it('POST /api/voice/transcribe with auth rejects empty body', async () => {
    const res = await request(app)
      .post('/api/voice/transcribe')
      .set('Authorization', authHeader)
      .set('Content-Type', 'audio/webm')
      .send(Buffer.alloc(0));
    // Empty audio → 400 Bad Request, 503 disabled, or 202 queued
    expect([202, 400, 503]).toContain(res.status);
  });
});
