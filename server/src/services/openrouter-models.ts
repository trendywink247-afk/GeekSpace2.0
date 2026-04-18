// ============================================================
// OpenRouter Free-Tier Model Manager
//
// Fetches available free models from OpenRouter, caches them
// in Redis, and rotates through a fallback chain when quota
// or rate-limit errors occur.
// ============================================================

import { cacheGet, cacheSet } from './cache.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { db } from '../db/index.js';

// ---- Constants ----

const CACHE_KEY_MODELS  = 'openrouter:free_models';
const CACHE_KEY_CURRENT = 'openrouter:current_free_model';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

// Curated list: ≥24B instruction-following models only.
// Reasoning/thinking models (deepseek-r1, :thinking) excluded — they don't
// reliably follow the <<<ACTION>>> custom tool format used by the agent.
export const DEFAULT_FREE_MODELS: string[] = [
  'meta-llama/llama-3.3-70b-instruct:free',          // 70B — proven, fast, excellent tool calling
  'qwen/qwen3-235b-a22b:free',                       // 235B MoE — best quality in free tier
  'mistralai/mistral-small-3.2-24b-instruct:free',   // 24B — reliable fallback
  'google/gemma-3-27b-it:free',                      // 27B — consistent instruction following
  'qwen/qwen3-30b-a3b:free',                         // 30B MoE — lightweight but capable
];

// Models to exclude from dynamic OpenRouter fetch.
// Reasoning/thinking models emit <think> blocks that break the <<<ACTION>>> parser.
// Nano/mini/tiny/micro models are too small for reliable tool-format compliance.
const FREE_MODEL_BLOCKLIST = ['nano', 'mini', 'tiny', 'micro', 'deepseek-r1', ':thinking'];

// ---- Types ----

interface OpenRouterModel {
  id: string;
  context_length?: number;
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

// ---- fetchFreeModels ----
// Fetches free models from OpenRouter API, caches top 5 by context_length.
// Falls back to DEFAULT_FREE_MODELS on any failure.

export async function fetchFreeModels(): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${config.openrouterFreeApiKey || config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'OpenRouter models API returned non-OK status');
      return DEFAULT_FREE_MODELS;
    }

    const data = await response.json() as OpenRouterModelsResponse;
    const allModels: OpenRouterModel[] = data.data ?? [];

    // Filter to :free suffix, exclude blocklisted models, sort by context_length desc, take top 5
    const freeModels = allModels
      .filter((m) => m.id.endsWith(':free'))
      .filter((m) => !FREE_MODEL_BLOCKLIST.some((blocked) => m.id.toLowerCase().includes(blocked)))
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .slice(0, 5)
      .map((m) => m.id);

    if (freeModels.length === 0) {
      logger.warn('OpenRouter returned no free models — using defaults');
      return DEFAULT_FREE_MODELS;
    }

    // Cache the list
    await cacheSet(CACHE_KEY_MODELS, JSON.stringify(freeModels), CACHE_TTL_SECONDS);
    logger.info({ models: freeModels }, 'OpenRouter free models cached');

    return freeModels;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'fetchFreeModels failed — using defaults');
    return DEFAULT_FREE_MODELS;
  }
}

// ---- getModelList ----
// Returns the model list. Prefers DB-sourced curated models,
// falls back to Redis cache, then DEFAULT_FREE_MODELS.

async function getModelList(): Promise<string[]> {
  // Prefer DB-sourced active curated models (populated by model-sync.ts)
  try {
    const rows = db.prepare("SELECT id FROM free_models WHERE status = 'active' AND curated = 1 ORDER BY context_length DESC")
      .all() as Array<{ id: string }>;
    if (rows.length > 0) return rows.map(r => r.id);
  } catch { /* DB not ready — fall through */ }

  // Fallback to Redis cache
  try {
    const cached = await cacheGet(CACHE_KEY_MODELS);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as string[];
      }
    }
  } catch {
    // Cache miss or parse error — fall through
  }

  return DEFAULT_FREE_MODELS;
}

// ---- getCurrentFreeModel ----
// Returns the currently active free model from Redis.
// Falls back to the first model in the list if not set.

export async function getCurrentFreeModel(): Promise<string> {
  try {
    const current = await cacheGet(CACHE_KEY_CURRENT);
    if (current) return current;
  } catch {
    // Redis unavailable — fall through
  }

  const models = await getModelList();
  return models[0];
}

// ---- switchToNextFreeModel ----
// Rotates to the next model after failedModel in the list.
// Updates Redis and returns the new model.

export async function switchToNextFreeModel(failedModel: string): Promise<string> {
  const models = await getModelList();
  const currentIndex = models.indexOf(failedModel);
  const nextIndex = (currentIndex + 1) % models.length;
  const nextModel = models[nextIndex];

  try {
    // Store the new current model — TTL of 1 hour so it eventually resets
    await cacheSet(CACHE_KEY_CURRENT, nextModel, 60 * 60);
  } catch {
    // Non-fatal — we still return the next model
  }

  logger.info({ failedModel, nextModel }, 'Switched OpenRouter free model');
  return nextModel;
}

// ---- refreshModelsIfStale ----
// Calls fetchFreeModels() only if the cache is empty (i.e., TTL expired or never set).

export async function refreshModelsIfStale(): Promise<void> {
  try {
    const cached = await cacheGet(CACHE_KEY_MODELS);
    if (!cached) {
      await fetchFreeModels();
    }
  } catch {
    // Non-fatal — best effort
  }
}

/**
 * Get the user's preferred free model if it's currently available.
 * Returns null if preference is 'auto' or model is unavailable.
 */
export function getUserPreferredFreeModel(userId: string): string | null {
  const row = db.prepare('SELECT preferred_free_model FROM agent_configs WHERE user_id = ?')
    .get(userId) as { preferred_free_model: string | null } | undefined;

  const pref = row?.preferred_free_model;
  if (!pref || pref === 'auto') return null;

  // Check the model is still active
  const model = db.prepare("SELECT id FROM free_models WHERE id = ? AND status IN ('active', 'new')")
    .get(pref) as { id: string } | undefined;

  return model ? model.id : null;
}
