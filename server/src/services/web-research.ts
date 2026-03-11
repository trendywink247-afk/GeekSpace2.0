// ============================================================
// Web Research — crawl4ai integration
//
// Fetches a URL and extracts clean markdown using the local
// crawl4ai container. No external API key required.
// Falls back to raw fetch + HTML strip if crawl4ai is down.
// Results cached in Redis for 1 hour.
//
// Also provides:
//   fetchScreenshot(url)   — full-page PNG screenshot
//   extractLinks(url)      — all links from a page
//   smartSearch(query)     — site-aware search when TAVILY missing
// ============================================================

import { createHash } from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from './cache.js';

const WEB_CACHE_TTL_SEC = 3600; // 1 hour
const MAX_CONTENT_CHARS = 12000;
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

// ── Site-specific search URL builders ────────────────────────────────────────
// Used by smartSearch() when TAVILY_API_KEY is not set.
// Keyed by lowercased keyword that appears in the user query.
const SITE_SEARCH_MAP: Record<string, (q: string) => string> = {
  'bbc':           (q) => `https://www.bbc.com/search?q=${encodeURIComponent(q)}`,
  'cnn':           (q) => `https://www.cnn.com/search?q=${encodeURIComponent(q)}`,
  'reuters':       (q) => `https://www.reuters.com/search/news?blob=${encodeURIComponent(q)}`,
  'guardian':      (q) => `https://www.theguardian.com/search?q=${encodeURIComponent(q)}`,
  'nytimes':       (q) => `https://www.nytimes.com/search?query=${encodeURIComponent(q)}`,
  'ny times':      (q) => `https://www.nytimes.com/search?query=${encodeURIComponent(q)}`,
  'techcrunch':    (q) => `https://techcrunch.com/?s=${encodeURIComponent(q)}`,
  'ndtv':          (q) => `https://www.ndtv.com/search/?searchtext=${encodeURIComponent(q)}`,
  'hindustan':     (q) => `https://www.hindustantimes.com/search?query=${encodeURIComponent(q)}`,
  'times of india':(q) => `https://timesofindia.indiatimes.com/topic/${encodeURIComponent(q).replace(/%20/g, '-')}`,
  'reddit':        (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  'wikipedia':     (q) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  'wiki':          (q) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  'youtube':       (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  'github':        (q) => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
  'amazon':        (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  'flipkart':      (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  'producthunt':   (q) => `https://www.producthunt.com/search?q=${encodeURIComponent(q)}`,
  'hackernews':    (q) => `https://hn.algolia.com/?query=${encodeURIComponent(q)}`,
  'hacker news':   (q) => `https://hn.algolia.com/?query=${encodeURIComponent(q)}`,
};

// Strip noise words from query to extract the topic
const QUERY_NOISE = /\b(?:news|latest|about|check|search|find|on|from|in|what(?:'s| is| are)|tell me|give me|show me|recent|today|article|articles)\b/gi;

/**
 * Smart search fallback: when no TAVILY key, detect known site in query,
 * construct a site-specific search URL, and crawl it via crawl4ai.
 *
 * Returns structured results or null if no site detected.
 */
export async function smartSearch(rawQuery: string): Promise<string | null> {
  const qLower = rawQuery.toLowerCase();

  for (const [keyword, urlBuilder] of Object.entries(SITE_SEARCH_MAP)) {
    if (qLower.includes(keyword)) {
      const topic = rawQuery
        .replace(new RegExp(keyword, 'gi'), '')
        .replace(QUERY_NOISE, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (topic.length < 2) continue;

      const searchUrl = urlBuilder(topic);
      logger.info({ keyword, topic, searchUrl }, 'web_research: smart search via site-specific URL');
      try {
        const content = await fetchAndExtract(searchUrl);
        return `Search results from ${keyword.toUpperCase()} for "${topic}":\n\n${content}`;
      } catch (err) {
        logger.warn({ keyword, topic, err: err instanceof Error ? err.message : String(err) }, 'web_research: smart search failed');
      }
    }
  }

  return null;
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

/**
 * Take a full-page screenshot via crawl4ai.
 * Returns base64-encoded PNG string.
 */
export async function fetchScreenshot(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CRAWL4AI_TIMEOUT_MS);

  try {
    const resp = await fetch(`${config.crawl4aiUrl}/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, screenshot: true }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`crawl4ai screenshot failed: HTTP ${resp.status}`);

    const data = await resp.json() as { success?: boolean; screenshot?: string };
    if (!data.success || !data.screenshot) {
      throw new Error('crawl4ai screenshot returned no image data');
    }

    logger.info({ url, bytes: Math.round(data.screenshot.length * 0.75) }, 'web_fetch: screenshot captured');
    return data.screenshot; // base64 PNG
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export interface LinkItem {
  href: string;
  text: string;
  type: 'internal' | 'external';
}

/**
 * Extract all links from a page via crawl4ai.
 * Returns deduplicated list of internal and external links.
 */
export async function extractLinks(url: string, filter: 'internal' | 'external' | 'all' = 'all'): Promise<LinkItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CRAWL4AI_TIMEOUT_MS);

  try {
    const resp = await fetch(`${config.crawl4aiUrl}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], priority: 5 }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`crawl4ai link extraction failed: HTTP ${resp.status}`);

    const data = await resp.json() as {
      results?: Array<{
        links?: { internal?: Array<{ href: string; text?: string }>; external?: Array<{ href: string; text?: string }> };
        success?: boolean;
      }>;
    };

    const result = data.results?.[0];
    if (!result?.success) throw new Error('crawl4ai link extraction returned no results');

    const internal: LinkItem[] = (result.links?.internal || []).map(l => ({
      href: l.href,
      text: l.text?.trim() || l.href,
      type: 'internal' as const,
    }));
    const external: LinkItem[] = (result.links?.external || []).map(l => ({
      href: l.href,
      text: l.text?.trim() || l.href,
      type: 'external' as const,
    }));

    const all = filter === 'internal' ? internal
      : filter === 'external' ? external
      : [...internal, ...external];

    // Deduplicate by href
    const seen = new Set<string>();
    return all.filter(l => {
      if (seen.has(l.href)) return false;
      seen.add(l.href);
      return true;
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
