// src/dashboard/pages/office/roomZones.ts
// Room zone definitions for the office.
// Each room has bounds (tile rectangles) and properties.

export type RoomType =
  | 'patio'
  | 'pantry'
  | 'lounge'
  | 'utility_corridor'
  | 'stairs_transition'
  | 'workspace'
  | 'meeting_room';

/**
 * Defines a named region of the office map with spatial bounds and agent behavior hints.
 */
export interface RoomZone {
  id: RoomType;
  label: string;
  bounds: { x: number; y: number; w: number; h: number };
  behaviorBias:
    | 'break'
    | 'coffee'
    | 'relax'
    | 'utility'
    | 'transition'
    | 'focus'
    | 'collaborate';
  color: string; // for debug overlay
}

export const ROOMS: RoomZone[] = [
  {
    id: 'patio',
    label: 'Patio',
    bounds: { x: 0, y: 0, w: 12, h: 8 },
    behaviorBias: 'break',
    color: 'rgba(76,175,80,0.15)',
  },
  {
    id: 'pantry',
    label: 'Pantry',
    bounds: { x: 5, y: 2, w: 7, h: 5 },
    behaviorBias: 'coffee',
    color: 'rgba(255,152,0,0.15)',
  },
  {
    id: 'lounge',
    label: 'Lounge',
    bounds: { x: 14, y: 0, w: 13, h: 8 },
    behaviorBias: 'relax',
    color: 'rgba(33,150,243,0.15)',
  },
  {
    id: 'utility_corridor',
    label: 'Utility',
    bounds: { x: 0, y: 8, w: 6, h: 5 },
    behaviorBias: 'utility',
    color: 'rgba(158,158,158,0.15)',
  },
  {
    id: 'stairs_transition',
    label: 'Stairs',
    bounds: { x: 6, y: 8, w: 9, h: 5 },
    behaviorBias: 'transition',
    color: 'rgba(121,85,72,0.15)',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    bounds: { x: 0, y: 13, w: 15, h: 9 },
    behaviorBias: 'focus',
    color: 'rgba(103,58,183,0.15)',
  },
  {
    id: 'meeting_room',
    label: 'Meeting Room',
    bounds: { x: 15, y: 12, w: 12, h: 9 },
    behaviorBias: 'collaborate',
    color: 'rgba(244,67,54,0.15)',
  },
];

/**
 * Returns the first room whose bounds contain the given tile coordinates.
 * @param x - Tile column index.
 * @param y - Tile row index.
 * @returns The matching RoomZone, or null if the tile belongs to no room.
 */
export function getRoomAt(x: number, y: number): RoomZone | null {
  for (const room of ROOMS) {
    const b = room.bounds;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return room;
  }
  return null;
}

/**
 * Looks up a room by its unique identifier.
 * @param id - The RoomType identifier to search for.
 * @returns The matching RoomZone, or undefined if not found.
 */
export function getRoomById(id: RoomType): RoomZone | undefined {
  return ROOMS.find((r) => r.id === id);
}
