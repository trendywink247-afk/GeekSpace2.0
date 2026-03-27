import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEffectState,
  startTierEffect,
  clearEffects,
  tickEffects,
  type CanvasEffectState,
  type AnimationTier,
} from '@/dashboard/pages/office/CanvasEffects';
import {
  TIER_CINEMATIC_ZOOM_MS,
  TIER_CINEMATIC_HOLD_MS,
  TIER_CINEMATIC_PULLBACK_MS,
} from '@/dashboard/pages/office/constants';

describe('CanvasEffects — Zoom Phase State Machine', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  // ─────────────────────────────────────────────────────────────────
  // createEffectState — Initialization
  // ─────────────────────────────────────────────────────────────────

  describe('createEffectState', () => {
    it('initializes with no zoom active', () => {
      expect(state.zoomTarget).toBeNull();
      expect(state.zoomScale).toBe(1);
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomPhase).toBe('none');
    });

    it('initializes with no spotlight', () => {
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });

    it('creates 15 particles with valid ranges', () => {
      expect(state.particles).toHaveLength(15);
      state.particles.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(864); // CANVAS_W
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(800); // CANVAS_H
        expect(Math.abs(p.vx)).toBeLessThanOrEqual(0.15); // (0.5 * 0.3)
        expect(Math.abs(p.vy)).toBeLessThanOrEqual(0.15);
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(0.05);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // startTierEffect — Tier-specific effects
  // ─────────────────────────────────────────────────────────────────

  describe('startTierEffect', () => {
    const agentPos = { x: 5, y: 10 };
    const agentId = 'weebo' as const;

    describe('Tier 3: Cinematic', () => {
      it('starts zoom_in phase at full zoom', () => {
        startTierEffect(state, 3, agentPos, agentId);

        expect(state.zoomTarget).toEqual(agentPos);
        expect(state.zoomPhase).toBe('zoom_in');
        expect(state.zoomProgress).toBe(0);
        expect(state.spotlightAgent).toBe(agentId);
        expect(state.dimOpacity).toBe(0.4);
      });

      it('sets zoom scale to 1 initially (progress will animate it)', () => {
        startTierEffect(state, 3, agentPos, agentId);
        expect(state.zoomScale).toBe(1); // not yet animated
      });
    });

    describe('Tier 2: Spotlight', () => {
      it('activates spotlight without zoom', () => {
        startTierEffect(state, 2, agentPos, agentId);

        expect(state.spotlightAgent).toBe(agentId);
        expect(state.dimOpacity).toBe(0.7);
        expect(state.zoomTarget).toBeNull();
        expect(state.zoomPhase).toBe('none');
      });
    });

    describe('Tier 1: Minimal', () => {
      it('does nothing (no-op)', () => {
        startTierEffect(state, 1, agentPos, agentId);

        expect(state.spotlightAgent).toBeNull();
        expect(state.zoomTarget).toBeNull();
        expect(state.zoomPhase).toBe('none');
        expect(state.dimOpacity).toBe(1);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // clearEffects — Reset to idle
  // ─────────────────────────────────────────────────────────────────

  describe('clearEffects', () => {
    it('resets all zoom and spotlight properties', () => {
      // Set up active state
      startTierEffect(state, 3, { x: 5, y: 10 }, 'edith');
      tickEffects(state, 100);

      // Clear
      clearEffects(state);

      expect(state.zoomTarget).toBeNull();
      expect(state.zoomScale).toBe(1);
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // tickEffects — Zoom phase state machine
  // ─────────────────────────────────────────────────────────────────

  describe('tickEffects — State Machine', () => {
    beforeEach(() => {
      startTierEffect(state, 3, { x: 5, y: 10 }, 'weebo');
    });

    // ─── Phase: zoom_in ────────────────────────────────────────

    describe('zoom_in phase (0 → 1.0 over TIER_CINEMATIC_ZOOM_MS)', () => {
      it('animates scale from 1.0 to 1.5 with easing', () => {
        const dt = TIER_CINEMATIC_ZOOM_MS / 2; // Halfway
        tickEffects(state, dt);

        // Progress should be ~0.5
        expect(state.zoomProgress).toBeLessThanOrEqual(0.5 + 0.01); // Allow 1% tolerance
        expect(state.zoomProgress).toBeGreaterThanOrEqual(0.5 - 0.01);

        // Scale should be between 1.0 and 1.5
        expect(state.zoomScale).toBeGreaterThan(1);
        expect(state.zoomScale).toBeLessThan(1.5);

        expect(state.zoomPhase).toBe('zoom_in');
      });

      it('completes zoom_in and transitions to hold', () => {
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS + 1);

        expect(state.zoomPhase).toBe('hold');
        expect(state.zoomProgress).toBe(0);
        expect(state.zoomScale).toBeLessThanOrEqual(1.5 + 0.01);
      });

      it('handles overshooting (dt > TIER_CINEMATIC_ZOOM_MS)', () => {
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS * 2);

        // Progress should clamp to 1.0, not exceed
        expect(state.zoomScale).toBeLessThanOrEqual(1.5 + 0.01);
        expect(state.zoomPhase).toBe('hold');
      });

      it('accumulates dt across multiple ticks', () => {
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 3);
        expect(state.zoomProgress).toBeCloseTo(1 / 3, 1);

        tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 3);
        expect(state.zoomProgress).toBeCloseTo(2 / 3, 1);

        tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 3 + 1);
        expect(state.zoomPhase).toBe('hold'); // Should transition
      });
    });

    // ─── Phase: hold ───────────────────────────────────────────

    describe('hold phase (stay at 1.5x for TIER_CINEMATIC_HOLD_MS)', () => {
      beforeEach(() => {
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS + 1); // Enter hold
      });

      it('maintains scale at 1.5', () => {
        const prevScale = state.zoomScale;
        tickEffects(state, 100);
        expect(state.zoomScale).toBeCloseTo(prevScale, 5);
      });

      it('transitions to zoom_out after hold duration', () => {
        tickEffects(state, TIER_CINEMATIC_HOLD_MS + 1);

        expect(state.zoomPhase).toBe('zoom_out');
        expect(state.zoomProgress).toBe(0);
      });

      it('does not change dim opacity during hold', () => {
        expect(state.dimOpacity).toBe(0.4);
        tickEffects(state, TIER_CINEMATIC_HOLD_MS);
        expect(state.dimOpacity).toBe(0.4);
      });
    });

    // ─── Phase: zoom_out ───────────────────────────────────────

    describe('zoom_out phase (1.5 → 1.0, 0.4 → 1.0 over TIER_CINEMATIC_PULLBACK_MS)', () => {
      beforeEach(() => {
        // Enter zoom_out
        tickEffects(state, TIER_CINEMATIC_ZOOM_MS + 1); // zoom_in → hold
        tickEffects(state, TIER_CINEMATIC_HOLD_MS + 1);  // hold → zoom_out
      });

      it('animates scale from 1.5 down to 1.0', () => {
        const dt = TIER_CINEMATIC_PULLBACK_MS / 2;
        tickEffects(state, dt);

        expect(state.zoomScale).toBeLessThan(1.5);
        expect(state.zoomScale).toBeGreaterThan(1);
      });

      it('fades in background (dimOpacity 0.4 → 1.0)', () => {
        const dt = TIER_CINEMATIC_PULLBACK_MS / 2;
        tickEffects(state, dt);

        expect(state.dimOpacity).toBeGreaterThan(0.4);
        expect(state.dimOpacity).toBeLessThan(1);
      });

      it('completes zoom_out and resets to idle', () => {
        tickEffects(state, TIER_CINEMATIC_PULLBACK_MS + 1);

        expect(state.zoomPhase).toBe('none');
        expect(state.zoomScale).toBeCloseTo(1, 2);
        expect(state.dimOpacity).toBeCloseTo(1, 2);
        expect(state.spotlightAgent).toBeNull();
        expect(state.zoomTarget).toBeNull();
      });
    });

    // ─── Full cycle timing ─────────────────────────────────────

    it('completes full cinematic cycle in correct time', () => {
      const totalTime = TIER_CINEMATIC_ZOOM_MS + TIER_CINEMATIC_HOLD_MS + TIER_CINEMATIC_PULLBACK_MS;

      tickEffects(state, totalTime);

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBeCloseTo(1, 1);
      expect(state.dimOpacity).toBeCloseTo(1, 1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Particle animation
  // ─────────────────────────────────────────────────────────────────

  describe('Particle animation', () => {
    it('updates particle positions based on velocity', () => {
      const particle = state.particles[0];
      const initialX = particle.x;
      const initialY = particle.y;
      const vx = particle.vx;
      const vy = particle.vy;

      tickEffects(state, 16); // ~1 frame at 60fps

      // Position should have moved (assuming velocity non-zero)
      if (vx !== 0 || vy !== 0) {
        expect(particle.x).not.toBe(initialX);
        expect(particle.y).not.toBe(initialY);
      }
    });

    it('keeps particles within canvas bounds (bouncing)', () => {
      for (let i = 0; i < 100; i++) {
        tickEffects(state, 16);

        state.particles.forEach((p) => {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(864);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeLessThanOrEqual(800);
        });
      }
    });

    it('animates alpha independently of zoom phase', () => {
      const alphas: number[] = [];

      for (let i = 0; i < 50; i++) {
        tickEffects(state, 16);
        alphas.push(state.particles[0].alpha);
      }

      // Alpha should oscillate, not stay constant
      const min = Math.min(...alphas);
      const max = Math.max(...alphas);
      expect(max - min).toBeGreaterThan(0.01);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles dt = 0 (no progress)', () => {
      expect(() => {
        tickEffects(state, 0);
      }).not.toThrow();
      expect(state.zoomProgress).toBe(0);
    });

    it('handles very large dt (multiple frame skip)', () => {
      expect(() => {
        tickEffects(state, 5000); // 5 seconds in one tick
      }).not.toThrow();
      // Should end up in 'none' phase after full cycle
      expect(state.zoomPhase).toBe('none');
    });

    it('handles Tier 1 with startTierEffect (should be no-op)', () => {
      const fresh = createEffectState();
      startTierEffect(fresh, 1, { x: 5, y: 10 }, 'weebo');

      expect(fresh.zoomTarget).toBeNull();
      expect(fresh.spotlightAgent).toBeNull();
      expect(fresh.zoomPhase).toBe('none');
    });

    it('handles clearEffects during active zoom', () => {
      startTierEffect(state, 3, { x: 5, y: 10 }, 'weebo');
      tickEffects(state, 200); // Partway through zoom_in

      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBeGreaterThan(0);

      clearEffects(state);

      expect(state.zoomPhase).toBe('none');
      expect(state.zoomProgress).toBe(0);
    });

    it('handles multiple startTierEffect calls (restarts animation)', () => {
      startTierEffect(state, 3, { x: 5, y: 10 }, 'weebo');
      tickEffects(state, 100);

      const progress1 = state.zoomProgress;

      startTierEffect(state, 3, { x: 7, y: 15 }, 'edith');

      expect(state.zoomProgress).toBe(0); // Restarted
      expect(state.spotlightAgent).toBe('edith');
      expect(state.zoomTarget).toEqual({ x: 7, y: 15 });
    });
  });
});
