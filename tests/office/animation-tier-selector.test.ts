import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
} from '@/dashboard/pages/office/systems/animation/AnimationTierSelector';

describe('AnimationTierSelector', () => {
  describe('selectAnimationTier', () => {
    it('returns tier 3 for first-time visitors', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
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

    it('returns tier 3 for long thinking (> 10 seconds)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 11_000,
      });
      expect(tier).toBe(3);
    });

    it('returns tier 1 for simple requests', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('respects priority: firstVisit > multiAgent/complex > thinking > default', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: true,
        toolCallCount: 5,
        thinkingStartTime: Date.now() - 15_000,
      });
      expect(tier).toBe(3);
    });

    it('handles boundary: thinking exactly at 10 seconds', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 10_000,
      });
      expect(tier).toBe(1);
    });

    it('handles thinkingStartTime = 0 as no thinking', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('returns tier 2 for toolCallCount = 1', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });
  });

  describe('trackToolCall', () => {
    it('increments tool count for a requestId', () => {
      const count1 = trackToolCall('req-1');
      const count2 = trackToolCall('req-1');
      expect(count1).toBe(1);
      expect(count2).toBe(2);
      clearRequest('req-1');
    });

    it('returns 0 for undefined requestId', () => {
      const count = trackToolCall(undefined);
      expect(count).toBe(0);
    });

    it('tracks different requests separately', () => {
      const count1 = trackToolCall('req-a');
      const count2 = trackToolCall('req-b');
      const count3 = trackToolCall('req-a');
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(2);
      clearRequest('req-a');
      clearRequest('req-b');
    });
  });

  describe('clearRequest', () => {
    it('removes tracking entry for a requestId', () => {
      trackToolCall('req-clear');
      clearRequest('req-clear');
      const count = trackToolCall('req-clear');
      expect(count).toBe(1);
      clearRequest('req-clear');
    });

    it('no-ops for undefined requestId', () => {
      clearRequest(undefined);
      // Should not throw
    });

    it('no-ops for non-existent requestId', () => {
      clearRequest('req-nonexistent');
      // Should not throw
    });
  });

  describe('localStorage integration', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('returns true on first visit', () => {
      expect(isFirstVisit()).toBe(true);
    });

    it('returns false after marking visited', () => {
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('persists visit state across calls', () => {
      expect(isFirstVisit()).toBe(true);
      markVisited();
      expect(isFirstVisit()).toBe(false);
      expect(isFirstVisit()).toBe(false);
    });

    it('sets correct localStorage key', () => {
      markVisited();
      expect(localStorage.getItem('office_visited')).toBe('true');
    });
  });
});
