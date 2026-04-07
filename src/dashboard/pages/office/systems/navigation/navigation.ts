// src/dashboard/pages/office/navigation.ts
// Centralized navigation module — SINGLE source of truth for walkability.
// All other office code imports from here; never checks COLLISION_MAP directly.

import { COLLISION_MAP, CELL, COLS, ROWS } from '../../constants';

// Re-export room lookup for convenience
export { getRoomAt } from '../../entities/roomZones';

// ── Core validation ──────────────────────────────────────────────────────────

/**
 * Returns true if the tile at (x, y) is walkable (in bounds and not blocked).
 * This is the single source of truth — all other modules call this instead of
 * reading COLLISION_MAP directly.
 * @param x - Tile column index (0–COLS-1).
 * @param y - Tile row index (0–ROWS-1).
 * @returns True if the tile is in bounds and passable.
 */
export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return !COLLISION_MAP[y][x];
}

/**
 * Returns true if the tile at (x, y) is blocked or out of bounds.
 * Inverse of `isWalkable`; use when the blocked-is-truthy semantic is clearer.
 * @param x - Tile column index.
 * @param y - Tile row index.
 * @returns True if the tile cannot be walked on.
 */
export function isBlocked(x: number, y: number): boolean {
  return !isWalkable(x, y);
}

// ── Target validation ────────────────────────────────────────────────────────

/**
 * Returns true if (x, y) is a valid movement destination for an agent.
 * Currently equivalent to `isWalkable`; kept as a semantic alias so callers
 * express intent ("can I go here?") rather than implementation detail.
 * @param x - Tile column index.
 * @param y - Tile row index.
 * @returns True if the tile is a legal agent destination.
 */
export function isValidAgentTarget(x: number, y: number): boolean {
  return isWalkable(x, y);
}

// ── Nearest walkable tile ────────────────────────────────────────────────────

/**
 * Spirals outward from (x, y) to find the nearest walkable tile.
 * Returns the input position if already walkable.
 * Returns null if no walkable tile exists within 5 tiles.
 * @param x - Starting tile column index.
 * @param y - Starting tile row index.
 * @returns The nearest walkable tile coordinate, or null if none found within radius 5.
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
 * @param x - Desired target tile column.
 * @param y - Desired target tile row.
 * @param fallbackX - Column to use if no walkable tile is found nearby.
 * @param fallbackY - Row to use if no walkable tile is found nearby.
 * @returns A guaranteed valid (or best-effort fallback) destination tile.
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

/**
 * Returns all 4-directional (N/S/E/W) walkable neighbors of a tile.
 * Used by BFS pathfinding to enumerate valid next steps.
 * @param x - Tile column index.
 * @param y - Tile row index.
 * @returns Array of adjacent walkable tile coordinates (0–4 entries).
 */
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
 * @param cx - Center tile column.
 * @param cy - Center tile row.
 * @param radius - Tile radius to search within.
 * @param maxAttempts - Number of random attempts before falling back to systematic scan (default 20).
 * @returns A walkable tile within `radius` of the center, or null if the area is fully blocked.
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
 * @param fromX - Source tile column.
 * @param fromY - Source tile row.
 * @param toX - Destination tile column.
 * @param toY - Destination tile row.
 * @returns True if a connected walkable path exists between the two tiles.
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

// ── Full BFS path ─────────────────────────────────────────────────────────────

/**
 * BFS pathfinding: returns the full path from (sx, sy) to (ex, ey).
 * Returns an empty array if already at target, target is unwalkable, or no path exists.
 * The returned path does NOT include the start position, only steps to take.
 *
 * Algorithm:
 * 1. Use a queue to explore tiles level-by-level (BFS guarantees shortest path)
 * 2. Store parent pointers in a visited Map for path reconstruction
 * 3. When target is found, backtrack through parents to build the path
 * 4. Return path in correct order (start → end)
 *
 * Time complexity: O(walkable_tiles) in worst case
 * Space complexity: O(walkable_tiles) for visited set and queue
 *
 * @example
 * ```typescript
 * const path = findFullPath(4, 14, 20, 13); // From left desk to meeting room
 * if (path.length > 0) {
 *   agent.path = path;
 *   agent.pathIndex = 0;
 * }
 * ```
 */
export function findFullPath(
  sx: number, sy: number,
  ex: number, ey: number,
): Array<{ x: number; y: number }> {
  if (sx === ex && sy === ey) return [];
  if (!isWalkable(ex, ey)) return [];

  // Map from "x,y" key to parent "x,y" key for path reconstruction
  const visited = new Map<string, string>();
  const queue: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
  const startKey = `${sx},${sy}`;
  visited.set(startKey, ''); // root has no parent

  // 4-directional movement (no diagonals)
  const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key) || !isWalkable(nx, ny)) continue; // already visited or blocked
      visited.set(key, `${cur.x},${cur.y}`); // record parent
      if (nx === ex && ny === ey) {
        // Target found! Reconstruct path by backtracking through parents
        const path: Array<{ x: number; y: number }> = [];
        let k = key;
        while (k && k !== startKey) {
          const [px, py] = k.split(',').map(Number);
          path.unshift({ x: px, y: py }); // unshift to build correct order
          k = visited.get(k) || ''; // move to parent
        }
        return path;
      }
      queue.push({ x: nx, y: ny }); // explore this tile in next iteration
    }
  }
  return []; // no path found
}

// ── BFS next step ────────────────────────────────────────────────────────────

/**
 * BFS pathfinding: returns the first step from (sx, sy) toward (ex, ey).
 * More efficient than `findFullPath` when only the immediate next move is needed.
 * Returns null if already at target or no path exists.
 * @param sx - Source tile column.
 * @param sy - Source tile row.
 * @param ex - Destination tile column.
 * @param ey - Destination tile row.
 * @returns The adjacent tile to step onto next, or null if at target / no path.
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
 * @param agentId - Agent identifier (used in the warning message).
 * @param x - Desired spawn tile column.
 * @param y - Desired spawn tile row.
 * @returns Grid coordinates plus pre-computed smooth pixel center for initial `renderX`/`renderY`.
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

/**
 * Logs a warning when a target is invalid (blocked tile).
 * @param context - Human-readable label identifying the call site (e.g. `'spawn/weebo'`).
 * @param x - The invalid tile column.
 * @param y - The invalid tile row.
 */
export function logInvalidTarget(context: string, x: number, y: number): void {
  if (typeof console !== 'undefined') {
    console.warn(`[Navigation] Invalid target in ${context}: (${x},${y}) is blocked`);
  }
}
