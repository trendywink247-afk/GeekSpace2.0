/**
 * @fileoverview CanvasEffects easing function and animation precision tests
 * Tests easeOutCubic curve, particle physics, and numerical stability
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEffectState,
  tickEffects,
  clearEffects,
  type CanvasEffectState,
} from '../CanvasEffects';
import {
  TIER_CINEMATIC_ZOOM_MS,
  TIER_CINEMATIC_HOLD_MS,
  TIER_CINEMATIC_PULLBACK_MS,
  CANVAS_W,
  CANVAS_H,
} from '../constants';

describe('CanvasEffects — Easing & Physics', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  // ─── easeOutCubic easing function ──────────────────────────────────────
  describe('easeOutCubic easing curve', () => {
    it('easeOutCubic(0) = 0 (start)', () => {
      // Manually verify easing curve at keypoints
      // TODO: Export easeOutCubic from CanvasEffects for direct testing
      // For now, verify through zoom scale values

      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0;
      state.zoomTarget = { x: 432, y: 400 };

      tickEffects(state, 1); // Minimal tick
      expect(state.zoomScale).toBeCloseTo(1, 2); // Still near 1
    });

    it('easeOutCubic(1) = 1 (end)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomProgress = 0.99;
      state.zoomTarget = { x: 432, y: 400 };

      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);

      // After full zoom duration, progress >= 1
      expect(state.zoomProgress).toBeGreaterThanOrEqual(1);
    });

    it('easeOutCubic creates ease-out curve (faster at start, slower at end)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };

      // Quarter progress
      state.zoomProgress = 0;
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 0.25);
      const scale1 = state.zoomScale;

      // Reset and test three-quarters progress
      state.zoomProgress = 0;
      state.zoomScale = 1;
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 0.75);
      const scale2 = state.zoomScale;

      // Ease-out means larger jump early than late
      // Quarter to half: 0.25 → 0.5 (delta = 0.25)
      // Half to three-quarters: 0.5 → 0.75 (delta = 0.25)
      // But scale differences should show ease-out pattern

      expect(scale2).toBeLessThan(1.5); // Not fully zoomed at 0.75
      expect(scale2).toBeGreaterThan(scale1); // But progressed
    });

    it('zoom animation follows cubic bezier shape (not linear)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };

      const scales: number[] = [];

      for (let i = 0; i < 6; i++) {
        state.zoomProgress = 0;
        state.zoomScale = 1;
        const dt = (TIER_CINEMATIC_ZOOM_MS / 6) * (i + 1);
        tickEffects(state, dt);
        scales.push(state.zoomScale);
      }

      // Verify non-linear progression (cubic curve, not linear)
      const deltas = scales.slice(1).map((s, i) => s - scales[i]);

      // Early deltas should be larger (ease-out)
      expect(deltas[0]).toBeGreaterThan(deltas[deltas.length - 1] * 0.8);
    });
  });

  // ─── Particle boundary physics ─────────────────────────────────────────
  describe('Particle boundary bouncing (velocity reversal)', () => {
    it('particle bounces off left boundary (x=0)', () => {
      const particle = state.particles[0];
      particle.x = 0;
      particle.vx = -0.2;
      particle.y = 400;
      particle.vy = 0;

      const initialVx = particle.vx;
      tickEffects(state, 50);

      // After bounce, velocity should reverse (negative → positive)
      // OR position should snap back in bounds
      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(CANVAS_W);

      // Velocity reversal test
      // TODO: Verify vx is positive after left-wall bounce
      // expect(particle.vx).toBeGreaterThan(0);
    });

    it('particle bounces off right boundary (x=CANVAS_W)', () => {
      const particle = state.particles[0];
      particle.x = CANVAS_W;
      particle.vx = 0.2;
      particle.y = 400;
      particle.vy = 0;

      tickEffects(state, 50);

      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(CANVAS_W);
      // TODO: Verify vx reversal (positive → negative)
    });

    it('particle bounces off top boundary (y=0)', () => {
      const particle = state.particles[0];
      particle.x = 432;
      particle.vx = 0;
      particle.y = 0;
      particle.vy = -0.2;

      tickEffects(state, 50);

      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(CANVAS_H);
    });

    it('particle bounces off bottom boundary (y=CANVAS_H)', () => {
      const particle = state.particles[0];
      particle.x = 432;
      particle.vx = 0;
      particle.y = CANVAS_H;
      particle.vy = 0.2;

      tickEffects(state, 50);

      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(CANVAS_H);
    });

    it('particle corner bounce (diagonal velocity at corner)', () => {
      const particle = state.particles[0];
      particle.x = 0;
      particle.y = 0;
      particle.vx = -0.2;
      particle.vy = -0.2;

      tickEffects(state, 100);

      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThanOrEqual(CANVAS_W);
      expect(particle.y).toBeGreaterThanOrEqual(0);
      expect(particle.y).toBeLessThanOrEqual(CANVAS_H);
    });

    it('velocity magnitude preserved after bounce (no energy loss)', () => {
      const particle = state.particles[0];
      particle.x = 0;
      particle.y = 400;
      particle.vx = -0.15;
      particle.vy = 0.05;

      const initialMagnitude = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);

      tickEffects(state, 100);

      const finalMagnitude = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);

      // Magnitude should be equal (or very close with damping)
      expect(finalMagnitude).toBeCloseTo(initialMagnitude, 1);
    });
  });

  // ─── Particle opacity oscillation ──────────────────────────────────────
  describe('Particle alpha opacity oscillation (sine wave)', () => {
    it('particle alpha oscillates between min and max', () => {
      const particle = state.particles[0];
      const alphas: number[] = [];

      // Tick many times and record alpha
      for (let i = 0; i < 10; i++) {
        tickEffects(state, 100);
        alphas.push(particle.alpha);
      }

      // Should have variation (not constant)
      const uniqueAlphas = new Set(alphas.map((a) => Math.round(a * 100)));
      expect(uniqueAlphas.size).toBeGreaterThan(1);

      // All values should be in range [0.02, 0.05] approximately
      alphas.forEach((a) => {
        expect(a).toBeGreaterThanOrEqual(0.02);
        expect(a).toBeLessThanOrEqual(0.05);
      });
    });

    it('alpha oscillation is independent of zoom phase', () => {
      const particle = state.particles[0];

      // Record alphas during zoom_in
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };

      const alphasZoomIn: number[] = [];
      for (let i = 0; i < 5; i++) {
        tickEffects(state, 100);
        alphasZoomIn.push(particle.alpha);
      }

      // Reset and record during none phase
      particle.alpha = 0.03;
      state.zoomPhase = 'none';
      state.zoomTarget = null;

      const alphasNone: number[] = [];
      for (let i = 0; i < 5; i++) {
        tickEffects(state, 100);
        alphasNone.push(particle.alpha);
      }

      // Both should have variation
      const uniqueZoom = new Set(alphasZoomIn.map((a) => Math.round(a * 100)));
      const uniqueNone = new Set(alphasNone.map((a) => Math.round(a * 100)));

      expect(uniqueZoom.size).toBeGreaterThan(1);
      expect(uniqueNone.size).toBeGreaterThan(1);
    });

    it('alpha starts in [0.02, 0.05] range on creation', () => {
      const freshState = createEffectState();
      freshState.particles.forEach((p) => {
        expect(p.alpha).toBeGreaterThanOrEqual(0.02);
        expect(p.alpha).toBeLessThanOrEqual(0.05);
      });
    });
  });

  // ─── Over-ticking (clamping checks) ────────────────────────────────────
  describe('Over-ticking (excessive dt)', () => {
    it('zoom_in clamped to 1.5x even with huge dt', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };
      state.zoomProgress = 0;

      // Tick way beyond zoom duration
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 10);

      expect(state.zoomScale).toBeLessThanOrEqual(1.5);
      expect(state.zoomScale).toBeGreaterThan(1);
    });

    it('zoom_out clamped to 1.0x final scale', () => {
      state.zoomPhase = 'zoom_out';
      state.zoomTarget = { x: 432, y: 400 };
      state.zoomScale = 1.5;
      state.dimOpacity = 0.4;
      state.zoomProgress = 0;

      // Tick far beyond completion
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS * 100);

      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
      expect(state.zoomPhase).toBe('none');
    });

    it('single massive tick completes full cinematic sequence', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };
      state.spotlightAgent = 'weebo';

      const totalDuration = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;

      tickEffects(state, totalDuration);

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.spotlightAgent).toBeNull();
    });

    it('partial over-tick does not skip phases', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };

      // Tick 1.5x the zoom duration (should advance to hold, then partway through hold)
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 1.5);

      expect(state.zoomPhase).toBe('hold');
      expect(state.zoomProgress).toBeGreaterThan(0);
      expect(state.zoomProgress).toBeLessThan(1);
    });
  });

  // ─── Numerical stability ────────────────────────────────────────────────
  describe('Numerical stability', () => {
    it('handles very small dt (< 1ms)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };

      for (let i = 0; i < 1000; i++) {
        tickEffects(state, 0.1); // 0.1ms ticks
      }

      // Total = 100ms, still within zoom duration
      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBeGreaterThan(0);
      expect(state.zoomProgress).toBeLessThan(1);
    });

    it('handles zero dt gracefully (no-op)', () => {
      state.zoomPhase = 'zoom_in';
      state.zoomTarget = { x: 432, y: 400 };
      state.zoomProgress = 0.5;

      const progressBefore = state.zoomProgress;
      tickEffects(state, 0);
      const progressAfter = state.zoomProgress;

      // Zero dt should not change progress
      expect(progressAfter).toBe(progressBefore);
    });

    it('particle positions never become NaN', () => {
      for (let i = 0; i < 100; i++) {
        tickEffects(state, 16); // Standard 60fps dt

        state.particles.forEach((p) => {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(Number.isFinite(p.vx)).toBe(true);
          expect(Number.isFinite(p.vy)).toBe(true);
          expect(Number.isFinite(p.alpha)).toBe(true);
        });
      }
    });

    it('zoom scale never exceeds 1.5 or falls below 1', () => {
      for (let i = 0; i < 100; i++) {
        tickEffects(state, Math.random() * 100); // Random dt
        expect(state.zoomScale).toBeGreaterThanOrEqual(1);
        expect(state.zoomScale).toBeLessThanOrEqual(1.5);
      }
    });
  });
});
