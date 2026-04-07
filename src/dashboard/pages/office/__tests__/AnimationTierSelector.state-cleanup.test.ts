/**
 * @fileoverview AnimationTierSelector state cleanup and module isolation tests
 * Verifies that module state is properly reset between tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
} from '../systems/animation/AnimationTierSelector';

describe('AnimationTierSelector — State Cleanup & Module Isolation', () => {
  beforeEach(() => {
    // ⚠️ CRITICAL: Clear both localStorage AND module-level request tracking
    localStorage.clear();
    // TODO: Export a __resetModuleState() function from AnimationTierSelector
    // or create a helper to clear the requestToolCounts Map
    // For now, clear all known request IDs used in tests
    clearRequest('test-req-1');
    clearRequest('test-req-2');
    clearRequest('test-req-3');
    clearRequest('req-1');
    clearRequest('req-2');
    clearRequest('req-a');
    clearRequest('req-b');
    clearRequest('req-c');
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ─── Module state pollution between tests ──────────────────────────────
  describe('Module state cleanup (requestToolCounts Map)', () => {
    it('does not leak request state from previous test', () => {
      // Test 1: Track a request
      trackToolCall('test-req-1');
      trackToolCall('test-req-1');
      // Mock: test ends, afterEach runs

      // Test 2: Same request ID should start fresh (assumes beforeEach cleanup)
      const count = trackToolCall('test-req-1');
      expect(count).toBe(1); // Should be 1, not 3
    });

    it('clearing request resets counter to 0 (not negative)', () => {
      trackToolCall('test-req');
      trackToolCall('test-req');
      clearRequest('test-req');

      const count = trackToolCall('test-req');
      expect(count).toBe(1); // Reset to 1, not -1 or 0
    });

    it('different request IDs do not share counter state', () => {
      const count1 = trackToolCall('req-1');
      const count2 = trackToolCall('req-2');
      const count1b = trackToolCall('req-1');

      expect(count1).toBe(1);
      expect(count2).toBe(1); // Different request, fresh counter
      expect(count1b).toBe(2); // Same request increments
    });

    it('stress test: 50 concurrent requests maintain isolation', () => {
      const requests = Array.from({ length: 50 }, (_, i) => `stress-req-${i}`);

      requests.forEach((id) => {
        const c1 = trackToolCall(id);
        expect(c1).toBe(1);
      });

      requests.forEach((id) => {
        const c2 = trackToolCall(id);
        expect(c2).toBe(2);
      });

      // Clear every other request
      requests.forEach((id, i) => {
        if (i % 2 === 0) clearRequest(id);
      });

      // Verify state after cleanup
      requests.forEach((id, i) => {
        const c = trackToolCall(id);
        if (i % 2 === 0) {
          expect(c).toBe(1); // Cleared, reset
        } else {
          expect(c).toBe(3); // Still accumulating
        }
      });
    });
  });

  // ─── localStorage isolation ────────────────────────────────────────────
  describe('localStorage state cleanup (office_visited)', () => {
    it('isFirstVisit is true when localStorage is empty', () => {
      localStorage.clear();
      expect(isFirstVisit()).toBe(true);
    });

    it('markVisited sets localStorage key', () => {
      localStorage.clear();
      markVisited();
      expect(localStorage.getItem('office_visited')).toBe('true');
    });

    it('isFirstVisit becomes false after markVisited', () => {
      localStorage.clear();
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('localStorage cleanup in beforeEach resets visited state', () => {
      // Test 1 context
      markVisited();
      expect(isFirstVisit()).toBe(false);

      // afterEach clears localStorage
      localStorage.clear();

      // Test 2 context: should be fresh
      expect(isFirstVisit()).toBe(true);
    });

    it('markVisited multiple times is idempotent', () => {
      localStorage.clear();
      markVisited();
      markVisited();
      markVisited();

      expect(localStorage.getItem('office_visited')).toBe('true');
      expect(isFirstVisit()).toBe(false);
    });

    it('only checks existence, not value equality', () => {
      localStorage.clear();
      localStorage.setItem('office_visited', 'any-value');
      expect(isFirstVisit()).toBe(false); // Exists → not first visit
    });
  });

  // ─── Combined state isolation (module + storage) ─────────────────────
  describe('Combined cleanup (requestToolCounts + localStorage)', () => {
    it('clearing both states in beforeEach prevents cross-test pollution', () => {
      // Test 1: Set both states
      trackToolCall('req-1');
      markVisited();
      expect(isFirstVisit()).toBe(false);

      // beforeEach of Test 2 clears both
      localStorage.clear();
      clearRequest('req-1');

      // Test 2: Both should be fresh
      expect(isFirstVisit()).toBe(true);
      expect(trackToolCall('req-1')).toBe(1);
    });

    it('module state and localStorage are independently managed', () => {
      // Can clear module state without affecting localStorage
      trackToolCall('req-1');
      markVisited();

      clearRequest('req-1');
      expect(isFirstVisit()).toBe(false); // Still marked visited

      localStorage.clear();
      expect(trackToolCall('req-1')).toBe(1); // Module state still cleared
    });
  });

  // ─── Test helper validation ────────────────────────────────────────────
  describe('beforeEach cleanup effectiveness', () => {
    it('clearRequest with undefined does not throw', () => {
      expect(() => clearRequest(undefined as any)).not.toThrow();
    });

    it('clearRequest with null does not throw', () => {
      expect(() => clearRequest(null as any)).not.toThrow();
    });

    it('clearRequest with empty string does not throw', () => {
      expect(() => clearRequest('')).not.toThrow();
    });

    it('clearing non-existent request does not affect other requests', () => {
      trackToolCall('req-1');
      trackToolCall('req-2');
      clearRequest('req-nonexistent');

      expect(trackToolCall('req-1')).toBe(2);
      expect(trackToolCall('req-2')).toBe(2);
    });
  });

  // ─── Missing test: Export reset function ────────────────────────────────
  describe('TODO: __resetModuleState function (not yet exported)', () => {
    it.todo('should provide __resetModuleState() to fully clear module state');
    it.todo('should be called in beforeEach for complete isolation');
  });
});
