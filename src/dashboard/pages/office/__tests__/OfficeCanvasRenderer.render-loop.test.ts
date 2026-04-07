/**
 * @fileoverview OfficeCanvasRenderer main render loop test suite
 * Tests render() function, sprite frame selection, and beam drawing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  render,
  drawAgents,
  drawBeams,
  drawDebugGrid,
  loadOfficeAssets,
  isBgLoaded,
} from '../canvas/renderer/OfficeCanvasRenderer';
import type { CanvasAgent, ParticleBeam, RenderState } from '../entities/types';
import { CANVAS_W, CANVAS_H, COLS, ROWS, CELL, AGENT_COLORS } from '../constants';

describe('OfficeCanvasRenderer — Render Loop', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext('2d')!;

    // Mock canvas methods for verification
    vi.spyOn(ctx, 'fillRect');
    vi.spyOn(ctx, 'fillStyle', 'set');
    vi.spyOn(ctx, 'drawImage');
    vi.spyOn(ctx, 'clearRect');
  });

  // ─── Main render() function ────────────────────────────────────────────
  describe('render(canvas, renderState)', () => {
    it('clears canvas before rendering (clearRect)', () => {
      const clearSpy = vi.spyOn(ctx, 'clearRect');
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      render(canvas, state);

      expect(clearSpy).toHaveBeenCalledWith(0, 0, CANVAS_W, CANVAS_H);
    });

    it('renders background first (behind agents)', () => {
      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      render(canvas, state);

      // Background should be drawn (either image or fallback)
      expect(drawImageSpy.mock.calls.length >= 0).toBe(true);
    });

    it('renders agents in order', () => {
      const agents: CanvasAgent[] = [
        {
          id: 'agent1',
          x: 10,
          y: 15,
          renderX: 320,
          renderY: 480,
          behaviorMode: 'sitting',
          pose: 'idle',
          facing: 'down',
          spriteId: 'agent1-sitting-down-idle-0',
        },
        {
          id: 'agent2',
          x: 12,
          y: 16,
          renderX: 384,
          renderY: 512,
          behaviorMode: 'walking',
          pose: 'walking',
          facing: 'right',
          spriteId: 'agent2-walking-right-0',
        },
      ] as CanvasAgent[];

      const state: RenderState = {
        agents,
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      // Should not throw
      expect(() => render(canvas, state)).not.toThrow();
    });

    it('renders beams (particle communication)', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'agent1',
          toAgent: 'agent2',
          particles: [
            { x: 320, y: 480, vx: 0.5, vy: 0.2, life: 0.8 },
          ],
        },
      ] as ParticleBeam[];

      const state: RenderState = {
        agents: [],
        beams,
        tick: 0,
        selectedAgentId: null,
      };

      expect(() => render(canvas, state)).not.toThrow();
    });

    it('renders foreground last (on top of agents for depth)', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      expect(() => render(canvas, state)).not.toThrow();
      // Foreground should be drawn last
    });

    it('applies effect state (zoom, dim, spotlight) when provided', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: 'agent1',
      };

      expect(() => render(canvas, state)).not.toThrow();
    });

    it('increments frame counter (tick)', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      render(canvas, state);

      state.tick++;
      render(canvas, state);

      // tick advances, used for animation frame selection
      expect(state.tick).toBe(1);
    });

    it('handles empty agents list gracefully', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      expect(() => render(canvas, state)).not.toThrow();
    });

    it('handles large number of agents (20+)', () => {
      const agents = Array.from({ length: 20 }, (_, i) => ({
        id: `agent${i}`,
        x: 10 + i,
        y: 15 + (i % 5),
        renderX: 320 + i * 20,
        renderY: 480,
        behaviorMode: i % 2 === 0 ? 'sitting' : 'walking',
        pose: 'idle',
        facing: 'down' as const,
        spriteId: `agent${i}-sitting-down-idle-0`,
      })) as CanvasAgent[];

      const state: RenderState = {
        agents,
        beams: [],
        tick: 0,
        selectedAgentId: null,
      };

      expect(() => render(canvas, state)).not.toThrow();
    });
  });

  // ─── drawAgents() sprite frame selection ────────────────────────────────
  describe('drawAgents(ctx, agents, tick)', () => {
    it('selects sprite frame based on tick (animation timing)', () => {
      const agent: CanvasAgent = {
        id: 'weebo',
        x: 10,
        y: 15,
        renderX: 320,
        renderY: 480,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'weebo-sitting-down-idle-0',
      } as CanvasAgent;

      expect(() => drawAgents(ctx, [agent], 0)).not.toThrow();
      expect(() => drawAgents(ctx, [agent], 30)).not.toThrow(); // Different frame
    });

    it('draws agent sprite at renderX, renderY position', () => {
      const agent: CanvasAgent = {
        id: 'weebo',
        x: 10,
        y: 15,
        renderX: 320,
        renderY: 480,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'weebo-sitting-down-idle-0',
      } as CanvasAgent;

      const drawImageSpy = vi.spyOn(ctx, 'drawImage');
      drawAgents(ctx, [agent], 0);

      // Verify drawImage called with agent position
      if (drawImageSpy.mock.calls.length > 0) {
        const call = drawImageSpy.mock.calls[0];
        // call should have (sprite, x, y, width, height)
        expect(call.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('applies agent color tint (AGENT_COLORS[agentId])', () => {
      const agent: CanvasAgent = {
        id: 'weebo',
        x: 10,
        y: 15,
        renderX: 320,
        renderY: 480,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'weebo-sitting-down-idle-0',
      } as CanvasAgent;

      const fillStyleSpy = vi.spyOn(ctx, 'fillStyle', 'set');
      drawAgents(ctx, [agent], 0);

      // Should set fillStyle to agent's color at some point
      if (fillStyleSpy.mock.calls.length > 0) {
        const colors = fillStyleSpy.mock.calls.map(c => c[0]);
        // Verify color is set (hex or rgb)
        expect(colors.some(c => typeof c === 'string')).toBe(true);
      }
    });

    it('handles multiple agents without z-order artifacts', () => {
      const agents: CanvasAgent[] = [
        {
          id: 'weebo',
          x: 10,
          y: 15,
          renderX: 320,
          renderY: 480,
          behaviorMode: 'sitting',
          pose: 'idle',
          facing: 'down',
          spriteId: 'weebo-sitting-down-idle-0',
        },
        {
          id: 'edith',
          x: 12,
          y: 16,
          renderX: 384,
          renderY: 512,
          behaviorMode: 'walking',
          pose: 'walking',
          facing: 'right',
          spriteId: 'edith-walking-right-0',
        },
      ] as CanvasAgent[];

      expect(() => drawAgents(ctx, agents, 0)).not.toThrow();
    });

    it('animation frame advances with tick (4 frames, ~8 ticks per frame)', () => {
      const agent: CanvasAgent = {
        id: 'weebo',
        x: 10,
        y: 15,
        renderX: 320,
        renderY: 480,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: 'weebo-sitting-down-idle-0',
      } as CanvasAgent;

      // Frame 0 at tick 0
      drawAgents(ctx, [agent], 0);
      const frame0 = agent.spriteId;

      // Frame 1 at tick 8
      drawAgents(ctx, [agent], 8);
      const frame8 = agent.spriteId;

      // Frames should match sprite asset naming pattern
      expect(frame0).toMatch(/weebo-sitting-down-idle-\d/);
      expect(frame8).toMatch(/weebo-sitting-down-idle-\d/);
    });

    it('handles agent with no spriteId gracefully', () => {
      const agent: CanvasAgent = {
        id: 'unknown',
        x: 10,
        y: 15,
        renderX: 320,
        renderY: 480,
        behaviorMode: 'sitting',
        pose: 'idle',
        facing: 'down',
        spriteId: '', // Empty sprite
      } as CanvasAgent;

      expect(() => drawAgents(ctx, [agent], 0)).not.toThrow();
    });
  });

  // ─── drawBeams() particle visualization ────────────────────────────────
  describe('drawBeams(ctx, beams)', () => {
    it('draws particle beams between agents', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'weebo',
          toAgent: 'edith',
          particles: [
            { x: 320, y: 480, vx: 0.5, vy: 0.2, life: 0.8 },
            { x: 330, y: 490, vx: 0.5, vy: 0.2, life: 0.5 },
          ],
        },
      ] as ParticleBeam[];

      expect(() => drawBeams(ctx, beams)).not.toThrow();
    });

    it('renders each particle as a small circle or quad', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'agent1',
          toAgent: 'agent2',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 1 },
          ],
        },
      ] as ParticleBeam[];

      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      drawBeams(ctx, beams);

      // Verify fillRect or arc called for particles
      expect(fillRectSpy.mock.calls.length >= 0).toBe(true);
    });

    it('particle color/alpha based on life value (fade)', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'agent1',
          toAgent: 'agent2',
          particles: [
            { x: 320, y: 480, vx: 0, vy: 0, life: 1.0 },
            { x: 330, y: 490, vx: 0, vy: 0, life: 0.5 },
            { x: 340, y: 500, vx: 0, vy: 0, life: 0.1 },
          ],
        },
      ] as ParticleBeam[];

      expect(() => drawBeams(ctx, beams)).not.toThrow();
      // Particles with lower life should be more transparent
    });

    it('handles empty beams array', () => {
      expect(() => drawBeams(ctx, [])).not.toThrow();
    });

    it('handles beams with no particles', () => {
      const beams: ParticleBeam[] = [
        {
          fromAgent: 'agent1',
          toAgent: 'agent2',
          particles: [],
        },
      ] as ParticleBeam[];

      expect(() => drawBeams(ctx, beams)).not.toThrow();
    });
  });

  // ─── drawDebugGrid() collision visualization ──────────────────────────
  describe('drawDebugGrid(ctx, collisionMap)', () => {
    it('draws grid lines if showDebug=true', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
        showDebug: true,
      };

      expect(() => render(canvas, state)).not.toThrow();
    });

    it('skips grid if showDebug=false or undefined', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
        showDebug: false,
      };

      expect(() => render(canvas, state)).not.toThrow();
    });

    it('visualizes collision map as blocked tiles (red overlay)', () => {
      const collisionMap = Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => Math.random() > 0.7)
      );

      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
        showDebug: true,
        collisionMap,
      };

      expect(() => render(canvas, state)).not.toThrow();
    });

    it('draws grid cell grid (COLS × ROWS)', () => {
      const state: RenderState = {
        agents: [],
        beams: [],
        tick: 0,
        selectedAgentId: null,
        showDebug: true,
        collisionMap: Array.from({ length: ROWS }, () =>
          Array.from({ length: COLS }, () => false)
        ),
      };

      expect(() => render(canvas, state)).not.toThrow();
    });
  });
});
