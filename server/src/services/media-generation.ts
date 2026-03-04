// ============================================================
// Image & Video Generation Service
// Uses free AI models from Pollinations.AI with HuggingFace FLUX fallback
// ============================================================

import path from 'path';
import fsPromises from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';
import { config } from '../config.js';

// Pollinations.AI endpoints (completely free, no API key needed)
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';
const POLLINATIONS_VIDEO_URL = 'https://video.pollinations.ai/prompt';

// HuggingFace FLUX endpoint (fallback)
const HF_FLUX_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';

// Image cache dir — go up 3 levels from compiled output (dist/services/) to /app/data/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../data');
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
      if (hfRes.status === 503) {
        // Model is warming up — common on free tier
        let estimatedTime = '';
        try {
          const body = await hfRes.json() as { estimated_time?: number };
          if (body.estimated_time) estimatedTime = ` (~${Math.ceil(body.estimated_time)}s estimated)`;
        } catch { /* ignore */ }
        logger.warn({ status: 503 }, `HuggingFace model cold-starting${estimatedTime}`);
        // Don't throw — return early with a user-friendly message
        return {
          success: false,
          url: '',
          error: `Image model is warming up${estimatedTime}. Please try again in a moment. (Model currently unavailable)`,
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
 * Note: Video generation takes longer (30-120 seconds)
 */
export async function generateVideo(
  prompt: string,
  options: VideoGenerationOptions = {}
): Promise<{ success: boolean; url: string; estimatedTime?: number; error?: string }> {
  try {
    const {
      width = 1280,
      height = 720,
      duration = 5,
      fps = 24
    } = options;

    // Build URL with parameters
    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      duration: String(duration),
      fps: String(fps)
    });

    const url = `${POLLINATIONS_VIDEO_URL}/${encodedPrompt}?${params.toString()}`;

    logger.info({ prompt: prompt.slice(0, 50), width, height, duration }, 'Video generation initiated');

    // Video generation is async - return the URL immediately
    // The client will need to poll or wait for the video to be ready
    return {
      success: true,
      url,
      estimatedTime: duration * 6 // rough estimate: 6x real-time
    };
  } catch (err) {
    logger.error({ err, prompt: prompt.slice(0, 50) }, 'Video generation failed');
    return {
      success: false,
      url: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
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
