/**
 * @fileoverview AnimationTierSelector module state and cleanup tests
 * REQUIRES: Export __resetModuleState(), REQUEST_TTL_MS, cleanStaleRequests(), getRequestCount()
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  __resetModuleState,
  REQUEST_TTL_MS,
  cleanStaleRequests,
  getRequestCount,
  getRequestToolCount,
} from '../systems/animation/AnimationTierSelector';

describe('AnimationTierSelector — Module State & Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetModuleState(); // REQUIRES export
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ─── Request tracking with isolation ──────────────────────────────────
  describe('Request tool count tracking (isolated)', () => {
    it('increments count for same requestId', () => {
      const count1 = trackToolCall('req-123');
      const count2 = trackToolCall('req-123');
      const count3 = trackToolCall('req-123');

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it('isolates different request IDs', () => {
      trackToolCall('req-a');
      trackToolCall('req-a');
      trackToolCall('req-b');
      trackToolCall('req-b');
      trackToolCall('req-b');

      expect(getRequestToolCount('req-a')).toBe(2);
      expect(getRequestToolCount('req-b')).toBe(3);
    });

    it('returns 0 for non-existent request', () => {
      expect(getRequestToolCount('unknown-req')).toBe(0);
    });

    it('clearRequest removes tracking for ID', () => {
      trackToolCall('req-clear');
      trackToolCall('req-clear');
      expect(getRequestToolCount('req-clear')).toBe(2);

      clearRequest('req-clear');
      expect(getRequestToolCount('req-clear')).toBe(0);
    });

    it('rejects invalid requestIds (empty string, undefined)', () => {
      expect(trackToolCall('')).toBe(0);
      expect(trackToolCall(undefined)).toBe(0);
      expect(trackToolCall(null as any)).toBe(0);
      expect(getRequestCount()).toBe(0);
    });
  });

  // ─── Stale entry cleanup ──────────────────────────────────────────────
  describe('Stale request cleanup (TTL=60s)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('removes entries older than REQUEST_TTL_MS (60s)', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      trackToolCall('old-req');
      expect(getRequestCount()).toBe(1);

      // Fast-forward 61 seconds
      vi.advanceTimersByTime(REQUEST_TTL_MS + 1000);

      // Cleanup should remove stale entry
      cleanStaleRequests();
      expect(getRequestCount()).toBe(0);
    });

    it('keeps entries younger than REQUEST_TTL_MS', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      trackToolCall('young-req');
      expect(getRequestCount()).toBe(1);

      // Fast-forward 30 seconds (< 60s)
      vi.advanceTimersByTime(30_000);

      cleanStaleRequests();
      expect(getRequestCount()).toBe(1); // Still present
    });

    it('mixed cleanup: removes old, keeps young', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      trackToolCall('req-old');
      trackToolCall('req-old');

      // Fast-forward 50 seconds
      vi.advanceTimersByTime(50_000);
      trackToolCall('req-new');

      // Fast-forward 15 more seconds (total: 65s for old, 15s for new)
      vi.advanceTimersByTime(15_000);

      cleanStaleRequests();

      expect(getRequestCount()).toBe(1);
      expect(getRequestToolCount('req-new')).toBe(1);
      expect(getRequestToolCount('req-old')).toBe(0);
    });

    it('cleanup runs automatically every 30s during tracking', () => {
      vi.setSystemTime(0);

      // Create old entry
      trackToolCall('old');
      vi.advanceTimersByTime(REQUEST_TTL_MS + 1000); // 61s

      // Tracking new request should trigger cleanup at 30s mark
      trackToolCall('new');

      // Cleanup should have run automatically
      expect(getRequestCount()).toBeLessThanOrEqual(1);
    });
  });

  // ─── Memory limits (max 500 requests) ────────────────────────────────
  describe('Memory bounds (max 500 tracked requests)', () => {
    it('evicts oldest entry when exceeding MAX_TRACKED_REQUESTS (500)', () => {
      // Create 501 requests
      for (let i = 0; i < 501; i++) {
        trackToolCall(`req-${i}`);
      }

      // Should have evicted the oldest (req-0)
      expect(getRequestToolCount('req-0')).toBe(0);
      expect(getRequestToolCount('req-500')).toBe(1);
      expect(getRequestCount()).toBeLessThanOrEqual(500);
    });

    it('LRU eviction: removes oldest, not newest', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);

      // Create req-old at t=1000
      trackToolCall('req-old');

      // Create req-middle at t=2000
      vi.advanceTimersByTime(1000);
      trackToolCall('req-middle');

      // Create req-new at t=3000
      vi.advanceTimersByTime(1000);
      trackToolCall('req-new');

      // Fill to 501 (triggers eviction)
      for (let i = 0; i < 498; i++) {
        trackToolCall(`req-${i}`);
      }

      // Oldest (req-old) should be evicted
      expect(getRequestToolCount('req-old')).toBe(0);
      expect(getRequestToolCount('req-new')).toBeGreaterThan(0);
      expect(getRequestToolCount('req-middle')).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  // ─── Reset functionality ──────────────────────────────────────────────
  describe('__resetModuleState() for test isolation', () => {
    it('clears all request tracking', () => {
      trackToolCall('a');
      trackToolCall('b');
      trackToolCall('c');
      expect(getRequestCount()).toBe(3);

      __resetModuleState();

      expect(getRequestCount()).toBe(0);
      expect(getRequestToolCount('a')).toBe(0);
    });

    it('allows tests to start with clean state', () => {
      // Setup test 1
      trackToolCall('test1');
      expect(getRequestCount()).toBe(1);

      // Cleanup for test 2
      __resetModuleState();

      // Test 2 starts fresh
      expect(getRequestCount()).toBe(0);
      trackToolCall('test2');
      expect(getRequestCount()).toBe(1);
    });
  });
});
