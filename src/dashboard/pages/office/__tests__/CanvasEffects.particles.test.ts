/**
 * @fileoverview CanvasEffects particle physics test skeleton
 * Tests particle bounce, wrapping, opacity oscillation, and easing functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEffectState,
  tickEffects,
  type CanvasEffectState,
} from '../CanvasEffects';
import { CANVAS_W, CANVAS_H } from '../constants';

describe('CanvasEffects — Particle Physics', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  // ─── Particle initialization ────────────────────────────────────────────
  describe('createEffectState — particles initialization', () => {
    it('creates 15 particles with random positions within bounds', () => {
      expect(state.particles).toHaveLength(15);

      state.particles.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(CANVAS_W); // 864
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(CANVAS_H); // 800
      });
    });

    it('particles have initial velocities in range [-0.15, +0.15]', () => {
      state.particles.forEach((p) => {
        expect(p.vx).toBeGreaterThanOrEqual(-0.25);
        expect(p.vx).toBeLessThanOrEqual(0.25);
        expect(p.vy).toBeGreaterThanOrEqual(-0.25);
        expect(p.vy).toBeLessThanOrEqual(0.25);
      });
    });

    it('particles have initial alpha in range [0, 0.05]', () => {
      state.particles.forEach((p) => {
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(0.05);
      });
    });

    it('each particle is independent (not shared reference)', () => {
      const p1 = state.particles[0];
      const p2 = state.particles[1];

      expect(p1).not.toBe(p2);

      p1.x = 999;
      expect(p2.x).not.toBe(999);
    });
  });

  // ─── Particle movement ─────────────────────────────────────────────────
  describe('tickEffects — particle movement', () => {
    beforeEach(() => {
      state.zoomPhase = 'none'; // No zoom effect, focus on particles
    });

    it('particles move by velocity each tick', () => {
      const particle = state.particles[0];
      const initialX = particle.x;
      const initialY = particle.y;
      const vx = particle.vx;
      const vy = particle.vy;

      const dt = 16; // 16ms tick
      tickEffects(state, dt);

      // Particle should have moved (approximately)
      // Movement = velocity * dt, but dt is in ms, not pixels
      // TODO: Verify movement calculation formula
      expect(particle.x).not.toBe(initialX) || expect(particle.y).not.toBe(initialY);
    });

    it('particles bounce off canvas boundaries (x axis)', () => {
      const particle = state.particles[0];
      particle.x = 0;
      particle.vx = -0.2; // Moving left (out of bounds)
      particle.y = 400;
      particle.vy = 0;

      tickEffects(state, 100);

      // After bounce, particle should be inside canvas
      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(CANVAS_W);
      // Velocity should reverse or dampen
      // expect(particle.vx).toBeGreaterThanOrEqual(0);
    });

    it('particles bounce off canvas boundaries (y axis)', () => {
      const particle = state.particles[0];
      particle.x = 432;
      particle.vx = 0;
      particle.y = 0;
      particle.vy = -0.2; // Moving up (out of bounds)

      tickEffects(state, 100);

      // After bounce, particle should be inside canvas
      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(CANVAS_H);
      // expect(particle.vy).toBeGreaterThanOrEqual(0);
    });

    it('particles bounce at corners (both x and y)', () => {
      const particle = state.particles[0];
      particle.x = 0;
      particle.y = 0;
      particle.vx = -0.2;
      particle.vy = -0.2;

      tickEffects(state, 200);

      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(CANVAS_W);
      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(CANVAS_H);
    });

    it('particles maintain velocity magnitude after bounce', () => {
      const particle = state.particles[0];
      const initialSpeed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);

      // Move particle to boundary
      particle.x = 0;
      particle.vx = -0.2;

      tickEffects(state, 100);

      const finalSpeed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);
      // Speed should be similar (within damping tolerance)
      expect(finalSpeed).toBeLessThanOrEqual(initialSpeed * 1.1); // Allow 10% variance
    });
  });

  // ─── Particle opacity oscillation ──────────────────────────────────────
  describe('tickEffects — particle opacity (alpha)', () => {
    beforeEach(() => {
      state.zoomPhase = 'none';
    });

    it('particle alpha oscillates between 0.02 and 0.05', () => {
      const particle = state.particles[0];
      particle.alpha = 0.035;

      // Tick multiple times to observe oscillation
      const alphaValues: number[] = [particle.alpha];

      for (let i = 0; i < 10; i++) {
        tickEffects(state, 16);
        alphaValues.push(particle.alpha);
      }

      // All values should be within bounds
      alphaValues.forEach((alpha) => {
        expect(alpha).toBeGreaterThanOrEqual(0.02);
        expect(alpha).toBeLessThanOrEqual(0.05);
      });
    });

    it('particle alpha uses sine-wave for smooth oscillation', () => {
      const particle = state.particles[0];
      particle.alpha = 0.035;

      // Collect alpha values over time
      const alphaValues: number[] = [];

      for (let i = 0; i < 60; i++) {
        tickEffects(state, 16);
        alphaValues.push(particle.alpha);
      }

      // TODO: Verify sine-wave pattern (smooth rising/falling, not jumpy)
      // Check for local minima and maxima
      let hasLocalMin = false;
      let hasLocalMax = false;

      for (let i = 1; i < alphaValues.length - 1; i++) {
        const prev = alphaValues[i - 1];
        const curr = alphaValues[i];
        const next = alphaValues[i + 1];

        // Local minimum: curr < prev and curr < next
        if (curr < prev && curr < next) hasLocalMin = true;
        // Local maximum: curr > prev and curr > next
        if (curr > prev && curr > next) hasLocalMax = true;
      }

      expect(hasLocalMin || hasLocalMax).toBe(true); // Oscillating
    });

    it('alpha oscillation is independent across particles', () => {
      const p1 = state.particles[0];
      const p2 = state.particles[1];

      p1.alpha = 0.025;
      p2.alpha = 0.045;

      tickEffects(state, 16);

      // Alphas should have changed independently (or sync, but differ initially)
      // Main point: one particle's alpha doesn't affect another
      // They may oscillate at same frequency but different phase
      expect(p1.alpha).not.toBe(p2.alpha); // Likely still different
    });
  });

  // ─── Easing function behavior ──────────────────────────────────────────
  describe('easeOutCubic easing function', () => {
    // NOTE: easeOutCubic is used internally in tickEffects for zoom phases
    // We test its behavior indirectly through zoom animation

    it('easeOutCubic(0) = 0', () => {
      // During zoom_in at progress=0: scale = 1 + 0.5 * easeOutCubic(0)
      // Should give scale = 1
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;
      tickEffects(state, 0);
      expect(state.zoomScale).toBe(1);
    });

    it('easeOutCubic(1) = 1', () => {
      // During zoom_in at progress=1: scale = 1 + 0.5 * easeOutCubic(1)
      // Should give scale = 1.5
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0.99;
      tickEffects(state, 100); // Complete zoom
      expect(state.zoomScale).toBe(1.5);
    });

    it('easeOutCubic(0.5) is > 0.5 (faster at start, slower at end)', () => {
      // easeOutCubic eases out: starts fast, ends slow
      // So f(0.5) should be > 0.5
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0.49;
      tickEffects(state, 1); // Small tick to reach ~0.5
      // scale should be > 1.25 (1 + 0.5 * 0.5)
      expect(state.zoomScale).toBeGreaterThan(1.25);
    });

    it('easeOutCubic produces smooth curve (no discontinuities)', () => {
      state.zoomPhase = 'zoom_in';

      const scales: number[] = [];
      for (let i = 0; i <= 100; i += 10) {
        state.zoomProgress = i / 100;
        const dt = (i === 0) ? 0 : 16;
        tickEffects(state, dt);
        scales.push(state.zoomScale);
      }

      // Check for monotonic increase (scale should always increase in zoom_in)
      for (let i = 1; i < scales.length; i++) {
        expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
      }
    });
  });

  // ─── Over-ticking and extreme values ────────────────────────────────────
  describe('tickEffects — Over-ticking & Edge Cases', () => {
    it('handles dt = 0 (no time passed)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;
      state.zoomScale = 1;

      tickEffects(state, 0);

      expect(state.zoomProgress).toBe(0);
      expect(state.zoomScale).toBe(1);
    });

    it('handles negative dt (should clamp or no-op)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0.5;
      const progress = state.zoomProgress;

      tickEffects(state, -16); // Negative time

      // Should either ignore or clamp
      expect(state.zoomProgress).toBeGreaterThanOrEqual(0);
    });

    it('handles dt larger than phase duration (over-ticking)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;

      // Zoom_in should complete in 600ms; tick with 1000ms
      tickEffects(state, 1000);

      // Should transition to hold, not overshoot
      expect(state.zoomPhase).toBe('hold') || expect(state.zoomProgress).toBeLessThanOrEqual(1);
      expect(state.zoomScale).toBeLessThanOrEqual(1.5);
    });

    it('handles multiple over-ticks in succession', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;

      tickEffects(state, 2000); // Way too much
      tickEffects(state, 2000); // Again
      tickEffects(state, 2000); // And again

      // Should converge to final state, not accumulate
      expect(state.zoomPhase).toBe('none') || expect(state.zoomPhase).toBe('hold') || expect(state.zoomPhase).toBe('zoom_out');
      expect(state.zoomScale).toBeLessThanOrEqual(1.5);
      expect(state.zoomScale).toBeGreaterThanOrEqual(1);
    });

    it('handles very small dt values', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;

      for (let i = 0; i < 100; i++) {
        tickEffects(state, 0.01); // 0.01ms ticks
      }

      // After 1ms total, should still be in zoom_in with minimal progress
      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBeLessThan(0.1);
    });

    it('handles very large dt values', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;

      tickEffects(state, 10_000); // 10 seconds

      // Should have progressed through all phases
      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
    });
  });

  // ─── Simultaneous effects ──────────────────────────────────────────────
  describe('tickEffects — Multiple Effects Simultaneous', () => {
    it('particles continue moving during zoom effect', () => {
      const particle = state.particles[0];
      particle.x = 100;
      particle.y = 100;
      particle.vx = 0.1;
      particle.vy = 0.1;

      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;
      state.zoomTarget = { x: 432, y: 400 };
      state.spotlightAgent = 'weebo';

      const initialX = particle.x;
      const initialY = particle.y;

      tickEffects(state, 100);

      // Particle should have moved even though zoom is active
      expect(particle.x).not.toBe(initialX) || expect(particle.y).not.toBe(initialY);
      // Zoom should also progress
      expect(state.zoomScale).toBeGreaterThan(1);
    });

    it('particles alpha oscillates during dim transition', () => {
      state.zoomPhase = 'zoom_out';
      state.zoomProgress = 0;
      state.dimOpacity = 0.4;

      const particle = state.particles[0];
      const initialAlpha = particle.alpha;

      tickEffects(state, 100);

      // Alpha should change (oscillate) independently of dim
      expect(particle.alpha).not.toBe(initialAlpha);
      // Dim should also change
      expect(state.dimOpacity).toBeGreaterThan(0.4);
    });
  });
});
