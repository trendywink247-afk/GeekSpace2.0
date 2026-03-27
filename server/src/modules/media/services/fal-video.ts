// ============================================================
// fal.ai Seedance Video Service
// Generates short video clips via fal.ai seedance-v1 model.
// In TEST_MODE, returns deterministic stub URLs without
// making any real HTTP calls (FAL_KEY not required in tests).
// ============================================================

import { config } from '../../../config.js';
import { logger } from '../../../logger.js';

export interface FalClipRequest {
  prompt: string;
  width?: number;
  height?: number;
  duration?: number; // seconds, 5 or 10
  seed?: number;
}

export interface FalClipResult {
  success: boolean;
  url: string;
  error?: string;
  requestId?: string;
  durationMs?: number;
}

const FAL_API_BASE = 'https://queue.fal.run';
const FAL_SEEDANCE_MODEL = 'fal-ai/seedance-v1-lite';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // 3 min max

// ── TEST_MODE stub ──────────────────────────────────────────

function stubClipUrl(prompt: string, index: number): string {
  // Deterministic fake URL safe to compare in tests
  const slug = encodeURIComponent(prompt.slice(0, 30).replace(/\s+/g, '-'));
  return `https://cdn.fal-stub.test/seedance/${slug}-clip${index}.mp4`;
}

// ── Main API call ───────────────────────────────────────────

/**
 * Submit a single clip to fal.ai Seedance and await the result.
 * Uses queue (async) API with polling.
 */
export async function generateFalClip(
  req: FalClipRequest,
  clipIndex: number = 0
): Promise<FalClipResult> {
  const t0 = Date.now();

  if (config.isTestMode) {
    // TEST_MODE: immediate stub — no HTTP
    return {
      success: true,
      url: stubClipUrl(req.prompt, clipIndex),
      requestId: `stub-${clipIndex}`,
      durationMs: 0,
    };
  }

  if (!config.falApiKey) {
    return { success: false, url: '', error: 'FAL_KEY not configured' };
  }

  try {
    // Submit job to fal.ai queue
    const submitRes = await fetch(`${FAL_API_BASE}/${FAL_SEEDANCE_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${config.falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: req.prompt,
        image_size: {
          width: req.width ?? 1280,
          height: req.height ?? 720,
        },
        duration: req.duration ?? 5,
        seed: req.seed,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => 'unknown');
      logger.warn({ status: submitRes.status, err: errText }, 'fal.ai submit failed');
      return { success: false, url: '', error: `fal.ai submit error ${submitRes.status}: ${errText}` };
    }

    const submitData = await submitRes.json() as {
      request_id?: string;
      status?: string;
      video?: { url: string };
    };

    // fal.ai may return immediately if fast
    if (submitData.video?.url) {
      return {
        success: true,
        url: submitData.video.url,
        requestId: submitData.request_id,
        durationMs: Date.now() - t0,
      };
    }

    const requestId = submitData.request_id;
    if (!requestId) {
      return { success: false, url: '', error: 'No request_id from fal.ai' };
    }

    // Poll until done
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(`${FAL_API_BASE}/${FAL_SEEDANCE_MODEL}/requests/${requestId}/status`, {
        headers: { 'Authorization': `Key ${config.falApiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json() as {
        status?: string;
        video?: { url: string };
        error?: string;
      };

      if (statusData.status === 'COMPLETED' && statusData.video?.url) {
        return {
          success: true,
          url: statusData.video.url,
          requestId,
          durationMs: Date.now() - t0,
        };
      }

      if (statusData.status === 'FAILED') {
        return { success: false, url: '', error: statusData.error ?? 'fal.ai job failed', requestId };
      }
    }

    return { success: false, url: '', error: 'fal.ai polling timeout (3 min)', requestId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.error({ err, clipIndex }, 'fal.ai generateFalClip error');
    return { success: false, url: '', error: msg };
  }
}
