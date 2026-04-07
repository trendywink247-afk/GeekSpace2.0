# Office Module — Phase 0a Audit Report

> **Branch:** `ui/office-audit` (based on `ui/office-page-revamp`)  
> **Auditor:** Frontend specialist agent  
> **Date:** 2026-04-07  
> **Scope:** `src/dashboard/pages/office/`, `public/office/`, `server/src/modules/office/`, `server/src/services/activity-stream.ts`

---

## 1. Executive Summary

The GeekSpace 2.0 office module is a pixel-art, HTML5 canvas–based visualization of 9 AI agents working in an animated office. It displays in two contexts: `OfficePage` (standalone mission control with sidebar) and `OfficeHomePage` (dashboard homepage with expanded sidebar tabs, stats, and quick-access cards). Both pages share the same core canvas component (`OfficeStage`) and data hook (`useOfficeData`).

**What it is:** A real-time, 864×800px pixel art office canvas showing 9 agents (`weebo`, `edith`, `jarvis`, `aria`, `forge`, `pulse`, `echo`, `cal`, `nova`) animated with personality-driven AI behaviors. Agents receive SSE events from the backend and react by walking to their desks, showing speech bubbles, firing particle beams, and entering different animation tiers (spotlight → cinematic zoom).

**How the loop works:**

```
Backend LLM event → activity-stream.ts emit() → SSE push → useOfficeData() → events[] prop →
OfficeStage useEffect → setAgents state update → RAF loop renders @60fps →
agentBehavior.tickBehaviors() @5fps (200ms accumulator) → BFS pathfinding →
renderFrame() via OfficeCanvasRenderer → canvas painted
```

**What's great:**

- Well-documented: virtually every function has JSDoc; the sprite system has thorough inline docs.
- Rich behavior system: personality-driven preferences, room affinity, routines, group meetings, social encounters, glancing, linger multipliers — very alive feeling.
- Clean separation: navigation, occupancy, perception, and smartObjects are each single-responsibility modules.
- Dual sprite backend: PNG sheets (primary) with programmatic palette-substituted fallback.
- Smart polling backoff (exponential, 429-aware, visibility-paused) — fixed a real rate-limit bug.

**What's broken / problematic:**

- **3 `setAgents` calls per RAF frame** (path step, behavior tick, smooth interpolation) = 3 React re-renders of `OfficeStage` + `SpeechBubbleLayer` every ~16ms = ~180 renders/sec. This is the #1 performance issue.
- **Foreground layer disabled** — the depth illusion (agents walking behind desks) is commented out due to unresolved clipping: `// Foreground layer disabled — was causing agent head/body clipping`.
- **Module-level mutable state** in `OfficeStage.tsx` (`delegationTracker`, `activeLaunchHuddle`) lives outside React and can cause stale-closure bugs and cross-page leakage.
- **`collisionLoader.ts` is never called** — the authored image-based collision map is never loaded; the hardcoded `COLLISION_MAP` in constants.ts is always used. The loader is dead code.
- **7 unused asset files** — `office_xy.webp`, `walls.png`, and all 8 laptop webp files are loaded to disk but never drawn on canvas.
- **Movement feels bad** — wander trigger is too frequent for some agents (nova: 6–12 tick sit minimum = 1.2–2.4s before first wander), 3 separate `setAgents` calls create jitter, no diagonal movement despite the office having diagonal walkways.
- **Dead code accumulation** — `bfsNextStep()`, `isReachable()`, `randomWalkableInRadius()`, `taskQueue.ts`, `startDelivery()`/`tickDeliveries()` all exist but are never called from active code.
- **`OfficeHomePage` and `OfficePage` duplicate code** — `getAgentForHUD()` is verbatim-duplicated, both call `useOfficeData()` creating double SSE connections when both pages mount.

**What's confusing:**

- The `SpeechBubbleLayer` component renders in both DOM (React overlay) and canvas simultaneously — non-interactive bubbles go to canvas, interactive ones to DOM, split by a `!b.interactive` filter. Easy to miss.
- `OfficeStage.tsx` header comment says "30fps" but the RAF loop actually caps dt at 100ms and behavior runs at 5fps; rendering is uncapped (true 60fps+).
- `BEHAVIOR_INTERVAL = 0.2` drives BOTH behavior _and_ beam/bubble expiry — same accumulator, same flush interval.
- Sprite sheet says 7 cols but only columns 0–4 are used for walk animation and 3–4 for typing; columns 5–6 are never drawn.

---

## 2. File Inventory Table

| File                       | LOC   | Purpose                                                                          | Touched by          | Health     | Primary Concerns                                                                                                                                                                                         |
| -------------------------- | ----- | -------------------------------------------------------------------------------- | ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentBehavior.ts`         | 1813  | Idle behavior state machine (wander, socialize, group-meeting) + delivery system | canvas / state      | 🟡 Bloated | God file: 1800 LOC. `startDelivery()`/`tickDeliveries()` unused. Module-level globals. Many exported helpers that should be internal.                                                                    |
| `OfficeCanvasRenderer.ts`  | 1493  | Pure canvas rendering: bg, agents, beams, bubbles, effects, debug overlay        | canvas              | 🟡 Bloated | Foreground layer commented out. Desk monitor positions hardcoded (not from constants). `drawSpeechBubble` duplicates bubble render logic from `SpeechBubbleLayer`.                                       |
| `sprites.ts`               | 1450  | Sprite templates (programmatic fallback) + PNG sheet loader + cache              | canvas              | 🟡 Bloated | 1200+ LOC of pixel templates for 9 agents. `makeWalkRight` doesn't actually narrow the side profile (comment-promise not delivered). Agents 6-8 use hue-shifted copies of sheets 0,2,3.                  |
| `OfficeStage.tsx`          | 1346  | Canvas container, RAF loop, SSE event processing, click detection                | canvas / state / ui | 🟡 Bloated | 3 `setAgents` calls/frame. Module-level `delegationTracker` and `activeLaunchHuddle`. GREETING_PHRASES/THINKING_PHRASES defined inline. Easing function commented out but referenced.                    |
| `OfficeHomePage.tsx`       | 1113  | Dashboard homepage: office canvas + enhanced sidebar + suggestion strip          | ui                  | 🟡 Bloated | 1100 LOC single file. `getAgentForHUD` duplicated verbatim from OfficePage. Calls `useOfficeData()` creating second SSE connection. 8 quick-access cards hardcoded.                                      |
| `OfficePage.tsx`           | 711   | Standalone office canvas + SmartSidebar + status strip                           | ui                  | 🟢 Clean   | `FirstVisitOverlay` could be its own file. `getAgentForHUD` duplicated in OfficeHomePage. `CANVAS_H_PX = 800` hardcoded instead of using `CANVAS_H`.                                                     |
| `AgentProfileFlyout.tsx`   | 552   | Double-click flyout: agent stats, recent tasks, quick actions                    | ui                  | 🟢 Clean   | Minimal concerns.                                                                                                                                                                                        |
| `use-office-data.ts`       | 446   | SSE streaming + polling hook with backoff, dedup, session expiry                 | state / backend     | 🟢 Clean   | `connectSSE()` called twice on mount (bug: `connectSSE()` inside `useEffect` and also called directly before `schedule()`).                                                                              |
| `SmartSidebar.tsx`         | 375   | Sidebar shell with tabs: timeline, tasks, metrics, goals                         | ui                  | 🟢 Clean   | Tab routing delegates to sub-tabs.                                                                                                                                                                       |
| `proactiveSuggestions.ts`  | 348   | Fetches 6 API endpoints and generates contextual insight cards                   | state / backend     | 🟢 Clean   | `safeFetch` path issue: passes `/reminders` not `/api/reminders` to `apiBase()` which already returns the full base including `/api`.                                                                    |
| `TimelineCard.tsx`         | 306   | Individual timeline entry card with action buttons                               | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `TasksTab.tsx`             | 257   | Task board tab inside SmartSidebar                                               | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `SpotlightHUD.tsx`         | 250   | Single-click spotlight: mini-profile, quick chat/task                            | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `types.ts`                 | 249   | All TypeScript types + `AGENT_WORK_HOURS` constant                               | shared              | 🟡 Bloated | `AGENT_WORK_HOURS` is a constant, not a type — should live in `constants.ts`.                                                                                                                            |
| `InsightToast.tsx`         | 247   | Toast queue for proactive insights                                               | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `TimelineTab.tsx`          | 211   | Timeline tab inside SmartSidebar                                                 | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `constants.ts`             | 207   | Grid dimensions, agent metadata, desk positions, COLLISION_MAP                   | shared              | 🟡 Bloated | `COLLISION_MAP` is 25×27 of T/F booleans inlined (~130 LOC). Should live in a separate `collisionData.ts` or be loaded from the image. Desk positions (hardcoded pixel coords) mixed with design tokens. |
| `DigestModal.tsx`          | 205   | "What did I miss?" modal summarizing recent events                               | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `taskQueue.ts`             | 203   | In-memory task queue with auto-assignment routing                                | state               | 🔴 Broken  | **Never imported anywhere.** Completely dead code. Not connected to SSE, canvas, or sidebar.                                                                                                             |
| `MetricsTab.tsx`           | 190   | Metrics tab showing credits, messages, tool calls                                | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `GoalsTab.tsx`             | 174   | Goals tab inside SmartSidebar                                                    | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `CanvasEffects.ts`         | 154   | Zoom/spotlight/particle effect state machine                                     | canvas              | 🟢 Clean   | Particle alpha uses `Date.now()` in tick loop causing sub-ms variance.                                                                                                                                   |
| `AnimationTierSelector.ts` | 106   | Selects animation tier (1/2/3) based on request context                          | canvas / state      | 🟢 Clean   | `__resetModuleState()` not exported → test suite has 19+ files working around this. `requestToolCounts` Map leaks stale entries if `clearRequest()` is never called.                                     |
| `roomZones.ts`             | 107   | Room boundary definitions (7 rooms)                                              | canvas / state      | 🟢 Clean   | `pantry` placed before `patio` in ROOMS array by design (overlap resolution).                                                                                                                            |
| `occupancy.ts`             | 98    | Interaction point reservation system                                             | state               | 🟢 Clean   |                                                                                                                                                                                                          |
| `perception.ts`            | 83    | Per-agent perception snapshot (nearby agents, rooms, IPs)                        | state               | 🟢 Clean   | Scans ALL smart objects every tick — fine for 27×25 grid.                                                                                                                                                |
| `SpeechBubbleLayer.tsx`    | 82    | DOM overlay for interactive (long) speech bubbles                                | ui                  | 🟢 Clean   |                                                                                                                                                                                                          |
| `collisionLoader.ts`       | 85    | Loads collision map from image alpha channel                                     | canvas              | 🔴 Broken  | **Never called.** `loadCollisionFromImage()` is exported but not imported by any office component. Dead code.                                                                                            |
| `navigation.ts`            | 355   | BFS pathfinding + walkability + spawn validation                                 | canvas / state      | 🟡 Bloated | `bfsNextStep()` unused. `isReachable()` unused. `randomWalkableInRadius()` unused. 3 unused exports.                                                                                                     |
| `AnimationTierSelector.ts` | 106   | Animation tier selection                                                         | canvas              | 🟢 Clean   | See above.                                                                                                                                                                                               |
| `index.ts`                 | 48    | Module barrel: exports OfficePage + OfficeHomePage                               | shared              | 🟢 Clean   | Only exports 2 components; subsystems not exposed.                                                                                                                                                       |
| `__tests__/`               | ~2000 | 50+ test files, heavily focused on AnimationTierSelector and CanvasEffects       | —                   | 🟡 Bloated | Tests are blocked by missing `__resetModuleState()` export. Many test files are near-duplicates exploring the same edge case.                                                                            |

---

## 3. Subsystems Deep-Dive

### 3.1 Game Loop (RAF, tick rate, frame budget)

**Current responsibility:** The RAF loop in `OfficeStage.tsx` (inside `useEffect`, lines ~630–870) is the heartbeat of the entire canvas. It runs at the display's native refresh rate (usually 60fps) and drives three separate sub-loops:

1. **Behavior tick** (`behaviorAccum >= 0.2s`): Every 200ms — BFS path computation, idle behavior, social interactions.
2. **Expiry tick** (`expireAccum >= 0.2s`): Every 200ms — prune expired beams and bubbles.
3. **Smooth interpolation** (every frame): Move `renderX`/`renderY` toward next path step at `BASE_SPEED = 96 px/sec × agent.speed × dt`.

**Key functions:**

- `frame(time: number)` — the single rAF callback, 260+ lines long.
- `BEHAVIOR_INTERVAL = 0.2` — controls both behavior and expiry accumulator.
- `dt = min((time - lastTime)/1000, 0.1)` — capped at 100ms to handle tab-hide recovery.

**How it's invoked:** `requestAnimationFrame(frame)` started by `useEffect([], [])` (no deps), runs until component unmounts.

**State it owns:** `agentsRef`, `beamsRef`, `bubblesRef` are `useRef` snapshots synced via `useLayoutEffect`. `effectStateRef` holds zoom/spotlight/particle state mutated in-place (no React state).

**Known bugs / smells:**

- **3 `setAgents` calls per frame** — `setAgents` for path advance, `setAgents` for behavior tick, `setAgents` for smooth interpolation. Each call triggers a React reconciliation of `OfficeStage` (1346 LOC component) and a re-render of its child `SpeechBubbleLayer`. At 60fps this is ~180 state updates per second.
- **`setAgents` inside RAF** — React 18's automatic batching does NOT batch inside `requestAnimationFrame` callbacks (only inside React event handlers). All 3 calls are independent flushes.
- **Behavior and expiry share the same accumulator variable** — They both check `behaviorAccum >= BEHAVIOR_INTERVAL` and `expireAccum >= BEHAVIOR_INTERVAL`, effectively the same timing. This means if behavior is slow (>200ms), expiry is also delayed.
- **Tick is used for animation frame selection** — `const tick = Math.floor(time / 200)` is passed to `renderFrame()`. This is a `Date.now()`-style counter derived from the RAF timestamp, which is fine, but `tick % N` is used for cycling walk frames. With `tick = time/200`, at 60fps one tick unit passes every ~200ms, giving 5 animation frames per second — intentionally slow for a retro look.
- **No frame budget enforcement** — if `tickBehaviors()` is slow (e.g., 9 agents × perception × BFS), the entire RAF frame is blocked. No time-slicing.

**Opportunities:**

- Merge the 3 `setAgents` calls into one per frame using a reducer or a single immutable update pass.
- Move all canvas-only state (renderX/Y, path, beam/bubble arrays) out of React state entirely — use refs only. Only SSE-driven state changes (`agent.state`, task events) need to trigger React re-renders.
- Use `useReducer` instead of multiple `useState` for agent state updates.

---

### 3.2 Renderer (draw order, layers, asset loading, offscreen canvases)

**Current responsibility:** `OfficeCanvasRenderer.ts` contains all canvas drawing functions. Stateless (no class) — pure functions that mutate a passed `CanvasRenderingContext2D`.

**Draw order (from `renderFrame()`):**

1. Background image (or solid fill)
2. Ambient floating particles (CanvasEffects particles)
3. Trail particles (walking agent footprints)
4. Particle beams
5. Ambient effects (screen flickers, coffee steam, desk monitor glow, grid pulse, server rack)
6. Meeting room ambient glow
7. _(Tier 3 zoom transform applied here if active)_
8. Agents sorted by renderY (Y-sort depth)
9. _(Zoom transform restored)_
10. Canvas speech bubbles (non-interactive only)
11. ~~Foreground layer~~ **DISABLED** — `// if (isBgLoaded()) { drawForeground(ctx); }`
12. Environmental storytelling (desk docs, whiteboard scribbles)
13. CanvasEffects particles (second particle pass — duplicate with step 2?)
14. Theme overlay (day warm tint or night blue tint)
15. Debug overlay (if `showDebug`)

**Asset loading:**

- `loadOfficeAssets()` loads `office_bg.webp` and `office_fg.webp` as `HTMLImageElement` globals.
- `loadSpriteSheets()` loads `char_0.png`–`char_5.png` into a `SPRITE_SHEETS` Map.
- Both are called in parallel via `Promise.all([loadOfficeAssets(), loadSpriteSheets()])` in `OfficeStage.tsx`.

**Offscreen canvases:** `sprites.ts` pre-renders all agent animation frames into `HTMLCanvasElement` instances cached in `spriteCache`. Hue-shifted variants (for echo, cal, nova) are cached in `hueShiftedCache`.

**Known bugs / smells:**

- **Foreground disabled** — The foreground layer (`office_fg.webp`) is loaded but never drawn. Agents walk through desks without visual occlusion. This was intentionally disabled: `// Foreground layer disabled — was causing agent head/body clipping when walking through desk areas. Re-enable once depth masking is refined.`
- **Double particle draw** — Ambient particles from `CanvasEffects` are drawn BOTH in step 2 (the `ambientParticles` array in `OfficeCanvasRenderer.ts`) AND again in step 13 (`effectState.particles`). Two different particle arrays with nearly identical visuals.
- **Desk monitor positions hardcoded** — `deskAssignments` in `drawAmbientEffects()` hardcodes 9 `{x, y, agentId}` structs instead of reading from `CORE_DESK_POSITIONS`/`SPECIALIST_POSITIONS` in constants.ts.
- **`ctx.imageSmoothingEnabled = false`** set in `drawBackground()` and `drawAgent()` locally — not guaranteed to persist. Should be set once at the top of `renderFrame()`.
- **No ImageBitmap pre-conversion** — `bgImage` and `fgImage` are raw `HTMLImageElement`s drawn via `drawImage`. Converting to `ImageBitmap` via `createImageBitmap()` at load time gives faster GPU draw calls.
- **`hexToRgba()` called per particle per frame** — string construction in a hot path. Minor, but measurable with many particles.

---

### 3.3 Sprites (sheet config, frame counts, animation cycles, gaps)

**Sprite sheet structure:**

- Files: `char_0.png` through `char_5.png`
- Dimensions: **112×96px** each (confirmed from file metadata)
- Frame size: **16×32px** (declared in `SpriteSheet.frameWidth/frameHeight`)
- Grid: `cols: 7`, `rows: 3` → 7 × 3 = 21 frames per sheet
- Row 0: walk DOWN (front face)
- Row 1: walk UP (back view)
- Row 2: walk RIGHT (mirror for left)
- Columns 0–3: walk frames (idle=0, walk1=1, walk2=2, walk3=3 — ping-pong [0,1,2,1])
- Columns 3–4: typing frames (two alternating frames)
- Columns 5–6: **NEVER USED** — these cells exist in the PNG but `drawSpriteFrame()` never requests `frameCol > 4`

**Agent-to-sheet mapping:**
| Agent | Sheet | Hue Shift |
|-------|-------|-----------|
| weebo | char_0 | none |
| edith | char_1 | none |
| jarvis | char_2 | none |
| aria | char_3 | none |
| forge | char_4 | none |
| pulse | char_5 | none |
| echo | char_0 | 120° |
| cal | char_2 | 90° |
| nova | char_3 | 180° |

**Programmatic sprite templates (fallback):**

- WEEBO: Full custom IDLE + WALK_DOWN (4 frames) + WALK_UP (4 frames) + WALK_RIGHT (4 frames) + TYPING (2 frames) — hand-crafted
- EDITH, JARVIS, ARIA, FORGE, PULSE, ECHO, CAL, NOVA: Custom IDLE only; `makeWalkDown()`, `makeWalkUp()`, `makeWalkRight()`, `makeTyping()` generate walk/type frames from idle

**Animation states defined vs available:**
| State | PNG (rows/cols) | Programmatic |
|-------|----------------|--------------|
| idle | col 0 (all rows) | ✅ per agent |
| walk down | cols 1-3, row 0 | ✅ (4 frames, ping-pong [0,1,2,1]) |
| walk up | cols 1-3, row 1 | ✅ (4 frames) |
| walk right | cols 1-3, row 2 | ✅ (4 frames) |
| walk left | cols 1-3, row 2 + mirror | ✅ (mirrored) |
| typing/seated | cols 3-4, all rows | ✅ (2 frames) |
| sleeping | ❌ | ❌ |
| celebrating | ❌ | ❌ |
| eating/drinking | ❌ | ❌ |
| special/thinking pose | ❌ | ❌ |

**Frame-config bugs:**

- `WALK` ping-pong is `[0, 1, 2, 1]` (4 steps reusing frame 1) — correct for a 3-frame walk cycle
- Typing frames use cols 3–4 AND `frameCol = 3 + (tick % 2)` — frame 3 = walking stride start (possibly wrong; ideally a separate seated frame)
- `makeWalkRight()` claims to create a side profile by "shifting body columns inward" but actually does nothing (`side = idle.map(row => [...row])`). The comment is aspirational code not delivered.
- `cols: 7` but the sprite sheet width is 112px ÷ 16px = 7 columns. Columns 5–6 are unreachable from the renderer.

---

### 3.4 Agent Behaviors (idle, wander, goto, interact, reactions, delegation)

**Current responsibility:** `agentBehavior.ts` (1813 LOC) is a pure TypeScript state machine. Called every 200ms by `OfficeStage.tickBehaviors()`.

**BehaviorMode states:**

- `sitting` — At desk, idle fidgets (typing/looking/stretching), timer-based wander trigger
- `wandering` — Walking toward a smart object interaction point
- `socializing` — One-on-one brief encounter with nearby agent
- `group-meeting` — Multi-agent gathering at a table (3-phase: gathering→chatting→dispersing)
- `returning` — Legacy mode, rarely triggered
- `working` — SSE event active (no idle behavior)
- `resting` — Natural rest at lounge/patio
- `delivering` — Agent-to-agent physical handoff (**unused** — `tickDeliveries()` never called from Stage)

**Key exported functions:**

```typescript
initBehavior(agent)           // Set up initial sitting state (staggered timers)
cancelIdleBehavior(agentId)   // On SSE work event — snap back to desk
notifyAgentActive()           // On any SSE event — set activityLevel = 'active'
tickBehaviors(agents, tick, theme) // Main tick: returns updatedAgents + newBubbles
resetAllBehaviors()           // On unmount — clear all state

// Queries (for renderer):
getAgentFacing(agentId): FacingDirection
getAgentBehaviorMode(agentId): BehaviorMode
getAgentFidget(agentId): FidgetType
getAgentPose(agentId): 'sit' | 'lean' | 'stand' | 'none'

// Dead code (unused):
startDelivery(fromId, toId, label)  // Never called from OfficeStage
tickDeliveries(agents)               // Never called from OfficeStage
isDelivering(agentId)                // Never called
trackAgentTool(agentId, tool)        // Called from OfficeStage — active
```

**How it's invoked:**

```
OfficeStage RAF loop (200ms accumulator)
  → setAgents(prev => tickBehaviors(prev, tick, theme).updatedAgents)
  → also sets bubbles via setBubbles(newBubbles)
```

**Module-level global state:**

```typescript
const behaviorStates = new Map<AgentId, BehaviorState>()  // Core state machine
const recentWorkers = new Set<AgentId>()                  // Post-work destination weighting
const restingAgents = new Set<string>()                   // Natural rest cap
const glanceState = new Map<AgentId, {...}>()             // Ambient glance tracking
const avoidanceCooldown = new Map<AgentId, number>()      // Collision avoidance timers
let activeGroupMeeting: GroupMeeting | null               // Current group meeting
let groupMeetingTimer: number                             // Global meeting countdown
let socialChatTimer: number                               // Global chat countdown
let activityLevel: 'greeting' | 'idle' | 'active'        // Activity level tracker
const lastToolUsed = new Map<AgentId, string>()           // Post-work destinations
const routineIndex = new Map<AgentId, number>()           // Personality routine position
const pendingDeliveries: AgentDelivery[]                  // Delivery queue (never used)
```

**Known bugs / smells:**

- **Glance state self-reference bug** (lines ~780): `bState.facing = glance.savedFacing === 'down' ? glance.savedFacing : glance.savedFacing` — both branches return the same value. The comment says "keep override via below" but the glance target facing is computed after this assignment and the assignment is redundant.
- **`delivering` mode case**: `tickBehaviors()` has a `case 'delivering'` branch that sets `updated.targetX/Y` but `tickDeliveries()` is never called, so delivery phase transitions never happen. Agents can get stuck in 'delivering' mode with no way out (it's set by `startDelivery()` which is also never called, so the bug is harmless — the mode is unreachable).
- **Social visit uses random non-proximity agent** — When `roll >= wanderChance && roll < 0.96`, agent picks ANY non-dormant idle agent to socialize with, not necessarily a nearby one. The `socialX` is computed as `target.x + (agent.x > target.x ? 1 : -1)` which could send the agent across the entire office for a 2-step chat.
- **Timer resolution**: `PERSONALITY_SIT_DURATION` ranges like `{min: 6, max: 12}` for nova (1.2–2.4s) and `{min: 20, max: 35}` for edith (4–7s). At 200ms per tick, these are quite short. Nova will wander almost constantly.

---

### 3.5 Navigation (pathfinder, walkable grid, zones)

**Current responsibility:** `navigation.ts` (355 LOC) is the single source of truth for walkability. Exports: `isWalkable`, `isBlocked`, `findFullPath`, `bfsNextStep`, `nearestWalkable`, `validateTarget`, `validateSpawnPosition`, `getWalkableNeighbors`, `randomWalkableInRadius`, `isReachable`.

**Grid:** 27 columns × 25 rows = 675 tiles total. ~298 walkable tiles (single connected zone per comments in constants.ts).

**BFS pathfinding:**

- `findFullPath()` — full BFS with parent-map path reconstruction. Returns path EXCLUDING start tile. O(walkable_tiles) worst case.
- `bfsNextStep()` — single-step BFS. **Never called** in production code. Used only in `__tests__/navigation.test.ts`.
- Directional order: `[up, down, left, right]` — can influence which path is taken when multiple shortest paths exist.
- No diagonal movement. Manhattan-only.
- No path caching — BFS runs fresh each time `findFullPath()` is called.

**Known bugs / smells:**

- **`bfsNextStep()` is unused** — dead code. 40 lines.
- **`isReachable()` is unused** — dead code. 25 lines.
- **`randomWalkableInRadius()` is unused** — dead code. 25 lines.
- **No path caching** — every frame that an agent needs a path (`path.length === 0 && x !== targetX`) calls `findFullPath()` via `setAgents`. With 9 agents potentially all needing paths simultaneously, this is up to 9 BFS calls every 200ms.
- **`bfsNextStep()` reads `COLLISION_MAP` directly** (line ~315: `if (COLLISION_MAP[ny][nx]) continue;`) instead of `isWalkable()`. Inconsistency — breaks if the map source ever changes.

---

### 3.6 Smart Objects (list, click behavior)

**All smart objects defined in `SMART_OBJECTS`:**

| ID                    | Type       | Room              | Label              | IPs | Max Occupants | On Click                      |
| --------------------- | ---------- | ----------------- | ------------------ | --- | ------------- | ----------------------------- |
| `desk-cluster-left`   | desk       | workspace         | Left Desks         | 5   | 4             | Object popover (label + type) |
| `desk-cluster-right`  | desk       | workspace         | Right Desks        | 5   | 4             | Object popover                |
| `coffee-counter`      | appliance  | pantry            | Coffee             | 2   | 2             | Object popover                |
| `couch`               | seating    | lounge            | Couch              | 3   | 3             | Object popover                |
| `lounge-table`        | table      | lounge            | Round Table        | 2   | 2             | Object popover                |
| `meeting-table`       | table      | meeting_room      | Meeting Table      | 6   | 6             | Object popover                |
| `whiteboard`          | display    | meeting_room      | Whiteboard         | 2   | 2             | Object popover                |
| `patio-seating-left`  | seating    | patio             | Patio Table Left   | 2   | 2             | Object popover                |
| `patio-seating-right` | seating    | patio             | Patio Table Right  | 2   | 2             | Object popover                |
| `lounge-rug`          | seating    | lounge            | Rug & Coffee Table | 3   | 3             | Object popover                |
| `lounge-bookshelf`    | furniture  | lounge            | Lounge Bookshelf   | 2   | 2             | Object popover                |
| `meeting-tv`          | display    | meeting_room      | Presentation TV    | 2   | 2             | Object popover                |
| `bookshelf`           | furniture  | stairs_transition | Bookshelf          | 2   | 2             | Object popover                |
| `corridor-plant`      | decoration | stairs_transition | Hallway Plant      | 2   | 1             | Object popover                |

**Click behavior today:** Every smart object click from `hitTestObject()` → `onObjectClick()` callback in `OfficePage` → `setObjectPopover({ id, type, label })` → shows a glassmorphism popover at canvas bottom for 4 seconds. That's it — no deeper interaction.

**Gap:** `maxOccupants` is defined but the occupancy system (`reservePoint`) only checks if a single agent holds a point — it doesn't enforce `maxOccupants`. Multiple agents can stack at the same interaction point if timing allows.

---

### 3.7 Room Zones (defined, used)

**7 rooms defined in `ROOMS`:**

| ID                  | Label        | Bounds (x,y,w,h) | Behavior Bias | Used for                                          |
| ------------------- | ------------ | ---------------- | ------------- | ------------------------------------------------- |
| `pantry`            | Pantry       | 5,2,7,5          | coffee        | Coffee phrases in social, room affinity weighting |
| `patio`             | Patio        | 0,0,12,8         | break         | Lounge/break behaviors                            |
| `lounge`            | Lounge       | 14,0,13,8        | relax         | Relax behaviors                                   |
| `utility_corridor`  | Utility      | 0,8,6,5          | utility       | Low-weight room for most agents                   |
| `stairs_transition` | Stairs       | 6,8,9,5          | transition    | High weight for nova (explorer)                   |
| `workspace`         | Workspace    | 0,13,15,9        | focus         | High weight for edith, forge, pulse               |
| `meeting_room`      | Meeting Room | 15,12,12,9       | collaborate   | High weight for cal, jarvis                       |

**Used by:**

- `agentBehavior.ts` — `socializing` mode: `getRoomAt(agent.x, agent.y)` to pick context-appropriate phrases
- `agentBehavior.ts` — `sitting` mode: `chooseDestination()` rule 3 checks `p.currentRoom?.id === 'meeting_room'`
- `ROOM_AFFINITY` in agentBehavior: personality-weighted room preferences
- `OfficeCanvasRenderer.ts` — `drawDebugOverlay()` renders room bounds as colored overlays

**Gaps:**

- Room bounds overlap: `pantry` (5,2,7,5) is inside `patio` (0,0,12,8). `getRoomAt()` returns the FIRST match, so pantry wins for tiles in the overlap — intentional by comment in roomZones.ts.
- `utility_corridor` has minimal personality weighting (all agents: weight 1) so agents almost never go there.
- No room events — no callback when an agent enters/exits a room.

---

### 3.8 Effects (CanvasEffects.ts)

**Effects defined:**

- **Tier 1** (minimal): No global effect. Agent glow halo still renders per-agent.
- **Tier 2** (spotlight): `spotlightAgent` set → all OTHER agents rendered at `dimOpacity = 0.7`. No zoom.
- **Tier 3** (cinematic): Full zoom sequence:
  - `zoom_in` phase: 600ms, scale 1.0→1.5, easeOutCubic
  - `hold` phase: 2000ms (TIER_CINEMATIC_HOLD_MS) at 1.5×
  - `zoom_out` phase: 400ms, 1.5→1.0, dimOpacity 0.4→1.0
  - Total: ~3 seconds. Spotlight cleared at end.
- **Particles**: 15 ambient particles (5 on mobile), bounce on canvas edges, sine-wave alpha oscillation.

**How triggered:**

```
SSE 'thinking' event → startTierEffect(effectStateRef.current, tier, agentPos, agentId)
SSE 'tool_call' event → startTierEffect (same)
SSE 'done' event → setTimeout(clearEffects, clearDelay)
```

**Known bugs:**

- **Tier from `thinking` event uses `clearRequest()` to undo `trackToolCall()`** — this is a hack to "peek" the count without incrementing. The comment says "Re-track: trackToolCall incremented, undo for read-only peek" but it's fragile and leaves the count one behind. Same hack applied on `done` event.
- **Particles rendered twice** — `CanvasEffectState.particles` are drawn in step 13 of `renderFrame()`, AND `initAmbientParticles()` populates `ambientParticles` drawn in step 2. These are TWO different particle arrays. The `CanvasEffects.particles` are purpose-built ambient particles (synced from effectState), while `ambientParticles` in `OfficeCanvasRenderer` are the original implementation. Both render independently.
- The `TIER_CINEMATIC_HOLD_MS = 2000` is in constants.ts but `tickEffects()` comments say "hold: 2000ms" — currently consistent.

---

### 3.9 Speech Bubbles (when shown, content source, positioning)

**Two rendering paths:**

1. **Canvas-drawn** (`SpeechBubble.interactive === false` or undefined): Rendered in `renderFrame()` via `drawSpeechBubble()`. Follows agent's `renderX`/`renderY`. Max 60 chars. Typewriter reveal (500ms).
2. **DOM overlay** (`SpeechBubble.interactive === true`): Rendered by `SpeechBubbleLayer.tsx`. Positioned via CSS `left`/`top` scaled from canvas coords to container. Max 200 chars. Used for long content (>60 chars).

**When shown:**

- Greeting: staggered on first visit (1.5s base + 600ms/agent)
- Thinking: `THINKING_PHRASES` per agent on 'thinking' SSE event
- Tool call: `"Using {toolLabel}..."` on 'tool_call' event
- Task completed: `COMPLETION_PHRASES` per agent
- Task failed: `FAILURE_PHRASES` per agent
- Delegation: `COLLAB_SEND_PHRASES` + `COLLAB_RECV_PHRASES` on 'delegating' event
- Comm sent/received: Same collab phrases
- Done reaction: `DELEGATION_REACTION_PHRASES` when delegator's specialist completes
- Behavior: Social chat, group meeting phrases, avoidance ("Excuse me!"), rest ("Back to work!"), idle personality phrases
- Object interactions: Context phrases (coffee, meeting, lounge, patio, bookshelf phrases)

**Content source:** All phrases are hardcoded dictionaries in `OfficeStage.tsx` (thinking/completion/failure/collab) and `agentBehavior.ts` (social/context phrases). No AI inference cost.

**Positioning:** Bubble anchors to `agent.renderY - 48 - bubbleH` (above sprite head). Canvas bubbles use `drawSpeechBubble()` which reads agent's live `renderX`/`renderY`. DOM bubbles use `SpeechBubbleLayer` which reads from `agents[]` prop (may lag one render behind).

**Smells:**

- MAX_SPEECH_BUBBLES = 5 — when full, oldest bubble is dropped (`.slice(-(MAX_SPEECH_BUBBLES - 1))`).
- No bubble priority — a "Hmm, let me try again" failure phrase can be overwritten by a social "Hey!" from the behavior system immediately after.

---

### 3.10 State + Events (SSE flows into canvas, event bus, store)

**Data flow:**

```
useOfficeData() → SSE fetch stream → line-by-line JSON parse → dedup by key →
setSseEvents(prev => [...prev, evt]) → OfficeStage events[] prop →
useEffect([events.length]) → setAgents(prev => processEvents(prev, newEvents))
```

**SSE connection:** `fetch('/api/agent-state/stream')` with Auth header, streamed via `res.body.getReader()`. Retry every 15s on failure. Falls back to polling if token missing.

**Polling:** `GET /api/office/state` — returns `taskBoard`, `taskStats`, `comms`, `timeline`, `metrics`, `delegationStatus`, and optionally `recentEvents[]` (buffered SSE events for polling fallback). Self-rescheduling setTimeout with exponential backoff on 429/5xx.

**Bug: `connectSSE()` called twice on mount:**

```typescript
// In useEffect:
connectSSE(); // ← first call
schedule(0); // starts poll loop
connectSSE(); // ← SECOND call at line before schedule(0) (another connectSSE())
```

Looking at lines ~350-360 in `use-office-data.ts`:

```typescript
connectSSE(); // line ~350
schedule(0); // line ~360
```

And inside the outer useEffect body, `connectSSE()` is called at the top AND again before `schedule`. This creates two concurrent SSE connections on mount. The second call immediately aborts the first via `sseAbortRef.current.abort()`, but creates a brief race condition.

---

### 3.11 UI Overlays (spotlight, flyout, insights, digest)

**SpotlightHUD** (250 LOC): Glassmorphism panel shown on single-click. Shows agent emoji, name, role, task count, status dot, and two actions: "Chat" (navigates to `/dashboard/chat?agent=X`) and "Assign Task" (calls `agentTasksService.create`). The `agent` prop is a synthetic `CanvasAgent` built by `getAgentForHUD()` (uses desk position, not live renderX/Y). Agent is not tracked live during spotlight.

**AgentProfileFlyout** (552 LOC): Slide-in sheet on double-click. Shows detailed stats, recent tasks, agent personality, quick chat. Fetches fresh data from API. Closes on background click or X button.

**InsightToast** (247 LOC): Toast queue showing proactive suggestions from `generateSuggestions()`. 8s display, 500ms fade, 3s gap between toasts. Max 3 in queue. Auto-dismissed after 60s age.

**DigestModal** (205 LOC): "What did I miss?" modal. Shown once per session. Summarizes recent timeline events.

---

### 3.12 Sidebar (tabs, data sources)

**SmartSidebar** (375 LOC): 4-tab interface: `timeline`, `tasks`, `metrics`, `goals`. Renders different components per tab. Receives `officeData` from `useOfficeData` poll.

**OfficeHomePage enhanced sidebar** (EnhancedSidebar inside OfficeHomePage.tsx, ~200 LOC inline): 5-tab interface: `today`, `timeline`, `tasks`, `goals`, `insights`. Wraps SmartSidebar for timeline/tasks tabs via `[&>div>div:first-child]:hidden` CSS hack to hide SmartSidebar's own tab bar. This is brittle — any DOM structure change in SmartSidebar will break the hidden selector.

---

### 3.13 Backend Emission

**Server emitters in `activity-stream.ts`:**

```
emitThinking(userId, agentId, summary)
emitToolCall(userId, agentId, tool, summary, requestId?)
emitToolResult(userId, agentId, tool, result)
emitResponding(userId, agentId, summary)
emitDone(userId, agentId)
emitIdle(userId, agentId)
emitDelegation(userId, fromAgent, toAgent, task)
emitCommSent(userId, fromAgent, toAgent, summary, commId?)
emitCommReceived(userId, fromAgent, toAgent, summary, commId?)
emitTaskStarted(userId, agentId, taskId, summary)
emitTaskCompleted(userId, agentId, taskId, result)
emitTaskFailed(userId, agentId, taskId, error)
```

**Where emitters are called (active callers):**

- `delegation-pipeline.ts`: `emitDelegation`, `emitThinking`, `emitCommSent`, `emitDone`
- `proactive-goals.ts`: `emitThinking`, `emitDone`
- `goal-service.ts`: `emitThinking`, `emitDone`, `emitDelegation`
- `multi-agent-orchestrator.ts`: `emitThinking`, `emitDone`, `emitCommSent`
- `message-router.ts`: `emitThinking`, `emitDelegation`, `emitCommSent`, `emitTaskStarted`, `emitCommReceived`, `emitTaskCompleted`, `emitDone`
- LLM react loop: `emitThinking`, `emitToolCall`, `emitToolResult`, `emitResponding`, `emitDone`, `emitIdle`

**Gap: `emitError` / `error` event type exists in `ActivityEventType` but is never emitted.** The canvas has no handler for `state === 'error'`.

---

## 4. Sprite + Asset Audit

### char_N.png files (char_0 through char_5)

**Dimensions:** 112×96 pixels each (confirmed: all six files identical size)  
**Frame size:** 16×32 pixels (as declared in code)  
**Grid:** 7 columns × 3 rows

| Col | Purpose                       | Used by renderer?                 |
| --- | ----------------------------- | --------------------------------- |
| 0   | Idle / neutral standing pose  | ✅ (frameCol=1 for standing idle) |
| 1   | Walk frame A                  | ✅ (WALK ping-pong [0,1,2,1])     |
| 2   | Walk frame B (mid-stride)     | ✅                                |
| 3   | Walk frame C / Typing frame 1 | ✅ (both walk and typing)         |
| 4   | Walk frame D / Typing frame 2 | ✅                                |
| 5   | ❓ Unknown                    | ❌ NEVER DRAWN                    |
| 6   | ❓ Unknown                    | ❌ NEVER DRAWN                    |

**Frame-config analysis:**

- `frameCol = 1` is used as the "standing idle" pose (`// frame 1 = standing pose (not 0 which is mid-stride)`)
- Walk ping-pong is `WALK = [0, 1, 2, 1]` — uses cols 0-2
- Typing uses `3 + (tick % 2)` — cols 3–4
- At furniture (isAtFurniture): `3 + (Math.floor(tick / 2) % 2)` — cols 3–4 at slower pace
- **Cols 5 and 6 exist in the PNG but are never accessed.** They may be sleeping frames, special poses, or unused space.

**Animation cycles by state:**
| Agent state | Row | Cols cycled |
|-------------|-----|-------------|
| Walking down | 0 | 0,1,2,1 (4-frame ping-pong) |
| Walking up | 1 | 0,1,2,1 |
| Walking right | 2 | 0,1,2,1 |
| Walking left | 2 + mirror | 0,1,2,1 |
| Typing/responding | facing-based row | 3,4 (2-frame alternation) |
| At furniture | facing-based row | 3,4 (slower: every 2 ticks) |
| Idle standing | facing-based row | col 1 (static) |

**Agents 6–8 (echo, cal, nova):** Reuse sheets 0, 2, 3 respectively with CSS `hue-rotate(deg)` filter applied via canvas. Pre-rendered into `hueShiftedCache`. This means echo/cal/nova look like recolored weebo/jarvis/aria — no unique body art.

### walls.png

- **Dimensions:** 64×128 pixels, RGB (no alpha)
- **Not drawn anywhere** in `OfficeCanvasRenderer.ts`
- Purpose unknown — possibly a wall tile sheet that predates the single-image office_bg.webp approach

### office_bg.webp

- Background image drawn via `drawBackground()`. 63KB.

### office_fg.webp

- Foreground depth layer. 796 bytes (tiny — mostly transparent). **Never drawn** (disabled).

### office_collision.webp

- Collision mask. 148 bytes. **Never parsed at runtime** — `loadCollisionFromImage()` is dead code. Hardcoded `COLLISION_MAP` in constants.ts is used instead.

### office_xy.webp

- 226 bytes. Purpose unclear from filename. **Not referenced anywhere** in source code.

### office*laptop*\*.webp (8 files)

- 8 variants: `front/back/left/right` × `open/close`
- None are drawn anywhere in `OfficeCanvasRenderer.ts`
- Likely planned for future laptop-at-desk rendering or smart object click reveal
- Smallest: 130 bytes (front_close), largest: 226 bytes (back_open/right_open)
- All 9 laptop files (including `office_laptop.webp`) are unused assets.

---

## 5. Movement Annoyances (Why Movement Feels Bad)

This section traces the movement pain points through `agentBehavior.ts` and the RAF loop in `OfficeStage.tsx`.

### 5.1 Wander Trigger Frequency

**`PERSONALITY_SIT_DURATION` per agent:**

```typescript
edith:  { min: 20, max: 35 }  // 4–7 seconds before first wander
jarvis: { min: 15, max: 25 }  // 3–5 seconds
weebo:  { min: 8,  max: 15 }  // 1.6–3 seconds
aria:   { min: 10, max: 18 }  // 2–3.6 seconds
forge:  { min: 18, max: 28 }  // 3.6–5.6 seconds
pulse:  { min: 14, max: 22 }  // 2.8–4.4 seconds
echo:   { min: 12, max: 20 }  // 2.4–4 seconds
cal:    { min: 15, max: 24 }  // 3–4.8 seconds
nova:   { min: 6,  max: 12 }  // 1.2–2.4 seconds
```

**With stagger applied**: `timer = randomInt(min, max) + randomInt(0, max)`. Nova's timer = `randomInt(6,12) + randomInt(0,12)` → 6–24 ticks (1.2–4.8 seconds). The stagger DOUBLES the max sitting time, which is good for initial spawn. After the first wander, the stagger is removed and nova sits for 1.2–2.4s before wandering again.

**Problem (agentBehavior.ts:~1145):** After a wander cycle completes (`wanderCount >= maxSpots`, 3–4 spots), the agent returns to sitting mode with `timer = randomInt(sitDur.min, sitDur.max)`. Nova (min:6, max:12) will sit for 1.2–2.4 seconds. With 9 agents active simultaneously and a `maxMovers = 8` cap (day) / 5 (night), there's nearly always something moving.

### 5.2 Random Direction Picker

Agents do NOT pick random directions. They always navigate to a smart object interaction point via `chooseDestination()` which uses personality-weighted selection. The destination is always a fixed tile coordinate. No random direction picking exists — this is good.

However, the social visit target (socializing mode) picks a random agent and positions adjacent to them: `socialX = target.x + (agent.x > target.x ? 1 : -1)`. This ignores whether that tile is walkable. `validateTarget()` catches this, but the final destination may be far from the intended social spot.

### 5.3 Jitter / Sub-pixel Wobble Causes

**Source (OfficeStage.tsx RAF loop, smooth interpolation section):**

```typescript
const dist = Math.sqrt(dx * dx + dy * dy);
if (dist < 0.5) return agent; // close enough — skip update
let speed = BASE_SPEED * (agent.speed || 1.0) * dt;
if (dist < 32) { speed *= 0.5 + 0.5 * (dist / 32); }
const move = Math.min(speed, dist);
return { ...agent, renderX: agent.renderX + (dx/dist)*move, renderY: ... };
```

**Problem 1:** `setAgents` for interpolation fires every RAF frame AND the behavior tick `setAgents` fires at 5fps. Between behavior ticks, the interpolation state is computed from `agent.path[agent.pathIndex]`. When a behavior tick fires simultaneously, both updates compete — React batches them in the same flush (since they're both inside the same `requestAnimationFrame` callback) but the ordering isn't guaranteed.

**Problem 2:** The path-step advance logic in the 200ms accumulator tick checks `distToStep < 2` (pixels), then sets `updated.pathIndex = agent.pathIndex + 1`. If `renderX/renderY` hasn't reached the step yet (within 2px) when the next behavior tick fires, the grid position `agent.x` advances but `renderX/Y` is still behind — causing a small "jump" as the interpolation target suddenly shifts to the next tile's center.

**Problem 3:** Idle bob: `const bobOffset = isIdle ? Math.round(Math.sin(tick * 0.3) * 1) : 0`. This adds a ±1px sine wave to all stationary agents. With `tick = Math.floor(time/200)`, at 200ms increments this changes every 200ms — a discrete step, not smooth. This creates a 1px stutter every 200ms for all idle agents.

**Problem 4 (agentBehavior.ts:~1160):**

```typescript
// Agent avoidance reroute:
if (isYielder) {
  const repath = findFullPath(agent.x, agent.y, target.x, target.y);
  if (repath.length > 0) {
    updated.path = repath;
    updated.pathIndex = 0; // ← resets to start
  }
}
```

When an agent avoidance reroute fires, `pathIndex` resets to 0 even though the agent may have already traversed several steps. The agent "teleports" its target back to a tile it already passed, causing a visible backward lurch.

### 5.4 Speed Consistency

Base speed is 96 px/sec in smooth interpolation (`BASE_SPEED = 96`). Personality multipliers in `AGENT_SPEED`:

```
nova: 1.2   → 115 px/sec
weebo: 1.15 → 110 px/sec
aria: 1.1   → 105 px/sec
pulse: 1.05 → 100 px/sec
jarvis: 1.0 → 96 px/sec
cal: 1.0    → 96 px/sec
echo: 0.95  → 91 px/sec
forge: 0.9  → 86 px/sec
edith: 0.85 → 81 px/sec
```

All agents walk at consistent, predictable speeds. This is good.

Arrival deceleration: `if (dist < 32) speed *= 0.5 + 0.5*(dist/32)` — decelerates in the last 32px (1 tile). This looks natural.

**Problem:** The behavior system in `agentBehavior.ts` also sets `bState.speed` which is synced to `agent.speed`. But the behavior system uses `bState.speed = AGENT_SPEED[agent.id]` when transitioning modes. The `resting` mode sets `speed *= 0.8` for a "slow walk to rest spot". However, this speed change is only applied to `bState.speed`, and the Stage only syncs `bState.speed → agent.speed` inside `tickBehaviors`. If an SSE event fires and `cancelIdleBehavior()` is called, `agent.speed` is NOT reset — the agent might walk to their desk at 0.8× speed from a previous rest mode.

### 5.5 Path Interpolation

BFS returns full path, stored in `agent.path[]`. Agent advances one step at a time via the 200ms accumulator (when `distToStep < 2px`) and the 60fps interpolation moves `renderX/Y` toward the current step.

**The interpolation is per-step, not full-path smooth.** Each tile transition causes a brief deceleration (arrival at step) followed by acceleration toward the next step. With 32px tiles at 96 px/sec, each tile takes ~333ms. The deceleration zone (`dist < 32px`) covers the entire tile, meaning agents always decelerate into every intermediate path step, not just the final destination. This makes movement feel stuttery — every tile transition has a slow-down.

**Fix needed:** Only apply arrival deceleration at the final path tile, not every intermediate step.

### 5.6 Multiple Agents Walking Simultaneously

`maxMovers` cap:

```typescript
const maxMovers = isNight ? 5 : 8;
```

At night: up to 5 agents walking simultaneously. Day: up to 8. With 9 agents total, 1 (night) or 1 (day) may be forced to sit longer than intended. Counter is a local `let activeMovers` computed fresh each tick from `behaviorStates` — no cross-tick drift.

**Problem:** `activeMovers++` is incremented when an agent starts wandering, but never decremented when they arrive and sit down (decremented only in the `wanderCount >= maxSpots` branch: `activeMovers--`). Wait — looking at the code: `activeMovers` is re-computed at the start of each tick (`agents.filter(a => { const bs = behaviorStates.get(a.id); return bs && (...) }).length`). So it's not a running counter — it's recalculated fresh. The `activeMovers++` inside the tick is a local increment for the current tick's decisions. This is actually correct behavior but confusing code.

### 5.7 Idle vs Movement Ratio

With nova sitting 1.2–2.4s and visiting 3–4 spots (`maxSpots = 3 + Math.random() < 0.4 ? 1 : 0`), each visit taking 6–30 seconds (`INTERACTION_DURATION` values scaled by `LINGER_MULTIPLIER`), nova's full cycle is:

- Sit: ~2s
- Wander spot 1 (bookshelf, browse): 10–20s (1.5× multiplier = 15–30s)
- Wander spot 2: 10–20s
- Wander spot 3: 10–20s
- Back to sit: ~2s
- Total cycle: ~47–92s

Nova is in motion ~3–8% of the time. Edith's cycle:

- Sit: ~5.5s avg
- Wander spot 1 (desk, work): 8–15s × 1.5 = 12–22.5s
- Spot 2, 3, 4 (up to 4 spots)
- Back to sit: ~5.5s
- Total cycle: ~40–100s

Movement feels sparse because agents spend 90%+ of time sitting. The visual effect is periodic bursts of motion separated by long desk sessions. This is realistic but can feel dead for users who aren't actively sending messages.

### 5.8 Explicit Annoyance List with File:Line

| Annoyance                               | File                                  | Approx Line | Description                                                                          |
| --------------------------------------- | ------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| 3 `setAgents` calls/frame               | `OfficeStage.tsx`                     | ~640–820    | Three separate state updates per RAF = 3 React reconciliations/frame at 60fps        |
| Discrete bob stutter                    | `OfficeCanvasRenderer.ts` drawAgent() | ~290        | `Math.round(Math.sin(tick*0.3)*1)` creates 1px discrete jump every 200ms             |
| Decel on every path step                | `OfficeStage.tsx` interpolation       | ~808–818    | `if (dist < 32) speed *= 0.5` fires at every intermediate tile, not just destination |
| Path-step advance at 2px threshold      | `OfficeStage.tsx` behavior tick       | ~665–685    | `distToStep < 2` advances grid pos while renderX/Y still up to 30px behind           |
| Avoidance reroute resets pathIndex to 0 | `agentBehavior.ts` wandering case     | ~1224–1231  | Agent may appear to walk backward when avoidance fires                               |
| Social visit crosses entire office      | `agentBehavior.ts` sitting case       | ~1165–1172  | Target picked from ALL idle agents, not proximity-constrained                        |
| Speed not reset on `cancelIdleBehavior` | `agentBehavior.ts` cancelIdleBehavior | ~575–590    | Resting agents (0.8× speed) may walk to desk at reduced speed after task             |
| Glance state does nothing useful        | `agentBehavior.ts` sitting case       | ~783–796    | Both branches of ternary return same value (`glance.savedFacing`)                    |
| `makeWalkRight` doesn't narrow profile  | `sprites.ts` makeWalkRight            | ~1300–1320  | Comment promises "thinner side profile" but code copies idle unchanged               |

---

## 6. Event → Reaction Mapping (Current + Gaps)

| Backend Event    | Server Emitter               | Canvas reacts? | How                                                                                                                    | Gap                                                                                            |
| ---------------- | ---------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `thinking`       | `emitThinking()`             | ✅             | Agent state → `thinking`, desk walk, personality bubble, tier effect (spotlight/zoom), launch huddle if `isMultiAgent` | —                                                                                              |
| `tool_call`      | `emitToolCall()`             | ✅             | State → `tool_call`, tier effect, tool name bubble ("Using X..."), trackAgentTool                                      | —                                                                                              |
| `tool_result`    | `emitToolResult()`           | ✅ (partial)   | State → `tool_result`, no bubble, no special visual beyond state indicator pixel-art icon                              | Could show brief "Got result!" bubble                                                          |
| `responding`     | `emitResponding()`           | ✅             | State → `responding`, typing animation, "..." indicator                                                                | —                                                                                              |
| `done`           | `emitDone()`                 | ✅             | State → `done`, tier finalization, huddle dispersal, 3s delay → `idle`                                                 | —                                                                                              |
| `idle`           | `emitIdle()`                 | ✅ (partial)   | Falls to `default: agent.state = evt.state`                                                                            | No idle-specific reaction (no bubble, no anim)                                                 |
| `delegating`     | `emitDelegation()`           | ✅             | Glow pulse, specialist teleport to near delegator + walk to desk, particle beam, delegation tracker set                | —                                                                                              |
| `comm_sent`      | `emitCommSent()`             | ✅             | State → `comm_sent`, particle beam, send phrase bubble                                                                 | —                                                                                              |
| `comm_received`  | `emitCommReceived()`         | ✅             | State → `comm_received`, reverse beam, receive phrase bubble                                                           | —                                                                                              |
| `task_started`   | `emitTaskStarted()`          | ✅             | State → `task_started`, desk walk, `cancelIdleBehavior`                                                                | —                                                                                              |
| `task_completed` | `emitTaskCompleted()`        | ✅             | State → `task_completed`, completion phrase, bounce effect, delegation reaction                                        | —                                                                                              |
| `task_failed`    | `emitTaskFailed()`           | ✅             | State → `task_failed`, failure phrase bubble                                                                           | —                                                                                              |
| `error`          | **emitError() — MISSING**    | ❌             | Not implemented                                                                                                        | `error` is in `ActivityEventType` but no `emitError()` exists and canvas has no handler for it |
| `message_in`     | `emit({type:'message_in'})`  | ❌             | Not handled in canvas switch                                                                                           | Canvas has no `case 'message_in'`                                                              |
| `message_out`    | `emit({type:'message_out'})` | ❌             | Not handled in canvas switch                                                                                           | Canvas has no `case 'message_out'`                                                             |
| goal events      | None                         | ❌             | `goal_completed`, `goal_started` not in ActivityEventType                                                              | No canvas reaction to goal lifecycle                                                           |
| habit events     | None                         | ❌             | No habit completion events exist in the stream                                                                         | No canvas reaction                                                                             |

**Key gap:** `message_in` and `message_out` event types exist in `ActivityEventType` in `activity-stream.ts` but the canvas switch statement in `OfficeStage.tsx` has no handlers for them — they fall to `default: agent.state = evt.state`. Since `AgentStateType` in `types.ts` doesn't include `'message_in' | 'message_out'`, this creates a type mismatch at runtime (silent — TypeScript won't catch it since `evt.state` is typed `AgentStateType` from the SSE parse, not `ActivityEventType`).

---

## 7. Dead Code / Unused Imports

### Unused functions (exported but never called):

- `navigation.ts`: `bfsNextStep()`, `isReachable()`, `randomWalkableInRadius()`, `isValidAgentTarget()`
- `agentBehavior.ts`: `startDelivery()`, `tickDeliveries()`, `isDelivering()`
- `collisionLoader.ts`: `loadCollisionFromImage()`, `isAuthoredMapLoaded()`, `getAuthoredMap()`
- `sprites.ts`: `areSpriteSheetLoaded()`, `clearSpriteCache()` (not called in app code, only in tests)

### Unused assets:

- `public/office/office_xy.webp` — not referenced anywhere
- `public/office/walls.png` — not referenced anywhere in renderer
- `public/office/office_fg.webp` — loaded, never drawn (foreground disabled)
- `public/office/office_laptop*.webp` (8 files) — never drawn

### Unused modules:

- `taskQueue.ts` — entire module unused. Not imported in OfficePage, OfficeStage, or anywhere else.
- `collisionLoader.ts` — `loadCollisionFromImage()` result is unused; COLLISION_MAP from constants.ts is used directly.

### Commented-out code:

- `OfficeStage.tsx`: Easing function `easeInOutCubic` commented out with note "for potential future use" (~line 218)
- `OfficeCanvasRenderer.ts`: Foreground draw call disabled (~line 1371): `// if (isBgLoaded()) { drawForeground(ctx); }`
- `OfficeCanvasRenderer.ts`: `drawTimeOfDayOverlay` exists but is not called (replaced by theme-based overlay)
- `agentBehavior.ts`: `// Home positions no longer used — agents roam freely. Kept for reference.`

### TODOs:

- `AnimationTierSelector.ts` `__tests__`: 19+ test files documenting missing `__resetModuleState()` export with detailed TODOs.

### Duplicate code:

- `getAgentForHUD()` — verbatim duplicate in `OfficePage.tsx` and `OfficeHomePage.tsx`
- `insightCards` extraction from `officeData.timeline` — verbatim duplicate in both files
- `proactiveSuggestions` polling `useEffect` — verbatim duplicate in both files
- `officeTheme` state + `resolvedTheme` computation — near-duplicate in both files
- `objectPopover` state + timer — duplicate in both files

---

## 8. Performance Notes

### RAF Loop Shape

```
requestAnimationFrame(frame)
├── dt computation (capped 100ms)
├── behaviorAccum += dt
│   └── if >= 0.2s:
│       ├── setAgents(path advance)    ← React state update #1
│       └── setAgents(tickBehaviors)   ← React state update #2 (+ setBubbles)
├── expireAccum += dt
│   └── if >= 0.2s:
│       ├── setBeams(filter)           ← React state update #3
│       └── setBubbles(filter)         ← React state update #4
├── setAgents(smooth interpolation)    ← React state update #5 (EVERY frame)
├── tickEffects(effectStateRef, dtMs)  ← mutable ref, no React
└── renderFrame(ctx, ...)              ← pure canvas draw
```

**Per-60fps-frame:** 1 mandatory `setAgents` (smooth interpolation = React reconciliation). Every 200ms: +1-2 more `setAgents` + `setBubbles` + `setBeams`. At 60fps steady state: ~60 reconciliations/sec from interpolation alone.

### Draw Calls per Frame

- `drawBackground()`: 1 `drawImage` call
- `drawAmbientParticles()`: 15 `arc`+`fill` pairs (15 circles)
- `drawTrailParticles()`: up to 120 `arc`+`fill` pairs
- `drawParticleBeam()`: Per beam: 1 quadratic bezier stroke + 18 particle arcs + 1 orb arc = ~20 draw ops per beam. Max 5 beams = ~100 ops.
- `drawAgent()`: Per agent: 1 radial gradient fill + 2 ring strokes (if active) + 1 `drawImage` or fallback canvas draw + 1 shadow fill + 3 canvas text ops = ~8 draw ops. 9 agents = ~72 ops.
- `drawStateIndicator()`: Per active agent: ~5-10 fillRect ops.
- `drawAmbientEffects()`: ~5-10 fills for screen flickers + steam + grid lines + server rack.
- **Total estimate:** ~250-350 canvas operations per frame. Reasonable for 60fps.

### ImageBitmap Caching

- Background/foreground: Raw `HTMLImageElement` — NOT using `ImageBitmap`. Each `drawImage(img, ...)` call involves software readback.
- PNG sprites: `HTMLImageElement` sheets. Each `drawSpriteFrame()` crops via `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`. Not using `ImageBitmap`.
- Programmatic sprites: `HTMLCanvasElement` cached in `spriteCache` — essentially offscreen canvases. Fast.

### Per-Frame Allocations

- `setAgents(prev => ...)` with spread: `const next = [...prev]` creates 9-element array + 9 new agent objects every call. At 60fps, ~1620 object allocations/sec just from interpolation `setAgents`.
- `hexToRgba(hex, alpha)` is called in hot paths (per agent, per particle) and creates a new string each time. At 60fps × 9 agents × 4+ calls = ~2160 string allocations/sec.
- Trail particle array: `trailParticles.push({...})` creates new objects each emit. `writeIdx` compaction avoids GC pressure.

### Memoization Gaps

- `spotlightAgent` in `OfficePage`: `useMemo([selectedAgentId])` — fine.
- `insightCards` in both pages: `useMemo([officeData?.timeline, dismissedInsights])` — fine.
- `allInsights` merge: `useMemo([insightCards, proactiveSuggestions])` — fine.
- `hitTestAgent()`: `useCallback([agents])` — BUT `agents` is React state updated ~60 times/sec. So `hitTestAgent` is recreated 60 times/sec. Should use `agentsRef.current` from a ref to avoid recreation.
- `hitTestObject()`: `useCallback([])` — stable (empty deps). Fine.

### Re-render Triggers from React

`OfficeStage` re-renders on:

1. `events` prop change (from parent's `setSseEvents` in `useOfficeData`)
2. `selectedAgentId` prop change
3. `theme` prop change
4. Internal: `agents`, `beams`, `bubbles` state changes (60fps interpolation)
5. Internal: `containerSize` on resize
6. Internal: `isMobile` on window resize
7. Internal: `assetsReady` once on load

The dominant re-render source is the 60fps smooth interpolation `setAgents`. The parent (`OfficePage`/`OfficeHomePage`) does NOT re-render at 60fps — only `OfficeStage` itself. But `SpeechBubbleLayer` (child of `OfficeStage`) re-renders every time `OfficeStage` does because `bubbles` and `agents` are passed as props from state.

---

## 9. File Ownership Map for Parallel Refactor

### Proposed New Structure → Lane Owners

```
src/dashboard/pages/office/
├── canvas/                      → L2 (shell only — OfficeStage.tsx split)
│   ├── OfficeStage.tsx          → L2 (trim to: container, click, event processing)
│   └── renderer/
│       ├── OfficeCanvasRenderer.ts  → L3 (lighting effects, weather layers)
│       ├── ParticleLayer.ts         → L2 (particle beam hook — moves from Stage)
│       └── AmbientRenderer.ts       → L3 (ambient effects, time-of-day)
│
├── systems/
│   ├── behavior/                → L1 (sole owner)
│   │   ├── agentBehavior.ts     → L1 (split from 1813 LOC god file)
│   │   ├── groupMeeting.ts      → L1 (extract group meeting logic)
│   │   └── deliveries.ts        → L1 (extract delivery system — currently dead)
│   ├── navigation/              → L1 (sole owner)
│   │   ├── navigation.ts        → L1 (clean up dead exports)
│   │   └── collisionData.ts     → L1 (move COLLISION_MAP out of constants.ts)
│   ├── animation/               → L1 (sole owner)
│   │   ├── AnimationTierSelector.ts → L1 (add __resetModuleState export)
│   │   └── sprites.ts           → L1 (may split: templates vs PNG loader)
│   ├── effects/                 → L2 (sole owner)
│   │   └── CanvasEffects.ts     → L2
│   └── ambient/                 → L3 (sole owner)
│       └── AmbientEffects.ts    → L3 (extract from OfficeCanvasRenderer)
│
├── entities/                    → shared read-only (L1 writes, L2/L3 read)
│   ├── types.ts                 → shared (move AGENT_WORK_HOURS to constants)
│   ├── constants.ts             → shared (clean COLLISION_MAP split)
│   ├── smartObjects.ts          → shared
│   ├── roomZones.ts             → shared
│   └── occupancy.ts             → shared
│
├── world/                       → shared read-only
│   └── perception.ts            → shared
│
├── state/                       → L2 (primary owner), L1 reads
│   └── use-office-data.ts       → L2 (fix double-connectSSE bug)
│
├── overlays/                    → L2 (primary)
│   ├── SpotlightHUD.tsx         → L2
│   ├── AgentProfileFlyout.tsx   → L2
│   ├── InsightToast.tsx         → L2
│   ├── DigestModal.tsx          → L2
│   └── SpeechBubbleLayer.tsx    → L2
│
├── sidebar/                     → untouched in this phase
│   ├── SmartSidebar.tsx
│   ├── TimelineCard.tsx
│   ├── TimelineTab.tsx
│   ├── TasksTab.tsx
│   ├── MetricsTab.tsx
│   └── GoalsTab.tsx
│
├── pages/                       → L2 (shell only)
│   ├── OfficePage.tsx           → L2
│   └── OfficeHomePage.tsx       → L2 (deduplicate getAgentForHUD etc.)
│
├── proactiveSuggestions.ts      → untouched
├── collisionLoader.ts           → untouched (or delete in 0b)
├── taskQueue.ts                 → untouched (or delete in 0b)
└── index.ts                     → shared
```

### Conflict Risk Analysis

| File                      | Risk                                                                        | Lanes                       | Resolution                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts`            | HIGH — COLLISION_MAP + desk positions + design tokens all used by all lanes | L1, L2, L3                  | Split into `collisionData.ts` (L1 owns), keep constants.ts for shared tokens                                                                                              |
| `types.ts`                | MEDIUM — AgentId, CanvasAgent, SSEEvent used everywhere                     | L1, L2, L3                  | Mark read-only; only L2 adds new types. Move `AGENT_WORK_HOURS` to constants.ts before lanes start.                                                                       |
| `agentBehavior.ts`        | HIGH — 1813 LOC god file used by L2 (OfficeStage imports from it)           | L1 (sole write), L2 (reads) | L1 splits the file; L2 must wait or work from the pre-split version. **Pre-split into at minimum `agentBehavior.ts` + `groupMeeting.ts` in Phase 0b before lanes start.** |
| `OfficeCanvasRenderer.ts` | MEDIUM — L2 adds particle hook, L3 adds weather                             | L2, L3                      | Add a `drawCustomLayer(ctx, tick, theme)` hook point in Phase 0b. L2 passes particle data; L3 provides ambient data. Zero overlap on existing functions.                  |
| `OfficeStage.tsx`         | MEDIUM — L2 owns but imports from L1 (agentBehavior)                        | L1, L2                      | L1 must stabilize `agentBehavior` exports before L2 refactors Stage. Sequence: L1 finishes agentBehavior split → L2 starts Stage refactor. Use blocking dep.              |
| `sprites.ts`              | LOW — L1 sole owner                                                         | L1                          | No conflict.                                                                                                                                                              |
| `use-office-data.ts`      | LOW — L2 sole owner                                                         | L2                          | No conflict, but fix double-connectSSE before lanes start.                                                                                                                |

---

## 10. Recommended Changes for Phase 0b (Modularize)

These are pure file moves/splits with **no logic changes**. All logic changes go to Phase 1 lanes.

1. **Create `src/dashboard/pages/office/collisionData.ts`**  
   Move `COLLISION_MAP`, `T`, `F` constants from `constants.ts` (lines ~65-91) into the new file. Update imports in `constants.ts` (`export { COLLISION_MAP } from './collisionData'`) and in `navigation.ts`.

2. **Move `AGENT_WORK_HOURS` from `types.ts` to `constants.ts`**  
   `AGENT_WORK_HOURS` is a constant, not a type. Move to constants.ts. Update imports in `OfficePage.tsx`.

3. **Extract `proactiveSuggestions` to a shared helper and deduplicate**  
   Create `src/dashboard/pages/office/useProactiveSuggestions.ts` hook. Import in both `OfficePage.tsx` and `OfficeHomePage.tsx` instead of duplicating the `useEffect`+`useState` block.

4. **Extract `getAgentForHUD()` to a shared utility**  
   Create `src/dashboard/pages/office/agentUtils.ts` with `getAgentForHUD()`. Import in both `OfficePage.tsx` and `OfficeHomePage.tsx`.

5. **Extract `GREETING_PHRASES`, `THINKING_PHRASES`, `COLLAB_SEND_PHRASES`, `COLLAB_RECV_PHRASES`, `COMPLETION_PHRASES`, `FAILURE_PHRASES`, `DELEGATION_REACTION_PHRASES` from `OfficeStage.tsx` to a new file**  
   Destination: `src/dashboard/pages/office/agentPhrases.ts`. Import in `OfficeStage.tsx`.

6. **Extract group meeting logic from `agentBehavior.ts` to `groupMeeting.ts`**  
   Move: `GroupMeeting` interface, `activeGroupMeeting`, `GROUP_MEETING_BEHAVIORS`, `tryStartGroupMeeting()`, `tickGroupMeeting()`. Destination: `src/dashboard/pages/office/systems/groupMeeting.ts`. Re-export from `agentBehavior.ts`.

7. **Extract delivery system from `agentBehavior.ts` to `deliveries.ts`**  
   Move: `AgentDelivery` interface, `pendingDeliveries`, `startDelivery()`, `tickDeliveries()`, `isDelivering()`. Destination: `src/dashboard/pages/office/systems/deliveries.ts`. Re-export from `agentBehavior.ts`.

8. **Move `collisionLoader.ts` to `systems/navigation/collisionLoader.ts`**  
   No logic change. Update imports.

9. **Move `navigation.ts` to `systems/navigation/navigation.ts`**  
   No logic change. Update imports everywhere.

10. **Move `sprites.ts` to `systems/animation/sprites.ts`**  
    No logic change.

11. **Move `AnimationTierSelector.ts` to `systems/animation/AnimationTierSelector.ts`**  
    Add `export function __resetModuleState(): void { requestToolCounts.clear(); }` (required for test suite unblocking — this IS a one-line logic addition but it's trivially safe).

12. **Move `CanvasEffects.ts` to `systems/effects/CanvasEffects.ts`**  
    No logic change.

13. **Move `perception.ts` to `world/perception.ts`**  
    No logic change.

14. **Move `occupancy.ts` to `entities/occupancy.ts`**  
    No logic change.

15. **Move `roomZones.ts` to `entities/roomZones.ts`**  
    No logic change.

16. **Move `smartObjects.ts` to `entities/smartObjects.ts`**  
    No logic change.

17. **Move `types.ts` to `entities/types.ts`**  
    No logic change (after step 2 is done).

18. **Move `agentBehavior.ts` to `systems/behavior/agentBehavior.ts`**  
    After steps 6 and 7. No logic change.

19. **Add `src/dashboard/pages/office/canvas/types.ts`**  
    Move `RenderState` interface from `OfficeCanvasRenderer.ts` to its own file. Import back.

20. **Delete dead code files:**
    - `taskQueue.ts` — no callers
    - Consider keeping `collisionLoader.ts` for Phase 1 (L1 may enable it)

---

## 11. Risks and Open Questions

### Risks

1. **Type safety gap: `ActivityEventType` vs `AgentStateType`** — The server emits `message_in`/`message_out` events. The canvas `SSEEvent.state` is typed as `AgentStateType` (no `message_in/out`). The canvas switch statement falls to `default` for these. No crash, but `agent.state = evt.state` would set an invalid type. This is a silent type mismatch.

2. **Double SSE connection on mount** — `connectSSE()` is called twice in `use-office-data.ts` `useEffect`. The second call immediately aborts the first. This is a race condition that could cause missed events in the first ~50ms after mount.

3. **Module-level global state leaking between test runs** — `agentBehavior.ts` has extensive module-level mutable state. The 50+ test files in `__tests__/` document this extensively. Phase 0b's `__resetModuleState()` export addition will partially address this for `AnimationTierSelector`, but `agentBehavior.ts`'s state needs a similar export.

4. **Foreground depth layer off** — Re-enabling `drawForeground()` in Phase 1 will require solving agent sprite clipping behind desk furniture. Naive re-enable will cause visual artifacts. Proper fix requires Y-sorted rendering with per-tile depth masks.

5. **Sprite column 5-6 mystery** — Columns 5–6 in each sprite sheet are never drawn. If they contain sleeping/celebrating poses, they represent unused art. If they're blank, no issue. This needs visual inspection of the PNG files.

6. **`proactiveSuggestions.ts` API path bug** — `safeFetch('/reminders')` passes just `/reminders` to `apiBase()` which returns `http://localhost:3001/api`. The full URL would be `http://localhost:3001/api/reminders`. But the template literal is `` `${apiBase()}${path}` `` — if `path` is `/reminders`, the final URL is `http://localhost:3001/api/reminders`. This is correct! The confusion is that `apiBase()` returns a URL ending in `/api` (not `/api/`), and `path` starts with `/`. So the URL is fine.

7. **`OfficeHomePage` and `OfficePage` are both accessible routes** — Two separate pages both create independent SSE connections and polling loops. If a user navigates from one to the other without full unmount, there could be a brief period of double connections.

### Open Questions for User

1. **What are columns 5–6 in the sprite sheets?** Are they intentional blank space, future animation frames (sleeping? celebrating?), or accidental empty space? This determines whether L1 should reference them.

2. **Should `collisionLoader.ts` be activated in Phase 1?** Loading collision from the image enables live editing of the collision map without code changes. Worth enabling if the team plans to iterate on the office layout.

3. **Should `taskQueue.ts` be deleted or integrated?** It's a well-designed in-memory task queue with routing — but it's disconnected from everything. Delete or wire up?

4. **Is the foreground layer re-enablement in scope for Phase 1?** It requires non-trivial depth masking work. Which lane owns it?

5. **What are `office_xy.webp` and `walls.png` for?** Should they be deleted or will they be used?

6. **Is the launch huddle (`activeLaunchHuddle`) working as intended?** It gathers agents at the meeting table when `isMultiAgent` is true. But the huddle state is module-level in `OfficeStage.tsx` (not in React state), so it can't be inspected in React DevTools.

7. **Should `startDelivery()`/`tickDeliveries()` be wired up?** The system is complete and could provide visual agent handoffs. Currently entirely dead.

8. **Target frame budget for Phase 1?** Currently ~250–350 draw ops per frame + 3 React reconciliations. Is 60fps the target? Should we budget for 30fps render with 60fps React updates?

### Test Coverage Gaps

- `OfficeStage.tsx` — 0 tests (it's a React component with heavy RAF/canvas logic — hard to test but critical)
- `OfficePage.tsx` — 0 tests
- `OfficeHomePage.tsx` — 0 tests
- `use-office-data.ts` — 0 tests (SSE hook with complex reconnection logic)
- `proactiveSuggestions.ts` — 0 tests
- `SmartSidebar.tsx` — 0 tests
- `agentBehavior.ts` — 3 test files (basic coverage of tick, smart-objects, behavior modes)
- `OfficeCanvasRenderer.ts` — 7 test files (beams, complete, gaps, image-mocking, render-loop, sprite-frames)
- `AnimationTierSelector.ts` — 19 test files (massively overtested relative to other files)
- `navigation.ts` — 1 test file (good, navigation is critical path)
- `occupancy.ts` — 1 test file
- `perception.ts` — 2 test files

---

## 12. Appendix — Code Snippets and Reference

### A. COLLISION_MAP Dimensions

```typescript
// constants.ts
export const CELL = 32;
export const COLS = 27;
export const ROWS = 25;
export const CANVAS_W = 864; // 27 × 32
export const CANVAS_H = 800; // 25 × 32
// COLLISION_MAP: boolean[25][27], T=blocked, F=walkable
// ~298 walkable tiles, single connected zone
```

### B. Desk Positions (tile coordinates, verified walkable)

```typescript
// CORE_DESK_POSITIONS
weebo:  { x: 3,  y: 20 }  // left desk cluster
edith:  { x: 9,  y: 20 }  // right desk cluster
jarvis: { x: 7,  y: 18 }  // center aisle

// SPECIALIST_POSITIONS
aria:   { x: 20, y: 13 }  // meeting-tv
forge:  { x: 5,  y: 20 }  // left desk cluster
pulse:  { x: 11, y: 20 }  // right desk cluster
echo:   { x: 4,  y: 20 }  // left desk cluster
cal:    { x: 24, y: 14 }  // whiteboard / meeting room
nova:   { x: 10, y: 20 }  // right desk cluster
```

### C. Sprite Sheet Configuration

```typescript
// sprites.ts — SpriteSheet definition
interface SpriteSheet {
  image: HTMLImageElement;
  frameWidth: number; // 16px
  frameHeight: number; // 32px
  cols: number; // 7
  rows: number; // 3
  loaded: boolean;
}
// PNG actual dimensions: 112×96px (confirmed)
// 112 ÷ 16 = 7 cols, 96 ÷ 32 = 3 rows ✓
// Row 0: walk DOWN; Row 1: walk UP; Row 2: walk RIGHT
// Col 0: idle; Cols 1-3: walk; Cols 3-4: typing; Cols 5-6: UNUSED
```

### D. Agent Speed Multipliers

```typescript
// agentBehavior.ts — AGENT_SPEED
const AGENT_SPEED: Record<string, number> = {
  weebo: 1.15,
  edith: 0.85,
  jarvis: 1.0,
  aria: 1.1,
  forge: 0.9,
  pulse: 1.05,
  echo: 0.95,
  cal: 1.0,
  nova: 1.2,
};
// OfficeStage.tsx — BASE_SPEED = 96 px/sec
// Final speed = 96 × agent.speed × dt
// Nova: 115 px/sec; Edith: 82 px/sec
```

### E. BFS Path Finding (findFullPath signature)

```typescript
// navigation.ts
export function findFullPath(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): Array<{ x: number; y: number }>;
// Returns path EXCLUDING start tile
// Returns [] if already at target or no path exists
// Uses 4-directional BFS with parent-map reconstruction
// O(walkable_tiles) ≈ O(298) worst case
```

### F. Animation Tier Selection

```typescript
// AnimationTierSelector.ts
export function selectAnimationTier(ctx: TierContext): AnimationTier {
  if (ctx.isFirstVisit) return 3; // First visit → cinematic
  if (ctx.isMultiAgent || ctx.toolCallCount >= 2) return 2; // Complex → spotlight
  if (ctx.thinkingStartTime > 0 && Date.now() - ctx.thinkingStartTime > 10_000) return 3; // Long think → cinematic
  return 1; // Simple → minimal
}
```

### G. Interaction Duration Ranges (ticks × 200ms = seconds)

```typescript
// agentBehavior.ts
const INTERACTION_DURATION = {
  coffee: { min: 40, max: 75 }, // 8–15s at coffee counter
  relax: { min: 75, max: 150 }, // 15–30s on couch/lounge
  chat: { min: 50, max: 100 }, // 10–20s chatting
  collaborate: { min: 50, max: 100 }, // 10–20s at meeting table
  present: { min: 40, max: 75 }, // 8–15s presenting
  observe: { min: 40, max: 75 }, // 8–15s observing
  browse: { min: 50, max: 100 }, // 10–20s at bookshelf
  work: { min: 40, max: 75 }, // 8–15s at work desk
};
// Multiplied by LINGER_MULTIPLIER per agent personality
// e.g., nova at browse: 10–20s × 2.0 = 20–40s
```

### H. RAF Loop Performance Budget

```
Per 60fps frame:
  Mandatory: setAgents(smooth interpolation) → 1 React reconciliation
  Every 200ms: setAgents(path advance) + setAgents(behavior tick) + setBubbles + setBeams
               → 4 additional React reconciliations
  Canvas draw: ~250–350 draw operations via renderFrame()
  Net: ~60–80 reconciliations/sec + ~60fps canvas redraws
```

### I. ActivityStream Event Types (server → canvas mapping)

```typescript
// activity-stream.ts ActivityEventType (complete list):
type ActivityEventType =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'tool_call'
  | 'tool_result'
  | 'responding'
  | 'done'
  | 'message_in'
  | 'message_out' // ← NOT in frontend AgentStateType
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'delegating'
  | 'comm_sent'
  | 'comm_received'
  | 'error'; // ← NOT handled in canvas switch

// frontend types.ts AgentStateType (subset):
type AgentStateType =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'tool_call'
  | 'tool_result'
  | 'responding'
  | 'done'
  | 'delegating'
  | 'comm_sent'
  | 'comm_received'
  | 'task_started'
  | 'task_completed'
  | 'task_failed';
// Missing: 'message_in', 'message_out', 'error'
```

### J. Smart Object Interaction Points Summary (total: 33 IPs across 14 objects)

```
desk-cluster-left:  5 IPs (work)
desk-cluster-right: 5 IPs (work)
coffee-counter:     2 IPs (coffee)
couch:              3 IPs (relax, chat)
lounge-table:       2 IPs (chat)
meeting-table:      6 IPs (collaborate, present)
whiteboard:         2 IPs (present, observe)
patio-seating-left: 2 IPs (relax, chat)
patio-seating-right:2 IPs (relax, chat)
lounge-rug:         3 IPs (chat, relax)
lounge-bookshelf:   2 IPs (browse)
meeting-tv:         2 IPs (observe)
bookshelf:          2 IPs (browse)
corridor-plant:     2 IPs (relax, chat)
Total: 42 IPs (some IPs shared across maxOccupants)
```

### K. Room Zone Bounds Reference

```typescript
pantry:           x:5,  y:2,  w:7,  h:5   (overlaps patio — wins on first-match)
patio:            x:0,  y:0,  w:12, h:8
lounge:           x:14, y:0,  w:13, h:8
utility_corridor: x:0,  y:8,  w:6,  h:5
stairs_transition:x:6,  y:8,  w:9,  h:5
workspace:        x:0,  y:13, w:15, h:9
meeting_room:     x:15, y:12, w:12, h:9
```

---

_End of Phase 0a Audit Report. This document is the source of truth for Phase 0b (modularize) and the 4 parallel Phase 1 revamp lanes._
