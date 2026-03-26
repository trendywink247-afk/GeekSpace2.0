/**
 * @fileoverview Tests for useFreeTrial hook — free trial quota tracking
 *
 * Tests localStorage persistence, quota calculation, and corrupted data recovery.
 */

import { renderHook, act } from '@testing-library/react';
import { useFreeTrial, FREE_TRIAL_KEY } from '@/hooks/useFreeTrial';

describe('useFreeTrial', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts with zero generations used', () => {
      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(0);
      expect(result.current.logoGenLimit).toBe(3);
      expect(result.current.isLogoLimited).toBe(false);
      expect(result.current.remainingLogoGens).toBe(3);
    });

    it('recovers persisted state from localStorage', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 2, firstUsedAt: 1234567890 })
      );

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(2);
      expect(result.current.remainingLogoGens).toBe(1);
    });
  });

  describe('quota calculation', () => {
    it('marks as limited when usage >= limit', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 3, firstUsedAt: 1234567890 })
      );

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.isLogoLimited).toBe(true);
      expect(result.current.remainingLogoGens).toBe(0);
    });

    it('calculates remaining generations correctly', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 1, firstUsedAt: 1234567890 })
      );

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.remainingLogoGens).toBe(2);
    });

    it('clamps remainingLogoGens to 0 when over limit', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 5, firstUsedAt: 1234567890 })
      );

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.remainingLogoGens).toBe(0);
      expect(result.current.isLogoLimited).toBe(true);
    });
  });

  describe('trackLogoGen', () => {
    it('increments generation count', () => {
      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(0);

      act(() => {
        result.current.trackLogoGen();
      });

      expect(result.current.logoGensUsed).toBe(1);
    });

    it('persists usage to localStorage', () => {
      const { result } = renderHook(() => useFreeTrial());

      act(() => {
        result.current.trackLogoGen();
      });

      const stored = JSON.parse(localStorage.getItem(FREE_TRIAL_KEY) || '{}');
      expect(stored.logoGensUsed).toBe(1);
    });

    it('sets firstUsedAt on first call', () => {
      const before = Date.now();
      const { result } = renderHook(() => useFreeTrial());

      act(() => {
        result.current.trackLogoGen();
      });

      const stored = JSON.parse(localStorage.getItem(FREE_TRIAL_KEY) || '{}');
      expect(stored.firstUsedAt).toBeGreaterThanOrEqual(before);
      expect(stored.firstUsedAt).toBeLessThanOrEqual(Date.now());
    });

    it('does not overwrite firstUsedAt on subsequent calls', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 0, firstUsedAt: 1000000 })
      );

      const { result } = renderHook(() => useFreeTrial());

      act(() => {
        result.current.trackLogoGen();
      });

      const stored = JSON.parse(localStorage.getItem(FREE_TRIAL_KEY) || '{}');
      expect(stored.firstUsedAt).toBe(1000000); // Unchanged
    });

    it('works up to the limit', () => {
      const { result } = renderHook(() => useFreeTrial());

      act(() => {
        result.current.trackLogoGen();
        result.current.trackLogoGen();
        result.current.trackLogoGen();
      });

      expect(result.current.logoGensUsed).toBe(3);
      expect(result.current.isLogoLimited).toBe(true);
    });

    it('continues incrementing even after limit (app responsibility)', () => {
      const { result } = renderHook(() => useFreeTrial());

      act(() => {
        result.current.trackLogoGen();
        result.current.trackLogoGen();
        result.current.trackLogoGen();
        result.current.trackLogoGen(); // Beyond limit
      });

      expect(result.current.logoGensUsed).toBe(4); // Increments still work
      expect(result.current.isLogoLimited).toBe(true);
      expect(result.current.remainingLogoGens).toBe(0); // Clamped to 0
    });
  });

  describe('localStorage error handling', () => {
    it('gracefully handles corrupted JSON', () => {
      localStorage.setItem(FREE_TRIAL_KEY, '{invalid json}');

      const { result } = renderHook(() => useFreeTrial());

      // Should reset to defaults
      expect(result.current.logoGensUsed).toBe(0);
      expect(result.current.remainingLogoGens).toBe(3);
    });

    it('handles missing logoGensUsed key', () => {
      localStorage.setItem(FREE_TRIAL_KEY, JSON.stringify({ firstUsedAt: 1234 }));

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(0);
    });

    it('handles wrong type for logoGensUsed', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 'not a number', firstUsedAt: 1234 })
      );

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(0); // Defaults to 0
    });

    it('handles missing firstUsedAt key', () => {
      localStorage.setItem(FREE_TRIAL_KEY, JSON.stringify({ logoGensUsed: 1 }));

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(1);
      // firstUsedAt is internal, so just verify state is consistent
    });

    it('silently fails if localStorage throws on write', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useFreeTrial());

      // Should not crash
      expect(() => {
        act(() => {
          result.current.trackLogoGen();
        });
      }).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
    });

    it('silently fails if localStorage throws on read', () => {
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = jest.fn(() => {
        throw new Error('SecurityError');
      });

      // Should not crash, should use defaults
      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(0);

      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe('integration: full lifecycle', () => {
    it('tracks usage across multiple component mounts', () => {
      // First mount: use 1 generation
      let { result, unmount } = renderHook(() => useFreeTrial());
      act(() => {
        result.current.trackLogoGen();
      });
      expect(result.current.logoGensUsed).toBe(1);
      unmount();

      // Second mount: state persisted, can use 2 more
      ({ result, unmount } = renderHook(() => useFreeTrial()));
      expect(result.current.logoGensUsed).toBe(1);
      expect(result.current.remainingLogoGens).toBe(2);

      act(() => {
        result.current.trackLogoGen();
      });
      expect(result.current.logoGensUsed).toBe(2);
      unmount();

      // Third mount: approaching limit
      ({ result, unmount } = renderHook(() => useFreeTrial()));
      expect(result.current.isLogoLimited).toBe(false);
      act(() => {
        result.current.trackLogoGen();
      });
      expect(result.current.isLogoLimited).toBe(true);
    });

    it('allows manual reset via localStorage.clear()', () => {
      let { result } = renderHook(() => useFreeTrial());
      act(() => {
        result.current.trackLogoGen();
        result.current.trackLogoGen();
        result.current.trackLogoGen();
      });
      expect(result.current.isLogoLimited).toBe(true);

      // User or admin clears trial
      localStorage.removeItem(FREE_TRIAL_KEY);

      // New component mount sees fresh state
      ({ result } = renderHook(() => useFreeTrial()));
      expect(result.current.logoGensUsed).toBe(0);
      expect(result.current.isLogoLimited).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles zero as firstUsedAt (vs. unset)', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 0, firstUsedAt: 0 })
      );

      const { result } = renderHook(() => useFreeTrial());

      // firstUsedAt = 0 means "never used" — should be set on first call
      act(() => {
        result.current.trackLogoGen();
      });

      const stored = JSON.parse(localStorage.getItem(FREE_TRIAL_KEY) || '{}');
      expect(stored.firstUsedAt).toBeGreaterThan(0);
    });

    it('handles negative logoGensUsed (data corruption)', () => {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: -5, firstUsedAt: 1234 })
      );

      const { result } = renderHook(() => useFreeTrial());

      // Just use the value as-is (app should validate on server)
      expect(result.current.logoGensUsed).toBe(-5);
    });

    it('handles very large timestamps', () => {
      const farFuture = 999999999999;
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({ logoGensUsed: 1, firstUsedAt: farFuture })
      );

      const { result } = renderHook(() => useFreeTrial());

      expect(result.current.logoGensUsed).toBe(1);
      // Timestamp is not used for calculations in client, just persisted
    });
  });
});
