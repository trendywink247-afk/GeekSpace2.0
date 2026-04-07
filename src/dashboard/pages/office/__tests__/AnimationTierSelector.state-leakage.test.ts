/**
 * @fileoverview AnimationTierSelector module state leakage tests
 * Tests for public API not exported, making state cleanup difficult
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
} from '../systems/animation/AnimationTierSelector';

describe('AnimationTierSelector — Module State Leakage', () => {
  beforeEach(() => {
    // ⚠️ PROBLEM: requestToolCounts Map is not exported, so we must rely on
    // public API (clearRequest) to reset state. If a test forgets to call it,
    // state pollutes subsequent tests.
    clearRequest('req-1');
    clearRequest('req-2');
    clearRequest('req-3');
  });

  // ─── Missing: __resetModuleState() or exportable Map ─────────────────
  describe('Module state access (NOT EXPORTED)', () => {
    it('requestToolCounts Map is private (not exported for direct reset)', () => {
      // TODO: Add __resetModuleState() export or make requestToolCounts accessible
      // Current workaround: call clearRequest() for each known requestId
      // Risk: if a test uses a requestId that is not explicitly cleared, state leaks

      trackToolCall('random-req-1');
      trackToolCall('random-req-1');

      // Without export, no way to verify requestToolCounts is empty
      // Only way to test is tracking behavior indirectly

      const count = trackToolCall('random-req-1');
      expect(count).toBe(3); // Would be 1 if state properly reset
    });

    it('clearRequest does not return number of cleared entries', () => {
      trackToolCall('req-to-clear');
      clearRequest('req-to-clear');

      // No return value from clearRequest, so we can't verify it actually cleared
      // Only way to confirm: try tracking same requestId again
      const count = trackToolCall('req-to-clear');
      expect(count).toBe(1); // Confirms clear worked
    });
  });

  // ─── Recovery from state pollution ──────────────────────────────────
  describe('State pollution recovery', () => {
    it('explicitly clearing all test requestIds prevents pollution', () => {
      // Assume 50 tests run in sequence, each using "req-test"
      // If one test forgets afterEach cleanup, "req-test" counter accumulates

      for (let i = 0; i < 5; i++) {
        trackToolCall('req-test');
      }
      // count is now 5

      // Another "test suite" starts (new describe block in same file)
      // If beforeEach doesn't call clearRequest('req-test'), pollution occurs

      const countWithoutClear = trackToolCall('req-test');
      expect(countWithoutClear).toBe(6); // Polluted from previous test

      // Solution: call clearRequest before reusing requestId
      clearRequest('req-test');
      const countAfterClear = trackToolCall('req-test');
      expect(countAfterClear).toBe(1); // Clean state
    });
  });
});
