# OfficeCanvasRenderer Test Coverage Gaps

## Current Coverage: ~20% (Many TODOs)

### Critical Missing Tests

#### 1. **Agent Sprite Rendering** (UNTESTED)
```typescript
// File: src/dashboard/pages/office/sprites.ts
// Missing test coverage:
- getAgentSprites(agentId) — returns correct sprite sheet
- drawSpriteFrame(ctx, sprite, frame, x, y) — renders frame correctly
- Frame selection based on pose (idle, walking, talking)
- Palette substitution (agent colors applied to grayscale sprites)
```

**Test skeleton needed:**
```typescript
describe('drawAgentSprite', () => {
  it('renders correct sprite for agent ID', () => {
    const sprites = getAgentSprites('weebo');
    expect(sprites).toBeDefined();
    expect(sprites.idle).toBeDefined(); // pose frames
  });

  it('applies palette substitution (agent color)', () => {
    // Mock canvas, draw sprite with palette
    // Verify pixels match agent color (#00F0FF for weebo)
  });

  it('handles animation frame sequence (idle frame 0→3→0)', () => {
    // Call drawSpriteFrame multiple times with tick counter
    // Verify frame increments and loops
  });

  it('scales sprite correctly for canvas zoom', () => {
    // Draw at zoomScale=1.5
    // Verify scaled dimensions match expected size
  });

  it('handles sprite load failure gracefully (fallback rect)', () => {
    // Mock sprite as null/undefined
    // Verify fallback colored rectangle rendered
  });
});
```

---

#### 2. **Particle Beam Rendering** (UNTESTED)
```typescript
// Particle beams connect agents during communication
// Missing test coverage:
- drawParticleBeam(ctx, beam, tick)
- Beam animation (particles move from source → target)
- Beam color (matches agent color or interaction context)
- Beam fading (alpha decreases along length)
```

**Test skeleton needed:**
```typescript
describe('drawParticleBeam', () => {
  it('renders beam from agent1 to agent2', () => {
    const beam: ParticleBeam = {
      id: 'beam-1',
      sourceAgentId: 'weebo',
      targetAgentId: 'edith',
      particles: Array(5).fill({ x: 100, y: 100, vx: 1, vy: 1, alpha: 0.5 }),
      createdAt: Date.now(),
    };

    const spy = vi.spyOn(ctx, 'fillRect');
    drawParticleBeam(ctx, beam, 0);
    expect(spy).toHaveBeenCalled();
  });

  it('particles animate along path (lerp between source/target)', () => {
    // Verify particles move smoothly from A to B
  });

  it('beam color matches source agent color', () => {
    // weebo beam should be cyan (#00F0FF)
    // edith beam should be purple (#8B5CF6)
  });

  it('particle alpha fades at beam end (distance-based)', () => {
    // Particles near target should have lower alpha
  });

  it('removes expired beams (> 3s old)', () => {
    // Beam older than lifetime should not render
  });
});
```

---

#### 3. **Speech Bubble Rendering** (UNTESTED)
```typescript
// Speech bubbles above agents during interactions
// Missing test coverage:
- drawSpeechBubble(ctx, bubble, canvasX, canvasY)
- Bubble text wrapping (max width)
- Bubble positioning (above agent, pointing to agent)
- Bubble background (semi-transparent, rounded corners)
- Text color (high contrast)
```

**Test skeleton needed:**
```typescript
describe('drawSpeechBubble', () => {
  it('renders text in rounded rectangle bubble', () => {
    const bubble: SpeechBubble = {
      agentId: 'weebo',
      text: 'Good morning!',
      createdAt: Date.now(),
    };

    const spy = vi.spyOn(ctx, 'fillRect');
    drawSpeechBubble(ctx, bubble, 200, 100);
    expect(spy).toHaveBeenCalled();
  });

  it('text wraps at max width (e.g., 80px)', () => {
    const longText = 'This is a very long message that should wrap to multiple lines';
    const bubble: SpeechBubble = {
      agentId: 'weebo',
      text: longText,
      createdAt: Date.now(),
    };

    // Verify drawText called multiple times for wrapped lines
  });

  it('bubble positioned above agent (pointing down)', () => {
    // Bubble at (agentX, agentY - 60px)
    // Tail points downward to agent
  });

  it('bubble background is semi-transparent', () => {
    // fillStyle should be rgba with alpha ~ 0.8
  });

  it('text has high contrast (white text on dark bubble)', () => {
    // fillStyle for text should be #FFFFFF or similar
  });

  it('removes expired bubbles (> 2s old)', () => {
    const old = Date.now() - 3000;
    const bubble: SpeechBubble = {
      agentId: 'weebo',
      text: 'Old',
      createdAt: old,
    };

    // Should not render
  });
});
```

---

#### 4. **Effect Layer Rendering** (UNTESTED)
```typescript
// Zoom, spotlight, dim overlay, particles
// Missing test coverage:
- drawZoomOverlay(ctx, state) — zoom indicator or border glow
- drawSpotlightDim(ctx, state) — darkened background outside spotlight
- drawParticles(ctx, state) — bouncing background particles
- drawDebugGrid(ctx) — optional collision/room debug overlay
```

**Test skeleton needed:**
```typescript
describe('drawEffectLayers', () => {
  it('draws zoom border when zoomPhase active', () => {
    const state: CanvasEffectState = {
      zoomTarget: { x: 432, y: 400 },
      zoomPhase: 'zoom_in',
      zoomScale: 1.3,
      zoomProgress: 0.5,
      spotlightAgent: 'weebo',
      dimOpacity: 0.6,
      particles: [],
    };

    const spy = vi.spyOn(ctx, 'strokeRect');
    // Call render with effect state
    // Expect border glow around zoom target
  });

  it('draws spotlight dim when dimOpacity < 1', () => {
    const state: CanvasEffectState = {
      zoomTarget: null,
      zoomPhase: 'none',
      zoomScale: 1,
      zoomProgress: 0,
      spotlightAgent: 'weebo',
      dimOpacity: 0.7, // 30% visible
      particles: [],
    };

    const spy = vi.spyOn(ctx, 'fillRect');
    // Expect full-canvas dark overlay with specified opacity
  });

  it('draws particles with correct opacity', () => {
    const state: CanvasEffectState = {
      zoomTarget: null,
      zoomPhase: 'none',
      zoomScale: 1,
      zoomProgress: 0,
      spotlightAgent: null,
      dimOpacity: 1,
      particles: [
        { x: 100, y: 100, vx: 0.2, vy: 0.1, alpha: 0.03 },
        { x: 200, y: 200, vx: -0.1, vy: 0.2, alpha: 0.05 },
      ],
    };

    const spy = vi.spyOn(ctx, 'fillRect');
    // Expect particles rendered at correct positions with alpha
  });

  it('debug grid shows collision map when enabled', () => {
    // showDebug = true
    // Should render grid lines for each tile
    // Should highlight blocked tiles in red
  });
});
```

---

#### 5. **Canvas State & Lifecycle** (UNTESTED)
```typescript
// Missing test coverage:
- loadOfficeAssets() error handling (both images fail)
- Image smoothing disabled for pixel art
- Canvas cleared properly each frame
- Memory cleanup on component unmount
```

**Test skeleton needed:**
```typescript
describe('canvas lifecycle', () => {
  it('clears canvas at start of frame (fillRect 0,0,W,H)', () => {
    const spy = vi.spyOn(ctx, 'fillRect');
    // Call render function
    // Expect first call is fullscreen clear
    expect(spy).toHaveBeenCalledWith(0, 0, 864, 800);
  });

  it('disables image smoothing for pixel art rendering', () => {
    const spy = vi.spyOn(ctx, 'imageSmoothingEnabled', 'set');
    // Load and render background
    // Expect imageSmoothingEnabled = false
  });

  it('handles canvas context loss gracefully', () => {
    // TODO: Simulate canvas.getContext('2d') returning null
    // Should not throw
  });

  it('cleans up image resources on unmount', () => {
    // bgImage and fgImage should be reset to null
    // Event listeners removed
  });
});
```

---

#### 6. **Rendering State Transitions** (UNTESTED)
```typescript
// Missing test coverage:
- RenderState type correctness (agents, beams, tick, etc.)
- Agents with null positions handled
- Beams without valid source/target ignored
- Multiple agents at same location (z-order)
```

**Test skeleton needed:**
```typescript
describe('renderState handling', () => {
  it('renders multiple agents without z-order conflicts', () => {
    const agents: CanvasAgent[] = [
      { id: 'weebo', x: 100, y: 100, renderX: 100, renderY: 100, ... },
      { id: 'edith', x: 100, y: 100, renderX: 100, renderY: 100, ... },
      { id: 'jarvis', x: 101, y: 100, renderX: 101, renderY: 100, ... },
    ];

    const state: RenderState = {
      agents,
      beams: [],
      tick: 0,
      selectedAgentId: null,
    };

    // Verify all 3 agents rendered without overlap artifacts
  });

  it('handles agent with NaN positions', () => {
    const agent: CanvasAgent = {
      id: 'broken',
      x: NaN,
      y: NaN,
      renderX: NaN,
      renderY: NaN,
      ...
    };

    // Should not throw, render fallback or skip
  });

  it('beams ignore invalid source/target agents', () => {
    const beam: ParticleBeam = {
      sourceAgentId: 'nonexistent',
      targetAgentId: 'also_missing',
      ...
    };

    // Should not render or throw
  });

  it('selectedAgentId highlights correct agent', () => {
    const agents: CanvasAgent[] = [
      { id: 'weebo', ... },
      { id: 'edith', ... },
    ];

    const state: RenderState = {
      agents,
      beams: [],
      tick: 0,
      selectedAgentId: 'edith',
    };

    // edith should have highlight/glow
    // weebo should be normal
  });
});
```

---

## Summary of Missing Test Count

| Feature | Tests Needed | Priority |
|---------|-------------|----------|
| Agent sprite rendering | 5 | 🔴 CRITICAL |
| Particle beams | 6 | 🔴 CRITICAL |
| Speech bubbles | 6 | 🟡 HIGH |
| Effect layers | 4 | 🟡 HIGH |
| Canvas lifecycle | 4 | 🟡 HIGH |
| Render state handling | 4 | 🟡 HIGH |
| **Total** | **29 tests** | — |

---

## Implementation Priority

1. **Phase 1 (Sprint N):** Agent sprites + beams (core visuals)
2. **Phase 2:** Speech bubbles + effects (polish)
3. **Phase 3:** Canvas lifecycle + state handling (robustness)
