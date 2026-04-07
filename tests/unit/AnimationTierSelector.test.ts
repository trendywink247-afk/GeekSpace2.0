/**
 * Unit tests for AnimationTierSelector.ts
 * Tests animation tier selection logic, tool call tracking, and localStorage integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
  type AnimationTier,
} from '@/dashboard/pages/office/systems/animation/AnimationTierSelector';

describe('AnimationTierSelector', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('selectAnimationTier - Decision Tree', () => {
    it('returns tier 3 for first-time visitors regardless of context', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(3);
    });

    it('returns tier 3 for long thinking (>10s) when not first visit', () => {
      const thinkingStartTime = Date.now() - 11_000; // 11 seconds ago
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime,
      });
      expect(tier).toBe(3);
    });

    it('returns tier 2 for multi-agent coordination', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('returns tier 2 for complex requests (toolCallCount >= 2)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 2,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('returns tier 1 for simple single-agent requests', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('applies priority: isFirstVisit > isMultiAgent > toolCount > thinkingTime', () => {
      // First visit takes precedence over everything
      const tier1 = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier1).toBe(3);

      // Multi-agent precedence over thinking time
      const tier2 = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 5_000, // 5s, below threshold
      });
      expect(tier2).toBe(2);
    });
  });

  describe('trackToolCall', () => {
    it('increments and returns tool call count', () => {
      const requestId = 'req-123';
      const count1 = trackToolCall(requestId);
      const count2 = trackToolCall(requestId);
      const count3 = trackToolCall(requestId);

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it('returns 0 when requestId is undefined', () => {
      const count = trackToolCall(undefined);
      expect(count).toBe(0);
    });

    it('maintains separate counts for different request IDs', () => {
      const count1 = trackToolCall('req-1');
      const count2 = trackToolCall('req-2');
      const count3 = trackToolCall('req-1');

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(2);
    });
  });

  describe('clearRequest', () => {
    it('removes tool call tracking for a request', () => {
      const requestId = 'req-123';
      trackToolCall(requestId);
      trackToolCall(requestId);

      clearRequest(requestId);

      // After clear, next call should start at 1 again
      const count = trackToolCall(requestId);
      expect(count).toBe(1);
    });

    it('is idempotent (no-op if request not tracked)', () => {
      expect(() => clearRequest('nonexistent-req')).not.toThrow();
    });

    it('silently does nothing when requestId is undefined', () => {
      expect(() => clearRequest(undefined)).not.toThrow();
    });
  });

  describe('isFirstVisit & markVisited', () => {
    it('returns true when office_visited not in localStorage', () => {
      expect(isFirstVisit()).toBe(true);
    });

    it('returns false after markVisited() is called', () => {
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('persists across multiple isFirstVisit() calls', () => {
      expect(isFirstVisit()).toBe(true);
      markVisited();
      expect(isFirstVisit()).toBe(false);
      expect(isFirstVisit()).toBe(false); // Still false
    });

    it('handles localStorage quota exceeded gracefully', () => {
      // Simulate quota exceeded error
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => markVisited()).toThrow();
      setItemSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('handles thinkingStartTime = 0 (not thinking)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('handles thinking duration at boundary (exactly 10s)', () => {
      const thinkingStartTime = Date.now() - 10_000;
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime,
      });
      // 10s = 10_000ms, threshold is > 10_000, so should be tier 1
      expect(tier).toBe(1);
    });

    it('handles thinking duration just above boundary (10.1s)', () => {
      const thinkingStartTime = Date.now() - 10_100;
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime,
      });
      expect(tier).toBe(3);
    });

    it('handles high tool call count', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 100,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });
  });
});
