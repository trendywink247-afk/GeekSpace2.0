# Visual Feedback & Unified Activity Stream

**Date:** 2026-03-20
**Status:** Approved
**Scope:** Telegram visual feedback, dashboard real-time sync, Office page animations, unified activity stream, bug fixes

---

## Problem

When Aliya sends a Telegram message, the bot goes silent for 3-10 seconds before responding. The web dashboard has no idea a Telegram message is being processed. The Office page agents wander aimlessly regardless of actual work happening. The existing SSE agent-state-bus has full infrastructure (12 state types, broadcast functions, AgentStatusStrip component) but is only wired to web chat — Telegram bypasses it entirely.

Additionally, three bugs discovered during testing need fixing: reminder time parsing, Hinglish time parsing, and expense currency detection.

---

## Design

### 1. Unified Activity Stream

**Replaces:** `server/src/services/agent-state-bus.ts`
**New file:** `server/src/services/activity-stream.ts`

Single service that captures all platform activity. The existing agent-state-bus's 12 separate `emit*()` functions collapse into one clean `emit()` with typed events.

```typescript
interface ActivityEvent {
  id: string;                // uuid
  userId: string;
  agentId: string;           // weebo, edith, jarvis, etc.
  type: ActivityEventType;
  channel: 'telegram' | 'web' | 'automation' | 'proactive';
  summary: string;           // human-readable: "Searching the web~"
  metadata?: Record<string, unknown>;
  timestamp: number;
  // Backward-compat fields for AgentStatusStrip (reads state/agentName/content)
  state: ActivityEventType;  // mirrors `type` — AgentStatusStrip reads this
  agentName: string;         // human label: "Weebo", "Edith" — strip reads this
  content: string;           // mirrors `summary` — strip reads this
}

type ActivityEventType =
  | 'thinking' | 'tool_call' | 'tool_result' | 'responding' | 'done'
  | 'message_in' | 'message_out'
  | 'task_started' | 'task_completed' | 'task_failed'
  | 'delegation' | 'comm_sent' | 'comm_received'
  | 'error' | 'idle';
```

The `state`, `agentName`, and `content` fields are backward-compat aliases so `AgentStatusStrip` works without changes. The `emit()` method auto-populates them from `type`, `agentId`, and `summary`.

**Responsibilities:**
- Maintains per-user event buffer (last 120s, max 100 events) — same as current bus
- Broadcasts to SSE clients via the existing `/api/agent-state/stream` endpoint (no URL change)
- Provides `getRecentEvents(userId)` for Office page polling
- Absorbs all existing `agent-state-bus.ts` functionality

**Migration call sites** (all files importing from `agent-state-bus.ts`):
1. `server/src/services/message-router.ts` — `emitThinking`, `emitDone`
2. `server/src/services/react-loop.ts` — `emitThinking`, `emitToolCall`, `emitToolResult`, `emitResponding`, `emitDone`
3. `server/src/services/agent-comms.ts` — `broadcastAgentState`
4. `server/src/services/multi-agent-orchestrator.ts` — `emitThinking`, `emitResponding`, `emitDone`, `emitCommSent`
5. `server/src/services/unified-agent-router.ts` — `emitThinking`, `emitDone`, `emitToolCall`, `emitResponding`
6. `server/src/routes/agent.ts` — `emitThinking`, `emitDone`
7. `server/src/routes/agent-state.ts` — `getRecentEvents`, `addStateClient`, `removeStateClient`
8. `server/src/routes/office.ts` — `getRecentEvents`

Each switches to `activityStream.emit({ type, channel, ... })`. All call sites must pass a `channel` param ('web', 'telegram', 'automation', or 'proactive').

**Rollback safety:** After migration, `agent-state-bus.ts` is kept as a thin re-export wrapper that delegates to `activity-stream.ts`. This lets us revert individual files without breaking the build. Delete the wrapper only after 1 week of stable production.

**Cleanup:** Consolidate string literals into the `ActivityEventType` union, exported from `activity-stream.ts`. Remove duplicate SSE heartbeat logic from `agent-state.ts` — activity-stream owns the heartbeat.

---

### 2. Telegram Visual Feedback

**Files:** `server/src/services/message-router.ts`, `server/src/services/telegram.ts`

#### 2a. Typing Indicator (simple requests)

For requests that don't trigger tools (general chat, simple Q&A):
- Send `sendChatAction('typing')` immediately when message arrives
- Repeat every 4 seconds until response is ready (Telegram typing indicator expires after 5s)
- Cancel the interval when response sends

**Implementation:** Add a `startTypingLoop(chatId)` function to `telegram.ts` that returns a cancel function. Call it at the start of message processing in the webhook handler.

#### 2b. Edit-in-Place Processing Message (tool-using requests)

For requests that trigger tools (calendar, email, web search, expenses, reminders via NL):
- Send an initial processing message immediately: `"🧠 Thinking~"`
- When a tool fires, edit the message to reflect the action:
  - Web search: `"🔍 Searching the web~"`
  - Calendar: `"📅 Checking your calendar~"`
  - Email: `"📧 Drafting your email~"`
  - Expense: `"💳 Logging expense~"`
  - Reminder: `"⏰ Setting reminder~"`
  - Generic tool: `"⚡ Working on it~"`
- When response is ready, edit the message to the final response (replaces processing text entirely)
- Max 2 intermediate edits before final response

**Implementation:**
- Add `sendProcessingMessage(chatId, text)` → returns `messageId`
- Add `editProcessingMessage(chatId, messageId, text)` → edits the message
- Add `replaceWithFinalResponse(chatId, messageId, finalText)` → final edit with `sanitizeForTelegram()` applied
- All use Telegram Bot API's `editMessageText` method
- **Parse mode handling:** Processing messages (short, known strings) use no parse mode (plain text). Final response uses `sanitizeForTelegram()` which strips markdown — pass the sanitized text to `editMessageText` without `parse_mode` to avoid Telegram parse failures on malformed LLM output. If the final text contains inline keyboard buttons, fall back to sending a new message + deleting the processing message.
- **Edit rate limiting:** Minimum 1 second between edits to the same message (Telegram Bot API enforces ~30 msg/sec per chat). Buffer rapid tool_call events and only edit when the interval has elapsed.

#### 2c. Decision Logic & messageId Threading

In `server/src/routes/webhooks.ts`, at webhook entry:
1. After rate limit check passes, before calling `handleIncomingMessage()`:
   - Check if request will likely use tools (use existing `hasToolTrigger()` + `detectTaskIntent()` on the raw text)
   - If yes → call `sendProcessingMessage(chatId, "🧠 Thinking~")`, capture returned `messageId`
   - If no → call `startTypingLoop(chatId)`, capture cancel function
2. Pass the `processingMessageId` (or `null`) and `cancelTyping` into `handleIncomingMessage()` via an extended options object

In `server/src/services/message-router.ts`:
- `handleIncomingMessage()` signature adds optional `processingCtx?: { messageId?: number; cancelTyping?: () => void }`
- The `NormalizedMessage` type gains an optional `processingMessageId?: number` field
- During tool execution, if `processingMessageId` exists, call `editProcessingMessage()` with the tool-specific status text
- After final response is generated, call `replaceWithFinalResponse()` instead of `sendTelegramMessage()` if a processing message exists
- Fast-path commands (`/remind`, `/note`, etc.) → neither indicator (they're <700ms)

---

### 3. Dashboard Real-Time Sync

#### 3a. Agent Status Strip (already works, just needs wiring)

**File:** `src/components/AgentStatusStrip.tsx` — no changes needed.

The activity stream emits events during Telegram processing. AgentStatusStrip already subscribes to `/api/agent-state/stream` and maps states to labels:
- `thinking` → "Thinking..."
- `tool_call` → "Using tools..."
- `responding` → "Responding..."
- `done` → "Done"

**Only change needed:** Emit these events from `message-router.ts` (currently only emitted from `agent.ts` web chat route).

#### 3b. Chat Panel Live Mirror

**Files:** `src/components/AgentChatPanel.tsx`, `server/src/routes/agent-state.ts`

When a Telegram message arrives and is processed:
1. Activity stream emits `message_in` event with the user's message content
2. Activity stream emits `message_out` event with the bot's response
3. Chat panel subscribes to these events and renders them in the conversation

**New SSE event types on the stream:**
```typescript
// message_in: user sent a message via Telegram
{ type: 'message_in', channel: 'telegram', summary: 'What meetings do I have?', agentId: 'weebo' }

// message_out: agent responded
{ type: 'message_out', channel: 'telegram', summary: 'Here are your meetings...', agentId: 'weebo' }
```

**Chat panel changes:**
- Listen for `message_in` and `message_out` events on the SSE stream
- Append to the chat history with a small "via Telegram" badge
- Use existing message bubble components (no new UI needed)
- Only show messages for the currently active agent (filter by `agentId`)

---

### 4. Office Page Animations

**Files:** `src/dashboard/pages/office/OfficeStage.tsx`, `src/dashboard/pages/office/OfficeCanvasRenderer.ts`

Three visual effects when an agent is actively processing:

#### 4a. Glow Effect

When agent state changes to `thinking`/`tool_call`/`responding`:
- Draw a subtle pulsing glow around the agent sprite
- Color: `#00F0FF` (accent cyan) at 30% opacity, pulsing between 20-40%
- Uses the existing `fillRect` low-opacity approach already in `drawAgent` (line 138-141 of OfficeCanvasRenderer.ts) — do NOT add `shadowBlur`/`shadowColor` as it's expensive at 60fps across 9 agents and would double-glow with the existing effect
- Extend the existing active-agent glow to pulse via a `sin(timestamp)` alpha oscillation
- Fades out over 500ms when state returns to `idle`/`done`

#### 4b. Walk to Desk

When agent receives a task:
- Agent pathfinds to their assigned desk position (each agent has a desk in the office layout)
- Uses existing BFS pathfinding from Session 6
- On arrival, agent switches to a "sitting" frame (or faces the desk)
- Stays at desk while processing, returns to wandering when done

**Data:** Add a `deskPosition: {x, y}` field to each agent's config in the office data. The Office page already has furniture positions — desks are already rendered, we just need to map agents to them.

#### 4c. Thought/Status Bubble

While agent is at desk working:
- Small pixel-art bubble rendered above the sprite (offset y - 20px from sprite top)
- Use pre-rendered pixel-art icons (8x8 or 10x10 sprites) instead of Unicode emoji — emoji rendering via canvas `fillText` is inconsistent across browsers/OS. Create a small bubble sprite sheet with icons for: thought, search, write, chat, generic
- Content changes based on state:
  - `thinking` → thought cloud icon
  - `tool_call` → magnifying glass (search) / pencil (write) / lightning (generic)
  - `responding` → speech bubble icon
- Bubble has a subtle float animation (y oscillates +/- 2px)
- Disappears when agent goes idle

**Implementation:** Add a `renderBubble(ctx, agent, state)` function to `OfficeCanvasRenderer.ts`. Create a `bubble-icons.png` sprite sheet (consistent with existing pixel-art style). Called in the main render loop when agent has an active state.

#### 4d. Event Flow

Office page already polls `/api/office/state` every 2 seconds. The response already includes `recentEvents`. With the activity stream now emitting events during Telegram processing, the Office page will automatically pick them up and can:
1. Match event `agentId` to an office agent sprite
2. Trigger glow, walk-to-desk, and bubble based on event `type`
3. Clear effects when `done`/`idle` event arrives

No change to the polling mechanism needed — just add event handling logic in `OfficeStage.tsx`.

---

### 5. Bug Fixes

#### 5a. Reminder Time Parsing — "in 10 minutes"

**Files:** `server/src/services/message-router.ts` (fast-path `parseReminderIntent` at ~line 490), `server/src/services/action-executor.ts` (where parsed time text gets converted to absolute datetime)

**Bug:** "in 10 minutes" sets reminder 1 hour later instead of 10 minutes.
**Root cause:** The regex in `parseReminderIntent()` correctly captures `"10 minutes"` from `"in 10 minutes"`. The bug is likely in the downstream time conversion in `action-executor.ts` where the captured relative time string gets converted to an absolute datetime — debug the offset calculation there.
**Fix:** Trace the full path: `parseReminderIntent()` → `executeAction('create_reminder', ...)` → time conversion. Verify with test cases: "in 5 minutes", "in 10 minutes", "in 1 hour", "in 30 minutes". Add unit tests for each.

#### 5b. Hinglish Time Parsing — "kal 9 baje"

**File:** `server/src/services/message-router.ts` (fast-path reminder handler, lines 508-528)

**Bug:** "Mujhe kal 9 baje remind karo ki doctor ko call karna hai" sets reminder for today +1 hour instead of tomorrow 9 AM.
**Root cause:** Hinglish time parsing partially exists — `yaad dila` patterns (lines 508-525) already support `kal`, `aaj`, `parso`, `subah`, `shaam`, and `baje`. However, the `remind karo` pattern (line 528) does NOT parse `kal 9 baje` as a compound time expression. The specific pattern "Mujhe kal 9 baje remind karo ki..." falls through to the generic reminder handler which ignores the Hinglish time words.
**Fix:** Extend the `remind karo` pattern to also extract Hinglish time expressions. Reuse the same time-parsing logic from the `yaad dila` handler. Consider consolidating into one shared `parseHinglishTime()` utility.

#### 5c. Expense Currency Detection — "rupees"

**File:** `server/src/services/message-router.ts` (fast-path `parseExpenseIntent` at ~line 369)

**Bug:** "spent 450 rupees on lunch" logs as USD 450 / category "other".
**Root cause:** Two issues: (1) The regex at line 369 already matches `rupay?|rs\.?|rupees?` in the amount portion but the function returns `{ amount, description, category }` with **no `currency` field** — it's not that currency isn't detected, it's that the field doesn't exist in the return type. (2) Category mapping for "lunch" → "food" is missing.
**Fix:**
- Add `currency` field to `parseExpenseIntent()` return type: detect `rupees|rs|inr|₹` → `'INR'`, `dollars|\$|usd` → `'USD'`, default to `'INR'` for users with timezone `Asia/Kolkata`
- Thread `currency` through `executeAction('add_expense', ...)` to store in DB
- Category mapping: `lunch|dinner|breakfast|food|snack|biryani|chai|coffee` → "food", `uber|ola|auto|metro|bus|train|flight` → "transport", `swiggy|zomato` → "food"

#### 5d. /office Route Redirect

**File:** `src/App.tsx` (top-level route definitions)

**Bug:** `/office` redirects to `/dashboard` instead of `/dashboard/office`.
**Fix:** Add a `<Navigate from="/office" to="/dashboard/office" replace />` route in `App.tsx`.

---

### 6. Code Cleanup

While touching these files:

- **Delete `agent-state-bus.ts`** after migrating to activity-stream.ts
- **Clean up `sendTelegramTyping()`** — currently fire-and-forget with no error handling. Make it return a cancel function for the typing loop.
- **Remove duplicate SSE heartbeat logic** — agent-state.ts has its own heartbeat; activity-stream should own this.
- **Consolidate event types** — the old bus has string literals scattered across files. New activity stream uses a single `ActivityEventType` union exported from one place.

---

## Files Touched

### New Files
- `server/src/services/activity-stream.ts` — unified activity stream (replaces agent-state-bus)

### New Assets
- `public/assets/office/bubble-icons.png` — pixel-art bubble icon sprite sheet (thought, search, pencil, chat, lightning)

### Modified Files (Backend — 10 files)
- `server/src/services/message-router.ts` — emit activity events during Telegram processing, fix reminder/expense/Hinglish bugs
- `server/src/services/telegram.ts` — typing loop, edit-in-place processing messages, replaceWithFinalResponse
- `server/src/services/action-executor.ts` — fix reminder time offset calculation, thread expense currency
- `server/src/services/react-loop.ts` — migrate emitThinking/emitToolCall/etc. to activityStream.emit()
- `server/src/services/agent-comms.ts` — migrate broadcastAgentState to activityStream.emit()
- `server/src/services/multi-agent-orchestrator.ts` — migrate emit calls to activityStream.emit()
- `server/src/services/unified-agent-router.ts` — migrate emit calls to activityStream.emit()
- `server/src/routes/webhooks.ts` — send processing message, pass messageId through pipeline
- `server/src/routes/agent-state.ts` — use activity-stream instead of agent-state-bus
- `server/src/routes/agent.ts` — migrate web chat to activity-stream

### Modified Files (Frontend — 4 files)
- `src/components/AgentChatPanel.tsx` — subscribe to message_in/message_out events, show "via Telegram" badge
- `src/dashboard/pages/office/OfficeStage.tsx` — handle activity events for glow/walk/bubble animations
- `src/dashboard/pages/office/OfficeCanvasRenderer.ts` — glow pulse, bubble rendering, desk-sit frame
- `src/App.tsx` — /office → /dashboard/office redirect

### Deprecated Files (kept as re-export wrapper for rollback safety)
- `server/src/services/agent-state-bus.ts` — thin wrapper delegating to activity-stream.ts, delete after 1 week stable

---

## Testing

### Unit Tests (new, required)
- `activity-stream.test.ts` — event buffering, TTL expiry, SSE broadcast, `getRecentEvents()`, backward-compat field population
- Reminder time parsing — "in 5 minutes", "in 10 minutes", "in 1 hour", "in 30 minutes"
- Hinglish time parsing — "kal 9 baje", "parso subah 8 baje", "aaj shaam 6 baje"
- Expense currency — "450 rupees" → INR, "$50" → USD, "200 rs" → INR, default INR for Asia/Kolkata users
- Expense category — "lunch" → food, "uber" → transport, "swiggy" → food

### Integration Tests (manual via Telegram)
- Send simple question → verify typing indicator appears and persists until response
- Send tool-using request → verify "🧠 Thinking~" appears, edits to tool-specific status, edits to final response
- Send rapid messages → verify processing messages don't count against 20/60s rate limit
- Open dashboard while sending Telegram messages → verify agent status strip updates + chat panel mirrors conversation
- Open Office page while sending Telegram messages → verify agent glow, walk-to-desk, thought bubble
- Navigate to `/office` in browser → verify redirects to `/dashboard/office`
- "remind me in 10 minutes to drink water" → verify correct time (now + 10 min, not +1 hour)
- "Mujhe kal 9 baje remind karo ki doctor ko call karna hai" → verify tomorrow 9 AM
- "spent 450 rupees on lunch" → verify INR currency, food category

### Regression
- All 2518+ server tests must continue passing
- `npx tsc --noEmit` on both frontend and server — zero errors
- `npm run brand-guard` — clean

### Security Note
SSE message broadcast (`message_in`/`message_out`) only sends to authenticated SSE clients matching the user's JWT. No cross-user leakage. Message content in SSE events is truncated to 200 chars to limit exposure in case of session hijacking.
