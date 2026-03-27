# Test Coverage Gaps: Agent Office Module

## Summary
- **Total modules analyzed**: 12
- **Fully tested**: 4 (AnimationTierSelector, CanvasEffects, Navigation, Occupancy)
- **Partially tested**: 0
- **Untested**: 8 (CollisionLoader, Perception, ProactiveSuggestions, RoomZones, SmartObjects, Sprites, TaskQueue, AgentBehavior, OfficeCanvasRenderer, Agentin components)
- **Integration gaps**: 5 major workflows

---

## Untested Modules

### 1. **collisionLoader.ts** — Image loading + fallback
**Status**: ❌ No tests
**Lines of code**: ~60
**Functions**:
- `isAuthoredMapLoaded()` — state query
- `getAuthoredMap()` — state query
- `loadCollisionFromImage()` — async image parsing with error handling

**Critical gaps**:
- Image load success path (happy path)
- Image load failure/timeout
- Alpha channel parsing edge cases (alpha exactly 128, 127, 129)
- Canvas context failures
- Out-of-bounds pixel sampling
- State mutation verification

---

### 2. **perception.ts** — Agent environment awareness
**Status**: ❌ No tests
**Lines of code**: ~70
**Functions**:
- `perceive()` — complex multi-aspect sensing

**Critical gaps**:
- Nearby agent detection within 5-tile radius
- Sorting by distance
- Room detection (null room vs valid room)
- Available interaction points filtering (occupied vs unoccupied)
- "At desk" detection (state + path length combination)
- Recently worked tracking

**Edge cases**:
- Agent at exact boundary of radius
- Agent with no nearby agents
- Agent in room with no objects
- All interaction points occupied
- Multiple agents at same distance

---

### 3. **proactiveSuggestions.ts** — API integration + suggestion generation
**Status**: ❌ No tests
**Lines of code**: ~200+
**Functions**:
- `apiBase()` — environment resolution
- `getToken()` — localStorage/sessionStorage lookup
- `safeFetch<T>()` — fetch with auth + error handling
- `generateSuggestions()` — [not shown, but critical]

**Critical gaps**:
- Dev vs prod URL selection
- Token lookup order (gs_token → token → sessionStorage fallback)
- Fetch error handling (4xx, 5xx, network errors)
- Missing token (returns null)
- Authentication header format
- Response parsing and type safety
- Suggestion expiration and deduplication
- API failure graceful degradation

---

### 4. **roomZones.ts** — Room detection
**Status**: ❌ No tests
**Lines of code**: ~60
**Functions**:
- `getRoomAt(x, y)` — room lookup by tile
- `getRoomById(id)` — room lookup by ID

**Critical gaps**:
- Boundary conditions (x=0, y=0, x=COLS-1, y=ROWS-1)
- Out-of-bounds coordinates (negative, beyond grid)
- Overlapping room bounds (pantry inside patio)
- Order-dependent matching
- Non-existent room ID lookup
- All 7 room types

---

### 5. **smartObjects.ts** — Furniture + interaction validation
**Status**: ❌ No tests
**Lines of code**: ~150+
**Startup validation**: Checks all interaction points walkable (non-blocking)

**Critical gaps**:
- Startup validation logging
- Non-walkable interaction point detection
- Footprint + interaction point overlap
- Room association integrity
- Behavior type enum validation
- Max occupants enforcement
- Object lookup by ID

---

### 6. **sprites.ts** — Sprite rendering + palette substitution
**Status**: ❌ No tests
**Lines of code**: ~200+
**Functions**:
- `loadSpriteSheets()` — PNG sprite loading
- `drawSpriteFrame()` — canvas.drawImage from loaded sheets
- `getAgentSprites()` — programmatic sprite generation with palette substitution
- Palette substitution logic ('H', 'K', 'S', 'P', 'O', 'A' token replacement)

**Critical gaps**:
- PNG load success/failure
- Fallback to programmatic sprites
- Palette substitution correctness (all 6 tokens per agent)
- Cache hit/miss behavior
- Sprite frame selection (idle, walking directions, typing)
- 9 agent color schemes
- Transparent pixel handling ('_' token)
- Mirror/flip transformations

---

### 7. **taskQueue.ts** — In-memory task management
**Status**: ❌ No tests
**Lines of code**: ~120
**Functions**:
- `getAllTasks()` — returns task snapshot
- `getTasksForAgent(agentId)` — filter by assignment
- `getQueuedTasks()` — filter by status
- `createTask()` — queue insertion with auto-assign logic
- `startTask()` — status transition + assignment
- `completeTask()` — status transition + timestamp
- `failTask()` — status transition + error

**Critical gaps**:
- Task ID generation uniqueness
- Status lifecycle validation (queued → in_progress → completed)
- Priority handling
- Payload persistence
- Direct assignment (createTask with assignedTo)
- Timestamp accuracy
- Multiple tasks per agent
- Task not found edge case

---

### 8. **agentBehavior.ts** — Behavior state machine (partial)
**Status**: ❌ No tests
**Lines of code**: ~500+
**Functions**:
- `phrasesForBehavior(behavior)` — phrase selection
- Behavior state machine (not fully shown in context)
- `tickBehavior()` — state updates each tick
- Startup validation (interaction point walkability)

**Critical gaps**:
- Phrase selection for all behavior types
- Fallback to GENERAL_PHRASES for unknown behavior
- Behavior mode transitions (sitting → wandering → socializing)
- Fidget animation cycle
- Speed multiplier effect
- Social interaction sequencing
- Group meeting detection (3+ agents)
- Direction facing changes
- Perception-driven decision making

---

### 9. **OfficeCanvasRenderer.ts** — Canvas rendering
**Status**: ❌ No tests
**Lines of code**: ~200+
**Functions**:
- `loadOfficeAssets()` — load BG + FG images
- `isBgLoaded()` — state query
- `drawBackground()` — render BG image or solid fallback
- `drawForeground()` — render FG layer on top

**Critical gaps**:
- Parallel image loading both succeed
- One image loads, one fails
- Both images fail (fallback to solid bg)
- Image smoothing disabled (crisp pixel art)
- Image aspect ratio preservation
- Canvas size vs image natural size handling
- Render state snapshot structure

---

### 10. **agentin/index.ts** — Component library
**Status**: ❌ No React/component tests visible
**Components**:
- `PageShell` — layout wrapper with responsive spacing
- `PageHeader` — header with icon, title, subtitle, badge, actions
- `SectionCard` — content container with glass-morphism

**Critical gaps**:
- Responsive padding (mobile vs desktop)
- Max-width options (3xl–7xl)
- Vertical spacing (4, 6, 8 units)
- Gradient background animation
- Page entry animation
- Icon styling (40×40px with cyan accent)
- Sequential fade-in animations
- Text truncation/ellipsis
- Badge positioning
- Hover effects (border, shadow, inset highlight)
- Glass-morphism blur + transparency
- CSS custom property inheritance

---

## Integration Test Gaps

### 1. **Collision Map Loading → Navigation**
Missing test:
- Load collision from image → use in isWalkable()
- Fallback to COLLISION_MAP constant if image fails
- Collision map changes navigation behavior

### 2. **Perception → AgentBehavior → Canvas Update**
Missing test:
- Agent perceives environment → behavior decision → canvas frame updates
- Interaction point reservation → occupancy system → perception feedback

### 3. **Task Queue → Agent Assignment → Office SSE**
Missing test:
- Create task → assign to agent → agent behavior reflects task status
- SSE event fires → task marked in_progress → agent "working" state

### 4. **Sprite System Fallback**
Missing test:
- Try PNG load → success: use drawSpriteFrame
- PNG fails → fall back to programmatic sprites
- Ensure visual consistency between both paths

### 5. **Proactive Suggestions API Failure**
Missing test:
- API unavailable → suggestions gracefully degrade
- Token missing → don't attempt fetch
- Multiple sequential polls with cache

---

## Error Handling Gaps

| Module | Missing Error Test | Impact |
|--------|-------------------|--------|
| collisionLoader.ts | Image CORS failure | Fallback may not trigger |
| collisionLoader.ts | Canvas context null | Uncaught exception |
| proactiveSuggestions.ts | Malformed JSON response | Type mismatch |
| proactiveSuggestions.ts | 401 Unauthorized | Silent failure (correct but untested) |
| OfficeCanvasRenderer.ts | Image natural size = 0 | Scale calculation error |
| smartObjects.ts | Interaction point not walkable | Agent can't reach furniture |
| sprites.ts | PNG load timeout | Fallback not tested |
| taskQueue.ts | Task not found on update | No-op behavior untested |

---

## Untested Edge Cases

### Navigation/Collision
- [ ] Coordinate exactly on boundary (x=COLS, y=ROWS)
- [ ] Coordinate at negative boundaries (x=-1, y=-1)
- [ ] Spiral search stops at radius 5 (unreachable areas)

### Perception
- [ ] Agent with exactly 5 nearby agents (radius boundary)
- [ ] No available interaction points (all occupied)
- [ ] Agent in null room (uncovered area)
- [ ] Recently worked in same frame as perceive call

### Room Zones
- [ ] Overlapping room bounds (pantry inside patio)
- [ ] Order-dependent matching (more specific zones first)
- [ ] Coordinate just outside room bounds

### Task Queue
- [ ] 1000 tasks in queue (performance)
- [ ] Task with null payload vs empty payload
- [ ] Rapid start/complete/fail transitions

### Sprite Palette
- [ ] All 6 palette colors used correctly per agent
- [ ] Mirror transformation with asymmetric sprites
- [ ] Transparent pixel in center (fully transparent sprite)

---

## Summary by Severity

| Severity | Count | Examples |
|----------|-------|----------|
| 🔴 Critical | 5 | Collision loading, sprite fallback, perception logic, task lifecycle, room detection |
| 🟠 High | 8 | API error handling, image loading, behavior state machine, occupancy enforcement |
| 🟡 Medium | 12 | Edge cases (boundaries, empty states, radius limits), error messages |
| 🟢 Low | 6 | Performance (large task queues), cache behavior, logging |

**Recommendation**: Start with critical gaps (Integration tests + Module tests for 1, 2, 6, 7, 8).
