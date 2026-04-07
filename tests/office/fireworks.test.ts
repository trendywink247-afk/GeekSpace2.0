/**
 * fireworks.test.ts — GS-011: Tests for the fireworks effect system.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFireworksState,
  triggerFireworks,
  tickFireworks,
  drawFireworks,
} from '../../src/dashboard/pages/office/systems/effects/fireworks';
import type { FireworksState } from '../../src/dashboard/pages/office/systems/effects/fireworks';

function createMockCtx(): CanvasRenderingContext2D {
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

describe('fireworks effect system (GS-011)', () => {
  let state: FireworksState;

  beforeEach(() => {
    state = createFireworksState();
  });

  it('creates idle state', () => {
    expect(state.active).toBe(false);
    expect(state.rockets).toHaveLength(0);
    expect(state.sparks).toHaveLength(0);
    expect(state.pendingRockets).toHaveLength(0);
  });

  it('triggerFireworks activates the system', () => {
    triggerFireworks(state, 864, 800);
    expect(state.active).toBe(true);
  });

  it('schedules 4 rockets total', () => {
    triggerFireworks(state, 864, 800);
    const total = state.rockets.length + state.pendingRockets.length;
    expect(total).toBe(4);
  });

  it('first rocket launches immediately (delayMs = 0)', () => {
    triggerFireworks(state, 864, 800);
    expect(state.rockets.length).toBeGreaterThanOrEqual(1);
  });

  it('pending rockets launch after tick', () => {
    triggerFireworks(state, 864, 800);
    const after1 = state.rockets.length;
    tickFireworks(state, 500, 800); // 500ms > 400ms delay
    expect(state.rockets.length).toBeGreaterThan(after1);
  });

  it('rockets move upward', () => {
    triggerFireworks(state, 864, 800);
    const startY = state.rockets[0]!.y;
    tickFireworks(state, 50, 800);
    const endY = state.rockets.find((r) => !r.exploded)?.y ?? startY;
    expect(endY).toBeLessThan(startY);
  });

  it('rockets generate sparks when they explode', () => {
    triggerFireworks(state, 864, 800);
    // Force first rocket to its explode point
    const r = state.rockets[0];
    if (r) r.y = r.explodeY + 1;
    tickFireworks(state, 16, 800);
    expect(state.sparks.length).toBeGreaterThan(0);
  });

  it('sparks fade and are culled', () => {
    triggerFireworks(state, 864, 800);
    for (const r of state.rockets) r.y = r.explodeY + 1;
    tickFireworks(state, 16, 800);
    const initialSparks = state.sparks.length;
    tickFireworks(state, 5000, 800);
    expect(state.sparks.length).toBeLessThan(initialSparks);
  });

  it('drawFireworks is a no-op when inactive', () => {
    const ctx = createMockCtx();
    drawFireworks(ctx, state);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('drawFireworks calls save when active', () => {
    triggerFireworks(state, 864, 800);
    const ctx = createMockCtx();
    drawFireworks(ctx, state);
    expect(ctx.save).toHaveBeenCalled();
  });
});
