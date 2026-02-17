# Memory, Health & Automations Tab Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix breaking issues in three dashboard tabs — Automations (silent save failures, description not persisted), Health (no auth on SSE, 5s spinner), and Memory (stale category filter, missing source field).

**Architecture:** Server-side: expand Zod enums, add DB migration, fix route handlers, add auth middleware, add immediate SSE push. Frontend: add error handling to Automations save, fix Memory loading state and source field.

**Tech Stack:** TypeScript, Express, Zod, better-sqlite3, React, SSE

---

## Task 1: Automations — Expand Zod enums in validate.ts

**Files:**
- Modify: `server/src/middleware/validate.ts` (lines 77-78, 201-203)

**Context:** `automationCreateSchema` and `automationUpdateSchema` reject `manual`, `keyword`, `health_down` triggers and `whatsapp-message`, `call_api`, `create_reminder`, `log` actions with a 400. The frontend offers all of these, and the DB column is a plain string — only the Zod enum is the blocker.

**Step 1: Update `automationCreateSchema` triggerType (line 77)**

Change:
```typescript
triggerType: z.enum(['time', 'event', 'webhook']),
```
To:
```typescript
triggerType: z.enum(['time', 'event', 'webhook', 'manual', 'keyword', 'health_down']),
```

**Step 2: Update `automationCreateSchema` actionType (line 78)**

Change:
```typescript
actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast']),
```
To:
```typescript
actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast', 'whatsapp-message', 'call_api', 'create_reminder', 'log']),
```

**Step 3: Update `automationUpdateSchema` triggerType (line 201)**

Change:
```typescript
triggerType: z.enum(['time', 'event', 'webhook']).optional(),
```
To:
```typescript
triggerType: z.enum(['time', 'event', 'webhook', 'manual', 'keyword', 'health_down']).optional(),
```

**Step 4: Update `automationUpdateSchema` actionType (line 203)**

Change:
```typescript
actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast']).optional(),
```
To:
```typescript
actionType: z.enum(['n8n-webhook', 'telegram-message', 'portfolio-update', 'manychat-broadcast', 'whatsapp-message', 'call_api', 'create_reminder', 'log']).optional(),
```

**Step 5: Add description to automationUpdateSchema (line 199 block)**

Add this line inside `automationUpdateSchema` after the `name` field:
```typescript
description: z.string().max(1000).optional(),
```

**Step 6: Build server to verify**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```
Expected: clean build.

**Step 7: Commit**

```bash
git add server/src/middleware/validate.ts
git commit -m "fix: expand automation Zod enums to match frontend options, add description to update schema"
```

---

## Task 2: Automations — Add description column migration + fix POST route

**Files:**
- Modify: `server/src/db/index.ts` (migrations block, ~line 300+)
- Modify: `server/src/routes/automations.ts` (lines 21, 24-25)

**Context:** The `automations` table has no `description` column. `automationCreateSchema` already accepts `description` but the POST handler doesn't destructure it and the INSERT omits it. Similarly, the PATCH handler never touches description.

**Step 1: Add migration to db/index.ts**

In the migrations block (after the last existing `try { ... } catch { }` block), add:
```typescript
try {
  db.exec(`ALTER TABLE automations ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
} catch { /* column already exists */ }
```

**Step 2: Fix POST handler to include description (automations.ts line 21)**

Change:
```typescript
const { name, triggerType, triggerConfig, actionType, actionConfig } = req.body;
```
To:
```typescript
const { name, description, triggerType, triggerConfig, actionType, actionConfig } = req.body;
```

**Step 3: Fix INSERT statement (automations.ts line 24-25)**

Change:
```typescript
db.prepare('INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
  id, req.userId, name, triggerType || 'manual', JSON.stringify(triggerConfig || {}), actionType || '', JSON.stringify(actionConfig || {})
);
```
To:
```typescript
db.prepare('INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
  id, req.userId, name, description || '', triggerType || 'manual', JSON.stringify(triggerConfig || {}), actionType || '', JSON.stringify(actionConfig || {})
);
```

**Step 4: Fix PATCH handler to include description (automations.ts lines 44-49 block)**

After the existing `if (updates.name !== undefined)` block, add:
```typescript
if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
```

**Step 5: Build server**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```
Expected: clean build.

**Step 6: Commit**

```bash
git add server/src/db/index.ts server/src/routes/automations.ts
git commit -m "fix: add description column migration and persist description in automations create/update"
```

---

## Task 3: Automations — Add error handling in AutomationsPage UI

**Files:**
- Modify: `src/dashboard/pages/AutomationsPage.tsx`

**Context:** `handleSave` calls `addAutomation` / `updateAutomation` with no try/catch. When the server returns an error, the store catches it silently and adds the automation locally only — users think it saved. We need to surface the failure.

**Step 1: Find the existing state declarations near the top of the component and add saveError state**

After the other `useState` declarations (around line 95-104), add:
```typescript
const [saveError, setSaveError] = useState('');
```

**Step 2: Replace handleSave with error-handled version (lines 130-152)**

Change:
```typescript
const handleSave = async () => {
  if (!form.name) return;
  if (editingId) {
    await updateAutomation(editingId, {
      name: form.name,
      description: form.description,
      triggerType: form.triggerType,
      actionType: form.actionType,
      enabled: form.enabled,
    });
  } else {
    await addAutomation({
      name: form.name,
      description: form.description,
      triggerType: form.triggerType,
      actionType: form.actionType,
      config: {},
      enabled: form.enabled,
    });
  }
  setIsAddDialogOpen(false);
  resetForm();
};
```
To:
```typescript
const handleSave = async () => {
  if (!form.name) return;
  setSaveError('');
  try {
    if (editingId) {
      await updateAutomation(editingId, {
        name: form.name,
        description: form.description,
        triggerType: form.triggerType,
        actionType: form.actionType,
        enabled: form.enabled,
      });
    } else {
      await addAutomation({
        name: form.name,
        description: form.description,
        triggerType: form.triggerType,
        actionType: form.actionType,
        config: {},
        enabled: form.enabled,
      });
    }
    setIsAddDialogOpen(false);
    resetForm();
  } catch {
    setSaveError('Failed to save automation. Please try again.');
  }
};
```

**Step 3: Clear saveError when dialog closes**

Find the dialog's `onOpenChange` handler (or wherever `setIsAddDialogOpen(false)` is called on cancel/close). Add `setSaveError('')` alongside any existing reset calls. Also add it to `resetForm()`:

In `resetForm`:
```typescript
const resetForm = () => {
  setForm({ name: '', description: '', triggerType: 'time', actionType: 'telegram-message', enabled: true });
  setEditingId(null);
  setSaveError('');
};
```

**Step 4: Render error message inside the save dialog**

Find the dialog's footer area (where the Save button lives). Just above the footer buttons, add:
```tsx
{saveError && (
  <p className="text-sm text-[#FF6161] mt-2">{saveError}</p>
)}
```

**Step 5: Build frontend**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 6: Commit**

```bash
git add src/dashboard/pages/AutomationsPage.tsx
git commit -m "fix: surface save errors in automations dialog instead of silently failing"
```

---

## Task 4: Health — Auth guard + immediate first SSE push

**Files:**
- Modify: `server/src/routes/health.ts` (lines 6-7, 54)

**Context:** `GET /stream` has no auth guard — any unauthenticated request can subscribe to server metrics. Also, there is no initial push on connect — clients wait up to 5 seconds for the first data.

**Step 1: Import requireAuth middleware (after existing imports, around line 13)**

Add to the imports:
```typescript
import { requireAuth } from '../middleware/auth.js';
```

**Step 2: Add requireAuth to the route (line 54)**

Change:
```typescript
healthRouter.get('/stream', (req: Request, res: Response) => {
```
To:
```typescript
healthRouter.get('/stream', requireAuth, async (req: Request, res: Response) => {
```

Note: the function must become `async` because we now call `await probeComponents()` immediately.

**Step 3: Add immediate first snapshot on connect**

After `res.flushHeaders();` and `incrementSSEConnections();` (around line 64), and before the `setInterval` call, add:
```typescript
// Send first snapshot immediately on connect (no waiting for interval)
try {
  const metrics = getMetricsSnapshot();
  const components = await probeComponents();
  const payload = {
    timestamp: new Date().toISOString(),
    components,
    metrics: {
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
      avgLatencyMs: metrics.avgLatencyMs,
      requestsPerMinute: metrics.requestsPerMinute,
      activeConnections: metrics.activeConnections,
    },
    system: { uptime: metrics.uptime, memoryMb: metrics.memoryMb },
    topEndpoints: Object.entries(metrics.endpoints)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        errors: stats.errors,
        avgMs: stats.count > 0 ? Math.round(stats.totalLatencyMs / stats.count) : 0,
      })),
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
} catch (err) {
  logger.error({ err }, 'SSE health stream initial push error');
}
```

**Step 4: Build server**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```
Expected: clean build.

**Step 5: Commit**

```bash
git add server/src/routes/health.ts
git commit -m "fix: add auth guard to health SSE stream and send immediate first snapshot on connect"
```

---

## Task 5: Memory — Fix loading state and add source field

**Files:**
- Modify: `src/dashboard/pages/MemoryManagerPage.tsx`

**Context:** Two small fixes: (1) `setLoading(true)` is only set inside a debounce, so stale memories show for 300ms on category change. (2) `memoryService.create()` doesn't send `source`, so manually-created memories have an empty source badge.

**Step 1: Find the useEffect that watches [search, category] in MemoryManagerPage.tsx**

It should look something like:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    fetchMemories();
  }, 300);
  return () => clearTimeout(timer);
}, [search, category]);
```

Change it to set loading immediately before the debounce:
```typescript
useEffect(() => {
  setLoading(true);
  const timer = setTimeout(() => {
    fetchMemories();
  }, 300);
  return () => clearTimeout(timer);
}, [search, category]);
```

**Step 2: Find where memoryService.create() is called**

It will look something like:
```typescript
await memoryService.create({
  key: editForm.key,
  value: editForm.value,
  category: editForm.category,
  confidence: editForm.confidence,
});
```

Add `source: 'manual'` to the object:
```typescript
await memoryService.create({
  key: editForm.key,
  value: editForm.value,
  category: editForm.category,
  confidence: editForm.confidence,
  source: 'manual',
});
```

**Step 3: Build frontend**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 4: Commit**

```bash
git add src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "fix: set loading state immediately on category change, add source field to manual memory create"
```

---

## Task 6: Build, deploy, smoke test, push

**Step 1: Build server**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```

**Step 2: Build frontend**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -5
```

**Step 3: Rebuild and restart Docker container**

```bash
docker compose -f /root/GeekSpace2.0/docker-compose.yml up -d --build geekspace 2>&1 | tail -10
sleep 6
curl -s http://localhost:3001/api/health | grep -o '"ok":[a-z]*'
```
Expected: `"ok":true`

**Step 4: Run smoke test**

```bash
bash /root/GeekSpace2.0/scripts/smoke-test.sh http://localhost:3001
```
Expected: ALL 11 TESTS PASSED

**Step 5: Push to remote**

```bash
git -C /root/GeekSpace2.0 push origin live-production
git -C /root/GeekSpace2.0 push origin live-production:main
```
