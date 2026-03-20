# Agent Office — Magical Experience Redesign

**Date:** 2026-03-20
**Status:** Draft
**Scope:** `src/dashboard/pages/office/` module + supporting server components

---

## 1. Problem

The Agent Office page has strong foundations (pixel-art canvas, 9 agents, task kanban, comms, timeline) but doesn't feel magical. Agent state updates lag 2s behind reality, specialists never get summoned, tasks don't bind to agents on canvas, and proactive insights aren't surfaced. Users see a cool pixel office but don't feel like their agents are alive and working for them.

## 2. Goal

Make the Office page the most compelling screen in Agentin — a place users leave open all day. Combine three experience pillars:

1. **Living World** — Agents have personalities, chat with each other, react to user actions, celebrate completions
2. **Mission Control** — Real work visible in real-time with zero perceptible lag
3. **Discovery** — Agents proactively surface insights the user didn't ask for

**North star:** "A first-time user opens the Office, sends a Telegram message, and watches Jarvis light up, call a tool, beam results to Nova, and deliver the answer — then sees a toast saying 'Your expenses are up 40% this week' from Pulse. They tell a friend."

## 3. Layout

### Desktop (>768px)

```
┌──────────────────────────────┬────────────────────┐
│                              │  [Timeline] Tasks   │
│     Pixel Office Stage       │      Metrics        │
│         (60% width)          │                     │
│                              │  ┌───────────────┐  │
│  ┌─────────────────────┐     │  │ 💡 Insight     │  │
│  │ 💡 Toast banner     │     │  │ from Nova      │  │
│  └─────────────────────┘     │  │ Expenses +40%  │  │
│                              │  └───────────────┘  │
│   ✨Weebo  ⚡Edith  🎩Jarvis │  ┌───────────────┐  │
│                              │  │ 🎩 Jarvis      │  │
│   🎨Aria   🔧Forge          │  │ replied        │  │
│                              │  │ "Here are..."  │  │
│   📊Pulse 💙Echo 📅Cal 🔭Nova│  └───────────────┘  │
│                              │  ┌───────────────┐  │
│                              │  │ ⏰ Reminder    │  │
│                              │  │ [Done][Snooze] │  │
│                              │  └───────────────┘  │
│                              │                     │
│                              │  ┌─────────────┐   │
│                              │  │ Ask agent... │   │
│                              │  └─────────────┘   │
└──────────────────────────────┴────────────────────┘
```

- **Office Stage (60%):** Pixel-art canvas with 9 agent desks, behavior-driven wandering, state indicators, speech bubbles, particle beams, toast banners
- **Smart Sidebar (40%):** Tabbed panel (Timeline / Tasks / Metrics) with quick-action chat input at bottom
- No draggable divider — fixed 60/40 split (replaces existing vertical split + `DraggableDivider.tsx`, which will be deleted)

### Mobile (<768px)

- Canvas: 35% height, simplified (no pathfinding, agents at fixed desk positions, state indicators only)
- Sidebar: Bottom sheet (65% height), swipe-up to fullscreen, same 3 tabs
- Toasts: Compact banners at top of canvas, tap to expand in bottom sheet
- Chat input: Pinned above mobile bottom nav

## 4. Animation Tiers

The system selects animation tier based on task complexity. This prevents simple messages from being overdramatic and complex tasks from being underwhelming.

### Tier 1: Ambient

**Trigger:** Single-agent response, <5s, no tool calls

- Active agent gets subtle cyan glow outline
- Floating status text above head: "thinking...", "writing..."
- Speech bubble with personality-flavored text (from persona-engine templates)
- No camera movement, no dimming of other agents
- When done: brief green checkmark flash, then back to idle

### Tier 2: Chain Reaction

**Trigger:** Multi-agent orchestrator dispatch, OR 2+ tool calls in a single response

- Lead agent lights up first (stronger glow than Tier 1)
- Particle beams fire from lead to each collaborating agent (2px colored lines, 1.5s lifespan)
- Each receiving agent activates with their color glow in sequence (200ms stagger)
- Tool icons float above agents when executing (wrench, magnifying glass, code brackets)
- Speech bubbles show delegation: "Hey Nova, can you research this?"
- When done: all participating agents flash green simultaneously

### Tier 3: Cinematic

**Trigger:** First visit to Office page, OR premium agent deploy, OR task running >10s

- Smooth camera zoom (CSS transform scale + translate, 800ms ease-out) to lead agent
- Spotlight: radial gradient glow around lead agent, other agents fade to 40% opacity
- Status HUD appears next to spotlight: agent name, state, tool being used, iteration count
- When done: 500ms hold, then smooth pull-back to full view, all agents restore opacity
- On first visit: cinematic sweep across all 9 desks with agent name cards (onboarding tour)

### Tier Selection Logic

```typescript
function selectAnimationTier(ctx: {
  isFirstVisit: boolean;      // localStorage key 'office_visited'
  isMultiAgent: boolean;      // from SSE event metadata
  toolCallCount: number;      // accumulated per-request via requestId grouping
  thinkingStartTime: number;  // client-side timer, set when 'thinking' event arrives
}): 1 | 2 | 3 {
  if (ctx.isFirstVisit) return 3;
  if (ctx.isMultiAgent || ctx.toolCallCount >= 2) return 2;
  if (ctx.thinkingStartTime > 0 && Date.now() - ctx.thinkingStartTime > 10_000) return 3;
  return 1;
}
```

- `isFirstVisit`: Checked via `localStorage.getItem('office_visited')`. Set to `'true'` after first cinematic completes.
- `toolCallCount`: Accumulated client-side by grouping SSE events with the same `requestId` field (new field, added to ActivityEvent). Each `tool_call` event increments the counter. Resets on `done`.
- `thinkingStartTime`: Client-side `Date.now()` captured when `thinking` event arrives for an agent. Cleared on `done`.

## 5. Smart Sidebar

### 5.1 Timeline Tab (Default)

Unified, chronological feed of all agent activity. Each entry is a rich card colored by type:

| Card Type | Border Color | Icon | Content | Actions |
|-----------|-------------|------|---------|---------|
| Agent reply | Agent's color | Agent emoji | Response preview (80 chars) | Click to expand |
| Tool call | Cyan `#00F0FF` | 🔧 | Tool name + params summary | — |
| Insight | Amber `#F59E0B` | 💡 | Insight text + source agent | Dismiss, Action |
| Reminder | Purple `#8B5CF6` | ⏰ | Reminder text + due time | Done, Snooze |
| Automation | Pink `#EC4899` | ⚡ | Automation name + result | — |
| Multi-agent | Cyan `#00F0FF` | 🌐 | Task description + agent avatars | Expand details |
| Habit | Green `#ADFF2F` | 🔥 | Habit name + streak count | Log, Skip |
| Comm / delegation | Agent's color | 💬 | From → To: message text | — |

- Max 50 items in memory, paginated scroll
- New items animate in from top (slide + fade, 300ms)
- Clicking a card that has an associated agent highlights that agent on canvas

### 5.2 Tasks Tab

Existing Kanban board (Pending → Running → Completed). Enhancements:

- When a task moves to "Running", the assigned agent on canvas walks to their desk and starts working animation
- Completed tasks show a mini celebration (confetti particle on the agent)
- Create task form at bottom with agent picker dropdown

### 5.3 Metrics Tab

Live counters and charts:

- 4 stat cards: Tasks today, Messages sent, Tools used, Credits used
- Agent activity sparklines (mini bar chart per agent, last 24h)
- Provider usage pie chart (Ollama / Groq / OpenRouter / Kimi)
- Who-talks-to-whom heatmap (from comms data)

## 6. Proactive Insights

### 6.1 Toast Banners (Canvas)

- Position: Top-center of canvas, 80% width, floating above all other elements
- Style: Glassmorphism (backdrop-filter: blur(12px)), amber border, agent emoji + text
- Duration: 8 seconds, then fade out (500ms)
- Dismissible: ✕ button on right
- Click: Scrolls sidebar to the corresponding insight card
- Queue: Max 1 toast at a time. If another fires while one is showing, queue it (3s gap between)
- Agent reaction: The generating agent does a wave animation on canvas when toast appears

### 6.2 Timeline Insight Cards

- Visual: Gold/amber border with lightbulb icon, distinct from regular timeline cards
- Persist: Never auto-dismiss — stay in timeline until user scrolls past
- Source: Powered by `proactive-engine.ts` events (morning brief, expense spikes, habit nudges, streak celebrations)
- Actions: Contextual buttons (e.g., "View expenses", "Log habit", "See brief")

### 6.3 Insight Sources

| Source | Agent | Example |
|--------|-------|---------|
| Expense spike | Pulse | "Swiggy spending 2x this week" |
| Habit nudge | Echo | "You haven't logged 'Exercise' in 3 days" |
| Streak celebration | Echo | "7-day meditation streak! Keep going!" |
| Calendar preview | Cal | "3 meetings tomorrow, first at 9am" |
| Research find | Nova | "Found article matching your interests" |
| Morning brief | Weebo | "Good morning! 4 reminders, 2 habits due" |

## 7. Real-Time Data Pipeline

### Current Problem

The Office page polls `/api/office/state` every 2 seconds. Agent state changes (thinking → tool_call → done) that happen within a 2s window are missed or arrive late, making animations feel choppy.

### Solution

Dual-channel approach:

1. **SSE stream (`/api/agent-state/stream`)** — Exists server-side but the current Office page does NOT connect to it (uses polling instead). This redesign connects to it for real-time canvas animations.
2. **Polling (`/api/office/state`)** — Keep at 3s interval (reduced from 2s since SSE handles time-critical updates). Provides sidebar data (timeline, tasks, metrics, comms).

The SSE stream provides sub-100ms state updates for canvas animations. The polling provides rich contextual data for sidebar cards. Both feed into a unified React state via `useOfficeData()` hook (replaces existing `useOfficeSSE.ts`).

**SSE failure degradation:** If the SSE connection fails or returns 401, fall back to 2s polling for canvas state as well (same as current behavior). Show a "POLLING" badge instead of "LIVE". Retry SSE connection every 15s.

**Note:** `getAllAgentStates()` in `activity-stream.ts` currently only tracks 3 core agents (weebo, edith, jarvis). This must be extended to all 9 agent IDs so specialists emit state events too.

### Event Flow

```
Telegram message arrives
  → message-router.ts processes
    → emitThinking(userId, 'jarvis')     ← SSE instant
    → emitToolCall(userId, 'jarvis', 'web_search')  ← SSE instant
    → emitResponding(userId, 'jarvis')   ← SSE instant
    → emitDone(userId, 'jarvis')         ← SSE instant
    → logActivity(userId, 'Jarvis replied', ...)  ← Poll picks up in ≤5s
```

## 8. Canvas Enhancements

### Agent Click Interaction

- **Single click:** Spotlight HUD appears (name, state, task count, last action)
- **Double click:** Sidebar switches to that agent's detail view (filtered timeline)
- **Click away:** Dismiss spotlight

### Speech Bubbles

- Follow agent position (update position each frame)
- Max 3 simultaneous bubbles
- Personality-flavored text from `persona-engine.ts` templates
- 4-second TTL, fade out over 500ms

### Visual Polish

- Desk monitors show a tiny colored "screen glow" matching agent state
- Coffee machine area: agents occasionally walk there during idle (existing behavior, keep)
- Server rack in corner: blinks when tool calls are executing
- Ambient particles: very subtle floating dots (1px, 5% opacity) for atmosphere

## 9. Files Changed

### New Files
- `src/dashboard/pages/office/useOfficeData.ts` — Unified hook merging SSE + polling (replaces `useOfficeSSE.ts`)
- `src/dashboard/pages/office/AnimationTierSelector.ts` — Tier selection logic
- `src/dashboard/pages/office/SmartSidebar.tsx` — Sidebar container with 3 tabs (replaces `ControlRoom.tsx`)
- `src/dashboard/pages/office/TimelineCard.tsx` — Rich timeline card component
- `src/dashboard/pages/office/InsightToast.tsx` — Toast banner component
- `src/dashboard/pages/office/CanvasEffects.ts` — Cinematic zoom, spotlight, particle upgrades

### Modified Files
- `src/dashboard/pages/office/OfficePage.tsx` — New layout (60/40 horizontal), integrate SmartSidebar + enhanced canvas
- `src/dashboard/pages/office/OfficeStage.tsx` — Cinematic zoom, spotlight dimming, tool icons, ambient particles
- `src/dashboard/pages/office/OfficeCanvasRenderer.ts` — Desk monitor glow, server rack blinks, ambient particles
- `src/dashboard/pages/office/agentBehavior.ts` — New behavior triggers for animation tier state
- `src/dashboard/pages/office/types.ts` — Add `requestId`, `toolCallCount`, `isMultiAgent` to event types
- `server/src/services/activity-stream.ts` — Add `requestId`, `isMultiAgent` to `ActivityEvent`; extend `getAllAgentStates()` to all 9 agents
- `server/src/routes/activity.ts` — Add insight type to activity events
- `server/src/routes/office.ts` — Expand `/api/office/state` with metrics data (credits, provider stats)

### Deleted Files
- `src/dashboard/pages/office/useOfficeSSE.ts` — Replaced by `useOfficeData.ts`
- `src/dashboard/pages/office/ControlRoom.tsx` — Replaced by `SmartSidebar.tsx`
- `src/dashboard/pages/office/DraggableDivider.tsx` — No longer needed (fixed split)
- `src/dashboard/pages/office/CommsTab.tsx` — Comms data folded into Timeline as delegation/comm cards

### Migration Notes
- The Comms tab is not dropped — inter-agent communication entries appear as "Comm / delegation" cards in the unified Timeline feed. The `commStats` data continues to be fetched but is rendered in the Metrics tab heatmap.
- `DraggableDivider.tsx` is deleted because the layout changes from vertical (top/bottom) to horizontal (left/right) with a fixed 60/40 split.
- Speech bubble personality text: comes from the SSE event `content` field (already populated by message-router with personality-flavored text). No client-side persona templates needed.

## 10. Server API Changes

### Expand `/api/office/state` response

Add to the existing response payload:

```typescript
{
  // ... existing fields (agentStates, taskBoard, taskStats, comms, commStats, timeline, recentEvents)
  metrics: {
    creditsUsedToday: number;
    messagesToday: number;
    toolCallsToday: number;
    providerBreakdown: Record<string, number>;  // { ollama: 5, groq: 12, ... }
    agentActivity24h: Record<string, number[]>; // { weebo: [0,0,1,3,...], ... } per-hour counts
  }
}
```

Source: Query `usage_events` and `conversation_log` tables with daily/hourly filters. Cache for 30s (this data is not time-critical).

### Extend `ActivityEvent` in `activity-stream.ts`

Add fields to the event interface:

```typescript
interface ActivityEvent {
  // ... existing fields
  requestId?: string;   // groups events from the same user message
  isMultiAgent?: boolean; // true when multi-agent orchestrator is active
}
```

### Extend `getAllAgentStates()` in `activity-stream.ts`

Change hardcoded `['weebo', 'edith', 'jarvis']` to all 9: `['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova']`.

## 11. Edge Cases

- **SSE failure:** Fall back to 2s polling for canvas. Show "POLLING" badge. Retry SSE every 15s.
- **401 on SSE:** Trigger existing `handleAuth401()` → re-login banner.
- **Toast queue overflow:** Max 3 queued toasts. If tab is backgrounded, flush queue on focus (discard toasts older than 60s).
- **Mobile agent movement:** On mobile, agents stay at fixed desk positions. SSE movement events are rendered as state indicator changes only (glow + status text), no pathfinding.
- **Metrics tab loading:** Show skeleton/shimmer while first poll loads. Show "No data yet" for empty charts.
- **First visit detection:** `localStorage.getItem('office_visited')`. Set after cinematic tour completes. Incognito users get the tour every time (acceptable).

## 12. Testing

- Canvas animations: Manual verification on desktop + mobile (375px)
- SSE stream: Verify sub-100ms delivery by sending Telegram message and watching canvas
- Timeline cards: Verify all 7 card types render correctly
- Toast banners: Verify 8s display, dismiss, queue behavior
- Animation tiers: Trigger each tier (simple message, multi-agent, first visit)
- Mobile: Verify bottom sheet, compact canvas, tap interactions
- 401 handling: Verify existing session-expired banner still works

## 13. Out of Scope

- Specialist agent summoning (door animations, lab integration) — separate spec
- Sound effects / audio feedback
- WebGL/3D canvas replacement
- Agent-to-agent autonomous conversations (requires LLM calls, cost implications)
- Drag-and-drop task assignment to agents on canvas
