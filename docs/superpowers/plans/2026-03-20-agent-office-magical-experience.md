# Agent Office — Magical Experience Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Agent Office page into a magical real-time experience with contextual animations, a smart sidebar timeline, and proactive insight toasts.

**Architecture:** Dual-channel data (SSE for canvas animations + 3s polling for sidebar), contextual animation tiers (ambient/chain/cinematic), unified timeline replacing 4-tab ControlRoom, insight toasts floating over canvas.

**Tech Stack:** React 19, TypeScript, Canvas 2D, SSE (fetch-based), Zustand-style local state, existing Express + activity-stream.ts backend.

**Spec:** `docs/superpowers/specs/2026-03-20-agent-office-magical-experience-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/dashboard/pages/office/useOfficeData.ts` | Unified data hook: SSE stream for canvas + polling for sidebar |
| `src/dashboard/pages/office/SmartSidebar.tsx` | Sidebar shell with 3 tabs (Timeline/Tasks/Metrics) + chat input |
| `src/dashboard/pages/office/TimelineCard.tsx` | Rich card component for 8 timeline entry types |
| `src/dashboard/pages/office/InsightToast.tsx` | Floating toast banner component for proactive insights |
| `src/dashboard/pages/office/AnimationTierSelector.ts` | Pure function: event context → tier 1/2/3 |
| `src/dashboard/pages/office/CanvasEffects.ts` | Cinematic zoom, spotlight dim, ambient particles |

### Modified Files
| File | Changes |
|------|---------|
| `src/dashboard/pages/office/OfficePage.tsx` | Horizontal 60/40 layout, integrate SmartSidebar |
| `src/dashboard/pages/office/OfficeStage.tsx` | Wire animation tiers, canvas effects, tool icons |
| `src/dashboard/pages/office/types.ts` | Add `requestId`, `isMultiAgent`, `InsightCard`, `TimelineEntry` types |
| `src/dashboard/pages/office/constants.ts` | Add animation timing constants |
| `server/src/services/activity-stream.ts` | Extend to 9 agents, add `requestId`/`isMultiAgent` fields |
| `server/src/routes/office.ts` | Add `metrics` to response (credits, provider stats, hourly activity) |

### Deleted Files
| File | Reason |
|------|--------|
| `src/dashboard/pages/office/useOfficeSSE.ts` | Replaced by `useOfficeData.ts` |
| `src/dashboard/pages/office/ControlRoom.tsx` | Replaced by `SmartSidebar.tsx` |
| `src/dashboard/pages/office/DraggableDivider.tsx` | Fixed 60/40 split, no longer needed |
| `src/dashboard/pages/office/CommsTab.tsx` | Folded into Timeline as delegation cards |

---

## Chunk 1: Server-Side Foundation

### Task 1: Extend activity-stream.ts to track all 9 agents

**Files:**
- Modify: `server/src/services/activity-stream.ts` (line ~124, `getAllAgentStates`)
- Test: `server/src/test/services/activity-stream.test.ts`

- [ ] **Step 1: Write failing test for 9-agent state tracking**

```typescript
// In activity-stream.test.ts, add:
it('getAllAgentStates returns all 9 agent states', () => {
  const userId = 'test-9-agents';
  emit({ userId, agentId: 'weebo', type: 'idle', channel: 'web', summary: 'idle' });
  emit({ userId, agentId: 'aria', type: 'thinking', channel: 'web', summary: 'thinking' });
  emit({ userId, agentId: 'nova', type: 'tool_call', channel: 'web', summary: 'searching' });

  const states = getAllAgentStates(userId);
  const ids = states.map(s => s.agentId);
  expect(ids).toContain('weebo');
  expect(ids).toContain('aria');
  expect(ids).toContain('nova');
  expect(states.length).toBe(9); // all 9, with defaults for those not yet emitted
});
```

- [ ] **Step 2: Run test — expect FAIL** (currently only returns 3 agents)

Run: `cd server && npx vitest run src/test/services/activity-stream.test.ts -t "9 agent"`

- [ ] **Step 3: Fix getAllAgentStates to include all 9 agents**

In `server/src/services/activity-stream.ts`, find the `getAllAgentStates` function. Change the hardcoded agent list:

```typescript
// Before:
const agents = ['weebo', 'edith', 'jarvis'];

// After:
const agents = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd server && npx vitest run src/test/services/activity-stream.test.ts -t "9 agent"`

- [ ] **Step 5: Commit**

```bash
git add server/src/services/activity-stream.ts server/src/test/services/activity-stream.test.ts
git commit -m "feat(office): track all 9 agents in activity-stream"
```

---

### Task 2: Add requestId and isMultiAgent to ActivityEvent

**Files:**
- Modify: `server/src/services/activity-stream.ts` (ActivityEvent interface + EmitInput)
- Test: `server/src/test/services/activity-stream.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
it('emit propagates requestId and isMultiAgent', () => {
  const event = emit({
    userId: 'test-req-id',
    agentId: 'jarvis',
    type: 'thinking',
    channel: 'web',
    summary: 'Processing...',
    requestId: 'req-abc-123',
    isMultiAgent: true,
  });
  expect(event.requestId).toBe('req-abc-123');
  expect(event.isMultiAgent).toBe(true);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd server && npx vitest run src/test/services/activity-stream.test.ts -t "requestId"`

- [ ] **Step 3: Add fields to interfaces and buildEvent**

In `activity-stream.ts`:

Add to `EmitInput` interface:
```typescript
requestId?: string;
isMultiAgent?: boolean;
```

Add to `ActivityEvent` interface:
```typescript
requestId?: string;
isMultiAgent?: boolean;
```

In `buildEvent()`, add to the return object:
```typescript
requestId: input.requestId,
isMultiAgent: input.isMultiAgent,
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/src/services/activity-stream.ts server/src/test/services/activity-stream.test.ts
git commit -m "feat(office): add requestId and isMultiAgent to ActivityEvent"
```

---

### Task 3: Expand /api/office/state with metrics data

**Files:**
- Modify: `server/src/routes/office.ts`
- Test: `server/src/test/services/activity-stream.test.ts` (or inline verification)

- [ ] **Step 1: Read current office.ts handler**

Read `server/src/routes/office.ts` fully to understand the current aggregation logic.

- [ ] **Step 2: Add metrics aggregation**

Add to the response object in the GET handler:

```typescript
// After existing aggregations, add:
const metricsData = (() => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const creditsUsed = db.prepare(
      `SELECT COALESCE(SUM(credits_used), 0) as total FROM usage_events WHERE user_id = ? AND created_at LIKE ?`
    ).get(userId, `${today}%`) as { total: number };
    const messagesToday = db.prepare(
      `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user' AND created_at LIKE ?`
    ).get(userId, `${today}%`) as { c: number };
    const providerBreakdown = db.prepare(
      `SELECT provider, COUNT(*) as c FROM usage_events WHERE user_id = ? AND created_at LIKE ? GROUP BY provider`
    ).all(userId, `${today}%`) as Array<{ provider: string; c: number }>;

    return {
      creditsUsedToday: creditsUsed.total,
      messagesToday: messagesToday.c,
      toolCallsToday: taskStats.completedToday ?? 0,
      providerBreakdown: Object.fromEntries(providerBreakdown.map(r => [r.provider, r.c])),
    };
  } catch {
    return { creditsUsedToday: 0, messagesToday: 0, toolCallsToday: 0, providerBreakdown: {} };
  }
})();
```

Add `metrics: metricsData` to the response JSON.

- [ ] **Step 3: Verify with curl**

```bash
curl -s localhost:3001/api/office/state -H "Authorization: Bearer $(node -e "const {signToken} = require('./server/dist/middleware/auth.js'); console.log(signToken('6813ac58-98fc-438b-88bb-4a8ef96fda53'))")" | python3 -c "import sys,json; d=json.load(sys.stdin); print('metrics:', d.get('metrics', 'MISSING'))"
```

- [ ] **Step 4: Run full test suite to ensure no regressions**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/office.ts
git commit -m "feat(office): add metrics to /api/office/state response"
```

---

## Chunk 2: Frontend Data Hook

### Task 4: Add new types to types.ts

**Files:**
- Modify: `src/dashboard/pages/office/types.ts`

- [ ] **Step 1: Add new types**

Append to `types.ts`:

```typescript
export interface TimelineEntry {
  id: string;
  type: 'reply' | 'tool_call' | 'insight' | 'reminder' | 'automation' | 'multi_agent' | 'habit' | 'comm';
  agentId?: AgentId;
  agentName?: string;
  agentColor?: string;
  action: string;
  details?: string;
  icon?: string;
  timestamp: string;
  actions?: Array<{ label: string; action: string; color: string }>;
  relatedAgents?: AgentId[];
}

export interface InsightCard {
  id: string;
  agentId: AgentId;
  agentName: string;
  text: string;
  category: 'spending' | 'habits' | 'calendar' | 'general';
  timestamp: string;
  dismissed: boolean;
}

export interface OfficeMetrics {
  creditsUsedToday: number;
  messagesToday: number;
  toolCallsToday: number;
  providerBreakdown: Record<string, number>;
}

export type SidebarTab = 'timeline' | 'tasks' | 'metrics';
```

- [ ] **Step 2: Add animation constants to constants.ts**

Append to `constants.ts`:

```typescript
// Animation tiers
export const TIER_AMBIENT_GLOW_MS = 2000;
export const TIER_CHAIN_STAGGER_MS = 200;
export const TIER_CINEMATIC_ZOOM_MS = 800;
export const TIER_CINEMATIC_HOLD_MS = 500;
export const TIER_CINEMATIC_PULLBACK_MS = 600;

// Insight toasts
export const TOAST_DURATION_MS = 8000;
export const TOAST_FADE_MS = 500;
export const TOAST_GAP_MS = 3000;
export const TOAST_MAX_QUEUE = 3;
export const TOAST_MAX_AGE_MS = 60000;

// Sidebar
export const SIDEBAR_POLL_INTERVAL_MS = 3000;
export const SSE_RETRY_INTERVAL_MS = 15000;
export const TIMELINE_MAX_ITEMS = 50;
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/types.ts src/dashboard/pages/office/constants.ts
git commit -m "feat(office): add timeline, insight, metrics types and animation constants"
```

---

### Task 5: Create useOfficeData hook (SSE + polling)

**Files:**
- Create: `src/dashboard/pages/office/useOfficeData.ts`
- Delete: `src/dashboard/pages/office/useOfficeSSE.ts` (after wiring)

- [ ] **Step 1: Read existing useOfficeSSE.ts for reference**

Read `src/dashboard/pages/office/useOfficeSSE.ts` to understand the current polling logic and return shape.

- [ ] **Step 2: Create useOfficeData.ts**

```typescript
// src/dashboard/pages/office/useOfficeData.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SSEEvent, ConnectionMode, OfficeMetrics } from './types';
import { SIDEBAR_POLL_INTERVAL_MS, SSE_RETRY_INTERVAL_MS } from './constants';

function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
}

function getToken(): string | null {
  return localStorage.getItem('gs_token') || localStorage.getItem('token') || sessionStorage.getItem('token');
}

interface OfficeData {
  taskBoard: Record<string, unknown[]>;
  taskStats: { total: number; pending: number; running: number; completed: number; failed: number; completedToday: number };
  comms: Array<Record<string, unknown>>;
  commStats: Record<string, unknown>;
  timeline: Array<{ action: string; details: string; icon: string; created_at: string }>;
  metrics: OfficeMetrics;
}

export function useOfficeData() {
  const [sseEvents, setSSEEvents] = useState<SSEEvent[]>([]);
  const [officeData, setOfficeData] = useState<OfficeData | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('polling');
  const [sessionExpired, setSessionExpired] = useState(false);

  const sseAbortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Poll for sidebar data --
  const fetchOfficeState = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase()}/api/office/state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { setSessionExpired(true); return; }
      if (res.ok) {
        const data = await res.json();
        setOfficeData({
          taskBoard: data.taskBoard ?? {},
          taskStats: data.taskStats ?? { total: 0, pending: 0, running: 0, completed: 0, failed: 0, completedToday: 0 },
          comms: data.comms ?? [],
          commStats: data.commStats ?? {},
          timeline: data.timeline ?? [],
          metrics: data.metrics ?? { creditsUsedToday: 0, messagesToday: 0, toolCallsToday: 0, providerBreakdown: {} },
        });
        // Also extract buffered SSE events if in polling-only mode
        if (connectionMode === 'polling' && data.recentEvents?.length) {
          setSSEEvents(data.recentEvents);
        }
      }
    } catch { /* ignore network errors */ }
  }, [connectionMode]);

  // -- SSE stream for real-time canvas updates --
  const connectSSE = useCallback(() => {
    const token = getToken();
    if (!token) return;

    if (sseAbortRef.current) sseAbortRef.current.abort();
    const ctrl = new AbortController();
    sseAbortRef.current = ctrl;

    fetch(`${apiBase()}/api/agent-state/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (res.status === 401) { setSessionExpired(true); return; }
      if (!res.ok || !res.body) {
        setConnectionMode('polling');
        sseRetryRef.current = setTimeout(connectSSE, SSE_RETRY_INTERVAL_MS);
        return;
      }

      setConnectionMode('live');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      let reading = true;
      while (reading) {
        const { done, value } = await reader.read();
        if (done) { reading = false; break; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;
            setSSEEvents(prev => [...prev.slice(-49), event]);
          } catch { /* skip malformed */ }
        }
      }

      // Stream ended — reconnect
      if (!ctrl.signal.aborted) {
        setConnectionMode('reconnecting');
        sseRetryRef.current = setTimeout(connectSSE, SSE_RETRY_INTERVAL_MS);
      }
    }).catch(() => {
      if (!ctrl.signal.aborted) {
        setConnectionMode('polling');
        sseRetryRef.current = setTimeout(connectSSE, SSE_RETRY_INTERVAL_MS);
      }
    });
  }, []);

  // -- Init --
  useEffect(() => {
    fetchOfficeState();
    connectSSE();

    pollRef.current = setInterval(fetchOfficeState, SIDEBAR_POLL_INTERVAL_MS);

    return () => {
      sseAbortRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sseEvents, officeData, connectionMode, sessionExpired };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | grep office`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/office/useOfficeData.ts
git commit -m "feat(office): create useOfficeData hook with SSE + polling dual channel"
```

---

## Chunk 3: Layout + Smart Sidebar

### Task 6: Create SmartSidebar component

**Files:**
- Create: `src/dashboard/pages/office/SmartSidebar.tsx`

- [ ] **Step 1: Create SmartSidebar.tsx**

Build the sidebar shell with 3 tabs (Timeline / Tasks / Metrics), quick-action chat input at bottom, and session-expired banner. Reuse existing `TasksTab` and `MetricsTab` components. Timeline tab will use `TimelineCard` (Task 7).

The component receives `officeData`, `sseEvents`, `activeTab`, `onTabChange`, `sessionExpired`, and renders the appropriate tab content. Include the chat input bar at the bottom with a send handler that POSTs to `/api/agent/chat`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | grep -i error | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/SmartSidebar.tsx
git commit -m "feat(office): create SmartSidebar with 3 tabs + chat input"
```

---

### Task 7: Create TimelineCard component

**Files:**
- Create: `src/dashboard/pages/office/TimelineCard.tsx`

- [ ] **Step 1: Create TimelineCard.tsx**

Build a card component that renders differently based on `TimelineEntry.type`:

| Type | Border Color | Icon | Content |
|------|-------------|------|---------|
| reply | Agent color | Agent emoji | Response preview + "X ago" |
| tool_call | `#00F0FF` | 🔧 | Tool name + params |
| insight | `#F59E0B` | 💡 | Insight text (gold background) |
| reminder | `#8B5CF6` | ⏰ | Text + Done/Snooze buttons |
| automation | `#EC4899` | ⚡ | Name + result |
| multi_agent | `#00F0FF` | 🌐 | Task + agent avatar row |
| habit | `#ADFF2F` | 🔥 | Name + streak + Log/Skip |
| comm | Agent color | 💬 | From → To: message |

Each card has: colored left border, icon, agent name, relative timestamp, content preview. Use existing Agentin design tokens from constants.

- [ ] **Step 2: Verify renders in SmartSidebar**

Wire `TimelineCard` into `SmartSidebar`'s timeline tab. Map `officeData.timeline` entries to `TimelineEntry` objects.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/TimelineCard.tsx
git commit -m "feat(office): create TimelineCard with 8 entry types"
```

---

### Task 8: Rewire OfficePage layout to 60/40 horizontal split

**Files:**
- Modify: `src/dashboard/pages/office/OfficePage.tsx`
- Delete: `src/dashboard/pages/office/DraggableDivider.tsx`
- Delete: `src/dashboard/pages/office/ControlRoom.tsx`
- Delete: `src/dashboard/pages/office/CommsTab.tsx`
- Delete: `src/dashboard/pages/office/useOfficeSSE.ts`

- [ ] **Step 1: Read current OfficePage.tsx fully**

- [ ] **Step 2: Rewrite OfficePage layout**

Replace the vertical split (OfficeStage top + ControlRoom bottom with DraggableDivider) with a horizontal split:

```tsx
<div className="flex h-full">
  {/* Office Stage — 60% */}
  <div className="w-[60%] relative">
    <OfficeStage ... />
    <InsightToast ... />  {/* Task 10 */}
  </div>
  {/* Smart Sidebar — 40% */}
  <div className="w-[40%] border-l border-[rgba(0,240,255,0.15)]">
    <SmartSidebar ... />
  </div>
</div>
```

Replace `useOfficeSSE()` with `useOfficeData()`. Wire `sessionExpired` state to the re-login banner (already built in earlier fix). Update `SidebarTab` state to replace `ControlTab`.

Mobile: Switch to `flex-col` with canvas 35% height and sidebar 65%.

- [ ] **Step 3: Delete old files**

```bash
rm src/dashboard/pages/office/DraggableDivider.tsx
rm src/dashboard/pages/office/ControlRoom.tsx
rm src/dashboard/pages/office/CommsTab.tsx
rm src/dashboard/pages/office/useOfficeSSE.ts
```

- [ ] **Step 4: Fix any import errors**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | head -20`

Fix broken imports in any files that referenced deleted modules.

- [ ] **Step 5: Verify lint passes**

Run: `cd ~/GeekSpace2.0 && npm run lint 2>&1 | head -10`

- [ ] **Step 6: Commit**

```bash
git add -A src/dashboard/pages/office/
git commit -m "feat(office): horizontal 60/40 layout with SmartSidebar, remove ControlRoom"
```

---

## Chunk 4: Animation Tiers + Canvas Effects

### Task 9: Create AnimationTierSelector

**Files:**
- Create: `src/dashboard/pages/office/AnimationTierSelector.ts`

- [ ] **Step 1: Create the pure function**

```typescript
// src/dashboard/pages/office/AnimationTierSelector.ts

export type AnimationTier = 1 | 2 | 3;

interface TierContext {
  isFirstVisit: boolean;
  isMultiAgent: boolean;
  toolCallCount: number;
  thinkingStartTime: number; // 0 if not thinking
}

export function selectAnimationTier(ctx: TierContext): AnimationTier {
  if (ctx.isFirstVisit) return 3;
  if (ctx.isMultiAgent || ctx.toolCallCount >= 2) return 2;
  if (ctx.thinkingStartTime > 0 && Date.now() - ctx.thinkingStartTime > 10_000) return 3;
  return 1;
}

// Track tool calls per request (client-side accumulator)
const requestToolCounts = new Map<string, number>();

export function trackToolCall(requestId: string | undefined): number {
  if (!requestId) return 0;
  const count = (requestToolCounts.get(requestId) ?? 0) + 1;
  requestToolCounts.set(requestId, count);
  return count;
}

export function clearRequest(requestId: string | undefined): void {
  if (requestId) requestToolCounts.delete(requestId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/pages/office/AnimationTierSelector.ts
git commit -m "feat(office): animation tier selector — ambient/chain/cinematic"
```

---

### Task 10: Create CanvasEffects module

**Files:**
- Create: `src/dashboard/pages/office/CanvasEffects.ts`

- [ ] **Step 1: Create CanvasEffects.ts**

Implement three effect systems that can be applied to the existing canvas:

```typescript
// src/dashboard/pages/office/CanvasEffects.ts
import type { AnimationTier } from './AnimationTierSelector';
import type { AgentId } from './types';
import { TIER_CINEMATIC_ZOOM_MS, TIER_CINEMATIC_HOLD_MS, TIER_CINEMATIC_PULLBACK_MS } from './constants';

export interface CanvasEffectState {
  // Cinematic zoom
  zoomTarget: { x: number; y: number } | null;
  zoomScale: number;       // 1.0 = no zoom, 1.5 = zoomed
  zoomProgress: number;    // 0-1 animation progress
  zoomPhase: 'none' | 'zoom_in' | 'hold' | 'zoom_out';

  // Spotlight
  spotlightAgent: AgentId | null;
  dimOpacity: number;      // 0.4 when spotlight active, 1.0 otherwise

  // Ambient particles
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
  // Tier 1: no global effect, handled per-agent in renderer
}

export function tickEffects(state: CanvasEffectState, dt: number): void {
  // Cinematic zoom animation
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

  // Ambient particles
  for (const p of state.particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > 864) p.vx *= -1;
    if (p.y < 0 || p.y > 800) p.vy *= -1;
    p.alpha = 0.02 + Math.sin(Date.now() * 0.001 + p.x) * 0.03;
  }
}

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/pages/office/CanvasEffects.ts
git commit -m "feat(office): canvas effects — cinematic zoom, spotlight, ambient particles"
```

---

### Task 11: Wire animation tiers into OfficeStage

**Files:**
- Modify: `src/dashboard/pages/office/OfficeStage.tsx`
- Modify: `src/dashboard/pages/office/OfficeCanvasRenderer.ts`

- [ ] **Step 1: Read OfficeStage.tsx processSSEEvent function**

Understand how SSE events currently update agent state on canvas.

- [ ] **Step 2: Integrate tier selector into SSE processing**

In `OfficeStage.tsx`, import `selectAnimationTier`, `trackToolCall`, `clearRequest` and the `CanvasEffects` module. When a `thinking` event arrives, record `thinkingStartTime`. When `tool_call` arrives, call `trackToolCall(requestId)`. When `done` arrives, call `clearRequest(requestId)`. Pass the tier to `startTierEffect()`.

- [ ] **Step 3: Apply canvas effects in render loop**

In `OfficeCanvasRenderer.ts`, apply the `CanvasEffectState`:
- Apply `ctx.save()` / `ctx.translate()` / `ctx.scale()` for zoom
- Apply `globalAlpha = dimOpacity` for non-spotlight agents
- Draw ambient particles as 1px dots

- [ ] **Step 4: Verify TypeScript + lint**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/pages/office/OfficeStage.tsx src/dashboard/pages/office/OfficeCanvasRenderer.ts
git commit -m "feat(office): wire animation tiers into canvas render loop"
```

---

## Chunk 5: Insight Toasts + Polish

### Task 12: Create InsightToast component

**Files:**
- Create: `src/dashboard/pages/office/InsightToast.tsx`

- [ ] **Step 1: Create InsightToast.tsx**

A floating toast banner that appears at top-center of the canvas stage. Glassmorphism style, amber accent, agent emoji + insight text. Auto-dismisses after 8s. Supports a queue of max 3 with 3s gap between.

Props: `insights: InsightCard[]`, `onDismiss: (id: string) => void`, `onClickInsight: (id: string) => void`

State: `activeToast`, `queue`, auto-timer via `useEffect`.

Style: `position: absolute; top: 16px; left: 50%; transform: translateX(-50%)` over the canvas. Background: `rgba(245,158,11,0.12)`, border: `1px solid rgba(245,158,11,0.4)`, `backdrop-filter: blur(12px)`.

Include flush-on-focus: if tab was hidden and regains focus, discard queued toasts older than 60s.

- [ ] **Step 2: Wire into OfficePage**

Add `<InsightToast />` inside the Office Stage container div, positioned absolutely over the canvas. Extract insights from `officeData.timeline` entries where `action` contains "insight" or `icon` is "💡".

- [ ] **Step 3: Verify renders**

Run dev server and check the toast appears (may need to manually add an insight entry to activity_log for testing).

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/office/InsightToast.tsx src/dashboard/pages/office/OfficePage.tsx
git commit -m "feat(office): insight toast banners with queue and auto-dismiss"
```

---

### Task 13: Mobile adaptation

**Files:**
- Modify: `src/dashboard/pages/office/OfficePage.tsx`
- Modify: `src/dashboard/pages/office/SmartSidebar.tsx`

- [ ] **Step 1: Add responsive breakpoint**

In `OfficePage.tsx`, detect mobile via `useMediaQuery` or a simple `window.innerWidth < 768` state. On mobile:
- Switch layout from `flex-row` to `flex-col`
- Canvas: `h-[35vh]`
- Sidebar: `flex-1` (remaining space)

- [ ] **Step 2: Simplify mobile canvas**

Pass a `isMobile` prop to `OfficeStage`. When mobile:
- Disable pathfinding (agents stay at desk positions)
- Reduce particle count
- Disable cinematic zoom (tier 3 → tier 1 on mobile)

- [ ] **Step 3: Mobile sidebar as bottom sheet feel**

In `SmartSidebar.tsx`, on mobile:
- Chat input pinned to bottom (above mobile nav, ~60px clearance)
- Tabs use compact text
- Cards use smaller font

- [ ] **Step 4: Verify at 375px viewport**

Use browser devtools to test at 375px width.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/pages/office/OfficePage.tsx src/dashboard/pages/office/SmartSidebar.tsx
git commit -m "feat(office): mobile adaptation — compact canvas + bottom sheet sidebar"
```

---

### Task 14: Full verification + cleanup

**Files:** All modified files

- [ ] **Step 1: TypeScript check**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Lint**

Run: `cd ~/GeekSpace2.0 && npm run lint`
Expected: 0 errors

- [ ] **Step 3: Server tests**

Run: `cd ~/GeekSpace2.0/server && npm test -- --reporter=dot 2>&1 | tail -5`
Expected: All passing (≥2518)

- [ ] **Step 4: Build**

Run: `cd ~/GeekSpace2.0 && npm run build`
Expected: Successful build

- [ ] **Step 5: Deploy + verify**

```bash
docker compose up -d --build geekspace
sleep 5
curl -s localhost:3001/api/health | python3 -m json.tool | head -5
```

- [ ] **Step 6: Manual test checklist**

- [ ] Open Office page on desktop — verify 60/40 layout
- [ ] Send a Telegram message — verify agent lights up on canvas (Tier 1 ambient)
- [ ] Check Timeline tab — verify rich cards render with correct colors
- [ ] Check Tasks tab — verify existing Kanban still works
- [ ] Check Metrics tab — verify stat cards + provider breakdown
- [ ] Open on mobile (375px) — verify vertical layout + compact canvas
- [ ] Wait for session expiry — verify re-login banner appears
- [ ] Check toast queue — add test insight to activity_log and verify toast fires

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(office): magical experience — animation tiers, smart sidebar, insight toasts"
```
