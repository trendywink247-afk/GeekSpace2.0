/**
 * Unit tests for occupancy.ts
 * Tests interaction point reservation system and availability checks.
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
} from '@/dashboard/pages/office/entities/occupancy';
import type { InteractionPoint } from '@/dashboard/pages/office/entities/smartObjects';

describe('Occupancy Module', () => {
  beforeEach(() => {
    // Clear all reservations before each test
    releaseAll();
  });

  describe('reservePoint - Reservation Management', () => {
    it('reserves an interaction point for an agent', () => {
      const success = reservePoint(5, 5, 'weebo');
      expect(success).toBe(true);
      expect(isPointOccupied(5, 5)).toBe(true);
      expect(getOccupant(5, 5)).toBe('weebo');
    });

    it('returns false if point occupied by different agent', () => {
      reservePoint(5, 5, 'weebo');
      const success = reservePoint(5, 5, 'edith');
      expect(success).toBe(false);
    });

    it('returns true if same agent re-reserves point', () => {
      reservePoint(5, 5, 'weebo');
      const success = reservePoint(5, 5, 'weebo');
      expect(success).toBe(true);
      expect(getOccupant(5, 5)).toBe('weebo');
    });

    it('allows multiple agents to reserve different points', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(6, 6, 'edith');
      reservePoint(7, 7, 'jarvis');

      expect(getOccupant(5, 5)).toBe('weebo');
      expect(getOccupant(6, 6)).toBe('edith');
      expect(getOccupant(7, 7)).toBe('jarvis');
    });
  });

  describe('releasePoint - Reservation Release', () => {
    it('removes all reservations for a specific agent', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(6, 6, 'weebo');
      reservePoint(7, 7, 'edith');

      releasePoint('weebo');

      expect(isPointOccupied(5, 5)).toBe(false);
      expect(isPointOccupied(6, 6)).toBe(false);
      expect(isPointOccupied(7, 7)).toBe(true); // edith's still held
    });

    it('is idempotent (no-op if agent has no reservations)', () => {
      reservePoint(5, 5, 'weebo');
      releasePoint('edith'); // edith has no reservations

      expect(isPointOccupied(5, 5)).toBe(true); // weebo's still there
      expect(getReservationCount()).toBe(1);
    });

    it('releases all instances when agent has multiple reservations', () => {
      reservePoint(1, 1, 'weebo');
      reservePoint(2, 2, 'weebo');
      reservePoint(3, 3, 'weebo');

      releasePoint('weebo');

      expect(getReservationCount()).toBe(0);
    });
  });

  describe('releaseAll - Clear All Reservations', () => {
    it('clears all active reservations', () => {
      reservePoint(1, 1, 'weebo');
      reservePoint(2, 2, 'edith');
      reservePoint(3, 3, 'jarvis');

      releaseAll();

      expect(getReservationCount()).toBe(0);
      expect(isPointOccupied(1, 1)).toBe(false);
      expect(isPointOccupied(2, 2)).toBe(false);
      expect(isPointOccupied(3, 3)).toBe(false);
    });

    it('is idempotent', () => {
      releaseAll();
      releaseAll(); // Should not throw
      expect(getReservationCount()).toBe(0);
    });
  });

  describe('isPointOccupied - Occupancy Query', () => {
    it('returns true for reserved points', () => {
      reservePoint(5, 5, 'weebo');
      expect(isPointOccupied(5, 5)).toBe(true);
    });

    it('returns false for unreserved points', () => {
      expect(isPointOccupied(10, 10)).toBe(false);
    });

    it('returns false after point is released', () => {
      reservePoint(5, 5, 'weebo');
      releasePoint('weebo');
      expect(isPointOccupied(5, 5)).toBe(false);
    });
  });

  describe('getOccupant - Occupant Lookup', () => {
    it('returns agent ID for occupied point', () => {
      reservePoint(5, 5, 'weebo');
      expect(getOccupant(5, 5)).toBe('weebo');
    });

    it('returns undefined for unoccupied point', () => {
      expect(getOccupant(10, 10)).toBeUndefined();
    });

    it('returns correct agent even with multiple reservations', () => {
      reservePoint(1, 1, 'weebo');
      reservePoint(2, 2, 'edith');
      reservePoint(3, 3, 'weebo');

      expect(getOccupant(1, 1)).toBe('weebo');
      expect(getOccupant(2, 2)).toBe('edith');
      expect(getOccupant(3, 3)).toBe('weebo');
    });
  });

  describe('getReservationCount - Count Active Reservations', () => {
    it('returns 0 initially', () => {
      expect(getReservationCount()).toBe(0);
    });

    it('increments with each reservation', () => {
      reservePoint(1, 1, 'weebo');
      expect(getReservationCount()).toBe(1);

      reservePoint(2, 2, 'edith');
      expect(getReservationCount()).toBe(2);

      reservePoint(3, 3, 'jarvis');
      expect(getReservationCount()).toBe(3);
    });

    it('does not double-count when same agent re-reserves', () => {
      reservePoint(1, 1, 'weebo');
      expect(getReservationCount()).toBe(1);

      reservePoint(1, 1, 'weebo'); // re-reserve
      expect(getReservationCount()).toBe(1);
    });

    it('decrements when points are released', () => {
      reservePoint(1, 1, 'weebo');
      reservePoint(2, 2, 'weebo');
      expect(getReservationCount()).toBe(2);

      releasePoint('weebo');
      expect(getReservationCount()).toBe(0);
    });
  });

  describe('findAvailablePoint - Nearest Available Search', () => {
    const mockPoints: InteractionPoint[] = [
      { x: 5, y: 5, facing: 'down', behavior: 'work' },
      { x: 10, y: 10, facing: 'up', behavior: 'coffee' },
      { x: 15, y: 15, facing: 'left', behavior: 'relax' },
    ];

    it('returns closest available point to agent', () => {
      const result = findAvailablePoint(mockPoints, 'weebo', 6, 6);
      expect(result).toEqual(mockPoints[0]); // (5,5) is closest to (6,6)
    });

    it('skips occupied points', () => {
      reservePoint(5, 5, 'edith');
      const result = findAvailablePoint(mockPoints, 'weebo', 6, 6);
      // Next closest should be (10, 10)
      expect(result).toEqual(mockPoints[1]);
    });

    it('returns points already held by requesting agent', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(10, 10, 'edith');

      const result = findAvailablePoint(mockPoints, 'weebo', 6, 6);
      expect(result).toEqual(mockPoints[0]); // weebo can use their own point
    });

    it('returns null if all points occupied', () => {
      reservePoint(5, 5, 'edith');
      reservePoint(10, 10, 'jarvis');
      reservePoint(15, 15, 'aria');

      const result = findAvailablePoint(mockPoints, 'weebo', 6, 6);
      expect(result).toBeNull();
    });

    it('handles empty points array', () => {
      const result = findAvailablePoint([], 'weebo', 6, 6);
      expect(result).toBeNull();
    });

    it('calculates distance correctly (Manhattan)', () => {
      const points: InteractionPoint[] = [
        { x: 0, y: 0, facing: 'down', behavior: 'work' },
        { x: 3, y: 4, facing: 'down', behavior: 'work' }, // Manhattan distance = 7
      ];

      const result = findAvailablePoint(points, 'weebo', 0, 0);
      // (0, 0) is closest to agent at (0, 0)
      expect(result).toEqual(points[0]);
    });
  });

  describe('Edge Cases & Concurrent Operations', () => {
    it('handles non-existent agent release gracefully', () => {
      reservePoint(5, 5, 'weebo');
      expect(() => releasePoint('nonexistent')).not.toThrow();
      expect(isPointOccupied(5, 5)).toBe(true);
    });

    it('handles same point reserved by agent twice', () => {
      reservePoint(5, 5, 'weebo');
      const success = reservePoint(5, 5, 'weebo');
      expect(success).toBe(true);
      expect(getReservationCount()).toBe(1); // Still only 1
    });

    it('survives stress test: many agents, many points', () => {
      const agents = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
      const pointCount = 100;

      // Reserve many points
      for (let i = 0; i < pointCount; i++) {
        reservePoint(i % 27, Math.floor(i / 27), agents[i % agents.length]);
      }

      expect(getReservationCount()).toBe(pointCount);

      // Release each agent
      agents.forEach((agent) => releasePoint(agent));

      expect(getReservationCount()).toBe(0);
    });
  });
});
