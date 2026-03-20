# Visual Feedback & Activity Stream Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time visual feedback across Telegram, dashboard, and Office page when agents process messages, plus fix 4 bugs found during testing.

**Architecture:** Replace the 381-line `agent-state-bus.ts` with a cleaner `activity-stream.ts` that all message pipelines (Telegram, web, automations) emit to. Wire Telegram webhook to send typing indicators and edit-in-place processing messages. Dashboard and Office page already subscribe to SSE — they just need the events to actually fire.

**Tech Stack:** Express + SSE, Telegram Bot API (`editMessageText`), Canvas 2D (pixel-art), Zustand, Redis (event pub/sub)

**Spec:** `docs/superpowers/specs/2026-03-20-visual-feedback-activity-stream-design.md`

---

## Phase 1: Foundation — Unified Activity Stream

### Task 1: Create activity-stream.ts with tests

**Files:**
- Create: `server/src/services/activity-stream.ts`
- Create: `server/src/test/services/activity-stream.test.ts`

This is the core service replacing `agent-state-bus.ts`. It must be backward-compatible with the existing SSE event format that `AgentStatusStrip` consumes.

- [ ] **Step 1: Write the test file**

```typescript
// server/src/test/services/activity-stream.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tests for:
// 1. emit() creates event with auto-populated backward-compat fields
// 2. Event buffer stores events and respects TTL/max limits
// 3. getRecentEvents() returns events within time window
// 4. SSE client registration and broadcast
// 5. Convenience emitters (emitThinking, emitDone, etc.) delegate to emit()
```

Key test cases:
```typescript
describe('ActivityStream', () => {
  describe('emit()', () => {
    it('should auto-populate state, agentName, content from type, agentId, summary');
    it('should buffer events per user up to MAX_BUFFER (100)');
    it('should expire events older than BUFFER_TTL (120s)');
    it('should broadcast to registered SSE clients');
  });

  describe('getRecentEvents()', () => {
    it('should return events within sinceMs window');
    it('should return empty array for unknown userId');
  });

  describe('backward compat', () => {
    it('emitThinking should emit type=thinking with state=thinking');
    it('emitToolCall should emit type=tool_call with tool in metadata');
    it('emitDone should emit type=done');
    it('agentName should map agentId to display name (weebo -> Weebo)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/test/services/activity-stream.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement activity-stream.ts**

Create `server/src/services/activity-stream.ts` with:

```typescript
// Core types
export type ActivityEventType =
  | 'idle' | 'thinking' | 'typing' | 'tool_call' | 'tool_result' | 'responding' | 'done'
  | 'message_in' | 'message_out'
  | 'task_started' | 'task_completed' | 'task_failed'
  | 'delegating' | 'comm_sent' | 'comm_received'
  | 'error';

export type ActivityChannel = 'telegram' | 'web' | 'automation' | 'proactive';

export interface ActivityEvent {
  id: string;
  userId: string;
  agentId: string;
  type: ActivityEventType;
  channel: ActivityChannel;
  summary: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  // Backward-compat for AgentStatusStrip
  state: ActivityEventType;
  agentName: string;
  content: string;
  // Legacy optional fields
  tool?: string;
  iteration?: number;
  targetAgent?: string;
  taskId?: string;
  commId?: string;
}

// PERSONALITY_NAMES map (from existing agent-state-bus.ts line 109)
const PERSONALITY_NAMES: Record<string, string> = {
  weebo: 'Weebo', edith: 'Edith', jarvis: 'Jarvis',
  aria: 'Aria', forge: 'Forge', pulse: 'Pulse',
  echo: 'Echo', cal: 'Cal', nova: 'Nova',
};

// Core functions:
// emit(partial) -> creates full ActivityEvent, buffers, broadcasts to SSE clients
// addStateClient(userId, res) -> register SSE response
// removeStateClient(userId, res) -> unregister
// getRecentEvents(userId, sinceMs) -> query buffer
// getAgentLastState(userId, agentId) -> latest state for agent
// getAllAgentStates(userId) -> all latest states
// getConnectedClientCount() -> number

// Convenience emitters (same signatures as old bus for easy migration):
// emitThinking(userId, agentId, content?, channel?)
// emitToolCall(userId, agentId, tool, content?, channel?)
// emitToolResult(userId, agentId, tool, content?, channel?)
// emitResponding(userId, agentId, content?, channel?)
// emitDone(userId, agentId, content?, channel?)
// emitIdle(userId, agentId, channel?)
// emitDelegation(userId, from, to, reason, channel?)
// emitCommSent(userId, from, to, message, commId?, channel?)
// emitCommReceived(userId, to, from, message, commId?, channel?)
// emitTaskStarted(userId, agentId, taskId, title, channel?)
// emitTaskCompleted(userId, agentId, taskId, title, channel?)
// emitTaskFailed(userId, agentId, taskId, error, channel?)

// Redis pub/sub (copy from existing):
// initRedisPubSub(), publishToRedis(), isRedisPubSubEnabled()
```

Port all logic from `agent-state-bus.ts` (381 lines). Key differences:
- All convenience emitters accept optional `channel` param (defaults to `'web'`)
- `emit()` auto-populates `state = type`, `agentName = PERSONALITY_NAMES[agentId]`, `content = summary`
- Event buffer logic identical (100 events/user, 120s TTL)

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd server && npx vitest run src/test/services/activity-stream.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5`
Expected: 2518+ tests passing (no regressions)

- [ ] **Step 6: Commit**

```bash
git add server/src/services/activity-stream.ts server/src/test/services/activity-stream.test.ts
git commit -m "feat: add unified activity-stream service (replaces agent-state-bus)"
```

---

### Task 2: Create agent-state-bus.ts re-export wrapper

**Files:**
- Modify: `server/src/services/agent-state-bus.ts`

Convert the existing 381-line file into a thin re-export wrapper that delegates to `activity-stream.ts`. This ensures all existing imports keep working during migration.

- [ ] **Step 1: Back up the original file**

```bash
cp server/src/services/agent-state-bus.ts server/src/services/agent-state-bus.ts.bak
```

- [ ] **Step 2: Replace with re-export wrapper**

Replace entire file with:
```typescript
// DEPRECATED: This file is a compatibility wrapper.
// All new code should import from './activity-stream.js' directly.
// Will be removed after 1 week of stable production.

export {
  type ActivityEventType as AgentStateType,
  type ActivityEvent as AgentStateEvent,
  addStateClient, removeStateClient, broadcastAgentState,
  emitThinking, emitToolCall, emitToolResult, emitResponding,
  emitDone, emitIdle, emitDelegation, emitCommSent, emitCommReceived,
  emitTaskStarted, emitTaskCompleted, emitTaskFailed,
  initRedisPubSub, publishToRedis, isRedisPubSubEnabled,
  getConnectedClientCount, getAgentLastState, getAllAgentStates, getRecentEvents,
} from './activity-stream.js';
```

Note: `broadcastAgentState` needs to be added to `activity-stream.ts` as an alias for `emit()` that accepts the old event shape.

- [ ] **Step 3: Run full test suite**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5`
Expected: 2518+ tests passing (all existing imports still work)

- [ ] **Step 4: TypeScript check**

Run: `cd server && npx tsc --noEmit 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add server/src/services/agent-state-bus.ts server/src/services/activity-stream.ts
git commit -m "refactor: convert agent-state-bus to thin wrapper over activity-stream"
```

---

### Task 3: Migrate call sites to activity-stream (8 files + 3 dynamic imports)

**Files:**
- Modify: `server/src/services/message-router.ts` (line 36 static import + dynamic imports at lines ~1357, ~1853, ~1858)
- Modify: `server/src/services/react-loop.ts` (imports)
- Modify: `server/src/services/agent-comms.ts` (imports)
- Modify: `server/src/services/multi-agent-orchestrator.ts` (imports)
- Modify: `server/src/services/unified-agent-router.ts` (imports)
- Modify: `server/src/routes/agent.ts` (line 30 import)
- Modify: `server/src/routes/agent-state.ts` (imports: `addStateClient`, `removeStateClient`, `getAllAgentStates`, `isRedisPubSubEnabled`, `getConnectedClientCount`)
- Modify: `server/src/routes/office.ts` (imports: `getAllAgentStates`, `getRecentEvents`)

- [ ] **Step 1: Update static imports in all 8 files**

For each file, change:
```typescript
// OLD
import { emitThinking, emitDone, ... } from '../services/agent-state-bus.js';
// NEW
import { emitThinking, emitDone, ... } from '../services/activity-stream.js';
```

Since the wrapper re-exports everything, both imports work — but we want direct imports for the long run.

- [ ] **Step 2: Update 3 dynamic imports in message-router.ts**

`message-router.ts` has 3 dynamic `import('./agent-state-bus.js')` calls that bypass the static import at line 36. The actual dynamic imports are:
```typescript
// Line ~1357 — delegation + cross-agent comms
const { emitDelegation, emitCommSent } = await import('./agent-state-bus.js');
// Line ~1853 — task lifecycle
const { emitTaskStarted: ets, emitTaskCompleted: etc } = await import('./agent-state-bus.js');
// Line ~1858 — comm sent
const { emitCommSent: ecs } = await import('./agent-state-bus.js');
```

Change ALL three to import from `./activity-stream.js`:
```typescript
const { emitDelegation, emitCommSent } = await import('./activity-stream.js');
const { emitTaskStarted: ets, emitTaskCompleted: etc } = await import('./activity-stream.js');
const { emitCommSent: ecs } = await import('./activity-stream.js');
```

Search for ALL occurrences of `import('./agent-state-bus` or `import("./agent-state-bus` in the file to ensure none are missed.

- [ ] **Step 3: Export `hasToolTrigger` and `detectTaskIntent` from message-router.ts**

These are currently private functions (NOT exported). They will be needed by Task 9 (webhooks.ts). Add `export` keyword:
```typescript
// OLD (~line 231)
function hasToolTrigger(text: string): boolean {
// NEW
export function hasToolTrigger(text: string): boolean {

// OLD (~line 638)
function detectTaskIntent(text: string): ... {
// NEW
export function detectTaskIntent(text: string): ... {
```

- [ ] **Step 4: Add channel parameter to emit calls in message-router.ts**

In `message-router.ts`, the existing `emitThinking`/`emitDone` calls need a channel param. Detect channel from `NormalizedMessage.channel`:
```typescript
const channel = msg.channel === 'telegram' ? 'telegram' : 'web';
emitThinking(userId, agentId, 'Processing request...', channel);
// ... later ...
emitDone(userId, agentId, 'Response sent', channel);
```

- [ ] **Step 5: Add channel parameter to react-loop.ts calls**

Pass channel through `ReactLoopOptions`:
```typescript
export interface ReactLoopOptions {
  // ... existing fields ...
  channel?: ActivityChannel;  // NEW
}
```

Update all 6 emit calls in react-loop.ts to pass `opts.channel || 'web'`.

- [ ] **Step 6: TypeScript check**

Run: `cd server && npx tsc --noEmit 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 7: Full test suite**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5`
Expected: 2518+ tests passing

- [ ] **Step 8: Commit**

```bash
git add server/src/services/message-router.ts server/src/services/react-loop.ts \
  server/src/services/agent-comms.ts server/src/services/multi-agent-orchestrator.ts \
  server/src/services/unified-agent-router.ts server/src/routes/agent.ts \
  server/src/routes/agent-state.ts server/src/routes/office.ts
git commit -m "refactor: migrate all 8 call sites + 3 dynamic imports from agent-state-bus to activity-stream"
```

---

### Task 3b: Consolidate SSE heartbeat into activity-stream

**Files:**
- Modify: `server/src/routes/agent-state.ts` (remove duplicate heartbeat logic)
- Modify: `server/src/services/activity-stream.ts` (own the heartbeat)

The spec (§6) says: "Remove duplicate SSE heartbeat logic — agent-state.ts has its own heartbeat; activity-stream should own this."

- [ ] **Step 1: Check current heartbeat in agent-state.ts**

Read `server/src/routes/agent-state.ts` — find the `setInterval` heartbeat (every 25s). This logic should move into `activity-stream.ts` so there's one heartbeat owner.

- [ ] **Step 2: Move heartbeat into activity-stream.ts**

In `activity-stream.ts`, when a client is registered via `addStateClient()`, start a 25s heartbeat interval that sends `:heartbeat\n\n` to the SSE response. Clear the interval on `removeStateClient()`.

- [ ] **Step 3: Remove heartbeat from agent-state.ts**

Remove the `setInterval` heartbeat in `agent-state.ts`. The route should only call `addStateClient()`/`removeStateClient()` — heartbeat is now activity-stream's responsibility.

- [ ] **Step 4: TypeScript check + tests**

Run: `cd server && npx tsc --noEmit && npm test -- --reporter=dot 2>&1 | tail -5`
Expected: 0 errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/agent-state.ts server/src/services/activity-stream.ts
git commit -m "refactor: consolidate SSE heartbeat into activity-stream (remove duplicate from agent-state)"
```

---

## Phase 2: Bug Fixes

> **Parallelization note:** Tasks 4-7 are independent of each other and independent of Phase 1 (they don't touch activity-stream). If using subagent-driven-development, Tasks 4-7 can run in parallel with each other and with Phase 1 Tasks 1-3b, as long as message-router.ts edits from Task 3 are committed first (Task 3 modifies imports in message-router.ts, and Tasks 4-6 also modify message-router.ts).

### Task 4: Fix reminder time parsing ("in 10 minutes")

**Files:**
- Modify: `server/src/services/message-router.ts` (~line 490, `parseReminderIntent`)
- Modify: `server/src/services/action-executor.ts` (~line 422, `set_reminder` case)
- Test: existing reminder tests + new unit tests

- [ ] **Step 1: Debug the time conversion**

Read `message-router.ts` lines 471-544 (`parseReminderIntent`) and `action-executor.ts` lines 422-521 (`set_reminder`). Trace what happens with `"in 10 minutes"`:
1. `parseReminderIntent("remind me in 10 minutes to drink water")` → `{ text: "drink water", datetime: "in 10 minutes" }`
2. `executeAction('set_reminder', { text, datetime: "in 10 minutes" })` → time conversion in action-executor.ts lines 436-450

Find where `"in 10 minutes"` gets misinterpreted. Check `parseReminderTime()` from `pico-fleet.ts`.

- [ ] **Step 2: Write test for correct behavior**

Add test cases that verify "in N minutes" produces correct offsets.

- [ ] **Step 3: Fix the time conversion**

Apply fix based on debugging. Likely in `parseReminderTime()` or the timezone handling in action-executor.ts.

- [ ] **Step 4: Run tests**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5`
Expected: ALL PASS

- [ ] **Step 5: Verify via Telegram simulation**

```bash
curl -s -X POST http://localhost:3001/api/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: 657c66f5c38e3d8a7f45549147f11588" \
  -d '{"update_id":500000001,"message":{"message_id":5001,"from":{"id":5337185054,"is_bot":false,"first_name":"Aliya"},"chat":{"id":5337185054,"type":"private"},"date":'$(date +%s)',"text":"remind me in 10 minutes to stretch"}}'
```

Then check: `SELECT text, datetime, created_at FROM reminders WHERE user_id='6813ac58-98fc-438b-88bb-4a8ef96fda53' ORDER BY created_at DESC LIMIT 1`

Verify datetime is ~10 minutes after created_at (not 1 hour).

- [ ] **Step 6: Commit**

```bash
git add server/src/services/message-router.ts server/src/services/action-executor.ts \
  server/src/test/services/reminder-time.test.ts
git commit -m "fix: reminder 'in N minutes' time offset calculation"
```

Note: Adjust file list based on which files were actually modified during debugging.

---

### Task 5: Fix Hinglish time parsing ("kal 9 baje")

**Files:**
- Modify: `server/src/services/message-router.ts` (lines 508-544, reminder fast-path)

- [ ] **Step 1: Read existing Hinglish patterns**

Read lines 508-544 of `message-router.ts`. The `yaad dila` pattern (508-525) already handles `kal/aaj/parso + baje`. The `remind karo` pattern (line 528) does NOT parse compound Hinglish time.

- [ ] **Step 2: Write test cases**

Test: "Mujhe kal 9 baje remind karo ki doctor ko call karna hai"
Expected: `{ text: "doctor ko call karna hai", datetime: "tomorrow 9:00 AM" }`

Test: "parso subah 8 baje yaad dila dena meeting hai"
Expected: `{ text: "meeting hai", datetime: "day after tomorrow 8:00 AM" }`

- [ ] **Step 3: Consolidate Hinglish time parsing**

Create a shared `parseHinglishTime(text)` utility that extracts:
- `kal` → tomorrow, `parso` → day after, `aaj` → today
- `N baje` → N o'clock
- `subah` → AM, `dopahar/shaam` → PM, `raat` → PM (night)

Apply to both `yaad dila` and `remind karo` patterns.

- [ ] **Step 4: Run tests + TypeScript check**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5 && npx tsc --noEmit`

- [ ] **Step 5: Verify via Telegram**

Send: "Mujhe kal 9 baje remind karo ki doctor ko call karna hai"
Verify reminder datetime is tomorrow 9:00 AM in user's timezone.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/message-router.ts
git commit -m "fix: Hinglish reminder parsing for 'kal N baje' compound expressions"
```

---

### Task 6: Fix expense currency detection ("rupees" -> INR)

**Files:**
- Modify: `server/src/services/message-router.ts` (~line 369, `parseExpenseIntent`)
- Modify: `server/src/services/action-executor.ts` (~line 1417, `track_expense`)

- [ ] **Step 1: Add currency field to parseExpenseIntent return type**

Current return: `{ amount, description, category }`
New return: `{ amount, description, category, currency }`

Detection logic:
- `rupees|rs\.?|inr|₹` → `'INR'`
- `dollars?|\$|usd` → `'USD'`
- Default: `'INR'` (for India-first product)

- [ ] **Step 2: Add missing category mappings**

In `guessCategory()` (~line 432), the food pattern already has `food|biryani|chai|restaurant|cafe`. The transport pattern already has `uber|ola|auto|bus|train|metro|petrol|diesel`. Only add what's genuinely missing:
- Add to food regex: `lunch|dinner|breakfast|snack|dosa|idli|thali|coffee` (these are NOT in the existing pattern)
- Transport regex is already complete — no changes needed

- [ ] **Step 3: Thread currency through action-executor.ts**

In the `track_expense` case (~line 1417), pass `currency` to the DB insert.

- [ ] **Step 4: Write tests + run**

Test: `parseExpenseIntent("spent 450 rupees on lunch")` → `{ amount: 450, currency: 'INR', category: 'food', description: 'lunch' }`

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5`

- [ ] **Step 5: Verify via Telegram**

Send: "spent 450 rupees on lunch today"
Check DB: `SELECT amount, currency, category FROM expenses WHERE user_id='...' ORDER BY created_at DESC LIMIT 1`
Expected: amount=450, currency=INR, category=food

- [ ] **Step 6: Commit**

```bash
git add server/src/services/message-router.ts server/src/services/action-executor.ts
git commit -m "fix: expense currency detection (rupees->INR) and category mapping (lunch->food)"
```

---

### Task 7: Fix /office route redirect

**Files:**
- Modify: `src/App.tsx` (line ~39-76, route definitions)

- [ ] **Step 1: Add redirect route**

In `App.tsx`, add before the catch-all route:
```tsx
<Route path="/office" element={<Navigate to="/dashboard/office" replace />} />
```

- [ ] **Step 2: TypeScript check + build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix: /office redirects to /dashboard/office"
```

---

## Phase 3: Telegram Visual Feedback

### Task 8: Add typing loop and processing message functions to telegram.ts

**Files:**
- Modify: `server/src/services/telegram.ts`
- Test: `server/src/test/services/telegram-visual.test.ts`

- [ ] **Step 1: Write tests**

```typescript
describe('Telegram Visual Feedback', () => {
  describe('startTypingLoop', () => {
    it('should call sendChatAction every 4 seconds');
    it('should stop when cancel is called');
  });
  describe('sendProcessingMessage', () => {
    it('should send message and return messageId');
  });
  describe('editProcessingMessage', () => {
    it('should call editMessageText with no parse_mode');
    it('should respect 1s minimum interval between edits');
  });
  describe('replaceWithFinalResponse', () => {
    it('should edit message with sanitized text');
    it('should fall back to send+delete when response has inline keyboard');
  });
});
```

- [ ] **Step 2: Export `sanitizeForTelegram` (currently private)**

`sanitizeForTelegram()` at ~line 111 is currently a private function (no `export` keyword). Add `export`:
```typescript
// OLD (~line 111)
function sanitizeForTelegram(text: string): string {
// NEW
export function sanitizeForTelegram(text: string): string {
```

- [ ] **Step 3: Extend `editTelegramMessage` to accept `null` parseMode**

The existing `editTelegramMessage()` at ~line 218 has this 5-param signature:
```typescript
// EXISTING (do NOT change existing params or drop replyMarkup)
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
): Promise<boolean>
```

Extend the `parseMode` type to also accept `null` (to omit parse_mode for plain text processing messages):
```typescript
// UPDATED — only change is adding | null to parseMode type
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode: 'Markdown' | 'HTML' | null = 'Markdown',
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
): Promise<boolean>
```

In the function body, change how `parse_mode` is set:
```typescript
// OLD (line 231)
parse_mode: parseMode,
// NEW — only include parse_mode if not null
...(parseMode !== null ? { parse_mode: parseMode } : {}),
```

- [ ] **Step 4: Implement new functions**

Add to `telegram.ts`:

```typescript
// Typing loop — returns cancel function
export function startTypingLoop(chatId: string | number): () => void {
  sendTelegramTyping(chatId);
  const interval = setInterval(() => sendTelegramTyping(chatId), 4000);
  return () => clearInterval(interval);
}

// Processing message — send initial "Thinking~" message (plain text, no parse_mode)
// NOTE: Cannot use sendTelegramMessage() here because it applies sanitizeForTelegram()
// and parse_mode:'Markdown' which would mangle the emoji/processing text.
// Use the Telegram API directly for plain text processing messages.
export async function sendProcessingMessage(
  chatId: string | number, text: string
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        // No parse_mode — plain text
        signal: AbortSignal.timeout(5000),
      }
    );
    const data = await resp.json();
    return data.ok ? data.result.message_id : null;
  } catch {
    return null;
  }
}

// Edit processing message — throttled to 1s, no parse_mode (plain text)
const lastEditTime = new Map<string, number>();
export async function editProcessingMessage(
  chatId: string | number, messageId: number, text: string
): Promise<boolean> {
  const key = `${chatId}:${messageId}`;
  const now = Date.now();
  const last = lastEditTime.get(key) || 0;
  if (now - last < 1000) return false; // throttle
  lastEditTime.set(key, now);
  // Pass null parseMode — processing messages are plain text
  return editTelegramMessage(chatId, messageId, text, null);
}

// Delete message — POST /deleteMessage
export async function deleteTelegramMessage(
  chatId: string | number, messageId: number
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/deleteMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        signal: AbortSignal.timeout(5000),
      }
    );
    const data = await resp.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// Replace with final response — edit or send+delete for keyboards
export async function replaceWithFinalResponse(
  chatId: string | number,
  messageId: number,
  finalText: string,
  replyMarkup?: { inline_keyboard: any[][] }
): Promise<{ messageId: number; success: boolean }> {
  const sanitized = sanitizeForTelegram(finalText);
  if (replyMarkup) {
    // Can't edit to add inline keyboard — send new + delete old
    const result = await sendTelegramButtons(chatId, sanitized, replyMarkup.inline_keyboard);
    await deleteTelegramMessage(chatId, messageId).catch(() => {});
    return result;
  }
  // Final response uses Markdown parse_mode (default)
  const success = await editTelegramMessage(chatId, messageId, sanitized);
  return { messageId, success };
}
```

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run src/test/services/telegram-visual.test.ts`

- [ ] **Step 6: Full test suite + TypeScript**

Run: `cd server && npm test -- --reporter=dot 2>&1 | tail -5 && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add server/src/services/telegram.ts server/src/test/services/telegram-visual.test.ts
git commit -m "feat: add typing loop, processing messages, and edit-in-place to telegram.ts"
```

---

### Task 9: Wire webhooks.ts to detect tool intent and send processing messages

**Files:**
- Modify: `server/src/routes/webhooks.ts` (Telegram webhook handler, ~line 60-100)
- Modify: `server/src/services/message-router.ts` (`handleIncomingMessage` signature)

- [ ] **Step 1: Import new functions in webhooks.ts**

```typescript
import { startTypingLoop, sendProcessingMessage } from '../services/telegram.js';
// hasToolTrigger and detectTaskIntent were exported in Task 3
import { hasToolTrigger, detectTaskIntent } from '../services/message-router.js';
```

- [ ] **Step 2: Add processing context before handleIncomingMessage call**

After the rate limit check and before `handleIncomingMessage(msg)`:

```typescript
// Determine if this message will likely use tools
const text = update.message?.text || '';
const willUseTool = hasToolTrigger(text) || detectTaskIntent(text);
const isFastPath = text.startsWith('/'); // slash commands are instant

let processingCtx: { messageId?: number; cancelTyping?: () => void } = {};

if (!isFastPath && willUseTool) {
  const msgId = await sendProcessingMessage(chatId, '🧠 Thinking~');
  if (msgId) processingCtx.messageId = msgId;
} else if (!isFastPath) {
  processingCtx.cancelTyping = startTypingLoop(chatId);
}

// Pass context to handler
await handleIncomingMessage(msg, processingCtx);
```

- [ ] **Step 3: Extend handleIncomingMessage signature**

In `message-router.ts`, update:
```typescript
export interface ProcessingContext {
  messageId?: number;
  cancelTyping?: () => void;
}

export async function handleIncomingMessage(
  msg: NormalizedMessage,
  processingCtx?: ProcessingContext
): Promise<void>
```

Thread `processingCtx` through the function. At the end of processing (where response is sent), call `processingCtx?.cancelTyping?.()`.

- [ ] **Step 4: TypeScript check + tests**

Run: `cd server && npx tsc --noEmit && npm test -- --reporter=dot 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/webhooks.ts server/src/services/message-router.ts
git commit -m "feat: wire webhook to send typing/processing indicators before message handling"
```

---

### Task 10: Edit processing message during tool execution

**Files:**
- Modify: `server/src/services/message-router.ts` (tool execution section)
- Modify: `server/src/services/react-loop.ts` (tool call callback)

- [ ] **Step 1: Define tool-to-status mapping**

In `message-router.ts`, add:
```typescript
const TOOL_STATUS_MAP: Record<string, string> = {
  web_search: '🔍 Searching the web~',
  browse_url: '🌐 Reading that page~',
  check_calendar: '📅 Checking your calendar~',
  send_email: '📧 Drafting your email~',
  track_expense: '💳 Logging expense~',
  set_reminder: '⏰ Setting reminder~',
  create_memory: '🧠 Remembering that~',
  generate_code: '💻 Writing code~',
  take_screenshot: '📸 Taking screenshot~',
};
```

- [ ] **Step 2: Pass processingCtx into react-loop**

Add `processingMessageId?: number` and `processingChatId?: string` to `ReactLoopOptions`.

In the `onStep` callback or after each tool execution in react-loop.ts, if `processingMessageId` exists:
```typescript
const statusText = TOOL_STATUS_MAP[toolName] || '⚡ Working on it~';
await editProcessingMessage(processingChatId, processingMessageId, statusText);
```

- [ ] **Step 3: Replace final response with edit**

At the end of message-router.ts where the Telegram response is sent, if `processingCtx?.messageId` exists:
```typescript
await replaceWithFinalResponse(chatId, processingCtx.messageId, finalReply, replyMarkup);
processingCtx.cancelTyping?.();
```
Instead of `sendTelegramMessage(chatId, finalReply)`.

- [ ] **Step 4: TypeScript check + tests**

Run: `cd server && npx tsc --noEmit && npm test -- --reporter=dot 2>&1 | tail -5`

- [ ] **Step 5: Integration test via Telegram**

Send: "What meetings do I have this week?"
Expected: See "🧠 Thinking~" → "📅 Checking your calendar~" → final response (all in same message via edits)

Send: "What is the capital of France?"
Expected: See typing indicator (no processing message), then response as new message

- [ ] **Step 6: Commit**

```bash
git add server/src/services/message-router.ts server/src/services/react-loop.ts
git commit -m "feat: edit-in-place processing messages during Telegram tool execution"
```

---

## Phase 4: Dashboard Real-Time Sync

### Task 11: Emit message_in/message_out events from Telegram pipeline

**Files:**
- Modify: `server/src/services/message-router.ts`

- [ ] **Step 1: Emit message_in at start of Telegram processing**

After user resolution in `handleIncomingMessage()`, when `channel === 'telegram'`:
```typescript
import { emit } from './activity-stream.js';

// Emit message_in
emit({
  userId, agentId: detectedAgent || 'weebo',
  type: 'message_in', channel: 'telegram',
  summary: msg.text.slice(0, 200), // truncate for security
});
```

Note: `emit()` is a standalone exported function, not a method on an object. All other convenience emitters (`emitThinking`, `emitDone`, etc.) are also standalone exports — the same pattern used throughout the codebase.

- [ ] **Step 2: Emit message_out when response is sent**

After sending the Telegram response:
```typescript
emit({
  userId, agentId: detectedAgent || 'weebo',
  type: 'message_out', channel: 'telegram',
  summary: finalReply.slice(0, 200),
});
```

- [ ] **Step 3: Test by opening dashboard SSE**

Open two terminals:
```bash
# Terminal 1: Watch SSE stream
curl -N -H "Authorization: Bearer <jwt>" http://localhost:3001/api/agent-state/stream

# Terminal 2: Send Telegram message
curl -X POST http://localhost:3001/api/webhooks/telegram ...
```

Verify Terminal 1 receives `message_in` and `message_out` events.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/message-router.ts
git commit -m "feat: emit message_in/message_out activity events from Telegram pipeline"
```

---

### Task 12: Update AgentChatPanel to show Telegram messages live

**Files:**
- Modify: `src/components/AgentChatPanel.tsx`

- [ ] **Step 1: Subscribe to message_in/message_out SSE events**

The chat panel may already have an SSE subscription or can share the one from AgentStatusStrip. Add event handlers:

```typescript
// When receiving SSE event:
if (event.type === 'message_in' && event.channel === 'telegram') {
  // Append user message to chat history with "via Telegram" badge
  appendMessage({
    role: 'user',
    content: event.summary,
    source: 'telegram',
    timestamp: event.timestamp,
  });
}

if (event.type === 'message_out' && event.channel === 'telegram') {
  // Append assistant message with "via Telegram" badge
  appendMessage({
    role: 'assistant',
    content: event.summary,
    source: 'telegram',
    timestamp: event.timestamp,
  });
}
```

- [ ] **Step 2: Add "via Telegram" badge to message bubble**

Small badge next to the message timestamp:
```tsx
{msg.channel === 'telegram' && (
  <span className="text-[10px] text-cyan-400/60 ml-1">via Telegram</span>
)}
```

- [ ] **Step 3: TypeScript check + build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "feat: show Telegram messages live in dashboard chat panel"
```

---

## Phase 5: Office Page Animations

### Task 13: Add glow pulse effect to active agents

**Files:**
- Modify: `src/dashboard/pages/office/OfficeCanvasRenderer.ts` (~line 137, existing glow)

- [ ] **Step 1: Enhance existing glow with pulse**

Current code (line 137-141):
```typescript
if (agent.state !== 'idle') {
  ctx.fillStyle = hexToRgba(agent.color, 0.06);
  ctx.fillRect(cx - CELL, cy - CELL, CELL*2, CELL*2);
}
```

Replace with pulsing version (spec: 20-40% opacity range):
```typescript
if (agent.state !== 'idle') {
  // Pulse between 20% and 40% opacity using sin wave (per spec §4a)
  const pulseAlpha = 0.30 + 0.10 * Math.sin(Date.now() / 500);
  ctx.fillStyle = hexToRgba('#00F0FF', pulseAlpha);
  ctx.fillRect(cx - CELL, cy - CELL, CELL * 2, CELL * 2);
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/pages/office/OfficeCanvasRenderer.ts
git commit -m "feat: pulsing cyan glow on active agents in Office page"
```

---

### Task 14: Add walk-to-desk behavior when agent becomes active

**Files:**
- Modify: `src/dashboard/pages/office/OfficeStage.tsx`
- Reference: `src/dashboard/pages/office/constants.ts` (CORE_DESK_POSITIONS, SPECIALIST_POSITIONS)

- [ ] **Step 1: React to activity events in OfficeStage**

When an SSE event with `type === 'thinking'` arrives for an agent:
1. Set agent's target to their desk position from `CORE_DESK_POSITIONS` / `SPECIALIST_POSITIONS`
2. Agent pathfinds to desk using existing BFS
3. On arrival, agent stops wandering and stays at desk
4. When `type === 'done'` or `'idle'` arrives, resume random wandering

- [ ] **Step 2: Add "at desk" state tracking**

Add `atDesk: boolean` to the agent canvas state. When at desk:
- Agent faces the desk (direction = desk-facing)
- Uses typing animation frames (3-4) instead of idle frame

- [ ] **Step 3: TypeScript check + test visually**

Run: `npx tsc --noEmit`
Open Office page, send Telegram message, verify agent walks to desk.

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/pages/office/OfficeStage.tsx
git commit -m "feat: agents walk to desk when processing tasks"
```

---

### Task 15: Add thought/status bubble above active agents

**Files:**
- Modify: `src/dashboard/pages/office/OfficeCanvasRenderer.ts`
- Create: `public/assets/office/bubble-icons.png` (pixel-art sprite sheet)

- [ ] **Step 1: Create pixel-art bubble icons**

Create a simple 80x10 sprite sheet with 8 icons (10x10 each):
- 0: thought cloud (💭)
- 1: magnifying glass (🔍)
- 2: pencil (📝)
- 3: speech bubble (💬)
- 4: lightning bolt (⚡)
- 5: calendar (📅)
- 6: email (📧)
- 7: empty (padding)

Can use canvas to generate programmatically if no artist available.

- [ ] **Step 2: Add renderBubble function**

```typescript
function renderBubble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  state: string, tool?: string,
  tick: number
): void {
  // Floating animation
  const floatY = y - 20 + Math.sin(tick / 30) * 2;

  // Draw bubble background (white rounded rect, 16x16 scaled)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  roundRect(ctx, x - 8, floatY - 8, 16, 16, 4);
  ctx.fill();

  // Draw icon from sprite sheet based on state
  const iconIndex = getIconForState(state, tool);
  // drawImage from bubble-icons.png sprite sheet
}

function getIconForState(state: string, tool?: string): number {
  if (state === 'thinking') return 0;     // thought cloud
  if (state === 'tool_call') {
    if (tool?.includes('search')) return 1; // magnifying glass
    if (tool?.includes('email')) return 6;  // email
    if (tool?.includes('calendar')) return 5; // calendar
    return 4;                                // lightning (generic)
  }
  if (state === 'responding') return 3;    // speech bubble
  return 0;
}
```

- [ ] **Step 3: Call renderBubble in drawAgent when state is active**

After drawing the sprite, if `agent.state !== 'idle'`:
```typescript
renderBubble(ctx, drawX + DW/2, drawY, agent.state, agent.activeTool, tick);
```

- [ ] **Step 4: TypeScript check + visual test**

Run: `npx tsc --noEmit`
Open Office page, send Telegram message, verify bubble appears.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/pages/office/OfficeCanvasRenderer.ts public/assets/office/bubble-icons.png
git commit -m "feat: thought/status bubble above active agents in Office"
```

---

## Phase 6: Final Verification

### Task 16: Full integration test + deploy

- [ ] **Step 1: TypeScript check (both frontend and server)**

```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit && cd server && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Full test suite**

```bash
cd server && npm test -- --reporter=dot 2>&1 | tail -5
```
Expected: 2518+ tests passing

- [ ] **Step 3: Brand guard**

```bash
npm run brand-guard
```
Expected: Clean

- [ ] **Step 4: Build**

```bash
npm run build && cd server && npm run build
```
Expected: No errors

- [ ] **Step 5: Telegram integration test battery**

Run all tests from the testing session:
- `/start`, `/help`, `/remind`, `/note`, `/expenses`, `/habits`, `/focus`, `/brief`, `/search`, `/notes`, `/tasks`, `/memory`, `/agents`
- Natural language: "What is the capital of France?"
- Hinglish: "Mujhe kal 9 baje remind karo ki doctor ko call karna hai"
- Expense: "spent 450 rupees on lunch today"
- Calendar: "What meetings do I have this week?"
- Rate limit: 25 messages rapid-fire

Verify: typing indicators, processing messages, edit-in-place, correct time parsing, INR currency.

- [ ] **Step 6: Dashboard visual verification**

Open dashboard in browser while sending Telegram messages:
- Agent status strip shows Weebo "Thinking..." → "Using tools..." → "Done"
- Chat panel shows conversation in real-time with "via Telegram" badge

- [ ] **Step 7: Office page visual verification**

Open `/dashboard/office` while sending Telegram messages:
- Agent glows cyan
- Agent walks to desk
- Thought bubble appears above agent
- Effects clear when done

- [ ] **Step 8: Deploy**

```bash
cd ~/GeekSpace2.0
npm run build && cd server && npm run build
find /var/www/geekspace/assets/ -name "index-*" -not -name "*.css" -delete
cp -r dist/assets/* /var/www/geekspace/assets/ && cp dist/index.html /var/www/geekspace/index.html
docker compose up -d --build geekspace
curl localhost:3001/api/health
```

- [ ] **Step 9: Final commit + tag**

```bash
# Stage only the files modified during this final verification pass (if any)
# Do NOT use git add -A — explicitly list changed files
git status --short
# If there are changes from verification fixes:
# git add <specific-files>
# git commit -m "fix: final verification adjustments"
git tag -a "beast-visual-feedback" -m "Visual feedback: Telegram edit-in-place, dashboard sync, Office animations"
```
