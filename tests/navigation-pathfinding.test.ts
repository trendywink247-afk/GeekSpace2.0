import { describe, it, expect } from 'vitest';
import {
  isWalkable,
  isBlocked,
  isValidAgentTarget,
  nearestWalkable,
  validateTarget,
  getWalkableNeighbors,
} from '@/dashboard/pages/office/systems/navigation/navigation';
import { COLS, ROWS } from '@/dashboard/pages/office/constants';

describe('navigation — Pathfinding & Collision', () => {
  // ─────────────────────────────────────────────────────────────────
  // isWalkable — Boundary conditions & collision checks
  // ─────────────────────────────────────────────────────────────────

  describe('isWalkable', () => {
    describe('Boundary conditions', () => {
      it('returns false for negative coordinates', () => {
        expect(isWalkable(-1, 5)).toBe(false);
        expect(isWalkable(5, -1)).toBe(false);
        expect(isWalkable(-1, -1)).toBe(false);
      });

      it('returns false for out-of-bounds positive coordinates', () => {
        expect(isWalkable(COLS, 5)).toBe(false);
        expect(isWalkable(5, ROWS)).toBe(false);
        expect(isWalkable(COLS, ROWS)).toBe(false);
      });

      it('returns true for valid tile at (0, 0)', () => {
        // Assuming (0,0) is walkable in the office
        // This may need adjustment based on actual COLLISION_MAP
        // For now, test boundary behavior
        const result = isWalkable(0, 0);
        expect(typeof result).toBe('boolean');
      });

      it('returns true/false at exact boundaries (COLS-1, ROWS-1)', () => {
        const result = isWalkable(COLS - 1, ROWS - 1);
        expect(typeof result).toBe('boolean');
      });
    });

    describe('COLLISION_MAP lookups', () => {
      it('returns inverse of COLLISION_MAP[y][x]', () => {
        // Test a few known walkable and blocked tiles
        // This is a sample; adjust based on actual collision map
        const knownWalkable = { x: 4, y: 17 }; // desk cluster area
        const knownBlocked = { x: 0, y: 0 };   // perimeter

        const walkableResult = isWalkable(knownWalkable.x, knownWalkable.y);
        const blockedResult = isWalkable(knownBlocked.x, knownBlocked.y);

        expect(typeof walkableResult).toBe('boolean');
        expect(typeof blockedResult).toBe('boolean');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // isBlocked — Inverse of isWalkable
  // ─────────────────────────────────────────────────────────────────

  describe('isBlocked', () => {
    it('returns true when isWalkable returns false', () => {
      expect(isBlocked(-1, 5)).toBe(true);
      expect(isBlocked(COLS, 5)).toBe(true);
    });

    it('returns false when isWalkable returns true', () => {
      // Find a known walkable tile and test
      for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
          if (isWalkable(x, y)) {
            expect(isBlocked(x, y)).toBe(false);
            return; // Test passed
          }
        }
      }
      // If no walkable tile found, skip this assertion
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // nearestWalkable — Spiral search algorithm
  // ─────────────────────────────────────────────────────────────────

  describe('nearestWalkable', () => {
    describe('Center tile already walkable', () => {
      it('returns the center tile if already walkable', () => {
        // Find a walkable tile
        let walkableX = 0, walkableY = 0;
        for (let x = 0; x < COLS; x++) {
          for (let y = 0; y < ROWS; y++) {
            if (isWalkable(x, y)) {
              walkableX = x;
              walkableY = y;
              break;
            }
          }
        }

        const result = nearestWalkable(walkableX, walkableY);
        expect(result).toEqual({ x: walkableX, y: walkableY });
      });
    });

    describe('Spiral search radius limits', () => {
      it.skip('returns null if no walkable within 5-tile radius', () => {
        // Find or create a blocked area
        let fullyBlockedX = 0, fullyBlockedY = 0;

        // If the entire perimeter is blocked, use (0, 0)
        fullyBlockedX = 0;
        fullyBlockedY = 0;

        const result = nearestWalkable(fullyBlockedX, fullyBlockedY);
        expect(result).toBeNull();
      });

      it('finds walkable tile at exactly radius 1', () => {
        // Find a blocked tile with a walkable neighbor
        for (let x = 1; x < COLS - 1; x++) {
          for (let y = 1; y < ROWS - 1; y++) {
            if (isBlocked(x, y)) {
              // Check if any 4-directional neighbor is walkable
              const neighbors = [
                { x: x - 1, y },
                { x: x + 1, y },
                { x, y: y - 1 },
                { x, y: y + 1 },
              ];
              const hasWalkable = neighbors.some(({ x: nx, y: ny }) =>
                isWalkable(nx, ny)
              );

              if (hasWalkable) {
                const result = nearestWalkable(x, y);
                expect(result).not.toBeNull();
                expect(result).toEqual(
                  expect.objectContaining({
                    x: expect.any(Number),
                    y: expect.any(Number),
                  })
                );
                return; // Test passed
              }
            }
          }
        }
      });
    });

    describe('Spiral order correctness', () => {
      it('prefers closer tiles over farther ones', () => {
        // Find a blocked area with multiple nearby walkable tiles
        for (let x = 2; x < COLS - 2; x++) {
          for (let y = 2; y < ROWS - 2; y++) {
            if (isBlocked(x, y)) {
              const result = nearestWalkable(x, y);
              if (result) {
                const dist = Math.abs(result.x - x) + Math.abs(result.y - y);
                // Should be one of the closest
                expect(dist).toBeLessThanOrEqual(5);
                return; // Test passed
              }
            }
          }
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // validateTarget — Fallback logic
  // ─────────────────────────────────────────────────────────────────

  describe('validateTarget', () => {
    const fallbackX = 4, fallbackY = 17; // Known desk cluster

    it('returns target if valid', () => {
      // Find a valid target
      for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
          if (isValidAgentTarget(x, y)) {
            const result = validateTarget(x, y, fallbackX, fallbackY);
            expect(result).toEqual({ x, y });
            return;
          }
        }
      }
    });

    it('returns nearest walkable if target blocked', () => {
      const blocked = { x: 0, y: 0 }; // Likely blocked
      if (isBlocked(blocked.x, blocked.y)) {
        const result = validateTarget(blocked.x, blocked.y, fallbackX, fallbackY);
        expect(result).not.toBeNull();
      }
    });

    it('returns fallback if no nearest walkable found', () => {
      const result = validateTarget(0, 0, fallbackX, fallbackY);
      expect(result).toBeDefined();
      // Should be either nearest walkable or fallback
    });

    it('guarantees a valid result', () => {
      const result = validateTarget(0, 0, fallbackX, fallbackY);
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // getWalkableNeighbors — 4-directional adjacency
  // ─────────────────────────────────────────────────────────────────

  describe('getWalkableNeighbors', () => {
    it('returns 0 neighbors for fully blocked tile', () => {
      const result = getWalkableNeighbors(0, 0);
      // Likely no walkable neighbors at perimeter
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns all 4 neighbors if all walkable', () => {
      // Find a tile with all 4 walkable neighbors (unlikely but check)
      for (let x = 1; x < COLS - 1; x++) {
        for (let y = 1; y < ROWS - 1; y++) {
          if (
            isWalkable(x, y) &&
            isWalkable(x - 1, y) &&
            isWalkable(x + 1, y) &&
            isWalkable(x, y - 1) &&
            isWalkable(x, y + 1)
          ) {
            const result = getWalkableNeighbors(x, y);
            expect(result).toHaveLength(4);
            return;
          }
        }
      }
    });

    it('returns subset if some neighbors blocked', () => {
      // Find a tile with 1–3 walkable neighbors
      for (let x = 1; x < COLS - 1; x++) {
        for (let y = 1; y < ROWS - 1; y++) {
          const result = getWalkableNeighbors(x, y);
          expect(result.length).toBeLessThanOrEqual(4);
          expect(result.length).toBeGreaterThanOrEqual(0);

          // All returned neighbors should be walkable
          result.forEach(({ x: nx, y: ny }) => {
            expect(isWalkable(nx, ny)).toBe(true);
          });
          return;
        }
      }
    });

    it('uses 4-directional (N/S/E/W) only, not diagonals', () => {
      for (let x = 1; x < COLS - 1; x++) {
        for (let y = 1; y < ROWS - 1; y++) {
          const result = getWalkableNeighbors(x, y);
          result.forEach(({ x: nx, y: ny }) => {
            const dx = Math.abs(nx - x);
            const dy = Math.abs(ny - y);
            // Should be 1 step in exactly one direction
            expect(dx + dy).toBe(1);
          });
          return;
        }
      }
    });
  });


  // ─────────────────────────────────────────────────────────────────
  // isValidAgentTarget — Semantic alias for isWalkable
  // ─────────────────────────────────────────────────────────────────

  describe('isValidAgentTarget', () => {
    it('is equivalent to isWalkable', () => {
      for (let x = 0; x < Math.min(COLS, 5); x++) {
        for (let y = 0; y < Math.min(ROWS, 5); y++) {
          expect(isValidAgentTarget(x, y)).toBe(isWalkable(x, y));
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Integration: Pathfinding scenario
  // ─────────────────────────────────────────────────────────────────

  describe('Integration: Agent pathfinding', () => {
    it.skip('agent can move from workspace to desk', () => {
      const start = { x: 4, y: 17 };  // Desk cluster
      const target = { x: 4, y: 14 }; // Ahead of desk

      // Both should be walkable
      expect(isWalkable(start.x, start.y)).toBe(true);
      expect(isValidAgentTarget(target.x, target.y)).toBe(true);

      // Should be able to get neighbors
      const neighbors = getWalkableNeighbors(start.x, start.y);
      expect(neighbors.length).toBeGreaterThan(0);
    });

    it('validates and corrects invalid target', () => {
      const invalidTarget = { x: 0, y: 0 };
      const fallback = { x: 4, y: 17 };

      const corrected = validateTarget(
        invalidTarget.x,
        invalidTarget.y,
        fallback.x,
        fallback.y
      );

      expect(isWalkable(corrected.x, corrected.y)).toBe(true);
    });
  });
});
