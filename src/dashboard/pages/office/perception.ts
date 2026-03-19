// src/dashboard/pages/office/perception.ts
// Lightweight local perception for each agent.

import type { CanvasAgent, AgentId } from './types';
import type { RoomZone } from './roomZones';
import type { SmartObject, InteractionPoint } from './smartObjects';
import { getRoomAt } from './roomZones';
import { getObjectsInRoom, SMART_OBJECTS } from './smartObjects';
import { isPointOccupied } from './occupancy';
import { isWalkable } from './navigation';

export interface AgentPerception {
  agent: CanvasAgent;
  currentRoom: RoomZone | null;
  nearbyAgents: Array<{ agent: CanvasAgent; distance: number }>;
  nearbyObjects: SmartObject[];
  availableInteractionPoints: Array<
    InteractionPoint & { objectId: string; distance: number }
  >;
  isAtDesk: boolean;
  recentlyWorked: boolean;
}

export function perceive(
  agent: CanvasAgent,
  allAgents: CanvasAgent[],
  recentWorkers: Set<AgentId>,
): AgentPerception {
  const room = getRoomAt(agent.x, agent.y);

  // Nearby agents (within 5 tiles manhattan distance)
  const nearbyAgents = allAgents
    .filter((a) => a.id !== agent.id)
    .map((a) => ({
      agent: a,
      distance: Math.abs(a.x - agent.x) + Math.abs(a.y - agent.y),
    }))
    .filter((a) => a.distance <= 5)
    .sort((a, b) => a.distance - b.distance);

  // Objects in current room
  const nearbyObjects = room ? getObjectsInRoom(room.id) : [];

  // Available interaction points across all objects (within 12 tiles)
  const available: Array<
    InteractionPoint & { objectId: string; distance: number }
  > = [];
  for (const obj of SMART_OBJECTS) {
    for (const ip of obj.interactionPoints) {
      if (!isWalkable(ip.x, ip.y)) continue;
      if (isPointOccupied(ip.x, ip.y)) continue;
      const dist = Math.abs(ip.x - agent.x) + Math.abs(ip.y - agent.y);
      if (dist <= 12) {
        available.push({ ...ip, objectId: obj.id, distance: dist });
      }
    }
  }
  available.sort((a, b) => a.distance - b.distance);

  // Is agent at their desk?
  const isAtDesk =
    agent.state === 'idle' &&
    (agent.path.length === 0 || agent.pathIndex >= agent.path.length);

  return {
    agent,
    currentRoom: room,
    nearbyAgents,
    nearbyObjects,
    availableInteractionPoints: available,
    isAtDesk,
    recentlyWorked: recentWorkers.has(agent.id),
  };
}
