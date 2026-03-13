// ============================================================
// SearXNG Search Integration
//
// Self-hosted metasearch via SearXNG container on Docker network.
// Returns results in TavilySearchResponse format for drop-in use.
// ============================================================

import { createHash } from 'crypto';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from './cache.js';

const SEARXNG_BASE = 'http://geekspace-searxng:8080';
const TIMEOUT_MS = 10_000;
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  query: string;
}

function cacheKey(query: string): string {
  const hash = createHash('sha256').update(query).digest('hex').slice(0, 16);
  return `searxng:${hash}`;
}

export async function searxngSearch(
  query: string,
  maxResults: number = 5
): Promise<TavilySearchResponse> {
  const empty: TavilySearchResponse = { results: [], query };

  // Check cache first
  const key = cacheKey(query);
  try {
    const cached = await cacheGet(key);
    if (cached) {
      logger.debug({ query }, 'SearXNG cache hit');
      return JSON.parse(cached) as TavilySearchResponse;
    }
  } catch {
    // Cache read failure is non-fatal
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      language: 'en',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${SEARXNG_BASE}/search?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ status: res.status }, 'SearXNG returned non-OK status');
      return empty;
    }

    const data = await res.json() as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const results: TavilyResult[] = (data.results || [])
      .slice(0, maxResults)
      .map((r) => ({
        title: r.title || '',
        url: r.url || '',
        content: (r.content || '').slice(0, 300),
      }));

    const response: TavilySearchResponse = { results, query };

    // Cache the result
    try {
      await cacheSet(key, JSON.stringify(response), CACHE_TTL_SECONDS);
    } catch {
      // Cache write failure is non-fatal
    }

    logger.info({ query, resultCount: results.length }, 'SearXNG search complete');
    return response;
  } catch (err) {
    logger.warn({ err, query }, 'SearXNG search failed');
    return empty;
  }
}

/**
 * Pings the SearXNG health endpoint to check availability.
 */
export async function isSearxngAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${SEARXNG_BASE}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    return res.ok;
  } catch {
    return false;
  }
}
