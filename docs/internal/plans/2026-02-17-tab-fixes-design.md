# Memory, Health & Automations Tab Fixes — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Scope:** Fix broken behaviour in three dashboard tabs — Automations (breaking), Health (minor), Memory (minor)

---

## 1. Automations Fixes

### 1a. Expand Zod schemas (`server/src/middleware/validate.ts`)

`automationCreateSchema` and `automationUpdateSchema` currently only accept a subset of the trigger/action types the frontend offers. Creating automations with unsupported types silently fails — server returns 400, the store catches it and adds locally-only, user thinks it worked but nothing is persisted.

**Fix:**
- Expand `triggerType` enum to: `time`, `event`, `webhook`, `manual`, `keyword`, `health_down`
- Expand `actionType` enum to: `n8n-webhook`, `telegram-message`, `portfolio-update`, `manychat-broadcast`, `whatsapp-message`, `call_api`, `create_reminder`, `log`
- DB column is plain string — no migration needed for these values

### 1b. Persist `description` field (`server/src/routes/automations.ts` + `server/src/db/index.ts`)

`description` is accepted by the schema and sent by the frontend but never written to the DB. The POST handler does not destructure it, the INSERT statement omits it, and the UPDATE handler similarly ignores it.

**Fix:**
- Add DB migration: `ALTER TABLE automations ADD COLUMN description TEXT NOT NULL DEFAULT ''` (run on server start if column missing)
- Add `description` to `automationCreateSchema` (optional string, default `''`)
- Destructure `description` in POST handler and include in INSERT
- Add `description` to `automationUpdateSchema` (optional string)
- Include in PATCH handler's UPDATE statement when provided

### 1c. Surface errors to the user (`src/dashboard/pages/AutomationsPage.tsx`)

`handleSave` calls `addAutomation` / `updateAutomation` with no error handling — failures are invisible.

**Fix:**
- Add `saveError` string state
- Wrap save calls in try/catch — on failure set `saveError` with message, clear on success/dialog close
- Render red error message inside the save dialog when `saveError` is set

---

## 2. Health Fixes (`server/src/routes/health.ts`)

### 2a. Auth guard on SSE stream

`GET /stream` has no `requireAuth` middleware. Any unauthenticated request can subscribe and receive server metrics, memory usage, and request rates.

**Fix:** Add `requireAuth` to the `GET /stream` route — same middleware used across all authenticated dashboard endpoints.

### 2b. Immediate first snapshot on connect

The SSE interval fires every 5 seconds. There is no initial push when a client first connects, leaving the health dashboard showing a spinner for up to 5 seconds.

**Fix:** After writing SSE headers, immediately call `probeComponents()` and write the first snapshot before starting the interval.

---

## 3. Memory Fixes (`src/dashboard/pages/MemoryManagerPage.tsx`)

### 3a. Fix category filter stale state

When `category` changes, `fetchMemories` is triggered via a `useEffect` with a 300ms debounce. The `loading` state is only set inside the debounce, so stale data is shown for 300ms on every category click.

**Fix:** Set `setLoading(true)` immediately in the `useEffect` when `category` or `search` changes, before the debounce fires.

### 3b. Send `source` on manual memory creation

`memoryService.create()` does not send a `source` field. Manually-created memories render an empty source badge.

**Fix:** Include `source: 'manual'` in the `memoryService.create()` payload.

---

## Implementation Order

1. Automations: expand Zod schemas
2. Automations: add description migration + persist description
3. Automations: add error handling in UI
4. Health: add auth guard + immediate first push
5. Memory: fix loading state + source field
6. Build server + frontend, deploy, smoke test
