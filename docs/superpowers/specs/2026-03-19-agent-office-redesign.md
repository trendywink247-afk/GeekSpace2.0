# Agent Office "Mission Control" Redesign — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Complete rewrite of `src/dashboard/pages/OfficePage.tsx` and supporting components

---

## 1. Overview

Redesign the Agent Office from a basic status dashboard into an immersive, real-time "Mission Control" experience with two sections:

- **The Stage** (top): A pixel art compound showing 9 agents working, delegating, and communicating with visual effects (speech bubbles, particle beams, door animations)
- **The Control Room** (bottom): A tabbed data dashboard (Tasks, Comms, Metrics, Timeline) with full interactivity

Separated by a **draggable divider** (50/50 default, min 30% each).

## 2. Architecture

### Layout Structure

```
<OfficePage>
  <Header> — title + LIVE/POLLING badge + agent count
  <StageContainer> — resizable top half
    <PixelCanvas> — 48x20 grid, 18px cells, 2D canvas
    <SpeechBubbleLayer> — DOM overlays positioned over canvas
    <MiniChatLog> — floating collapsible panel, top-right
    <SpotlightHUD> — floating action bar on agent click
  </StageContainer>
  <DraggableDivider>
  <ControlRoom> — resizable bottom half
    <TabBar> — Tasks | Comms | Metrics | Timeline
    <TabContent> — full-width content for active tab
  </ControlRoom>
  <AgentProfileFlyout> — slides from right on double-click
</OfficePage>
```

### Component Breakdown

| Component | File | Approx Lines | Purpose |
|-----------|------|-------------|---------|
| `OfficePage` | `OfficePage.tsx` | 200 | Shell: layout, divider state, tab state |
| `OfficeStage` | `OfficeStage.tsx` | 400 | Canvas rendering, agent movement, animations |
| `OfficeCanvasRenderer` | `OfficeCanvasRenderer.ts` | 300 | Pure canvas drawing (compound, agents, particles, door) |
| `SpeechBubbleLayer` | `SpeechBubbleLayer.tsx` | 80 | DOM overlays for speech bubbles |
| `MiniChatLog` | `MiniChatLog.tsx` | 80 | Floating collapsible comms overlay |
| `SpotlightHUD` | `SpotlightHUD.tsx` | 60 | Action bar shown on agent spotlight |
| `AgentProfileFlyout` | `AgentProfileFlyout.tsx` | 150 | Full agent detail panel |
| `ControlRoom` | `ControlRoom.tsx` | 100 | Tab container |
| `TasksTab` | `TasksTab.tsx` | 200 | Kanban board with drag-and-drop |
| `CommsTab` | `CommsTab.tsx` | 150 | Agent communication feed |
| `MetricsTab` | `MetricsTab.tsx` | 150 | Charts and counters |
| `TimelineTab` | `TimelineTab.tsx` | 120 | Chronological event stream |
| `DraggableDivider` | `DraggableDivider.tsx` | 40 | Resizable split handle |

**Total: ~2030 lines across 13 files** (vs current 1700 lines in 1 monolithic file)

### Data Sources (all existing, no new backend)

| Source | Endpoint | Usage |
|--------|----------|-------|
| Agent state SSE | `GET /api/agent-state/stream` | Real-time state: thinking, tool_call, delegating, comm_sent, task_started, done |
| Activity SSE | `GET /api/activity/stream` | Activity feed fallback |
| Task board | `GET /api/agent-tasks/board` | Kanban columns (30s poll) |
| Task stats | `GET /api/agent-tasks/stats` | Counter cards (30s poll) |
| Recent comms | `GET /api/agent-comms/recent` | Comms tab + mini chat log (30s poll) |
| Comm stats | `GET /api/agent-comms/stats` | Comms tab filter counts |
| Agent states | `GET /api/agent-state/states` | Initial state for all 3 core agents |
| Health | `GET /api/health` | System status cards |
| GeekOS | `GET /api/geekos/status` | GeekOS online badge |

## 3. The Stage — Pixel Art Compound

### Canvas Layout (48x20 grid at 18px = 864x360px)

```
Columns:  0         10        20        28  30  32        40        48
          ┌─── MAIN OFFICE (28 cols) ──────┐ D  ┌── SPECIALIST LAB (16 cols)──┐
Row 0-2:  │          ceiling/wall          │ O  │        ceiling/wall         │
Row 3-5:  │  [Weebo desk]  [Edith desk]   │ O  │  [Aria stn]  [Forge stn]   │
Row 6-8:  │       [Jarvis desk]           │ R  │  [Pulse stn] [Echo stn]    │
Row 9-11: │                               │    │  [Cal stn]   [Nova stn]    │
Row 12-14:│     [server rack]             │    │      [workbench]           │
Row 15-19:│          floor                │    │         floor              │
          └────────────────────────────────┘    └─────────────────────────────┘
```

### Agent Sprites (per agent)

- **Head**: 6x6px colored block with 2 dark eye pixels
- **Body**: 8x5px in agent's primary color
- **Legs**: 2x3px, alternate position each tick for walking animation
- **State indicator above head** (3x3px area):
  - Idle: small bobble animation
  - Thinking: animated `?` (3 frames)
  - Typing/Responding: animated dots `... → .. → .`
  - Tool_call: pixel wrench
  - Tool_result: pixel gear/checkmark
  - Delegating: pixel arrow pointing right
  - Done: pixel checkmark (green)

### Specialist States

| State | Visual |
|-------|--------|
| **Dormant** | Greyed out sprite (30% opacity), dim station, subtle idle bob |
| **Summoned** | Station lights up with agent color glow (2px ring), agent stands alert |
| **Walking to office** | Door opens, specialist walks through via BFS, door closes behind |
| **Working** | Stands beside core agent's desk, tool animation, particle beam active |
| **Returning** | Walks back through door to lab station |
| **Fading** | Returns to dormant (0.5s opacity transition) |

### Door Animation (6 frames, 200ms each = 1.2s total)

1. Door closed, neutral LED (grey pixel)
2. LED turns green, door top pixel starts shifting
3. Door half-open (2px gap)
4. Door fully open (4px gap, specialist walks through)
5. Door begins closing
6. Door closed, LED returns to grey

### Particle Beams (same canvas, same render loop)

- Triggered by: `comm_sent`, `delegation`, `tool_call` SSE events between 2 agents
- Rendering: 8-12 small rectangles (2x2px) traveling along a line from source agent to target agent
- Color: sending agent's personality color
- Travel speed: full traverse in ~0.8 seconds
- Lifespan: 2 seconds after trigger, then fade
- Performance: adds ~1ms per active beam per frame

### Speech Bubbles (DOM overlay, not canvas)

- Positioned via `position: absolute` relative to the canvas container
- Coordinates calculated from agent's canvas grid position * cell size
- Style: `bg-[agentColor]/10 border border-[agentColor]/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs`
- Max 60 characters, truncated with `...`
- Animation: `scale(0.8) opacity(0)` → `scale(1) opacity(1)` over 150ms (CSS transition)
- Auto-dismiss: fade out after 4 seconds
- Max 3 visible simultaneously (oldest removed first)
- Vertical stagger: offset -32px per bubble to prevent overlap

### Mini Chat Log (floating DOM panel, top-right of stage)

- `w-56 max-h-48 overflow-y-auto`
- Style: `bg-black/50 backdrop-blur-xl rounded-xl border border-white/5`
- Shows last 10 inter-agent messages
- Each entry: timestamp + colored `from → to` + message text (truncated)
- Collapsible: click header toggles between full view and badge-only (shows unread count)
- Auto-scrolls on new messages

## 4. Agent Interaction

### Single Click → Spotlight Mode

- Canvas container applies CSS transform: `transform: scale(1.5); transform-origin: [agent center]`
- Transition: 300ms ease-out
- Canvas overlay dims non-spotlighted area to 40% opacity
- Spotlighted agent gets pulsing glow ring (agent color, 2s cycle)
- **SpotlightHUD** appears below the agent (glassmorphism card):
  ```
  [emoji] AgentName  •  [State]  •  [N] tasks
  [Chat]  [Assign Task]  [View History]
  ```
- Style: `bg-black/60 backdrop-blur-xl border border-[agentColor]/20 rounded-xl`
- Dismiss: click elsewhere or press Escape → zoom out with 300ms transition

### Double Click → AgentProfileFlyout

- Panel slides from right edge (360px wide, full viewport height)
- Style: `bg-[#0C0C18] border-l border-[agentColor]/20`
- Sections:
  1. **Header**: emoji + name + description + live state dot
  2. **Current Task**: title + priority + status + elapsed time
  3. **Today's Stats**: tasks done, tools used, messages sent, credits consumed
  4. **Specialists**: list of this agent's 2 specialists with live status (dormant/active)
  5. **Recent Activity**: last 10 events for this agent
  6. **Actions**: "Chat with [Agent]" button (navigates to `/dashboard/chat?agent=[id]`), "Assign New Task" button (inline form)
- Close: X button or click outside

### Specialist-to-Core Mapping

| Core Agent | Specialist 1 | Specialist 2 |
|-----------|-------------|-------------|
| Weebo | Aria (Creative) | Echo (Coach) |
| Edith | Forge (Builder) | Pulse (Analyst) |
| Jarvis | Cal (Organizer) | Nova (Explorer) |

## 5. The Control Room — 4 Tabs

### Tab Bar

- Full-width, below the divider
- Icons + labels: `📋 Tasks` | `💬 Comms` | `📊 Metrics` | `⏱ Timeline`
- Active: `border-b-2 border-[#00F0FF] text-[#00F0FF]`
- Live count badges on each tab (e.g., `3` pending tasks, `2` new comms)
- Style: `bg-[#0C0C18] border-b border-[#00F0FF]/10`

### Tab 1: Tasks (Kanban)

- 3-column drag-and-drop: **Pending** | **Running** | **Completed**
- Task cards:
  - Agent emoji + title + priority badge
  - Running: elapsed time + progress bar (estimated)
  - Color-coded left border by agent
  - Click to expand: description, result, reassign dropdown
  - Drag between columns to change status (calls PATCH /api/agent-tasks/:id)
- Create form at bottom: agent dropdown + title input + priority select + create button
- Empty state per column: muted text "No [status] tasks"

### Tab 2: Comms (Agent Chat Feed)

- Filter bar: agent buttons (Weebo/Edith/Jarvis/All) + type filter (Info/Delegation/Alert/All)
- Message entries:
  - Agent emoji + name (colored) + `→` + target emoji + name (colored)
  - Message text
  - Type badge + timestamp
  - Delegation messages: highlighted border `border-l-2 border-[#FFB800]`
- Real-time: new messages animate in with slide + fade (framer-motion)
- Click message: shows related task if `related_task_id` exists

### Tab 3: Metrics

- **4 counter cards** (top row): Tasks Today, Messages Sent, Tools Used, Credits Used
  - Animated count-up on tab activation
  - Agent color accents
- **Tasks by Agent** (horizontal bar chart): Weebo / Edith / Jarvis with colored bars
- **Tool Usage** (horizontal bar chart): top 8 tools by usage count
- **Agent Activity** (line chart): messages per hour over last 24h, one line per agent, colored
  - Uses recharts (already in bundle)
- Data: from `/api/agent-tasks/stats`, `/api/agent-comms/stats`, `/api/usage/summary`

### Tab 4: Timeline (Event Stream)

- Chronological list of ALL SSE events
- Each entry: `timestamp | agent_dot | agent_name | event_type_badge | content`
- Event type badges with colors:
  - `thinking` → blue pulse
  - `tool_call` → orange
  - `tool_result` → green
  - `delegating` → gold with arrow
  - `comm_sent` → purple with `→ target`
  - `task_started` → cyan
  - `task_completed` → green check
  - `done` → dim
- Minute separators: `─── 11:34 ───`
- Auto-scroll with pause-on-hover
- Filter by agent or event type

## 6. Draggable Divider

- Horizontal bar between Stage and Control Room
- `h-2 cursor-row-resize bg-[#00F0FF]/5 hover:bg-[#00F0FF]/15 transition-colors`
- Center grab indicator: `w-12 h-1 rounded-full bg-[#00F0FF]/20`
- Drag behavior:
  - `onPointerDown` → start tracking
  - `onPointerMove` → update split percentage
  - `onPointerUp` → stop tracking
  - Min 30% for each section
  - Stores preference in `localStorage('office-split')`

## 7. Visual Style

**Hybrid approach**: Pixel art for agents/compound on canvas, modern glassmorphism for all UI overlays and control room.

- **Canvas**: `bg-[#05050A]` with cyan grid lines at 4% opacity
- **Panels**: `bg-[#0C0C18] border border-[#00F0FF]/10` or `bg-black/50 backdrop-blur-xl`
- **Agent colors**: Weebo=#00F0FF, Edith=#8B5CF6, Jarvis=#ADFF2F, Aria=#FF6B9D, Forge=#F59E0B, Pulse=#10B981, Echo=#6366F1, Cal=#84CC16, Nova=#EC4899
- **Accent**: `#00F0FF` (cyan) for active states, borders, highlights
- **Text**: `#F4F6FF` primary, `#8892A4` secondary, `#4B5563` muted
- **Animations**: framer-motion for DOM elements, requestAnimationFrame for canvas

## 8. Performance Budget

| Element | Memory | Frame Cost | Notes |
|---------|--------|-----------|-------|
| Pixel canvas (48x20) | ~2MB | 5ms/frame | fillRect only, no images |
| Particle beams (max 3) | <1MB | 1ms/beam | Same canvas context |
| Speech bubbles (max 3) | <1MB | 0ms (CSS) | GPU-accelerated transitions |
| Mini chat log | <1MB | 0ms (CSS) | overflow-y scroll |
| Control room tabs | ~5MB | 0ms (inactive hidden) | Only active tab renders |
| Recharts (metrics) | Shared chunk | Lazy on tab click | Already in bundle |
| **Total added** | **~10MB** | **<10ms/frame** | Well within 1GB container |

Canvas tick rate: 200ms (5fps) — same as current. No 60fps needed for pixel art.

## 9. Mobile Behavior

- Stage: shrinks to 40% viewport height, no zoom/spotlight (tap opens flyout directly)
- Control room: 60% with full tab functionality
- Divider: hidden on mobile (fixed split)
- Mini chat log: hidden on mobile (comms tab serves same purpose)
- Speech bubbles: reduced to max 1 at a time
- `pb-24` for bottom nav clearance

## 10. Migration from Current OfficePage

The current `OfficePage.tsx` (1700 lines, monolithic) will be replaced entirely. Key data flows to preserve:

- SSE connection to `/api/agent-state/stream` (keep token auth via query param)
- SSE connection to `/api/activity/stream` (fallback to polling)
- 30s polling for tasks/comms/health
- Session expired (401) detection → re-login banner
- Agent selection state
- Feed auto-scroll behavior

New file structure in `src/dashboard/pages/office/`:
```
office/
  OfficePage.tsx          — Shell, layout, state management
  OfficeStage.tsx         — Canvas + overlays container
  OfficeCanvasRenderer.ts — Pure canvas drawing functions
  SpeechBubbleLayer.tsx   — Speech bubble DOM overlays
  MiniChatLog.tsx         — Floating chat overlay
  SpotlightHUD.tsx        — Agent action bar on click
  AgentProfileFlyout.tsx  — Full agent detail panel
  ControlRoom.tsx         — Tab container
  TasksTab.tsx            — Kanban board
  CommsTab.tsx            — Agent communications feed
  MetricsTab.tsx          — Charts and counters
  TimelineTab.tsx         — Event stream
  DraggableDivider.tsx    — Resizable split handle
  types.ts                — Shared types for office components
  constants.ts            — Agent metadata, colors, grid positions
```

## 11. Success Criteria

- [ ] All 9 agents visible (3 at desks, 6 in lab)
- [ ] Specialist door animation plays on delegation SSE events
- [ ] Particle beams render between communicating agents
- [ ] Speech bubbles show inter-agent messages
- [ ] Spotlight zoom works on single click
- [ ] Profile flyout works on double click with "Chat with Agent" navigation
- [ ] Kanban drag-and-drop changes task status via API
- [ ] Comms tab shows real-time agent messages with filters
- [ ] Metrics tab shows charts with real data
- [ ] Timeline shows every SSE event chronologically
- [ ] Draggable divider persists preference
- [ ] No frame drops below 5fps on canvas
- [ ] Total added memory < 15MB
- [ ] Mobile responsive with fixed split
- [ ] Existing SSE connections preserved

## 12. Review Fixes (Post-Review Amendments)

### C1: SSE Transport
Use `fetch()` + `ReadableStream` (not native `EventSource`) for SSE connections. This matches the current implementation, allows `Authorization: Bearer` header auth, and supports `AbortController` cleanup. Shared via a `useOfficeSSE` custom hook that provides parsed events to both Stage and ControlRoom.

### C2: All 13 State Types Handled
Canvas sprite indicators for ALL states:

| State | Sprite Indicator |
|-------|-----------------|
| `idle` | Small bob animation |
| `thinking` | Animated `?` bubble (3 frames) |
| `typing` | Animated dots `...` |
| `tool_call` | Pixel wrench icon |
| `tool_result` | Pixel gear/checkmark |
| `responding` | Animated dots (faster) |
| `done` | Green checkmark (3s then → idle) |
| `delegating` | Pixel arrow pointing right + flash |
| `comm_sent` | Small envelope icon flying toward target |
| `comm_received` | Small envelope icon arriving |
| `task_started` | Rocket icon (2 frames) |
| `task_completed` | Star burst (3 frames) |
| `task_failed` | Red X icon |

Timeline tab event type badges updated to include all 13 types.

### C3: Particle Beam Trigger Correction
Particle beams ONLY fire for events with a `targetAgent` field:
- `delegating` (source → target agent)
- `comm_sent` (from_agent → to_agent)
- `comm_received` (from_agent → to_agent)

`tool_call` events do NOT trigger particle beams (no target agent). Tool calls show only the wrench sprite indicator above the agent's head.

### C4: Grid Math Fix
Corrected grid: **46 columns x 20 rows** (not 48):
- Main Office: columns 0-27 (28 cols)
- Door: columns 28-29 (2 cols)
- Specialist Lab: columns 30-45 (16 cols)
- Total: 28 + 2 + 16 = 46 columns
- Canvas size: 46 * 18 = 828px wide, 20 * 18 = 360px tall

### I1: Frontend API Method
Add `usageService.summary()` call to `src/services/api.ts` (already exists as `usageService` — just reference it in Metrics tab). No new method needed.

### I2: Kanban Drag Action Mapping
| Drag Direction | API Action |
|---------------|------------|
| Pending → Running | `action: 'start'` |
| Running → Completed | `action: 'complete'` |
| Running → Pending | `action: 'cancel'` then recreate |
| Completed → * | **Not allowed** (completed tasks are final) |
| Pending → Completed | **Not allowed** (must go through Running) |

Invalid drags show a brief shake animation and snap back.

### I3: Spotlight Frame Rate
During Spotlight mode, the CSS `transform: scale(1.5)` on the canvas CONTAINER (not the canvas itself) handles the zoom. The canvas continues at 5fps inside. The pulsing glow ring is rendered as a CSS `box-shadow` animation on a DOM overlay (not on canvas), so it runs at 60fps via GPU. No frame rate bump needed.

### I4: Pointer Capture for Divider
`onPointerDown` calls `element.setPointerCapture(e.pointerId)`. `onPointerUp` calls `element.releasePointerCapture(e.pointerId)`.

### I5: SSE Reconnection Behavior
- On disconnect: show amber "Reconnecting..." badge in header (replace green "LIVE")
- Retry delay: 5 seconds (first attempt), then exponential backoff (5s, 10s, 20s, max 60s)
- Max retries: 10, then switch to polling fallback (10s interval)
- During disconnection: agents freeze in last known state (no reset to idle)
- On reconnect: fetch `/api/agent-state/states` to resync all agent states
- `connectionMode` state: `'live'` | `'reconnecting'` | `'polling'`

### I6: Click vs Double-Click Handling
Use a 250ms timer on single click:
- `onClick` → set 250ms timeout for spotlight
- `onDoubleClick` → clear the timeout, open flyout directly
- This prevents spotlight from firing on double-click

### I7: Comm Stats Fetch Timing
`/api/agent-comms/stats` fetched on Comms tab activation (not on mount), then refreshed every 30s while tab is active. Inactive tabs do not poll.

### S1: Shared useOfficeSSE Hook
Added `useOfficeSSE.ts` to the file list — a custom hook providing parsed SSE events via React context to both Stage and ControlRoom children.

### S3: Mini Chat Log Real-Time
Mini chat log is populated from BOTH:
1. `comm_sent`/`comm_received` SSE events (real-time, immediate)
2. `GET /api/agent-comms/recent` poll (history backfill on mount)

### S4: Constants File
`constants.ts` includes: agent colors, grid positions, specialist-to-core mapping, state-to-sprite mapping, all 9 personality metadata objects.

### S5: Canvas DPR Memory
Revised estimate: canvas at DPR=2 uses ~5MB framebuffer. Total memory budget revised to <20MB (still well within 1GB container).

### S6: DashboardApp Import
Migration requires updating `DashboardApp.tsx`:
```typescript
// Old:
const OfficePage = lazyRetry(() => import('./pages/OfficePage').then(...))
// New:
const OfficePage = lazyRetry(() => import('./pages/office/OfficePage').then(...))
```

### S7: pb-24 in Shell
`OfficePage.tsx` shell includes `pb-24 md:pb-0` at root level for mobile bottom nav clearance.
