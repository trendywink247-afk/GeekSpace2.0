// Smart response caching for common queries
// Caches responses for frequently asked questions with configurable TTL

import { cacheGet, cacheSet } from './cache.js';
import { logger } from '../logger.js';

// Common question patterns that should be cached longer (1 hour)
const LONG_CACHE_PATTERNS = [
  /^(what|who) (are you|is (?:agentin|weebo|edith|jarvis))/i,
  /^(what can you|how do you|tell me about yourself)/i,
  /^(help|capabilities|features|what do you do)/i,
  /^(hi|hello|hey|namaste|good (?:morning|afternoon|evening))/i,
];

// Normalize a message for cache key generation
// Removes filler words, lowercases, trims whitespace
export function normalizeForCache(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\b(please|kindly|could you|can you|would you|i want to|i need to|help me)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Determine cache TTL based on message type
export function getCacheTTL(message: string): number {
  const lower = message.toLowerCase().trim();

  // Greetings and identity questions: 1 hour
  if (LONG_CACHE_PATTERNS.some(p => p.test(lower))) return 3600;

  // Short factual queries: 30 minutes
  if (lower.split(' ').length <= 5) return 1800;

  // Default: 5 minutes
  return 300;
}

// Check if a response should be cached
export function isCacheable(message: string): boolean {
  const lower = message.toLowerCase().trim();

  // Don't cache tool-triggering messages
  if (/\b(remind|search|generate|create|send|schedule|build|make)\b/i.test(lower)) return false;

  // Don't cache very long messages (likely complex/unique)
  if (message.length > 500) return false;

  // Don't cache messages with URLs
  if (/https?:\/\//.test(message)) return false;

  return true;
}

// Smart cache key that normalizes similar questions
export function smartCacheKey(userId: string, message: string, personalityId: string): string {
  const normalized = normalizeForCache(message);
  // Include personality but not full system prompt (reduces key uniqueness)
  return `llm:smart:${personalityId}:${normalized.slice(0, 100)}`;
}

// Get cached response
export async function getSmartCachedResponse(
  userId: string,
  message: string,
  personalityId: string,
): Promise<{ reply: string; provider: string; model: string } | null> {
  if (!isCacheable(message)) return null;

  const key = smartCacheKey(userId, message, personalityId);
  try {
    const cached = await cacheGet(key);
    if (cached) {
      logger.debug({ key, hit: true }, 'smart-cache:hit');
      return JSON.parse(cached);
    }
  } catch { /* cache miss */ }
  return null;
}

// Store response in smart cache
export async function setSmartCachedResponse(
  userId: string,
  message: string,
  personalityId: string,
  response: { reply: string; provider: string; model: string },
): Promise<void> {
  if (!isCacheable(message)) return;

  const key = smartCacheKey(userId, message, personalityId);
  const ttl = getCacheTTL(message);
  try {
    await cacheSet(key, JSON.stringify(response), ttl);
    logger.debug({ key, ttl }, 'smart-cache:set');
  } catch { /* non-fatal */ }
}
