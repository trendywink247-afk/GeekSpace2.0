# GeekSpace Connections Pipeline Audit

**Audit Date:** 2026-02-19
**Scope:** Incoming message/webhook → activity log → memory manager → reminders

## Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INCOMING MESSAGE PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────┘

1. TELEGRAM WEBHOOK ENTRY
   ┌──────────────────────────────────────────────────────────────────────┐
   │ POST /api/webhooks/telegram                                          │
   │ File: server/src/routes/webhooks.ts:37                               │
   │                                                                      │
   │ • Verifies X-Telegram-Bot-Api-Secret-Token                          │
   • Parses TelegramUpdate from req.body                                 │
   │ • Responds 200 immediately (Telegram requirement)                    │
   └────────────────────┬─────────────────────────────────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ COMMAND HANDLER (if bot command)                                     │
   │ File: server/src/routes/webhooks.ts:179-508                          │
   │                                                                      │
   │ • /start, /link, /unlink, /credits, /status                         │
   │ • /tasks, /agents, /cancel, /remind, /deploy                        │
   │ • Routes /remind to handleIncomingMessage()                          │
   └────────────────────┬─────────────────────────────────────────────────┘
                        │
                        ▼ (regular text messages)
   ┌──────────────────────────────────────────────────────────────────────┐
   │ MESSAGE NORMALIZATION                                                │
   │ File: server/src/services/telegram.ts:52-64                          │
   │ Function: parseTelegramUpdate()                                      │
   │                                                                      │
   │ Output: NormalizedMessage {                                          │
   │   channel: 'telegram',                                               │
   │   externalId: String(msg.chat.id),                                   │
   │   text: msg.text,                                                    │
   │   messageId: String(msg.message_id),                                 │
   │   senderName: 'First Last',                                          │
   │   timestamp: ISO8601                                                 │
   │ }                                                                    │
   └────────────────────┬─────────────────────────────────────────────────┘
                        │
                        ▼
2. MESSAGE ROUTER (Unified)
   ┌──────────────────────────────────────────────────────────────────────┐
   │ File: server/src/services/message-router.ts:128                      │
   │ Function: handleIncomingMessage()                                    │
   │                                                                      │
   │ STEP 1: Resolve User                                                 │
   │   • Query: channel_links WHERE channel='telegram' AND external_id=? │
   │   • Returns: userId, agentConfig, subscription                       │
   │   File: message-router.ts:79-95                                      │
   │                                                                      │
   │ STEP 2: Credit Check                                                 │
   │   • Check credits_remaining > 0                                     │
   │   File: message-router.ts:142-150                                    │
   │                                                                      │
   │ STEP 3: Update last_message_at                                       │
   │   File: message-router.ts:153-154                                    │
   │                                                                      │
   │ STEP 4: LOG USER MESSAGE (Activity Log)                              │
   │   • Function: logConversation(userId, 'user', msg.text)              │
   │   • Table: conversation_log                                          │
   │   File: server/src/services/memory.ts:120-130                        │
   │                                                                      │
   │ STEP 5: MEMORY EXTRACTION                                            │
   │   • Function: extractMemories(userId, msg.text)                      │
   │   • Pattern-based fact extraction (name, location, preferences)      │
   │   • File: server/src/services/memory.ts:194-208                      │
   │                                                                      │
   │ STEP 6: KEYWORD AUTOMATIONS                                          │
   │   • Function: checkKeywordTriggers()                                 │
   │   • File: server/src/services/automations-engine.ts                  │
   │                                                                      │
   │ STEP 7: TASK INTENT DETECTION                                        │
   │   • Function: detectTaskIntent()                                     │
   │   • Patterns: remind me, set reminder, send telegram, deploy         │
   │   • File: message-router.ts:27-41                                    │
   │                                                                      │
   │   IF TASK INTENT → PLAN TASKS                                        │
   │   • Function: planTasks() → parseSimpleTask() OR planWithKimi()     │
   │   • File: pico-fleet.ts:510-527                                      │
   │   • Output: PlannedTask[] with task_type='create_reminder'          │
   │                                                                      │
   │   • Function: queueTasks()                                           │
   │   • Inserts: pico_tasks table                                        │
   │   • File: pico-fleet.ts:531-556                                      │
   │                                                                      │
   │ STEP 8: LLM ROUTING (for non-task messages)                          │
   │   • Function: routeChat() OR bridgeChat()                           │
   │   • Logs assistant response: logConversation('assistant', reply)    │
   │   File: message-router.ts:200-308                                    │
   │                                                                      │
   │ STEP 9: USAGE LOGGING                                                │
   │   • Table: usage_events                                              │
   │   File: message-router.ts:295-299                                    │
   └────────────────────┬─────────────────────────────────────────────────┘
                        │
                        ▼
3. PICO FLEET WORKER (Async Task Execution)
   ┌──────────────────────────────────────────────────────────────────────┐
   │ File: server/src/services/pico-fleet.ts:603-638                      │
   │ Function: processNextTask() → executeTask()                         │
   │                                                                      │
   │ CREATE_REMINDER TASK HANDLER                                         │
   │ File: pico-fleet.ts:654-684                                          │
   │                                                                      │
   │ STEP 1: Parse reminder time                                          │
   │   • Function: parseReminderTime(text)                                │
   │   • Supports: "in 30 min", "at 5pm", "tomorrow"                      │
   │   • File: pico-fleet.ts:317-433                                      │
   │                                                                      │
   │ STEP 2: Insert into reminders table                                  │
   │   • Fields: id, user_id, text, datetime, channel, pico_task_id      │
   │   • Default channel: telegram (if linked) else push                 │
   │   File: pico-fleet.ts:664-665                                        │
   │                                                                      │
   │ STEP 3: CREATE MEMORY ENTRY                                          │
   │   • Function: upsertMemory(userId, 'reminder', key, JSON)           │
   │   • File: pico-fleet.ts:669-676                                      │
   │                                                                      │
   │ STEP 4: Update channel_links.last_message_at                         │
   │   File: pico-fleet.ts:679-681                                        │
   └────────────────────┬─────────────────────────────────────────────────┘
                        │
                        ▼
4. REMINDER SCHEDULER (Delivery)
   ┌──────────────────────────────────────────────────────────────────────┐
   │ File: server/src/services/reminder-scheduler.ts:33-41                │
   │ Runs: Every 30 seconds                                               │
   │                                                                      │
   │ STEP 1: Find due reminders                                           │
   │   • Query: reminders WHERE datetime <= NOW AND completed=0          │
   │   File: reminder-scheduler.ts:54-62                                  │
   │                                                                      │
   │ STEP 2: Deliver via channel                                          │
   │   • telegram: sendTelegramMessage()                                  │
   │   • push: (not implemented)                                          │
   │   File: reminder-scheduler.ts:90-118                                 │
   │                                                                      │
   │ STEP 3: Mark completed                                               │
   │   • UPDATE reminders SET completed=1                                 │
   │   File: reminder-scheduler.ts:73                                     │
   └──────────────────────────────────────────────────────────────────────┘
```

## Database Tables Involved

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `channel_links` | User-channel associations | user_id, channel, external_id, is_verified, last_message_at |
| `conversation_log` | Activity log | user_id, role, content, provider, model, created_at |
| `agent_memory` | Memory storage | user_id, category, key, value, confidence, source |
| `pico_tasks` | Task queue | user_id, agent_id, task_type, description, config, status |
| `reminders` | Reminder storage | user_id, text, datetime, channel, completed, pico_task_id |
| `usage_events` | Usage tracking | user_id, provider, model, tokens, cost, channel, tool |

## Code References by Hop

### Hop 1: Incoming Webhook
```typescript
// server/src/routes/webhooks.ts:37-78
webhooksRouter.post('/telegram', async (req, res) => {
  // Verify secret token
  // Parse TelegramUpdate
  // Handle commands OR
  // await handleIncomingMessage(normalized);
});
```

### Hop 2: Activity Log
```typescript
// server/src/services/memory.ts:120-130
export function logConversation(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  provider = '',
  model = '',
): void {
  db.prepare(
    'INSERT INTO conversation_log (id, user_id, role, content, provider, model) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuid(), userId, role, content, provider, model);
}
```

### Hop 3: Memory Manager
```typescript
// server/src/services/memory.ts:55-71
export function upsertMemory(
  userId: string,
  category: string,
  key: string,
  value: string,
  confidence = 1.0,
  source = 'observed',
): void {
  db.prepare(`
    INSERT INTO agent_memory (id, user_id, category, key, value, confidence, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, category, key)
    DO UPDATE SET value = excluded.value, ...
  `).run(uuid(), userId, category, key, value, confidence, source);
}
```

### Hop 4: Reminder Creation
```typescript
// server/src/services/pico-fleet.ts:654-684
case 'create_reminder': {
  const text = String(taskConfig.reminder_text || task.description);
  const dueAt = parseReminderTime(text);
  const channel = hasChannel ? 'telegram' : 'push';

  // Insert reminder
  db.prepare('INSERT INTO reminders (...) VALUES (...)')
    .run(reminderId, task.user_id, text, dueAt, channel, 'general', 'pico-fleet', task.id);

  // Create memory
  upsertMemory(task.user_id, 'reminder', `reminder_${reminderId}`, JSON.stringify({...}));
}
```

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/webhooks/telegram` | POST | Secret Token | Telegram bot webhook |
| `/api/webhooks/whatsapp` | POST | Signature | WhatsApp webhook |
| `/api/webhooks/n8n/callback` | POST | X-n8n-secret | n8n callback |

## Gaps Identified and Fixed

### 1. ✅ Request-id propagation (FIXED)
**Problem:** Each hop generated its own IDs, making tracing difficult across the pipeline.

**Fix:**
- Added `requestId` generation at webhook entry (`webhooks.ts:38`)
- Added `requestId` to `NormalizedMessage` interface (`message-router.ts:54`)
- Added `request_id` column to `conversation_log` table (`memory.ts:42`)
- Added `source_request_id` column to `pico_tasks` table (`pico-fleet.ts:107`)
- All logger calls now include `requestId` for traceability

**Code Changes:**
```typescript
// webhooks.ts - Generate at entry
const requestId = uuid();
await handleIncomingMessage({ ...normalized, requestId });

// message-router.ts - Pass through
logger.info({ requestId, channel, userId }, 'Processing incoming message');
logConversation(userId, 'user', content, requestId, provider, model);
queueTasks(userId, tasks, 'weebo', requestId);
```

### 2. ✅ Correlation between conversation_log and pico_tasks (FIXED)
**Problem:** No way to trace a reminder back to the original message.

**Fix:**
- `pico_tasks.source_request_id` stores the originating request ID
- `conversation_log.request_id` stores the same ID
- Join possible: `conversation_log.request_id = pico_tasks.source_request_id`

### 3. ✅ Activity logging for tasks (FIXED)
**Problem:** Task creation was not visible in the activity log.

**Fix:**
- Added explicit logging in `message-router.ts:185`
```typescript
logger.info({ requestId, taskCount: taskIds.length, taskIds }, 'Tasks queued from message router');
```
- Task execution logged in `pico-fleet.ts:551`
```typescript
logger.info({ taskId, userId, taskType, sourceRequestId }, 'Task queued');
```

### 4. ✅ Test harness (IMPLEMENTED)
**Problem:** No automated test for the full pipeline.

**Fix:**
- Created `server/src/test/pipeline-test.ts`
- Tests: Basic Message Flow, Reminder Intent Flow, Request ID Propagation
- Run with: `cd server && npm run build && node dist/test/pipeline-test.js`

## Test Results

```
Total: 6 | ✅ Passed: 6 | ❌ Failed: 0

--- Basic Message Flow ---
  ✅ PASS: Activity log entry created
  ✅ PASS: Memory entry created from message patterns

--- Reminder Intent Flow ---
  ✅ PASS: Activity log entry created
  ✅ PASS: Reminder created from task

--- Request ID Propagation ---
  ✅ PASS: Request ID propagated to conversation_log
  ✅ PASS: Request ID propagated to pico_tasks
```
