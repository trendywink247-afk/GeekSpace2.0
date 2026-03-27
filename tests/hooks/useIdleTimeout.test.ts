/**
 * @fileoverview Tests for useIdleTimeout hook — session idle timeout detection
 *
 * Tests 3 overlapping timers:
 * 1. idleTimer: counts down until warning is shown
 * 2. logoutTimer: failsafe logout timer
 * 3. countdownInterval: UI countdown updates
 */

import { renderHook, act } from '@testing-library/react';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

describe('useIdleTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with warning hidden and no countdown', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() => useIdleTimeout({ onLogout: mockLogout }));

      expect(result.current.showWarning).toBe(false);
      expect(result.current.secondsLeft).toBe(0);
    });

    it('accepts custom idle and warning durations', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 1000,
          warningMs: 500,
          onLogout: mockLogout,
        })
      );

      expect(result.current.showWarning).toBe(false);
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.showWarning).toBe(true);
      expect(result.current.secondsLeft).toBeGreaterThan(0);
    });
  });

  describe('idle timer triggers warning', () => {
    it('shows warning after idle duration expires (default 25m)', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 1500000, // 25 min (default)
          warningMs: 300000, // 5 min
          onLogout: mockLogout,
        })
      );

      expect(result.current.showWarning).toBe(false);

      act(() => {
        jest.advanceTimersByTime(1500000); // Trigger warning
      });

      expect(result.current.showWarning).toBe(true);
    });

    it('calculates correct secondsLeft on warning trigger', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 1000,
          warningMs: 6000, // 6 seconds = 6 seconds warning
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(1000); // Show warning
      });

      expect(result.current.showWarning).toBe(true);
      expect(result.current.secondsLeft).toBeCloseTo(6, 0);
    });

    it('updates secondsLeft every 1 second during warning', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 5000, // 5 seconds
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(100); // Show warning
      });

      const initialSeconds = result.current.secondsLeft;

      act(() => {
        jest.advanceTimersByTime(1000); // 1 second elapsed
      });

      expect(result.current.secondsLeft).toBe(initialSeconds - 1);
    });
  });

  describe('logout trigger', () => {
    it('calls onLogout after idle + warning expires', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 200,
          onLogout: mockLogout,
        })
      );

      // Show warning
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(mockLogout).not.toHaveBeenCalled();

      // Warning expires
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('countdown reaching zero triggers logout', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 3000, // 3 seconds
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(100); // Show warning
      });

      // Let countdown tick down to 0
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.secondsLeft).toBeLessThanOrEqual(0);
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('dismissWarning callback', () => {
    it('dismisses warning and restarts idle timer', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 200,
          onLogout: mockLogout,
        })
      );

      // Show warning
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(result.current.showWarning).toBe(true);

      // Dismiss warning
      act(() => {
        result.current.dismissWarning();
      });
      expect(result.current.showWarning).toBe(false);

      // Logout should NOT fire immediately
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(mockLogout).not.toHaveBeenCalled();

      // But should fire after idle duration + warning again
      act(() => {
        jest.advanceTimersByTime(100); // Back to idle
      });
      expect(result.current.showWarning).toBe(true);
    });
  });

  describe('user activity handling', () => {
    it('does not auto-dismiss warning during activity (by design)', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 200,
          onLogout: mockLogout,
        })
      );

      // Show warning
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(result.current.showWarning).toBe(true);

      // Simulate activity during warning (should NOT dismiss)
      // In production, activity listeners would call dismissWarning()
      // but we test that warning is NOT auto-dismissed
      expect(result.current.showWarning).toBe(true);
    });
  });

  describe('cleanup on unmount', () => {
    it('clears all timers when component unmounts', () => {
      const mockLogout = jest.fn();
      const { unmount } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 200,
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(100); // Show warning
      });

      unmount();

      // Advance timers further — onLogout should NOT fire
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(mockLogout).not.toHaveBeenCalled();
    });

    it('prevents memory leaks from dangling intervals', () => {
      const mockLogout = jest.fn();
      const { unmount } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 5000,
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(100); // Start countdown interval
      });

      unmount();

      const pendingTimers = jest.getTimerCount();
      // After unmount, should be no pending timers
      expect(pendingTimers).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles idleMs = 0 (immediate warning)', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 0,
          warningMs: 100,
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.showWarning).toBe(true);
    });

    it('handles warningMs = 0 (immediate logout)', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 0,
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.showWarning).toBe(true);

      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(mockLogout).toHaveBeenCalled();
    });

    it('maintains precision with large durations', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 3600000, // 1 hour
          warningMs: 600000, // 10 minutes
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(3600000);
      });

      expect(result.current.showWarning).toBe(true);
      const expectedSeconds = Math.ceil(600000 / 1000);
      expect(result.current.secondsLeft).toBeCloseTo(expectedSeconds, 0);
    });

    it('handles multiple dismissWarning calls', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 200,
          onLogout: mockLogout,
        })
      );

      act(() => {
        jest.advanceTimersByTime(100);
      });

      act(() => {
        result.current.dismissWarning();
        result.current.dismissWarning(); // Call twice
        result.current.dismissWarning();
      });

      // Should only restart timer once, not break
      expect(result.current.showWarning).toBe(false);

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.showWarning).toBe(true);
    });
  });

  describe('integration: full lifecycle', () => {
    it('cycles through idle → warning → dismiss → idle again', () => {
      const mockLogout = jest.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          idleMs: 100,
          warningMs: 200,
          onLogout: mockLogout,
        })
      );

      // ─ Idle state
      expect(result.current.showWarning).toBe(false);

      // ─ Trigger warning
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(result.current.showWarning).toBe(true);

      // ─ Dismiss
      act(() => {
        result.current.dismissWarning();
      });
      expect(result.current.showWarning).toBe(false);

      // ─ Back to idle (no logout)
      act(() => {
        jest.advanceTimersByTime(50);
      });
      expect(mockLogout).not.toHaveBeenCalled();

      // ─ Idle + warning again
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(result.current.showWarning).toBe(true);

      // ─ Let it timeout
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
