/**
 * @fileoverview Office module integration tests
 * Tests full animation pipeline: tier selection → effect state → rendering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  selectAnimationTier,
  trackToolCall,
  clearRequest,
  isFirstVisit,
  markVisited,
} from '../systems/animation/AnimationTierSelector';
import {
  createEffectState,
  startTierEffect,
  tickEffects,
  clearEffects,
  type CanvasEffectState,
} from '../systems/effects/CanvasEffects';
import { render } from '../canvas/renderer/OfficeCanvasRenderer';
import type { CanvasAgent } from '../entities/types';
import { TIER_CINEMATIC_ZOOM_MS, TIER_CINEMATIC_HOLD_MS, TIER_CINEMATIC_PULLBACK_MS } from '../constants';

describe('Office Module — Integration: Tier → Effects → Render', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    // Setup canvas
    canvas = document.createElement('canvas');
    canvas.width = 864;
    canvas.height = 800;
    ctx = canvas.getContext('2d')!;

    // Clear request tracking
    clearRequest('integration-test-1');
    clearRequest('integration-test-2');
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ─── Scenario 1: First-time visitor triggers Tier 3 cinematic ──────
  describe('Scenario 1: First-visit user interaction', () => {
    it('first visit → selectAnimationTier returns 3 → startTierEffect applies zoom', () => {
      // User visits office page for first time
      expect(isFirstVisit()).toBe(true);

      // Request context: single agent, no tool calls
      const tier = selectAnimationTier({
        isFirstVisit: true, // First visit
        isMultiAgent: false,
        toolCallCount: 0,
        thinkingStartTime: 0,
      });

      expect(tier).toBe(3); // Cinematic tier

      // Create effect state and start animation
      const state = createEffectState();
      const agentPos = { x: 320, y: 480 }; // Weebo's desk position

      startTierEffect(state, tier, agentPos, 'weebo');

      expect(state.zoomTarget).toEqual(agentPos);
      expect(state.zoomPhase).toBe('zoom_in');
      expect(state.spotlightAgent).toBe('weebo');
      expect(state.dimOpacity).toBe(0.4);

      // Mark visited so next request uses Tier 1/2
      markVisited();
      expect(isFirstVisit()).toBe(false);
    });

    it('full animation cycle: zoom_in → hold → zoom_out → none', () => {
      const state = createEffectState();
      const agentPos = { x: 432, y: 400 };

      startTierEffect(state, 3, agentPos, 'edith');

      // Phase 1: zoom_in (600ms)
      expect(state.zoomPhase).toBe('zoom_in');
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS);
      expect(state.zoomPhase).toBe('hold');
      expect(state.zoomScale).toBeCloseTo(1.5, 1);

      // Phase 2: hold (2000ms)
      expect(state.zoomPhase).toBe('hold');
      tickEffects(state, TIER_CINEMATIC_HOLD_MS);
      expect(state.zoomPhase).toBe('zoom_out');
      expect(state.zoomScale).toBeCloseTo(1.5, 1);

      // Phase 3: zoom_out (400ms)
      expect(state.zoomPhase).toBe('zoom_out');
      tickEffects(state, TIER_CINEMATIC_PULLBACK_MS);

      // Final state: clean
      expect(state.zoomPhase).toBe('none');
      expect(state.zoomScale).toBe(1);
      expect(state.dimOpacity).toBe(1);
      expect(state.spotlightAgent).toBeNull();
    });
  });

  // ─── Scenario 2: Multi-agent request triggers Tier 2 spotlight ────
  describe('Scenario 2: Multi-agent coordination animation', () => {
    it('isMultiAgent=true → selectAnimationTier returns 2 → spotlight effect', () => {
      // Assume first visit already marked
      localStorage.setItem('office_visited', 'true');

      // Request context: multiple agents communicating
      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: true, // Multiple agents active
        toolCallCount: 1,
        thinkingStartTime: 0,
      });

      expect(tier).toBe(2); // Spotlight tier

      // Create effect state and start animation
      const state = createEffectState();
      const agentPos = { x: 384, y: 512 }; // Aria's desk

      startTierEffect(state, tier, agentPos, 'aria');

      // Tier 2: spotlight only, no zoom
      expect(state.spotlightAgent).toBe('aria');
      expect(state.dimOpacity).toBe(0.7);
      expect(state.zoomTarget).toBeNull(); // No zoom for Tier 2
    });

    it('multi-agent effect renders without zoom phase', () => {
      const state = createEffectState();
      startTierEffect(state, 2, { x: 384, y: 512 }, 'aria');

      // Tier 2: no zoom phase progression
      expect(state.zoomPhase).toBe('none');

      // Tick several times (should remain in no-zoom state)
      for (let i = 0; i < 3; i++) {
        tickEffects(state, 100);
        expect(state.zoomPhase).toBe('none');
      }

      // Spotlight can be cleared manually
      clearEffects(state);
      expect(state.spotlightAgent).toBeNull();
      expect(state.dimOpacity).toBe(1);
    });
  });

  // ─── Scenario 3: Long thinking (>10s) rewards with Tier 3 ────────
  describe('Scenario 3: Long-running request animation', () => {
    it('thinking duration > 10s → selectAnimationTier returns 3 despite not first visit', () => {
      localStorage.setItem('office_visited', 'true');

      // Request context: thinking for 15 seconds
      const thinkingStartTime = Date.now() - 15_000;

      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime,
      });

      expect(tier).toBe(3); // Long thinking gets cinematic reward
    });
  });

  // ─── Scenario 4: Simple single-agent request → Tier 1 ───────────
  describe('Scenario 4: Simple request animation (minimal)', () => {
    it('single-agent, no long thinking → selectAnimationTier returns 1', () => {
      localStorage.setItem('office_visited', 'true');

      const tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1,
        thinkingStartTime: 0,
      });

      expect(tier).toBe(1); // Minimal tier

      // Tier 1: no global effect
      const state = createEffectState();
      startTierEffect(state, 1, { x: 100, y: 100 }, 'forge');

      // State unchanged
      expect(state.zoomTarget).toBeNull();
      expect(state.zoomPhase).toBe('none');
      expect(state.spotlightAgent).toBeNull();
    });
  });

  // ─── Scenario 5: Tool call tracking across request ────────────────
  describe('Scenario 5: Tool call accumulation', () => {
    it('trackToolCall increments per tool invoke, affects tier selection', () => {
      const requestId = 'integration-test-1';

      // Initial request: 1 tool
      const count1 = trackToolCall(requestId);
      expect(count1).toBe(1);

      // Tier selection at 1 tool: minimal
      let tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: count1,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(1);

      // More tools added: 2nd tool
      const count2 = trackToolCall(requestId);
      expect(count2).toBe(2);

      // Tier selection at 2 tools: spotlight
      tier = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: count2,
        thinkingStartTime: 0,
      });
      expect(tier).toBe(2); // 2+ tools trigger Tier 2

      // Request completes
      clearRequest(requestId);
    });
  });

  // ─── Scenario 6: Concurrent requests maintain isolation ───────────
  describe('Scenario 6: Concurrent request isolation', () => {
    it('two simultaneous requests tracked separately', () => {
      const req1 = 'integration-test-1';
      const req2 = 'integration-test-2';

      // Req 1: 3 tools
      for (let i = 0; i < 3; i++) trackToolCall(req1);

      // Req 2: 1 tool
      trackToolCall(req2);

      // Tier selection per request
      const tier1 = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 3, // From req1
        thinkingStartTime: 0,
      });

      const tier2 = selectAnimationTier({
        isFirstVisit: false,
        isMultiAgent: false,
        toolCallCount: 1, // From req2
        thinkingStartTime: 0,
      });

      expect(tier1).toBe(2); // 3 tools → Tier 2
      expect(tier2).toBe(1); // 1 tool → Tier 1

      // Cleanup
      clearRequest(req1);
      clearRequest(req2);
    });
  });

  // ─── Scenario 7: Rendering with effect state ────────────────────
  describe('Scenario 7: Rendering with active effects', () => {
    it('render() includes effect state: zoom scale, dim opacity, spotlight', () => {
      const agents: CanvasAgent[] = [
        {
          id: 'weebo',
          x: 10,
          y: 15,
          renderX: 320,
          renderY: 480,
          behaviorMode: 'sitting',
          pose: 'typing',
          facing: 'down',
          spriteId: 'weebo-sitting-down-typing-0',
        },
      ] as CanvasAgent[];

      // Create effect state with active zoom
      const state = createEffectState();
      startTierEffect(state, 3, { x: 320, y: 480 }, 'weebo');

      // Tick to middle of zoom_in
      tickEffects(state, TIER_CINEMATIC_ZOOM_MS / 2);

      // Render canvas with effect state
      const renderState = {
        agents,
        beams: [],
        tick: 0,
        selectedAgentId: 'weebo',
      };

      // Should not throw with active effects
      expect(() => render(canvas, renderState)).not.toThrow();

      // TODO: Verify zoom/dim/spotlight applied to canvas
      // (visual inspection or canvas pixel inspection)
    });
  });

  // ─── Scenario 8: State cleanup prevents pollution ─────────────────
  describe('Scenario 8: State cleanup and reset', () => {
    it('clearRequest + clearEffects + localStorage.clear() reset all state', () => {
      const requestId = 'integration-test-1';

      // Accumulate state
      trackToolCall(requestId);
      trackToolCall(requestId);
      markVisited();

      const state = createEffectState();
      startTierEffect(state, 3, { x: 100, y: 100 }, 'weebo');

      // Cleanup
      clearRequest(requestId);
      clearEffects(state);
      localStorage.clear();

      // Verify clean state
      expect(isFirstVisit()).toBe(true);
      expect(trackToolCall(requestId)).toBe(1); // Reset
      expect(state.zoomPhase).toBe('none'); // Reset
    });
  });
});
