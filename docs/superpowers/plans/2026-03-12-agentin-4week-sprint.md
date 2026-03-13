# Agentin 4-Week Sprint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 remaining reliability bugs, then build 5 agentic experiences (Week 2), 5 missing features (Week 3), and 4 scale/infra items (Week 4).

**Architecture:** Bugs are server-side micro-fixes. Agentic experiences extend existing Telegram pipeline (proactive-engine.ts, webhooks.ts, health.ts). Missing features add frontend pages + backend routes. Scale items extend SQLite with FTS5 + async job queue.

**Tech Stack:** Node.js / Express / TypeScript / SQLite / Redis / React 19 / Tailwind / Telegram Bot API / Groq / edge-tts

**NOTE:** The following Week 1 items from the audit are ALREADY FIXED in current code and should be skipped:
- ChatPage streaming (uses agentService.chatStream SSE)
- ChatPage history on mount (calls memoryService.conversations)
- MemoryManager Add/Edit UI (MemoryManagerPage.tsx has full dialog)
- Automation action config UI (message/reminder_text/webhookUrl fields exist)
- Privacy toggles (handlePrivacySave calls portfolioService.update)
- Image gallery table (GET /api/image/gallery already queries user_images)

---

## Chunk 1: Week 1 — 4 Remaining Reliability Fixes

### Task 1: Fix `allowed_updates` missing `callback_query` in Telegram webhook

**Files:**
- Modify: `server/src/services/telegram.ts:328`

- [ ] **Step 1: Make the fix**

In `telegram.ts`, find `allowed_updates: ['message']` and change to:
```typescript
allowed_updates: ['message', 'callback_query'],
```

- [ ] **Step 2: Rebuild + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/services/telegram.js geekspace-app:/app/server/dist/services/telegram.js
docker restart geekspace-app
```

- [ ] **Step 3: Verify**
```bash
curl -s "https://api.telegram.org/bot$(docker exec geekspace-app printenv TELEGRAM_BOT_TOKEN)/getWebhookInfo" | jq '.result.allowed_updates'
# Expected: ["message","callback_query"]
```

- [ ] **Step 4: Commit**
```bash
cd /root/GeekSpace2.0
git add server/src/services/telegram.ts
git commit -m "fix: add callback_query to Telegram webhook allowed_updates"
```

---

### Task 2: Fix `snooze_until` not set in reminder snooze callback

**Files:**
- Modify: `server/src/routes/webhooks.ts:146`

The snooze handler updates `datetime` and `scheduled_for` but NOT `snooze_until`. The column exists (added in Phase 13 migration). Fix: set `snooze_until` to the snoozed epoch.

- [ ] **Step 1: Make the fix**

In `webhooks.ts` around line 146, change:
```typescript
db.prepare("UPDATE reminders SET datetime = ?, scheduled_for = ? WHERE id = ? AND user_id = ?")
  .run(newDatetime, newScheduledFor, reminderId, link.user_id);
```
To:
```typescript
db.prepare("UPDATE reminders SET datetime = ?, scheduled_for = ?, snooze_until = ? WHERE id = ? AND user_id = ?")
  .run(newDatetime, newScheduledFor, newScheduledFor, reminderId, link.user_id);
```

- [ ] **Step 2: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/routes/webhooks.js geekspace-app:/app/server/dist/routes/webhooks.js
docker restart geekspace-app
```

- [ ] **Step 3: Commit**
```bash
git add server/src/routes/webhooks.ts
git commit -m "fix: set snooze_until column when reminder is snoozed via Telegram button"
```

---

### Task 3: Fix `create_automation` tool writing to wrong table

**Files:**
- Modify: `server/src/services/action-executor.ts:1201-1290` (the create_automation and list_workflows cases)

The `create_automation` case inserts into `user_workflows` but the Automations dashboard reads from `automations`. Change the INSERT to target `automations` table.

The `automations` schema: `id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled, run_count, last_run, created_at`

- [ ] **Step 1: Read the existing create_automation block**

Read `server/src/services/action-executor.ts` lines 1201-1290 to see the exact code.

- [ ] **Step 2: Replace the INSERT**

Change the INSERT from:
```typescript
INSERT INTO user_workflows (user_id, name, description, steps, trigger, enabled, created_at)
VALUES (?, ?, ?, ?, ?, 1, ...)
```
To target `automations` table:
```typescript
INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
```
Where:
- `trigger_type` = args.trigger_type || 'manual'
- `trigger_config` = JSON.stringify({ schedule: args.schedule, keyword: args.keyword })
- `action_type` = args.action_type || 'telegram-message'
- `action_config` = JSON.stringify({ message: args.message, ...args.action_config })

Also update the `list_workflows` case to query `automations` instead of `user_workflows` so the list command shows dashboard automations.

- [ ] **Step 3: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/services/action-executor.js geekspace-app:/app/server/dist/services/action-executor.js
docker restart geekspace-app
```

- [ ] **Step 4: Smoke test via curl**
```bash
# Check that automations table gets an entry after a "create automation" chat
sqlite3 /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
  "SELECT name, trigger_type, action_type FROM automations ORDER BY created_at DESC LIMIT 3;"
```

- [ ] **Step 5: Commit**
```bash
git add server/src/services/action-executor.ts
git commit -m "fix: create_automation tool now writes to automations table (not user_workflows)"
```

---

### Task 4: Add outer catch with Telegram fallback in message-router

**Files:**
- Modify: `server/src/services/message-router.ts`

`handleIncomingMessage` has no outer try/catch. If something unhandled throws (e.g. all 6 LLM providers fail), Aliya sees silence. Wrap the entire function body after user resolution in try/catch.

- [ ] **Step 1: Find the function structure**

Read `server/src/services/message-router.ts` lines 386-420 to understand the function start.

- [ ] **Step 2: Add outer try/catch**

After the credits check and before the main processing (around line 425), wrap the remaining function body in a try/catch:

```typescript
  try {
    // ... existing function body from this point ...
  } catch (err: unknown) {
    logger.error({ err: (err as Error).message, requestId, channel: msg.channel }, 'Unhandled error in handleIncomingMessage');
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: "Something went wrong on my end. Please try again in a moment.",
      replyToMessageId: msg.messageId,
    }).catch(() => { /* last-resort — don't throw */ });
  }
```

The challenge: the function is 776 lines long. The cleanest approach is to wrap from after the credits check (around line 425) to before the closing brace (line 1162).

- [ ] **Step 3: Build + test**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -10
# Check for TypeScript errors
```

- [ ] **Step 4: Hot-patch + verify**
```bash
docker cp dist/services/message-router.js geekspace-app:/app/server/dist/services/message-router.js
docker restart geekspace-app
docker logs geekspace-app --since 30s | grep "started\|error" | head -5
```

- [ ] **Step 5: Commit**
```bash
git add server/src/services/message-router.ts
git commit -m "fix: wrap handleIncomingMessage in outer try/catch with Telegram fallback on total failure"
```

---

### Task 5: Run tests + push Week 1

- [ ] **Step 1: Run server tests**
```bash
cd /root/GeekSpace2.0/server && npm test 2>&1 | tail -20
# All tests must pass
```

- [ ] **Step 2: Push to main**
```bash
cd /root/GeekSpace2.0
git push origin main
```

- [ ] **Step 3: Watch CI**
```bash
gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId')
```

- [ ] **Step 4: Sync to live-production after CI green**
```bash
git checkout live-production && git merge main --ff-only && git push origin live-production && git checkout main
```

- [ ] **Step 5: Docker rebuild**
```bash
cd /root/GeekSpace2.0 && docker compose up -d --build geekspace
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
```

---

## Chunk 2: Week 2 — 5 Agentic Experiences

### Task 6: Daily Operator Mode — morning voice briefing

**Files:**
- Modify: `server/src/services/proactive-engine.ts`
- Read: `server/src/services/voice.ts` (textToSpeech, sendTelegramVoice exports)

The `dailyBriefing()` function already builds briefing text and calls `sendTelegramMessage()`. Change it to also pipe through TTS → sendTelegramVoice for users who have voice enabled OR as default (send both text + voice note).

- [ ] **Step 1: Check voice.ts exports**
```bash
grep -n "export.*textToSpeech\|export.*sendTelegramVoice" /root/GeekSpace2.0/server/src/services/voice.ts | head -5
```

- [ ] **Step 2: Check dailyBriefing function in proactive-engine.ts**

Read `server/src/services/proactive-engine.ts`, find `dailyBriefing` function and understand how it sends the message.

- [ ] **Step 3: Import voice functions**

At top of `proactive-engine.ts`, add:
```typescript
import { textToSpeech, sendTelegramVoice } from './voice.js';
```
(or check if they're already imported)

- [ ] **Step 4: Add TTS after text send**

After the `sendTelegramMessage(chatId, briefingText)` call in `dailyBriefing`, add:
```typescript
// Send voice briefing — fire-and-forget so text delivery isn't blocked
textToSpeech(briefingText).then((audioBuffer) => {
  if (audioBuffer) {
    return sendTelegramVoice(chatId, audioBuffer);
  }
}).catch((e: unknown) => {
  logger.warn({ err: (e as Error).message, userId }, 'Voice briefing TTS failed — text sent OK');
});
```

- [ ] **Step 5: Build + hot-patch + restart**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/services/proactive-engine.js geekspace-app:/app/server/dist/services/proactive-engine.js
docker restart geekspace-app
```

- [ ] **Step 6: Manual test trigger**
```bash
# Trigger briefing manually to verify voice note is sent
curl -s -X POST http://localhost:3001/api/admin/trigger-briefing \
  -H "X-Admin-Token: $(grep ADMIN_TOKEN /root/GeekSpace2.0/.env | cut -d= -f2)" | jq .
# Or check logs for TTS activity
docker logs geekspace-app --since 2m | grep -i "briefing\|voice\|tts"
```

- [ ] **Step 7: Commit**
```bash
git add server/src/services/proactive-engine.ts
git commit -m "feat: Daily Operator Mode — morning briefing now sends voice note via edge-tts"
```

---

### Task 7: Habit Coach Mode — compassionate nudge + reschedule inline keyboard

**Files:**
- Modify: `server/src/services/proactive-engine.ts` (habit nudge function)
- Modify: `server/src/routes/webhooks.ts` (handle habit:reschedule callback)

Current habit nudge sends a generic push. Replace with named, compassionate message + inline keyboard: [Keep Going / Reschedule to Evening / Skip This Week].

- [ ] **Step 1: Find the habit nudge function**
```bash
grep -n "habit.*nudge\|habitNudge\|idle.*nudge" /root/GeekSpace2.0/server/src/services/proactive-engine.ts | head -10
```

- [ ] **Step 2: Read the nudge function**

Read the function body. It should call `getHabitInsights()` and send a message. Find the `sendTelegramMessage` call.

- [ ] **Step 3: Check sendTelegramButtons signature**
```bash
grep -n "sendTelegramButtons\|InlineKeyboard" /root/GeekSpace2.0/server/src/services/telegram.ts | head -10
```

- [ ] **Step 4: Replace generic nudge with targeted + compassionate message + buttons**

For each broken/at_risk habit (from `getHabitInsights()`), send:
```typescript
const nudgeText = `Hey! Noticed "${habit.name}" has been quiet lately. Life gets busy 💙\n\nWant to adjust the schedule?`;
await sendTelegramButtons(chatId, nudgeText, [
  [
    { text: '💪 Keep Going', callback_data: `habit:keep:${habit.id}` },
    { text: '🌙 Move to Evening', callback_data: `habit:reschedule:evening:${habit.id}` },
  ],
  [
    { text: '⏭️ Skip This Week', callback_data: `habit:skip_week:${habit.id}` },
  ],
]);
```

- [ ] **Step 5: Handle callbacks in webhooks.ts**

In the `callback_query` handler section, add:
```typescript
// ── Habit coach callbacks ──────────────────────────────────────────
if (callbackData.startsWith('habit:')) {
  const parts = callbackData.split(':');
  const action = parts[1]; // keep | reschedule | skip_week
  const habitId = parts[parts.length - 1];
  const link = db.prepare("SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?")
    .get(callbackChatId) as { user_id: string } | undefined;
  if (link && habitId) {
    if (action === 'keep') {
      await sendTelegramMessage(callbackChatId, "That's the spirit! I'll keep cheering you on 🎯");
    } else if (action === 'reschedule') {
      const timeSlot = parts[2]; // evening
      const newTime = timeSlot === 'evening' ? '20:00' : '09:00';
      db.prepare("UPDATE habits SET reminder_time = ? WHERE id = ? AND user_id = ?")
        .run(newTime, habitId, link.user_id);
      await sendTelegramMessage(callbackChatId, `Done! Moved to ${timeSlot} (${newTime}). See you then 🌙`);
    } else if (action === 'skip_week') {
      // Mark habit as skipped for 7 days using skip_until column (additive migration below)
      const skipUntil = Math.floor(Date.now() / 1000) + 604800; // +7 days in epoch seconds
      db.prepare("UPDATE habits SET skip_until = ? WHERE id = ? AND user_id = ?")
        .run(skipUntil, habitId, link.user_id);
      await sendTelegramMessage(callbackChatId, "No worries! Taking a week off. I'll check back in 7 days 🙏");
    }
  }
  await answerCallbackQuery(callbackQueryId, '');
  return;
}
```

- [ ] **Step 6: Check and add required columns in db/index.ts**
```bash
grep -n "reminder_time\|skip_until\|CREATE TABLE.*habits" /root/GeekSpace2.0/server/src/db/index.ts | head -10
```
Add additive migrations for both new columns (if not present):
```typescript
try { db.exec(`ALTER TABLE habits ADD COLUMN reminder_time TEXT DEFAULT '09:00'`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE habits ADD COLUMN skip_until INTEGER DEFAULT 0`); } catch { /* already exists */ }
```
The `skip_until` column stores epoch seconds (0 = not skipping). The habit nudge function should check `skip_until > unixepoch('now')` before sending a nudge.

- [ ] **Step 7: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/services/proactive-engine.js geekspace-app:/app/server/dist/services/proactive-engine.js
docker cp dist/routes/webhooks.js geekspace-app:/app/server/dist/routes/webhooks.js
docker restart geekspace-app
```

- [ ] **Step 8: Commit**
```bash
git add server/src/services/proactive-engine.ts server/src/routes/webhooks.ts server/src/db/index.ts
git commit -m "feat: Habit Coach Mode — compassionate nudge with reschedule/skip inline keyboard"
```

---

### Task 8: Smart Expense Categorizer — photo → auto-track

**Files:**
- Modify: `server/src/routes/webhooks.ts` (`handlePhotoMessage` function)

After vision analysis returns, check if the result mentions a price (₹/Rs/INR/rupees pattern + number). If yes, auto-trigger `track_expense` logic with extracted amount + merchant + category lookup.

- [ ] **Step 1: Find handlePhotoMessage in webhooks.ts**
```bash
grep -n "handlePhotoMessage\|photo.*message\|analysing.*image" /root/GeekSpace2.0/server/src/routes/webhooks.ts | head -10
```

- [ ] **Step 2: Read the function**

Read `server/src/routes/webhooks.ts` from the `handlePhotoMessage` definition to understand: where LLM vision analysis result is, and where the "Save/Dismiss" buttons are sent.

- [ ] **Step 3: Add expense extraction after vision analysis**

After getting `analysisResult` from Groq vision, add:
```typescript
// Auto-detect expense in image (bill, receipt, payment screenshot)
const priceMatch = analysisResult.match(/(?:₹|Rs\.?|INR|rupees?)\s*([0-9,]+(?:\.\d{1,2})?)/i)
  ?? analysisResult.match(/([0-9,]+(?:\.\d{1,2})?)\s*(?:₹|Rs\.?|INR|rupees?)/i);
if (priceMatch) {
  const amount = parseFloat(priceMatch[1].replace(/,/g, ''));
  // Detect merchant from analysis text
  const merchants: Record<string, string> = {
    swiggy: 'food', zomato: 'food', blinkit: 'groceries', zepto: 'groceries',
    amazon: 'shopping', flipkart: 'shopping', myntra: 'shopping',
    ola: 'transport', uber: 'transport', rapido: 'transport',
    netflix: 'entertainment', spotify: 'entertainment', hotstar: 'entertainment',
    airtel: 'utilities', jio: 'utilities', bsnl: 'utilities',
  };
  const analysisLower = analysisResult.toLowerCase();
  let category = 'other';
  let merchant = '';
  for (const [key, cat] of Object.entries(merchants)) {
    if (analysisLower.includes(key)) { category = cat; merchant = key; break; }
  }
  // Insert expense
  const userId = link.user_id;
  const expenseId = uuid();
  db.prepare(`
    INSERT INTO expenses (id, user_id, amount, category, description, merchant, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(expenseId, userId, amount, category, `Auto-detected from photo`, merchant || 'unknown');
  // Check budget
  const budget = db.prepare(`SELECT limit_amount FROM budget_limits WHERE user_id = ? AND category = ?`)
    .get(userId, category) as { limit_amount: number } | undefined;
  const monthSpent = db.prepare(`
    SELECT COALESCE(SUM(amount),0) as total FROM expenses
    WHERE user_id = ? AND category = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get(userId, category) as { total: number };
  let budgetMsg = '';
  if (budget && monthSpent.total >= budget.limit_amount * 0.9) {
    budgetMsg = `\n⚠️ You've spent ₹${monthSpent.total.toFixed(0)} of ₹${budget.limit_amount} ${category} budget this month.`;
  }
  // Append to existing response
  analysisWithExpense = `${analysisResult}\n\n✅ Auto-logged: ₹${amount} ${category}${merchant ? ` (${merchant})` : ''}${budgetMsg}`;
}
```

- [ ] **Step 4: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/routes/webhooks.js geekspace-app:/app/server/dist/routes/webhooks.js
docker restart geekspace-app
```

- [ ] **Step 5: Commit**
```bash
git add server/src/routes/webhooks.ts
git commit -m "feat: Smart Expense Categorizer — photo of receipt auto-logs expense via Groq vision"
```

---

### Task 9: Self-Healing Agent — Ollama state-change → Telegram alert

**Files:**
- Modify: `server/src/routes/health.ts`
- Read: existing health check logic to understand how Ollama status is tracked

When Ollama transitions healthy→degraded, fire Telegram alert to admin users. When it recovers, fire recovery message. Use Redis to track last state and prevent repeat alerts.

- [ ] **Step 1: Check health.ts and Redis usage**
```bash
grep -n "ollama\|redis\|state\|degraded\|healthy" /root/GeekSpace2.0/server/src/routes/health.ts | head -20
```

- [ ] **Step 2: Check admin user query pattern**
```bash
grep -n "admin\|is_admin\|role.*admin\|telegram.*admin" /root/GeekSpace2.0/server/src/db/index.ts | head -10
grep -n "admin\|is_admin" /root/GeekSpace2.0/server/src/routes/health.ts | head -10
```

- [ ] **Step 3: Check getRedis / redis client import**
```bash
grep -n "import.*redis\|getRedis\|redisClient" /root/GeekSpace2.0/server/src/routes/health.ts | head -5
grep -n "export.*getRedis\|export.*redis" /root/GeekSpace2.0/server/src/services/redis.ts 2>/dev/null | head -5 || grep -rn "export.*getRedis" /root/GeekSpace2.0/server/src/ | head -5
```

- [ ] **Step 4: Add state-transition alerting in health check function**

In the health check function that runs every 4 hours (or the inline check), after determining Ollama status:
```typescript
// State-transition alert for Ollama
const redis = getRedis();
if (redis) {
  const prevOllamaState = await redis.get('health:ollama:last_state');
  const currentOllamaState = ollamaHealthy ? 'healthy' : 'degraded';
  if (prevOllamaState !== null && prevOllamaState !== currentOllamaState) {
    // State changed — alert all admin users with Telegram linked
    const adminLinks = db.prepare(`
      SELECT cl.external_id FROM channel_links cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.channel = 'telegram' AND u.role = 'admin'
    `).all() as Array<{ external_id: string }>;
    const alertMsg = currentOllamaState === 'degraded'
      ? '⚠️ Agentin Alert: Local AI engine (Ollama) is offline. Switched to Groq. You won\'t notice a difference — I\'ll notify you when it recovers.'
      : '✅ Agentin: Local AI engine (Ollama) is back online.';
    for (const link of adminLinks) {
      await sendTelegramMessage(link.external_id, alertMsg).catch(() => {});
    }
  }
  await redis.set('health:ollama:last_state', currentOllamaState);
}
```

- [ ] **Step 5: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/routes/health.js geekspace-app:/app/server/dist/routes/health.js
docker restart geekspace-app
```

- [ ] **Step 6: Commit**
```bash
git add server/src/routes/health.ts
git commit -m "feat: Self-Healing Agent — Ollama state-change fires Telegram alert to admin users"
```

---

### Task 10: Telegram Memory Capture — upgrade extractMemories to use LLM

**Files:**
- Modify: `server/src/services/memory.ts` (or wherever `extractMemories` / `extractMemoriesWithOllama` lives)

Check if `extractMemoriesWithOllama` already does LLM-based extraction. If it's regex-only, upgrade to structured LLM extraction.

- [ ] **Step 1: Find and read extractMemories / extractMemoriesWithOllama**
```bash
grep -rn "extractMemories\|extractMemoriesWithOllama" /root/GeekSpace2.0/server/src/services/ | head -15
```

- [ ] **Step 2: Read the function body**

Read the implementation. If it uses LLM already, this task may be done. If it's regex-based, proceed.

- [ ] **Step 3: If regex-only, upgrade to LLM extraction**

Replace or augment with:
```typescript
export async function extractMemoriesWithOllama(userId: string, userMessage: string, agentReply: string): Promise<void> {
  try {
    const prompt = `Extract key facts, preferences, tasks, and context from this conversation.
Return a JSON array of {key, value, category} objects. Max 3 entries. Only extract genuinely useful persistent facts.
Categories: preference, task, fact, context, schedule

User said: "${userMessage}"
Agent replied: "${agentReply}"

Respond ONLY with a JSON array, nothing else. Example: [{"key":"prefers_dark_mode","value":"yes","category":"preference"}]`;

    const result = await callOllama(prompt, 'qwen3:8b'); // or fastest available model
    const parsed = JSON.parse(result) as Array<{key: string; value: string; category: string}>;
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed.slice(0, 3)) {
      if (!entry.key || !entry.value) continue;
      db.prepare(`
        INSERT INTO user_memories (id, user_id, key, value, category, source, confidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'llm_extraction', 0.8, datetime('now'), datetime('now'))
        ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).run(uuid(), userId, entry.key.slice(0, 100), entry.value.slice(0, 500), entry.category || 'general');
    }
  } catch { /* non-fatal */ }
}
```

- [ ] **Step 4: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**
```bash
git add server/src/services/memory.ts
git commit -m "feat: Telegram Memory Capture — LLM-based structured fact extraction on every message"
```

---

### Task 11: Push Week 2 + deploy

- [ ] **Step 1: Run server tests**
```bash
cd /root/GeekSpace2.0/server && npm test 2>&1 | tail -20
```

- [ ] **Step 2: Push + CI + deploy (same as Task 5)**
```bash
cd /root/GeekSpace2.0 && git push origin main
gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId')
git checkout live-production && git merge main --ff-only && git push origin live-production && git checkout main
docker compose up -d --build geekspace
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
```

---

## Chunk 3: Week 3 — 5 Missing Features

### Task 12: Video gen — show disabled state, block credits

**Files:**
- Modify: `src/dashboard/pages/VideoGenPage.tsx` (find the Generate button and add disabled state)
- Modify: `server/src/services/media-generation.ts` (short-circuit before deducting credits)

- [ ] **Step 1: Find VideoGenPage Generate button**
```bash
grep -n "Generate\|generate\|generate_video\|disabled" /root/GeekSpace2.0/src/dashboard/pages/VideoGenPage.tsx | head -20
```

- [ ] **Step 2: Add disabled state with explanation**

Find the Generate button. Wrap it with:
```tsx
<div className="space-y-2">
  <Button disabled className="w-full opacity-50 cursor-not-allowed">
    Generate Video
  </Button>
  <p className="text-xs text-[#6B7280] text-center">
    Video generation is temporarily unavailable from this server region.
    <br />
    <span className="text-[#00F0FF]">Image generation works fine →</span>
  </p>
</div>
```

- [ ] **Step 3: Short-circuit in media-generation.ts generateVideo**
```bash
grep -n "generateVideo\|export.*video" /root/GeekSpace2.0/server/src/services/media-generation.ts | head -10
```
Add at the top of `generateVideo`:
```typescript
export async function generateVideo(): Promise<{url: null; error: string}> {
  return { url: null, error: 'Video generation is temporarily unavailable from this server region.' };
}
```
(or add a return early before any credit deduction)

- [ ] **Step 4: Build frontend + backend, deploy**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -5
cd server && npm run build 2>&1 | tail -5
docker cp server/dist/services/media-generation.js geekspace-app:/app/server/dist/services/media-generation.js
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
docker restart geekspace-app
```

- [ ] **Step 5: Commit**
```bash
git add src/dashboard/pages/VideoGenPage.tsx server/src/services/media-generation.ts
git commit -m "fix: video gen shows disabled state with explanation (providers blocked from VPS)"
```

---

### Task 13: Health alerts → Telegram for admin users

**Files:**
- Modify: `server/src/routes/health.ts`
- Modify: `server/src/services/proactive-engine.ts` (or add new health watcher)

NOTE: Self-healing Ollama alert (Task 9) covers the main case. This task adds state-transition alerts for ALL health components (Redis, DB, Caddy, etc.).

- [ ] **Step 1: Read health.ts to see all components tracked**
```bash
grep -n "status\|component\|healthy\|degraded" /root/GeekSpace2.0/server/src/routes/health.ts | head -30
```

- [ ] **Step 2: Add `checkAndAlertHealthTransition` helper and integrate**

In `health.ts`, add this helper function (make sure `sendTelegramMessage` is imported):
```typescript
async function checkAndAlertHealthTransition(component: string, isHealthy: boolean): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = `health:${component}:last_state`;
  const prev = await redis.get(key);
  const current = isHealthy ? 'healthy' : 'degraded';
  if (prev !== null && prev !== current) {
    const adminLinks = db.prepare(`
      SELECT cl.external_id FROM channel_links cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.channel = 'telegram' AND u.role = 'admin'
    `).all() as Array<{ external_id: string }>;
    const icon = isHealthy ? '✅' : '⚠️';
    const msg = `${icon} Agentin Health: ${component} is now ${current}.`;
    for (const link of adminLinks) {
      await sendTelegramMessage(link.external_id, msg).catch(() => {});
    }
  }
  await redis.set(key, current, { EX: 86400 });
}
```

Then in the health check function, after each component's status is determined, call:
```typescript
await checkAndAlertHealthTransition('database', dbHealthy);
await checkAndAlertHealthTransition('redis', redisHealthy);
await checkAndAlertHealthTransition('ollama', ollamaHealthy);
```

- [ ] **Step 3: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/routes/health.js geekspace-app:/app/server/dist/routes/health.js
docker restart geekspace-app
docker logs geekspace-app --since 30s | grep -i "health\|error" | head -10
```

- [ ] **Step 4: Commit**
```bash
git add server/src/routes/health.ts
git commit -m "feat: health state-transition alerts fire Telegram message to admin users"
```

---

### Task 14: Agentic Portfolio — visitor intent detection → Geek Telegram alert

**Files:**
- Modify: `server/src/routes/portfolio.ts`
- Read: existing portfolio visit tracking to understand the visit log schema

When a visitor stays > 60s (tracked via client ping) AND referrer is linkedin/github/google, fire Telegram to portfolio owner.

- [ ] **Step 1: Find portfolio visit tracking**
```bash
grep -n "portfolio_visits\|visit\|visitor\|referer\|referrer" /root/GeekSpace2.0/server/src/routes/portfolio.ts | head -20
```

- [ ] **Step 2: Check portfolio_visits table schema**
```bash
grep -n "CREATE TABLE.*portfolio_visits\|portfolio_visits" /root/GeekSpace2.0/server/src/db/index.ts | head -10
```

- [ ] **Step 3: Add intent detection endpoint**

Add a `POST /api/portfolio/:portfolioId/ping` endpoint that receives `{duration_seconds}` from the frontend (called when user leaves page or after 60s). If duration >= 60 AND referer is a known professional source, fire Telegram:

```typescript
portfolioRouter.post('/:portfolioId/ping', async (req, res) => {
  const { portfolioId } = req.params;
  const { duration_seconds, referrer } = req.body as { duration_seconds: number; referrer?: string };
  res.json({ ok: true }); // respond fast

  if (duration_seconds < 60) return;

  const professionalSources = ['linkedin.com', 'github.com', 'google.com', 'twitter.com', 'x.com'];
  const isProfessional = professionalSources.some(s => (referrer || '').includes(s));
  if (!isProfessional) return;

  // Get portfolio owner
  const portfolio = db.prepare('SELECT user_id FROM portfolios WHERE id = ?').get(portfolioId) as { user_id: string } | undefined;
  if (!portfolio) return;

  // Get owner's Telegram
  const link = db.prepare("SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram'")
    .get(portfolio.user_id) as { external_id: string } | undefined;
  if (!link) return;

  const sourceName = professionalSources.find(s => (referrer || '').includes(s))?.replace('.com', '') || 'unknown';
  const msg = `👤 Portfolio Alert: Someone spent ${Math.round(duration_seconds)}s reading your portfolio (via ${sourceName}). Looks like a serious lead!`;

  await sendTelegramMessage(link.external_id, msg).catch(() => {});
});
```

- [ ] **Step 4: Add frontend ping in portfolio page**
```bash
grep -rn "PortfolioPage\|portfolio.*public\|PublicPortfolio" /root/GeekSpace2.0/src/ | grep -v node_modules | head -10
```
Find the public portfolio page and add:
```typescript
useEffect(() => {
  const start = Date.now();
  const ping = () => {
    const duration = Math.round((Date.now() - start) / 1000);
    // Use Blob to set Content-Type so Express JSON body parser receives it correctly
    const body = JSON.stringify({ duration_seconds: duration, referrer: document.referrer });
    navigator.sendBeacon(
      `/api/portfolio/${portfolioId}/ping`,
      new Blob([body], { type: 'application/json' })
    );
  };
  window.addEventListener('beforeunload', ping);
  const timer = setTimeout(ping, 60000); // ping after 60s
  return () => { window.removeEventListener('beforeunload', ping); clearTimeout(timer); };
}, [portfolioId]);
```

- [ ] **Step 5: Build + deploy**
```bash
cd /root/GeekSpace2.0 && npm run build && cd server && npm run build
docker cp server/dist/routes/portfolio.js geekspace-app:/app/server/dist/routes/portfolio.js
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
docker restart geekspace-app
```

- [ ] **Step 6: Commit**
```bash
git add server/src/routes/portfolio.ts src/
git commit -m "feat: Agentic Portfolio — visitor intent detection sends Telegram alert to portfolio owner"
```

---

### Task 15: Ctrl+K Smart Search

**Files:**
- Create: `server/src/routes/search.ts` (unified search endpoint)
- Modify: `server/src/index.ts` (register route)
- Create: `src/components/GlobalSearch.tsx` (Ctrl+K modal)
- Modify: `src/dashboard/DashboardApp.tsx` (add GlobalSearch + Ctrl+K listener)

- [ ] **Step 1: Create unified search endpoint**

```typescript
// server/src/routes/search.ts
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import type { Response } from 'express';

const searchRouter = Router();

searchRouter.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) {
    res.json({ results: [] });
    return;
  }
  const userId = req.userId!;
  const term = `%${q.trim()}%`;

  const notes = db.prepare(`SELECT id, 'note' as type, title, content as snippet, created_at FROM notes
    WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) LIMIT 5`).all(userId, term, term);
  const reminders = db.prepare(`SELECT id, 'reminder' as type, text as title, text as snippet, scheduled_for as created_at
    FROM reminders WHERE user_id = ? AND completed = 0 AND text LIKE ? LIMIT 5`).all(userId, term);
  const habits = db.prepare(`SELECT id, 'habit' as type, name as title, name as snippet, created_at
    FROM habits WHERE user_id = ? AND name LIKE ? LIMIT 5`).all(userId, term);
  const memories = db.prepare(`SELECT id, 'memory' as type, key as title, value as snippet, created_at
    FROM user_memories WHERE user_id = ? AND (key LIKE ? OR value LIKE ?) LIMIT 5`).all(userId, term, term);

  res.json({ results: [...notes, ...reminders, ...habits, ...memories] });
});

export default searchRouter;
```

- [ ] **Step 2: Register in server/src/index.ts**
```bash
grep -n "import.*routes\|app.use.*api" /root/GeekSpace2.0/server/src/index.ts | head -20
```
Add:
```typescript
import searchRouter from './routes/search.js';
// ...
app.use('/api/search', searchRouter);
```

- [ ] **Step 3: Create GlobalSearch.tsx component**
```tsx
// src/components/GlobalSearch.tsx
import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Bell, Target, Brain } from 'lucide-react';
import { api } from '@/services/api';

const typeIcons: Record<string, React.ReactNode> = {
  note: <FileText className="w-4 h-4 text-[#00F0FF]" />,
  reminder: <Bell className="w-4 h-4 text-[#FFB800]" />,
  habit: <Target className="w-4 h-4 text-[#00FF88]" />,
  memory: <Brain className="w-4 h-4 text-[#BF5FFF]" />,
};

interface SearchResult { id: string; type: string; title: string; snippet: string; }

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`);
      setResults(data.results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0D0D1A] border border-[#00F0FF]/30 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#00F0FF]/10">
          <Search className="w-5 h-5 text-[#6B7280]" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes, reminders, habits, memories..."
            className="flex-1 bg-transparent text-[#E8E8F0] placeholder:text-[#4B5563] outline-none text-sm"
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          <kbd className="text-xs text-[#4B5563] border border-[#2A2A3A] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-[#1A1A2E]">
            {results.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#1A1A2E] cursor-pointer">
                {typeIcons[r.type] ?? <Search className="w-4 h-4" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E8E8F0] truncate">{r.title}</p>
                  <p className="text-xs text-[#6B7280] truncate">{r.snippet}</p>
                </div>
                <span className="text-[10px] text-[#4B5563] capitalize">{r.type}</span>
              </div>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && (
          <p className="text-sm text-[#4B5563] text-center py-6">No results for "{query}"</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Ctrl+K listener in DashboardApp.tsx**
```bash
grep -n "useEffect\|keydown\|Ctrl\|ctrl" /root/GeekSpace2.0/src/dashboard/DashboardApp.tsx | head -10
```
Add state `const [searchOpen, setSearchOpen] = useState(false);` and useEffect:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(prev => !prev);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```
And in JSX: `{searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}`

- [ ] **Step 5: Build + deploy**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -5
cd server && npm run build 2>&1 | tail -5
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
docker cp server/dist/routes/search.js geekspace-app:/app/server/dist/routes/search.js
docker restart geekspace-app
```

- [ ] **Step 6: Commit**
```bash
git add server/src/routes/search.ts server/src/index.ts src/components/GlobalSearch.tsx src/dashboard/DashboardApp.tsx
git commit -m "feat: Ctrl+K global search across notes, reminders, habits, memories"
```

---

### Task 16: Push Week 3 + deploy

- [ ] **Step 1: Run server tests**
```bash
cd /root/GeekSpace2.0/server && npm test 2>&1 | tail -20
```

- [ ] **Step 2: Run frontend lint + type check**
```bash
cd /root/GeekSpace2.0 && npm run lint 2>&1 | tail -10
npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 3: Build frontend + backend**
```bash
npm run build 2>&1 | tail -5
cd server && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Push + CI**
```bash
cd /root/GeekSpace2.0 && git push origin main
gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId')
```

- [ ] **Step 5: Sync live-production (after CI green)**
```bash
git checkout live-production && git merge main --ff-only && git push origin live-production && git checkout main
```

- [ ] **Step 6: Docker rebuild + copy static**
```bash
cd /root/GeekSpace2.0 && docker compose up -d --build geekspace
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
curl -s http://localhost:3001/api/health | jq .status
```

---

## Chunk 4: Week 4 — Scale & Infra

### Task 17: Context threading — SQLite FTS5 over conversation_log

**Files:**
- Modify: `server/src/db/index.ts` (add FTS5 virtual table migration)
- Modify: `server/src/services/action-executor.ts` (add `search_memory` tool)
- Modify: `server/src/services/action-parser.ts` (add `search_memory` tool schema)
- Modify: `server/src/routes/agent.ts` (register tool)

- [ ] **Step 1: Add FTS5 migration in db/index.ts**

After the conversation_log table creation, add:
```typescript
try {
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(
    content,
    user_id UNINDEXED,
    created_at UNINDEXED,
    content='conversation_log',
    content_rowid='rowid'
  )`);
  // Populate existing data — plain INSERT is safe; IF NOT EXISTS on the table prevents re-creation
  // Do NOT use WHERE rowid NOT IN (SELECT rowid FROM conversation_fts) — FTS5 doesn't support that subquery
  db.exec(`INSERT INTO conversation_fts(rowid, content, user_id, created_at)
    SELECT rowid, content, user_id, created_at FROM conversation_log`);
} catch { /* already exists */ }
```

Also add triggers to keep FTS in sync:
```sql
CREATE TRIGGER IF NOT EXISTS conv_fts_insert AFTER INSERT ON conversation_log BEGIN
  INSERT INTO conversation_fts(rowid, content, user_id, created_at) VALUES (new.rowid, new.content, new.user_id, new.created_at);
END;
```

- [ ] **Step 2: Add search_memory tool schema in action-parser.ts**
```typescript
{
  name: 'search_memory',
  description: 'Search across all past conversations, notes, and memories. Use when user asks "what did I say about X" or "find my notes on Y".',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
}
```

- [ ] **Step 3: Implement search_memory in action-executor.ts**
```typescript
case 'search_memory': {
  const query = args.query as string;
  const userId = context.userId;

  // FTS5 search over conversations
  const convResults = db.prepare(`
    SELECT content, created_at FROM conversation_fts
    WHERE conversation_fts MATCH ? AND user_id = ?
    ORDER BY rank LIMIT 5
  `).all(query, userId) as Array<{content: string; created_at: string}>;

  // Also search user_memories
  const memResults = db.prepare(`
    SELECT key, value FROM user_memories
    WHERE user_id = ? AND (key LIKE ? OR value LIKE ?)
    LIMIT 5
  `).all(userId, `%${query}%`, `%${query}%`) as Array<{key: string; value: string}>;

  if (convResults.length === 0 && memResults.length === 0) {
    return { tool, success: true, message: `No results found for "${query}". Try different keywords.` };
  }

  const convText = convResults.map(r => `[${r.created_at.split('T')[0]}] ${r.content.slice(0, 200)}`).join('\n');
  const memText = memResults.map(r => `${r.key}: ${r.value}`).join('\n');

  return {
    tool,
    success: true,
    message: `Found ${convResults.length + memResults.length} results for "${query}":\n\n${convText ? `**From conversations:**\n${convText}\n\n` : ''}${memText ? `**From memories:**\n${memText}` : ''}`,
  };
}
```

- [ ] **Step 4: Build + test**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
npm test 2>&1 | tail -20
```

- [ ] **Step 5: Commit**
```bash
git add server/src/db/index.ts server/src/services/action-executor.ts server/src/services/action-parser.ts
git commit -m "feat: Context threading — SQLite FTS5 over conversation_log + search_memory tool"
```

---

### Task 18: Agent-as-Researcher — async research job with Telegram delivery

**Files:**
- Modify: `server/src/services/message-router.ts` (detect research intent, queue job)
- Modify: `server/src/routes/agent.ts` OR create `server/src/services/research-job.ts`

When message is a research request ("research X", "compare X and Y", "find best X"), instead of waiting 60s synchronously:
1. Immediately reply: "On it! Researching now — I'll send results in a few minutes."
2. Run Tavily search + crawl4ai extractions in background
3. Send formatted results to Telegram when done

- [ ] **Step 1: Check if a job queue already exists**
```bash
ls /root/GeekSpace2.0/server/src/services/ | grep -i "job\|queue\|worker"
grep -rn "job.*queue\|jobQueue\|asyncJob" /root/GeekSpace2.0/server/src/services/ | head -10
```

- [ ] **Step 2: Check research tool availability**
```bash
grep -n "web_search\|tavily\|crawl_url\|crawl4ai" /root/GeekSpace2.0/server/src/services/action-executor.ts | head -10
grep -n "web_search\|tavily" /root/GeekSpace2.0/server/src/services/action-parser.ts | head -5
```

- [ ] **Step 3: Create `server/src/services/research-job.ts`**

```typescript
// server/src/services/research-job.ts
// Async research job: run Tavily + crawl4ai in background, send result to Telegram

import { logger } from '../utils/logger.js';
import { sendTelegramMessage } from './telegram.js';
import { tavilySearch } from './tavily.js'; // verify import path
import type { Database } from 'better-sqlite3';

// Pattern to detect research requests
const RESEARCH_PATTERNS = [
  /\b(?:research|compare|find the best|what(?:'s| is) the best|top \d+|list of)\b.{5,}/i,
  /\b(?:summarize|analyse|analyze|review|breakdown)\b.{5,50}\b(?:and|vs|versus|compared to)\b/i,
];

export function isResearchRequest(text: string): boolean {
  return RESEARCH_PATTERNS.some(p => p.test(text));
}

export async function runResearchJob(opts: {
  query: string;
  chatId: string;
  userId: string;
  db: Database;
}): Promise<void> {
  const { query, chatId } = opts;
  try {
    // Step 1: Tavily search
    const searchResults = await tavilySearch(query, { maxResults: 5 });

    // Step 2: Format results
    const formatted = searchResults.map((r: {title: string; url: string; content: string}, i: number) =>
      `${i + 1}. **${r.title}**\n${r.content.slice(0, 300)}...\n🔗 ${r.url}`
    ).join('\n\n');

    const reply = `🔍 Research results for: *${query}*\n\n${formatted}\n\n_Found ${searchResults.length} sources_`;
    await sendTelegramMessage(chatId, reply);
  } catch (err: unknown) {
    logger.warn({ err: (err as Error).message, query }, 'Research job failed');
    await sendTelegramMessage(chatId, `❌ Research failed for "${query}". Please try again.`).catch(() => {});
  }
}
```

- [ ] **Step 4: Verify `tavilySearch` import path**
```bash
grep -rn "tavilySearch\|tavily.*search\|export.*tavily" /root/GeekSpace2.0/server/src/services/ | head -10
```
Adjust the import in Step 3 to match the actual export name and path.

- [ ] **Step 5: Wire into message-router.ts Telegram path**

In `handleIncomingMessage`, add a fast-path check early (after credits check, before main routing):
```typescript
// Async research fast-path for Telegram
if (msg.channel === 'telegram' && isResearchRequest(msg.text) && msg.text.length > 20) {
  await sendChannelResponse({
    channel: msg.channel,
    externalId: msg.externalId,
    text: "On it! Researching now — I'll send results in a few minutes. 🔍",
    replyToMessageId: msg.messageId,
  });
  // Fire-and-forget background job
  runResearchJob({ query: msg.text, chatId: msg.externalId, userId, db }).catch(() => {});
  return;
}
```

Import at top of message-router.ts:
```typescript
import { isResearchRequest, runResearchJob } from './research-job.js';
```

- [ ] **Step 6: Build + hot-patch**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
docker cp dist/services/research-job.js geekspace-app:/app/server/dist/services/research-job.js
docker cp dist/services/message-router.js geekspace-app:/app/server/dist/services/message-router.js
docker restart geekspace-app
```

- [ ] **Step 7: Commit**
```bash
git add server/src/services/research-job.ts server/src/services/message-router.ts
git commit -m "feat: Agent-as-Researcher — async Tavily research job with Telegram delivery"
```

---

### Task 19: Fix proactive briefing timezone for non-IST users

**Files:**
- Modify: `server/src/services/proactive-engine.ts`

Currently `startDailyBriefing()` fires at hardcoded 08:00 IST. Change to read `users.timezone` column (or default to IST if null).

- [ ] **Step 1: Check timezone column exists**
```bash
grep -n "timezone" /root/GeekSpace2.0/server/src/db/index.ts | head -10
```
If missing: `try { db.exec('ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT "Asia/Kolkata"'); } catch {}`

- [ ] **Step 2: Update scheduler to use per-user timezone**

Read proactive-engine.ts to find how the daily briefing cron is scheduled. If using a single cron at IST, change to a per-user approach that checks `users.timezone` when building the schedule.

Simple approach: keep IST cron but before sending briefing, check if it's 07:00-09:00 in the user's timezone:
```typescript
const userTz = user.timezone || 'Asia/Kolkata';
const userHour = new Date().toLocaleString('en-US', { timeZone: userTz, hour: 'numeric', hour12: false });
if (parseInt(userHour) < 7 || parseInt(userHour) > 9) return; // Not morning for this user
```

- [ ] **Step 3: Commit**
```bash
git add server/src/services/proactive-engine.ts server/src/db/index.ts
git commit -m "fix: proactive briefing respects per-user timezone (defaults to Asia/Kolkata)"
```

---

### Task 20: Push Week 4 + final deploy

- [ ] **Step 1: Run full test suite**
```bash
cd /root/GeekSpace2.0/server && npm test 2>&1 | tail -30
cd /root/GeekSpace2.0 && npm run lint 2>&1 | tail -10
```

- [ ] **Step 2: Push + CI + deploy**
```bash
git push origin main
gh run watch $(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId')
git checkout live-production && git merge main --ff-only && git push origin live-production && git checkout main
docker compose up -d --build geekspace
cp -r /root/GeekSpace2.0/dist/. /var/www/geekspace/
curl -s http://localhost:3001/api/health | jq .status
```

---

## Summary

| Week | Tasks | Theme | Effort |
|------|-------|-------|--------|
| 1 | 1-5 | 4 reliability bug fixes | ~1h |
| 2 | 6-11 | 5 agentic experiences | ~4 days |
| 3 | 12-16 | 5 missing features | ~3 days |
| 4 | 17-19 | Scale + infra (FTS5, timezone) | ~1 day |

**Pre-verified already done (from audit cross-check):**
- ChatPage streaming ✅
- Chat history on mount ✅
- MemoryManager Add/Edit ✅
- Automation action config ✅
- Privacy toggles ✅
- Image gallery table ✅
