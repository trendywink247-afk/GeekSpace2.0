/**
 * @fileoverview AnimationTierSelector edge case tests
 * Tests invalid inputs, boundary conditions, and concurrent state
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
} from '../AnimationTierSelector';
import type { AnimationTier } from '../AnimationTierSelector';

describe('AnimationTierSelector — Edge Cases', () => {
  afterEach(() => {
    // Clear any request tracking state between tests
    clearRequest('test-req-1');
    clearRequest('test-req-2');
    clearRequest('test-req-3');
  });

  // ─── Invalid thinking start time ─────────────────────────────────────────
  describe('selectAnimationTier — Invalid thinkingStartTime', () => {
    it('handles future timestamp (thinkingStartTime > Date.now())', () => {
      const futureTime = Date.now() + 10_000; // 10s in future
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: futureTime,
      });
      // Should return 1 (negative duration evaluates to false for > 10s check)
      expect(tier).toBe(1);
      expect([1, 2, 3]).toContain(tier); // Always valid tier
    });

    it('handles NaN thinkingStartTime', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: NaN,
      });
      // Should not crash, return valid tier
      expect(tier).toBe(1);
      expect([1, 2, 3]).toContain(tier);
    });

    it('handles Infinity thinkingStartTime', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Infinity,
      });
      // Should handle gracefully
      expect([1, 2, 3]).toContain(tier);
    });

    it('handles negative thinkingStartTime', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: -1000,
      });
      // Negative start time = very old, > 10s, should return 3
      expect(tier).toBe(3);
    });

    it('returns valid tier (1|2|3) for all invalid inputs', () => {
      const testCases = [
        { thinkingStartTime: NaN },
        { thinkingStartTime: Infinity },
        { thinkingStartTime: -9999 },
        { thinkingStartTime: Date.now() + 1_000_000 },
      ];

      testCases.forEach(({ thinkingStartTime }) => {
        const tier = selectAnimationTier({
          isFirstVisit: false,
          isMultiAgent: false,
          toolCallCount: 0,
          thinkingStartTime,
        });
        expect([1, 2, 3]).toContain(tier);
      });
    });
  });

  // ─── Tier selection always returns valid value ──────────────────────────
  describe('selectAnimationTier — Tier validity', () => {
    it('always returns 1, 2, or 3 (never 0, 4, or undefined)', () => {
      const testContexts = [
        { isFirstVisit: true, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: true, toolCallCount: 0, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 5, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: Date.now() - 15_000 },
        { isFirstVisit: true, isMultiAgent: true, toolCallCount: 10, thinkingStartTime: Date.now() - 20_000 },
      ];

      testContexts.forEach((ctx) => {
        const tier = selectAnimationTier(ctx);
        expect([1, 2, 3]).toContain(tier);
        expect(tier).toBeGreaterThanOrEqual(1);
        expect(tier).toBeLessThanOrEqual(3);
      });
    });

    it('never returns 0 (minimum should be 1)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBeGreaterThanOrEqual(1);
    });

    it('never returns 4+ (maximum should be 3)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: true,
        toolCallCount: 100,
        thinkingStartTime: Date.now() - 1_000_000,
      });
      expect(tier).toBeLessThanOrEqual(3);
    });
  });

  // ─── Tool call tracking edge cases ──────────────────────────────────────
  describe('trackToolCall — Edge Cases', () => {
    it('increments count for each call with same requestId', () => {
      const requestId = 'test-req-1';
      const count1 = trackToolCall(requestId);
      const count2 = trackToolCall(requestId);
      const count3 = trackToolCall(requestId);

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it('returns 0 for undefined requestId (no-op)', () => {
      const count = trackToolCall(undefined);
      expect(count).toBe(0);
    });

    it('returns 0 for null requestId (no-op)', () => {
      const count = trackToolCall(null as any);
      expect(count).toBe(0);
    });

    it('returns 0 for empty string requestId', () => {
      const count = trackToolCall('');
      expect(count).toBe(0); // May track as empty key, or no-op
    });

    it('tracks separate counts for different requestIds', () => {
      const count1a = trackToolCall('req-1');
      const count1b = trackToolCall('req-1');
      const count2a = trackToolCall('req-2');
      const count2b = trackToolCall('req-2');

      expect(count1a).toBe(1);
      expect(count1b).toBe(2);
      expect(count2a).toBe(1); // Separate request
      expect(count2b).toBe(2);
    });

    it('maintains count across multiple rapid calls', () => {
      const requestId = 'rapid-test';
      const counts: number[] = [];

      for (let i = 0; i < 10; i++) {
        counts.push(trackToolCall(requestId));
      }

      expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('handles very long requestId strings', () => {
      const longId = 'a'.repeat(10000);
      const count = trackToolCall(longId);
      expect(count).toBe(1);
    });
  });

  // ─── Clear request edge cases ──────────────────────────────────────────
  describe('clearRequest — Edge Cases', () => {
    it('clears existing request entry', () => {
      const requestId = 'clear-test-1';
      trackToolCall(requestId);
      trackToolCall(requestId);

      clearRequest(requestId);

      // After clear, next call should reset to 1
      const count = trackToolCall(requestId);
      expect(count).toBe(1);
    });

    it('no-ops when clearing non-existent requestId', () => {
      expect(() => clearRequest('non-existent')).not.toThrow();
    });

    it('no-ops when clearing undefined requestId', () => {
      expect(() => clearRequest(undefined)).not.toThrow();
    });

    it('no-ops when clearing null requestId', () => {
      expect(() => clearRequest(null as any)).not.toThrow();
    });

    it('does not affect other request tracking', () => {
      const req1 = 'req-1';
      const req2 = 'req-2';

      trackToolCall(req1);
      trackToolCall(req1);
      trackToolCall(req2);

      clearRequest(req1);

      const count2 = trackToolCall(req2);
      expect(count2).toBe(2); // req2 should continue, not reset
    });

    it('handles clearing same request multiple times', () => {
      const requestId = 'multi-clear';
      trackToolCall(requestId);

      clearRequest(requestId);
      clearRequest(requestId);
      clearRequest(requestId);

      const count = trackToolCall(requestId);
      expect(count).toBe(1); // Should reset after first clear
    });
  });

  // ─── LocalStorage visit tracking edge cases ────────────────────────────
  describe('Visit tracking — Edge Cases', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
    });

    it('isFirstVisit returns true initially', () => {
      expect(isFirstVisit()).toBe(true);
    });

    it('isFirstVisit returns false after markVisited', () => {
      expect(isFirstVisit()).toBe(true);
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('markVisited is idempotent', () => {
      markVisited();
      markVisited();
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('handles corrupted localStorage value gracefully', () => {
      localStorage.setItem('office_visited', '');
      expect(isFirstVisit()).toBe(false); // Empty string is falsy
    });

    it('handles other values in localStorage', () => {
      localStorage.setItem('office_visited', 'false');
      expect(isFirstVisit()).toBe(false); // Any value is truthy
    });

    it('respects localStorage across multiple calls', () => {
      expect(isFirstVisit()).toBe(true);
      markVisited();
      expect(isFirstVisit()).toBe(false);
      expect(isFirstVisit()).toBe(false); // Still false
    });
  });

  // ─── Concurrent request tracking ────────────────────────────────────────
  describe('trackToolCall — Concurrent Requests', () => {
    it('handles interleaved calls to different requests', () => {
      const req1 = trackToolCall('req-a');
      const req2 = trackToolCall('req-b');
      const req1_2 = trackToolCall('req-a');
      const req2_2 = trackToolCall('req-b');

      expect(req1).toBe(1);
      expect(req2).toBe(1);
      expect(req1_2).toBe(2);
      expect(req2_2).toBe(2);
    });

    it('maintains independent counts during async operations', async () => {
      const req1 = trackToolCall('async-1');
      expect(req1).toBe(1);

      // Simulate async gap
      await new Promise((r) => setTimeout(r, 10));

      const req2 = trackToolCall('async-2');
      expect(req2).toBe(1); // Different request

      const req1_2 = trackToolCall('async-1');
      expect(req1_2).toBe(2); // Continue from 1
    });
  });

  // ─── Type safety tests ──────────────────────────────────────────────────
  describe('selectAnimationTier — Type Safety', () => {
    it('returns AnimationTier type (narrowed to 1|2|3)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 2,
        thinkingStartTime: 0,
      }) as AnimationTier;

      // Compile-time check: tier should only be 1, 2, or 3
      if (tier === 1) {
        expect(true).toBe(true);
      } else if (tier === 2) {
        expect(true).toBe(true);
      } else if (tier === 3) {
        expect(true).toBe(true);
      } else {
        // TypeScript should error here at compile time
        expect(true).toBe(false); // Runtime should never reach
      }
    });
  });
});
