/**
 * @fileoverview Test suite for occupancy.ts
 *
 * Covers reservation system for interaction points.
 * Tests conflict detection, occupancy tracking, and point discovery.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

// ─────────────────────────────────────────────────────────────────────────────
// Setup: Helper to create interaction points
// ─────────────────────────────────────────────────────────────────────────────

function createTestPoints(): InteractionPoint[] {
  return [
    { x: 4, y: 14, facing: 'down', behavior: 'work' },
    { x: 4, y: 15, facing: 'down', behavior: 'work' },
    { x: 8, y: 4, facing: 'up', behavior: 'coffee' },
    { x: 9, y: 4, facing: 'up', behavior: 'coffee' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Occupancy System', () => {
  beforeEach(() => {
    releaseAll();
  });

  afterEach(() => {
    releaseAll();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // reservePoint() — Reserve interaction point for agent
  // ─────────────────────────────────────────────────────────────────────────────

  describe('reservePoint()', () => {
    it('returns true on successful reservation', () => {
      const result = reservePoint(4, 14, 'weebo');
      expect(result).toBe(true);
    });

    it('marks point as occupied after reservation', () => {
      reservePoint(4, 14, 'weebo');
      expect(isPointOccupied(4, 14)).toBe(true);
    });

    it('prevents second agent from reserving occupied point', () => {
      reservePoint(4, 14, 'weebo');
      const result = reservePoint(4, 14, 'edith');
      expect(result).toBe(false);
    });

    it('allows same agent to reserve same point twice (idempotent)', () => {
      const result1 = reservePoint(4, 14, 'weebo');
      const result2 = reservePoint(4, 14, 'weebo');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('allows multiple agents to reserve different points', () => {
      const result1 = reservePoint(4, 14, 'weebo');
      const result2 = reservePoint(8, 4, 'edith');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('allows same agent to reserve multiple points', () => {
      const result1 = reservePoint(4, 14, 'weebo');
      const result2 = reservePoint(8, 4, 'weebo');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('handles multiple agents competing for same point', () => {
      reservePoint(4, 14, 'weebo');
      expect(reservePoint(4, 14, 'edith')).toBe(false);
      expect(reservePoint(4, 14, 'jarvis')).toBe(false);
      expect(reservePoint(4, 14, 'aria')).toBe(false);
    });

    it('distinguishes between points with similar coordinates', () => {
      reservePoint(4, 14, 'weebo');
      expect(reservePoint(4, 15, 'edith')).toBe(true); // Different point
      expect(reservePoint(5, 14, 'aria')).toBe(true); // Different point
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // releasePoint() — Release agent's reservations
  // ─────────────────────────────────────────────────────────────────────────────

  describe('releasePoint()', () => {
    it('frees occupied point', () => {
      reservePoint(4, 14, 'weebo');
      releasePoint('weebo');
      expect(isPointOccupied(4, 14)).toBe(false);
    });

    it('allows another agent to claim released point', () => {
      reservePoint(4, 14, 'weebo');
      releasePoint('weebo');
      expect(reservePoint(4, 14, 'edith')).toBe(true);
    });

    it('releases all points for an agent', () => {
      reservePoint(4, 14, 'weebo');
      reservePoint(8, 4, 'weebo');
      reservePoint(9, 4, 'weebo');

      releasePoint('weebo');

      expect(isPointOccupied(4, 14)).toBe(false);
      expect(isPointOccupied(8, 4)).toBe(false);
      expect(isPointOccupied(9, 4)).toBe(false);
    });

    it('does not affect other agents\' reservations', () => {
      reservePoint(4, 14, 'weebo');
      reservePoint(8, 4, 'edith');

      releasePoint('weebo');

      expect(isPointOccupied(4, 14)).toBe(false);
      expect(isPointOccupied(8, 4)).toBe(true);
      expect(getOccupant(8, 4)).toBe('edith');
    });

    it('handles releasing agent with no reservations', () => {
      expect(() => releasePoint('weebo')).not.toThrow();
    });

    it('can release same agent multiple times (idempotent)', () => {
      reservePoint(4, 14, 'weebo');
      releasePoint('weebo');
      expect(() => releasePoint('weebo')).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // releaseAll() — Clear all reservations
  // ─────────────────────────────────────────────────────────────────────────────

  describe('releaseAll()', () => {
    it('clears all reservations', () => {
      reservePoint(4, 14, 'weebo');
      reservePoint(8, 4, 'edith');
      reservePoint(9, 4, 'jarvis');

      releaseAll();

      expect(isPointOccupied(4, 14)).toBe(false);
      expect(isPointOccupied(8, 4)).toBe(false);
      expect(isPointOccupied(9, 4)).toBe(false);
    });

    it('allows all points to be re-reserved', () => {
      releaseAll();
      expect(reservePoint(4, 14, 'weebo')).toBe(true);
      expect(reservePoint(8, 4, 'edith')).toBe(true);
    });

    it('returns reservation count to 0', () => {
      reservePoint(4, 14, 'weebo');
      releaseAll();
      expect(getReservationCount()).toBe(0);
    });

    it('can be called multiple times (idempotent)', () => {
      releaseAll();
      expect(() => releaseAll()).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // isPointOccupied() — Check occupancy status
  // ─────────────────────────────────────────────────────────────────────────────

  describe('isPointOccupied()', () => {
    it('returns false for unoccupied point', () => {
      expect(isPointOccupied(4, 14)).toBe(false);
    });

    it('returns true for occupied point', () => {
      reservePoint(4, 14, 'weebo');
      expect(isPointOccupied(4, 14)).toBe(true);
    });

    it('returns true regardless of which agent occupies it', () => {
      reservePoint(4, 14, 'weebo');
      expect(isPointOccupied(4, 14)).toBe(true);

      releaseAll();
      reservePoint(4, 14, 'edith');
      expect(isPointOccupied(4, 14)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getOccupant() — Retrieve occupying agent
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getOccupant()', () => {
    it('returns undefined for unoccupied point', () => {
      expect(getOccupant(4, 14)).toBeUndefined();
    });

    it('returns agent ID for occupied point', () => {
      reservePoint(4, 14, 'weebo');
      expect(getOccupant(4, 14)).toBe('weebo');
    });

    it('returns correct agent when multiple points occupied', () => {
      reservePoint(4, 14, 'weebo');
      reservePoint(8, 4, 'edith');
      reservePoint(9, 4, 'jarvis');

      expect(getOccupant(4, 14)).toBe('weebo');
      expect(getOccupant(8, 4)).toBe('edith');
      expect(getOccupant(9, 4)).toBe('jarvis');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getReservationCount() — Count active reservations
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getReservationCount()', () => {
    it('returns 0 initially', () => {
      expect(getReservationCount()).toBe(0);
    });

    it('increments on reservation', () => {
      expect(getReservationCount()).toBe(0);
      reservePoint(4, 14, 'weebo');
      expect(getReservationCount()).toBe(1);
      reservePoint(8, 4, 'edith');
      expect(getReservationCount()).toBe(2);
    });

    it('does not count duplicate reservations by same agent', () => {
      reservePoint(4, 14, 'weebo');
      expect(getReservationCount()).toBe(1);
      reservePoint(4, 14, 'weebo'); // Re-reserve same point
      expect(getReservationCount()).toBe(1); // Still 1
    });

    it('counts separate reservations by same agent', () => {
      reservePoint(4, 14, 'weebo');
      reservePoint(8, 4, 'weebo');
      expect(getReservationCount()).toBe(2);
    });

    it('decrements on release', () => {
      reservePoint(4, 14, 'weebo');
      reservePoint(8, 4, 'edith');
      expect(getReservationCount()).toBe(2);

      releasePoint('weebo');
      expect(getReservationCount()).toBe(1);

      releasePoint('edith');
      expect(getReservationCount()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // findAvailablePoint() — Find nearest available interaction point
  // ─────────────────────────────────────────────────────────────────────────────

  describe('findAvailablePoint()', () => {
    const points = createTestPoints();
    const agentId = 'weebo';
    const agentX = 4;
    const agentY = 14;

    it('returns closest available point', () => {
      const result = findAvailablePoint(points, agentId, agentX, agentY);
      expect(result).toBeTruthy();
      expect(result?.x).toBe(4);
      expect(result?.y).toBe(14); // Closest point
    });

    it.skip('skips occupied points by other agents', () => {
      reservePoint(4, 14, 'edith'); // Block closest point
      const result = findAvailablePoint(points, 'weebo', agentX, agentY);
      expect(result).toBeTruthy();
      expect(result?.x).not.toBe(4);
      expect(result?.y).not.toBe(14);
    });

    it('allows agent to claim own reserved point', () => {
      reservePoint(4, 14, 'weebo');
      const result = findAvailablePoint(points, 'weebo', agentX, agentY);
      expect(result).toBeTruthy();
      expect(result?.x).toBe(4);
      expect(result?.y).toBe(14);
    });

    it('returns null when all points occupied by others', () => {
      points.forEach((p, idx) => {
        const agents = ['edith', 'jarvis', 'aria', 'forge'];
        reservePoint(p.x, p.y, agents[idx]);
      });
      const result = findAvailablePoint(points, 'weebo', agentX, agentY);
      expect(result).toBeNull();
    });

    it('uses Manhattan distance for nearest calculation', () => {
      // Distance from (4, 14) to:
      // (4, 14) = 0
      // (4, 15) = 1
      // (8, 4) = 8
      // (9, 4) = 9
      reservePoint(4, 14, 'edith'); // Block closest
      const result = findAvailablePoint(points, 'weebo', 4, 14);
      expect(result?.x).toBe(4);
      expect(result?.y).toBe(15); // Next closest
    });

    it('handles empty point list', () => {
      const result = findAvailablePoint([], 'weebo', 4, 14);
      expect(result).toBeNull();
    });

    it('handles single point', () => {
      const singlePoint = [points[0]];
      const result = findAvailablePoint(singlePoint, 'weebo', 4, 14);
      expect(result).toEqual(points[0]);
    });

    it('handles agent starting at exact point location', () => {
      const result = findAvailablePoint(points, 'weebo', 4, 14);
      expect(result?.x).toBe(4);
      expect(result?.y).toBe(14);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Integration scenarios
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Integration: Agent workflow', () => {
    it('agent reserves point, works, then releases', () => {
      const point = { x: 4, y: 14, facing: 'down', behavior: 'work' };
      const agent = 'weebo';

      // Reserve
      expect(reservePoint(point.x, point.y, agent)).toBe(true);
      expect(isPointOccupied(point.x, point.y)).toBe(true);

      // Work (point remains occupied)
      expect(getOccupant(point.x, point.y)).toBe(agent);

      // Release
      releasePoint(agent);
      expect(isPointOccupied(point.x, point.y)).toBe(false);
    });

    it('multiple agents cycle through shared points', () => {
      const points = createTestPoints();
      const agents = ['weebo', 'edith', 'jarvis'];

      // Round 1: Each agent claims first available
      agents.forEach((agent, idx) => {
        const point = points[idx];
        expect(reservePoint(point.x, point.y, agent)).toBe(true);
      });

      // All claimed
      expect(getReservationCount()).toBe(3);

      // First agent releases
      releasePoint(agents[0]);
      expect(getReservationCount()).toBe(2);

      // New agent can claim released point
      expect(reservePoint(points[0].x, points[0].y, 'aria')).toBe(true);
    });

    it('tracks concurrent multi-point occupancy', () => {
      const agent1 = 'weebo';
      const agent2 = 'edith';

      // Agent 1 claims 2 points
      reservePoint(4, 14, agent1);
      reservePoint(4, 15, agent1);
      expect(getReservationCount()).toBe(2);

      // Agent 2 claims different point
      reservePoint(8, 4, agent2);
      expect(getReservationCount()).toBe(3);

      // Agent 1 releases all
      releasePoint(agent1);
      expect(getReservationCount()).toBe(1);
      expect(getOccupant(8, 4)).toBe(agent2);
    });
  });
});
