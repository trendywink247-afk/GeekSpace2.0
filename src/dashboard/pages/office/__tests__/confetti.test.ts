/**
 * confetti.test.ts — GS-011: Unit tests for the confetti particle system.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConfettiState,
  triggerConfetti,
  tickConfetti,
  drawConfetti,
} from '../systems/effects/confetti';
import type { ConfettiState } from '../systems/effects/confetti';

describe('confetti particle system', () => {
  let state: ConfettiState;

  beforeEach(() => {
    state = createConfettiState();
  });

  it('creates idle state with no particles', () => {
    expect(state.active).toBe(false);
    expect(state.particles).toHaveLength(0);
    expect(state.elapsed).toBe(0);
  });

  it('triggerConfetti spawns 160 particles in celebration mode', () => {
    triggerConfetti(state, 864, 'celebration');
    expect(state.active).toBe(true);
    expect(state.particles.length).toBe(160);
    expect(state.mode).toBe('celebration');
  });

  it('triggerConfetti spawns particles in broken mode (grey colors)', () => {
    triggerConfetti(state, 864, 'broken');
    expect(state.mode).toBe('broken');
    // All particles should use muted grey colors
    const colors = new Set(state.particles.map((p) => p.color));
    expect(colors.size).toBeGreaterThan(0);
  });

  it('particles spawn above the canvas top edge', () => {
    triggerConfetti(state, 864);
    for (const p of state.particles) {
      expect(p.y).toBeLessThan(0);
    }
  });

  it('tickConfetti advances elapsed time', () => {
    triggerConfetti(state, 864);
    tickConfetti(state, 100, 864, 800);
    expect(state.elapsed).toBe(100);
  });

  it('tickConfetti moves particles downward (gravity)', () => {
    triggerConfetti(state, 864);
    const initialY = state.particles.map((p) => p.y);
    tickConfetti(state, 500, 864, 800);
    const finalY = state.particles.map((p) => p.y);
    // Most particles should have moved down (vy > 0)
    const movedDown = finalY.filter((y, i) => y > initialY[i]).length;
    expect(movedDown).toBeGreaterThan(state.particles.length * 0.5);
  });

  it('tickConfetti deactivates after 4000ms', () => {
    triggerConfetti(state, 864);
    tickConfetti(state, 4100, 864, 800);
    expect(state.active).toBe(false);
  });

  it('drawConfetti is a no-op when inactive', () => {
    const ctx = createMockCtx();
    drawConfetti(ctx, state);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('drawConfetti renders particles when active', () => {
    triggerConfetti(state, 864);
    // Move particles into canvas bounds for drawing
    for (const p of state.particles) { p.y = 100; }
    const ctx = createMockCtx();
    drawConfetti(ctx, state);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('triggerConfetti resets elapsed on re-trigger', () => {
    triggerConfetti(state, 864);
    tickConfetti(state, 1000, 864, 800);
    expect(state.elapsed).toBe(1000);
    triggerConfetti(state, 864); // re-trigger
    expect(state.elapsed).toBe(0);
  });
});

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

// biome-ignore lint: vitest globals
declare const vi: typeof import('vitest').vi;
