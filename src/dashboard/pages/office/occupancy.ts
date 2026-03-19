// src/dashboard/pages/office/occupancy.ts
// Reservation system for interaction points.
// Tracks which interaction points are reserved by which agent.

import type { InteractionPoint } from './smartObjects';

// key="x,y" -> agentId
const reservations = new Map<string, string>();

export function reservePoint(x: number, y: number, agentId: string): boolean {
  const key = `${x},${y}`;
  const current = reservations.get(key);
  if (current && current !== agentId) return false; // occupied by another
  reservations.set(key, agentId);
  return true;
}

export function releasePoint(agentId: string): void {
  for (const [key, id] of reservations) {
    if (id === agentId) reservations.delete(key);
  }
}

export function releaseAll(): void {
  reservations.clear();
}

export function isPointOccupied(x: number, y: number): boolean {
  return reservations.has(`${x},${y}`);
}

export function getOccupant(x: number, y: number): string | undefined {
  return reservations.get(`${x},${y}`);
}

export function getReservationCount(): number {
  return reservations.size;
}

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
