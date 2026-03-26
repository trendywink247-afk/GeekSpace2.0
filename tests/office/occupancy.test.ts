import { describe, it, expect, beforeEach } from 'vitest';
import {
  reservePoint,
  releasePoint,
  releaseAll,
  isPointOccupied,
  getOccupant,
  getReservationCount,
  findAvailablePoint,
} from '@/dashboard/pages/office/occupancy';
import type { InteractionPoint } from '@/dashboard/pages/office/smartObjects';

describe('occupancy', () => {
  beforeEach(() => {
    releaseAll();
  });

  describe('reservePoint', () => {
    it('reserves a point for an agent', () => {
      const result = reservePoint(5, 5, 'weebo');
      expect(result).toBe(true);
      expect(isPointOccupied(5, 5)).toBe(true);
    });

    it('blocks reservation for different agent', () => {
      reservePoint(5, 5, 'weebo');
      const result = reservePoint(5, 5, 'edith');
      expect(result).toBe(false);
    });

    it('allows same agent to re-reserve', () => {
      reservePoint(5, 5, 'weebo');
      const result = reservePoint(5, 5, 'weebo');
      expect(result).toBe(true);
    });

    it('reserves different points independently', () => {
      const r1 = reservePoint(5, 5, 'weebo');
      const r2 = reservePoint(10, 10, 'edith');
      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(isPointOccupied(5, 5)).toBe(true);
      expect(isPointOccupied(10, 10)).toBe(true);
    });

    it('uses correct key format', () => {
      reservePoint(5, 5, 'weebo');
      expect(getOccupant(5, 5)).toBe('weebo');
    });
  });

  describe('releasePoint', () => {
    it('removes agent reservation', () => {
      reservePoint(5, 5, 'weebo');
      releasePoint('weebo');
      expect(isPointOccupied(5, 5)).toBe(false);
    });

    it('does not affect other agents reservations', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(10, 10, 'edith');
      releasePoint('weebo');
      expect(isPointOccupied(5, 5)).toBe(false);
      expect(isPointOccupied(10, 10)).toBe(true);
    });

    it('handles multiple points per agent', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(10, 10, 'weebo');
      releasePoint('weebo');
      expect(isPointOccupied(5, 5)).toBe(false);
      expect(isPointOccupied(10, 10)).toBe(false);
    });

    it('no-op if agent has no reservations', () => {
      releasePoint('weebo');
      expect(getReservationCount()).toBe(0);
    });
  });

  describe('releaseAll', () => {
    it('clears all reservations', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(10, 10, 'edith');
      reservePoint(15, 15, 'jarvis');
      releaseAll();
      expect(getReservationCount()).toBe(0);
      expect(isPointOccupied(5, 5)).toBe(false);
      expect(isPointOccupied(10, 10)).toBe(false);
      expect(isPointOccupied(15, 15)).toBe(false);
    });
  });

  describe('isPointOccupied', () => {
    it('returns true if point is reserved', () => {
      reservePoint(5, 5, 'weebo');
      expect(isPointOccupied(5, 5)).toBe(true);
    });

    it('returns false if point is free', () => {
      expect(isPointOccupied(5, 5)).toBe(false);
    });

    it('returns false after release', () => {
      reservePoint(5, 5, 'weebo');
      releasePoint('weebo');
      expect(isPointOccupied(5, 5)).toBe(false);
    });
  });

  describe('getOccupant', () => {
    it('returns agent ID if point is occupied', () => {
      reservePoint(5, 5, 'weebo');
      expect(getOccupant(5, 5)).toBe('weebo');
    });

    it('returns undefined if point is free', () => {
      expect(getOccupant(5, 5)).toBeUndefined();
    });

    it('returns correct agent after re-reserve', () => {
      reservePoint(5, 5, 'weebo');
      expect(getOccupant(5, 5)).toBe('weebo');
      releasePoint('weebo');
      reservePoint(5, 5, 'edith');
      expect(getOccupant(5, 5)).toBe('edith');
    });
  });

  describe('getReservationCount', () => {
    it('counts active reservations correctly', () => {
      expect(getReservationCount()).toBe(0);
      reservePoint(5, 5, 'weebo');
      expect(getReservationCount()).toBe(1);
      reservePoint(10, 10, 'edith');
      expect(getReservationCount()).toBe(2);
      releasePoint('weebo');
      expect(getReservationCount()).toBe(1);
    });

    it('does not double-count same agent re-reserves', () => {
      reservePoint(5, 5, 'weebo');
      expect(getReservationCount()).toBe(1);
      reservePoint(5, 5, 'weebo');
      expect(getReservationCount()).toBe(1);
    });
  });

  describe('findAvailablePoint', () => {
    const testPoints: InteractionPoint[] = [
      { x: 5, y: 5, facing: 'down', behavior: 'work' },
      { x: 15, y: 15, facing: 'down', behavior: 'work' },
      { x: 20, y: 20, facing: 'down', behavior: 'work' },
    ];

    it('returns closest available point', () => {
      const result = findAvailablePoint(testPoints, 'jarvis', 7, 7);
      expect(result?.x).toBe(5);
      expect(result?.y).toBe(5);
    });

    it('skips occupied points held by other agents', () => {
      reservePoint(5, 5, 'weebo');
      const result = findAvailablePoint(testPoints, 'jarvis', 7, 7);
      expect(result?.x).toBe(15);
    });

    it('allows agent to use its own reserved points', () => {
      reservePoint(5, 5, 'weebo');
      const result = findAvailablePoint(testPoints, 'weebo', 7, 7);
      expect(result?.x).toBe(5);
      expect(result?.y).toBe(5);
    });

    it('returns null if all points occupied by others', () => {
      reservePoint(5, 5, 'weebo');
      reservePoint(15, 15, 'edith');
      reservePoint(20, 20, 'jarvis');
      const result = findAvailablePoint(testPoints, 'aria', 10, 10);
      expect(result).toBeNull();
    });

    it('uses manhattan distance for proximity', () => {
      const result = findAvailablePoint(testPoints, 'aria', 6, 6);
      // Distance to (5,5): |6-5| + |6-5| = 2
      // Distance to (15,15): |15-6| + |15-6| = 18
      expect(result?.x).toBe(5);
    });

    it('handles empty point list', () => {
      const result = findAvailablePoint([], 'weebo', 5, 5);
      expect(result).toBeNull();
    });

    it('finds point even if agent starting position is blocked', () => {
      // Agent at an impossible position (999,999)
      const result = findAvailablePoint(testPoints, 'weebo', 999, 999);
      expect(result).not.toBeNull();
      expect([5, 15, 20]).toContain(result?.x);
    });
  });
});
