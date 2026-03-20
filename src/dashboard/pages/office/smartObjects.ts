// src/dashboard/pages/office/smartObjects.ts
// Smart objects: furniture with blocked footprints + interaction points.
// All interaction point coordinates verified walkable against COLLISION_MAP.

import type { RoomType } from './roomZones';

export interface InteractionPoint {
  x: number;
  y: number;
  facing: 'down' | 'up' | 'left' | 'right';
  behavior:
    | 'work'
    | 'coffee'
    | 'chat'
    | 'observe'
    | 'relax'
    | 'browse'
    | 'present'
    | 'collaborate';
}

export interface SmartObject {
  id: string;
  type: string;
  room: RoomType;
  label: string;
  footprint: Array<{ x: number; y: number }>; // blocked tiles (the object body)
  interactionPoints: InteractionPoint[]; // where agents stand to USE the object
  maxOccupants: number;
}

// All interaction points verified walkable against COLLISION_MAP[y][x] === false
export const SMART_OBJECTS: SmartObject[] = [
  // === WORKSPACE ===
  {
    id: 'desk-cluster-left',
    type: 'desk',
    room: 'workspace',
    label: 'Left Desks',
    footprint: [
      { x: 2, y: 17 }, { x: 3, y: 17 }, { x: 4, y: 17 }, { x: 5, y: 17 }, { x: 6, y: 17 },
      { x: 2, y: 18 }, { x: 3, y: 18 }, { x: 4, y: 18 }, { x: 5, y: 18 }, { x: 6, y: 18 },
      { x: 2, y: 19 }, { x: 3, y: 19 }, { x: 4, y: 19 }, { x: 5, y: 19 }, { x: 6, y: 19 },
      { x: 2, y: 20 }, { x: 3, y: 20 }, { x: 4, y: 20 }, { x: 5, y: 20 }, { x: 6, y: 20 },
    ],
    interactionPoints: [
      { x: 4, y: 14, facing: 'down', behavior: 'work' },
      { x: 4, y: 15, facing: 'down', behavior: 'work' },
      { x: 1, y: 18, facing: 'right', behavior: 'work' },
      { x: 7, y: 18, facing: 'left', behavior: 'work' },
      { x: 4, y: 21, facing: 'up', behavior: 'work' },
    ],
    maxOccupants: 4,
  },
  {
    id: 'desk-cluster-right',
    type: 'desk',
    room: 'workspace',
    label: 'Right Desks',
    footprint: [
      { x: 8, y: 17 }, { x: 9, y: 17 }, { x: 10, y: 17 }, { x: 11, y: 17 }, { x: 12, y: 17 },
      { x: 8, y: 18 }, { x: 9, y: 18 }, { x: 10, y: 18 }, { x: 11, y: 18 }, { x: 12, y: 18 },
      { x: 8, y: 19 }, { x: 9, y: 19 }, { x: 10, y: 19 }, { x: 11, y: 19 }, { x: 12, y: 19 },
      { x: 8, y: 20 }, { x: 9, y: 20 }, { x: 10, y: 20 }, { x: 11, y: 20 }, { x: 12, y: 20 },
    ],
    interactionPoints: [
      { x: 8, y: 14, facing: 'down', behavior: 'work' },
      { x: 12, y: 14, facing: 'down', behavior: 'work' },
      { x: 7, y: 16, facing: 'right', behavior: 'work' },
      { x: 13, y: 18, facing: 'left', behavior: 'work' },
      { x: 10, y: 21, facing: 'up', behavior: 'work' },
    ],
    maxOccupants: 4,
  },

  // === PANTRY ===
  {
    id: 'coffee-counter',
    type: 'appliance',
    room: 'pantry',
    label: 'Coffee',
    footprint: [
      { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 },
    ],
    interactionPoints: [
      { x: 8, y: 4, facing: 'up', behavior: 'coffee' },
      { x: 9, y: 4, facing: 'up', behavior: 'coffee' },
    ],
    maxOccupants: 2,
  },

  // === LOUNGE ===
  {
    id: 'couch',
    type: 'seating',
    room: 'lounge',
    label: 'Couch',
    footprint: [
      { x: 16, y: 2 }, { x: 17, y: 2 }, { x: 18, y: 2 }, { x: 19, y: 2 }, { x: 20, y: 2 },
    ],
    interactionPoints: [
      { x: 17, y: 4, facing: 'up', behavior: 'relax' },
      { x: 19, y: 4, facing: 'up', behavior: 'chat' },
      { x: 19, y: 5, facing: 'up', behavior: 'relax' },
    ],
    maxOccupants: 3,
  },
  {
    id: 'lounge-table',
    type: 'table',
    room: 'lounge',
    label: 'Round Table',
    footprint: [{ x: 22, y: 4 }, { x: 23, y: 4 }],
    interactionPoints: [
      { x: 21, y: 4, facing: 'up', behavior: 'chat' },
      { x: 24, y: 4, facing: 'up', behavior: 'chat' },
    ],
    maxOccupants: 2,
  },

  // === MEETING ROOM ===
  {
    id: 'meeting-table',
    type: 'table',
    room: 'meeting_room',
    label: 'Meeting Table',
    footprint: [
      { x: 19, y: 15 }, { x: 20, y: 15 }, { x: 21, y: 15 }, { x: 22, y: 15 }, { x: 23, y: 15 },
      { x: 19, y: 16 }, { x: 20, y: 16 }, { x: 21, y: 16 }, { x: 22, y: 16 }, { x: 23, y: 16 },
      { x: 19, y: 17 }, { x: 20, y: 17 }, { x: 21, y: 17 }, { x: 22, y: 17 }, { x: 23, y: 17 },
    ],
    interactionPoints: [
      { x: 17, y: 15, facing: 'right', behavior: 'collaborate' },
      { x: 17, y: 17, facing: 'right', behavior: 'collaborate' },
      { x: 24, y: 15, facing: 'left', behavior: 'collaborate' },
      { x: 24, y: 17, facing: 'left', behavior: 'collaborate' },
      { x: 21, y: 14, facing: 'down', behavior: 'present' },
      { x: 21, y: 19, facing: 'up', behavior: 'collaborate' },
    ],
    maxOccupants: 6,
  },
  {
    id: 'whiteboard',
    type: 'display',
    room: 'meeting_room',
    label: 'Whiteboard',
    footprint: [{ x: 25, y: 14 }, { x: 25, y: 15 }],
    interactionPoints: [
      { x: 24, y: 14, facing: 'right', behavior: 'present' },
      { x: 24, y: 15, facing: 'right', behavior: 'observe' },
    ],
    maxOccupants: 2,
  },

  // === PATIO ===
  {
    id: 'patio-seating-left',
    type: 'seating',
    room: 'patio',
    label: 'Patio Table Left',
    footprint: [{ x: 2, y: 3 }, { x: 3, y: 3 }],
    interactionPoints: [
      { x: 1, y: 4, facing: 'up', behavior: 'relax' },
      { x: 4, y: 4, facing: 'up', behavior: 'chat' },
    ],
    maxOccupants: 2,
  },
  {
    id: 'patio-seating-right',
    type: 'seating',
    room: 'patio',
    label: 'Patio Table Right',
    footprint: [{ x: 8, y: 3 }, { x: 9, y: 3 }],
    interactionPoints: [
      { x: 7, y: 4, facing: 'up', behavior: 'relax' },
      { x: 10, y: 4, facing: 'up', behavior: 'chat' },
    ],
    maxOccupants: 2,
  },

  // === LOUNGE EXTRAS ===
  {
    id: 'lounge-rug',
    type: 'seating',
    room: 'lounge',
    label: 'Rug & Coffee Table',
    footprint: [{ x: 18, y: 6 }, { x: 19, y: 6 }],
    interactionPoints: [
      { x: 17, y: 7, facing: 'right', behavior: 'chat' },
      { x: 19, y: 7, facing: 'up', behavior: 'relax' },
      { x: 21, y: 7, facing: 'left', behavior: 'relax' },
    ],
    maxOccupants: 3,
  },
  {
    id: 'lounge-bookshelf',
    type: 'furniture',
    room: 'lounge',
    label: 'Lounge Bookshelf',
    footprint: [{ x: 22, y: 5 }, { x: 23, y: 5 }, { x: 24, y: 5 }],
    interactionPoints: [
      { x: 22, y: 6, facing: 'up', behavior: 'browse' },
      { x: 24, y: 6, facing: 'up', behavior: 'browse' },
    ],
    maxOccupants: 2,
  },

  // === MEETING ROOM EXTRAS ===
  {
    id: 'meeting-tv',
    type: 'display',
    room: 'meeting_room',
    label: 'Presentation TV',
    footprint: [{ x: 20, y: 12 }, { x: 21, y: 12 }, { x: 22, y: 12 }],
    interactionPoints: [
      { x: 20, y: 13, facing: 'up', behavior: 'observe' },
      { x: 22, y: 13, facing: 'up', behavior: 'observe' },
    ],
    maxOccupants: 2,
  },

  // === STAIRWAY ===
  {
    id: 'bookshelf',
    type: 'furniture',
    room: 'stairs_transition',
    label: 'Bookshelf',
    footprint: [
      { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 },
      { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 },
    ],
    interactionPoints: [
      { x: 8, y: 8, facing: 'down', behavior: 'browse' },
      { x: 10, y: 8, facing: 'left', behavior: 'browse' },
    ],
    maxOccupants: 2,
  },

  // === HALLWAY ===
  {
    id: 'corridor-plant',
    type: 'decoration',
    room: 'stairs_transition',
    label: 'Hallway Plant',
    footprint: [],
    interactionPoints: [
      { x: 13, y: 8, facing: 'down', behavior: 'relax' },
      { x: 6, y: 11, facing: 'right', behavior: 'chat' },
    ],
    maxOccupants: 1,
  },
];

// Helpers
export function getObjectsInRoom(room: RoomType): SmartObject[] {
  return SMART_OBJECTS.filter((o) => o.room === room);
}

export function getObjectById(id: string): SmartObject | undefined {
  return SMART_OBJECTS.find((o) => o.id === id);
}

export function getAllInteractionPoints(): InteractionPoint[] {
  return SMART_OBJECTS.flatMap((o) => o.interactionPoints);
}

export function getInteractionPointsForBehavior(
  behavior: InteractionPoint['behavior'],
): Array<InteractionPoint & { objectId: string }> {
  const results: Array<InteractionPoint & { objectId: string }> = [];
  for (const obj of SMART_OBJECTS) {
    for (const ip of obj.interactionPoints) {
      if (ip.behavior === behavior) results.push({ ...ip, objectId: obj.id });
    }
  }
  return results;
}
