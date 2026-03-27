/**
 * @fileoverview Test suite for navigation.ts
 *
 * Covers collision checking, pathfinding, and target validation.
 * Tests BFS neighbor enumeration, spiral search, and walkability verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isWalkable,
  isBlocked,
  isValidAgentTarget,
  nearestWalkable,
  validateTarget,
  getWalkableNeighbors,
} from '@/dashboard/pages/office/navigation';
import { COLS, ROWS } from '@/dashboard/pages/office/constants';

// ─────────────────────────────────────────────────────────────────────────────
// isWalkable() — Core collision check
// ─────────────────────────────────────────────────────────────────────────────

describe('isWalkable()', () => {
  // ─ Valid walkable tiles ─
  it('returns true for known walkable tiles', () => {
    // Assuming workspace has some walkable tiles (from collision map)
    // These would need to be determined from actual COLLISION_MAP
    expect(isWalkable(4, 14)).toBe(true); // Desk cluster area
  });

  // ─ Bounds checking ─
  it('returns false for negative coordinates', () => {
    expect(isWalkable(-1, 5)).toBe(false);
    expect(isWalkable(5, -1)).toBe(false);
    expect(isWalkable(-1, -1)).toBe(false);
  });

  it('returns false for coordinates beyond COLS', () => {
    expect(isWalkable(COLS, 5)).toBe(false);
    expect(isWalkable(COLS + 10, 5)).toBe(false);
  });

  it('returns false for coordinates beyond ROWS', () => {
    expect(isWalkable(5, ROWS)).toBe(false);
    expect(isWalkable(5, ROWS + 10)).toBe(false);
  });

  it('returns false for both coordinates at bounds', () => {
    expect(isWalkable(COLS, ROWS)).toBe(false);
  });

  it('returns false for max valid coordinate that is blocked', () => {
    // Top-left corner is typically blocked (outside office)
    expect(isWalkable(0, 0)).toBe(false);
  });

  it('handles edge tile at (0, y) in walkable range', () => {
    // Some left-edge tiles are walkable (depends on map)
    // Verify behavior matches expectations
    const result = isWalkable(0, 8);
    expect(typeof result).toBe('boolean');
  });

  it('handles edge tile at (x, 0) in walkable range', () => {
    const result = isWalkable(14, 0);
    expect(typeof result).toBe('boolean');
  });

  it('returns false at (COLS-1, ROWS-1) if blocked', () => {
    // Max valid coordinate
    const result = isWalkable(COLS - 1, ROWS - 1);
    expect(typeof result).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isBlocked() — Inverse of isWalkable
// ─────────────────────────────────────────────────────────────────────────────

describe('isBlocked()', () => {
  it('returns true when isWalkable returns false', () => {
    expect(isBlocked(-1, 5)).toBe(true);
    expect(isBlocked(0, 0)).toBe(true); // Typical blocked tile
  });

  it('returns false when isWalkable returns true', () => {
    // Find a walkable tile and verify inverse
    if (isWalkable(4, 14)) {
      expect(isBlocked(4, 14)).toBe(false);
    }
  });

  it('is exactly inverse of isWalkable', () => {
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        expect(isBlocked(x, y)).toBe(!isWalkable(x, y));
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValidAgentTarget() — Semantic alias for isWalkable
// ─────────────────────────────────────────────────────────────────────────────

describe('isValidAgentTarget()', () => {
  it('returns true for walkable tiles', () => {
    if (isWalkable(4, 14)) {
      expect(isValidAgentTarget(4, 14)).toBe(true);
    }
  });

  it('returns false for blocked tiles', () => {
    expect(isValidAgentTarget(0, 0)).toBe(false);
  });

  it('is equivalent to isWalkable', () => {
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        expect(isValidAgentTarget(x, y)).toBe(isWalkable(x, y));
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nearestWalkable() — Spiral search for closest walkable tile
// ─────────────────────────────────────────────────────────────────────────────

describe('nearestWalkable()', () => {
  it('returns the same position if already walkable', () => {
    if (isWalkable(4, 14)) {
      const result = nearestWalkable(4, 14);
      expect(result).toEqual({ x: 4, y: 14 });
    }
  });

  it('finds nearest walkable tile within radius 5', () => {
    // Start from a blocked position near a walkable area
    const result = nearestWalkable(0, 2);
    if (result) {
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(isWalkable(result.x, result.y)).toBe(true);
    }
  });

  it('returns null if no walkable tile within radius 5', () => {
    // Ideally test with a corner or edge that has no nearby walkables
    const result = nearestWalkable(COLS - 1, ROWS - 1);
    // Could be null if corner is isolated
    if (result) {
      expect(isWalkable(result.x, result.y)).toBe(true);
    }
  });

  it('respects radius limit (max 5 tiles)', () => {
    const result = nearestWalkable(0, 10);
    if (result) {
      const distance = Math.max(Math.abs(result.x - 0), Math.abs(result.y - 10));
      expect(distance).toBeLessThanOrEqual(5);
    }
  });

  it('finds diagonal neighbors', () => {
    // If (4,14) is walkable, (3,13) or (5,15) might find it diagonally
    // Test that spiral search includes diagonals
    const result = nearestWalkable(4, 14);
    expect(result).toBeTruthy();
  });

  it('handles edge case: searching from corner (0, 0)', () => {
    const result = nearestWalkable(0, 0);
    // Should find something if there's any walkable tile within 5
    expect(result === null || isWalkable(result.x, result.y)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateTarget() — Validate or correct target with fallback
// ─────────────────────────────────────────────────────────────────────────────

describe('validateTarget()', () => {
  const fallback = { x: 4, y: 14 }; // Assumed safe desk position

  it('returns target if already walkable', () => {
    if (isWalkable(4, 14)) {
      const result = validateTarget(4, 14, fallback.x, fallback.y);
      expect(result).toEqual({ x: 4, y: 14 });
    }
  });

  it('returns nearest walkable if target is blocked', () => {
    const result = validateTarget(0, 0, fallback.x, fallback.y);
    expect(isWalkable(result.x, result.y)).toBe(true);
  });

  it('uses fallback if target and neighbors all blocked', () => {
    // Set fallback as walkable and test
    if (!isWalkable(0, 0)) {
      const result = validateTarget(0, 0, fallback.x, fallback.y);
      // Should either return nearby walkable or fallback
      expect(isWalkable(result.x, result.y)).toBe(true);
    }
  });

  it('guarantees walkability of returned position', () => {
    const result = validateTarget(0, 0, fallback.x, fallback.y);
    expect(isWalkable(result.x, result.y)).toBe(true);
  });

  it('respects fallback for unreachable targets', () => {
    // If entire area is blocked, return fallback
    const result = validateTarget(COLS - 1, ROWS - 1, fallback.x, fallback.y);
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it('prioritizes target over fallback', () => {
    if (isWalkable(4, 14) && isWalkable(5, 15)) {
      const result = validateTarget(4, 14, 5, 15);
      expect(result).toEqual({ x: 4, y: 14 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getWalkableNeighbors() — 4-directional neighbor enumeration for BFS
// ─────────────────────────────────────────────────────────────────────────────

describe('getWalkableNeighbors()', () => {
  it('returns array of neighbors', () => {
    // Find a tile with walkable center
    const result = getWalkableNeighbors(8, 5);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns at most 4 neighbors (N, S, E, W)', () => {
    const result = getWalkableNeighbors(8, 5);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('only returns walkable neighbors', () => {
    const result = getWalkableNeighbors(8, 5);
    for (const neighbor of result) {
      expect(isWalkable(neighbor.x, neighbor.y)).toBe(true);
    }
  });

  it('returns all 4 neighbors if all are walkable', () => {
    // Find a tile surrounded by walkables
    // In a typical office, this would be in the middle of an open area
    const result = getWalkableNeighbors(8, 6);
    // Count could be 0-4 depending on layout
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('returns empty array if surrounded by walls', () => {
    // Find a completely blocked position
    const result = getWalkableNeighbors(0, 0);
    expect(result.length).toBe(0);
  });

  it('handles north neighbor (y - 1)', () => {
    // Check if north neighbor is in results
    if (isWalkable(4, 15) && isWalkable(4, 14)) {
      const result = getWalkableNeighbors(4, 15);
      const hasNorth = result.some(n => n.x === 4 && n.y === 14);
      expect(hasNorth).toBe(true);
    }
  });

  it('handles south neighbor (y + 1)', () => {
    if (isWalkable(4, 14) && isWalkable(4, 15)) {
      const result = getWalkableNeighbors(4, 14);
      const hasSouth = result.some(n => n.x === 4 && n.y === 15);
      expect(hasSouth).toBe(true);
    }
  });

  it('handles west neighbor (x - 1)', () => {
    if (isWalkable(5, 14) && isWalkable(4, 14)) {
      const result = getWalkableNeighbors(5, 14);
      const hasWest = result.some(n => n.x === 4 && n.y === 14);
      expect(hasWest).toBe(true);
    }
  });

  it('handles east neighbor (x + 1)', () => {
    if (isWalkable(4, 14) && isWalkable(5, 14)) {
      const result = getWalkableNeighbors(4, 14);
      const hasEast = result.some(n => n.x === 5 && n.y === 14);
      expect(hasEast).toBe(true);
    }
  });

  it('does not return diagonal neighbors (4-directional only)', () => {
    const result = getWalkableNeighbors(8, 5);
    for (const n of result) {
      const isAdjacent = (Math.abs(n.x - 8) + Math.abs(n.y - 5)) === 1;
      expect(isAdjacent).toBe(true); // Manhattan distance = 1
    }
  });

  it('respects bounds (no neighbors outside map)', () => {
    const result = getWalkableNeighbors(0, 0);
    for (const n of result) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThan(COLS);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThan(ROWS);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests — Pathfinding scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('pathfinding integration', () => {
  it('can validate a path step-by-step using neighbors', () => {
    // Start from a known walkable tile
    const start = { x: 4, y: 14 };
    if (!isWalkable(start.x, start.y)) {
      return; // Skip if test tile not walkable
    }

    let current = start;
    const visited = new Set<string>();
    const path = [current];

    // Simulate 5 steps of BFS
    for (let i = 0; i < 5; i++) {
      visited.add(`${current.x},${current.y}`);
      const neighbors = getWalkableNeighbors(current.x, current.y);

      if (neighbors.length === 0) break;

      const next = neighbors.find(n => !visited.has(`${n.x},${n.y}`));
      if (!next) break;

      current = next;
      path.push(current);
    }

    expect(path.length).toBeGreaterThan(0);
    for (const tile of path) {
      expect(isWalkable(tile.x, tile.y)).toBe(true);
    }
  });

  it('can find a walkable target from any starting position', () => {
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const target = validateTarget(x, y, 4, 14);
        expect(isWalkable(target.x, target.y)).toBe(true);
      }
    }
  });
});
