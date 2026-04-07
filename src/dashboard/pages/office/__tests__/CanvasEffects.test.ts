/**
 * @fileoverview CanvasEffects particle pool and animation state tests
 * Tests effect state lifecycle, particle pooling, and zoom/spotlight animations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEffectState,
  returnEffectState,
  startTierEffect,
  tickEffects,
  clearEffects,
  type CanvasEffectState,
} from '../systems/effects/CanvasEffects';

describe('CanvasEffects — Particle Pool & Animation State', () => {
  let state: CanvasEffectState;

  beforeEach(() => {
    state = createEffectState();
  });

  describe('createEffectState() initialization', () => {
    it('creates effect state with default idle values', () => {
      expect(state.zoomTarget).toBeNull();
      expect(state.zoomScale).toBe(1);
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });

    it('initializes 15 particles with random positions and velocities', () => {
      expect(state.particles).toHaveLength(15);
      state.particles.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(864);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(800);
        expect(p.vx).toBeGreaterThanOrEqual(-0.15);
        expect(p.vx).toBeLessThanOrEqual(0.15);
      });
    });
  });

  describe('Tier 3 cinematic effect', () => {
    it('initiates zoom_in with correct state', () => {
      const agentPos = { x: 432, y: 400 };
      startTierEffect(state, 3, agentPos, 'agent-1');

      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.zoomProgress).toBe(0);
      expect(state.zoomTarget).toEqual(agentPos);
      expect(state.spotlightAgent).toBe('agent-1');
      expect(state.dimOpacity).toBe(0.4);
    });
  });

  describe('Tier 2 spotlight effect', () => {
    it('enables spotlight without zoom', () => {
      startTierEffect(state, 2, { x: 400, y: 300 }, 'agent-2');
      expect(state.spotlightAgent).toBe('agent-2');
      expect(state.dimOpacity).toBe(0.7);
      expect(state.zoomPhase).toBe('none');
    });
  });

  describe('Tier 1 minimal effect', () => {
    it('has no effect', () => {
      startTierEffect(state, 1, { x: 100, y: 100 }, 'agent-1');
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });
  });

  describe('Particle physics', () => {
    it('particles move by velocity', () => {
      const p = state.particles[0];
      const x0 = p.x;
      tickEffects(state, 16);
      if (p.vx !== 0) expect(p.x).not.toBe(x0);
    });

    it('particles stay within bounds', () => {
      for (let i = 0; i < 1000; i++) {
        tickEffects(state, 16);
      }
      state.particles.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(864);
      });
    });
  });

  describe('clearEffects() reset', () => {
    it('resets all animation state', () => {
      startTierEffect(state, 3, { x: 400, y: 400 }, 'agent-1');
      clearEffects(state);
      expect(state.zoomTarget).toBeNull();
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
    });
  });
});
