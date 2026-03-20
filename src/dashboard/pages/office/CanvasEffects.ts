import type { AnimationTier } from './AnimationTierSelector';
import type { AgentId } from './types';
import { TIER_CINEMATIC_ZOOM_MS, TIER_CINEMATIC_HOLD_MS, TIER_CINEMATIC_PULLBACK_MS } from './constants';

export interface CanvasEffectState {
  zoomTarget: { x: number; y: number } | null;
  zoomScale: number;
  zoomProgress: number;
  zoomPhase: 'none' | 'zoom_in' | 'hold' | 'zoom_out';
  spotlightAgent: AgentId | null;
  dimOpacity: number;
  particles: Array<{ x: number; y: number; vx: number; vy: number; alpha: number }>;
}

export function createEffectState(): CanvasEffectState {
  return {
    zoomTarget: null, zoomScale: 1, zoomProgress: 0, zoomPhase: 'none',
    spotlightAgent: null, dimOpacity: 1,
    particles: Array.from({ length: 15 }, () => ({
      x: Math.random() * 864, y: Math.random() * 800,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.05,
    })),
  };
}

export function startTierEffect(state: CanvasEffectState, tier: AnimationTier, agentPos: { x: number; y: number }, agentId: AgentId): void {
  if (tier === 3) {
    state.zoomTarget = agentPos;
    state.zoomPhase = 'zoom_in';
    state.zoomProgress = 0;
    state.spotlightAgent = agentId;
    state.dimOpacity = 0.4;
  } else if (tier === 2) {
    state.spotlightAgent = agentId;
    state.dimOpacity = 0.7;
  }
  // Tier 1: no global effect
}

export function clearEffects(state: CanvasEffectState): void {
  state.zoomTarget = null;
  state.zoomScale = 1;
  state.zoomProgress = 0;
  state.zoomPhase = 'none';
  state.spotlightAgent = null;
  state.dimOpacity = 1;
}

export function tickEffects(state: CanvasEffectState, dt: number): void {
  if (state.zoomPhase === 'zoom_in') {
    state.zoomProgress += dt / TIER_CINEMATIC_ZOOM_MS;
    state.zoomScale = 1 + 0.5 * easeOutCubic(Math.min(state.zoomProgress, 1));
    if (state.zoomProgress >= 1) { state.zoomPhase = 'hold'; state.zoomProgress = 0; }
  } else if (state.zoomPhase === 'hold') {
    state.zoomProgress += dt / TIER_CINEMATIC_HOLD_MS;
    if (state.zoomProgress >= 1) { state.zoomPhase = 'zoom_out'; state.zoomProgress = 0; }
  } else if (state.zoomPhase === 'zoom_out') {
    state.zoomProgress += dt / TIER_CINEMATIC_PULLBACK_MS;
    state.zoomScale = 1.5 - 0.5 * easeOutCubic(Math.min(state.zoomProgress, 1));
    state.dimOpacity = 0.4 + 0.6 * easeOutCubic(Math.min(state.zoomProgress, 1));
    if (state.zoomProgress >= 1) {
      state.zoomPhase = 'none'; state.zoomScale = 1; state.dimOpacity = 1;
      state.spotlightAgent = null; state.zoomTarget = null;
    }
  }

  for (const p of state.particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > 864) p.vx *= -1;
    if (p.y < 0 || p.y > 800) p.vy *= -1;
    p.alpha = 0.02 + Math.sin(Date.now() * 0.001 + p.x) * 0.03;
  }
}

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
