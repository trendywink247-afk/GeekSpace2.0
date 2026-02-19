# Ecosystem Audit + Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit integrity, fix 6 critical issues (Connections, Reminders/Memory, Health, Automations UI, Terminal persistence), and ship a polished, consistent ecosystem.

**Architecture:** Mobile-first fixes across React frontend (Zustand stores) and Express backend (SQLite/better-sqlite3). WhatsApp integration via QR-based linking (similar to Telegram pattern). Memory/Reminder sync via existing task system with category expansion.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind + shadcn/ui, Express + better-sqlite3, Docker Compose

---

## Phase A: Integrity Audit

### Task 1: Repo Sanity Check

**Files:**
- Read: `src/dashboard/pages/ConnectionsPage.tsx`
- Read: `src/dashboard/pages/TerminalPage.tsx`
- Read: `src/dashboard/pages/AutomationsPage.tsx`
- Read: `src/dashboard/pages/HealthDashboardPage.tsx`
- Read: `server/src/routes/integrations.ts`
- Read: `server/src/routes/webhooks.ts`
- Read: `server/src/services/message-router.ts`
- Read: `server/src/services/pico-fleet.ts`
- Read: `server/src/services/memory.ts`
- Read: `server/src/routes/agent.ts`
- Read: `server/src/db/index.ts`

**Step 1: Read all key files**

Read each file to understand current implementation.

**Step 2: Identify issues**

Document findings:
- Telegram reload issue in ConnectionsPage
- WhatsApp implementation status
- Health tab SSE vs REST
- Automations tab UI issues
- Terminal persistence status
- Memory/Reminder sync gaps

**Step 3: Commit**

```bash
git add -A
git commit -m "docs(audit): initial integrity audit findings"
```

---

## Phase B: Fix Issue #1 - Connections (Telegram + WhatsApp)

### Task 2: Fix Telegram Connection Flow (Remove Reload)

**Files:**
- Modify: `src/dashboard/pages/ConnectionsPage.tsx`

**Step 1: Find and remove window.location.reload**

Locate the `closeTelegramDialog` function and remove the `window.location.reload()` call.

**Step 2: Implement proper state refresh**

Replace reload with:
- Close dialog
- Call `loadDashboard()` from store to refresh integrations
- Call `integrationService.checkTelegramLink()` to verify status
- Update local state to show "Active" instead of "Connect"

**Step 3: Update UI text**

Change button from "Connect" to "Active" when linked, show Telegram username.

**Step 4: Commit**

```bash
git add src/dashboard/pages/ConnectionsPage.tsx
git commit -m "fix(connections): telegram no longer reloads page on connect"
```

---

### Task 3: Implement WhatsApp Backend

**Files:**
- Create: `server/src/services/whatsapp.ts`
- Modify: `server/src/routes/integrations.ts`
- Modify: `server/src/config.ts`

**Step 1: Add WhatsApp config**

Add to `server/src/config.ts`:
```typescript
whatsappBusinessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '',
whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
```

**Step 2: Create WhatsApp service**

Create `server/src/services/whatsapp.ts`:
```typescript
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import crypto from 'crypto';

export async function generateWhatsAppLinkToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(16).toString('hex');

  db.prepare(`
    INSERT INTO link_codes (code, user_id, channel, expires_at)
    VALUES (?, ?, 'whatsapp', datetime('now', '+1 hour'))
  `).run(token, userId);

  return token;
}

export function verifyWhatsAppLink(code: string, phoneNumber: string, username: string): boolean {
  const linkCode = db.prepare(
    "SELECT user_id FROM link_codes WHERE code = ? AND channel = 'whatsapp' AND expires_at > datetime('now')"
  ).get(code) as { user_id: string } | undefined;

  if (!linkCode) return false;

  // Create channel link
  const { v4: uuid } = await import('uuid');
  db.prepare(
    'INSERT INTO channel_links (id, user_id, channel, external_id, external_username) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), linkCode.user_id, 'whatsapp', phoneNumber, username);

  // Update integrations
  db.prepare(
    "UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE user_id = ? AND type = 'whatsapp'"
  ).run(new Date().toISOString(), linkCode.user_id);

  // Delete used code
  db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);

  return true;
}

export function unlinkWhatsApp(userId: string): boolean {
  const link = db.prepare(
    "SELECT id FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(userId) as { id: string } | undefined;

  if (!link) return false;

  db.prepare('DELETE FROM channel_links WHERE id = ?').run(link.id);
  db.prepare(
    "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = 'whatsapp'"
  ).run(userId);

  return true;
}

export function getWhatsAppStatus(userId: string) {
  return db.prepare(
    "SELECT external_id, external_username, linked_at, last_message_at FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(userId) as { external_id: string; external_username: string; linked_at: string; last_message_at: string | null } | undefined;
}
```

**Step 3: Add WhatsApp endpoints**

Add to `server/src/routes/integrations.ts`:
```typescript
// WhatsApp link
integrationsRouter.post('/whatsapp/link', requireAuth, async (req: AuthRequest, res) => {
  if (!config.whatsappBusinessNumber) {
    res.status(503).json({ error: 'WhatsApp not configured' });
    return;
  }

  const { generateWhatsAppLinkToken } = await import('../services/whatsapp.js');
  const token = await generateWhatsAppLinkToken(req.userId!);

  // Generate QR code data URL (simple implementation)
  const waMeUrl = `https://wa.me/${config.whatsappBusinessNumber}?text=LINK%20${token}`;

  res.json({
    linked: false,
    token,
    qrUrl: waMeUrl,
    expiresIn: 3600,
  });
});

// WhatsApp status
integrationsRouter.get('/whatsapp/status', requireAuth, (req: AuthRequest, res) => {
  const { getWhatsAppStatus } = await import('../services/whatsapp.js');
  const status = getWhatsAppStatus(req.userId!);

  if (status) {
    res.json({
      linked: true,
      externalId: status.external_id,
      username: status.external_username,
      linkedAt: status.linked_at,
      lastMessageAt: status.last_message_at,
    });
  } else {
    res.json({ linked: false });
  }
});

// WhatsApp unlink
integrationsRouter.delete('/whatsapp/link', requireAuth, (req: AuthRequest, res) => {
  const { unlinkWhatsApp } = await import('../services/whatsapp.js');
  const success = unlinkWhatsApp(req.userId!);

  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'No WhatsApp link found' });
  }
});
```

**Step 4: Commit**

```bash
git add server/src/services/whatsapp.ts server/src/routes/integrations.ts server/src/config.ts
git commit -m "feat(whatsapp): add backend endpoints and service"
```

---

### Task 4: Add WhatsApp Webhook Handler

**Files:**
- Modify: `server/src/routes/webhooks.ts`

**Step 1: Add WhatsApp webhook handler**

Add to `server/src/routes/webhooks.ts`:
```typescript
// WhatsApp webhook (simplified for QR-based linking)
webhooksRouter.post('/whatsapp', async (req, res) => {
  try {
    const { verifyWhatsAppLink } = await import('../services/whatsapp.js');

    // Handle incoming message
    const message = req.body;

    if (message.text?.body?.startsWith('LINK ')) {
      const code = message.text.body.slice(5).trim();
      const success = verifyWhatsAppLink(code, message.from, message.from);

      if (success) {
        // TODO: Send confirmation message back
        logger.info({ phone: message.from }, 'WhatsApp linked successfully');
      }
    } else {
      // Route to message router
      const { handleIncomingMessage } = await import('../services/message-router.js');
      await handleIncomingMessage({
        channel: 'whatsapp',
        externalId: message.from,
        text: message.text?.body || '',
        messageId: message.id,
        senderName: message.from,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook error');
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

**Step 2: Commit**

```bash
git add server/src/routes/webhooks.ts
git commit -m "feat(whatsapp): add webhook handler"
```

---

### Task 5: Add WhatsApp UI to Connections Page

**Files:**
- Modify: `src/dashboard/pages/ConnectionsPage.tsx`
- Modify: `src/services/api.ts`

**Step 1: Add API methods**

Add to `src/services/api.ts`:
```typescript
linkWhatsApp: () => api.post<{ linked: boolean; token: string; qrUrl: string; expiresIn: number }>('/integrations/whatsapp/link'),
checkWhatsAppStatus: () => api.get<{ linked: boolean; externalId?: string; username?: string; linkedAt?: string }>('/integrations/whatsapp/status'),
unlinkWhatsApp: () => api.delete('/integrations/whatsapp/link'),
```

**Step 2: Add WhatsApp state and handlers**

Add to ConnectionsPage.tsx:
- `whatsappDialog` state
- `whatsappStep` state ('idle' | 'qr' | 'waiting' | 'success')
- `whatsappLink` state
- `handleWhatsAppConnect` function
- `handleWhatsAppDisconnect` function
- Polling for status

**Step 3: Add WhatsApp UI**

Add WhatsApp card rendering with:
- QR code display (using qrUrl)
- "Connect" button when not linked
- "Active" state with phone number when linked
- "Disconnect" button when linked

**Step 4: Commit**

```bash
git add src/dashboard/pages/ConnectionsPage.tsx src/services/api.ts
git commit -m "feat(whatsapp): add UI with QR linking flow"
```

---

## Phase B: Fix Issue #2 - Connections Flow (Done Redirect)

### Task 6: Fix Done Button to Stay on Connections Page

**Files:**
- Modify: `src/dashboard/pages/ConnectionsPage.tsx`

**Step 1: Update closeTelegramDialog**

Change from:
```typescript
const closeTelegramDialog = () => {
  if (telegramStep === 'success') {
    window.location.reload();
    return;
  }
  // ...
};
```

To:
```typescript
const closeTelegramDialog = () => {
  setTelegramDialog(false);
  setTelegramLink(null);
  setTelegramStep('idle');
  setPolling(false);
  setCopied(false);
  // Refresh data without reload
  loadDashboard();
};
```

**Step 2: Same for WhatsApp dialog**

Ensure WhatsApp dialog close also doesn't redirect.

**Step 3: Commit**

```bash
git add src/dashboard/pages/ConnectionsPage.tsx
git commit -m "fix(connections): done button stays on connections page"
```

---

## Phase B: Fix Issue #3 - Reminders + Memory Sync

### Task 7: Ensure Reminders Create Memory Entries

**Files:**
- Modify: `server/src/services/pico-fleet.ts`
- Modify: `server/src/services/memory.ts`

**Step 1: Update createReminder task handler**

Find where reminders are created and ensure memory entry is added:

```typescript
// In pico-fleet.ts or action-executor.ts
function createReminder(userId: string, text: string, dueAt: string, channel: string) {
  const reminderId = uuid();

  // Insert reminder
  db.prepare(`
    INSERT INTO reminders (id, user_id, text, due_at, channel, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(reminderId, userId, text, dueAt, channel);

  // Insert memory entry
  const { recordMemory } = await import('./memory.js');
  recordMemory(userId, `reminder:${reminderId}`, JSON.stringify({
    text,
    dueAt,
    channel,
    reminderId,
  }), 'reminder', 0.9);

  // Update channel_links last_message_at
  db.prepare(
    "UPDATE channel_links SET last_message_at = datetime('now') WHERE user_id = ? AND channel = ?"
  ).run(userId, channel);

  return reminderId;
}
```

**Step 2: Add "reminder" category to memory**

Update `server/src/services/memory.ts` to include "reminder" in categories.

**Step 3: Update MemoryManagerPage categories**

Add "reminder" to the category filter in `src/dashboard/pages/MemoryManagerPage.tsx`.

**Step 4: Commit**

```bash
git add server/src/services/pico-fleet.ts server/src/services/memory.ts src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "fix(memory): reminders now create memory entries and update channel_links"
```

---

### Task 8: Add Reminders Page Polling

**Files:**
- Modify: `src/dashboard/pages/RemindersPage.tsx`

**Step 1: Add polling for reminders**

Add useEffect with setInterval to refresh reminders every 10 seconds.

**Step 2: Commit**

```bash
git add src/dashboard/pages/RemindersPage.tsx
git commit -m "feat(reminders): add polling for real-time updates"
```

---

## Phase B: Fix Issue #4 - Health Tab Infinite Loading

### Task 9: Add REST Fallback to Health Dashboard

**Files:**
- Modify: `src/dashboard/pages/HealthDashboardPage.tsx`
- Modify: `server/src/routes/health.ts` (ensure REST endpoint exists)

**Step 1: Ensure REST endpoint exists**

Verify `/api/health` returns JSON with same payload structure as SSE.

**Step 2: Update HealthDashboardPage**

Add REST fallback:
```typescript
useEffect(() => {
  // Try SSE first
  const eventSource = new EventSource('/api/health/stream');

  eventSource.onmessage = (e) => {
    setData(JSON.parse(e.data));
    setLoading(false);
    setError(null);
  };

  eventSource.onerror = () => {
    eventSource.close();
    // Fallback to REST
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load health data');
        setLoading(false);
      });
  };

  // Timeout after 5 seconds
  const timeout = setTimeout(() => {
    eventSource.close();
    // Trigger fallback
  }, 5000);

  return () => {
    clearTimeout(timeout);
    eventSource.close();
  };
}, []);
```

**Step 3: Add error state UI**

Show error message + Retry button when both SSE and REST fail.

**Step 4: Commit**

```bash
git add src/dashboard/pages/HealthDashboardPage.tsx
git commit -m "fix(health): add REST fallback and error state with retry"
```

---

## Phase B: Fix Issue #5 - Automations Tab UI

### Task 10: Fix Automations Tabs Styling

**Files:**
- Modify: `src/dashboard/pages/AutomationsPage.tsx`

**Step 1: Fix TabsList styling**

Find the TabsList and update:
```typescript
<TabsList className="flex-none w-auto">
  <TabsTrigger value="all" className="flex-none">All</TabsTrigger>
  <TabsTrigger value="active" className="flex-none">Active</TabsTrigger>
  <TabsTrigger value="inactive" className="flex-none">Inactive</TabsTrigger>
</TabsList>
```

**Step 2: Ensure mobile scrollability**

Add `className="overflow-x-auto"` to container if needed.

**Step 3: Commit**

```bash
git add src/dashboard/pages/AutomationsPage.tsx
git commit -m "fix(automations): fix tabs stretching and mobile layout"
```

---

## Phase B: Fix Issue #6 - Terminal Chat Persistence

### Task 11: Create Terminal Store with Persistence

**Files:**
- Create: `src/stores/terminalStore.ts`
- Modify: `src/dashboard/pages/TerminalPage.tsx`

**Step 1: Create terminal store**

Create `src/stores/terminalStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  timestamp: number;
  type: 'input' | 'output' | 'error';
}

interface TerminalState {
  history: TerminalCommand[];
  addCommand: (cmd: Omit<TerminalCommand, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      history: [],
      addCommand: (cmd) =>
        set((state) => ({
          history: [
            ...state.history.slice(-49), // Keep last 50
            { ...cmd, id: crypto.randomUUID(), timestamp: Date.now() },
          ],
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'terminal-history',
      partialize: (state) => ({ history: state.history.slice(-50) }),
    }
  )
);
```

**Step 2: Update TerminalPage to use store**

Replace local state with terminal store.

**Step 3: Commit**

```bash
git add src/stores/terminalStore.ts src/dashboard/pages/TerminalPage.tsx
git commit -m "feat(terminal): add persistent command history with zustand"
```

---

## Phase C: Smoke Tests + Documentation

### Task 12: Execute Smoke Tests

**Files:**
- Run: `scripts/smoke/smoke-tests.ts`
- Manual test: Connections, Reminders, Health, Terminal, Automations

**Step 1: Run automated smoke tests**

```bash
cd /root/GeekSpace2.0/scripts/smoke
npm test
```

**Step 2: Manual test Telegram flow**
- Link Telegram
- Send "remind me in 1 minute test"
- Verify reminder appears
- Verify memory entry created

**Step 3: Manual test WhatsApp flow**
- Show QR
- Verify status updates

**Step 4: Manual test Health**
- Load Health tab
- Verify loads within 3 seconds
- Test error state

**Step 5: Manual test Terminal**
- Run command
- Navigate away
- Return, verify history persists

**Step 6: Manual test Automations**
- Verify tabs look correct on mobile

**Step 7: Commit**

```bash
git add -A
git commit -m "test(smoke): verify all fixes working"
```

---

### Task 13: Update Documentation

**Files:**
- Create/Modify: `docs/RUNBOOK.md`
- Create: `docs/PRODUCTION_READINESS.md`

**Step 1: Update RUNBOOK**

Add sections for:
- Telegram setup
- WhatsApp setup
- Env vars required
- Troubleshooting

**Step 2: Create Production Readiness Notes**

Document:
- What was broken
- What was changed
- How to test
- Limitations
- Follow-ups

**Step 3: Final commit**

```bash
git add -A
git commit -m "docs: update runbook and production readiness notes"
```

---

## Final Build & Push

### Task 14: Final Verification

**Step 1: Run builds**

```bash
cd /root/GeekSpace2.0
npm run build
cd server && npm run build
```

**Step 2: Push branch**

```bash
git push origin fix/ecosystem-audit-2026-02-19
```

**Step 3: Create PR description**

Include:
- Summary of all 6 issues fixed
- Testing instructions
- Screenshots (if applicable)

---

## Summary Checklist

- [ ] Task 1: Audit completed
- [ ] Task 2: Telegram reload removed
- [ ] Task 3: WhatsApp backend implemented
- [ ] Task 4: WhatsApp webhook added
- [ ] Task 5: WhatsApp UI added
- [ ] Task 6: Done redirect fixed
- [ ] Task 7: Reminders create memory entries
- [ ] Task 8: Reminders polling added
- [ ] Task 9: Health REST fallback added
- [ ] Task 10: Automations tabs fixed
- [ ] Task 11: Terminal persistence added
- [ ] Task 12: Smoke tests passed
- [ ] Task 13: Documentation updated
- [ ] Task 14: Final build & push
