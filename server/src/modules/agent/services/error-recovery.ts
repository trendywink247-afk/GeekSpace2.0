/**
 * Error Recovery Service
 *
 * When a tool fails, this service suggests alternative tools or adjusted params.
 * Wraps the action executor to add intelligent fallback chains.
 */

import type { ParsedAction } from '../../../services/action-parser.js';

export interface RecoveryStrategy {
  alternativeTool?: string;
  alternativeParams?: Record<string, unknown>;
  reason: string;
  shouldRetry: boolean;
}

/**
 * Built-in fallback chains for common tools.
 * If the primary tool fails, try the next one.
 */
const FALLBACK_CHAINS: Record<string, string[]> = {
  web_search: ['crawl_url', 'web_fetch'],
  crawl_url: ['web_fetch', 'web_search'],
  web_fetch: ['crawl_url', 'web_search'],
  take_screenshot: ['get_links', 'crawl_url'],
  send_email: [], // No fallback — user must approve via different channel
  generate_image: [], // No good fallback for image gen
  send_telegram: ['send_email'],
};

/**
 * Determine recovery strategy based on the failed tool and error message.
 */
export function getRecoveryStrategy(
  failedTool: string,
  errorMessage: string,
  attemptNumber = 1,
): RecoveryStrategy | null {
  // Don't retry more than twice
  if (attemptNumber > 2) {
    return null;
  }

  const errorLower = errorMessage.toLowerCase();

  // Network/timeout errors — try alternative
  if (
    errorLower.includes('timeout') ||
    errorLower.includes('econnrefused') ||
    errorLower.includes('enotfound')
  ) {
    const alternatives = FALLBACK_CHAINS[failedTool];
    if (alternatives && alternatives.length > 0) {
      return {
        alternativeTool: alternatives[0],
        reason: `${failedTool} timed out, trying ${alternatives[0]} instead`,
        shouldRetry: true,
      };
    }
  }

  // Rate limit — wait then retry same tool
  if (
    errorLower.includes('rate limit') ||
    errorLower.includes('429') ||
    errorLower.includes('quota')
  ) {
    return {
      reason: `${failedTool} rate limited, will wait and retry`,
      shouldRetry: true,
    };
  }

  // Auth errors — don't retry
  if (
    errorLower.includes('401') ||
    errorLower.includes('unauthorized') ||
    errorLower.includes('forbidden')
  ) {
    return {
      reason: `${failedTool} requires authentication setup — not retrying`,
      shouldRetry: false,
    };
  }

  // Generic error with fallback chain available
  const alternatives = FALLBACK_CHAINS[failedTool];
  if (alternatives && alternatives.length > 0 && attemptNumber === 1) {
    return {
      alternativeTool: alternatives[0],
      reason: `${failedTool} failed, trying ${alternatives[0]} as fallback`,
      shouldRetry: true,
    };
  }

  return null;
}

/**
 * Apply a recovery strategy to a parsed action, returning a new action to try.
 */
export function applyRecoveryStrategy(
  originalAction: ParsedAction,
  strategy: RecoveryStrategy,
): ParsedAction {
  if (strategy.alternativeTool) {
    return {
      tool: strategy.alternativeTool,
      params:
        strategy.alternativeParams ||
        transformParamsForTool(
          originalAction.tool,
          strategy.alternativeTool,
          originalAction.params,
        ),
    };
  }
  return originalAction; // Just retry as-is
}

/**
 * Transform params from one tool's format to another's when possible.
 * E.g., web_search { query: "X" } → crawl_url { url: "https://duckduckgo.com/?q=X" }
 */
function transformParamsForTool(
  fromTool: string,
  toTool: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  // web_search → crawl_url: convert query to a search URL
  if (fromTool === 'web_search' && toTool === 'crawl_url' && params.query) {
    return { url: `https://duckduckgo.com/?q=${encodeURIComponent(String(params.query))}` };
  }
  // crawl_url → web_fetch: same params
  if (fromTool === 'crawl_url' && toTool === 'web_fetch') {
    return { url: params.url };
  }
  // web_fetch → web_search: extract domain, search for it
  if (fromTool === 'web_fetch' && toTool === 'web_search' && params.url) {
    try {
      const url = new URL(String(params.url));
      return { query: `${url.hostname} ${url.pathname.split('/').pop() ?? ''}`.trim() };
    } catch {
      return { query: String(params.url) };
    }
  }
  // send_telegram → send_email: convert message to email body
  if (fromTool === 'send_telegram' && toTool === 'send_email' && params.message) {
    return {
      to: 'self',
      subject: 'Notification',
      body: String(params.message),
    };
  }
  // Default: pass through
  return params;
}

/**
 * Sleep helper for rate limit retries.
 * Returns delay in ms: 2s, 4s, 8s, capped at 10s.
 */
export function getRetryDelay(attemptNumber: number): number {
  return Math.min(2000 * Math.pow(2, attemptNumber - 1), 10000);
}

