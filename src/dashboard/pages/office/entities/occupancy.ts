// src/dashboard/pages/office/occupancy.ts
// Reservation system for interaction points.
// Tracks which interaction points are reserved by which agent.

import type { InteractionPoint } from './smartObjects';

// key="x,y" -> agentId
const reservations = new Map<string, string>();

/**
 * Reserves an interaction point at (x, y) for the given agent.
 * @param x - Tile x coordinate of the interaction point.
 * @param y - Tile y coordinate of the interaction point.
 * @param agentId - ID of the agent claiming the point.
 * @returns True if the reservation succeeded, false if the point is held by another agent.
 */
export function reservePoint(x: number, y: number, agentId: string): boolean {
  const key = `${x},${y}`;
  const current = reservations.get(key);
  if (current && current !== agentId) return false; // occupied by another
  reservations.set(key, agentId);
  return true;
}

/**
 * Releases all interaction points currently reserved by the given agent.
 * @param agentId - ID of the agent whose reservations should be freed.
 */
export function releasePoint(agentId: string): void {
  for (const [key, id] of reservations) {
    if (id === agentId) reservations.delete(key);
  }
}

/**
 * Clears all active reservations across all agents and interaction points.
 */
export function releaseAll(): void {
  reservations.clear();
}

/**
 * Returns true if the interaction point at (x, y) is currently reserved by any agent.
 * @param x - Tile x coordinate of the interaction point.
 * @param y - Tile y coordinate of the interaction point.
 * @returns True if the point has an active reservation.
 */
export function isPointOccupied(x: number, y: number): boolean {
  return reservations.has(`${x},${y}`);
}

/**
 * Returns the ID of the agent that has reserved the point at (x, y), if any.
 * @param x - Tile x coordinate of the interaction point.
 * @param y - Tile y coordinate of the interaction point.
 * @returns The occupying agent's ID, or undefined if the point is free.
 */
export function getOccupant(x: number, y: number): string | undefined {
  return reservations.get(`${x},${y}`);
}

/**
 * Returns the total number of currently active reservations.
 * @returns The count of reserved interaction points.
 */
export function getReservationCount(): number {
  return reservations.size;
}

/**
 * Finds the nearest available interaction point for an agent using Manhattan distance.
 * @param points - List of candidate interaction points to search.
 * @param agentId - ID of the requesting agent (points it already holds are considered available).
 * @param agentX - Current tile x position of the agent.
 * @param agentY - Current tile y position of the agent.
 * @returns The closest available interaction point, or null if all points are taken.
 */
// Find the nearest AVAILABLE interaction point from a list
export function findAvailablePoint(
  points: InteractionPoint[],
  agentId: string,
  agentX: number,
  agentY: number,
): InteractionPoint | null {
  let best: InteractionPoint | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    const key = `${p.x},${p.y}`;
    const occupant = reservations.get(key);
    if (occupant && occupant !== agentId) continue; // taken
    const dist = Math.abs(p.x - agentX) + Math.abs(p.y - agentY);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}
