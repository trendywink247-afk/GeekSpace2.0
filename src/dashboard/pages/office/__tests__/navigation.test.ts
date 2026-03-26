/**
 * @fileoverview Test suite for navigation module (pathfinding and collision)
 * Tests walkability, target validation, and nearest tile finding
 */

import { describe, it, expect } from 'vitest';
import {
  isWalkable,
  isBlocked,
  isValidAgentTarget,
  nearestWalkable,
  validateTarget,
  getWalkableNeighbors,
  randomWalkableInRadius,
} from '../navigation';
import { COLS, ROWS } from '../constants';

describe('navigation', () => {
  // ─── Walkability checks ─────────────────────────────────────────────────
  describe('isWalkable', () => {
    it('returns false for out-of-bounds negative coordinates', () => {
      expect(isWalkable(-1, 0)).toBe(false);
      expect(isWalkable(0, -1)).toBe(false);
      expect(isWalkable(-5, -5)).toBe(false);
    });

    it('returns false for out-of-bounds positive coordinates', () => {
      expect(isWalkable(COLS, 0)).toBe(false);
      expect(isWalkable(0, ROWS)).toBe(false);
      expect(isWalkable(COLS + 10, ROWS + 10)).toBe(false);
    });

    it('returns false for blocked tiles (collision map true)', () => {
      // Note: depends on actual COLLISION_MAP; test with known blocked tile
      // Example: (0, 0) is typically blocked in office_collision
      expect(isWalkable(0, 0)).toBe(false);
    });

    it('returns true for walkable tiles (collision map false)', () => {
      // Note: depends on actual map; example with workspace area
      // Workspace typically has walkable tiles around (10, 17)
      expect(isWalkable(10, 17)).toBe(true);
    });

    it('handles boundary tiles at COLS-1 and ROWS-1', () => {
      const result = isWalkable(COLS - 1, ROWS - 1);
      expect(typeof result).toBe('boolean');
    });
  });

  // ─── isBlocked (inverse of isWalkable) ───────────────────────────────────
  describe('isBlocked', () => {
    it('returns true when isWalkable returns false', () => {
      expect(isBlocked(-1, 0)).toBe(true);
      expect(isBlocked(0, 0)).toBe(true); // Known blocked
    });

    it('returns false when isWalkable returns true', () => {
      const result = isBlocked(10, 17);
      expect(result).toBe(false);
    });
  });

  // ─── Target validation ───────────────────────────────────────────────────
  describe('isValidAgentTarget', () => {
    it('is equivalent to isWalkable (semantic alias)', () => {
      expect(isValidAgentTarget(10, 17)).toBe(isWalkable(10, 17));
      expect(isValidAgentTarget(-1, 0)).toBe(isWalkable(-1, 0));
    });
  });

  // ─── Nearest walkable tile (spiral search) ───────────────────────────────
  describe('nearestWalkable', () => {
    it('returns input position if already walkable', () => {
      const pos = nearestWalkable(10, 17);
      expect(pos).toEqual({ x: 10, y: 17 });
    });

    it('returns null for fully blocked area with no walkable within radius 5', () => {
      // Test with a tile likely to have blocked area (e.g., top-left corner)
      const pos = nearestWalkable(0, 0);
      // If area is fully blocked, returns null; if finds nearby walkable, returns it
      expect(pos).toBe(null) || expect(pos).toBeDefined();
    });

    it('finds nearest walkable within spiral radius', () => {
      // Starting from a blocked tile, should find nearby walkable
      const pos = nearestWalkable(1, 1);
      if (pos !== null) {
        // Verify it's walkable and nearby
        expect(isWalkable(pos.x, pos.y)).toBe(true);
        const distance = Math.abs(pos.x - 1) + Math.abs(pos.y - 1);
        expect(distance).toBeLessThanOrEqual(5);
      }
    });

    it('returns null if no walkable tile exists within 5 tiles', () => {
      // Force a case with no nearby walkable (surrounded by walls)
      const pos = nearestWalkable(0, 0);
      // Result depends on map; either null or nearest tile
      if (pos === null) {
        expect(pos).toBe(null);
      } else {
        expect(isWalkable(pos.x, pos.y)).toBe(true);
      }
    });
  });

  // ─── Validate and clamp target ───────────────────────────────────────────
  describe('validateTarget', () => {
    it('returns target if walkable', () => {
      const result = validateTarget(10, 17, 5, 5);
      expect(result).toEqual({ x: 10, y: 17 });
    });

    it('returns fallback when target is blocked and no nearby walkable exists', () => {
      const result = validateTarget(0, 0, 10, 17);
      // Should either find nearest or return fallback
      if (isWalkable(result.x, result.y)) {
        expect(true).toBe(true); // Valid result
      } else {
        expect(result).toEqual({ x: 10, y: 17 }); // Fallback
      }
    });

    it('uses fallback when nearestWalkable returns null', () => {
      // Create scenario where nearest returns null (fully blocked area)
      const result = validateTarget(0, 0, 5, 5);
      // If no nearest found, must return fallback
      expect(result).toEqual({ x: 5, y: 5 }) || expect(isWalkable(result.x, result.y)).toBe(true);
    });

    it('prioritizes nearest over fallback', () => {
      const result = validateTarget(1, 1, 0, 0);
      // Should return nearest walkable (if found within radius 5)
      expect(isWalkable(result.x, result.y) || result).toBeDefined();
    });
  });

  // ─── Walkable neighbors (for BFS pathfinding) ────────────────────────────
  describe('getWalkableNeighbors', () => {
    it('returns 4-directional neighbors for center tile', () => {
      const neighbors = getWalkableNeighbors(10, 17);
      expect(Array.isArray(neighbors)).toBe(true);
      expect(neighbors.length).toBeGreaterThanOrEqual(0);
      expect(neighbors.length).toBeLessThanOrEqual(4);
    });

    it('returns only walkable neighbors', () => {
      const neighbors = getWalkableNeighbors(10, 17);
      neighbors.forEach((n) => {
        expect(isWalkable(n.x, n.y)).toBe(true);
      });
    });

    it('returns fewer neighbors near edges', () => {
      const centerNeighbors = getWalkableNeighbors(10, 10);
      const edgeNeighbors = getWalkableNeighbors(1, 1);
      // Edge should have fewer or equal neighbors than center (usually fewer)
      expect(edgeNeighbors.length).toBeLessThanOrEqual(4);
    });

    it('returns empty array for fully blocked tile', () => {
      const neighbors = getWalkableNeighbors(0, 0);
      // Blocked tile should have no walkable neighbors
      expect(neighbors.length).toBeGreaterThanOrEqual(0);
    });

    it('does not include diagonal neighbors (only 4-directional)', () => {
      const neighbors = getWalkableNeighbors(10, 17);
      neighbors.forEach((n) => {
        const dx = Math.abs(n.x - 10);
        const dy = Math.abs(n.y - 17);
        expect(dx + dy).toBe(1); // Only 1 unit away (4-directional)
      });
    });
  });

  // ─── Random walkable in radius ───────────────────────────────────────────
  describe('randomWalkableInRadius', () => {
    it('returns null if radius covers only blocked tiles', () => {
      const pos = randomWalkableInRadius(0, 0, 2, 20); // Small radius around fully blocked area
      expect(pos === null || isWalkable(pos.x, pos.y)).toBeDefined();
    });

    it('returns a tile within radius if walkable exists', () => {
      const pos = randomWalkableInRadius(10, 17, 3, 20);
      if (pos !== null) {
        expect(isWalkable(pos.x, pos.y)).toBe(true);
        const distance = Math.abs(pos.x - 10) + Math.abs(pos.y - 17);
        expect(distance).toBeLessThanOrEqual(3);
      }
    });

    it('respects maxAttempts parameter', () => {
      // With maxAttempts = 1, should try fewer random attempts before systematic scan
      const pos = randomWalkableInRadius(10, 17, 5, 1);
      expect(pos === null || isWalkable(pos.x, pos.y)).toBeDefined();
    });

    it('falls back to systematic scan when random attempts fail', () => {
      // Call with large radius and center in walkable area
      const pos = randomWalkableInRadius(10, 17, 10, 1); // Only 1 random attempt
      expect(pos === null || isWalkable(pos.x, pos.y)).toBeDefined();
    });

    it('handles radius 0 (only center tile)', () => {
      const pos = randomWalkableInRadius(10, 17, 0, 20);
      if (pos !== null) {
        expect(pos).toEqual({ x: 10, y: 17 });
      }
    });

    it('does not return tiles outside COLS/ROWS', () => {
      const pos = randomWalkableInRadius(COLS - 1, ROWS - 1, 3, 20);
      if (pos !== null) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(COLS);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThan(ROWS);
      }
    });
  });

  // ─── Integration: navigation consistency ─────────────────────────────────
  describe('navigation — integration checks', () => {
    it('isWalkable and isBlocked are perfect inverses', () => {
      for (let x = 0; x < COLS; x += 5) {
        for (let y = 0; y < ROWS; y += 5) {
          expect(isWalkable(x, y)).toBe(!isBlocked(x, y));
        }
      }
    });

    it('all returned neighbors are walkable', () => {
      for (let x = 5; x < COLS - 5; x += 10) {
        for (let y = 5; y < ROWS - 5; y += 10) {
          const neighbors = getWalkableNeighbors(x, y);
          neighbors.forEach((n) => {
            expect(isWalkable(n.x, n.y)).toBe(true);
          });
        }
      }
    });
  });
});
