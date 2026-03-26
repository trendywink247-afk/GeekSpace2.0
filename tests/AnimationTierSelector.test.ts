/**
 * @fileoverview Test suite for AnimationTierSelector.ts
 *
 * Covers tier selection logic, request tracking, and localStorage integration.
 * Tests decision tree: firstVisit > isMultiAgent/toolCount > thinkingTime > default
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
} from '@/dashboard/pages/office/AnimationTierSelector';

// ─────────────────────────────────────────────────────────────────────────────
// selectAnimationTier() — Tier selection decision tree
// ─────────────────────────────────────────────────────────────────────────────

describe('selectAnimationTier()', () => {
  it('returns tier 3 (cinematic) for first-time visitors', () => {
    const tier = selectAnimationTier({
      isFirstVisit: true,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(3);
  });

  it('returns tier 3 even if other conditions are false', () => {
    // firstVisit takes absolute priority
    const tier = selectAnimationTier({
      isFirstVisit: true,
      isMultiAgent: false,
      toolCallCount: 1,
      thinkingStartTime: Date.now() - 1000,
    });
    expect(tier).toBe(3);
  });

  it('returns tier 2 (spotlight) for multi-agent requests', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: true,
      toolCallCount: 0,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(2);
  });

  it('returns tier 2 when toolCallCount >= 2', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 2,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(2);
  });

  it('returns tier 2 with 3+ tool calls', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 5,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(2);
  });

  it('returns tier 3 (cinematic) for long thinking (> 10 seconds)', () => {
    const startTime = Date.now() - 11_000; // 11 seconds ago
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: startTime,
    });
    expect(tier).toBe(3);
  });

  it('returns tier 1 (minimal) at exactly 10 second thinking boundary', () => {
    // Should NOT trigger cinematic at exactly 10s (need > 10s)
    const startTime = Date.now() - 10_000;
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: startTime,
    });
    expect(tier).toBe(1);
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

  it('returns tier 1 for quick responses (toolCount = 0, no thinking)', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(1);
  });

  it('respects priority order: isFirstVisit > isMultiAgent > thinkingTime', () => {
    // If all are true, isFirstVisit wins
    const tier = selectAnimationTier({
      isFirstVisit: true,
      isMultiAgent: true,
      toolCallCount: 5,
      thinkingStartTime: Date.now() - 15_000,
    });
    expect(tier).toBe(3); // NOT 2 or 3 from other conditions
  });

  // ─ Edge cases ─
  it('handles thinkingStartTime = 0 as "not thinking"', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(1);
  });

  it('handles very long thinking times (30+ seconds)', () => {
    const startTime = Date.now() - 30_000;
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: startTime,
    });
    expect(tier).toBe(3);
  });

  it('handles edge case: thinking just over 10 seconds', () => {
    const startTime = Date.now() - 10_001;
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 0,
      thinkingStartTime: startTime,
    });
    expect(tier).toBe(3);
  });

  it('handles toolCallCount = 2 exactly (boundary)', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 2,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(2);
  });

  it('handles toolCallCount = 1 (below threshold)', () => {
    const tier = selectAnimationTier({
      isFirstVisit: false,
      isMultiAgent: false,
      toolCallCount: 1,
      thinkingStartTime: 0,
    });
    expect(tier).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trackToolCall() — Request-scoped tool counter
// ─────────────────────────────────────────────────────────────────────────────

describe('trackToolCall()', () => {
  it('increments and returns 1 for first call', () => {
    const count = trackToolCall('req-123');
    expect(count).toBe(1);
  });

  it('increments counter on successive calls for same request', () => {
    trackToolCall('req-456');
    trackToolCall('req-456');
    const count = trackToolCall('req-456');
    expect(count).toBe(3);
  });

  it('tracks different requests independently', () => {
    trackToolCall('req-a');
    trackToolCall('req-a');
    trackToolCall('req-b');
    const countA = trackToolCall('req-a');
    const countB = trackToolCall('req-b');
    expect(countA).toBe(3); // Two previous + one more
    expect(countB).toBe(2); // One previous + one more
  });

  it('returns 0 if requestId is undefined', () => {
    const count = trackToolCall(undefined);
    expect(count).toBe(0);
  });

  it('returns 0 if requestId is null', () => {
    const count = trackToolCall(null as any);
    expect(count).toBe(0);
  });

  it('returns 0 if requestId is empty string', () => {
    const count = trackToolCall('');
    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearRequest() — Clean up request tracking
// ─────────────────────────────────────────────────────────────────────────────

describe('clearRequest()', () => {
  it('removes tracking for a request', () => {
    trackToolCall('req-to-clear');
    trackToolCall('req-to-clear');
    clearRequest('req-to-clear');

    // After clearing, new call should start at 1 again
    const count = trackToolCall('req-to-clear');
    expect(count).toBe(1);
  });

  it('does not affect other tracked requests', () => {
    trackToolCall('req-stay');
    trackToolCall('req-stay');
    trackToolCall('req-clear');

    clearRequest('req-clear');

    // req-stay should still have its count
    const count = trackToolCall('req-stay');
    expect(count).toBe(3);
  });

  it('silently handles clearing non-existent request', () => {
    expect(() => clearRequest('non-existent')).not.toThrow();
  });

  it('silently handles undefined requestId', () => {
    expect(() => clearRequest(undefined)).not.toThrow();
  });

  it('silently handles null requestId', () => {
    expect(() => clearRequest(null as any)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// localStorage integration: isFirstVisit() & markVisited()
// ─────────────────────────────────────────────────────────────────────────────

describe('isFirstVisit() & markVisited()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns true when no visit record exists', () => {
    expect(isFirstVisit()).toBe(true);
  });

  it('returns false after markVisited() is called', () => {
    expect(isFirstVisit()).toBe(true);
    markVisited();
    expect(isFirstVisit()).toBe(false);
  });

  it('persists visit record across multiple isFirstVisit() calls', () => {
    markVisited();
    expect(isFirstVisit()).toBe(false);
    expect(isFirstVisit()).toBe(false); // Still false
  });

  it('stores "true" string in localStorage at "office_visited" key', () => {
    markVisited();
    expect(localStorage.getItem('office_visited')).toBe('true');
  });

  it('works with manual localStorage manipulation', () => {
    localStorage.setItem('office_visited', 'true');
    expect(isFirstVisit()).toBe(false);
  });

  it('treats any value in localStorage as "visited"', () => {
    localStorage.setItem('office_visited', 'anything');
    expect(isFirstVisit()).toBe(false);
  });

  it('treats empty string as "visited"', () => {
    localStorage.setItem('office_visited', '');
    expect(isFirstVisit()).toBe(false);
  });
});
