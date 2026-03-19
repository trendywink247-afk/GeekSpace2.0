# Agent Office Mission Control — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic 1729-line OfficePage with an immersive "Mission Control" experience — a pixel art compound with 9 agents, door animations, particle beams, speech bubbles, and a 4-tab control room.

**Architecture:** Split into 14 focused files under `src/dashboard/pages/office/`. A shared `useOfficeSSE` hook provides real-time events to both the Stage (canvas + DOM overlays) and Control Room (4 tabbed panels). Canvas renders at 5fps; DOM overlays use CSS animations (GPU-accelerated).

**Tech Stack:** React 19, TypeScript, Canvas 2D API, framer-motion (existing), recharts (existing, lazy), Tailwind CSS, Zustand-style local state via useRef/useState.

**Spec:** `docs/superpowers/specs/2026-03-19-agent-office-redesign.md`

---

## File Structure

```
src/dashboard/pages/office/
  index.ts                 — barrel export
  OfficePage.tsx           — Shell: layout, divider, tab state, SSE hook provider (~180L)
  useOfficeSSE.ts          — Shared SSE hook: connects, parses, provides events (~120L)
  constants.ts             — Agent metadata, colors, grid positions, mappings (~80L)
  types.ts                 — Shared TypeScript interfaces (~60L)
  OfficeStage.tsx          — Canvas container + overlay positioning (~200L)
  OfficeCanvasRenderer.ts  — Pure canvas drawing functions (compound, agents, door, particles) (~350L)
  SpeechBubbleLayer.tsx    — DOM speech bubbles positioned over canvas (~80L)
  MiniChatLog.tsx          — Floating collapsible comms overlay (~80L)
  SpotlightHUD.tsx         — Agent action bar on single-click (~60L)
  AgentProfileFlyout.tsx   — Full agent detail panel on double-click (~150L)
  DraggableDivider.tsx     — Resizable split handle (~50L)
  ControlRoom.tsx          — Tab container with lazy content (~80L)
  TasksTab.tsx             — Kanban board with drag-and-drop (~200L)
  CommsTab.tsx             — Agent communication feed with filters (~150L)
  MetricsTab.tsx           — Charts and counter cards (~150L)
  TimelineTab.tsx          — Chronological SSE event stream (~120L)
```

**Modify:** `src/dashboard/DashboardApp.tsx` (update lazy import path)

**Total:** ~2110 lines across 17 files (vs current 1729 lines in 1 file)

---

## Task 1: Foundation — Types, Constants, Barrel Export

**Files:**
- Create: `src/dashboard/pages/office/types.ts`
- Create: `src/dashboard/pages/office/constants.ts`
- Create: `src/dashboard/pages/office/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// src/dashboard/pages/office/types.ts

export type AgentId = 'weebo' | 'edith' | 'jarvis' | 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';
export type CoreAgentId = 'weebo' | 'edith' | 'jarvis';
export type SpecialistId = 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

export type AgentStateType =
  | 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result'
  | 'responding' | 'done'
  | 'delegating' | 'comm_sent' | 'comm_received'
  | 'task_started' | 'task_completed' | 'task_failed';

export interface SSEEvent {
  agentId: string;
  agentName: string;
  state: AgentStateType;
  tool?: string;
  content?: string;
  targetAgent?: string;
  taskId?: string;
  commId?: string;
  timestamp: string;
}

export interface CanvasAgent {
  id: AgentId;
  name: string;
  color: string;
  emoji: string;
  role: string;
  x: number;           // grid column
  y: number;           // grid row
  targetX: number;     // BFS target column
  targetY: number;     // BFS target row
  state: AgentStateType;
  isSpecialist: boolean;
  isDormant: boolean;   // specialists only: greyed out when inactive
  parentAgent?: CoreAgentId; // specialists only: which core agent owns them
  lastContent?: string;
  lastTool?: string;
}

export interface ParticleBeam {
  id: string;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  color: string;
  createdAt: number;    // Date.now()
  duration: number;     // ms
}

export interface SpeechBubble {
  id: string;
  agentId: AgentId;
  text: string;
  color: string;
  createdAt: number;
  expiresAt: number;    // createdAt + 4000
}

export interface DoorState {
  isOpen: boolean;
  frame: number;        // 0-5 animation frame
  agentPassing?: AgentId;
}

export type ConnectionMode = 'live' | 'reconnecting' | 'polling';
export type ControlTab = 'tasks' | 'comms' | 'metrics' | 'timeline';
```

- [ ] **Step 2: Create constants.ts**

```typescript
// src/dashboard/pages/office/constants.ts
import type { AgentId, CoreAgentId, SpecialistId, CanvasAgent } from './types';

export const CELL = 18;
export const COLS = 46;
export const ROWS = 20;
export const CANVAS_W = COLS * CELL; // 828
export const CANVAS_H = ROWS * CELL; // 360

// Door position (columns 28-29)
export const DOOR_COL = 28;
export const DOOR_ROW_START = 4;
export const DOOR_ROW_END = 8;

export const AGENT_COLORS: Record<AgentId, string> = {
  weebo: '#00F0FF', edith: '#8B5CF6', jarvis: '#ADFF2F',
  aria: '#FF6B9D', forge: '#F59E0B', pulse: '#10B981',
  echo: '#6366F1', cal: '#84CC16', nova: '#EC4899',
};

export const AGENT_META: Record<AgentId, { emoji: string; role: string }> = {
  weebo: { emoji: '\u2728', role: 'Creative Assistant' },
  edith: { emoji: '\uD83D\uDD37', role: 'Strategic Engine' },
  jarvis: { emoji: '\uD83E\uDD16', role: 'Operations' },
  aria: { emoji: '\uD83C\uDFA8', role: 'Creative Director' },
  forge: { emoji: '\u2699\uFE0F', role: 'Tech Lead' },
  pulse: { emoji: '\uD83D\uDCCA', role: 'Data Analyst' },
  echo: { emoji: '\uD83D\uDCAC', role: 'Coach' },
  cal: { emoji: '\uD83D\uDCC5', role: 'Scheduler' },
  nova: { emoji: '\uD83D\uDE80', role: 'Researcher' },
};

export const SPECIALIST_PARENT: Record<SpecialistId, CoreAgentId> = {
  aria: 'weebo', echo: 'weebo',
  forge: 'edith', pulse: 'edith',
  cal: 'jarvis', nova: 'jarvis',
};

export const CORE_AGENTS: CoreAgentId[] = ['weebo', 'edith', 'jarvis'];
export const SPECIALIST_AGENTS: SpecialistId[] = ['aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

// Desk positions in the main office (left side, cols 0-27)
export const CORE_DESK_POSITIONS: Record<CoreAgentId, { x: number; y: number }> = {
  weebo: { x: 4, y: 5 },
  edith: { x: 14, y: 5 },
  jarvis: { x: 9, y: 9 },
};

// Station positions in the specialist lab (right side, cols 30-45)
export const SPECIALIST_POSITIONS: Record<SpecialistId, { x: number; y: number }> = {
  aria: { x: 33, y: 4 }, forge: { x: 39, y: 4 },
  pulse: { x: 33, y: 8 }, echo: { x: 39, y: 8 },
  cal: { x: 33, y: 12 }, nova: { x: 39, y: 12 },
};

// Design tokens
export const C = {
  bg: '#05050A',
  card: '#0C0C18',
  elevated: '#12121F',
  cyan: '#00F0FF',
  green: '#ADFF2F',
  pink: '#FF2D78',
  purple: '#8B5CF6',
  text: '#F4F6FF',
  muted: '#8892A4',
  dim: '#4B5563',
  border: 'rgba(0,240,255,0.1)',
};

export const STATE_IDLE_TIMEOUT_MS = 30_000;
export const SSE_RECONNECT_DELAY_MS = 5_000;
export const SSE_MAX_RETRIES = 10;
export const CANVAS_TICK_MS = 200;
export const MAX_SPEECH_BUBBLES = 3;
export const MAX_PARTICLE_BEAMS = 3;
export const MAX_TIMELINE_EVENTS = 200;
export const MAX_FEED_ITEMS = 100;
export const SPEECH_BUBBLE_TTL = 4000;
export const PARTICLE_BEAM_TTL = 2000;
export const DOOR_FRAME_MS = 200;
export const SPOTLIGHT_SCALE = 1.5;
export const CLICK_DOUBLE_THRESHOLD_MS = 250;
export const MISSION_POLL_INTERVAL_MS = 30_000;
```

- [ ] **Step 3: Create index.ts barrel**

```typescript
// src/dashboard/pages/office/index.ts
export { OfficePage } from './OfficePage';
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/pages/office/
git commit -m "feat(office): Task 1 — types, constants, barrel export"
```

---

## Task 2: useOfficeSSE Hook — Shared Real-Time Event Provider

**Files:**
- Create: `src/dashboard/pages/office/useOfficeSSE.ts`

- [ ] **Step 1: Create useOfficeSSE.ts**

The hook connects to `/api/agent-state/stream` via `fetch()` + `ReadableStream` (matching current pattern), parses SSE events, manages reconnection with exponential backoff, and exposes events + connection state.

```typescript
// src/dashboard/pages/office/useOfficeSSE.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SSEEvent, ConnectionMode } from './types';
import { SSE_RECONNECT_DELAY_MS, SSE_MAX_RETRIES } from './constants';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

export function useOfficeSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('reconnecting');
  const abortRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const pushEvent = useCallback((evt: SSEEvent) => {
    setEvents(prev => {
      const next = [...prev, evt];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  const connect = useCallback(async () => {
    const token = localStorage.getItem('gs_token')
      || localStorage.getItem('token')
      || sessionStorage.getItem('token');
    if (!token || !mountedRef.current) return;

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/agent-state/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

      setConnectionMode('live');
      retriesRef.current = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (mountedRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as SSEEvent;
            if (evt.agentId && evt.state) pushEvent(evt);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (!mountedRef.current) return;

      retriesRef.current++;
      if (retriesRef.current >= SSE_MAX_RETRIES) {
        setConnectionMode('polling');
        return;
      }

      setConnectionMode('reconnecting');
      const delay = Math.min(SSE_RECONNECT_DELAY_MS * Math.pow(2, retriesRef.current - 1), 60000);
      setTimeout(() => { if (mountedRef.current) connect(); }, delay);
    }
  }, [pushEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [connect]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connectionMode, clearEvents };
}
```

- [ ] **Step 2: Verify compiles**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/useOfficeSSE.ts
git commit -m "feat(office): Task 2 — useOfficeSSE shared hook with reconnection"
```

---

## Task 3: DraggableDivider Component

**Files:**
- Create: `src/dashboard/pages/office/DraggableDivider.tsx`

- [ ] **Step 1: Create DraggableDivider.tsx**

```typescript
// src/dashboard/pages/office/DraggableDivider.tsx
import { useCallback, useRef } from 'react';

interface Props {
  onResize: (topPercent: number) => void;
}

export function DraggableDivider({ onResize }: Props) {
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    containerRef.current = e.currentTarget.parentElement as HTMLDivElement;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientY - rect.top) / rect.height) * 100;
    onResize(Math.min(70, Math.max(30, pct)));
  }, [onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      className="h-2 cursor-row-resize flex items-center justify-center group hover:bg-[#00F0FF]/10 transition-colors"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="w-12 h-1 rounded-full bg-[#00F0FF]/15 group-hover:bg-[#00F0FF]/30 transition-colors" />
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles + Commit**

```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit
git add src/dashboard/pages/office/DraggableDivider.tsx
git commit -m "feat(office): Task 3 — DraggableDivider with pointer capture"
```

---

## Task 4: OfficePage Shell — Layout + State + Tab Routing

**Files:**
- Create: `src/dashboard/pages/office/OfficePage.tsx`
- Modify: `src/dashboard/DashboardApp.tsx` (line 78 — update import path)

- [ ] **Step 1: Create OfficePage.tsx shell**

This is the top-level component: manages split ratio, tab state, SSE hook, and renders Stage + Divider + ControlRoom. Individual sections are stubs initially (replaced in later tasks).

The shell should:
- Call `useOfficeSSE()` for real-time events
- Manage `splitPercent` state (default 50, persisted in localStorage)
- Manage `activeTab` state (default 'tasks')
- Render header with connection badge
- Render Stage placeholder (replaced Task 6)
- Render DraggableDivider
- Render ControlRoom placeholder (replaced Task 11)
- Include `pb-24 md:pb-0` for mobile

- [ ] **Step 2: Update DashboardApp.tsx import**

Change line 78 from:
```typescript
const OfficePage = lazyRetry(() => import('./pages/OfficePage').then(m => ({ default: m.OfficePage })));
```
To:
```typescript
const OfficePage = lazyRetry(() => import('./pages/office').then(m => ({ default: m.OfficePage })));
```

- [ ] **Step 3: Verify compiles + test navigation works**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/office/OfficePage.tsx src/dashboard/DashboardApp.tsx
git commit -m "feat(office): Task 4 — OfficePage shell with split layout + tab routing"
```

---

## Task 5: OfficeCanvasRenderer — Pure Canvas Drawing

**Files:**
- Create: `src/dashboard/pages/office/OfficeCanvasRenderer.ts`

This is a pure TypeScript module (no React) that draws the pixel art compound onto a canvas context. Functions are called by OfficeStage on each tick.

- [ ] **Step 1: Create OfficeCanvasRenderer.ts**

Key functions to implement:
- `drawBackground(ctx, cols, rows, cell)` — floor, walls, grid lines
- `drawDoor(ctx, doorState, cell)` — 6-frame door animation at DOOR_COL
- `drawDesk(ctx, x, y, cell, color)` — 3x2 desk block with monitor
- `drawStation(ctx, x, y, cell, color, isDormant)` — specialist workstation
- `drawAgent(ctx, agent, cell, tick)` — sprite (head + body + legs + state indicator)
- `drawParticleBeam(ctx, beam, agents, cell, tick)` — colored particles between agents
- `drawServerRack(ctx, cell, tick)` — blinking LEDs
- `renderFrame(ctx, state)` — orchestrator: calls all draw functions in order

Each function uses `ctx.fillRect()` only — no images, no paths, no gradients. Pure pixel art.

- [ ] **Step 2: Verify compiles**
- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/OfficeCanvasRenderer.ts
git commit -m "feat(office): Task 5 — OfficeCanvasRenderer pure canvas drawing"
```

---

## Task 6: OfficeStage — Canvas + Agent State Management

**Files:**
- Create: `src/dashboard/pages/office/OfficeStage.tsx`

- [ ] **Step 1: Create OfficeStage.tsx**

Responsibilities:
- Manages `CanvasAgent[]` state for all 9 agents
- Processes SSE events → updates agent states (including specialist dormant/active transitions)
- Runs BFS pathfinding for agent movement
- Manages `ParticleBeam[]` and `SpeechBubble[]` arrays
- Manages `DoorState` for door animation
- Runs canvas render loop at 200ms via `setInterval`
- Calls `OfficeCanvasRenderer.renderFrame()` each tick
- Handles click/double-click on canvas (hit detection via grid math)
- Manages spotlight state (scale + transform-origin CSS)
- Positions DOM overlay containers for SpeechBubbleLayer and MiniChatLog

- [ ] **Step 2: Verify compiles**
- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/OfficeStage.tsx
git commit -m "feat(office): Task 6 — OfficeStage canvas + agent state + render loop"
```

---

## Task 7: SpeechBubbleLayer + MiniChatLog — DOM Overlays

**Files:**
- Create: `src/dashboard/pages/office/SpeechBubbleLayer.tsx`
- Create: `src/dashboard/pages/office/MiniChatLog.tsx`

- [ ] **Step 1: Create SpeechBubbleLayer.tsx**

Renders up to 3 `SpeechBubble` items as absolutely positioned divs over the canvas. Each bubble has glassmorphism styling (`bg-[agentColor]/10 backdrop-blur-sm`), fades in with CSS transition, auto-expires after 4s.

- [ ] **Step 2: Create MiniChatLog.tsx**

Floating panel (top-right of stage, `w-56 max-h-48`). Shows last 10 inter-agent messages. Collapsible to badge-only. Fed from SSE `comm_sent`/`comm_received` events + polled comms data.

- [ ] **Step 3: Verify compiles + Commit**

```bash
git add src/dashboard/pages/office/SpeechBubbleLayer.tsx src/dashboard/pages/office/MiniChatLog.tsx
git commit -m "feat(office): Task 7 — SpeechBubbleLayer + MiniChatLog overlays"
```

---

## Task 8: SpotlightHUD + AgentProfileFlyout — Agent Interaction

**Files:**
- Create: `src/dashboard/pages/office/SpotlightHUD.tsx`
- Create: `src/dashboard/pages/office/AgentProfileFlyout.tsx`

- [ ] **Step 1: Create SpotlightHUD.tsx**

Compact action bar shown below spotlighted agent. Shows: emoji + name + state + task count. Buttons: Chat | Assign Task | View History. Glassmorphism card.

- [ ] **Step 2: Create AgentProfileFlyout.tsx**

360px panel sliding from right. Sections: header, current task, today's stats, specialists list, recent activity, action buttons (Chat with Agent → navigates to `/dashboard/chat?agent=[id]`, Assign Task → inline form). Uses `useNavigate()` for chat navigation. Fetches agent-specific data from `agentTasksService.list({ agent_id })`.

- [ ] **Step 3: Verify compiles + Commit**

```bash
git add src/dashboard/pages/office/SpotlightHUD.tsx src/dashboard/pages/office/AgentProfileFlyout.tsx
git commit -m "feat(office): Task 8 — SpotlightHUD + AgentProfileFlyout interaction"
```

---

## Task 9: TasksTab — Kanban with Drag-and-Drop

**Files:**
- Create: `src/dashboard/pages/office/TasksTab.tsx`

- [ ] **Step 1: Create TasksTab.tsx**

3-column kanban: Pending | Running | Completed. Uses native HTML drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — no library needed. Drag mappings: Pending→Running = `action:'start'`, Running→Completed = `action:'complete'`. Invalid drags shake + snap back. Task cards show agent emoji + title + priority. Create form at bottom. Data from `agentTasksService.board()` polled at 30s.

- [ ] **Step 2: Verify compiles + Commit**

```bash
git add src/dashboard/pages/office/TasksTab.tsx
git commit -m "feat(office): Task 9 — TasksTab kanban with drag-and-drop"
```

---

## Task 10: CommsTab + TimelineTab — Communication Views

**Files:**
- Create: `src/dashboard/pages/office/CommsTab.tsx`
- Create: `src/dashboard/pages/office/TimelineTab.tsx`

- [ ] **Step 1: Create CommsTab.tsx**

Slack-like feed with filter bar (agent buttons + type filter). Message entries with colored agent names, arrows, type badges. Real-time from SSE events + `agentCommsService.recent()` poll. Delegation messages highlighted with gold border.

- [ ] **Step 2: Create TimelineTab.tsx**

Chronological event stream from SSE events array (passed from useOfficeSSE). Each entry: timestamp + agent dot + agent name + event type badge + content. Color-coded badges per state type. Minute separators. Auto-scroll with pause on hover. Max 200 entries.

- [ ] **Step 3: Verify compiles + Commit**

```bash
git add src/dashboard/pages/office/CommsTab.tsx src/dashboard/pages/office/TimelineTab.tsx
git commit -m "feat(office): Task 10 — CommsTab + TimelineTab communication views"
```

---

## Task 11: MetricsTab — Charts and Counters

**Files:**
- Create: `src/dashboard/pages/office/MetricsTab.tsx`

- [ ] **Step 1: Create MetricsTab.tsx**

4 counter cards at top (animated count-up via useEffect). Tasks-by-agent horizontal bar chart. Tool usage bar chart. Agent activity line chart (using recharts `LineChart` — already in bundle, imported lazily). Data from `agentTasksService.stats()` + `agentCommsService.stats()` + `usageService.summary()`.

- [ ] **Step 2: Verify compiles + Commit**

```bash
git add src/dashboard/pages/office/MetricsTab.tsx
git commit -m "feat(office): Task 11 — MetricsTab charts and counters"
```

---

## Task 12: ControlRoom — Tab Container

**Files:**
- Create: `src/dashboard/pages/office/ControlRoom.tsx`

- [ ] **Step 1: Create ControlRoom.tsx**

Tab bar with 4 tabs (Tasks | Comms | Metrics | Timeline) + live count badges. Renders only the active tab content (inactive = null for performance). Tab bar styled with active cyan border-bottom. Receives SSE events prop from parent for Timeline tab.

- [ ] **Step 2: Verify compiles + Commit**

```bash
git add src/dashboard/pages/office/ControlRoom.tsx
git commit -m "feat(office): Task 12 — ControlRoom tab container"
```

---

## Task 13: Wire Everything Together in OfficePage Shell

**Files:**
- Modify: `src/dashboard/pages/office/OfficePage.tsx` (replace stubs with real components)

- [ ] **Step 1: Import and wire all components**

Replace placeholder divs in OfficePage with:
- `<OfficeStage events={events} ... />` (top section)
- `<DraggableDivider onResize={...} />`
- `<ControlRoom events={events} activeTab={activeTab} ... />` (bottom section)

Wire SSE events to both Stage and ControlRoom. Wire agent click/double-click to SpotlightHUD/AgentProfileFlyout. Wire task board polling (30s interval with cleanup).

- [ ] **Step 2: Full TypeScript check**

Run: `cd ~/GeekSpace2.0 && npx tsc --noEmit && cd server && npx tsc --noEmit`

- [ ] **Step 3: Build frontend**

Run: `cd ~/GeekSpace2.0 && npm run build 2>&1 | tail -5`

- [ ] **Step 4: Brand guard**

Run: `npm run brand-guard`

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/pages/office/
git commit -m "feat(office): Task 13 — Wire all components into OfficePage shell"
```

---

## Task 14: Integration Test + Deploy

- [ ] **Step 1: Run full test suite**

Run: `cd ~/GeekSpace2.0/server && npx vitest run --reporter=dot 2>&1 | tail -5`
Expected: 2517+ passing, no regressions

- [ ] **Step 2: Build + deploy frontend**

```bash
cd ~/GeekSpace2.0 && npm run build
find /var/www/geekspace/assets/ -name "index-*" -not -name "*.css" -delete
cp -r dist/assets/* /var/www/geekspace/assets/
cp dist/index.html /var/www/geekspace/index.html
```

- [ ] **Step 3: Rebuild backend container**

```bash
docker compose up -d --build geekspace
sleep 15
curl -sf localhost:3001/api/health | python3 -m json.tool
```

- [ ] **Step 4: Verify Office page loads**

Navigate to `https://ai.agentin.chat/dashboard/office` — verify:
- Canvas renders 9 agents (3 at desks, 6 in lab)
- SSE connection shows "LIVE" badge
- Tab switching works
- Agent click triggers spotlight
- No console errors

- [ ] **Step 5: Final commit + push**

```bash
git add -A
git commit -m "feat: Agent Office Mission Control — complete redesign deployed"
git push origin main
# After CI green:
git checkout live-production && git merge main --no-edit && git push origin live-production && git checkout main
```
