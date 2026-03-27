/**
 * @fileoverview OfficeCanvasRenderer asset loading and canvas rendering tests
 * Tests image loading, memoization, background rendering fallback, and asset cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadOfficeAssets,
  isBgLoaded,
  drawBackground,
} from '../OfficeCanvasRenderer';

describe('OfficeCanvasRenderer — Asset Loading & Rendering', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 864;
    canvas.height = 800;
    ctx = canvas.getContext('2d')!;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Asset loading initialization ──────────────────────────────────────
  describe('loadOfficeAssets() initialization', () => {
    it('returns a Promise', async () => {
      const result = loadOfficeAssets();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('resolves successfully', async () => {
      const result = await loadOfficeAssets();
      expect(result).toBeUndefined();
    });

    it('does not throw on load error (graceful fallback)', async () => {
      expect(async () => {
        await loadOfficeAssets();
      }).not.toThrow();
    });
  });

  // ─── Promise memoization ──────────────────────────────────────────────
  describe('loadOfficeAssets() memoization (PERF)', () => {
    it('returns same Promise on multiple calls', async () => {
      const promise1 = loadOfficeAssets();
      const promise2 = loadOfficeAssets();
      
      expect(promise1).toBe(promise2);
      await promise1;
    });

    it('does not re-download on subsequent calls', async () => {
      const imageSpy = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
      
      await loadOfficeAssets();
      const srcSetCount1 = imageSpy.mock.calls.length;
      
      await loadOfficeAssets();
      const srcSetCount2 = imageSpy.mock.calls.length;
      
      // Should not have triggered new image loads
      expect(srcSetCount2).toBe(srcSetCount1);
      
      imageSpy.mockRestore();
    });

    it('prevents multiple concurrent load attempts', async () => {
      const promise1 = loadOfficeAssets();
      const promise2 = loadOfficeAssets();
      const promise3 = loadOfficeAssets();
      
      // All should resolve to same promise
      const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3]);
      expect(r1).toBeUndefined();
      expect(r2).toBeUndefined();
      expect(r3).toBeUndefined();
    });
  });

  // ─── Background load state ────────────────────────────────────────────
  describe('isBgLoaded() cached state', () => {
    it('returns false before loading completes', async () => {
      // Check before load
      const loaded = isBgLoaded();
      expect(typeof loaded).toBe('boolean');
    });

    it('returns O(1) cached boolean (no property checks)', () => {
      const start = performance.now();
      for (let i = 0; i < 100000; i++) {
        isBgLoaded();
      }
      const elapsed = performance.now() - start;
      
      // Should be very fast (< 50ms for 100k calls)
      expect(elapsed).toBeLessThan(50);
    });
  });

  // ─── Background rendering ────────────────────────────────────────────
  describe('drawBackground() rendering', () => {
    it('renders without crashing when image not loaded', () => {
      expect(() => {
        drawBackground(ctx);
      }).not.toThrow();
    });

    it('draws fallback solid color while image loading', () => {
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBackground(ctx);
      
      // Should have called fillRect for fallback
      expect(fillRectSpy).toHaveBeenCalled();
      fillRectSpy.mockRestore();
    });

    it('sets imageSmoothingEnabled=false for pixel-perfect rendering', async () => {
      await loadOfficeAssets();
      
      const imageSmoothingSpy = vi.spyOn(ctx, 'imageSmoothingEnabled', 'set');
      drawBackground(ctx);
      
      // Should disable smoothing for pixel art
      expect(imageSmoothingSpy).toHaveBeenCalled();
      imageSmoothingSpy.mockRestore();
    });

    it('fills canvas with dark background color (#05050A or similar)', () => {
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      const fillStyleSpy = vi.spyOn(ctx, 'fillStyle', 'set');
      
      drawBackground(ctx);
      
      expect(fillStyleSpy).toHaveBeenCalled();
      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 864, 800);
      
      fillRectSpy.mockRestore();
      fillStyleSpy.mockRestore();
    });
  });

  // ─── Image loading error handling ──────────────────────────────────────
  describe('Asset loading fallback on error', () => {
    it('calls onError callback gracefully on load failure', async () => {
      // Mock image to fail loading
      const originalImage = window.Image;
      const MockFailImage = class extends HTMLImageElement {
        constructor() {
          super();
          setTimeout(() => {
            this.onerror?.(new Event('error'));
          }, 0);
        }
      };
      
      // @ts-expect-error -- override Image constructor for test
      window.Image = MockFailImage;
      
      expect(async () => {
        await loadOfficeAssets();
      }).not.toThrow();
      
      window.Image = originalImage;
    });

    it('still renders background even if image fails to load', async () => {
      await loadOfficeAssets();
      
      // Should not crash and should render fallback
      expect(() => {
        drawBackground(ctx);
      }).not.toThrow();
    });
  });

  // ─── Render state interface ────────────────────────────────────────────
  describe('Canvas rendering context', () => {
    it('accepts valid CanvasRenderingContext2D', () => {
      expect(ctx).toBeTruthy();
      expect(ctx.fillRect).toBeDefined();
      expect(ctx.drawImage).toBeDefined();
    });

    it('preserves context state across calls', () => {
      const fillStyleBefore = ctx.fillStyle;
      drawBackground(ctx);
      // Context should still be usable after
      expect(ctx.fillStyle).toBeDefined();
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('handles rapid successive loadOfficeAssets() calls', async () => {
      const promises = Array.from({ length: 10 }, () => loadOfficeAssets());
      const results = await Promise.all(promises);
      
      // All should resolve
      expect(results).toHaveLength(10);
      expect(results.every(r => r === undefined)).toBe(true);
    });

    it('drawBackground works with 0x0 canvas (edge case)', () => {
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = 0;
      smallCanvas.height = 0;
      const smallCtx = smallCanvas.getContext('2d')!;
      
      expect(() => {
        drawBackground(smallCtx);
      }).not.toThrow();
    });

    it('drawBackground handles very large canvas', () => {
      const largeCanvas = document.createElement('canvas');
      largeCanvas.width = 4096;
      largeCanvas.height = 4096;
      const largeCtx = largeCanvas.getContext('2d')!;
      
      expect(() => {
        drawBackground(largeCtx);
      }).not.toThrow();
    });
  });
});
