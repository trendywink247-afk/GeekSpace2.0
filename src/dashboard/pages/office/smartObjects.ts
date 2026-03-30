/**
 * @fileoverview Smart Objects Module — Interactive furniture and fixtures for the office.
 *
 * Smart objects are furniture pieces with:
 * - **Footprint**: Tiles blocked by the furniture (agents cannot walk through)
 * - **Interaction Points**: Walkable tiles where agents stand to use the furniture
 * - **Behavior Type**: What agents do here (work, socialize, relax, etc.)
 *
 * All interaction points are verified walkable against COLLISION_MAP.
 * Use {@link findAvailablePoint} to reserve and claim interaction points.
 *
 * @example
 * ```typescript
 * const coffee = SMART_OBJECTS.find(obj => obj.id === 'coffee-counter');
 * const spot = findAvailablePoint(coffee.interactionPoints, agentId, agentX, agentY);
 * if (spot && reservePoint(spot.x, spot.y, agentId)) {
 *   agent.targetX = spot.x;
 *   agent.targetY = spot.y;
 * }
 * ```
 */

import type { RoomType } from './roomZones';

/**
 * A single point where an agent can stand to interact with a smart object.
 * Agents navigate to this point and perform the associated behavior.
 *
 * @property x - Tile column coordinate (0–26). **MUST be walkable** (verified against COLLISION_MAP).
 * @property y - Tile row coordinate (0–24). **MUST be walkable** (verified against COLLISION_MAP).
 * @property facing - Direction agent faces while interacting (affects sprite frame selection).
 * @property behavior - Activity type determining what agent does here and what phrases they speak.
 *
 * **Behavior Types:**
 * - `work` — Working at desk (typing animation)
 * - `coffee` — Getting coffee (social, "Need coffee!" phrases)
 * - `chat` — Socializing (facing another agent, exchanging greetings)
 * - `observe` — Watching/listening (at presentation or meeting)
 * - `relax` — Taking a break (lounge/couch, "Recharging..." phrases)
 * - `browse` — Reading/exploring (bookshelf, "Good read" phrases)
 * - `present` — Presenting/teaching (at whiteboard/meeting table)
 * - `collaborate` — Group discussion (meeting table, team phrases)
 */
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

/**
 * A smart object: interactive furniture with blocked tiles and interaction points.
 * Agents navigate to interaction points and reserve them via the occupancy system.
 *
 * @property id - Unique identifier (e.g., 'coffee-counter', 'meeting-table'). Used for lookups.
 * @property type - Furniture type (e.g., 'desk', 'seating', 'appliance', 'table', 'display'). Used for styling/visualization.
 * @property room - Room zone this object belongs to. Used for agent behavior hints.
 * @property label - Human-readable display name (e.g., "Coffee Machine", "Whiteboard").
 * @property footprint - Array of tiles blocked by this furniture. Agents cannot walk on these tiles.
 *   **NOTE:** Footprint tiles should NOT overlap with COLLISION_MAP (they become blocked by furniture).
 * @property interactionPoints - Walkable tiles where agents can stand to use this object.
 *   **CRITICAL:** All interaction point coordinates **MUST** satisfy `isWalkable(ip.x, ip.y) === true`.
 *   Verified at module load time via startup validation (non-blocking errors logged to console).
 * @property maxOccupants - Maximum agents that can use this object simultaneously.
 *   Used by occupancy system to enforce capacity limits.
 *
 * @example
 * ```typescript
 * {
 *   id: 'coffee-counter',
 *   type: 'appliance',
 *   room: 'pantry',
 *   label: 'Coffee Machine',
 *   footprint: [
 *     { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 },
 *   ],
 *   interactionPoints: [
 *     { x: 8, y: 4, facing: 'up', behavior: 'coffee' },
 *     { x: 9, y: 4, facing: 'up', behavior: 'coffee' },
 *   ],
 *   maxOccupants: 2,
 * }
 * ```
 */
export interface SmartObject {
  id: string;
  type: string;
  room: RoomType;
  label: string;
  footprint: Array<{ x: number; y: number }>;
  interactionPoints: InteractionPoint[];
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
      { x: 3, y: 16, facing: 'down', behavior: 'work' },
      { x: 5, y: 16, facing: 'down', behavior: 'work' },
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
      { x: 9, y: 16, facing: 'down', behavior: 'work' },
      { x: 11, y: 16, facing: 'down', behavior: 'work' },
      { x: 7, y: 17, facing: 'right', behavior: 'work' },
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
      { x: 21, y: 4, facing: 'right', behavior: 'chat' },
      { x: 24, y: 4, facing: 'left', behavior: 'chat' },
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
      { x: 1, y: 4, facing: 'right', behavior: 'relax' },
      { x: 4, y: 4, facing: 'left', behavior: 'chat' },
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
      { x: 7, y: 4, facing: 'right', behavior: 'relax' },
      { x: 10, y: 4, facing: 'left', behavior: 'chat' },
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
      { x: 19, y: 7, facing: 'down', behavior: 'relax' },
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

// ── Helpers & Queries ──────────────────────────────────────────────────────

/**
 * Retrieves all smart objects in a specific room zone.
 * Useful for determining what furniture agents can interact with in their current room.
 * @param room - The room zone ID to query.
 * @returns Array of SmartObjects in that room. Empty if no objects found.
 *
 * @example
 * ```typescript
 * const officeObjects = getObjectsInRoom('workspace');
 * // Returns: [desk-cluster-left, desk-cluster-right, ...]
 * ```
 */
export function getObjectsInRoom(room: RoomType): SmartObject[] {
  return SMART_OBJECTS.filter((o) => o.room === room);
}

/**
 * Looks up a single smart object by its unique ID.
 * Used when an agent has decided on a specific furniture piece to interact with.
 * @param id - The object ID to look up (e.g., 'coffee-counter', 'meeting-table').
 * @returns The matching SmartObject, or undefined if not found.
 *
 * @example
 * ```typescript
 * const couch = getObjectById('couch');
 * if (couch) {
 *   agent.targetX = couch.interactionPoints[0].x;
 *   agent.targetY = couch.interactionPoints[0].y;
 * }
 * ```
 */
export function getObjectById(id: string): SmartObject | undefined {
  return SMART_OBJECTS.find((o) => o.id === id);
}

/**
 * Retrieves all interaction points across all smart objects.
 * Useful for global queries (e.g., "where are all the coffee spots?").
 * @returns Flat array of all InteractionPoints from all SmartObjects.
 *
 * @example
 * ```typescript
 * const allPoints = getAllInteractionPoints();
 * const nearestPoint = allPoints.reduce((prev, curr) => {
 *   const currDist = Math.abs(curr.x - agent.x) + Math.abs(curr.y - agent.y);
 *   const prevDist = Math.abs(prev.x - agent.x) + Math.abs(prev.y - agent.y);
 *   return currDist < prevDist ? curr : prev;
 * });
 * ```
 */
export function getAllInteractionPoints(): InteractionPoint[] {
  return SMART_OBJECTS.flatMap((o) => o.interactionPoints);
}

/**
 * Filters interaction points by their behavior type.
 * Agents use this to find places where they can do a specific activity.
 * @param behavior - The behavior type to search for (e.g., 'coffee', 'relax', 'collaborate').
 * @returns Array of interaction points with matching behavior, each tagged with its parent object ID.
 *
 * @example
 * ```typescript
 * // Agent wants to take a break
 * const breakSpots = getInteractionPointsForBehavior('relax');
 * const randomBreakSpot = breakSpots[Math.floor(Math.random() * breakSpots.length)];
 *
 * // Or find coffee spots
 * const coffeeSpots = getInteractionPointsForBehavior('coffee');
 * ```
 */
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

// ── Adding New Smart Objects ───────────────────────────────────────────────
/**
 * @guide Adding a New Smart Object
 *
 * 1. **Define the object** in SMART_OBJECTS array:
 *    ```typescript
 *    {
 *      id: 'unique-id',                      // Must be unique
 *      type: 'furniture-type',               // desk, seating, appliance, table, display
 *      room: 'workspace',                    // See roomZones.ts for valid room IDs
 *      label: 'Display Name',                // Shown in UI
 *      footprint: [
 *        { x, y }, { x, y }, ...             // Tiles blocked by this furniture
 *      ],
 *      interactionPoints: [
 *        { x, y, facing: 'down', behavior: 'work' },
 *        { x, y, facing: 'up', behavior: 'work' },
 *      ],
 *      maxOccupants: 2,                      // How many agents can use it at once
 *    }
 *    ```
 *
 * 2. **Verify interaction points are walkable**:
 *    - Each IP coordinate (x, y) MUST satisfy: `isWalkable(x, y) === true`
 *    - If not, agents cannot reach the interaction point
 *    - Run startup validation: module logs errors for invalid IPs
 *
 * 3. **Update pixel-art images**:
 *    - Edit `/public/office/office_bg.webp` to add the furniture visual
 *    - Edit `/public/office/office_collision.webp` to mark footprint as blocked
 *      (alpha > 128 = blocked, alpha ≤ 128 = walkable)
 *    - Verify `collisionLoader.ts` parses your changes correctly
 *
 * 4. **Test**:
 *    - Verify object appears in office canvas
 *    - Verify agents can navigate to all interaction points
 *    - Check agent can interact (reserve point, perform behavior)
 *    - Verify speech bubbles show appropriate phrases (from `phrasesForBehavior`)
 *
 * @tip Interaction point facing should face the furniture (e.g., face 'up' if standing below it)
 * @tip Use `findAvailablePoint()` from occupancy.ts to reserve interaction points
 * @tip Check existing objects in SMART_OBJECTS for reference implementations
 */
