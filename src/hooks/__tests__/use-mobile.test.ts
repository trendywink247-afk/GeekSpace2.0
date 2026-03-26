/**
 * @fileoverview Test suite for useIsMobile hook
 * Tests viewport detection, resize handling, and SSR hydration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../use-mobile';

// Mock window.matchMedia
const mockMatchMedia = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('useIsMobile', () => {
  beforeEach(() => {
    mockMatchMedia.mockReset();
    mockAddEventListener.mockReset();
    mockRemoveEventListener.mockReset();

    // Default implementation: desktop size (width >= 768)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    mockMatchMedia.mockReturnValue({
      matches: false, // Not matching mobile breakpoint
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      addListener: vi.fn(), // Legacy API
      removeListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial state ──────────────────────────────────────────────────────
  describe('useIsMobile — initial mount', () => {
    it('returns false on desktop viewport (width >= 768)', () => {
      window.innerWidth = 1024;
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it('returns true on mobile viewport (width < 768)', () => {
      window.innerWidth = 500;
      mockMatchMedia.mockReturnValue({
        matches: true, // Mobile size matches
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('uses correct media query (max-width: 767px)', () => {
      const { result } = renderHook(() => useIsMobile());

      expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    });
  });

  // ─── Resize event handling ──────────────────────────────────────────────
  describe('useIsMobile — window resize', () => {
    it('attaches media query change listener on mount', () => {
      renderHook(() => useIsMobile());

      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('updates state when crossing mobile breakpoint', () => {
      let changeHandler: ((e: any) => void) | null = null;

      mockAddEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
        if (event === 'change') {
          changeHandler = handler;
        }
      });

      window.innerWidth = 1024; // Desktop
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result, rerender } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);

      // Simulate resize to mobile
      window.innerWidth = 500;
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      if (changeHandler) {
        act(() => {
          changeHandler!({} as MediaQueryListEvent);
        });
      }

      rerender();

      expect(result.current).toBe(true);
    });

    it('updates state when crossing desktop breakpoint', () => {
      let changeHandler: ((e: any) => void) | null = null;

      mockAddEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
        if (event === 'change') {
          changeHandler = handler;
        }
      });

      // Start mobile
      window.innerWidth = 500;
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);

      // Resize to desktop
      window.innerWidth = 1024;
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      if (changeHandler) {
        act(() => {
          changeHandler!({} as MediaQueryListEvent);
        });
      }

      expect(result.current).toBe(false);
    });
  });

  // ─── Cleanup ────────────────────────────────────────────────────────────
  describe('useIsMobile — cleanup on unmount', () => {
    it('removes listener on unmount', () => {
      const { unmount } = renderHook(() => useIsMobile());

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('does not re-attach listener on re-render (empty deps)', () => {
      const { rerender } = renderHook(() => useIsMobile());

      mockAddEventListener.mockClear();

      rerender();

      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  // ─── SSR hydration ──────────────────────────────────────────────────────
  describe('useIsMobile — SSR hydration', () => {
    it('returns correct value after hydration (no flashing)', () => {
      window.innerWidth = 500; // Mobile
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      // Should be true immediately (no undefined → false → true flash)
      expect(result.current).toBe(true);
    });

    it('uses window.innerWidth directly for accuracy (not relying on matchMedia.matches)', () => {
      // Test scenario: matchMedia.matches lags behind window.innerWidth
      // Our implementation should use window.innerWidth for accuracy

      window.innerWidth = 700; // Just below 768
      mockMatchMedia.mockReturnValue({
        matches: false, // Hypothetically lags
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      // Should be true (< 768), using window.innerWidth
      expect(result.current).toBe(true);
    });
  });

  // ─── Coercion to boolean ────────────────────────────────────────────────
  describe('useIsMobile — boolean coercion', () => {
    it('returns strict boolean (not truthy/falsy)', () => {
      window.innerWidth = 1024;
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
      expect(typeof result.current).toBe('boolean');
    });

    it('coerces undefined to false during SSR', () => {
      // Hook initializes state as undefined, then updates to boolean
      // Initial render should be falsy, but return as boolean false
      const { result } = renderHook(() => useIsMobile());

      expect(typeof result.current).toBe('boolean');
    });
  });

  // ─── Boundary conditions ────────────────────────────────────────────────
  describe('useIsMobile — boundary conditions', () => {
    it('returns false at exact breakpoint (768px)', () => {
      window.innerWidth = 768;
      mockMatchMedia.mockReturnValue({
        matches: false, // (max-width: 767px) does NOT match at 768
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it('returns true at breakpoint - 1 (767px)', () => {
      window.innerWidth = 767;
      mockMatchMedia.mockReturnValue({
        matches: true, // (max-width: 767px) matches at 767
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('handles very small widths (mobile phones)', () => {
      window.innerWidth = 320; // iPhone SE
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('handles large widths (desktop)', () => {
      window.innerWidth = 2560; // 4K monitor
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  // ─── Multiple instances ─────────────────────────────────────────────────
  describe('useIsMobile — multiple hook instances', () => {
    it('each instance has independent state (no shared state issues)', () => {
      window.innerWidth = 1024;
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { result: result1 } = renderHook(() => useIsMobile());
      const { result: result2 } = renderHook(() => useIsMobile());

      expect(result1.current).toBe(result2.current);
      expect(result1.current).toBe(false);
    });
  });
});
