# Agentin Agentic Experience — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Transform Agentin from a chatbot with decorative pixel agents into a real agentic platform where Office agents reflect actual work, multi-agent collaboration is visible, and semantic memory persists across sessions.

**Architecture:** New Agent State Bus (in-memory EventEmitter + SSE fan-out) sits between all processing layers and the frontend. Every agent action emits typed state events. Office page and Chat UI subscribe to these events for real-time visualization. Qdrant semantic search wired into system prompt for memory persistence.

**Tech Stack:** TypeScript, Express SSE, React hooks, HTML5 Canvas, Qdrant vector DB, Ollama nomic-embed-text embeddings

---

## File Structure

### New files:
- `server/src/services/agent-state-bus.ts` — typed event bus with SSE fan-out
- `server/src/routes/agent-state.ts` — SSE endpoint `/api/agent-state/stream`

### Modified files:
- `server/src/services/react-loop.ts` — emit agentId in onStep events
- `server/src/services/message-router.ts` — emit state events at processing start/end
- `server/src/services/multi-agent-orchestrator.ts` — emit per-agent state during parallel execution
- `server/src/routes/agent.ts` — emit state events in stream handler, smart multi-agent routing
- `server/src/app.ts` — register agent-state route
- `src/dashboard/pages/OfficePage.tsx` — subscribe to agent-state stream, direct agent mapping
- `src/components/AgentChatPanel.tsx` — room transcript panel for multi-agent responses

---

## Task 1: Agent State Bus Service

**Files:**
- Create: `server/src/services/agent-state-bus.ts`

The nervous system. Typed events with SSE fan-out per userId.

```typescript
export interface AgentStateEvent {
  agentId: string;       // personality: 'weebo', 'edith', 'jarvis', 'aria', etc.
  agentName: string;     // display: 'Weebo', 'Edith', etc.
  state: 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result' | 'responding' | 'done';
  tool?: string;
  content?: string;
  iteration?: number;
  timestamp: string;
}

// Map<userId, Set<Response>> for SSE clients
// broadcastAgentState(userId, event) — push to all connected clients
// addClient(userId, res) / removeClient(userId, res)
// Heartbeat: 25s pings
```

## Task 2: Agent State SSE Endpoint

**Files:**
- Create: `server/src/routes/agent-state.ts`
- Modify: `server/src/app.ts` — add route registration

`GET /api/agent-state/stream` with `requireAuth`. Uses agent-state-bus addClient/removeClient.

## Task 3: Emit Events from Processing Pipeline

**Files:**
- Modify: `server/src/services/react-loop.ts`
- Modify: `server/src/services/message-router.ts`
- Modify: `server/src/services/multi-agent-orchestrator.ts`
- Modify: `server/src/routes/agent.ts`

### react-loop.ts
Add `agentId` to ReactLoopOptions. Pass through to onStep AND broadcast via agent-state-bus.

### message-router.ts
At step 6 (before LLM call): `broadcastAgentState(userId, { agentId: personalityId, state: 'thinking', content: 'Processing...' })`
At step 10 (after reply): `broadcastAgentState(userId, { agentId: personalityId, state: 'done' })`

### multi-agent-orchestrator.ts
Before each agent runs: `broadcastAgentState(userId, { agentId: task.agent, state: 'thinking', content: task.role })`
After each agent completes: `broadcastAgentState(userId, { agentId: task.agent, state: 'done' })`

### agent.ts stream handler
Emit agent state at thinking start and stream completion.

## Task 4: Office Page — Real Agent State

**Files:**
- Modify: `src/dashboard/pages/OfficePage.tsx`

Replace activity stream subscription with agent-state stream:
- Connect to `/api/agent-state/stream` (not `/api/activity/stream`)
- Map `event.agentId` directly to canvas agent (exact match, no guessing)
- Map `event.state` to animation: thinking→thought bubble, tool_call→typing with tool name, responding→typing, done→idle with fade
- Show `event.content` as floating label above agent
- Keep activity stream as secondary feed for the side panel

## Task 5: Room Transcript in Chat

**Files:**
- Modify: `src/components/AgentChatPanel.tsx`

When SSE chunks contain `agentId` field (multi-agent mode):
- Show a split-panel transcript view
- Each agent's response gets their personality color + emoji
- Tool calls shown as inline badges
- Collapsible into single merged response after completion

## Task 6: Smart Multi-Agent Detection

**Files:**
- Modify: `server/src/services/multi-agent-orchestrator.ts`

Beyond keyword triggers, detect multi-agent opportunities:
- Complex queries with multiple domains ("research X and create a plan")
- Comparison requests ("pros and cons of...")
- Decision-making ("should I...")
- Creative briefs ("design a..." → Aria + Forge + Pulse)

## Task 7: Semantic Memory Wire

**Files:**
- Modify: `server/src/services/message-router.ts`

Wire Qdrant semantic search into system prompt:
- After building memory context, also run `semanticSearch(userId, userMessage, 5)`
- Append matching memories to system prompt
- After reply, embed the exchange via `upsertMemoryVector`
- Non-blocking, graceful degradation if Qdrant is down
