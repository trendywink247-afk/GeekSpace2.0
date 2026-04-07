/**
 * @fileoverview AnimationTierSelector thinking time boundary and tier selection tests
 * Tests the 10-second threshold, invalid timestamps, and tier decision logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
} from '../systems/animation/AnimationTierSelector';
import type { AnimationTier } from '../systems/animation/AnimationTierSelector';

describe('AnimationTierSelector — Thinking Time & Tier Selection', () => {
  // ─── 10-second thinking time threshold ─────────────────────────────────
  describe('Thinking time 10-second boundary', () => {
    it('returns Tier 1 for thinking time <10 seconds', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 9_999, // 9.999 seconds ago
      });
      expect(tier).toBe(1);
    });

    it('returns Tier 3 for thinking time >=10 seconds', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 10_000, // Exactly 10 seconds
      });
      expect(tier).toBe(3);
    });

    it('returns Tier 3 for thinking time >10 seconds', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 15_000, // 15 seconds ago
      });
      expect(tier).toBe(3);
    });

    it('boundary precision: 9999ms returns Tier 1, 10000ms returns Tier 3', () => {
      const tier9999 = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 9_999,
      });
      expect(tier9999).toBe(1);

      const tier10000 = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 10_000,
      });
      expect(tier10000).toBe(3);
    });

    it('very long thinking time (>30s) still returns Tier 3', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 30_000,
      });
      expect(tier).toBe(3);
    });
  });

  // ─── Invalid and edge-case timestamps ──────────────────────────────────
  describe('Invalid thinkingStartTime handling', () => {
    it('handles future timestamp (returns Tier 1)', () => {
      const futureTime = Date.now() + 10_000; // 10s in future
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: futureTime,
      });
      // Negative duration, so >10s check fails → Tier 1
      expect(tier).toBe(1);
      expect([1, 2, 3]).toContain(tier);
    });

    it('handles very far future timestamp', () => {
      const farFuture = Date.now() + 1_000_000_000; // 11+ days in future
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: farFuture,
      });
      expect([1, 2, 3]).toContain(tier);
    });

    it('handles NaN thinkingStartTime gracefully', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: NaN,
      });
      expect([1, 2, 3]).toContain(tier);
      expect(Number.isNaN(tier)).toBe(false);
    });

    it('handles Infinity thinkingStartTime', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Infinity,
      });
      expect([1, 2, 3]).toContain(tier);
    });

    it('handles -Infinity thinkingStartTime (very old, >10s)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: -Infinity,
      });
      // Negative infinity = very old, should trigger >10s check
      expect(tier).toBe(3);
    });

    it('handles negative thinkingStartTime (Unix epoch before 1970)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: -1000,
      });
      // Negative start time = extremely old, >10s → Tier 3
      expect(tier).toBe(3);
    });

    it('handles 0 as thinkingStartTime (not thinking)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      // 0 indicates no thinking (thinkingStartTime > 0 check fails)
      expect(tier).toBe(1);
    });
  });

  // ─── Tier selection priority (decision tree) ───────────────────────────
  describe('Tier selection decision tree', () => {
    it('isFirstVisit=true always returns Tier 3 (highest priority)', () => {
      const tiers = [
        selectAnimationTier({
          isFirstVisit: true,
          isMultiAgent: false,
          toolCallCount: 0,
          thinkingStartTime: 0,
        }),
        selectAnimationTier({
          isFirstVisit: true,
          isMultiAgent: true,
          toolCallCount: 5,
          thinkingStartTime: Date.now() - 5_000,
        }),
      ];
      expect(tiers).toEqual([3, 3]);
    });

    it('isMultiAgent=true with no first visit returns Tier 2', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('toolCallCount>=2 with no first visit returns Tier 2', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 2,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('long thinking (>10s) with no first visit returns Tier 3', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 15_000,
      });
      expect(tier).toBe(3);
    });

    it('simple request (all false/0) returns Tier 1', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('priority order: isFirstVisit > isMultiAgent/toolCallCount > thinkingTime > default', () => {
      const scenarios = [
        // isFirstVisit overrides everything
        {
          ctx: {
            isFirstVisit: true,
            isMultiAgent: false,
            toolCallCount: 0,
            thinkingStartTime: 0,
          },
          expected: 3,
        },
        // isMultiAgent overrides thinkingTime
        {
          ctx: {
            isFirstVisit: false,
            isMultiAgent: true,
            toolCallCount: 0,
            thinkingStartTime: 0,
          },
          expected: 2,
        },
        // thinkingTime overrides default
        {
          ctx: {
            isFirstVisit: false,
            isMultiAgent: false,
            toolCallCount: 0,
            thinkingStartTime: Date.now() - 15_000,
          },
          expected: 3,
        },
        // default is Tier 1
        {
          ctx: {
            isFirstVisit: false,
            isMultiAgent: false,
            toolCallCount: 0,
            thinkingStartTime: 0,
          },
          expected: 1,
        },
      ];

      scenarios.forEach(({ ctx, expected }) => {
        const tier = selectAnimationTier(ctx);
        expect(tier).toBe(expected);
      });
    });
  });

  // ─── Tool call count thresholds ────────────────────────────────────────
  describe('Tool call count threshold (>=2 = Tier 2)', () => {
    it('toolCallCount=0 returns Tier 1', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('toolCallCount=1 returns Tier 1', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('toolCallCount=2 returns Tier 2', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 2,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('toolCallCount=5 returns Tier 2', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 5,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('toolCallCount=100 returns Tier 2 (not 3)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 100,
        thinkingStartTime: 0,
      });
      // toolCallCount doesn't escalate beyond Tier 2
      expect(tier).toBe(2);
    });
  });

  // ─── Always returns valid tier ────────────────────────────────────────
  describe('Tier validity (always 1|2|3)', () => {
    it('never returns 0 (minimum valid tier is 1)', () => {
      const testCases = [
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: NaN },
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: -1 },
      ];

      testCases.forEach((ctx) => {
        const tier = selectAnimationTier(ctx);
        expect(tier).toBeGreaterThanOrEqual(1);
      });
    });

    it('never returns 4+ (maximum valid tier is 3)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: true,
        toolCallCount: 100,
        thinkingStartTime: Date.now() - 1_000_000,
      });
      expect(tier).toBeLessThanOrEqual(3);
    });

    it('never returns undefined, null, or non-number', () => {
      const testCases = [
        { isFirstVisit: true, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: true, toolCallCount: 0, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 5, thinkingStartTime: 0 },
        { isFirstVisit: false, isMultiAgent: false, toolCallCount: 0, thinkingStartTime: Date.now() - 20_000 },
      ];

      testCases.forEach((ctx) => {
        const tier = selectAnimationTier(ctx);
        expect(typeof tier).toBe('number');
        expect([1, 2, 3]).toContain(tier);
      });
    });
  });

  // ─── Combined scenarios (realistic usage) ──────────────────────────────
  describe('Realistic scenario combinations', () => {
    it('new user with simple request: first visit + no tools = Tier 3', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(3); // First visit wins
    });

    it('returning user with complex request: 3 tools, 2s thinking = Tier 2', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 3,
        thinkingStartTime: Date.now() - 2_000,
      });
      expect(tier).toBe(2); // toolCallCount >= 2 triggers Tier 2
    });

    it('multi-agent coordination: returning user + multi-agent = Tier 2', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2); // isMultiAgent triggers Tier 2
    });

    it('long thinking wait: simple request but >10s thinking = Tier 3', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 12_000,
      });
      expect(tier).toBe(3); // Thinking time > 10s triggers Tier 3
    });

    it('everything combined: first visit + multi-agent + 3 tools + 15s thinking = Tier 3', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: true,
        toolCallCount: 3,
        thinkingStartTime: Date.now() - 15_000,
      });
      expect(tier).toBe(3); // isFirstVisit takes highest priority
    });
  });
});
