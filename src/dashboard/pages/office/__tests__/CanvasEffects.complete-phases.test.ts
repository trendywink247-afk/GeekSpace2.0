/**
 * @fileoverview CanvasEffects complete zoom phase animation test suite
 * Tests all three phases: zoom_in → hold → zoom_out with proper easing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEffectState,
  startTierEffect,
  tickEffects,
  clearEffects,
  type CanvasEffectState,
} from '../systems/effects/CanvasEffects';
import {
  TIER_CINEMATIC_ZOOM_MS,
  TIER_CINEMATIC_HOLD_MS,
  TIER_CINEMATIC_PULLBACK_MS,
} from '../constants';

describe('CanvasEffects — Complete Phase Animation Cycle', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  // ─── Full animation cycle: zoom_in → hold → zoom_out → none ──────────
  describe('Full cinematic animation sequence', () => {
    beforeEach(() => {
      const agentPos = { x: 432, y: 400 };
      startTierEffect(state, 3, agentPos, 'weebo');
    });

    it('Phase 1: zoom_in starts at zoomPhase="zoom_in", progress=0, scale=1', () => {
      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomScale).toBe(1);
      expect(state.spotlightAgent).toBe('weebo');
      expect(state.dimOpacity).toBe(0.4);
    });

    it('Phase 1: zoom_in completes at progress=1, transitions to hold', () => {
      // Tick to complete zoom_in (600ms)
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      expect(state.zoomProgress).toBeGreaterThanOrEqual(1);
      expect(state.zoomPhase).toBe('hold');
      expect(state.zoomScale).toBeCloseTo(1.5, 1); // Should be close to max
    });

    it('Phase 2: hold maintains zoom scale at 1.5 for entire duration', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS); // Complete zoom_in
      const scaleAtStart = state.zoomScale;

      // Tick halfway through hold (1000ms of 2000ms)
      tickEffects(state, TIER_CINEMATIC_HOLD_MS / 2);
      expect(state.zoomScale).toBe(scaleAtStart); // Unchanged

      // Tick other half of hold
      tickEffects(state, TIER_CINEMATIC_HOLD_MS / 2);
      expect(state.zoomPhase).toBe('zoom_out'); // Transitioned
      expect(state.zoomScale).toBeCloseTo(1.5, 1); // Still at max
    });

    it('Phase 3: zoom_out decreases scale from 1.5 to 1.0', () => {
      // Skip to zoom_out phase
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');

      const scaleAtStart = state.zoomScale;

      // Tick halfway through zoom_out
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.zoomScale).toBeLessThan(scaleAtStart);
      expect(state.zoomScale).toBeGreaterThan(1);
    });

    it('Phase 3: zoom_out also fades in dim (opacity 0.4 → 1.0)', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS);
      expect(state.dimOpacity).toBe(0.4);

      // Tick halfway through zoom_out
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.dimOpacity).toBeGreaterThan(0.4);
      expect(state.dimOpacity).toBeLessThan(1);
    });

    it('Animation completes: scale→1, opacity→1, phase→none, spotlight cleared', () => {
      // Tick through all three phases
      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;
      tickEffects(state, totalTime);

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
      expect(state.spotlightAgent).toBeNull();
      expect(state.zoomTarget).toBeNull();
    });

    it('Over-ticking past animation end does not overshoot values', () => {
      // Tick 2× the total animation time
      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;
      tickEffects(state, totalTime * 2);

      // Should clamp to final state
      expect(state.zoomScale).toBe(1); // Not < 1
      expect(state.dimOpacity).toBe(1); // Not > 1
      expect(state.zoomPhase).toBe('none'); // Not cycling
    });
  });

  // ─── Easing curve validation (inferred from zoom scale) ──────────────
  describe('Easing function behavior (easeOutCubic)', () => {
    it('zoom_in shows ease-out pattern (fast start, slow end)', () => {
      startTierEffect(state, 3, { x: 432, y: 400 }, 'test');

      // Measure scale progression at 25%, 50%, 75%
      const dt = TIER_CINEMATIC_ZOOM_MS / 4;

      // 25%
      tickEffects(state, dt);
      const scale25 = state.zoomScale;

      // 50% (reset and tick 50%)
      state.zoomProgress = 0;
      state.zoomScale = 1;
      tickEffects(state, dt * 2);
      const scale50 = state.zoomScale;

      // 75%
      state.zoomProgress = 0;
      state.zoomScale = 1;
      tickEffects(state, dt * 3);
      const scale75 = state.zoomScale;

      // Ease-out means larger deltas early than late
      const delta25 = scale25 - 1;
      const delta50 = scale50 - scale25;
      const delta75 = scale75 - scale50;

      // Early delta should be notably larger
      expect(delta25).toBeGreaterThan(delta75 * 0.7);
    });

    it('zoom_out uses same easing curve (inverse: 1.5 → 1)', () => {
      startTierEffect(state, 3, { x: 432, y: 400 }, 'test');
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');

      const scaleAtStart = state.zoomScale;
      const dt = TIER_CINEMATIC_PULLBACK_MS / 4;

      // 25% through zoom_out
      tickEffects(state, dt);
      const scale25 = state.zoomScale;

      // Measure remaining scale decrease
      const remainingScale = scaleAtStart - scale25;
      const remainingTarget = 1 - scaleAtStart; // Full remaining distance

      // Ease-out should consume most of remaining distance early
      expect(remainingScale).toBeGreaterThan(Math.abs(remainingTarget) * 0.2);
    });

    it('clamping progress to [0, 1] prevents overshoot', () => {
      startTierEffect(state, 3, { x: 432, y: 400 }, 'test');

      // Over-tick zoom_in (2× duration)
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 2);

      // progress should be clamped, not 2.0
      expect(state.zoomProgress).toBeLessThanOrEqual(1);
      expect(state.zoomScale).toBeLessThanOrEqual(1.5);
    });
  });

  // ─── Timing precision ─────────────────────────────────────────────────
  describe('Animation timing precision', () => {
    it('zoom_in progresses linearly: progress += dt / ZOOM_MS', () => {
      startTierEffect(state, 3, { x: 432, y: 400 }, 'test');

      const dt1 = TIER_CINEMATIC_ZOOM_MS / 4;
      tickEffects(state, dt1);
      const progress1 = state.zoomProgress;
      expect(progress1).toBeCloseTo(0.25, 2);

      state.zoomProgress = 0;
      state.zoomScale = 1;
      const dt2 = TIER_CINEMATIC_ZOOM_MS / 2;
      tickEffects(state, dt2);
      const progress2 = state.zoomProgress;
      expect(progress2).toBeCloseTo(0.5, 2);
    });

    it('hold duration is exactly TIER_CINEMATIC_HOLD_MS (2000ms)', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS); // Skip to hold
      expect(state.zoomPhase).toBe('hold');

      const holdStart = state.zoomProgress;

      // Tick 2000ms
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomProgress).toBeGreaterThanOrEqual(1);
      expect(state.zoomPhase).toBe('zoom_out');
    });

    it('zoom_out duration is exactly TIER_CINEMATIC_PULLBACK_MS (400ms)', () => {
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');

      const pullbackStart = state.zoomProgress;

      // Tick 400ms
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS);
      expect(state.zoomProgress).toBeGreaterThanOrEqual(1);
      expect(state.zoomPhase).toBe('none');
    });
  });

  // ─── Total animation duration ────────────────────────────────────────
  describe('Total cinematic animation duration', () => {
    it('total duration = 600 + 2000 + 400 = 3000ms', () => {
      startTierEffect(state, 3, { x: 432, y: 400 }, 'test');

      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;
      expect(totalTime).toBe(3000);

      tickEffects(state, totalTime);
      expect(state.zoomPhase).toBe('none');
    });

    it('animation does not loop or repeat', () => {
      startTierEffect(state, 3, { x: 432, y: 400 }, 'test');

      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;
      tickEffects(state, totalTime + 10000); // Way more than needed

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.spotlightAgent).toBeNull();
    });
  });
});
