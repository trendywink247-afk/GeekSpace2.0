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

// ---- Constants ----

const CACHE_KEY_MODELS  = 'openrouter:free_models';
const CACHE_KEY_CURRENT = 'openrouter:current_free_model';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

export const DEFAULT_FREE_MODELS: string[] = [
  'deepseek/deepseek-r1-0528:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-235b-a22b:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
];

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
        'X-Title': 'GeekSpace AI OS',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'OpenRouter models API returned non-OK status');
      return DEFAULT_FREE_MODELS;
    }

    const data = await response.json() as OpenRouterModelsResponse;
    const allModels: OpenRouterModel[] = data.data ?? [];

    // Filter to :free suffix, sort by context_length desc, take top 5
    const freeModels = allModels
      .filter((m) => m.id.endsWith(':free'))
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
// Returns the cached model list or DEFAULT_FREE_MODELS if cache is empty.

async function getModelList(): Promise<string[]> {
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
