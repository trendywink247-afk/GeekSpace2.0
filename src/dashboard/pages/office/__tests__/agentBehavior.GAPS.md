# agentBehavior.ts Test Coverage Gaps

## Current Coverage: ~5% (Mostly stubbed)

The behavior state machine is the **heart** of agent animation. Current tests are all commented out with TODO placeholders.

---

## Critical Missing Test Coverage

### 1. **Behavior Mode Selection** (UNTESTED)
```typescript
export function getAgentBehaviorMode(agent: CanvasAgent): BehaviorMode
```

**Missing test cases:**

```typescript
describe('getAgentBehaviorMode', () => {
  // RULE 1: Sitting behavior
  it('returns "sitting" when agent at desk with no path', () => {
    // Agent: x=10, y=15 (home desk position), path=[], state='idle'
    // Expected: 'sitting'
  });

  it('"sitting" behavior with idle fidget (typing, looking, stretching)', () => {
    // Agent: at desk, fidgetType='typing'
    // Expected: mode='sitting', getAgentPose()='typing'
  });

  // RULE 2: Wandering behavior
  it('returns "wandering" when agent has active path', () => {
    // Agent: path=[{x:11,y:15}, {x:12,y:15}]
    // Expected: 'wandering'
  });

  it('wandering with multiple path segments', () => {
    // Agent: path with 5+ waypoints
    // Expected: maintains 'wandering' until path emptied
  });

  // RULE 3: Working behavior (SSE triggered)
  it('returns "working" when state="busy" (SSE event)', () => {
    // Agent: state='busy' (triggered by SSE message)
    // Expected: 'working' mode
  });

  it('"working" overrides other behaviors while active', () => {
    // Even if wandering or sitting, SSE event triggers 'working'
    // Expected: priority order maintained
  });

  // RULE 4: Socializing behavior
  it('returns "socializing" when interacting with nearby agent', () => {
    // Agent1: at (10, 15), Agent2: at (11, 15) — 1 tile away
    // Agent1 has socialTarget='edith'
    // Expected: 'socializing'
  });

  it('socializing requires agents within 2-3 tiles', () => {
    // Agent1: at (10, 15), Agent2: at (15, 15) — 5 tiles away
    // Expected: NOT socializing (too far)
  });

  // RULE 5: Returning behavior
  it('returns "returning" when walking back to home desk', () => {
    // Agent: at non-home location with path back to home
    // Expected: 'returning' mode
  });

  it('"returning" completes when reaching home', () => {
    // Agent reaches home position
    // path becomes empty
    // Expected: transitions to 'sitting'
  });

  // RULE 6: Group meeting behavior
  it('returns "group-meeting" when 3+ agents at meeting table', () => {
    // Agent1, Agent2, Agent3: all at meeting_room (smartObject id='meeting_table')
    // Expected: all 3 return 'group-meeting'
  });

  it('group-meeting synchronized animation', () => {
    // 3 agents at meeting table
    // All should have synchronized idle pose (e.g., 'looking')
  });

  it('group-meeting exits when agent leaves', () => {
    // Agent2 walks away from table
    // Expected: Agent1,Agent3 stay 'group-meeting', Agent2 → 'wandering'
  });

  // RULE 7: Delivering behavior (optional)
  it('returns "delivering" when carrying task/item', () => {
    // Agent: task.status='assigned' and is carrying item
    // Expected: 'delivering'
  });

  // Edge cases
  it('handles mode with multiple conflicting conditions', () => {
    // Agent: at meeting table (group) + path set (wandering) + SSE event (working)
    // Priority: working > group-meeting > wandering > sitting
  });

  it('handles agent with no home desk assigned', () => {
    // Agent: homeDeskX/homeDeskY = null
    // Expected: no 'returning' behavior, defaults to wandering
  });

  it('handles null perception (should not crash)', () => {
    // Perception lookup fails
    // Expected: fallback to safe mode (sitting)
  });
});
```

---

### 2. **Animation Pose Selection** (UNTESTED)
```typescript
export function getAgentPose(agent: CanvasAgent): AnimationPose
```

**Missing test cases:**

```typescript
describe('getAgentPose', () => {
  // Pose types: 'idle', 'walking', 'talking', 'typing', 'looking', 'stretching'

  it('returns "walking" when agent moving (path.length > 0)', () => {
    // Agent: path has waypoints
    // Expected: pose='walking'
  });

  it('walking pose updates frame each tick (4-frame animation)', () => {
    // Agent: walking, tick increments
    // Expected: frame cycles 0→1→2→3→0
  });

  it('returns idle fidget variants when at rest', () => {
    // Agent: no path, at desk
    // Expected: 'typing', 'looking', or 'stretching' (random or cycled)
  });

  it('typing pose: sitting at desk, moving hands', () => {
    // Agent: fidgetType='typing'
    // Expected: 'typing' animation
  });

  it('looking pose: agent glancing around', () => {
    // Agent: fidgetType='looking'
    // Expected: 'looking' animation
  });

  it('stretching pose: stretch/relax animation', () => {
    // Agent: fidgetType='stretching'
    // Expected: 'stretching' animation
  });

  it('returns "talking" when socializing', () => {
    // Agent: mode='socializing'
    // Expected: pose='talking'
  });

  it('talking animation is bidirectional (facing social partner)', () => {
    // Agent1 talking to Agent2 (at different position)
    // Expected: Agent1 facing Agent2, mouth moving
  });

  it('pose priority: walking > talking > fidget > idle', () => {
    // Agent: both walking AND socializing
    // Expected: walking takes priority
  });

  it('idle pose varies to avoid repetition', () => {
    // Agent: at desk for 60 ticks
    // Expected: fidget type changes every ~15 ticks
  });
});
```

---

### 3. **Behavior Tick/State Machine** (UNTESTED)
```typescript
export function tickBehavior(agent: CanvasAgent, agents: CanvasAgent[], dt: number): void
```

**Missing test cases:**

```typescript
describe('tickBehavior', () => {
  let agents: CanvasAgent[];
  let state: Map<AgentId, BehaviorState>;

  beforeEach(() => {
    agents = [
      { id: 'weebo', x: 10, y: 15, path: [], state: 'idle', ... },
      { id: 'edith', x: 12, y: 16, path: [], state: 'idle', ... },
    ];
    // Clear behavior state
    state = new Map();
  });

  // ─── State transitions ─────────────────────────────────────────────
  describe('state transitions', () => {
    it('sitting → wandering after idle timer expires', () => {
      const weebo = agents[0];
      weebo.sitting_timer = 1; // 1 tick remaining

      tickBehavior(weebo, agents, 200); // 200ms tick

      expect(getAgentBehaviorMode(weebo)).toBe('wandering');
      expect(weebo.path.length).toBeGreaterThan(0);
    });

    it('wandering → sitting when reaching smart object', () => {
      const weebo = agents[0];
      weebo.path = [{ x: 10, y: 15 }]; // Single waypoint
      weebo.targetPoint = { x: 10, y: 15 };

      tickBehavior(weebo, agents, 200);

      // After movement, weebo reaches target
      expect(Math.abs(weebo.x - 10) + Math.abs(weebo.y - 15)).toBeLessThan(0.5);
      // Next tick should transition to sitting
      tickBehavior(weebo, agents, 200);
      expect(getAgentBehaviorMode(weebo)).toBe('sitting');
    });

    it('sitting → socializing when nearby agent detected', () => {
      const weebo = agents[0]; // at (10, 15)
      const edith = agents[1]; // at (12, 16) — 3 tiles away

      tickBehavior(weebo, agents, 200);

      // Perception detects edith nearby
      // If behavior decides to socialize:
      // expect(weebo.socialTarget).toBe('edith');
      // expect(getAgentBehaviorMode(weebo)).toBe('socializing');
    });

    it('working (SSE) → returns to previous mode when event clears', () => {
      const weebo = agents[0];
      weebo.state = 'busy'; // SSE event

      expect(getAgentBehaviorMode(weebo)).toBe('working');

      weebo.state = 'idle'; // SSE event cleared
      tickBehavior(weebo, agents, 200);

      // Should resume previous behavior (sitting or wandering)
      expect(getAgentBehaviorMode(weebo)).not.toBe('working');
    });
  });

  // ─── Pathfinding ──────────────────────────────────────────────────
  describe('pathfinding to smart objects', () => {
    it('chooses random smart object from current room', () => {
      const weebo = agents[0]; // in workspace
      weebo.sitting_timer = 0; // Trigger wander

      tickBehavior(weebo, agents, 200);

      // Should have path to coffee/desk/couch in workspace
      expect(weebo.path.length).toBeGreaterThan(0);
      expect(weebo.targetPoint).toBeDefined();
    });

    it('avoids occupied interaction points', () => {
      const weebo = agents[0];
      const edith = agents[1];

      // edith reserves coffee_machine
      reservePoint(7, 16, 'edith');

      // weebo tries to go to same object
      tickBehavior(weebo, agents, 200);

      // Should find different object or wait
      expect(weebo.targetPoint).toBeDefined();
      // If same object, should retry next tick
    });

    it('reserves interaction point before moving', () => {
      const weebo = agents[0];

      tickBehavior(weebo, agents, 200);

      // weebo.targetPoint should be reserved for weebo
      if (weebo.targetPoint) {
        expect(getOccupant(weebo.targetPoint.x, weebo.targetPoint.y)).toBe('weebo');
      }
    });

    it('path is optimal (shortest BFS path)', () => {
      const weebo = agents[0]; // at (10, 15)
      weebo.targetPoint = { x: 20, y: 20 }; // Target 10 tiles away

      tickBehavior(weebo, agents, 200);

      // path.length should be close to Manhattan distance
      // (allowing for collision avoidance)
      const distance = Math.abs(20 - 10) + Math.abs(20 - 15);
      expect(weebo.path.length).toBeLessThanOrEqual(distance + 2); // +2 for margin
    });
  });

  // ─── Movement ────────────────────────────────────────────────────
  describe('movement along path', () => {
    it('agent moves 1 tile per step along path', () => {
      const weebo = agents[0];
      weebo.x = 10;
      weebo.y = 15;
      weebo.path = [{ x: 11, y: 15 }];

      tickBehavior(weebo, agents, 200);

      // Should be close to next waypoint
      expect(Math.abs(weebo.x - 11)).toBeLessThan(1);
      expect(Math.abs(weebo.y - 15)).toBeLessThan(1);
    });

    it('path updates as agent moves (waypoints consumed)', () => {
      const weebo = agents[0];
      weebo.path = [
        { x: 11, y: 15 },
        { x: 12, y: 15 },
        { x: 12, y: 16 },
      ];

      const initialLength = weebo.path.length;
      tickBehavior(weebo, agents, 200);

      // Closest waypoint should be consumed or agent moved toward it
      // path.length should decrease
    });

    it('movement speed is personality-driven (0.85–1.2x)', () => {
      const weebo = agents[0];
      weebo.speed = 1.2; // Fast personality

      const initialX = weebo.x;
      weebo.path = [{ x: 20, y: 15 }];

      tickBehavior(weebo, agents, 200);

      const distance = Math.abs(weebo.x - initialX);
      // Fast agent should move ~1.2x standard distance
      expect(distance).toBeGreaterThan(0.8);
    });

    it('agent stops at collision (blocked tile)', () => {
      const weebo = agents[0];
      weebo.x = 0;
      weebo.y = 0; // Blocked tile

      // Even if path exists, agent can't move
      tickBehavior(weebo, agents, 200);

      // Should stay in place or find alternate path
      expect(weebo.x).toBe(0);
      expect(weebo.y).toBe(0);
    });
  });

  // ─── Social interactions ───────────────────────────────────────────
  describe('social behavior', () => {
    it('initiates socializing when nearby agent detected', () => {
      const weebo = agents[0]; // at (10, 15)
      const edith = agents[1]; // at (11, 15) — adjacent

      tickBehavior(weebo, agents, 200);

      // Within range, may socialize
      // If decision made: expect socialTarget set
    });

    it('exchanges speech bubbles while socializing', () => {
      startSocializing('weebo', 'edith');

      tickBehavior(agents[0], agents, 200);
      tickBehavior(agents[1], agents, 200);

      // Both agents should have speech bubbles
      // Messages chosen based on interaction type
    });

    it('social interaction lasts 3–5 seconds before agent leaves', () => {
      const weebo = agents[0];
      startSocializing('weebo', 'edith');
      weebo.socialStep = 0; // Start of interaction

      // Tick multiple times
      for (let i = 0; i < 15; i++) {
        tickBehavior(weebo, agents, 200);
      }

      // After ~3s (15 * 200ms), should end socializing
      // expect(weebo.socialTarget).toBeNull();
    });

    it('agents face each other while socializing', () => {
      startSocializing('weebo', 'edith');
      const weebo = agents[0]; // at (10, 15)
      const edith = agents[1]; // at (12, 15)

      tickBehavior(weebo, agents, 200);
      tickBehavior(edith, agents, 200);

      // weebo facing right (toward edith at x=12)
      // expect(weebo.facing).toBe('right');
      // edith facing left (toward weebo at x=10)
      // expect(edith.facing).toBe('left');
    });

    it('phrase selection based on interaction type', () => {
      // If at coffee machine → coffee phrases
      // If at meeting table → meeting phrases
      // etc.
      const weebo = agents[0];
      weebo.targetPoint = { x: 7, y: 16 }; // coffee_machine

      // Socialize at coffee
      // Speech bubble should be from COFFEE_PHRASES
    });

    it('stops socializing when agent moves away', () => {
      startSocializing('weebo', 'edith');

      // Manually set path (agent walks away)
      agents[0].path = [{ x: 5, y: 15 }];

      tickBehavior(agents[0], agents, 200);

      // Should end socializing
      // expect(agents[0].socialTarget).toBeNull();
    });
  });

  // ─── Fidget animations ────────────────────────────────────────────
  describe('fidget behavior', () => {
    it('cycles through fidget types (typing, looking, stretching)', () => {
      const weebo = agents[0];
      weebo.path = []; // Sitting

      // Tick multiple times
      const fidgetTypes: FidgetType[] = [];
      for (let i = 0; i < 60; i++) {
        tickBehavior(weebo, agents, 200);
        fidgetTypes.push(weebo.fidgetType);
      }

      // Should have variety of fidget types
      const unique = new Set(fidgetTypes);
      expect(unique.size).toBeGreaterThan(1);
    });

    it('fidget frame advances each tick (4 frames per fidget)', () => {
      const weebo = agents[0];
      weebo.fidgetType = 'typing';
      weebo.fidgetTimer = 0;

      // Collect frames
      const frames: number[] = [];
      for (let i = 0; i < 8; i++) {
        tickBehavior(weebo, agents, 200);
        // frames.push(weebo.fidgetFrame);
      }

      // Should cycle: 0, 1, 2, 3, 0, 1, 2, 3
    });

    it('fidget changes avoid animation boredom', () => {
      const weebo = agents[0];
      weebo.path = [];

      let lastFidget = 'none';
      for (let i = 0; i < 100; i++) {
        tickBehavior(weebo, agents, 200);
        if (weebo.fidgetType !== lastFidget) {
          lastFidget = weebo.fidgetType;
        }
      }

      // Should change fidget type periodically, not stay on same one
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles agent with invalid home desk', () => {
      const weebo = agents[0];
      weebo.homeDeskX = -1; // Invalid

      // Should not crash
      expect(() => tickBehavior(weebo, agents, 200)).not.toThrow();
    });

    it('handles pathfinding failure (no path found)', () => {
      const weebo = agents[0];
      // Surrounded by walls (hypothetical)

      tickBehavior(weebo, agents, 200);

      // Should not crash, fallback to waiting or returning home
      expect(weebo).toBeDefined();
    });

    it('handles dt=0 (no time passed)', () => {
      const weebo = agents[0];
      expect(() => tickBehavior(weebo, agents, 0)).not.toThrow();
      // Agent should not move
    });

    it('handles large dt (e.g., 1000ms lag)', () => {
      const weebo = agents[0];
      weebo.path = [{ x: 20, y: 15 }];

      expect(() => tickBehavior(weebo, agents, 1000)).not.toThrow();
      // Agent should move appropriately (possibly skip multiple tiles)
    });
  });
});
```

---

### 4. **Smart Object Reservation** (UNTESTED)
```typescript
export function reserveSmartObject(agentId: AgentId, objectId: string): boolean
export function releaseSmartObject(agentId: AgentId): void
```

**Missing test cases:**

```typescript
describe('smart object reservation', () => {
  afterEach(() => {
    releaseSmartObject('weebo');
    releaseSmartObject('edith');
    releaseSmartObject('jarvis');
  });

  it('reserves smart object interaction point for agent', () => {
    const success = reserveSmartObject('weebo', 'coffee_machine');
    expect(success).toBe(true);
  });

  it('prevents double-reservation (different agent)', () => {
    reserveSmartObject('weebo', 'coffee_machine');
    const success = reserveSmartObject('edith', 'coffee_machine');
    expect(success).toBe(false);
  });

  it('allows same agent to re-reserve (idempotent)', () => {
    reserveSmartObject('weebo', 'coffee_machine');
    const success = reserveSmartObject('weebo', 'coffee_machine');
    expect(success).toBe(true);
  });

  it('multiple agents can reserve different objects', () => {
    const r1 = reserveSmartObject('weebo', 'coffee_machine');
    const r2 = reserveSmartObject('edith', 'couch');
    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });

  it('releasing frees object for other agents', () => {
    reserveSmartObject('weebo', 'coffee_machine');
    releaseSmartObject('weebo');
    const success = reserveSmartObject('edith', 'coffee_machine');
    expect(success).toBe(true);
  });
});
```

---

## Summary of Missing Tests

| Category | Test Count | Priority |
|----------|-----------|----------|
| Behavior mode selection | 12 | 🔴 CRITICAL |
| Pose selection | 10 | 🔴 CRITICAL |
| Behavior tick (state machine) | 35 | 🔴 CRITICAL |
| Smart object reservation | 6 | 🟡 HIGH |
| **Total** | **63 tests** | — |

---

## Implementation Strategy

1. **Mock agents:** Use factory function for consistent test setup
2. **Mock perception:** Control nearby agents/objects
3. **Mock smart objects:** Pre-place furniture with known positions
4. **Mock occupancy:** Control reservation state
5. **Use fake timers:** Control tick intervals precisely
6. **Verify paths:** Assert BFS results with known maps
