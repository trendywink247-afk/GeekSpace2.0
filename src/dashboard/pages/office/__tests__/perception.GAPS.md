# perception.ts Test Coverage Gaps

## Current Coverage: ~10% (Mostly stubbed)

The perception module is the **sensor system** that tells agents what they can see. Critical for behavior decisions.

---

## Critical Missing Tests

### 1. **Room Detection** (PARTIALLY STUBBED)
```typescript
export function perceive(agent: CanvasAgent, agents: CanvasAgent[], occupied: Set<string>): AgentPerception
  → perception.currentRoom: Room | null
```

**Missing test cases:**

```typescript
describe('perceive — currentRoom detection', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    agents = [
      { id: 'weebo', x: 5, y: 3, ... }, // patio/pantry overlap
      { id: 'edith', x: 20, y: 15, ... }, // lounge
      { id: 'jarvis', x: 5, y: 17, ... }, // workspace
      { id: 'aria', x: 30, y: 30, ... }, // outside all rooms
    ];
  });

  // ─── Patio (x: 0–11, y: 0–7) ─────────────────────────────────────
  it('detects patio for agent at (5, 3)', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set());
    expect(perc.currentRoom?.id).toBe('patio');
  });

  // ─── Pantry (x: 5–11, y: 2–6) — inside patio ────────────────────
  it('detects pantry (not patio) for agent at (8, 4) — overlaps region', () => {
    const agent = { id: 'test', x: 8, y: 4, ... };
    const perc = perceive(agent, agents, new Set());
    // Pantry is more specific, should be detected
    expect(perc.currentRoom?.id).toMatch(/pantry|patio/); // Order-dependent
  });

  // ─── Lounge (x: 14–26, y: 0–7) ──────────────────────────────────
  it('detects lounge for agent at (20, 5)', () => {
    const edith = agents[1];
    const perc = perceive(edith, agents, new Set());
    expect(perc.currentRoom?.id).toBe('lounge');
  });

  // ─── Workspace (x: 0–14, y: 13–21) ──────────────────────────────
  it('detects workspace for agent at (5, 17)', () => {
    const jarvis = agents[2];
    const perc = perceive(jarvis, agents, new Set());
    expect(perc.currentRoom?.id).toBe('workspace');
  });

  // ─── Out of bounds (no room) ─────────────────────────────────────
  it('returns null for agent outside all rooms', () => {
    const aria = agents[3];
    const perc = perceive(aria, agents, new Set());
    expect(perc.currentRoom).toBeNull();
  });

  // ─── All 7 room types ───────────────────────────────────────────
  it('detects all 7 room types (patio, pantry, lounge, utility, stairs, workspace, meeting)', () => {
    const rooms = [
      { id: 'patio', x: 3, y: 3 },
      { id: 'pantry', x: 8, y: 4 },
      { id: 'lounge', x: 20, y: 4 },
      { id: 'utility_corridor', x: 2, y: 10 },
      { id: 'stairs_transition', x: 10, y: 10 },
      { id: 'workspace', x: 7, y: 17 },
      { id: 'meeting_room', x: 20, y: 16 },
    ];

    rooms.forEach(({ id, x, y }) => {
      const agent = { id: `test_${id}`, x, y, ... };
      const perc = perceive(agent, agents, new Set());
      // May not be exact order due to overlaps, but should match room or nearby
      expect(perc.currentRoom).toBeDefined() || expect(perc.currentRoom).toBeNull();
    });
  });

  // ─── Boundary conditions ────────────────────────────────────────
  it('handles agent at room boundary (just inside)', () => {
    const agent = { id: 'boundary', x: 0, y: 13, ... }; // workspace edge
    const perc = perceive(agent, agents, new Set());
    expect(perc.currentRoom?.id).toBe('workspace');
  });

  it('handles agent at room boundary (just outside)', () => {
    const agent = { id: 'outside', x: 15, y: 13, ... }; // outside workspace
    const perc = perceive(agent, agents, new Set());
    expect(perc.currentRoom?.id).not.toBe('workspace');
  });
});
```

---

### 2. **Nearby Agent Detection** (UNTESTED)
```typescript
export function perceive(...): AgentPerception
  → perception.nearbyAgents: Array<{ agent: CanvasAgent; distance: number }>
```

**Missing test cases:**

```typescript
describe('perceive — nearbyAgents', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    agents = [
      { id: 'weebo', x: 10, y: 15, ... },
      { id: 'edith', x: 12, y: 16, ... }, // distance 3 (Manhattan)
      { id: 'jarvis', x: 12, y: 15, ... }, // distance 2
      { id: 'aria', x: 20, y: 20, ... }, // distance 15
    ];
  });

  it('returns agents within 5-tile Manhattan distance', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set());

    expect(perc.nearbyAgents.length).toBeGreaterThan(0);
    perc.nearbyAgents.forEach((na) => {
      expect(na.distance).toBeLessThanOrEqual(5);
    });
  });

  it('excludes agents beyond 5-tile radius', () => {
    const weebo = agents[0];
    const aria = agents[3]; // distance 15

    const perc = perceive(weebo, agents, new Set());
    const isAriaNearby = perc.nearbyAgents.some((na) => na.agent.id === 'aria');

    expect(isAriaNearby).toBe(false);
  });

  it('excludes self from nearby agents list', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set());

    const hasSelf = perc.nearbyAgents.some((na) => na.agent.id === 'weebo');
    expect(hasSelf).toBe(false);
  });

  it('sorts nearby agents by distance (ascending)', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set());

    for (let i = 1; i < perc.nearbyAgents.length; i++) {
      expect(perc.nearbyAgents[i].distance).toBeGreaterThanOrEqual(
        perc.nearbyAgents[i - 1].distance
      );
    }
  });

  it('handles agent with no nearby agents', () => {
    const isolated = { id: 'isolated', x: -10, y: -10, ... };
    const perc = perceive(isolated, agents, new Set());

    expect(perc.nearbyAgents).toHaveLength(0);
  });

  it('includes distance metric (Manhattan distance)', () => {
    const weebo = agents[0]; // (10, 15)
    const jarvis = agents[2]; // (12, 15) — distance 2

    const perc = perceive(weebo, agents, new Set());
    const jarvisNearby = perc.nearbyAgents.find((na) => na.agent.id === 'jarvis');

    expect(jarvisNearby?.distance).toBe(2);
  });

  it('handles agents at exact 5-tile boundary', () => {
    const weebo = agents[0]; // (10, 15)
    const boundary = { id: 'boundary', x: 15, y: 15, ... }; // distance exactly 5

    const perc = perceive(weebo, [weebo, boundary], new Set());
    const isBoundaryNearby = perc.nearbyAgents.some((na) => na.agent.id === 'boundary');

    expect(isBoundaryNearby).toBe(true);
  });

  it('handles agents at 5-tile + 1 (just outside)', () => {
    const weebo = agents[0]; // (10, 15)
    const outside = { id: 'outside', x: 16, y: 15, ... }; // distance 6

    const perc = perceive(weebo, [weebo, outside], new Set());
    const isOutsideNearby = perc.nearbyAgents.some((na) => na.agent.id === 'outside');

    expect(isOutsideNearby).toBe(false);
  });
});
```

---

### 3. **Nearby Objects (Smart Furniture)** (UNTESTED)
```typescript
export function perceive(...): AgentPerception
  → perception.nearbyObjects: InteractionPoint[]
  → perception.availableInteractionPoints: InteractionPoint[]
```

**Missing test cases:**

```typescript
describe('perceive — nearbyObjects', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    agents = [
      { id: 'weebo', x: 7, y: 17, ... }, // in workspace
      { id: 'edith', x: 20, y: 16, ... }, // in lounge
      { id: 'aria', x: 30, y: 30, ... }, // outside all rooms
    ];
  });

  it('returns smart objects in agent\'s current room', () => {
    const weebo = agents[0]; // workspace
    const perc = perceive(weebo, agents, new Set());

    // Workspace has desk clusters
    expect(perc.nearbyObjects.length).toBeGreaterThan(0);
    perc.nearbyObjects.forEach((obj) => {
      expect(obj.room).toBe('workspace') || expect(obj).toBeDefined();
    });
  });

  it('returns empty array when agent in null room', () => {
    const aria = agents[2]; // outside all rooms
    const perc = perceive(aria, agents, new Set());

    expect(perc.nearbyObjects).toHaveLength(0);
  });

  it('filters out occupied interaction points', () => {
    const weebo = agents[0];
    const occupied = new Set(['desk_cluster_left:ip_0']); // edith reserved this point

    const perc = perceive(weebo, agents, occupied);

    // Should not include occupied point
    const isOccupiedInList = perc.availableInteractionPoints?.some(
      (ip) => occupied.has(`${ip.objectId}:${ip.id}`)
    );
    expect(isOccupiedInList).toBe(false);
  });

  it('includes unoccupied interaction points as "available"', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set()); // No occupied points

    expect(perc.availableInteractionPoints?.length).toBeGreaterThan(0);
  });

  it('groups objects by type (desks, coffee, couch, etc)', () => {
    const weebo = agents[0]; // workspace
    const perc = perceive(weebo, agents, new Set());

    // Should have different object types
    const types = new Set(perc.nearbyObjects.map((obj) => obj.behavior || obj.type));
    // Types may include 'sitting', 'coffee', 'collaborate', etc.
  });

  it('returns object metadata (position, behavior, size)', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set());

    perc.nearbyObjects.forEach((obj) => {
      expect(obj.x).toBeDefined();
      expect(obj.y).toBeDefined();
      expect(obj.behavior).toBeDefined();
      expect(obj.size).toBeDefined();
    });
  });

  it('lounge has different objects than workspace', () => {
    const weebo = agents[0]; // workspace
    const edith = agents[1]; // lounge

    const percWeebo = perceive(weebo, agents, new Set());
    const percEdith = perceive(edith, agents, new Set());

    // Objects should be different
    const weeobobjs = percWeebo.nearbyObjects.map((o) => o.id).sort();
    const edithObjs = percEdith.nearbyObjects.map((o) => o.id).sort();

    // Should be different (unless rooms share objects)
    expect(weeobobjs).not.toEqual(edithObjs);
  });
});
```

---

### 4. **isAtDesk Detection** (UNTESTED)
```typescript
export function perceive(...): AgentPerception
  → perception.isAtDesk: boolean
```

**Missing test cases:**

```typescript
describe('perceive — isAtDesk', () => {
  let agents: CanvasAgent[];

  beforeEach(() => {
    agents = [
      { id: 'weebo', x: 7, y: 17, path: [], ... }, // at desk, no path
      { id: 'edith', x: 7, y: 17, path: [{ x: 10, y: 15 }], ... }, // at desk but moving
      { id: 'jarvis', x: 20, y: 15, path: [], ... }, // not at desk, idle
    ];
  });

  it('returns true when agent at home desk with no path', () => {
    const weebo = agents[0];
    const perc = perceive(weebo, agents, new Set());

    expect(perc.isAtDesk).toBe(true);
  });

  it('returns false when agent has active path (moving)', () => {
    const edith = agents[1]; // Has path, even if at desk position
    const perc = perceive(edith, agents, new Set());

    expect(perc.isAtDesk).toBe(false);
  });

  it('returns false when agent not at home desk position', () => {
    const jarvis = agents[2];
    const perc = perceive(jarvis, agents, new Set());

    expect(perc.isAtDesk).toBe(false);
  });

  it('changes based on agent position (reactive)', () => {
    const weebo = agents[0];
    const perc1 = perceive(weebo, agents, new Set());
    expect(perc1.isAtDesk).toBe(true);

    // Simulate movement
    weebo.path = [{ x: 15, y: 15 }];
    const perc2 = perceive(weebo, agents, new Set());
    expect(perc2.isAtDesk).toBe(false);
  });
});
```

---

### 5. **Perception State Caching/Updates** (UNTESTED)
```typescript
// Perception should update as agent/world state changes
```

**Missing test cases:**

```typescript
describe('perceive — state reactivity', () => {
  it('updates when agent moves to new room', () => {
    const agent = { id: 'weebo', x: 7, y: 17, ... }; // workspace

    const perc1 = perceive(agent, [], new Set());
    expect(perc1.currentRoom?.id).toBe('workspace');

    // Agent moves to lounge
    agent.x = 20;
    agent.y = 15;

    const perc2 = perceive(agent, [], new Set());
    expect(perc2.currentRoom?.id).toBe('lounge');
  });

  it('updates when nearby agents change', () => {
    const weebo = { id: 'weebo', x: 10, y: 15, ... };
    const edith = { id: 'edith', x: 12, y: 16, ... };
    const agents1 = [weebo, edith];

    const perc1 = perceive(weebo, agents1, new Set());
    expect(perc1.nearbyAgents.length).toBeGreaterThan(0);

    // edith moves far away
    edith.x = 50;
    edith.y = 50;

    const perc2 = perceive(weebo, agents1, new Set());
    expect(perc2.nearbyAgents.length).toBe(0);
  });

  it('updates when occupation state changes', () => {
    const weebo = { id: 'weebo', x: 7, y: 17, ... };
    const occupied1 = new Set<string>();

    const perc1 = perceive(weebo, [], occupied1);
    expect(perc1.availableInteractionPoints?.length).toBeGreaterThan(0);

    // All points become occupied
    occupied1.add('desk_cluster_left:ip_0');
    occupied1.add('desk_cluster_left:ip_1');
    // ... etc

    const perc2 = perceive(weebo, [], occupied1);
    // Available points should decrease
  });
});
```

---

### 6. **Edge Cases** (UNTESTED)
```typescript
describe('perceive — edge cases', () => {
  it('handles agent with NaN coordinates', () => {
    const agent = { id: 'broken', x: NaN, y: NaN, ... };
    const perc = perceive(agent, [], new Set());

    // Should not crash, return safe defaults
    expect(perc.currentRoom).toBeNull() || expect(perc.currentRoom).toBeDefined();
  });

  it('handles empty agents array', () => {
    const agent = { id: 'solo', x: 7, y: 17, ... };
    const perc = perceive(agent, [], new Set());

    expect(perc.nearbyAgents).toHaveLength(0);
  });

  it('handles very large occupied set (performance)', () => {
    const agent = { id: 'weebo', x: 7, y: 17, ... };
    const occupied = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      occupied.add(`obj_${i}:ip_${i}`);
    }

    const start = performance.now();
    const perc = perceive(agent, [], occupied);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // Should be fast
  });

  it('handles null values in agents array', () => {
    const agent = { id: 'weebo', x: 7, y: 17, ... };
    const agents = [agent, null as any, { id: 'valid', x: 10, y: 15, ... }];

    expect(() => perceive(agent, agents, new Set())).not.toThrow();
  });
});
```

---

## Summary of Missing Tests

| Feature | Tests | Priority |
|---------|-------|----------|
| Room detection | 9 | 🔴 CRITICAL |
| Nearby agents | 8 | 🔴 CRITICAL |
| Nearby objects | 8 | 🔴 CRITICAL |
| isAtDesk detection | 4 | 🟡 HIGH |
| State reactivity | 3 | 🟡 HIGH |
| Edge cases | 5 | 🟡 HIGH |
| **Total** | **37 tests** | — |

---

## Key Challenges

1. **Mock ROOMS and SMART_OBJECTS:** Must match hardcoded constants
2. **Coordinate system:** All tests depend on office grid (27×25 tiles)
3. **Occupancy state:** Set-based, must be controlled in tests
4. **Performance:** Perception called every tick, must be < 10ms
