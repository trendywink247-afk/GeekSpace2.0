import type { AnimationTier } from './AnimationTierSelector';
import type { AgentId } from './types';
import { TIER_CINEMATIC_ZOOM_MS, TIER_CINEMATIC_HOLD_MS, TIER_CINEMATIC_PULLBACK_MS } from './constants';

/**
 * Mutable state object that drives canvas zoom, spotlight, and particle effects each frame.
 */
export interface CanvasEffectState {
  zoomTarget: { x: number; y: number } | null;
  zoomScale: number;
  zoomProgress: number;
  zoomPhase: 'none' | 'zoom_in' | 'hold' | 'zoom_out';
  spotlightAgent: AgentId | null;
  dimOpacity: number;
  particles: Array<{ x: number; y: number; vx: number; vy: number; alpha: number }>;
}

/**
 * Creates a fresh CanvasEffectState with default values and randomly placed particles.
 * @returns A new CanvasEffectState ready for use in a canvas render loop.
 */
export function createEffectState(): CanvasEffectState {
  return {
    zoomTarget: null, zoomScale: 1, zoomProgress: 0, zoomPhase: 'none',
    spotlightAgent: null, dimOpacity: 1,
    particles: Array.from({ length: 15 }, () => ({
      x: Math.random() * 864, y: Math.random() * 800,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.05,
    })),
  };
}

/**
 * Initiates a tier-appropriate visual effect on the canvas state for the given agent.
 * @param state - The mutable effect state to update.
 * @param tier - The animation tier determining the intensity of the effect.
 * @param agentPos - The canvas coordinates of the agent's desk to target.
 * @param agentId - The identifier of the agent receiving the spotlight.
 */
export function startTierEffect(state: CanvasEffectState, tier: AnimationTier, agentPos: { x: number; y: number }, agentId: AgentId): void {
  if (tier === 3) {
    state.zoomTarget = agentPos;
    state.zoomPhase = 'zoom_in';
    state.zoomProgress = 0;
    state.spotlightAgent = agentId;
    state.dimOpacity = 0.4;
  } else if (tier === 2) {
    state.spotlightAgent = agentId;
    state.dimOpacity = 0.7;
  }
  // Tier 1: no global effect
}

/**
 * Resets all zoom and spotlight properties on the effect state to their idle defaults.
 * @param state - The mutable effect state to reset.
 */
export function clearEffects(state: CanvasEffectState): void {
  state.zoomTarget = null;
  state.zoomScale = 1;
  state.zoomProgress = 0;
  state.zoomPhase = 'none';
  state.spotlightAgent = null;
  state.dimOpacity = 1;
}

/**
 * Advances zoom animation phases and particle positions by one time step.
 *
 * **Animation Timeline (Tier 3 cinematic effect):**
 * ```
 * Phase 1: zoom_in (600ms)
 *   Scale: 1.0 → 1.5 (easeOutCubic)
 *   Focus: agent position
 *
 * Phase 2: hold (2000ms)
 *   Scale: stays at 1.5
 *   Purpose: let user see zoomed-in agent
 *
 * Phase 3: zoom_out (400ms)
 *   Scale: 1.5 → 1.0 (easeOutCubic)
 *   Dim opacity: 0.4 → 1.0 (fade in background)
 *   Cleanup: reset spotlight and zoom target
 * ```
 *
 * **Particles:** Continuously bounce within canvas bounds with sine-wave opacity
 * for subtle visual interest. Alpha oscillates 0.02-0.05 independent of zoom phase.
 *
 * @param state - The mutable effect state to update in place.
 * @param dt - Elapsed time in milliseconds since the last tick.
 */
export function tickEffects(state: CanvasEffectState, dt: number): void {
  // ─── Zoom phase state machine ─────────────────────────────────────
  if (state.zoomPhase === 'zoom_in') {
    // Ramp up progress: 0 → 1 over TIER_CINEMATIC_ZOOM_MS (600ms)
    state.zoomProgress += dt / TIER_CINEMATIC_ZOOM_MS;
    // Easing curve: start fast, end slow (easeOutCubic smooths acceleration)
    // Scale range: 1.0 → 1.5 (clamped to 1 so progress overshooting doesn't zoom past 1.5)
    state.zoomScale = 1 + 0.5 * easeOutCubic(Math.min(state.zoomProgress, 1));
    // Transition: once zoom completes, move to hold phase
    if (state.zoomProgress >= 1) { state.zoomPhase = 'hold'; state.zoomProgress = 0; }
  } else if (state.zoomPhase === 'hold') {
    // Hold at 1.5× scale for visual impact; no progress animation
    state.zoomProgress += dt / TIER_CINEMATIC_HOLD_MS;
    // Transition: after hold duration (2000ms), start zoom-out
    if (state.zoomProgress >= 1) { state.zoomPhase = 'zoom_out'; state.zoomProgress = 0; }
  } else if (state.zoomPhase === 'zoom_out') {
    // Ramp down: 1.5 → 1.0 over TIER_CINEMATIC_PULLBACK_MS (400ms)
    state.zoomProgress += dt / TIER_CINEMATIC_PULLBACK_MS;
    // Inverse easing: start at max zoom (1.5), ease to normal (1.0)
    state.zoomScale = 1.5 - 0.5 * easeOutCubic(Math.min(state.zoomProgress, 1));
    // Fade in background as we zoom out: opacity goes 0.4 → 1.0 (returns to full brightness)
    state.dimOpacity = 0.4 + 0.6 * easeOutCubic(Math.min(state.zoomProgress, 1));
    // Transition: once zoom-out completes, reset to idle state
    if (state.zoomProgress >= 1) {
      state.zoomPhase = 'none'; state.zoomScale = 1; state.dimOpacity = 1;
      state.spotlightAgent = null; state.zoomTarget = null;
    }
  }

  // ─── Particle physics and animation ────────────────────────────────
  for (const p of state.particles) {
    // Move particle by velocity each frame
    p.x += p.vx; p.y += p.vy;
    // Bounce off canvas edges (reflect velocity along collision axis)
    if (p.x < 0 || p.x > 864) p.vx *= -1;
    if (p.y < 0 || p.y > 800) p.vy *= -1;
    // Animate alpha with sine wave: oscillates 0.02-0.05 based on position + time
    // Creates shimmer effect independent of zoom/spotlight phases
    // High frequency: Date.now() * 0.001 cycles ~60 times per second
    p.alpha = 0.02 + Math.sin(Date.now() * 0.001 + p.x) * 0.03;
  }
}

/**
 * Smooth easing function (cubic out).
 * Starts with fast acceleration, ends with deceleration.
 * Range: [0, 1] → [0, 1], always monotonic increasing.
 *
 * **Formula:** `1 - (1-t)³`
 *
 * Produces a natural-feeling motion curve:
 * - t=0 → y=0 (start)
 * - t=0.5 → y≈0.875 (progresses fast early)
 * - t=1 → y=1 (end)
 *
 * Useful for zoom animations where we want objects to feel like they're responding
 * to real-world physics (heavy on acceleration, light on deceleration).
 *
 * @param t - Progress value (0 = start, 1 = end)
 * @returns Eased value on [0, 1]
 */
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
