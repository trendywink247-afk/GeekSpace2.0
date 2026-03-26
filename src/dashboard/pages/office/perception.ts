// src/dashboard/pages/office/perception.ts
// Lightweight local perception for each agent.

import type { CanvasAgent, AgentId } from './types';
import type { RoomZone } from './roomZones';
import type { SmartObject, InteractionPoint } from './smartObjects';
import { getRoomAt } from './roomZones';
import { getObjectsInRoom, SMART_OBJECTS } from './smartObjects';
import { isPointOccupied } from './occupancy';
import { isWalkable } from './navigation';

/**
 * A snapshot of everything an agent can sense about its immediate environment,
 * computed once per decision tick.
 */
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

/**
 * Builds a full perception snapshot for an agent at its current position.
 * @param agent - The agent whose environment is being sampled.
 * @param allAgents - All agents currently on the canvas (used for proximity checks).
 * @param recentWorkers - Set of agent IDs that worked during the most recent tick.
 * @returns An AgentPerception snapshot describing the agent's surroundings.
 */
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

  // Available interaction points across ALL objects (whole office is 27x25, small enough)
  const available: Array<
    InteractionPoint & { objectId: string; distance: number }
  > = [];
  for (const obj of SMART_OBJECTS) {
    for (const ip of obj.interactionPoints) {
      if (!isWalkable(ip.x, ip.y)) continue;
      if (isPointOccupied(ip.x, ip.y)) continue;
      const dist = Math.abs(ip.x - agent.x) + Math.abs(ip.y - agent.y);
      available.push({ ...ip, objectId: obj.id, distance: dist });
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
