/**
 * @fileoverview Test suite for AnimationTierSelector decision logic
 * Tests the tier selection rules and state management (tool tracking, visits)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
} from '../AnimationTierSelector';
import type { AnimationTier } from '../AnimationTierSelector';

describe('AnimationTierSelector', () => {
  // ─── Rule 1: First-time visitors always get cinematic ─────────────────────
  describe('selectAnimationTier — Rule 1: First Visit', () => {
    it('returns Tier 3 when isFirstVisit=true (regardless of other conditions)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(3);
    });

    it('returns Tier 3 even with simple single-agent request if first visit', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: Date.now(),
      });
      expect(tier).toBe(3);
    });
  });

  // ─── Rule 2: Multi-agent or complex requests get spotlight ────────────────
  describe('selectAnimationTier — Rule 2: Multi-Agent/Complex', () => {
    it('returns Tier 2 when isMultiAgent=true (not first visit)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('returns Tier 2 when toolCallCount >= 2 (not first visit)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 2,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('returns Tier 2 when toolCallCount = 3 (complex request)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 3,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2);
    });

    it('returns Tier 1 when toolCallCount = 1 (simple request)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });
  });

  // ─── Rule 3: Long thinking (> 10s) gets cinematic ─────────────────────────
  describe('selectAnimationTier — Rule 3: Long Thinking', () => {
    it('returns Tier 3 when thinking duration > 10 seconds', () => {
      const thinkingStartTime = Date.now() - 11_000; // 11 seconds ago
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime,
      });
      expect(tier).toBe(3);
    });

    it('returns Tier 1 when thinking duration = 9.9 seconds (just under threshold)', () => {
      const thinkingStartTime = Date.now() - 9_900;
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime,
      });
      expect(tier).toBe(1);
    });

    it('returns Tier 3 when thinking duration = exactly 10 seconds (boundary)', () => {
      const thinkingStartTime = Date.now() - 10_000;
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime,
      });
      expect(tier).toBe(3);
    });

    it('returns Tier 1 when thinkingStartTime = 0 (not thinking)', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });
  });

  // ─── Rule 4: Default to minimal ───────────────────────────────────────────
  describe('selectAnimationTier — Rule 4: Default Minimal', () => {
    it('returns Tier 1 for simple single-agent quick request', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });

    it('returns Tier 1 when all conditions are false/default', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);
    });
  });

  // ─── Priority order: first visit > multi-agent/complex > thinking > default
  describe('selectAnimationTier — Priority Resolution', () => {
    it('first visit takes priority over multi-agent', () => {
      const tier = selectAnimationTier({
        isFirstVisit: true,
        isMultiAgent: true,
        toolCallCount: 5,
        thinkingStartTime: Date.now() - 20_000,
      });
      expect(tier).toBe(3); // First visit rule wins
    });

    it('multi-agent takes priority over thinking < 10s', () => {
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true,
        toolCallCount: 0,
        thinkingStartTime: Date.now() - 5_000,
      });
      expect(tier).toBe(2); // Multi-agent rule wins
    });
  });

  // ─── Tool call tracking ──────────────────────────────────────────────────
  describe('trackToolCall', () => {
    beforeEach(() => {
      // Note: trackToolCall maintains internal state; consider if tests need isolation
    });

    it('increments and returns tool call count for a request', () => {
      const requestId = `req-track-${Date.now()}`;
      const count1 = trackToolCall(requestId);
      const count2 = trackToolCall(requestId);
      expect(count1).toBe(1);
      expect(count2).toBe(2);
    });

    it('returns 0 when requestId is undefined', () => {
      const count = trackToolCall(undefined);
      expect(count).toBe(0);
    });

    it('starts counting from 1 for a new requestId', () => {
      const requestId = `req-new-${Date.now()}`;
      const count = trackToolCall(requestId);
      expect(count).toBe(1);
    });

    it('tracks multiple requests independently', () => {
      const req1 = `req-a-${Date.now()}`;
      const req2 = `req-b-${Date.now()}`;
      trackToolCall(req1);
      trackToolCall(req1);
      const count2 = trackToolCall(req2);
      expect(count2).toBe(1); // req2 has its own counter
    });
  });

  // ─── Request cleanup ───────────────────────────────────────────────────
  describe('clearRequest', () => {
    it('clears tool call count for a request', () => {
      const requestId = `req-clear-${Date.now()}`;
      trackToolCall(requestId);
      trackToolCall(requestId);
      clearRequest(requestId);
      const count = trackToolCall(requestId);
      expect(count).toBe(1); // Restarted after clear
    });

    it('no-ops when requestId is undefined', () => {
      expect(() => clearRequest(undefined)).not.toThrow();
    });

    it('no-ops when clearing non-existent request', () => {
      expect(() => clearRequest('non-existent-req-xyz')).not.toThrow();
    });
  });

  // ─── First-visit tracking via localStorage ─────────────────────────────
  describe('isFirstVisit / markVisited', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('returns true when office_visited is not set', () => {
      expect(isFirstVisit()).toBe(true);
    });

    it('returns false after markVisited() is called', () => {
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('persists across multiple isFirstVisit() calls', () => {
      markVisited();
      expect(isFirstVisit()).toBe(false);
      expect(isFirstVisit()).toBe(false);
    });
  });
});
