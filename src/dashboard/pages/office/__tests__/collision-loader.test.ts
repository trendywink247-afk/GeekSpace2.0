/**
 * @fileoverview Test suite for collisionLoader.ts
 * Tests image loading, parsing, error handling, and fallback behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAuthoredMapLoaded,
  getAuthoredMap,
  loadCollisionFromImage,
} from '../collision-loader';

describe('collisionLoader', () => {
  // ─── State queries ──────────────────────────────────────────────────────
  describe('isAuthoredMapLoaded', () => {
    it('returns false before any load attempt', () => {
      expect(isAuthoredMapLoaded()).toBe(false);
    });

    it('returns true after successful image load and parsing', async () => {
      // TODO: Mock Image with successful load
      await loadCollisionFromImage();
      expect(isAuthoredMapLoaded()).toBe(true);
    });

    it('returns false after failed image load', async () => {
      // TODO: Mock Image with onerror
      try {
        await loadCollisionFromImage();
      } catch {
        // expected
      }
      expect(isAuthoredMapLoaded()).toBe(false);
    });
  });

  // ─── Get authored map ──────────────────────────────────────────────────
  describe('getAuthoredMap', () => {
    it('returns null before load', () => {
      expect(getAuthoredMap()).toBe(null);
    });

    it('returns parsed 2D boolean grid after successful load', async () => {
      // TODO: Mock Image and canvas
      const map = await loadCollisionFromImage();
      expect(getAuthoredMap()).toEqual(map);
      expect(Array.isArray(getAuthoredMap())).toBe(true);
      // TODO: Verify dimensions (ROWS × COLS)
    });

    it('returns null after failed load (falls back to constant)', async () => {
      // TODO: Mock Image with error
      try {
        await loadCollisionFromImage();
      } catch {
        // expected
      }
      expect(getAuthoredMap()).toBe(null);
    });
  });

  // ─── Image loading ─────────────────────────────────────────────────────
  describe('loadCollisionFromImage', () => {
    it('loads image from /office/office_collision.webp', async () => {
      // TODO: Mock Image constructor, verify src set correctly
      // TODO: Verify crossOrigin='anonymous'
      await loadCollisionFromImage();
      // Verify fetch attempted
    });

    it('returns 2D grid on successful load', async () => {
      // TODO: Mock successful Image load + canvas
      const result = await loadCollisionFromImage();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(25); // ROWS
      if (result.length > 0) {
        expect(Array.isArray(result[0])).toBe(true);
        expect(result[0]).toHaveLength(27); // COLS
      }
    });

    it('handles image load failure gracefully', async () => {
      // TODO: Mock Image.onerror
      const result = await loadCollisionFromImage();
      expect(result).toBe(null);
      expect(isAuthoredMapLoaded()).toBe(false);
    });

    it('handles image timeout', async () => {
      // TODO: Use fake timers, simulate timeout
      // TODO: Verify promise resolves (not rejects)
      const result = await loadCollisionFromImage();
      expect(result).toBe(null);
    });
  });

  // ─── Alpha channel parsing ─────────────────────────────────────────────
  describe('Alpha channel interpretation', () => {
    it('treats alpha > 128 as blocked (true)', async () => {
      // TODO: Mock canvas with specific alpha values at known pixels
      // Pixel at (0, 0): alpha = 255 → blocked = true
      const map = await loadCollisionFromImage();
      if (map) {
        // TODO: Verify [0][0] is true
      }
    });

    it('treats alpha <= 128 as walkable (false)', async () => {
      // TODO: Mock canvas with alpha = 128, 127, 0
      // Pixel at (5, 5): alpha = 100 → blocked = false
      const map = await loadCollisionFromImage();
      if (map) {
        // TODO: Verify [5][5] is false
      }
    });

    it('handles boundary case alpha === 128 correctly', async () => {
      // TODO: Mock alpha exactly 128
      // Should be walkable (alpha <= 128)
      const map = await loadCollisionFromImage();
      if (map) {
        // TODO: Verify boundary pixel is false
      }
    });

    it('handles alpha === 129 (first blocked value)', async () => {
      // TODO: Mock alpha = 129
      // Should be blocked (alpha > 128)
      const map = await loadCollisionFromImage();
      if (map) {
        // TODO: Verify blocked pixel is true
      }
    });
  });

  // ─── Canvas context errors ─────────────────────────────────────────────
  describe('Canvas rendering errors', () => {
    it('handles getContext("2d") returning null', async () => {
      // TODO: Mock canvas.getContext to return null
      // Should catch and return null
      const result = await loadCollisionFromImage();
      expect(result).toBe(null);
    });

    it('handles getImageData throwing', async () => {
      // TODO: Mock canvas.getImageData to throw
      const result = await loadCollisionFromImage();
      expect(result).toBe(null);
    });

    it('handles drawImage throwing', async () => {
      // TODO: Mock ctx.drawImage to throw
      const result = await loadCollisionFromImage();
      expect(result).toBe(null);
    });
  });

  // ─── Pixel sampling ────────────────────────────────────────────────────
  describe('Pixel sampling', () => {
    it('samples center of each tile (CELL / 2 offset)', async () => {
      // TODO: Mock canvas and verify sampling at (x + CELL/2, y + CELL/2)
      // For tile (0, 0): sample at pixel (16, 16)
      // For tile (1, 0): sample at pixel (48, 16)
      await loadCollisionFromImage();
      // TODO: Verify sampling coordinates
    });

    it('handles image natural size scaling', async () => {
      // TODO: Mock image with different aspect ratio (e.g., 2× resolution)
      // Verify scaleX and scaleY calculation
      const result = await loadCollisionFromImage();
      expect(result).not.toBe(null);
    });

    it('handles out-of-bounds pixel sampling gracefully', async () => {
      // TODO: Mock small image (e.g., 100×100)
      // Sampling for tile (26, 24) may exceed image bounds
      const result = await loadCollisionFromImage();
      expect(result).not.toBe(null);
    });
  });

  // ─── Console logging ────────────────────────────────────────────────────
  describe('Console logging', () => {
    it('logs success message on successful parse', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      // TODO: Mock successful load
      await loadCollisionFromImage();
      // TODO: Verify log includes 'Parsed authored collision map'
      consoleSpy.mockRestore();
    });

    it('logs warning on parse failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      // TODO: Mock failed load
      try {
        await loadCollisionFromImage();
      } catch {
        // expected
      }
      // TODO: Verify warning includes 'Failed to parse' and 'fallback'
      consoleWarnSpy.mockRestore();
    });
  });

  // ─── Integration: collision loader + navigation ──────────────────────
  describe('Integration: CollisionLoader → Navigation', () => {
    it('loaded collision map should be compatible with navigation isWalkable()', async () => {
      // TODO: Load collision map, then verify dimensions match COLS/ROWS
      // Verify each cell is boolean
      const map = await loadCollisionFromImage();
      if (map) {
        expect(map).toHaveLength(25); // ROWS
        map.forEach((row) => {
          expect(row).toHaveLength(27); // COLS
          row.forEach((cell) => {
            expect(typeof cell).toBe('boolean');
          });
        });
      }
    });

    it('getAuthoredMap should replace COLLISION_MAP constant in navigation', async () => {
      // TODO: Verify navigation module can use getAuthoredMap() as fallback
      // When authored map loads, navigation should prefer it over constant
      const map = await loadCollisionFromImage();
      // TODO: Verify navigation.isWalkable() uses loaded map if available
    });
  });
});
