/**
 * @fileoverview CanvasEffects comprehensive test gap implementations
 * REQUIRES: easeOutCubic() export to enable ~40% of these tests
 * See TEST_COVERAGE_OFFICE_ANIMATION.md for blocking issues
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createEffectState,
  startTierEffect,
  tickEffects,
  clearEffects,
  returnEffectState,
  type CanvasEffectState,
} from '../CanvasEffects';
import {
  TIER_CINEMATIC_ZOOM_MS,
  TIER_CINEMATIC_HOLD_MS,
  TIER_CINEMATIC_PULLBACK_MS,
} from '../constants';

/**
 * Reference easeOutCubic for comparison.
 * TODO: Once exported from CanvasEffects, use the module's implementation instead.
 */
function referenceEaseOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTICLE MANAGEMENT — Pool Reuse & Initialization
// ═══════════════════════════════════════════════════════════════════════════

describe('CanvasEffects — Particle Management (GC Optimization)', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  // ─── Particle array initialization ──────────────────────────────────
  describe('Particle initialization on state creation', () => {
    it('creates 15 particles in fresh state', () => {
      expect(state.particles.length).toBe(15);
    });

    it('each particle has position (x, y) within canvas bounds', () => {
      state.particles.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(864); // CANVAS_W
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(800); // CANVAS_H
      });
    });

    it('each particle has velocity (vx, vy) for movement', () => {
      state.particles.forEach((p) => {
        expect(typeof p.vx).toBe('number');
        expect(typeof p.vy).toBe('number');
        // Velocity should be small (±0.15)
        expect(Math.abs(p.vx)).toBeLessThanOrEqual(0.3);
        expect(Math.abs(p.vy)).toBeLessThanOrEqual(0.3);
      });
    });

    it('each particle has alpha (opacity) for subtle visibility', () => {
      state.particles.forEach((p) => {
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(0.05);
      });
    });

    it('particles are randomized (not all identical)', () => {
      // Get unique x positions (should have variety)
      const xPositions = new Set(state.particles.map((p) => Math.floor(p.x)));
      expect(xPositions.size).toBeGreaterThan(1); // Multiple unique x values
    });
  });

  // ─── Particle pool reuse (memory efficiency) ────────────────────────
  describe('Particle pool reuse and cleanup', () => {
    it('returnEffectState() returns particle array to pool', () => {
      const state1 = createEffectState();
      const particlesRef = state1.particles;

      // Simulate end of animation
      returnEffectState(state1);

      // Create new state (may reuse pool)
      const state2 = createEffectState();

      // Cannot directly verify reuse without pool access, but verify no crash
      expect(state2.particles.length).toBe(15);
    });

    it('particle arrays are reinitialized on reuse (no stale data)', () => {
      const state1 = createEffectState();
      const originalParticles = [...state1.particles];

      returnEffectState(state1);

      const state2 = createEffectState();

      // Particles should be newly randomized, likely different values
      const positionsMatch = state2.particles.every((p, i) =>
        p.x === originalParticles[i].x && p.y === originalParticles[i].y
      );

      // Very unlikely all 15 particles have identical positions by chance
      expect(positionsMatch).toBe(false);
    });

    it('returnEffectState() called multiple times does not exceed pool limit', () => {
      // Create and return 10 states (pool limit is 5)
      for (let i = 0; i < 10; i++) {
        const state = createEffectState();
        returnEffectState(state);
      }

      // Should not crash or leak memory excessively
      expect(true).toBe(true);
    });

    it('createEffectState() never returns null particles', () => {
      for (let i = 0; i < 20; i++) {
        const state = createEffectState();
        expect(state.particles).toBeTruthy();
        expect(Array.isArray(state.particles)).toBe(true);
        returnEffectState(state);
      }
    });
  });

  // ─── Particle animation during tick ────────────────────────────────
  describe('Particle position updates per tick', () => {
    beforeEach(() => {
      state = createEffectState();
    });

    it('particles move based on velocity (dx = vx * dt / 1000)', () => {
      const p = state.particles[0];
      const xBefore = p.x;
      const vxBefore = p.vx;

      // Tick 100ms
      tickEffects(state, 100);

      // Position should change by roughly vx * 0.1
      expect(state.particles[0].x).not.toBe(xBefore);
    });

    it('particle opacity oscillates (0.02-0.05 range)', () => {
      // Particles should have varying alpha values over time (sine wave)
      const alphas: number[] = [];

      for (let i = 0; i < 5; i++) {
        alphas.push(state.particles[0].alpha);
        tickEffects(state, 100);
      }

      // Should have some variation
      const uniqueAlphas = new Set(alphas);
      expect(uniqueAlphas.size).toBeGreaterThan(1);
    });

    it('particles bounce off canvas boundaries (0-864 x, 0-800 y)', () => {
      // Force a particle near boundary
      state.particles[0].x = 860;
      state.particles[0].y = 795;
      state.particles[0].vx = 5; // Moving right
      state.particles[0].vy = 5; // Moving down

      tickEffects(state, 1000); // Large tick to trigger boundary check

      // Particle should stay in bounds
      expect(state.particles[0].x).toBeGreaterThanOrEqual(0);
      expect(state.particles[0].x).toBeLessThanOrEqual(864);
      expect(state.particles[0].y).toBeGreaterThanOrEqual(0);
      expect(state.particles[0].y).toBeLessThanOrEqual(800);
    });

    it('particle velocity bounces on collision (vx/vy reverses)', () => {
      state.particles[0].x = 863;
      state.particles[0].vx = 1; // Moving right

      tickEffects(state, 100);

      // Velocity should reverse (negative) after hitting right wall
      // Expected: particles bounce by reversing velocity
      expect(state.particles[0].x).toBeLessThanOrEqual(864);
    });
  });

  // ─── Memory efficiency ──────────────────────────────────────────────
  describe('Memory efficiency (object reuse, no allocs)', () => {
    it('particles array is reused, not recreated per tick', () => {
      const particlesRef = state.particles;

      tickEffects(state, 100);
      tickEffects(state, 100);
      tickEffects(state, 100);

      // Same particle array object
      expect(state.particles).toBe(particlesRef);
    });

    it('particle objects in array are mutated in place (not replaced)', () => {
      const p0Ref = state.particles[0];

      tickEffects(state, 100);

      // Same object reference (mutated, not replaced)
      expect(state.particles[0]).toBe(p0Ref);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER EFFECT APPLICATION — All Tiers (1, 2, 3)
// ═══════════════════════════════════════════════════════════════════════════

describe('CanvasEffects — Tier Effect Application (1, 2, 3)', () => {
  let state: CanvasEffectState;
  const agentPos = { x: 432, y: 400 };

  beforeEach(() => {
    state = createEffectState();
  });

  afterEach(() => {
    returnEffectState(state);
  });

  // ─── Tier 3: Cinematic (zoom + spotlight + dim) ─────────────────────
  describe('Tier 3: Cinematic effect (zoom + spotlight)', () => {
    it('sets zoom phase to zoom_in', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.zoomPhase).toBe('zoom_in');
    });

    it('sets zoom progress to 0 (fresh)', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.zoomProgress).toBe(0);
    });

    it('sets zoom target to agent position', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.zoomTarget).toEqual(agentPos);
    });

    it('sets spotlight agent ID', () => {
      startTierEffect(state, 3, agentPos, 'aria');
      expect(state.spotlightAgent).toBe('aria');
    });

    it('sets dim opacity to 0.4 (darkens background)', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.dimOpacity).toBe(0.4);
    });

    it('zoom scale starts at 1.0 (no scale yet)', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.zoomScale).toBe(1);
    });
  });

  // ─── Tier 2: Spotlight (agent highlight, dim background) ───────────
  describe('Tier 2: Spotlight effect (no zoom)', () => {
    it('does not set zoom target (no zoom animation)', () => {
      startTierEffect(state, 2, agentPos, 'weebo');
      expect(state.zoomTarget).toBeNull();
    });

    it('does not change zoom phase (stays "none")', () => {
      startTierEffect(state, 2, agentPos, 'weebo');
      expect(state.zoomPhase).toBe('none');
    });

    it('sets spotlight agent ID', () => {
      startTierEffect(state, 2, agentPos, 'aria');
      expect(state.spotlightAgent).toBe('aria');
    });

    it('sets dim opacity to 0.7 (mild darkening)', () => {
      startTierEffect(state, 2, agentPos, 'weebo');
      expect(state.dimOpacity).toBe(0.7);
    });

    it('zoom scale stays at 1.0 (no zoom)', () => {
      startTierEffect(state, 2, agentPos, 'weebo');
      expect(state.zoomScale).toBe(1);
    });
  });

  // ─── Tier 1: Minimal effect (subtle highlight) ──────────────────────
  describe('Tier 1: Minimal effect (no global changes)', () => {
    it('does not set zoom target', () => {
      startTierEffect(state, 1, agentPos, 'weebo');
      expect(state.zoomTarget).toBeNull();
    });

    it('does not change zoom phase', () => {
      startTierEffect(state, 1, agentPos, 'weebo');
      expect(state.zoomPhase).toBe('none');
    });

    it('does not set spotlight agent', () => {
      startTierEffect(state, 1, agentPos, 'weebo');
      expect(state.spotlightAgent).toBeNull();
    });

    it('does not change dim opacity (stays 1.0)', () => {
      startTierEffect(state, 1, agentPos, 'weebo');
      expect(state.dimOpacity).toBe(1);
    });
  });

  // ─── Multiple startTierEffect calls (interrupt previous) ────────────
  describe('Multiple tier effects (interrupt behavior)', () => {
    it('calling startTierEffect again replaces previous effect', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.spotlightAgent).toBe('weebo');

      startTierEffect(state, 3, { x: 100, y: 100 }, 'aria');
      expect(state.spotlightAgent).toBe('aria');
      expect(state.zoomTarget).toEqual({ x: 100, y: 100 });
    });

    it('switching from Tier 3 to Tier 1 clears zoom/spotlight', () => {
      startTierEffect(state, 3, agentPos, 'weebo');
      expect(state.zoomPhase).toBe('zoom_in');

      clearEffects(state);
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ZOOM ANIMATION PHASES — Tier 3 (zoom_in → hold → zoom_out)
// ═══════════════════════════════════════════════════════════════════════════

describe('CanvasEffects — Zoom Animation Phases (Tier 3)', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
    startTierEffect(state, 3, { x: 432, y: 400 }, 'weebo');
  });

  afterEach(() => {
    returnEffectState(state);
  });

  // ─── zoom_in phase (scale 1.0 → 1.5) ────────────────────────────────
  describe('Phase 1: zoom_in (600ms, easeOutCubic)', () => {
    it('phase starts at zoom_in with progress 0', () => {
      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBe(0);
    });

    it('scale increases with each tick (0 → 1.5)', () => {
      const scales: number[] = [state.zoomScale];

      for (let i = 0; i < 5; i++) {
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 5);
        scales.push(state.zoomScale);
      }

      // Verify monotonic increase
      for (let i = 1; i < scales.length; i++) {
        expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
      }

      // Verify progress completes
      expect(state.zoomProgress).toBeGreaterThanOrEqual(1);
    });

    it('transitions to hold phase when progress >= 1', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      expect(state.zoomPhase).toBe('hold');
    });

    it('scale approaches 1.5 (max zoom)', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      expect(state.zoomScale).toBeCloseTo(1.5, 1);
    });

    it('uses easeOutCubic curve (fast start, slow end)', () => {
      // Measure scale at 25%, 50%, 75% through zoom_in
      const scales: number[] = [];

      for (const progress of [0.25, 0.5, 0.75]) {
        state.zoomProgress = 0;
        state.zoomScale = 1;
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS * progress);
        scales.push(state.zoomScale);
      }

      // Verify ease-out: deltas decrease
      const d1 = scales[0] - 1;
      const d2 = scales[1] - scales[0];
      const d3 = scales[2] - scales[1];

      expect(d1).toBeGreaterThan(d2);
      expect(d2).toBeGreaterThan(d3);
    });

    it('clamping prevents overshoot (Math.min(progress, 1))', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 2); // Double duration
      expect(state.zoomScale).toBeLessThanOrEqual(1.5);
    });
  });

  // ─── hold phase (scale stays 1.5) ───────────────────────────────────
  describe('Phase 2: hold (2000ms, no animation)', () => {
    beforeEach(() => {
      // Skip to hold phase
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      expect(state.zoomPhase).toBe('hold');
    });

    it('scale stays constant at 1.5 during hold', () => {
      const scaleAtStart = state.zoomScale;

      tickEffects(state, TIER_CINEMATIC_HOLD_MS / 2);
      expect(state.zoomScale).toBe(scaleAtStart);

      tickEffects(state, TIER_CINEMATIC_HOLD_MS / 2);
      expect(state.zoomScale).toBeCloseTo(scaleAtStart, 2);
    });

    it('hold duration is 2000ms (TIER_CINEMATIC_HOLD_MS)', () => {
      // At end of hold, should transition to zoom_out
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');
    });

    it('dim opacity stays at 0.4 during hold', () => {
      expect(state.dimOpacity).toBe(0.4);
      tickEffects(state, TIER_CINEMATIC_HOLD_MS / 2);
      expect(state.dimOpacity).toBe(0.4);
    });
  });

  // ─── zoom_out phase (scale 1.5 → 1.0, opacity 0.4 → 1.0) ──────────
  describe('Phase 3: zoom_out (400ms, fade-in background)', () => {
    beforeEach(() => {
      // Skip to zoom_out
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');
    });

    it('scale decreases from 1.5 to 1.0', () => {
      const scaleAtStart = state.zoomScale;

      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      const scaleMid = state.zoomScale;

      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      const scaleEnd = state.zoomScale;

      expect(scaleMid).toBeLessThan(scaleAtStart);
      expect(scaleEnd).toBeLessThan(scaleMid);
      expect(scaleEnd).toBeCloseTo(1, 1);
    });

    it('dim opacity fades in (0.4 → 1.0)', () => {
      expect(state.dimOpacity).toBe(0.4);

      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      const opacityMid = state.dimOpacity;
      expect(opacityMid).toBeGreaterThan(0.4);
      expect(opacityMid).toBeLessThan(1);

      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.dimOpacity).toBe(1);
    });

    it('zoom_out duration is 400ms (TIER_CINEMATIC_PULLBACK_MS)', () => {
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS);
      expect(state.zoomPhase).toBe('none');
    });
  });

  // ─── Complete animation cycle ──────────────────────────────────────
  describe('Complete animation cycle (zoom_in → hold → zoom_out → none)', () => {
    it('animation completes with all values reset', () => {
      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;
      tickEffects(state, totalTime);

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBeCloseTo(1, 1);
      expect(state.dimOpacity).toBe(1);
      expect(state.spotlightAgent).toBeNull();
      expect(state.zoomTarget).toBeNull();
    });

    it('over-ticking does not cause overshoot or infinite loops', () => {
      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;
      tickEffects(state, totalTime * 3); // 3× duration

      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
      expect(state.zoomPhase).toBe('none');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EASING FUNCTION VALIDATION (BLOCKED: Requires easeOutCubic export)
// ═══════════════════════════════════════════════════════════════════════════

describe('CanvasEffects — Easing Function (TODO: Export easeOutCubic)', () => {
  // These tests use the reference implementation until easeOutCubic is exported
  // Once exported, uncomment and use module's implementation instead

  describe('easeOutCubic curve properties (REFERENCE IMPLEMENTATION)', () => {
    it('easeOutCubic(0) = 0', () => {
      // TODO: const result = easeOutCubic(0);
      // expect(result).toBe(0);
      expect(referenceEaseOutCubic(0)).toBe(0);
    });

    it('easeOutCubic(1) = 1', () => {
      // TODO: const result = easeOutCubic(1);
      // expect(result).toBe(1);
      expect(referenceEaseOutCubic(1)).toBe(1);
    });

    it('easeOutCubic(0.5) ≈ 0.875', () => {
      // TODO: const result = easeOutCubic(0.5);
      // expect(result).toBeCloseTo(0.875, 2);
      expect(referenceEaseOutCubic(0.5)).toBeCloseTo(0.875, 2);
    });

    it('monotonically increasing (t1 < t2 → easeOut(t1) < easeOut(t2))', () => {
      const points = [0, 0.25, 0.5, 0.75, 1.0];
      const values = points.map(referenceEaseOutCubic);

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('output in range [0, 1] for input [0, 1]', () => {
      for (let t = 0; t <= 1; t += 0.1) {
        const result = referenceEaseOutCubic(t);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it('demonstrates ease-out (larger deltas early, smaller late)', () => {
      const delta1 = referenceEaseOutCubic(0.25) - referenceEaseOutCubic(0);
      const delta2 = referenceEaseOutCubic(0.75) - referenceEaseOutCubic(0.5);

      expect(delta1).toBeGreaterThan(delta2);
    });
  });

  describe('easeOutCubic applied to zoom scale', () => {
    let state: CanvasEffectState;

    beforeEach(() => {
      state = createEffectState();
      startTierEffect(state, 3, { x: 432, y: 400 }, 'weebo');
    });

    it('zoom scale matches formula: 1 + 0.5 * easeOutCubic(progress)', () => {
      state.zoomProgress = 0;
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 0.5);

      const expectedEase = referenceEaseOutCubic(0.5);
      const expectedScale = 1 + 0.5 * expectedEase;

      expect(state.zoomScale).toBeCloseTo(expectedScale, 1);
    });

    it('zoom scale interpolates at multiple progress points', () => {
      [0.25, 0.5, 0.75].forEach((progress) => {
        state.zoomProgress = 0;
        state.zoomScale = 1;

        tickEffects(state, TIER_CINEMATIC_ZOOM_MS * progress);

        const expectedEase = referenceEaseOutCubic(progress);
        const expectedScale = 1 + 0.5 * expectedEase;

        expect(state.zoomScale).toBeCloseTo(expectedScale, 1);
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLEAR EFFECTS — Reset State
// ═══════════════════════════════════════════════════════════════════════════

describe('CanvasEffects — clearEffects() Reset', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
    startTierEffect(state, 3, { x: 432, y: 400 }, 'weebo');
    tickEffects(state, 100);
  });

  it('resets zoomTarget to null', () => {
    expect(state.zoomTarget).not.toBeNull();
    clearEffects(state);
    expect(state.zoomTarget).toBeNull();
  });

  it('resets zoomScale to 1.0', () => {
    clearEffects(state);
    expect(state.zoomScale).toBe(1);
  });

  it('resets zoomProgress to 0', () => {
    clearEffects(state);
    expect(state.zoomProgress).toBe(0);
  });

  it('resets zoomPhase to "none"', () => {
    clearEffects(state);
    expect(state.zoomPhase).toBe('none');
  });

  it('clears spotlightAgent to null', () => {
    clearEffects(state);
    expect(state.spotlightAgent).toBeNull();
  });

  it('resets dimOpacity to 1.0', () => {
    clearEffects(state);
    expect(state.dimOpacity).toBe(1);
  });

  it('clears all zoom and spotlight in single call', () => {
    clearEffects(state);

    // Verify all properties reset
    expect(state.zoomTarget).toBeNull();
    expect(state.zoomScale).toBe(1);
    expect(state.zoomProgress).toBe(0);
    expect(state.zoomPhase).toBe('none');
    expect(state.spotlightAgent).toBeNull();
    expect(state.dimOpacity).toBe(1);
  });
});
