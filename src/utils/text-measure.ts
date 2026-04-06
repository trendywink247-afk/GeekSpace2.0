/**
 * Shared text measurement utility powered by @chenglou/pretext.
 * Provides DOM-reflow-free text measurement for chat virtualization
 * and canvas speech bubble rendering.
 */
import {
  prepare,
  layout,
  prepareWithSegments,
  layoutWithLines,
  type PreparedText,
  type PreparedTextWithSegments,
  type LayoutResult,
  type LayoutLinesResult,
} from '@chenglou/pretext';

export type { PreparedText, PreparedTextWithSegments, LayoutResult, LayoutLinesResult };

// ── Height-only measurement ──

export function measureMessageHeight(
  text: string,
  containerWidth: number,
  font: string,
  lineHeight: number,
): LayoutResult {
  const prepared = prepare(text, font);
  return layout(prepared, containerWidth, lineHeight);
}

// ── Line-by-line measurement (for canvas rendering) ──

export function measureMessageLines(
  text: string,
  containerWidth: number,
  font: string,
  lineHeight: number,
): LayoutLinesResult {
  const prepared = prepareWithSegments(text, font);
  return layoutWithLines(prepared, containerWidth, lineHeight);
}

// ── Prepared object cache ──
// Reuse across resize events — prepare() is ~19ms/500 texts,
// layout() with cached data is ~0.09ms/500 texts.

interface TextCacheEntry {
  prepared: PreparedText;
  preparedWithSegments?: PreparedTextWithSegments;
}

export interface TextCache {
  getOrPrepare(text: string, font: string): PreparedText;
  getOrPrepareWithSegments(text: string, font: string): PreparedTextWithSegments;
  measureHeight(text: string, font: string, width: number, lineHeight: number): LayoutResult;
  measureLines(text: string, font: string, width: number, lineHeight: number): LayoutLinesResult;
  clear(): void;
  size(): number;
}

export function createTextCache(maxSize = 500): TextCache {
  const cache = new Map<string, TextCacheEntry>();

  function cacheKey(text: string, font: string): string {
    return `${font}\0${text}`;
  }

  function evictIfNeeded(): void {
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
  }

  function getOrPrepare(text: string, font: string): PreparedText {
    const key = cacheKey(text, font);
    let entry = cache.get(key);
    if (!entry) {
      evictIfNeeded();
      entry = { prepared: prepare(text, font) };
      cache.set(key, entry);
    }
    return entry.prepared;
  }

  function getOrPrepareWithSegments(text: string, font: string): PreparedTextWithSegments {
    const key = cacheKey(text, font);
    let entry = cache.get(key);
    if (entry?.preparedWithSegments) return entry.preparedWithSegments;

    const preparedWithSeg = prepareWithSegments(text, font);
    if (entry) {
      entry.preparedWithSegments = preparedWithSeg;
    } else {
      evictIfNeeded();
      entry = { prepared: prepare(text, font), preparedWithSegments: preparedWithSeg };
      cache.set(key, entry);
    }
    return preparedWithSeg;
  }

  return {
    getOrPrepare,
    getOrPrepareWithSegments,
    measureHeight(text, font, width, lineHeight) {
      const p = getOrPrepare(text, font);
      return layout(p, width, lineHeight);
    },
    measureLines(text, font, width, lineHeight) {
      const p = getOrPrepareWithSegments(text, font);
      return layoutWithLines(p, width, lineHeight);
    },
    clear() { cache.clear(); },
    size() { return cache.size; },
  };
}
