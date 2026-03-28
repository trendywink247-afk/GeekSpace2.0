// ============================================================
// Image & Video Generation Service
// Uses free AI models from Pollinations.AI with HuggingFace FLUX fallback
// ============================================================

import path from 'path';
import fsPromises from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';

// Pollinations.AI endpoints (completely free, no API key needed)
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';
const _POLLINATIONS_VIDEO_URL = 'https://video.pollinations.ai/prompt';

// HuggingFace FLUX endpoint (fallback) — new router.huggingface.co (api-inference.huggingface.co deprecated 2026)
const HF_FLUX_URL = 'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell';

// Image cache dir — use DB_PATH env var to find data dir, fallback to relative path for dev
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '../../../../data');
const IMG_CACHE_DIR = path.join(DATA_DIR, 'img-cache');

// Ensure cache dir exists at startup
if (!existsSync(IMG_CACHE_DIR)) {
  mkdirSync(IMG_CACHE_DIR, { recursive: true });
}

export interface ImageGenerationOptions {
  width?: number;
  height?: number;
  seed?: number;
  nologo?: boolean;
  enhance?: boolean;
  forceProvider?: 'pollinations' | 'huggingface';
}

export interface VideoGenerationOptions {
  width?: number;
  height?: number;
  duration?: number; // in seconds
  fps?: number;
}

/**
 * Generate an image using Pollinations.AI with HuggingFace FLUX.1-schnell fallback.
 * Waterfall:
 *   1. Pollinations HEAD check (10s timeout) — return URL if ok
 *   2. HuggingFace POST (60s timeout) — save to cache, return /api/images/cache/<id>.jpg
 *   3. Return failure with friendly message
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<{ success: boolean; url: string; error?: string; provider?: string }> {
  const {
    width = 1024,
    height = 1024,
    seed = Math.floor(Math.random() * 1000000),
    nologo = true,
    enhance = true,
    forceProvider,
  } = options;

  // ── Step 1: Pollinations (skip if forceProvider === 'huggingface') ──
  if (forceProvider !== 'huggingface') {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        seed: String(seed),
        nologo: String(nologo),
        enhance: String(enhance),
      });
      const pollinationsUrl = `${POLLINATIONS_IMAGE_URL}/${encodedPrompt}?${params.toString()}`;

      const checkRes = await fetch(pollinationsUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });

      if (checkRes.ok) {
        logger.info({ prompt: prompt.slice(0, 50), width, height }, 'Image generated via Pollinations');
        return { success: true, url: pollinationsUrl, provider: 'pollinations' };
      }

      logger.warn(
        { status: checkRes.status, prompt: prompt.slice(0, 50) },
        'Pollinations unavailable, trying HuggingFace fallback'
      );
    } catch (err) {
      logger.warn({ err, prompt: prompt.slice(0, 50) }, 'Pollinations request failed, trying HuggingFace fallback');
    }
  }

  // ── Step 2: HuggingFace FLUX.1-schnell ──
  try {
    const hfToken = config.hfToken;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (hfToken) {
      headers['Authorization'] = `Bearer ${hfToken}`;
    }

    const hfRes = await fetch(HF_FLUX_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: prompt }),
      signal: AbortSignal.timeout(60000),
    });

    if (!hfRes.ok) {
      if (hfRes.status === 401 || hfRes.status === 403) {
        logger.warn({ status: hfRes.status }, 'HuggingFace auth failed — HF_TOKEN not set or invalid');
        return {
          success: false,
          url: '',
          error: 'HuggingFace image generation requires a free API token. Please add HF_TOKEN to your .env file (get one free at huggingface.co/settings/tokens).',
        };
      }
      if (hfRes.status === 503) {
        // Model is warming up — common on free tier
        let estimatedTime = '';
        try {
          const body = await hfRes.json() as { estimated_time?: number };
          if (body.estimated_time) estimatedTime = ` (~${Math.ceil(body.estimated_time)}s estimated)`;
        } catch { /* ignore */ }
        logger.warn({ status: 503 }, `HuggingFace model cold-starting${estimatedTime}`);
        return {
          success: false,
          url: '',
          error: `Image model is warming up${estimatedTime}. Please try again in a moment.`,
        };
      }
      logger.warn(
        { status: hfRes.status, prompt: prompt.slice(0, 50) },
        'HuggingFace FLUX request failed'
      );
      throw new Error(`HuggingFace returned ${hfRes.status}`);
    }

    const buffer = await hfRes.arrayBuffer();
    const contentType = hfRes.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(IMG_CACHE_DIR, filename);
    await fsPromises.writeFile(filePath, Buffer.from(buffer));
    // NOTE: This URL is served by the express.static route in app.ts (added in Task 4)
    const url = `/api/images/cache/${filename}`;
    logger.info({ prompt: prompt.slice(0, 50), filename }, 'Image generated via HuggingFace FLUX');
    return { success: true, url, provider: 'huggingface' };
  } catch (err) {
    logger.error({ err, prompt: prompt.slice(0, 50) }, 'HuggingFace FLUX request error');
  }

  // ── Step 3: All providers failed ──
  return {
    success: false,
    url: '',
    error: 'All image providers are currently unavailable. Please try again in a moment.',
  };
}

/**
 * Generate a video using Pollinations.AI (free)
 * Note: Video generation is currently disabled — all providers are blocked from this server region
 */
export async function generateVideo(
  prompt: string,
  _options: VideoGenerationOptions = {}
): Promise<{ success: boolean; url: string; estimatedTime?: number; error?: string }> {
  // Video generation providers (Pollinations, Seedance, Veo2, etc.) are blocked from this VPS
  // Return early to prevent credit deduction and API calls
  logger.warn({ prompt: prompt.slice(0, 50) }, 'Video generation requested but providers are blocked from this server region');
  return {
    success: false,
    url: '',
    error: 'Video generation is temporarily unavailable from this server region. Please try image generation instead.',
  };
}

/**
 * Check if a media URL is ready (for polling video status)
 */
export async function checkMediaStatus(url: string): Promise<{ ready: boolean; contentType?: string }> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || undefined;
      return { ready: true, contentType };
    }

    // 202 Accepted means still processing
    if (res.status === 202) {
      return { ready: false };
    }

    return { ready: false };
  } catch {
    return { ready: false };
  }
}

/**
 * Generate an avatar/profile picture
 */
export async function generateAvatar(
  description: string,
  style: 'professional' | 'creative' | 'fun' = 'professional'
): Promise<{ success: boolean; url: string; error?: string }> {
  const stylePrompts = {
    professional: 'professional headshot portrait, business attire, clean background, high quality, photorealistic',
    creative: 'artistic portrait, creative lighting, expressive, digital art style, high quality',
    fun: 'cartoon style portrait, colorful, playful, friendly, high quality illustration'
  };

  const fullPrompt = `${description}, ${stylePrompts[style]}`;

  return generateImage(fullPrompt, {
    width: 512,
    height: 512,
    enhance: true
  });
}

/**
 * Generate a project thumbnail/preview
 */
export async function generateProjectThumbnail(
  projectName: string,
  description: string
): Promise<{ success: boolean; url: string; error?: string }> {
  const prompt = `Project thumbnail for "${projectName}": ${description}. Clean, modern, tech-focused, dark background with colorful accents, professional presentation, high quality digital art`;

  return generateImage(prompt, {
    width: 1200,
    height: 630, // Open Graph aspect ratio
    enhance: true
  });
}
