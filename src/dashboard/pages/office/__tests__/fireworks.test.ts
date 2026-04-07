/**
 * fireworks.test.ts — GS-011: Unit tests for the fireworks effect system.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFireworksState,
  triggerFireworks,
  tickFireworks,
  drawFireworks,
} from '../systems/effects/fireworks';
import type { FireworksState } from '../systems/effects/fireworks';

describe('fireworks effect system', () => {
  let state: FireworksState;

  beforeEach(() => {
    state = createFireworksState();
  });

  it('creates idle state', () => {
    expect(state.active).toBe(false);
    expect(state.rockets).toHaveLength(0);
    expect(state.sparks).toHaveLength(0);
  });

  it('triggerFireworks activates the system', () => {
    triggerFireworks(state, 864, 800);
    expect(state.active).toBe(true);
  });

  it('triggerFireworks schedules 4 rockets', () => {
    triggerFireworks(state, 864, 800);
    // First rocket launches immediately (delayMs=0 already launched)
    expect(state.rockets.length + state.pendingRockets.length).toBe(4);
  });

  it('first rocket launches immediately', () => {
    triggerFireworks(state, 864, 800);
    expect(state.rockets.length).toBeGreaterThanOrEqual(1);
  });

  it('pending rockets launch after delay tick', () => {
    triggerFireworks(state, 864, 800);
    const initialRockets = state.rockets.length;
    tickFireworks(state, 500, 800); // advance 500ms (covers second rocket at 400ms)
    expect(state.rockets.length).toBeGreaterThan(initialRockets);
  });

  it('rockets move upward', () => {
    triggerFireworks(state, 864, 800);
    const startY = state.rockets[0]?.y ?? 780;
    tickFireworks(state, 100, 800);
    const endY = state.rockets[0]?.y ?? 780;
    expect(endY).toBeLessThan(startY);
  });

  it('rockets explode into sparks', () => {
    triggerFireworks(state, 864, 800);
    // Force the rocket to be at explodeY
    const rocket = state.rockets[0];
    if (rocket) rocket.y = rocket.explodeY + 1;
    tickFireworks(state, 16, 800);
    expect(state.sparks.length).toBeGreaterThan(0);
  });

  it('sparks fade over time', () => {
    triggerFireworks(state, 864, 800);
    // Force explosion
    for (const r of state.rockets) r.y = r.explodeY + 1;
    tickFireworks(state, 16, 800);
    const initialAlpha = state.sparks[0]?.alpha ?? 1;
    tickFireworks(state, 1000, 800);
    const finalAlpha = state.sparks[0]?.alpha ?? 0;
    expect(finalAlpha).toBeLessThan(initialAlpha);
  });

  it('drawFireworks is a no-op when inactive', () => {
    const ctx = createMockCtx();
    drawFireworks(ctx, state);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('drawFireworks renders when active', () => {
    triggerFireworks(state, 864, 800);
    const ctx = createMockCtx();
    drawFireworks(ctx, state);
    expect(ctx.save).toHaveBeenCalled();
  });
});

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;
}

// biome-ignore lint: vitest globals
declare const vi: typeof import('vitest').vi;
