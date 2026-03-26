/**
 * @fileoverview Test suite for occupancy.ts (interaction point reservations)
 * Tests reservation, release, and availability checking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  reservePoint,
  releasePoint,
  releaseAll,
  isPointOccupied,
  getOccupant,
  getReservationCount,
  findAvailablePoint,
} from '../occupancy';
import type { InteractionPoint } from '../smartObjects';

describe('occupancy', () => {
  beforeEach(() => {
    releaseAll(); // Clean state before each test
  });

  // ─── Point reservation ───────────────────────────────────────────────────
  describe('reservePoint', () => {
    it('reserves a point and returns true', () => {
      const result = reservePoint(5, 10, 'weebo');
      expect(result).toBe(true);
      expect(isPointOccupied(5, 10)).toBe(true);
      expect(getOccupant(5, 10)).toBe('weebo');
    });

    it('allows same agent to re-reserve same point (idempotent)', () => {
      reservePoint(5, 10, 'weebo');
      const result = reservePoint(5, 10, 'weebo');
      expect(result).toBe(true);
    });

    it('prevents different agent from reserving occupied point', () => {
      reservePoint(5, 10, 'weebo');
      const result = reservePoint(5, 10, 'edith');
      expect(result).toBe(false);
    });

    it('allows different agents to reserve different points', () => {
      const result1 = reservePoint(5, 10, 'weebo');
      const result2 = reservePoint(6, 11, 'edith');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('increments reservation count on successful reserve', () => {
      const countBefore = getReservationCount();
      reservePoint(5, 10, 'weebo');
      const countAfter = getReservationCount();
      expect(countAfter).toBe(countBefore + 1);
    });

    it('does not increment reservation count for same agent re-reserving', () => {
      reservePoint(5, 10, 'weebo');
      const countBefore = getReservationCount();
      reservePoint(5, 10, 'weebo');
      const countAfter = getReservationCount();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ─── Point occupancy checks ──────────────────────────────────────────────
  describe('isPointOccupied', () => {
    it('returns false for unoccupied point', () => {
      expect(isPointOccupied(5, 10)).toBe(false);
    });

    it('returns true for occupied point', () => {
      reservePoint(5, 10, 'weebo');
      expect(isPointOccupied(5, 10)).toBe(true);
    });

    it('returns false after point is released', () => {
      reservePoint(5, 10, 'weebo');
      releasePoint('weebo');
      expect(isPointOccupied(5, 10)).toBe(false);
    });
  });

  // ─── Get occupant ───────────────────────────────────────────────────────
  describe('getOccupant', () => {
    it('returns undefined for unoccupied point', () => {
      expect(getOccupant(5, 10)).toBeUndefined();
    });

    it('returns agent ID for occupied point', () => {
      reservePoint(5, 10, 'weebo');
      expect(getOccupant(5, 10)).toBe('weebo');
    });

    it('returns undefined after point is released', () => {
      reservePoint(5, 10, 'weebo');
      releasePoint('weebo');
      expect(getOccupant(5, 10)).toBeUndefined();
    });

    it('returns different agent IDs for different points', () => {
      reservePoint(5, 10, 'weebo');
      reservePoint(6, 11, 'edith');
      expect(getOccupant(5, 10)).toBe('weebo');
      expect(getOccupant(6, 11)).toBe('edith');
    });
  });

  // ─── Release point ──────────────────────────────────────────────────────
  describe('releasePoint', () => {
    it('releases all points reserved by an agent', () => {
      reservePoint(5, 10, 'weebo');
      reservePoint(6, 11, 'weebo');
      reservePoint(7, 12, 'edith');

      releasePoint('weebo');

      expect(isPointOccupied(5, 10)).toBe(false);
      expect(isPointOccupied(6, 11)).toBe(false);
      expect(isPointOccupied(7, 12)).toBe(true); // edith's point still occupied
    });

    it('no-ops when agent has no reservations', () => {
      reservePoint(5, 10, 'weebo');
      expect(() => releasePoint('edith')).not.toThrow();
      expect(isPointOccupied(5, 10)).toBe(true); // weebo's reservation unchanged
    });

    it('decrements reservation count for each released point', () => {
      reservePoint(5, 10, 'weebo');
      reservePoint(6, 11, 'weebo');
      const countBefore = getReservationCount();

      releasePoint('weebo');

      const countAfter = getReservationCount();
      expect(countAfter).toBe(countBefore - 2);
    });
  });

  // ─── Release all ────────────────────────────────────────────────────────
  describe('releaseAll', () => {
    it('clears all reservations', () => {
      reservePoint(5, 10, 'weebo');
      reservePoint(6, 11, 'edith');
      reservePoint(7, 12, 'jarvis');

      releaseAll();

      expect(isPointOccupied(5, 10)).toBe(false);
      expect(isPointOccupied(6, 11)).toBe(false);
      expect(isPointOccupied(7, 12)).toBe(false);
    });

    it('resets reservation count to 0', () => {
      reservePoint(5, 10, 'weebo');
      reservePoint(6, 11, 'edith');

      releaseAll();

      expect(getReservationCount()).toBe(0);
    });

    it('is idempotent (multiple calls safe)', () => {
      reservePoint(5, 10, 'weebo');
      releaseAll();
      expect(() => releaseAll()).not.toThrow();
      expect(getReservationCount()).toBe(0);
    });
  });

  // ─── Reservation count ──────────────────────────────────────────────────
  describe('getReservationCount', () => {
    it('returns 0 initially', () => {
      releaseAll(); // Ensure clean state
      expect(getReservationCount()).toBe(0);
    });

    it('increments with each unique reservation', () => {
      expect(getReservationCount()).toBe(0);
      reservePoint(5, 10, 'weebo');
      expect(getReservationCount()).toBe(1);
      reservePoint(6, 11, 'edith');
      expect(getReservationCount()).toBe(2);
    });

    it('does not increment for re-reservation by same agent', () => {
      reservePoint(5, 10, 'weebo');
      const count1 = getReservationCount();
      reservePoint(5, 10, 'weebo');
      const count2 = getReservationCount();
      expect(count2).toBe(count1);
    });

    it('decrements when points are released', () => {
      reservePoint(5, 10, 'weebo');
      reservePoint(6, 11, 'edith');
      const count1 = getReservationCount();
      releasePoint('weebo');
      const count2 = getReservationCount();
      expect(count2).toBe(count1 - 1);
    });
  });

  // ─── Find available point (Manhattan distance) ──────────────────────────
  describe('findAvailablePoint', () => {
    const createPoint = (x: number, y: number): InteractionPoint => ({
      x,
      y,
      facing: 'down',
      behavior: 'work',
    });

    it('returns closest available point by Manhattan distance', () => {
      const points = [
        createPoint(10, 10),
        createPoint(20, 20),
        createPoint(12, 11),
      ];
      const agentX = 10;
      const agentY = 10;

      const result = findAvailablePoint(points, 'weebo', agentX, agentY);

      // (10, 10) is at distance 0 (same as agent)
      // (12, 11) is at distance 3 (|12-10| + |11-10| = 2 + 1)
      // (20, 20) is at distance 20
      expect(result).toEqual(createPoint(10, 10));
    });

    it('returns null if all points are occupied by other agents', () => {
      const points = [createPoint(10, 10), createPoint(20, 20)];
      reservePoint(10, 10, 'edith');
      reservePoint(20, 20, 'jarvis');

      const result = findAvailablePoint(points, 'weebo', 15, 15);

      expect(result).toBeNull();
    });

    it('skips points occupied by other agents', () => {
      const points = [
        createPoint(10, 10),
        createPoint(12, 12),
        createPoint(20, 20),
      ];
      reservePoint(10, 10, 'edith'); // Occupied by edith

      const result = findAvailablePoint(points, 'weebo', 10, 10);

      // Should return (12, 12), the closest unoccupied point
      expect(result).toEqual(createPoint(12, 12));
    });

    it('allows requesting agent to claim same point again (idempotent)', () => {
      const points = [createPoint(10, 10)];
      reservePoint(10, 10, 'weebo');

      const result = findAvailablePoint(points, 'weebo', 5, 5);

      // weebo can re-claim its own point
      expect(result).toEqual(createPoint(10, 10));
    });

    it('returns null for empty points array', () => {
      const result = findAvailablePoint([], 'weebo', 10, 10);
      expect(result).toBeNull();
    });

    it('uses Manhattan distance (|dx| + |dy|)', () => {
      const points = [
        createPoint(10, 10),
        createPoint(13, 10), // distance 3 in x
        createPoint(10, 13), // distance 3 in y
      ];
      const agentX = 10;
      const agentY = 10;

      const result = findAvailablePoint(points, 'weebo', agentX, agentY);

      // (10, 10) is distance 0
      expect(result).toEqual(createPoint(10, 10));
    });

    it('correctly calculates distance from agent position', () => {
      const points = [
        createPoint(10, 10),
        createPoint(15, 15),
        createPoint(20, 10),
      ];
      const agentX = 18;
      const agentY = 12;

      // (20, 10): |20-18| + |10-12| = 2 + 2 = 4 ← closest
      // (15, 15): |15-18| + |15-12| = 3 + 3 = 6
      // (10, 10): |10-18| + |10-12| = 8 + 2 = 10

      const result = findAvailablePoint(points, 'weebo', agentX, agentY);

      expect(result).toEqual(createPoint(20, 10));
    });
  });

  // ─── Integration: concurrent agents ──────────────────────────────────────
  describe('occupancy — integration with multiple agents', () => {
    it('handles 9 agents each reserving different points', () => {
      const agents = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
      const points = [
        [5, 10],
        [6, 11],
        [7, 12],
        [8, 13],
        [9, 14],
        [10, 15],
        [11, 16],
        [12, 17],
        [13, 18],
      ];

      agents.forEach((agent, i) => {
        const [x, y] = points[i];
        const result = reservePoint(x, y, agent);
        expect(result).toBe(true);
      });

      expect(getReservationCount()).toBe(9);
    });

    it('prevents conflicts when agents try same point', () => {
      reservePoint(5, 10, 'weebo');
      const result = reservePoint(5, 10, 'edith');
      expect(result).toBe(false);
      expect(getOccupant(5, 10)).toBe('weebo');
    });

    it('allows agent rotation through points', () => {
      reservePoint(5, 10, 'weebo');
      releasePoint('weebo');
      const result = reservePoint(5, 10, 'edith');
      expect(result).toBe(true);
      expect(getOccupant(5, 10)).toBe('edith');
    });
  });
});
