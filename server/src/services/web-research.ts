// ============================================================
// Web Research — crawl4ai integration
//
// Fetches a URL and extracts clean markdown using the local
// crawl4ai container. No external API key required.
// Falls back to raw fetch + HTML strip if crawl4ai is down.
// Results cached in Redis for 1 hour.
// ============================================================

import { createHash } from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from './cache.js';

const WEB_CACHE_TTL_SEC = 3600; // 1 hour
const MAX_CONTENT_CHARS = 8000;
const CRAWL4AI_TIMEOUT_MS = 30_000;
const FALLBACK_TIMEOUT_MS = 15_000;

function urlCacheKey(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  return `web_fetch:${hash}`;
}

/** Strip HTML tags and decode common entities to plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Fetch a URL and return clean markdown content.
 *
 * Priority:
 *   1. Redis cache (TTL = 1 hour)
 *   2. crawl4ai container (returns structured markdown)
 *   3. Fallback: raw fetch + HTML strip
 *
 * @throws if all methods fail
 */
export async function fetchAndExtract(url: string): Promise<string> {
  // 1. Check Redis cache
  const cacheKey = urlCacheKey(url);
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.debug({ url }, 'web_fetch: cache hit');
      return cached;
    }
  } catch { /* Redis unavailable — continue */ }

  let content: string | null = null;

  // 2. Try crawl4ai
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CRAWL4AI_TIMEOUT_MS);
    const resp = await fetch(`${config.crawl4aiUrl}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], priority: 8 }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (resp.ok) {
      // crawl4ai v0.5.x: results[0].markdown is an object with raw_markdown, not a string
      const data = await resp.json() as {
        results?: Array<{
          markdown?: { raw_markdown?: string };
          success?: boolean;
          error_message?: string;
        }>;
      };
      const raw = data.results?.[0]?.markdown?.raw_markdown?.trim();
      if (raw && raw.length > 10) {
        content = raw;
        logger.info({ url, chars: raw.length }, 'web_fetch: crawl4ai success');
      } else {
        logger.warn({ url, error: data.results?.[0]?.error_message }, 'web_fetch: crawl4ai returned empty content');
      }
    } else {
      logger.warn({ url, status: resp.status }, 'web_fetch: crawl4ai non-OK response');
    }
  } catch (err) {
    logger.warn({ url, err: err instanceof Error ? err.message : String(err) }, 'web_fetch: crawl4ai failed, trying fallback');
  }

  // 3. Fallback: raw fetch + HTML strip
  if (!content) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FALLBACK_TIMEOUT_MS);
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Agentin/1.0; +https://agentin.chat)' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        const html = await resp.text();
        content = stripHtml(html);
        logger.info({ url, chars: content.length }, 'web_fetch: fallback fetch success');
      }
    } catch (err) {
      logger.warn({ url, err: err instanceof Error ? err.message : String(err) }, 'web_fetch: fallback also failed');
    }
  }

  if (!content || content.trim().length === 0) {
    throw new Error(`Could not fetch content from ${url} — both crawl4ai and fallback failed`);
  }

  // Truncate to MAX_CONTENT_CHARS
  const result = content.length > MAX_CONTENT_CHARS
    ? `${content.slice(0, MAX_CONTENT_CHARS)}\n\n[content truncated — ${content.length} chars total]`
    : content;

  // Cache for 1 hour
  try {
    await cacheSet(cacheKey, result, WEB_CACHE_TTL_SEC);
  } catch { /* non-fatal */ }

  return result;
}
