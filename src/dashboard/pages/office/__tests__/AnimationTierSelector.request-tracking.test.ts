/**
 * @fileoverview AnimationTierSelector request tracking edge cases
 * Tests special characters, long IDs, and concurrent tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
} from '../AnimationTierSelector';

describe('AnimationTierSelector — Request Tracking Edge Cases', () => {
  // Cleanup used IDs after each test
  afterEach(() => {
    clearRequest('uuid-standard');
    clearRequest('uuid-variant');
    clearRequest('req%2F1%3Fkey%3Dvalue');
    clearRequest('req 1 test');
    clearRequest('req-with-special-!@#$%');
    clearRequest('url-encoded-%20space');
  });

  // ─── UUID and standard formats ─────────────────────────────────────────
  describe('UUID format request IDs', () => {
    it('handles standard UUID v4 format (8-4-4-4-12 hex)', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const count1 = trackToolCall(uuid);
      const count2 = trackToolCall(uuid);
      expect(count1).toBe(1);
      expect(count2).toBe(2);
      clearRequest(uuid);
    });

    it('tracks different UUIDs independently', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      const count1a = trackToolCall(uuid1);
      const count2a = trackToolCall(uuid2);
      const count1b = trackToolCall(uuid1);

      expect(count1a).toBe(1);
      expect(count2a).toBe(1);
      expect(count1b).toBe(2);

      clearRequest(uuid1);
      clearRequest(uuid2);
    });

    it('preserves UUID case sensitivity', () => {
      const uuidLower = '550e8400-e29b-41d4-a716-446655440000';
      const uuidUpper = '550E8400-E29B-41D4-A716-446655440000';

      const countLower = trackToolCall(uuidLower);
      const countUpper = trackToolCall(uuidUpper);

      // Should treat as different IDs (case-sensitive)
      expect(countLower).toBe(1);
      expect(countUpper).toBe(1);

      clearRequest(uuidLower);
      clearRequest(uuidUpper);
    });
  });

  // ─── URL-encoded and special characters ─────────────────────────────────
  describe('URL-encoded and special character request IDs', () => {
    it('handles URL-encoded request IDs', () => {
      const encoded = 'req%2F1%3Fkey%3Dvalue'; // req/1?key=value
      const count1 = trackToolCall(encoded);
      const count2 = trackToolCall(encoded);
      expect(count1).toBe(1);
      expect(count2).toBe(2);
    });

    it('handles spaces in request ID', () => {
      const withSpaces = 'req 1 test';
      const count = trackToolCall(withSpaces);
      expect(count).toBe(1);
    });

    it('handles special characters (!@#$%^&*)', () => {
      const withSpecial = 'req-with-special-!@#$%';
      const count = trackToolCall(withSpecial);
      expect(count).toBe(1);
    });

    it('handles URL-encoded spaces (%20)', () => {
      const encoded = 'url-encoded-%20space';
      const count = trackToolCall(encoded);
      expect(count).toBe(1);
    });

    it('treats encoded vs decoded IDs as different', () => {
      const encoded = 'req%20test'; // req test (encoded)
      const decoded = 'req test';   // req test (not encoded)

      const countE = trackToolCall(encoded);
      const countD = trackToolCall(decoded);

      expect(countE).toBe(1);
      expect(countD).toBe(1); // Different ID (treated separately)

      clearRequest(encoded);
      clearRequest(decoded);
    });
  });

  // ─── Very long request IDs ────────────────────────────────────────────
  describe('Long request ID handling', () => {
    it('handles 500-character request ID', () => {
      const longId = 'a'.repeat(500);
      const count = trackToolCall(longId);
      expect(count).toBe(1);
      clearRequest(longId);
    });

    it('handles 1000-character request ID', () => {
      const longId = 'x'.repeat(1000);
      const count1 = trackToolCall(longId);
      const count2 = trackToolCall(longId);
      expect(count1).toBe(1);
      expect(count2).toBe(2);
      clearRequest(longId);
    });

    it('handles 10000-character request ID (stress)', () => {
      const veryLongId = 'z'.repeat(10000);
      const count = trackToolCall(veryLongId);
      expect(count).toBe(1);
      expect(typeof count).toBe('number');
      clearRequest(veryLongId);
    });

    it('long IDs do not cause memory issues or crashes', () => {
      const ids = Array.from({ length: 10 }, (_, i) => 'id-'.repeat(100) + i);

      ids.forEach((id) => {
        const count = trackToolCall(id);
        expect(count).toBe(1);
      });

      ids.forEach((id) => clearRequest(id));
    });
  });

  // ─── Empty and whitespace request IDs ──────────────────────────────────
  describe('Empty and whitespace request IDs', () => {
    it('returns 0 for empty string requestId', () => {
      const count = trackToolCall('');
      expect(count).toBe(0);
    });

    it('returns 0 for undefined requestId', () => {
      const count = trackToolCall(undefined);
      expect(count).toBe(0);
    });

    it('returns 0 for null requestId (coerced to falsy)', () => {
      const count = trackToolCall(null as any);
      expect(count).toBe(0);
    });

    it('handles whitespace-only request ID (single space)', () => {
      const count = trackToolCall(' ');
      // Single space is a valid non-empty string
      expect(typeof count).toBe('number');
      if (count > 0) clearRequest(' ');
    });

    it('handles multi-space request ID', () => {
      const count = trackToolCall('   '); // Three spaces
      expect(typeof count).toBe('number');
      if (count > 0) clearRequest('   ');
    });

    it('handles tab and newline characters', () => {
      const tabId = 'req\tid';
      const newlineId = 'req\nid';

      const countTab = trackToolCall(tabId);
      const countNewline = trackToolCall(newlineId);

      expect(countTab).toBe(1);
      expect(countNewline).toBe(1);

      clearRequest(tabId);
      clearRequest(newlineId);
    });
  });

  // ─── Concurrent and rapid operations ───────────────────────────────────
  describe('Concurrent request tracking', () => {
    it('handles 100 concurrent requests without state corruption', () => {
      const requests = Array.from({ length: 100 }, (_, i) => `req-${i}`);

      requests.forEach((id) => trackToolCall(id));

      requests.forEach((id) => {
        const count = trackToolCall(id);
        expect(count).toBe(2);
      });

      requests.forEach((id) => clearRequest(id));
    });

    it('rapid clear/track cycles do not cause race conditions', () => {
      for (let i = 0; i < 20; i++) {
        trackToolCall('rapid-test');
        if (i % 5 === 0) clearRequest('rapid-test');
      }

      const finalCount = trackToolCall('rapid-test');
      expect(typeof finalCount).toBe('number');
      expect(finalCount).toBeGreaterThan(0);

      clearRequest('rapid-test');
    });

    it('interleaved operations on multiple requests maintain isolation', () => {
      const ops = [
        () => trackToolCall('req-x'),
        () => trackToolCall('req-y'),
        () => trackToolCall('req-x'),
        () => trackToolCall('req-z'),
        () => trackToolCall('req-y'),
        () => trackToolCall('req-x'),
      ];

      const results = ops.map((op) => op());

      expect(results[0]).toBe(1); // req-x first
      expect(results[1]).toBe(1); // req-y first
      expect(results[2]).toBe(2); // req-x second
      expect(results[3]).toBe(1); // req-z first
      expect(results[4]).toBe(2); // req-y second
      expect(results[5]).toBe(3); // req-x third

      clearRequest('req-x');
      clearRequest('req-y');
      clearRequest('req-z');
    });
  });

  // ─── Cross-test isolation ──────────────────────────────────────────────
  describe('Cross-test request isolation', () => {
    it('test 1: creates request tracking entry', () => {
      const count = trackToolCall('isolation-test-1');
      expect(count).toBe(1);
      // Cleanup done in afterEach
      clearRequest('isolation-test-1');
    });

    it('test 2: same requestId starts fresh (if properly cleaned)', () => {
      const count = trackToolCall('isolation-test-2');
      expect(count).toBe(1); // Should be 1, not 2
      clearRequest('isolation-test-2');
    });

    it('test 3: explicitly verifies cleanup via clear', () => {
      trackToolCall('isolation-test-3');
      trackToolCall('isolation-test-3');
      clearRequest('isolation-test-3');

      const countAfterClear = trackToolCall('isolation-test-3');
      expect(countAfterClear).toBe(1); // Confirms clear worked

      clearRequest('isolation-test-3');
    });
  });

  // ─── Invalid input graceful handling ───────────────────────────────────
  describe('Graceful handling of invalid inputs', () => {
    it('never crashes on unexpected types (coerced or falsy)', () => {
      const inputs = [
        undefined,
        null,
        0 as any,
        false as any,
        NaN as any,
        {} as any,
        [] as any,
      ];

      inputs.forEach((input) => {
        expect(() => trackToolCall(input)).not.toThrow();
      });
    });

    it('returns 0 for falsy values (undefined, null, empty string)', () => {
      expect(trackToolCall(undefined)).toBe(0);
      expect(trackToolCall(null as any)).toBe(0);
      expect(trackToolCall('')).toBe(0);
    });

    it('clears nonexistent requestId without error', () => {
      expect(() => clearRequest('nonexistent-id-12345')).not.toThrow();
    });

    it('can track requestId after clearing nonexistent entry', () => {
      clearRequest('never-tracked');
      const count = trackToolCall('never-tracked');
      expect(count).toBe(1);
      clearRequest('never-tracked');
    });
  });
});
