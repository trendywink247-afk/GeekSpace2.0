// src/dashboard/pages/office/navigation.ts
// Centralized navigation module — SINGLE source of truth for walkability.
// All other office code imports from here; never checks COLLISION_MAP directly.

import { COLLISION_MAP, CELL, COLS, ROWS } from './constants';

// ── Core validation ──────────────────────────────────────────────────────────

/** Returns true if the tile at (x, y) is walkable (not blocked, in bounds). */
export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return !COLLISION_MAP[y][x];
}

/** Returns true if the tile at (x, y) is blocked or out of bounds. */
export function isBlocked(x: number, y: number): boolean {
  return !isWalkable(x, y);
}

// ── Target validation ────────────────────────────────────────────────────────

/** Returns true if the position is a valid destination for an agent. */
export function isValidAgentTarget(x: number, y: number): boolean {
  return isWalkable(x, y);
}

// ── Nearest walkable tile ────────────────────────────────────────────────────

/**
 * Spirals outward from (x, y) to find the nearest walkable tile.
 * Returns the input position if already walkable.
 * Returns null if no walkable tile exists within 5 tiles.
 */
export function nearestWalkable(x: number, y: number): { x: number; y: number } | null {
  if (isWalkable(x, y)) return { x, y };

  for (let radius = 1; radius <= 5; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Only check the border of each radius ring
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (isWalkable(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

// ── Validate and clamp a target ──────────────────────────────────────────────

/**
 * If (x, y) is walkable, returns it. Otherwise finds the nearest walkable tile.
 * Falls back to (fallbackX, fallbackY) — typically the agent's home desk.
 */
export function validateTarget(
  x: number, y: number,
  fallbackX: number, fallbackY: number,
): { x: number; y: number } {
  if (isValidAgentTarget(x, y)) return { x, y };
  const nearest = nearestWalkable(x, y);
  if (nearest) return nearest;
  return { x: fallbackX, y: fallbackY };
}

// ── Walkable neighbors ───────────────────────────────────────────────────────

/** Returns all 4-directional walkable neighbors of a tile. */
export function getWalkableNeighbors(x: number, y: number): Array<{ x: number; y: number }> {
  const neighbors: Array<{ x: number; y: number }> = [];
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (isWalkable(nx, ny)) neighbors.push({ x: nx, y: ny });
  }
  return neighbors;
}

// ── Random walkable tile within radius ───────────────────────────────────────

/**
 * Tries random positions within `radius` tiles of (cx, cy).
 * Falls back to systematic scan if random attempts fail.
 * Returns null if nothing walkable exists in the area.
 */
export function randomWalkableInRadius(
  cx: number, cy: number,
  radius: number,
  maxAttempts = 20,
): { x: number; y: number } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const dx = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
    const dy = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
    const nx = cx + dx;
    const ny = cy + dy;
    if (isWalkable(nx, ny)) return { x: nx, y: ny };
  }

  // Fallback: systematic scan
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (isWalkable(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
    }
  }
  return null;
}

// ── BFS reachability check ───────────────────────────────────────────────────

/**
 * Returns true if a path exists from (fromX, fromY) to (toX, toY).
 * Both endpoints must be walkable. Uses standard BFS.
 */
export function isReachable(fromX: number, fromY: number, toX: number, toY: number): boolean {
  if (!isWalkable(fromX, fromY) || !isWalkable(toX, toY)) return false;
  if (fromX === toX && fromY === toY) return true;

  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: fromX, y: fromY }];
  visited.add(`${fromX},${fromY}`);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx === toX && ny === toY) return true;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && isWalkable(nx, ny)) {
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

// ── BFS next step ────────────────────────────────────────────────────────────

/**
 * BFS pathfinding: returns the first step from (sx, sy) toward (ex, ey).
 * Returns null if already at target or no path exists.
 */
export function bfsNextStep(
  sx: number, sy: number,
  ex: number, ey: number,
): { x: number; y: number } | null {
  if (sx === ex && sy === ey) return null;
  if (!isWalkable(ex, ey)) return null;

  const visited = new Set<string>();
  const queue: { x: number; y: number; firstX: number; firstY: number }[] = [];
  visited.add(`${sx},${sy}`);

  const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (const [ddx, ddy] of dirs) {
    const nx = sx + ddx;
    const ny = sy + ddy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
    if (COLLISION_MAP[ny][nx]) continue;
    const key = `${nx},${ny}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (nx === ex && ny === ey) return { x: nx, y: ny };
    queue.push({ x: nx, y: ny, firstX: nx, firstY: ny });
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [ddx, ddy] of dirs) {
      const nx = cur.x + ddx;
      const ny = cur.y + ddy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (COLLISION_MAP[ny][nx]) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (nx === ex && ny === ey) return { x: cur.firstX, y: cur.firstY };
      queue.push({ x: nx, y: ny, firstX: cur.firstX, firstY: cur.firstY });
    }
  }

  return null;
}

// ── Validate a spawn position ────────────────────────────────────────────────

/**
 * Validates and corrects an agent's spawn position.
 * Returns the original position if walkable, otherwise the nearest walkable tile.
 * Logs a warning if correction was needed.
 */
export function validateSpawnPosition(
  agentId: string,
  x: number, y: number,
): { x: number; y: number; renderX: number; renderY: number } {
  if (isWalkable(x, y)) {
    return { x, y, renderX: x * CELL + CELL / 2, renderY: y * CELL + CELL / 2 };
  }

  const valid = nearestWalkable(x, y);
  if (valid) {
    logInvalidTarget('spawn/' + agentId, x, y);
    return {
      x: valid.x,
      y: valid.y,
      renderX: valid.x * CELL + CELL / 2,
      renderY: valid.y * CELL + CELL / 2,
    };
  }

  // Should never happen with a valid map, but fallback to center of map
  logInvalidTarget('spawn/' + agentId + ' (no nearby walkable)', x, y);
  return { x, y, renderX: x * CELL + CELL / 2, renderY: y * CELL + CELL / 2 };
}

// ── Debug logging ────────────────────────────────────────────────────────────

/** Logs a warning when a target is invalid (blocked tile). */
export function logInvalidTarget(context: string, x: number, y: number): void {
  if (typeof console !== 'undefined') {
    console.warn(`[Navigation] Invalid target in ${context}: (${x},${y}) is blocked`);
  }
}
