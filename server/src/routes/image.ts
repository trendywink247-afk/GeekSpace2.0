// ============================================================
// Async Image Generation Routes — Phase 81
//
// POST /api/image/generate — accepts {prompt, style?},
//   checks daily cap via usage_events, enqueues image:generate
//   job, returns 202 {jobId}.
//
// GET /api/image/gallery — last 30 user images.
//
// GET /api/image/file/:id — redirect to stored image URL.
//
// Cap: 5/day free, 20/day premium (usage_events tool='image.generate')
// Image model: Pollinations AI (free, no API key needed)
// Poll result: GET /api/jobs/:id — result has {imageUrl, imageId, prompt}
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { enqueueJob, registerJobHandler } from '../services/job-queue.js';
import { generateImage } from '../services/media-generation.js';
import { v4 as uuid } from 'uuid';

export const imageAsyncRouter = Router();

// ---- Daily image cap per plan ----

const IMAGE_DAILY_CAPS: Record<string, number> = {
  free: 3,
  pilot: 10,
  monthly: 10,
  intro: 15,
  halfyear: 50,
  yearly: 100,
};

function getImageCap(userId: string): { used: number; limit: number; allowed: boolean } {
  const user = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: string } | undefined;
  const plan = user?.plan || 'free';
  const limit = IMAGE_DAILY_CAPS[plan] ?? IMAGE_DAILY_CAPS.free;

  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM usage_events
    WHERE user_id = ? AND tool = 'image.generate'
    AND date(created_at) = ?
  `).get(userId, today) as { cnt: number };

  const used = row?.cnt ?? 0;
  return { used, limit, allowed: used < limit };
}

function logImageUsage(userId: string): void {
  db.prepare(`
    INSERT INTO usage_events (id, user_id, tool, provider, channel, tokens_in, tokens_out, cost_usd, created_at)
    VALUES (?, ?, 'image.generate', 'local', 'api', 0, 0, 0, datetime('now'))
  `).run(uuid(), userId);
}

// ---- POST /generate ----

imageAsyncRouter.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { prompt, style } = req.body as { prompt?: string; style?: string };

  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  if (prompt.length > 2000) {
    res.status(400).json({ error: 'Prompt too long (max 2000 chars)' });
    return;
  }

  // Check daily cap
  const cap = getImageCap(userId);
  if (!cap.allowed) {
    res.status(429).json({ error: 'Image limit reached', used: cap.used, limit: cap.limit });
    return;
  }

  // Log usage optimistically at request time (matches voice pattern)
  logImageUsage(userId);

  const jobId = await enqueueJob(
    'image:generate',
    { prompt: prompt.trim(), style: style || null, userId },
    userId,
  );

  logger.info({ userId, jobId, promptLength: prompt.length }, 'Image generation job enqueued');
  res.status(202).json({ jobId, message: 'Image generation started. Poll GET /api/jobs/:id for result.' });
});

// ---- GET /gallery ----

imageAsyncRouter.get('/gallery', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const images = db.prepare(`
    SELECT id, prompt, model, image_url, width, height, source, created_at, expires_at
    FROM user_images
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(userId);

  res.json({ images, count: images.length });
});

// ---- GET /file/:id ----

imageAsyncRouter.get('/file/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const image = db.prepare(
    'SELECT image_url FROM user_images WHERE id = ? AND user_id = ?',
  ).get(id, userId) as { image_url: string } | undefined;

  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  // Redirect to the stored image URL (Pollinations CDN or data URI)
  res.redirect(302, image.image_url);
});

// ---- Register image:generate job handler ----

registerJobHandler<
  { prompt: string; style: string | null; userId: string },
  { imageUrl: string; imageId: string; prompt: string }
>(
  'image:generate',
  async (payload) => {
    const { prompt, style, userId } = payload;

    // TODO: swap for local Stable Diffusion / Ollama vision model when available on VPS
    const enhancedPrompt = style ? `${prompt}, style: ${style}` : prompt;

    const result = await generateImage(enhancedPrompt, { width: 1024, height: 1024 });

    if (!result.success) {
      throw new Error(result.error || 'Image generation failed');
    }

    // Persist to user_images table for gallery
    const imageId = `img-${uuid().slice(0, 12)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO user_images (id, user_id, prompt, model, image_url, width, height, source, expires_at)
      VALUES (?, ?, ?, ?, ?, 1024, 1024, 'generated', ?)
    `).run(imageId, userId, prompt, 'pollinations', result.url, expiresAt);

    logger.info({ userId, imageId, imageUrl: result.url }, 'image:generate job completed');
    return { imageUrl: result.url, imageId, prompt };
  },
);

logger.info('Image async routes initialized (image:generate handler registered)');
