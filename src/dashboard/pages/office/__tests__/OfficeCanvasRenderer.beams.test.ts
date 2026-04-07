/**
 * @fileoverview OfficeCanvasRenderer particle beam visualization tests
 * Tests beam drawing, particle trails, and color fading
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { drawBeams } from '../canvas/renderer/OfficeCanvasRenderer';
import type { ParticleBeam } from '../entities/types';
import { AGENT_COLORS } from '../constants';

describe('OfficeCanvasRenderer — Particle Beams', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 864;
    canvas.height = 800;
    ctx = canvas.getContext('2d')!;

    vi.spyOn(ctx, 'fillRect');
    vi.spyOn(ctx, 'fillStyle', 'set');
    vi.spyOn(ctx, 'globalAlpha', 'set');
  });

  // ─── Beam initialization and rendering ─────────────────────────────
  describe('drawBeams — particle rendering', () => {
    it('renders particles as small squares at (x, y)', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0.5, vy: 0.2, life: 0.8 },
            { x: 330, y: 485, vx: 0.5, vy: 0.2, life: 0.6 },
          ],
        },
      ];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBeams(ctx, beams);

      // TODO: Verify fillRect called for each particle
      // Particle size typically 2×2 or 3×3 pixels
      // expect(fillRectSpy).toHaveBeenCalledWith(320, 480, 2, 2);
      // expect(fillRectSpy).toHaveBeenCalledWith(330, 485, 2, 2);
    });

    it('renders empty beam list without error', () => {
      const beams: ParticleBeam[] = [];
      expect(() => drawBeams(ctx, beams)).not.toThrow();
    });

    it('renders beam with single particle', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 1.0 },
          ],
        },
      ];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBeams(ctx, beams);

      // At least one particle should be drawn
      expect(fillRectSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders beam with many particles (10+)', () => {
      const particles = Array.from({ length: 10 }, (_, i) => ({
        x: 320 + i * 2,
        y: 480 + i,
        vx: 0.1,
        vy: 0.1,
        life: 1 - i / 10,
      }));

      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles,
        },
      ];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBeams(ctx, beams);

      // All particles should be rendered
      expect(fillRectSpy.mock.calls.length).toBeGreaterThanOrEqual(10);
    });
  });

  // ─── Beam color based on agent ─────────────────────────────────────
  describe('drawBeams — color from source agent', () => {
    it('uses AGENT_COLORS[fromAgent] as particle color', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 1.0 },
          ],
        },
      ];

      const fillStyleSpy = vi.spyOn(ctx, 'fillStyle', 'set');
      drawBeams(ctx, beams);

      // TODO: Verify fillStyle set to AGENT_COLORS['weebo']
      // expect(fillStyleSpy).toHaveBeenCalledWith(AGENT_COLORS['weebo']);
    });

    it('beam from different agents use different colors', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [{ x: 320, y: 480, vx: 0, vy: 0, life: 1.0 }],
        },
        {
          fromAgent: 'aria',
          toAgent: 'weebo',
          particles: [{ x: 330, y: 490, vx: 0, vy: 0, life: 1.0 }],
        },
      ];

      const fillStyleSpy = vi.spyOn(ctx, 'fillStyle', 'set');
      drawBeams(ctx, beams);

      // TODO: Verify two different colors set
      // expect(fillStyleSpy).toHaveBeenCalledWith(AGENT_COLORS['weebo']);
      // expect(fillStyleSpy).toHaveBeenCalledWith(AGENT_COLORS['aria']);
    });

    it('unknown agent ID uses default/fallback color', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'unknown-agent',
          toAgent: 'edith',
          particles: [{ x: 320, y: 480, vx: 0, vy: 0, life: 1.0 }],
        },
      ];

      // TODO: Should not throw on unknown agent
      expect(() => drawBeams(ctx, beams)).not.toThrow();
    });
  });

  // ─── Particle life/opacity fading ──────────────────────────────────
  describe('drawBeams — alpha based on particle.life', () => {
    it('particle with life=1.0 is fully opaque', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 1.0 },
          ],
        },
      ];

      const globalAlphaSpy = vi.spyOn(ctx, 'globalAlpha', 'set');
      drawBeams(ctx, beams);

      // TODO: Verify globalAlpha set to 1.0 for this particle
      // expect(globalAlphaSpy).toHaveBeenCalledWith(1.0);
    });

    it('particle with life=0.5 is 50% opaque', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 0.5 },
          ],
        },
      ];

      const globalAlphaSpy = vi.spyOn(ctx, 'globalAlpha', 'set');
      drawBeams(ctx, beams);

      // TODO: Verify globalAlpha set to 0.5
      // expect(globalAlphaSpy).toHaveBeenCalledWith(0.5);
    });

    it('particle with life=0.0 is invisible (skip render)', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 0.0 },
          ],
        },
      ];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      const initialCalls = fillRectSpy.mock.calls.length;

      drawBeams(ctx, beams);

      // TODO: Verify life=0 particles not rendered (or globalAlpha=0)
      // expect(fillRectSpy.mock.calls.length).toBe(initialCalls);
    });

    it('multiple particles show gradient fade (life: 1.0 → 0.8 → 0.6)', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0.1, vy: 0, life: 1.0 },
            { x: 330, y: 480, vx: 0.1, vy: 0, life: 0.8 },
            { x: 340, y: 480, vx: 0.1, vy: 0, life: 0.6 },
          ],
        },
      ];

      const globalAlphaSpy = vi.spyOn(ctx, 'globalAlpha', 'set');
      drawBeams(ctx, beams);

      // TODO: Verify three different alpha values set
      // Confirms particles fade out as trail extends
    });
  });

  // ─── Canvas bounds checking ────────────────────────────────────────
  describe('drawBeams — particle positioning', () => {
    it('particles outside canvas bounds are still rendered (or clipped)', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: -10, y: 400, vx: 0, vy: 0, life: 1.0 }, // Out of bounds left
            { x: 900, y: 400, vx: 0, vy: 0, life: 1.0 }, // Out of bounds right
            { x: 400, y: -10, vx: 0, vy: 0, life: 1.0 }, // Out of bounds top
            { x: 400, y: 900, vx: 0, vy: 0, life: 1.0 }, // Out of bounds bottom
          ],
        },
      ];

      // Should not throw on out-of-bounds particles
      expect(() => drawBeams(ctx, beams)).not.toThrow();

      // TODO: Verify canvas.save()/restore() handles clipping
      // or particles are clipped by canvas boundary
    });

    it('particle position clamped to canvas if required', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 2000, y: 2000, vx: 0, vy: 0, life: 1.0 },
          ],
        },
      ];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBeams(ctx, beams);

      // TODO: Verify fillRect called with clamped coordinates
      // Or verify particle not rendered at all (clipping)
    });
  });

  // ─── Multiple simultaneous beams ───────────────────────────────────
  describe('drawBeams — multiple agent communication', () => {
    it('renders 3+ simultaneous beams without interference', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [{ x: 320, y: 480, vx: 0, vy: 0, life: 1.0 }],
        },
        {
          fromAgent: 'aria',
          toAgent: 'forge',
          particles: [{ x: 400, y: 500, vx: 0, vy: 0, life: 0.8 }],
        },
        {
          fromAgent: 'edith',
          toAgent: 'weebo',
          particles: [{ x: 350, y: 490, vx: 0, vy: 0, life: 0.6 }],
        },
      ];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBeams(ctx, beams);

      // All beams rendered
      expect(fillRectSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('beam from agent to itself (self-communication) renders', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'weebo', // Same agent
          particles: [{ x: 320, y: 480, vx: 0, vy: 0, life: 1.0 }],
        },
      ];

      expect(() => drawBeams(ctx, beams)).not.toThrow();
    });
  });
});
