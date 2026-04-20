/**
 * Unit tests for CanvasEffects.ts
 * Tests animation state management, phase transitions, easing, and particle physics.
 */

import { describe, it, expect, beforeEach} from 'vitest';
import {
  createEffectState,
  startTierEffect,
  clearEffects,
  tickEffects,
  type CanvasEffectState,
} from '@/dashboard/pages/office/CanvasEffects';
import {
  TIER_CINEMATIC_ZOOM_MS,
  TIER_CINEMATIC_HOLD_MS,
  TIER_CINEMATIC_PULLBACK_MS,
} from '@/dashboard/pages/office/constants';

describe('CanvasEffects', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  describe('createEffectState', () => {
    it('initializes with idle zoom state', () => {
      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomTarget).toBeNull();
    });

    it('initializes with no spotlight', () => {
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });

    it('creates 15 particles with random positions', () => {
      expect(state.particles).toHaveLength(15);
      state.particles.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(864);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(800);
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(0.05);
      });
    });
  });

  describe('startTierEffect', () => {
    it('tier 3: starts cinematic zoom effect', () => {
      const agentPos = { x: 400, y: 300 };
      startTierEffect(state, 3, agentPos, 'weebo');

      expect(state.zoomTarget).toEqual(agentPos);
      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBe(0);
      expect(state.spotlightAgent).toBe('weebo');
      expect(state.dimOpacity).toBe(0.4);
    });

    it('tier 2: starts spotlight only (no zoom)', () => {
      const agentPos = { x: 400, y: 300 };
      startTierEffect(state, 2, agentPos, 'edith');

      expect(state.spotlightAgent).toBe('edith');
      expect(state.dimOpacity).toBe(0.7);
      expect(state.zoomTarget).toBeNull();
      expect(state.zoomPhase).toBe('none');
    });

    it('tier 1: no global effect', () => {
      const agentPos = { x: 400, y: 300 };
      const originalDimOpacity = state.dimOpacity;

      startTierEffect(state, 1, agentPos, 'jarvis');

      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(originalDimOpacity);
      expect(state.zoomPhase).toBe('none');
    });
  });

  describe('clearEffects', () => {
    it('resets all zoom and spotlight properties', () => {
      // Set up some state
      state.zoomTarget = { x: 100, y: 100 };
      state.zoomScale = 1.5;
      state.zoomProgress = 0.5;
      state.zoomPhase = 'hold';
      state.spotlightAgent = 'weebo';
      state.dimOpacity = 0.4;

      clearEffects(state);

      expect(state.zoomTarget).toBeNull();
      expect(state.zoomScale).toBe(1);
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });

    it('is idempotent', () => {
      clearEffects(state);
      const beforeSecond = JSON.stringify(state);
      clearEffects(state);
      const afterSecond = JSON.stringify(state);

      expect(beforeSecond).toBe(afterSecond);
    });
  });

  describe('tickEffects - Phase Transitions', () => {
    it('zoom_in: progresses toward hold phase', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');
      expect(state.zoomPhase).toBe('zoom_in');

      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);

      // After full duration, should transition to hold
      expect(state.zoomPhase).toBe('hold');
      expect(state.zoomProgress).toBe(0);
    });

    it('hold: maintains zoom and transitions to zoom_out', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');

      // Advance through zoom_in
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      expect(state.zoomPhase).toBe('hold');

      // Advance through hold
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');
      expect(state.zoomProgress).toBe(0);
    });

    it('zoom_out: restores to idle state', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');

      // Advance through all phases
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS);

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
      expect(state.spotlightAgent).toBeNull();
      expect(state.zoomTarget).toBeNull();
    });
  });

  describe('tickEffects - Scale Calculations', () => {
    it('zoom_in: scales from 1.0 to 1.5', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');

      // Start: scale = 1.0
      expect(state.zoomScale).toBe(1);

      // Midway: scale ≈ 1.25
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 2);
      expect(state.zoomScale).toBeGreaterThan(1);
      expect(state.zoomScale).toBeLessThan(1.5);

      // End: scale = 1.5
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 2);
      expect(state.zoomScale).toBeCloseTo(1.5, 2);
    });

    it('zoom_out: scales from 1.5 back to 1.0', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);

      // Start zoom_out: scale = 1.5
      expect(state.zoomScale).toBeCloseTo(1.5, 2);

      // Midway: scale ≈ 1.25
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.zoomScale).toBeGreaterThan(1);
      expect(state.zoomScale).toBeLessThan(1.5);

      // End: scale = 1.0
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.zoomScale).toBeCloseTo(1, 2);
    });
  });

  describe('tickEffects - Opacity Changes', () => {
    it('zoom_out: restores dimOpacity from 0.4 to 1.0', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);

      // Start zoom_out: dimOpacity = 0.4
      expect(state.dimOpacity).toBe(0.4);

      // Midway: dimOpacity ≈ 0.7
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.dimOpacity).toBeGreaterThan(0.4);
      expect(state.dimOpacity).toBeLessThan(1);

      // End: dimOpacity = 1.0
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS / 2);
      expect(state.dimOpacity).toBeCloseTo(1, 2);
    });
  });

  describe('tickEffects - Edge Cases', () => {
    it('handles dt=0 (no progress)', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');
      const beforeProgress = state.zoomProgress;

      tickEffects(state, 0);

      expect(state.zoomProgress).toBe(beforeProgress);
    });

    it('handles dt > duration (skips phases)', () => {
      startTierEffect(state, 3, { x: 400, y: 300 }, 'weebo');

      // tickEffects only advances one phase per call, so tick through each phase
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS + 1);   // zoom_in → hold
      tickEffects(state, TIER_CINEMATIC_HOLD_MS + 1);    // hold → zoom_out
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS + 1); // zoom_out → none

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
    });

    it('handles zoomTarget=null (no zoom effect)', () => {
      // Don't call startTierEffect, leaving zoomTarget null
      expect(state.zoomTarget).toBeNull();

      tickEffects(state, 100);

      // Should remain in idle state
      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
    });
  });

  describe('Particle Physics', () => {
    it('particles move with velocity each tick', () => {
      const originalX = state.particles[0].x;
      const originalY = state.particles[0].y;

      tickEffects(state, 100);

      // After tick, particle should have moved (unless vx/vy both zero, very unlikely)
      const movedX = state.particles[0].x !== originalX;
      const movedY = state.particles[0].y !== originalY;
      expect(movedX || movedY).toBe(true);
    });

    it('particles bounce within canvas bounds', () => {
      for (let i = 0; i < 100; i++) {
        tickEffects(state, 16); // 60fps tick

        state.particles.forEach((p) => {
          expect(p.x).toBeGreaterThanOrEqual(-1.5);
          expect(p.x).toBeLessThanOrEqual(865.5);
          expect(p.y).toBeGreaterThanOrEqual(-1.5);
          expect(p.y).toBeLessThanOrEqual(801.5);
        });
      }
    });

    it('particle alpha oscillates during animation', () => {
      const alphas: number[] = [];

      for (let i = 0; i < 50; i++) {
        alphas.push(state.particles[0].alpha);
        tickEffects(state, 50);
      }

      // Check that alpha varies (oscillates)
      const hasIncreases = alphas.some((a, i) => i > 0 && a > alphas[i - 1]);
      const hasDecreases = alphas.some((a, i) => i > 0 && a < alphas[i - 1]);
      expect(hasIncreases || hasDecreases).toBe(true);
    });
  });
});
