/**
 * @fileoverview Smooth movement interpolation helpers for the office canvas.
 *
 * Extracted from OfficeStage.tsx as part of GS-010 (movement-fix). These helpers
 * allow the behavior system to communicate movement semantics to the rendering layer
 * without the renderer hard-coding movement logic.
 *
 * **What this file provides:**
 *
 * 1. `isFinalPathStep(agent)` — Bug 2 fix (decel on every tile):
 *    Returns true only when the agent is on its LAST path step. The renderer (OfficeStage.tsx)
 *    should only apply arrival deceleration when this returns true, preventing the stuttery
 *    slow-down on every intermediate tile.
 *
 * 2. `PATH_STEP_ARRIVAL_THRESHOLD` — Bug 3 fix (path-step advance at 2px):
 *    The pixel distance at which an agent's grid position advances to the next path step.
 *    Tightened from 2px to 0.5px so renderX/Y reaches the tile center before the
 *    grid position jumps, eliminating the visual stutter on path-step advance.
 *
 * **Usage by Lane 2 (OfficeStage.tsx):**
 *
 * ```typescript
 * import { isFinalPathStep, PATH_STEP_ARRIVAL_THRESHOLD } from '../systems/behavior/smoothInterpolation';
 *
 * // Bug 3: tighten path-step advance threshold
 * if (distToStep < PATH_STEP_ARRIVAL_THRESHOLD) {
 *   updated.pathIndex = agent.pathIndex + 1;
 *   // ...
 * }
 *
 * // Bug 2: only decelerate on final step
 * if (dist < 32 && isFinalPathStep(agent)) {
 *   speed *= 0.5 + 0.5 * (dist / 32);
 * }
 * ```
 *
 * Lane 2 should rebase `ui/office-l1-movement` and update OfficeStage.tsx accordingly.
 */

import type { CanvasAgent } from "../../entities/types";

// ── Bug 3 fix: path-step advance threshold ───────────────────────────────────

/**
 * Distance threshold (pixels) at which an agent's discrete grid position advances
 * to the next path step.
 *
 * **Before (bug):** 2px — agent.x/y updated when renderX/Y is still up to 30px
 * behind, causing a visual stutter as the interpolation target jumps ahead.
 *
 * **After (fix):** 0.5px — renderX/Y reaches the tile center before the grid
 * position advances, so interpolation always targets a forward step.
 *
 * This constant should replace the hard-coded `< 2` check in OfficeStage.tsx.
 */
export const PATH_STEP_ARRIVAL_THRESHOLD = 0.5;

// ── Bug 2 fix: final path step detection ─────────────────────────────────────

/**
 * Returns true if the agent is currently on its final path step (i.e., the
 * next tile the agent will reach IS the destination).
 *
 * **Why this matters:**
 * The arrival deceleration (`if (dist < 32) speed *= 0.5 + ...`) should only
 * apply at the final destination tile, not at every intermediate step. Without
 * this guard, every tile transition causes a slow-down followed by speed-up,
 * producing the characteristic "stuttery march" at 3 tiles/sec.
 *
 * **Usage in OfficeStage.tsx:**
 * ```typescript
 * if (dist < 32 && isFinalPathStep(agent)) {
 *   speed *= 0.5 + 0.5 * (dist / 32); // smooth arrival decel at destination only
 * }
 * ```
 *
 * @param agent - The canvas agent to inspect (must have `.path` and `.pathIndex`).
 * @returns `true` if agent is at the last path step (or has no path), `false` if
 *   there are more steps after the current one.
 */
export function isFinalPathStep(agent: CanvasAgent): boolean {
	if (!agent.path || agent.path.length === 0) return true;
	// pathIndex points to the CURRENT step being interpolated toward.
	// Final step = pathIndex is at (path.length - 1).
	return agent.pathIndex >= agent.path.length - 1;
}
