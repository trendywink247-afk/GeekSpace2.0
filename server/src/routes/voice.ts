// ============================================================
// Voice API Routes — Phase 80
//
// POST /api/voice/transcribe — accepts audio blob (webm/ogg/mp4),
//   enqueues a voice:transcribe job, returns {jobId}
//
// POST /api/voice/speak — accepts {text, voice?},
//   enqueues a voice:synthesize job, returns {jobId}
//
// Both endpoints enforce a daily voice cap per plan tier
// (5 calls/day for free, higher for paid plans).
//
// Poll job status via GET /api/jobs/:id
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { enqueueJob, registerJobHandler } from '../services/job-queue.js';
import { transcribeVoice, textToSpeech, isVoiceEnabled } from '../services/voice.js';
import { v4 as uuid } from 'uuid';

export const voiceRouter = Router();

// ---- Daily voice cap per plan ----

const VOICE_DAILY_CAPS: Record<string, number> = {
  free: 5,
  pilot: 30,
  monthly: 30,
  intro: 30,
  halfyear: 60,
  yearly: 100,
};

function getVoiceCap(userId: string): { used: number; limit: number; allowed: boolean } {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan?: string } | undefined;
  const plan = user?.plan || 'free';
  const limit = VOICE_DAILY_CAPS[plan] ?? VOICE_DAILY_CAPS.free;

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM usage_events
    WHERE user_id = ? AND tool LIKE 'voice:%' AND date(created_at) = date('now')
  `).get(userId) as { count: number };

  const used = row.count;
  return { used, limit, allowed: used < limit };
}

function logVoiceUsage(userId: string, tool: 'voice.stt' | 'voice.tts', durationSec: number): void {
  db.prepare(`
    INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
    VALUES (?, ?, 'voice', 'whisper-1', ?, 0, 0, 'api', ?)
  `).run(uuid(), userId, Math.round(durationSec), tool);
}

// ---- 80.2: POST /api/voice/transcribe ----
// Accepts raw audio body (Content-Type: audio/*), enforces cap, enqueues job.

voiceRouter.post('/transcribe', requireAuth,
  // Parse raw audio body (up to 10MB). Applied per-route to avoid raising global limit.
  (req, res, next) => {
    const ct = req.headers['content-type'] || '';
    if (ct.startsWith('audio/') || ct.startsWith('video/') || ct.startsWith('application/octet-stream')) {
      let data: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        data.push(chunk);
        // Abort if body exceeds 10MB
        const total = data.reduce((s, b) => s + b.length, 0);
        if (total > 10 * 1024 * 1024) {
          data = [];
          res.status(413).json({ error: 'Audio file too large (max 10MB)' });
          req.destroy();
        }
      });
      req.on('end', () => {
        (req as AuthRequest & { rawBody: Buffer }).rawBody = Buffer.concat(data);
        next();
      });
      req.on('error', () => next());
    } else {
      next();
    }
  },
  async (req: AuthRequest, res) => {
    const userId = req.userId!;

    // 80.4: Daily cap check
    const cap = getVoiceCap(userId);
    if (!cap.allowed) {
      res.status(429).json({
        error: 'Voice limit reached. Upgrade to Basic or Pro to unlock more voice calls',
        used: cap.used,
        limit: cap.limit,
      });
      return;
    }

    const audioBuffer = (req as AuthRequest & { rawBody?: Buffer }).rawBody;
    if (!audioBuffer || audioBuffer.length === 0) {
      res.status(400).json({ error: 'No audio data received' });
      return;
    }

    const mimeType = req.headers['content-type'] || 'audio/webm';

    // Log usage immediately (before job completes, counts against cap)
    logVoiceUsage(userId, 'voice.stt', 0);

    const jobId = await enqueueJob(
      'voice:transcribe',
      { audioBuffer: audioBuffer.toString('base64'), mimeType },
      userId,
    );

    logger.info({ userId, jobId, bytes: audioBuffer.length }, 'Voice transcribe job enqueued');
    res.status(202).json({ jobId, message: 'Transcription started. Poll GET /api/jobs/:id for result.' });
  },
);

// ---- 80.3: POST /api/voice/speak ----
// Accepts JSON {text, voice?}, enforces cap, enqueues TTS job.

voiceRouter.post('/speak', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { text, voice } = req.body as { text?: string; voice?: string };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  // 80.4: Daily cap check
  const cap = getVoiceCap(userId);
  if (!cap.allowed) {
    res.status(429).json({
      error: 'Voice limit reached. Upgrade to Basic or Pro to unlock more voice calls',
      used: cap.used,
      limit: cap.limit,
    });
    return;
  }

  // Truncate text to TTS limit
  const truncated = text.length > 4096 ? text.slice(0, 4093) + '...' : text;

  // Log usage immediately
  logVoiceUsage(userId, 'voice.tts', 0);

  const jobId = await enqueueJob(
    'voice:synthesize',
    { text: truncated, voice: voice || 'nova' },
    userId,
  );

  logger.info({ userId, jobId, textLength: truncated.length }, 'Voice TTS job enqueued');
  res.status(202).json({ jobId, message: 'Speech synthesis started. Poll GET /api/jobs/:id for result.' });
});

// ---- 80.8: Register job handlers ----

registerJobHandler<{ audioBuffer: string; mimeType: string }, { text: string; duration_seconds: number }>(
  'voice:transcribe',
  async (payload) => {
    if (!isVoiceEnabled()) {
      // TODO: swap for local Whisper (e.g. via Ollama audio endpoint) when available
      throw new Error('Voice transcription not configured (missing OPENAI_API_KEY)');
    }

    const audioBuffer = Buffer.from(payload.audioBuffer, 'base64');
    const text = await transcribeVoice(audioBuffer, payload.mimeType);

    // Estimate duration from buffer size (~16kbps for voice webm)
    const duration_seconds = Math.max(1, Math.round(audioBuffer.length / 2000));

    return { text, duration_seconds };
  },
);

registerJobHandler<{ text: string; voice: string }, { audioBase64: string; mimeType: string }>(
  'voice:synthesize',
  async (payload) => {
    if (!isVoiceEnabled()) {
      // TODO: swap for piper-tts or local TTS when available
      throw new Error('TTS not configured (missing OPENAI_API_KEY)');
    }

    const audioBuffer = await textToSpeech(payload.text);
    return {
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/ogg',
    };
  },
);

logger.info('Voice routes initialized (voice:transcribe + voice:synthesize handlers registered)');
