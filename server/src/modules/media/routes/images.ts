// ============================================================
// Image Generator Routes
// Users can generate images via Pollinations (free) or
// OpenRouter (premium), upload reference images for editing,
// and manage a gallery of up to 10 images (24h TTL).
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, imageGenerateSchema } from '../../../middleware/validate.js';
import { db } from '../../../db/index.js';
import { v4 as uuid } from 'uuid';
import { logger } from '../../../logger.js';
import { generateImage } from '../services/media-generation.js';
import { config } from '../../../config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fsPromises from 'fs/promises';
import { existsSync } from 'fs';
import { cacheGet, cacheSet } from '../../../services/cache.js';

export const imagesRouter = Router();

const MAX_IMAGES_PER_USER = 10;
const IMAGE_TTL_HOURS = 24;

// ---- Helpers ------------------------------------------------

function getUserImageCount(userId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM user_images
     WHERE user_id = ? AND datetime(expires_at) > datetime('now')`
  ).get(userId) as { count: number };
  return row.count;
}

// ---- List user images ----------------------------------------

imagesRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const images = db.prepare(`
    SELECT id, prompt, model, image_url, width, height, source, created_at, expires_at
    FROM user_images
    WHERE user_id = ? AND datetime(expires_at) > datetime('now')
    ORDER BY created_at DESC
  `).all(userId);

  res.json({ images, count: images.length, max: MAX_IMAGES_PER_USER });
});

// ---- Model status + available (MUST be before /:id to avoid shadowing) ------

// Simple in-memory cache for model status (60s TTL)
let imageStatusCache: { data: Record<string, 'ok' | 'down' | 'unknown'>; ts: number } | null = null;

async function getImageModelStatuses(): Promise<Record<string, 'ok' | 'down' | 'unknown'>> {
  if (imageStatusCache && Date.now() - imageStatusCache.ts < 60_000) return imageStatusCache.data;

  // Default statuses for models we don't ping
  const results: Record<string, 'ok' | 'down' | 'unknown'> = {
    auto: 'ok',
    premium: 'ok',
    'black-forest-labs/flux-1-schnell': 'ok', // OpenRouter — assume ok if configured
    'black-forest-labs/flux-1-schnell:free': 'unknown',
  };

  // Ping the providers we can check
  await Promise.allSettled([
    (async () => {
      try {
        const res = await fetch(
          'https://image.pollinations.ai/prompt/test?width=64&height=64&nologo=true',
          { method: 'HEAD', signal: AbortSignal.timeout(5000) }
        );
        results['pollinations'] = res.ok ? 'ok' : 'down';
      } catch { results['pollinations'] = 'down'; }
    })(),
    (async () => {
      try {
        // Use public model info API (no auth required) to check if HF is reachable
        const res = await fetch(
          'https://huggingface.co/api/models/black-forest-labs/FLUX.1-schnell',
          { method: 'GET', signal: AbortSignal.timeout(5000) }
        );
        // HF reachable + token configured = ok; reachable but no token = warn
        if (res.ok) {
          results['huggingface-flux'] = config.hfToken ? 'ok' : 'unknown';
        } else {
          results['huggingface-flux'] = 'down';
        }
      } catch { results['huggingface-flux'] = 'down'; }
    })(),
  ]);

  imageStatusCache = { data: results, ts: Date.now() };
  return results;
}

imagesRouter.get('/models/status', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const statuses = await getImageModelStatuses();
    res.json({ statuses });
  } catch (err) {
    logger.error({ err }, 'Failed to get image model statuses');
    res.status(500).json({ error: 'Failed to check model statuses' });
  }
});

imagesRouter.get('/models/available', requireAuth, (_req: AuthRequest, res) => {
  const models = [
    { id: 'auto', name: 'Auto Select', description: 'Picks the best available provider automatically', cost: 'Free', credits: 0, tier: 'auto' },
    { id: 'pollinations', name: 'Pollinations FLUX', description: 'Fast FLUX diffusion via Pollinations.AI', cost: 'Free', credits: 0, tier: 'free' },
    { id: 'huggingface-flux', name: 'HuggingFace FLUX', description: 'FLUX.1-schnell via HuggingFace — fallback when Pollinations is down', cost: 'Free', credits: 0, tier: 'free' },
    { id: 'black-forest-labs/flux-1-schnell:free', name: 'FLUX Schnell (OpenRouter)', description: 'Fast quality generation via OpenRouter free tier', cost: 'Free', credits: 0, tier: 'free' },
    { id: 'black-forest-labs/flux-1-schnell', name: 'FLUX Schnell Pro', description: 'Higher quality FLUX via OpenRouter', cost: '15 credits', credits: 15, tier: 'standard' },
    { id: 'premium', name: 'Premium Enhanced', description: 'Kimi AI enhances your prompt, then generates at best quality', cost: '20 credits', credits: 20, tier: 'premium' },
  ];

  res.json({ models });
});

// ---- Get single image ----------------------------------------

imagesRouter.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const image = db.prepare(
    `SELECT * FROM user_images WHERE id = ? AND user_id = ? AND datetime(expires_at) > datetime('now')`
  ).get(id, userId);

  if (!image) {
    return res.status(404).json({ error: 'Image not found or expired' });
  }

  res.json(image);
});

// ---- Generate image (text-to-image) --------------------------

imagesRouter.post('/generate', requireAuth, validateBody(imageGenerateSchema), async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { prompt, model, width, height } = req.body as {
    prompt: string;
    model?: string;
    width?: number;
    height?: number;
  };

  // Hourly Redis rate limit: 20 image generations per user per hour
  const hourKey = `ratelimit:imagegen:${userId}:${Math.floor(Date.now() / 3_600_000)}`;
  const hourlyCount = parseInt((await cacheGet(hourKey)) ?? '0', 10);
  const HOURLY_IMAGE_LIMIT = 20;
  if (hourlyCount >= HOURLY_IMAGE_LIMIT) {
    return res.status(429).json({
      error: `Rate limit exceeded. 0 generations remaining this hour.`,
    });
  }

  // Plan-based daily image generation cap
  const imgUser = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: string } | undefined;
  const imgPlan = imgUser?.plan || 'free';
  const imgIsPaid = imgPlan !== 'free';
  const IMAGE_DAILY_CAPS: Record<string, number> = { free: 3, pilot: 10, monthly: 10, intro: 15, halfyear: 50, yearly: 100 };
  const dailyCap = IMAGE_DAILY_CAPS[imgPlan] ?? IMAGE_DAILY_CAPS['free'];
  const todayRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM user_images WHERE user_id = ? AND date(created_at) = date('now')"
  ).get(userId) as { cnt: number };
  const todayCount = todayRow.cnt;
  if (todayCount >= dailyCap) {
    return res.status(429).json({
      error: imgIsPaid
        ? 'Daily image limit reached. Resets at midnight.'
        : 'Daily image limit reached. Upgrade your plan to unlock more image generation',
      upgradeRequired: !imgIsPaid,
      used: todayCount,
      limit: dailyCap,
    });
  }

  // Check image gallery limit
  const count = getUserImageCount(userId);
  if (count >= MAX_IMAGES_PER_USER) {
    return res.status(429).json({
      error: `Image limit reached (${MAX_IMAGES_PER_USER}). Delete some images or wait for them to expire.`,
    });
  }

  const w = Math.min(Math.max(width || 1024, 256), 2048);
  const h = Math.min(Math.max(height || 1024, 256), 2048);
  let selectedModel = model || 'pollinations';

  // Auto select: pick best available model based on credit balance
  if (selectedModel === 'auto') {
    const sub = db.prepare(
      'SELECT credits_remaining FROM subscriptions WHERE user_id = ?'
    ).get(userId) as { credits_remaining: number } | undefined;
    const credits = sub?.credits_remaining ?? 0;

    if (credits >= 20) {
      selectedModel = 'premium';
    } else if (credits >= 15 && config.openrouterApiKey) {
      selectedModel = 'black-forest-labs/flux-1-schnell';
    } else if (config.openrouterApiKey) {
      selectedModel = 'black-forest-labs/flux-1-schnell:free';
    } else if (config.hfToken) {
      selectedModel = 'huggingface-flux';
    } else {
      selectedModel = 'pollinations';
    }
  }

  try {
    let imageUrl = '';

    if (selectedModel === 'pollinations' || selectedModel === 'free') {
      // Use Pollinations (free)
      const result = await generateImage(prompt, { width: w, height: h, forceProvider: 'pollinations' });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Image generation failed' });
      }
      imageUrl = result.url;
    } else if (selectedModel === 'huggingface-flux') {
      // Use HuggingFace FLUX directly
      const result = await generateImage(prompt, { width: w, height: h, forceProvider: 'huggingface' });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'HuggingFace image generation failed' });
      }
      imageUrl = result.url;
    } else if (selectedModel === 'openrouter' || selectedModel.includes('/')) {
      // Use OpenRouter image generation
      const orModel = selectedModel === 'openrouter'
        ? 'black-forest-labs/flux-1-schnell:free'
        : selectedModel;

      const orResult = await callOpenRouterImage(prompt, orModel, w, h);
      if (!orResult.success) {
        return res.status(500).json({ error: orResult.error || 'OpenRouter image generation failed' });
      }
      imageUrl = orResult.url;

      // Deduct credits for premium models
      if (!orModel.includes(':free')) {
        db.prepare(`
          UPDATE subscriptions
          SET credits_remaining = MAX(0, credits_remaining - 15),
              credits_used_this_cycle = credits_used_this_cycle + 15
          WHERE user_id = ?
        `).run(userId);
      }
    } else if (selectedModel === 'premium') {
      // Premium: Enhance prompt via Kimi, then generate
      const enhancedPrompt = await enhancePromptWithKimi(prompt);
      const result = await generateImage(enhancedPrompt, { width: w, height: h });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Premium generation failed' });
      }
      imageUrl = result.url;

      // Deduct credits
      db.prepare(`
        UPDATE subscriptions
        SET credits_remaining = MAX(0, credits_remaining - 20),
            credits_used_this_cycle = credits_used_this_cycle + 20
        WHERE user_id = ?
      `).run(userId);
    } else {
      return res.status(400).json({ error: `Unknown model: ${selectedModel}` });
    }

    // Save to DB
    const id = `img-${uuid().slice(0, 12)}`;
    const expiresAt = new Date(Date.now() + IMAGE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO user_images (id, user_id, prompt, model, image_url, width, height, source, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'generated', ?)
    `).run(id, userId, prompt, selectedModel, imageUrl, w, h, expiresAt);

    // Activity log
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, details, icon)
      VALUES (?, ?, 'Image generated', ?, 'image')
    `).run(uuid(), userId, `"${prompt.slice(0, 60)}..." via ${selectedModel}`);

    logger.info({ userId, imageId: id, model: selectedModel }, 'Image generated');

    // Increment hourly rate limit counter (TTL: 1 hour)
    await cacheSet(hourKey, String(hourlyCount + 1), 3600);

    res.json({
      id,
      prompt,
      model: selectedModel,
      image_url: imageUrl,
      width: w,
      height: h,
      source: 'generated',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Image generation failed');
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// ---- Edit image (upload reference + prompt) ------------------

imagesRouter.post('/edit', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { prompt, reference_url, model } = req.body as {
    prompt: string;
    reference_url?: string;
    model?: string;
  };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Edit prompt is required' });
  }

  const count = getUserImageCount(userId);
  if (count >= MAX_IMAGES_PER_USER) {
    return res.status(429).json({
      error: `Image limit reached (${MAX_IMAGES_PER_USER}). Delete some images or wait for them to expire.`,
    });
  }

  try {
    // Build enhanced prompt combining reference description + edit instructions
    const editPrompt = reference_url
      ? `Based on this reference image concept, ${prompt}. Make it high quality, detailed, professional.`
      : prompt;

    const selectedModel = model || 'pollinations';
    let imageUrl = '';

    if (selectedModel === 'premium') {
      const enhancedPrompt = await enhancePromptWithKimi(editPrompt);
      const result = await generateImage(enhancedPrompt, { width: 1024, height: 1024 });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Edit generation failed' });
      }
      imageUrl = result.url;
      db.prepare(`
        UPDATE subscriptions
        SET credits_remaining = MAX(0, credits_remaining - 20),
            credits_used_this_cycle = credits_used_this_cycle + 20
        WHERE user_id = ?
      `).run(userId);
    } else {
      const result = await generateImage(editPrompt, { width: 1024, height: 1024 });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Edit generation failed' });
      }
      imageUrl = result.url;
    }

    const id = `img-${uuid().slice(0, 12)}`;
    const expiresAt = new Date(Date.now() + IMAGE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO user_images (id, user_id, prompt, model, image_url, width, height, source, expires_at)
      VALUES (?, ?, ?, ?, ?, 1024, 1024, 'edited', ?)
    `).run(id, userId, prompt, selectedModel, imageUrl, expiresAt);

    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, details, icon)
      VALUES (?, ?, 'Image edited', ?, 'image')
    `).run(uuid(), userId, `"${prompt.slice(0, 60)}..."`);

    logger.info({ userId, imageId: id }, 'Image edit generated');

    res.json({
      id,
      prompt,
      model: selectedModel,
      image_url: imageUrl,
      width: 1024,
      height: 1024,
      source: 'edited',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Image edit failed');
    res.status(500).json({ error: 'Image edit failed' });
  }
});

// ---- Delete image --------------------------------------------

imagesRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const result = db.prepare(
    'DELETE FROM user_images WHERE id = ? AND user_id = ?'
  ).run(id, userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Image not found' });
  }

  logger.info({ userId, imageId: id }, 'Image deleted');
  res.json({ deleted: true });
});

// ---- Cleanup expired images -----------------------------------

export async function cleanupExpiredImages(): Promise<void> {
  try {
    const expired = db.prepare(`
      SELECT id, user_id FROM user_images
      WHERE datetime(expires_at) <= datetime('now')
    `).all() as Array<{ id: string; user_id: string }>;

    if (expired.length > 0) {
      db.prepare(`
        DELETE FROM user_images WHERE datetime(expires_at) <= datetime('now')
      `).run();
      logger.info({ count: expired.length }, 'Expired images cleaned up');
    }
  } catch (err) {
    logger.error({ err }, 'Image cleanup failed');
  }

  // Clean HuggingFace cache files older than 24h
  try {
    const __routesDirname = path.dirname(fileURLToPath(import.meta.url));
    const cacheDir = path.join(__routesDirname, '../../../../data/img-cache');
    if (existsSync(cacheDir)) {
      const files = await fsPromises.readdir(cacheDir);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      let cleaned = 0;
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        const s = await fsPromises.stat(filePath);
        if (s.mtimeMs < cutoff) {
          await fsPromises.unlink(filePath);
          cleaned++;
        }
      }
      if (cleaned > 0) logger.info({ cleaned }, 'Cleaned up old HuggingFace cache files');
    }
  } catch (err) {
    logger.error({ err }, 'HuggingFace cache cleanup failed');
  }
}

// ---- OpenRouter image generation ------------------------------

async function callOpenRouterImage(
  prompt: string,
  model: string,
  width: number,
  height: number
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    if (!config.openrouterApiKey) {
      // Fallback to Pollinations if no OpenRouter key
      return generateImage(prompt, { width, height });
    }

    const response = await fetch(`${config.openrouterBaseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin Image Generator',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: `${width}x${height}`,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn({ status: response.status, text: text.slice(0, 200), model }, 'OpenRouter image failed, falling back to Pollinations');
      // Fallback to Pollinations
      return generateImage(prompt, { width, height });
    }

    const data = await response.json() as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };

    const imageData = data.data?.[0];
    if (imageData?.url) {
      return { success: true, url: imageData.url };
    }
    if (imageData?.b64_json) {
      // Return as data URI
      return { success: true, url: `data:image/png;base64,${imageData.b64_json}` };
    }

    // Fallback
    return generateImage(prompt, { width, height });
  } catch (err) {
    logger.error({ err, model }, 'OpenRouter image generation error, falling back');
    return generateImage(prompt, { width, height });
  }
}

// ---- Kimi prompt enhancement ----------------------------------

async function enhancePromptWithKimi(prompt: string): Promise<string> {
  try {
    if (!config.openrouterApiKey) return prompt;

    const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin Prompt Enhancer',
      },
      body: JSON.stringify({
        model: config.moonshotReasoningModel || 'anthropic/claude-sonnet-4-5-20250929',
        messages: [
          {
            role: 'system',
            content: 'You are an expert image prompt engineer. Enhance the user\'s image description into a detailed, vivid prompt optimized for AI image generation. Output ONLY the enhanced prompt, nothing else. Keep it under 300 words.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return prompt;

    const data = await response.json() as {
      choices?: Array<{ message?: { content: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() || prompt;
  } catch {
    return prompt;
  }
}
