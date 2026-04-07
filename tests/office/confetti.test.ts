/**
 * confetti.test.ts — GS-011: Tests for the confetti particle system.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createConfettiState,
  triggerConfetti,
  tickConfetti,
  drawConfetti,
} from '../../src/dashboard/pages/office/systems/effects/confetti';
import type { ConfettiState } from '../../src/dashboard/pages/office/systems/effects/confetti';

function createMockCtx(): CanvasRenderingContext2D {
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

describe('confetti particle system (GS-011)', () => {
  let state: ConfettiState;

  beforeEach(() => {
    state = createConfettiState();
  });

  it('creates idle state with no particles', () => {
    expect(state.active).toBe(false);
    expect(state.particles).toHaveLength(0);
    expect(state.elapsed).toBe(0);
  });

  it('triggerConfetti spawns 160 particles', () => {
    triggerConfetti(state, 864, 'celebration');
    expect(state.particles.length).toBe(160);
    expect(state.active).toBe(true);
    expect(state.mode).toBe('celebration');
  });

  it('triggerConfetti sets broken mode', () => {
    triggerConfetti(state, 864, 'broken');
    expect(state.mode).toBe('broken');
    expect(state.particles.length).toBe(160);
  });

  it('particles start above canvas', () => {
    triggerConfetti(state, 864);
    expect(state.particles.every((p) => p.y < 0)).toBe(true);
  });

  it('tickConfetti advances elapsed', () => {
    triggerConfetti(state, 864);
    tickConfetti(state, 200, 864, 800);
    expect(state.elapsed).toBe(200);
  });

  it('tickConfetti deactivates after 4000ms', () => {
    triggerConfetti(state, 864);
    tickConfetti(state, 4100, 864, 800);
    expect(state.active).toBe(false);
    expect(state.particles).toHaveLength(0);
  });

  it('drawConfetti is a no-op when inactive', () => {
    const ctx = createMockCtx();
    drawConfetti(ctx, state);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('drawConfetti calls save when active', () => {
    triggerConfetti(state, 864);
    for (const p of state.particles) p.y = 100; // move into canvas bounds
    const ctx = createMockCtx();
    drawConfetti(ctx, state);
    expect(ctx.save).toHaveBeenCalled();
  });

  it('re-trigger resets elapsed to 0', () => {
    triggerConfetti(state, 864);
    tickConfetti(state, 500, 864, 800);
    triggerConfetti(state, 864);
    expect(state.elapsed).toBe(0);
  });
});
