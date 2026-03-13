# Phase 1 Consolidation — Proactive Engine Hardening

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the two redundant briefing systems, fix IST-hardcoded timezone logic, add per-type notification preferences with throttling, and wire the event bus for streak/expense alerts.

**Architecture:** Extend the existing `proactive-engine.ts` (not rebuild). Replace `getISTHour/Minute/DateStr` with per-user timezone-aware helpers. Add a `proactive_preferences` JSON column to `agent_configs` for per-type toggles. Wire `event-bus.ts` typed events from `action-executor.ts` and subscribe in the proactive engine.

**Tech Stack:** TypeScript, better-sqlite3, Node EventEmitter, existing Telegram service

---

## Chunk 1: Typed Event Bus + Proactive Preferences

### Task 1: Typed Event Bus

**Files:**
- Modify: `server/src/services/event-bus.ts`

- [ ] **Step 1: Replace the 4-line event-bus.ts with typed version**

```typescript
// server/src/services/event-bus.ts
import { EventEmitter } from 'events';

export interface AgentinEvents {
  'reminder.created': { userId: string; reminderId: string; text: string };
  'habit.logged': { userId: string; habitName: string; streak: number };
  'streak.milestone': { userId: string; habitName: string; streak: number };
  'streak.broken': { userId: string; habitName: string; previousStreak: number };
  'expense.spike': { userId: string; amount: number; category: string; averageForCategory: number };
  'memory.stored': { userId: string; key: string };
}

class TypedEventBus {
  private emitter = new EventEmitter();
  constructor() { this.emitter.setMaxListeners(100); }
  emit<K extends keyof AgentinEvents>(event: K, data: AgentinEvents[K]): void {
    this.emitter.emit(event, data);
  }
  on<K extends keyof AgentinEvents>(event: K, handler: (data: AgentinEvents[K]) => void): void {
    this.emitter.on(event, handler);
  }
  off<K extends keyof AgentinEvents>(event: K, handler: (data: AgentinEvents[K]) => void): void {
    this.emitter.off(event, handler);
  }
}

export const eventBus = new TypedEventBus();
```

- [ ] **Step 2: Build to verify no TS errors**

Run: `cd server && npx tsc --noEmit`
Expected: 0 errors (existing code imports `eventBus` but only uses `.emit()` and `.on()` which match the new API)

- [ ] **Step 3: Fix any callers that used the old raw EventEmitter API**

Search: `grep -rn "eventBus\." server/src/ --include="*.ts" | grep -v event-bus.ts`
For each caller: update to use typed signatures if needed.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/event-bus.ts
git commit -m "refactor: typed event bus with AgentinEvents interface"
```

---

### Task 2: Proactive Preferences Column

**Files:**
- Modify: `server/src/db/index.ts` (add migration)

- [ ] **Step 1: Add migration for proactive_preferences column**

Find the migrations section in `server/src/db/index.ts` and add:

```typescript
// Phase P1: per-type proactive notification preferences
try {
  db.prepare("ALTER TABLE agent_configs ADD COLUMN proactive_preferences TEXT DEFAULT '{}'").run();
} catch { /* column exists */ }
```

The JSON structure: `{ "daily_briefing": true, "overdue_alert": true, "habit_nudge": true, "idle_check_in": true, "weekly_report": true, "streak_milestone": true, "expense_spike": true }`

All default to `true` (opt-out model, not opt-in).

- [ ] **Step 2: Build to verify**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add server/src/db/index.ts
git commit -m "feat: add proactive_preferences column to agent_configs"
```

---

### Task 3: Preference Check Helper in Proactive Engine

**Files:**
- Modify: `server/src/services/proactive-engine.ts`

- [ ] **Step 1: Add preference check function**

After the existing `isProactiveEnabled()` function (~line 49), add:

```typescript
type ProactiveType = 'daily_briefing' | 'overdue_alert' | 'habit_nudge' | 'idle_check_in' | 'weekly_report' | 'streak_milestone' | 'expense_spike';

function isTypeEnabled(userId: string, type: ProactiveType): boolean {
  if (!isProactiveEnabled(userId)) return false;
  try {
    const row = db.prepare('SELECT proactive_preferences FROM agent_configs WHERE user_id = ?')
      .get(userId) as { proactive_preferences: string } | undefined;
    if (!row?.proactive_preferences) return true; // default: all on
    const prefs = JSON.parse(row.proactive_preferences);
    return prefs[type] !== false; // explicit false = disabled, everything else = enabled
  } catch {
    return true;
  }
}
```

- [ ] **Step 2: Replace `isProactiveEnabled(userId)` calls in each handler**

In `dailyBriefing()`: change `if (!isProactiveEnabled(userId))` to `if (!isTypeEnabled(userId, 'daily_briefing'))`
In `overdueAlert()`: change to `if (!isTypeEnabled(userId, 'overdue_alert'))`
In `idleCheckIn()`: change to `if (!isTypeEnabled(userId, 'idle_check_in'))`
In `weeklyReport()`: change to `if (!isTypeEnabled(userId, 'weekly_report'))`
In `sendHabitNudges()`: add check `if (!isTypeEnabled(user.id, 'habit_nudge')) continue;` inside the loop

- [ ] **Step 3: Build to verify**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add server/src/services/proactive-engine.ts
git commit -m "feat: per-type proactive notification preferences"
```

---

## Chunk 2: Timezone Fix + Throttling

### Task 4: Replace IST Hardcoding with Per-User Timezone

**Files:**
- Modify: `server/src/services/proactive-engine.ts`

- [ ] **Step 1: Replace getISTHour/Minute/DateStr with timezone-aware helpers**

Replace the three IST functions (lines 198–217) with:

```typescript
function getUserHour(timezone: string): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
    10
  );
}

function getUserMinute(timezone: string): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: timezone, minute: 'numeric' }),
    10
  );
}

function getUserDateStr(timezone: string): string {
  const d = new Date();
  const year = d.toLocaleString('en-US', { timeZone: timezone, year: 'numeric' });
  const month = d.toLocaleString('en-US', { timeZone: timezone, month: '2-digit' });
  const day = d.toLocaleString('en-US', { timeZone: timezone, day: '2-digit' });
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 2: Refactor runProactiveChecks to be per-user timezone aware**

Replace the current `runProactiveChecks` (lines 219–285). The new version:
- Moves the IST hour/minute check INSIDE the per-user loop
- Uses `user.timezone || 'Asia/Kolkata'` for each user
- Each user's checks fire at THEIR local time, not global IST
- Reminder previews still fire every 30 min (they're timezone-independent)

Key change in the loop:
```typescript
for (const user of users) {
  const tz = user.timezone || 'Asia/Kolkata';
  const hour = getUserHour(tz);
  const minute = getUserMinute(tz);
  const todayStr = getUserDateStr(tz);
  // ... all existing checks use these local values
}
```

- [ ] **Step 3: Remove old IST helper references**

Search for any remaining `getISTHour`, `getISTMinute`, `getISTDateStr` calls and replace with the user-tz versions.

- [ ] **Step 4: Build and run tests**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: 0 TS errors, 2223 tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/services/proactive-engine.ts
git commit -m "fix: replace IST-hardcoded proactive checks with per-user timezone"
```

---

### Task 5: Message Throttling

**Files:**
- Modify: `server/src/services/proactive-engine.ts`

- [ ] **Step 1: Add throttle check function**

After `isTypeEnabled()`, add:

```typescript
const MAX_PROACTIVE_PER_DAY = 8;
const MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function isThrottled(userId: string): boolean {
  try {
    const dayAgo = Date.now() - 86_400_000;
    const todayCount = (db.prepare(
      'SELECT COUNT(*) as c FROM proactive_messages WHERE user_id = ? AND sent_at >= ?'
    ).get(userId, dayAgo) as { c: number })?.c ?? 0;
    if (todayCount >= MAX_PROACTIVE_PER_DAY) return true;

    const lastSent = db.prepare(
      'SELECT sent_at FROM proactive_messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 1'
    ).get(userId) as { sent_at: number } | undefined;
    if (lastSent && (Date.now() - lastSent.sent_at) < MIN_INTERVAL_MS) return true;

    return false;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Gate every proactive fire with throttle check**

In `runProactiveChecks()`, inside the per-user loop, add at the top:
```typescript
if (isThrottled(user.id)) continue;
```

Also gate `sendHabitNudges()` — add `if (isThrottled(user.id)) continue;` inside its user loop.

- [ ] **Step 3: Build to verify**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add server/src/services/proactive-engine.ts
git commit -m "feat: proactive message throttling (8/day max, 30min cooldown)"
```

---

## Chunk 3: Event Bus Wiring + Briefing Consolidation

### Task 6: Emit Events from Action Executor

**Files:**
- Modify: `server/src/services/action-executor.ts`

- [ ] **Step 1: Import event bus**

At the top imports, add:
```typescript
import { eventBus } from './event-bus.js';
```

- [ ] **Step 2: Emit reminder.created after set_reminder**

After the `INSERT INTO reminders` statement and activity_log insert (~line 475), add:
```typescript
eventBus.emit('reminder.created', { userId, reminderId, text });
```

- [ ] **Step 3: Emit habit events after track_habit**

After the streak update in `track_habit` case (~line 1044), add:
```typescript
eventBus.emit('habit.logged', { userId, habitName: habit.name, streak: newStreak });
if ([7, 14, 21, 30, 50, 100].includes(newStreak)) {
  eventBus.emit('streak.milestone', { userId, habitName: habit.name, streak: newStreak });
}
```

- [ ] **Step 4: Emit expense.spike after track_expense**

Find the `track_expense` case. After the INSERT, add:
```typescript
// Check for expense spike (>2x category average)
try {
  const avg = db.prepare(
    'SELECT AVG(amount) as avg FROM expenses WHERE user_id = ? AND category = ? AND created_at >= ?'
  ).get(userId, category, Date.now() - 30 * 86_400_000) as { avg: number } | undefined;
  if (avg?.avg && amount > avg.avg * 2) {
    eventBus.emit('expense.spike', { userId, amount, category, averageForCategory: Math.round(avg.avg) });
  }
} catch { /* non-fatal */ }
```

- [ ] **Step 5: Build to verify**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add server/src/services/action-executor.ts
git commit -m "feat: emit AgentinEvents from action executor (reminder, habit, expense)"
```

---

### Task 7: Subscribe to Events in Proactive Engine

**Files:**
- Modify: `server/src/services/proactive-engine.ts`

- [ ] **Step 1: Import event bus and subscribe in initProactiveEngine**

Add import at top:
```typescript
import { eventBus } from './event-bus.js';
```

At the end of `initProactiveEngine()`, add event subscriptions:

```typescript
// Event-driven proactive messages
eventBus.on('streak.milestone', async ({ userId, habitName, streak }) => {
  if (!isTypeEnabled(userId, 'streak_milestone') || isThrottled(userId)) return;
  const emojis = streak >= 30 ? '🏆🔥' : streak >= 21 ? '🔥💪' : '💪✨';
  const msg = `${emojis} ${streak}-day streak on "${habitName}"! You're building something real. Keep it up!`;
  const sent = await sendViaTelegram(userId, msg);
  if (sent) recordProactiveMessage(userId, 'daily_briefing', msg); // reuse type for now
  logger.info({ userId: userId.slice(0, 8), habitName, streak }, 'Streak milestone fired');
});

eventBus.on('expense.spike', async ({ userId, amount, category, averageForCategory }) => {
  if (!isTypeEnabled(userId, 'expense_spike') || isThrottled(userId)) return;
  const msg = `📊 Heads up — you just logged ₹${amount} on ${category}. Your monthly average for ${category} is ₹${averageForCategory}. That's ${Math.round(amount / averageForCategory)}x the usual.`;
  const sent = await sendViaTelegram(userId, msg);
  if (sent) recordProactiveMessage(userId, 'daily_briefing', msg);
  logger.info({ userId: userId.slice(0, 8), category, amount, avg: averageForCategory }, 'Expense spike alert fired');
});
```

- [ ] **Step 2: Update ProactiveMessageType to include new types**

Update the type at line 9:
```typescript
export type ProactiveMessageType = 'daily_briefing' | 'overdue_alert' | 'idle_check_in' | 'weekly_report' | 'streak_milestone' | 'expense_spike';
```

Update `recordProactiveMessage` calls in the new handlers to use proper types.

- [ ] **Step 3: Build to verify**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add server/src/services/proactive-engine.ts
git commit -m "feat: proactive engine subscribes to streak milestones + expense spikes"
```

---

### Task 8: Deprecate Redundant Briefing Scheduler

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/services/daily-briefing.ts`

- [ ] **Step 1: Remove briefing scheduler from startup**

In `server/src/index.ts`, find the line:
```typescript
safeStart('briefing-scheduler', startBriefingScheduler);
```
Comment it out or remove it. The proactive engine's `dailyBriefing()` is the single briefing path now.

- [ ] **Step 2: Keep createBriefing() as utility but stop the scheduler**

In `daily-briefing.ts`, add a deprecation comment:
```typescript
// DEPRECATED: Scheduler removed — proactive-engine.ts handles all scheduled briefings.
// createBriefing() is kept as a utility for on-demand /api/briefings/trigger calls.
```

- [ ] **Step 3: Build and run unit tests**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: 2223 tests pass

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts server/src/services/daily-briefing.ts
git commit -m "refactor: remove redundant briefing scheduler — proactive engine is single source"
```

---

## Chunk 4: Fast-Path + Deploy + Verify

### Task 9: Notification Preference Fast-Paths

**Files:**
- Modify: `server/src/services/message-router.ts`

- [ ] **Step 1: Add notification preference fast-path**

In message-router.ts, near the other fast-paths (after the proactive on/off handling), add a pattern to handle per-type toggles:

```typescript
// Proactive per-type preference fast-path
const proactiveTypePattern = /\b(?:turn\s+(?:off|on)|(?:dis|en)able|stop|start)\s+(?:the\s+)?(.+?)\s*(?:notification|alert|reminder|nudge|message)s?\b/i;
const proactiveTypeMatch = msgLower.match(proactiveTypePattern);
if (proactiveTypeMatch) {
  const isEnable = /\b(on|enable|start)\b/i.test(msgLower);
  const typeRaw = proactiveTypeMatch[1].toLowerCase().trim();
  const typeMap: Record<string, string> = {
    'briefing': 'daily_briefing', 'morning': 'daily_briefing', 'daily': 'daily_briefing',
    'overdue': 'overdue_alert', 'overdue alert': 'overdue_alert',
    'habit': 'habit_nudge', 'habit nudge': 'habit_nudge',
    'idle': 'idle_check_in', 'check in': 'idle_check_in', 'checkin': 'idle_check_in',
    'weekly': 'weekly_report', 'weekly report': 'weekly_report',
    'streak': 'streak_milestone',
    'expense': 'expense_spike', 'spending': 'expense_spike',
  };
  const proactiveType = typeMap[typeRaw];
  if (proactiveType) {
    try {
      const existing = db.prepare('SELECT proactive_preferences FROM agent_configs WHERE user_id = ?')
        .get(userId) as { proactive_preferences: string } | undefined;
      const prefs = existing?.proactive_preferences ? JSON.parse(existing.proactive_preferences) : {};
      prefs[proactiveType] = isEnable;
      db.prepare('UPDATE agent_configs SET proactive_preferences = ? WHERE user_id = ?')
        .run(JSON.stringify(prefs), userId);
      const action = isEnable ? 'enabled' : 'disabled';
      const reply = `✅ ${proactiveType.replace(/_/g, ' ')} notifications ${action}.`;
      // ... return fast-path response
    } catch { /* fall through to LLM */ }
  }
}
```

- [ ] **Step 2: Build to verify**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add server/src/services/message-router.ts
git commit -m "feat: fast-path for per-type proactive notification preferences"
```

---

### Task 10: Build, Deploy, Verify

- [ ] **Step 1: Full build**

Run: `cd server && npm run build`
Expected: 0 errors

- [ ] **Step 2: Run unit tests**

Run: `cd server && npm test`
Expected: 2223+ tests pass

- [ ] **Step 3: Run v5 audit**

Run: `JWT_SECRET=... WEBHOOK_SECRET=... ADMIN_TOKEN=... node ops/aliya-sim-v5.mjs --web-only`
Expected: 100% pass (98+ tests)

- [ ] **Step 4: Docker rebuild**

Run: `cd ~/GeekSpace2.0 && docker compose up -d --build geekspace`
Wait 12s, then: `curl -s localhost:3001/api/health | python3 -m json.tool`
Expected: 12/12 services healthy

- [ ] **Step 5: Live verification**

1. Check server logs for proactive engine init:
   `docker logs geekspace-app --tail=30 | grep -i proactive`
2. Verify event bus is subscribed:
   `docker logs geekspace-app --tail=30 | grep -i event`

- [ ] **Step 6: Update handoff**

Update `ops/AI_HANDOFF.md` with completed work.
Update the V6 master prompt: change P1-A/B/D `[ ]` to `[x]`.

- [ ] **Step 7: Commit all**

```bash
git add -A
git commit -m "feat: Phase 1 consolidation — timezone fix, throttling, event bus, per-type prefs"
```
