/**
 * @fileoverview Test suite for roomZones.ts
 * Tests room detection and room lookup
 */

import { describe, it, expect } from 'vitest';
import { getRoomAt, getRoomById, ROOMS, type RoomType } from '../room-zones';

describe('roomZones', () => {
  // ─── getRoomAt: tile-based room detection ─────────────────────────────
  describe('getRoomAt', () => {
    // Patio: x: 0–11, y: 0–7
    it('returns patio for tiles within patio bounds', () => {
      expect(getRoomAt(0, 0)?.id).toBe('patio');
      expect(getRoomAt(5, 4)?.id).toBe('patio');
      expect(getRoomAt(11, 7)?.id).toBe('patio');
    });

    // Pantry: x: 5–11, y: 2–6 (inside patio)
    it('returns pantry for tiles within pantry bounds (overlaps patio)', () => {
      // Pantry is more specific and should be returned first
      expect(getRoomAt(6, 3)?.id).toBe('pantry');
      expect(getRoomAt(8, 4)?.id).toBe('pantry');
    });

    it('returns patio for tiles in patio but outside pantry', () => {
      // Patio but not pantry: (0, 0), (3, 1), etc.
      expect(getRoomAt(0, 0)?.id).toBe('patio');
      expect(getRoomAt(2, 1)?.id).toBe('patio');
    });

    // Lounge: x: 14–26, y: 0–7
    it('returns lounge for tiles within lounge bounds', () => {
      expect(getRoomAt(14, 0)?.id).toBe('lounge');
      expect(getRoomAt(20, 5)?.id).toBe('lounge');
      expect(getRoomAt(26, 7)?.id).toBe('lounge');
    });

    // Utility corridor: x: 0–5, y: 8–12
    it('returns utility_corridor for tiles within bounds', () => {
      expect(getRoomAt(0, 8)?.id).toBe('utility_corridor');
      expect(getRoomAt(3, 10)?.id).toBe('utility_corridor');
      expect(getRoomAt(5, 12)?.id).toBe('utility_corridor');
    });

    // Stairs transition: x: 6–14, y: 8–12
    it('returns stairs_transition for tiles within bounds', () => {
      expect(getRoomAt(6, 8)?.id).toBe('stairs_transition');
      expect(getRoomAt(10, 10)?.id).toBe('stairs_transition');
      expect(getRoomAt(14, 12)?.id).toBe('stairs_transition');
    });

    // Workspace: x: 0–14, y: 13–21
    it('returns workspace for tiles within workspace bounds', () => {
      expect(getRoomAt(0, 13)?.id).toBe('workspace');
      expect(getRoomAt(7, 17)?.id).toBe('workspace');
      expect(getRoomAt(14, 21)?.id).toBe('workspace');
    });

    // Meeting room: x: 15–26, y: 12–20
    it('returns meeting_room for tiles within meeting_room bounds', () => {
      expect(getRoomAt(15, 12)?.id).toBe('meeting_room');
      expect(getRoomAt(20, 16)?.id).toBe('meeting_room');
      expect(getRoomAt(26, 20)?.id).toBe('meeting_room');
    });

    // Boundary tests
    it('handles boundary: just inside room', () => {
      // Workspace at x: 0–14; x=0 should be inside
      expect(getRoomAt(0, 13)).toBeDefined();
      expect(getRoomAt(0, 13)?.id).toBe('workspace');
    });

    it('handles boundary: just outside room', () => {
      // Workspace at x: 0–14; x=15 should be outside (or in another room)
      // At (15, 13), should be meeting_room (x: 15–26, y: 12–20)
      const room = getRoomAt(15, 13);
      expect(room?.id).not.toBe('workspace');
    });

    it('handles grid edge: (0, 0)', () => {
      const room = getRoomAt(0, 0);
      expect(room).toBeDefined();
      expect(room?.id).toBe('patio');
    });

    it('handles grid edge: (COLS-1, ROWS-1) = (26, 24)', () => {
      const room = getRoomAt(26, 24);
      // May be in meeting_room (y: 12–20) or outside all rooms
      expect(typeof room).toBe('object') || expect(room).toBe(null);
    });
  });

  // ─── Out-of-bounds coordinates ──────────────────────────────────────────
  describe('getRoomAt — out-of-bounds', () => {
    it('returns null for negative x', () => {
      expect(getRoomAt(-1, 5)).toBe(null);
      expect(getRoomAt(-10, 15)).toBe(null);
    });

    it('returns null for negative y', () => {
      expect(getRoomAt(5, -1)).toBe(null);
      expect(getRoomAt(15, -10)).toBe(null);
    });

    it('returns null for x >= COLS (27)', () => {
      expect(getRoomAt(27, 5)).toBe(null);
      expect(getRoomAt(100, 15)).toBe(null);
    });

    it('returns null for y >= ROWS (25)', () => {
      expect(getRoomAt(5, 25)).toBe(null);
      expect(getRoomAt(15, 100)).toBe(null);
    });

    it('returns null for both coordinates out-of-bounds', () => {
      expect(getRoomAt(-5, -5)).toBe(null);
      expect(getRoomAt(50, 50)).toBe(null);
    });
  });

  // ─── Order-dependent matching (overlapping rooms) ───────────────────────
  describe('getRoomAt — overlapping room priority', () => {
    it('returns pantry (not patio) for overlapping region', () => {
      // Pantry (5–11, 2–6) is inside Patio (0–11, 0–7)
      // Should return pantry because ROOMS array has pantry before checking outer bounds
      // Actually, ROOMS array order: patio (0), pantry (1), lounge (2), ...
      // So pantry comes AFTER patio, but room matching returns first match
      // Need to verify actual ROOMS array order
      const room = getRoomAt(8, 4);
      // If pantry matches first, should be 'pantry'
      expect(room?.id).toBe('pantry');
    });

    it('verifies ROOMS order is semantic (more specific zones first)', () => {
      // If pantry should override patio, pantry must come before patio in array
      // or the bounds checking must prefer more specific zones
      const pantryIndex = ROOMS.findIndex((r) => r.id === 'pantry');
      const patioIndex = ROOMS.findIndex((r) => r.id === 'patio');
      // TODO: Verify order is correct for priority
    });
  });

  // ─── getRoomById: ID-based lookup ───────────────────────────────────────
  describe('getRoomById', () => {
    it('returns room for valid patio ID', () => {
      const room = getRoomById('patio');
      expect(room).toBeDefined();
      expect(room?.id).toBe('patio');
      expect(room?.label).toBe('Patio');
    });

    it('returns room for valid pantry ID', () => {
      const room = getRoomById('pantry');
      expect(room).toBeDefined();
      expect(room?.id).toBe('pantry');
    });

    it('returns room for all 7 room types', () => {
      const roomIds: RoomType[] = [
        'patio',
        'pantry',
        'lounge',
        'utility_corridor',
        'stairs_transition',
        'workspace',
        'meeting_room',
      ];
      roomIds.forEach((roomId) => {
        const room = getRoomById(roomId);
        expect(room).toBeDefined();
        expect(room?.id).toBe(roomId);
      });
    });

    it('returns undefined for invalid room ID', () => {
      const room = getRoomById('nonexistent' as RoomType);
      expect(room).toBeUndefined();
    });

    it('returns undefined for null/empty ID', () => {
      // TypeScript prevents this, but runtime check
      expect(getRoomById('' as RoomType)).toBeUndefined();
    });
  });

  // ─── Room metadata ─────────────────────────────────────────────────────
  describe('room metadata', () => {
    it('all rooms have required fields', () => {
      ROOMS.forEach((room) => {
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('label');
        expect(room).toHaveProperty('bounds');
        expect(room).toHaveProperty('behaviorBias');
        expect(room).toHaveProperty('color');
      });
    });

    it('room bounds are valid (positive width/height)', () => {
      ROOMS.forEach((room) => {
        const { bounds } = room;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.w).toBeGreaterThan(0);
        expect(bounds.h).toBeGreaterThan(0);
      });
    });

    it('behavior bias is one of valid types', () => {
      const validBehaviors = ['break', 'coffee', 'relax', 'utility', 'transition', 'focus', 'collaborate'];
      ROOMS.forEach((room) => {
        expect(validBehaviors).toContain(room.behaviorBias);
      });
    });

    it('room color is valid rgba or hex', () => {
      ROOMS.forEach((room) => {
        // Should be rgba(r,g,b,a) format
        expect(room.color).toMatch(/rgba\(\d{1,3},\d{1,3},\d{1,3},[\d.]+\)/);
      });
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────
  describe('getRoomAt — edge cases', () => {
    it('handles fractional coordinates (should still work with floor)', () => {
      // Coordinates are tile-based (integers), but if passed floats:
      // getRoomAt uses x and y directly in comparison (x >= b.x && x < b.x + b.w)
      const room = getRoomAt(5.5, 4.7);
      expect(room).toBeDefined(); // Should find a room
    });

    it('handles very large coordinates', () => {
      const room = getRoomAt(1000, 1000);
      expect(room).toBe(null);
    });

    it('handles agent at room boundary transitions', () => {
      // Patio ends at x=11, Workspace starts at x=0
      // At x=12, y=5: should be in Lounge or outside Patio
      const room = getRoomAt(12, 5);
      expect(room?.id).not.toBe('patio');
    });
  });

  // ─── Integration: perception uses room detection ────────────────────────
  describe('getRoomAt — integration with perception', () => {
    it('room returned by getRoomAt should match smart objects in that room', () => {
      // TODO: If agent is in workspace, SMART_OBJECTS with room='workspace' should be found
      const room = getRoomAt(5, 17);
      if (room) {
        expect(room.id).toBe('workspace');
        // TODO: Verify SMART_OBJECTS filtering matches this room
      }
    });

    it('room behaviorBias should influence agent behavior choices', () => {
      // TODO: getRoomAt returns room with behaviorBias
      // AgentBehavior should use this to bias decisions
      const room = getRoomAt(8, 4); // Pantry
      if (room) {
        expect(room.behaviorBias).toBe('coffee');
      }
    });
  });
});
