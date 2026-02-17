# PicoClaw OS Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make PicoClaw the unified AI OS across all of GeekSpace — face, worker, and router for every user interaction — while fixing critical bugs and completing half-built features.

**Architecture:** Wave 1 fixes critical bugs and billing. Wave 2 wires Pico context + smart routing everywhere. Wave 3 adds networking and themes. Wave 4 completes platform features (recipes, memory, automations). Each wave builds on the last.

**Tech Stack:** TypeScript, Express, better-sqlite3, React, Zustand, ioredis, Moonshot Kimi K2 Thinking (`edith`), Ollama (`llama3.1:8b`), OpenRouter free tier, Telegram Bot API, SSE streaming

---

## Implementer Context

- **Root:** `/root/GeekSpace2.0`
- **Server src:** `server/src/` — TypeScript, compiled to `dist/` via `npm run build`
- **Frontend src:** `src/` — React + Vite + TypeScript
- **Build server:** `cd /root/GeekSpace2.0/server && npm run build`
- **Build frontend:** `cd /root/GeekSpace2.0 && npm run build`
- **Deploy:** `docker compose up -d --build` from project root
- **Live DB:** `/app/data/geekspace.db` (Docker volume)
- **`tsconfig.app.json`** has `noUnusedLocals` + `noUnusedParameters` — unused imports = build failure
- **better-sqlite3** is synchronous — no `async/await` inside `db.transaction()`
- **All Redis calls** are non-fatal — already wrapped in `server/src/services/cache.ts`
- The `'edith'` provider = Moonshot Kimi K2 Thinking via `edithChat()` in `server/src/services/edith.ts`
- The `'ollama'` provider = local llama3.1:8b — 50-70s on this VPS
- The `'openrouter-free'` provider = free OpenRouter models — ~3s

---

# WAVE 1: Critical Fixes

---

## Task 1: Fix Telegram Onboarding (Actual Connect Flow, Not Just Toggle)

**Problem:** IntegrationsStep.tsx step 5 is a multi-select toggle. Clicking Telegram just marks it "selected" — it doesn't show the Telegram deep link or connection flow. User gets stuck.

**Files:**
- Modify: `src/onboarding/steps/IntegrationsStep.tsx`
- Read first: `src/services/api.ts` — find `integrationService.telegramLink()` and `telegramStatus()` (or add them)

### Step 1: Check if integrationService has Telegram methods

Read `src/services/api.ts`. Search for `integrationService` or `telegram` methods. They should be at `POST /api/integrations/telegram/link` and `GET /api/integrations/telegram/status`.

If they exist, note the exact function names. If not, add them:

```typescript
// In src/services/api.ts, add to integrationService:
export const integrationService = {
  // ... existing methods ...
  telegramLink: () => api.post<{ deepLink: string; code: string }>('/integrations/telegram/link'),
  telegramStatus: () => api.get<{ connected: boolean }>('/integrations/telegram/status'),
};
```

### Step 2: Rewrite IntegrationsStep.tsx

Replace the entire file with this implementation that shows a real Telegram connect flow when Telegram is clicked:

```tsx
import { useState } from 'react';
import { Link2, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';

const integrationOptions: { id: IntegrationType; name: string; description: string; hasConnectFlow: boolean }[] = [
  { id: 'telegram', name: 'Telegram', description: 'Chat with your agent via Telegram', hasConnectFlow: true },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Sync events and schedules', hasConnectFlow: false },
  { id: 'github', name: 'GitHub', description: 'Showcase repos in portfolio', hasConnectFlow: false },
  { id: 'n8n', name: 'n8n', description: 'Advanced workflow automation', hasConnectFlow: false },
];

interface IntegrationsStepProps {
  selected: IntegrationType[];
  onToggle: (integrations: IntegrationType[]) => void;
  onSkip: () => void;
}

export function IntegrationsStep({ selected, onToggle, onSkip }: IntegrationsStepProps) {
  const [telegramState, setTelegramState] = useState<'idle' | 'loading' | 'waiting' | 'checking' | 'connected'>('idle');
  const [deepLink, setDeepLink] = useState('');

  const toggle = (id: IntegrationType) => {
    // For telegram, trigger the connect flow instead of just toggling
    if (id === 'telegram' && !selected.includes('telegram')) {
      handleTelegramConnect();
      return;
    }
    if (selected.includes(id)) {
      onToggle(selected.filter((i) => i !== id));
    } else {
      onToggle([...selected, id]);
    }
  };

  const handleTelegramConnect = async () => {
    setTelegramState('loading');
    try {
      const { data } = await integrationService.telegramLink();
      setDeepLink(data.deepLink);
      setTelegramState('waiting');
    } catch {
      setTelegramState('idle');
    }
  };

  const handleCheckStatus = async () => {
    setTelegramState('checking');
    try {
      const { data } = await integrationService.telegramStatus();
      if (data.connected) {
        setTelegramState('connected');
        if (!selected.includes('telegram')) {
          onToggle([...selected, 'telegram']);
        }
      } else {
        setTelegramState('waiting');
      }
    } catch {
      setTelegramState('waiting');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Connect Integrations
        </h2>
      </div>
      <p className="text-[#A7ACB8] text-sm">
        Optional — you can add these later from the dashboard.
      </p>
      <div className="space-y-3">
        {integrationOptions.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isTelegram = opt.id === 'telegram';

          return (
            <div key={opt.id}>
              <button
                type="button"
                onClick={() => toggle(opt.id)}
                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected || (isTelegram && telegramState === 'connected')
                    ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                    : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[#F4F6FF]">{opt.name}</div>
                  <div className="text-sm text-[#A7ACB8]">{opt.description}</div>
                </div>
                {(isSelected || telegramState === 'connected') ? (
                  <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : isTelegram && telegramState === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#7B61FF]" />
                ) : null}
              </button>

              {/* Telegram connect flow panel */}
              {isTelegram && telegramState === 'waiting' && (
                <div className="mt-2 p-4 rounded-xl bg-[#7B61FF]/5 border border-[#7B61FF]/20 space-y-3">
                  <p className="text-sm text-[#A7ACB8]">
                    Click the button below to open Telegram, then send <span className="text-[#7B61FF] font-mono">/start</span> to the bot.
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#7B61FF] text-white rounded-lg text-sm font-medium hover:bg-[#6B51EF] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Telegram
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckStatus}
                      className="border-[#7B61FF]/30 text-[#A7ACB8]"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      I've connected
                    </Button>
                  </div>
                </div>
              )}

              {isTelegram && telegramState === 'checking' && (
                <div className="mt-2 p-3 rounded-xl bg-[#7B61FF]/5 border border-[#7B61FF]/20 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7B61FF]" />
                  <span className="text-sm text-[#A7ACB8]">Checking connection...</span>
                </div>
              )}

              {isTelegram && telegramState === 'connected' && (
                <div className="mt-2 p-3 rounded-xl bg-[#61FF7B]/5 border border-[#61FF7B]/20 flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#61FF7B]" />
                  <span className="text-sm text-[#61FF7B]">Telegram connected!</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
```

### Step 3: Build frontend

```bash
cd /root/GeekSpace2.0 && npm run build
```
Expected: zero TypeScript errors.

### Step 4: Commit

```bash
cd /root/GeekSpace2.0
git add src/onboarding/steps/IntegrationsStep.tsx src/services/api.ts
git commit -m "fix: telegram onboarding shows real connect flow with deep link"
```

---

## Task 2: Fix Avatar Not Reflecting on Dashboard

**Problem:** After saving avatar in Settings, it doesn't appear in the dashboard header. Need to trace the exact data flow and fix the mismatch.

**Files:**
- Read: `src/services/api.ts` — find `userService.updateProfile()`
- Read: `src/stores/authStore.ts` — find `setUser()` and `User` type shape
- Read: `src/types/index.ts` — find `User` type
- Modify if needed: `src/dashboard/pages/SettingsPage.tsx`
- Modify if needed: `server/src/routes/users.ts`

### Step 1: Trace the data flow

Read `src/services/api.ts`. Find `userService.updateProfile()`. Note the return type — it calls `api.patch<User>('/users/me', data)`.

Read `src/types/index.ts`. Find the `User` interface. Check if it has an `avatar` field.

Read `src/stores/authStore.ts`. Find `setUser(user: User)`. Check if it does `set({ user })` correctly.

### Step 2: Check what PATCH /me actually returns

The `server/src/routes/users.ts` PATCH handler returns:
```typescript
res.json({
  id, email, username, name, avatar, bio, location, website, role, company,
  tags, theme: { mode: user.theme_mode, accentColor: user.theme_accent },
  plan, credits, createdAt
});
```

Note: this does NOT return `notifications` or `privacy` objects. If `setUser(updatedUser)` replaces the entire store user, these fields go missing.

### Step 3: Fix — merge rather than replace in setUser after profile save

In `src/dashboard/pages/SettingsPage.tsx`, update `handleSave` to merge the update into the existing user rather than replacing:

```typescript
// Read authStore to find the merge pattern. It may need:
const user = useAuthStore((s) => s.user);
const setUser = useAuthStore((s) => s.setUser);

const handleSave = async () => {
  setIsSaving(true);
  try {
    const { data: updatedUser } = await userService.updateProfile(profile);
    // Merge with existing user to preserve notifications/privacy/etc
    setUser({ ...user, ...updatedUser } as typeof user);
  } catch (err) {
    console.error('[settings] save failed:', err);
  } finally {
    setIsSaving(false);
  }
};
```

### Step 4: Also verify the avatar field mapping

The `profile.avatar` in SettingsPage must be a URL string. If it's empty string `''`, the server saves empty string and the img won't render. Make sure the dicebear "Generate" button sets a non-empty URL.

In SettingsPage, find the avatar generate button. Ensure it sets `profile.avatar` to a valid dicebear URL with the user's username as seed:

```typescript
const generateAvatar = () => {
  const seed = profile.username || profile.name || 'user';
  const newAvatar = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}&backgroundColor=7B61FF,0f0b1e`;
  setProfile({ ...profile, avatar: newAvatar });
};
```

### Step 5: Add avatar preview in settings

If settings doesn't already show a preview of the current avatar, add one so user can see it before saving:

Find where the avatar field is displayed in the Profile tab. Add:
```tsx
{profile.avatar && (
  <img src={profile.avatar} alt="Avatar preview" className="w-16 h-16 rounded-full object-cover border-2 border-[#7B61FF]/30" />
)}
```

### Step 6: Build and verify

```bash
cd /root/GeekSpace2.0 && npm run build
```

### Step 7: Commit

```bash
cd /root/GeekSpace2.0
git add src/dashboard/pages/SettingsPage.tsx src/stores/authStore.ts
git commit -m "fix: avatar merge into auth store preserves all user fields after settings save"
```

---

## Task 3: Remove Smoke Test Users from Live DB

**Problem:** Smoke test users (`smoketest*`, `smoke2test*`) created during deploy testing are in the live DB.

**Files:** No code changes — direct DB cleanup.

### Step 1: List smoke test users first

```bash
docker exec geekspace-app sqlite3 /app/data/geekspace.db \
  "SELECT id, username, email, created_at FROM users WHERE username LIKE 'smoketest%' OR username LIKE 'smoke2test%';"
```

### Step 2: Delete them (CASCADE handles related tables)

```bash
docker exec geekspace-app sqlite3 /app/data/geekspace.db \
  "DELETE FROM users WHERE username LIKE 'smoketest%' OR username LIKE 'smoke2test%';"
```

### Step 3: Verify cleanup

```bash
docker exec geekspace-app sqlite3 /app/data/geekspace.db \
  "SELECT COUNT(*) FROM users WHERE username LIKE 'smoketest%' OR username LIKE 'smoke2test%';"
```
Expected: `0`

### Step 4: Commit (no code changes — just a note)

```bash
cd /root/GeekSpace2.0
git commit --allow-empty -m "chore: removed smoke test users from live DB"
```

---

## Task 4: Billing Plan Restructure (Pilot + Slashed Prices + Day Pass)

**Problem:** `monthly` plan needs to become `pilot` at ₹299, all prices updated with slashed originals, day pass endpoint added.

**Files:**
- Modify: `server/src/db/index.ts` — `PlanDefinition` interface + `PLAN_DEFINITIONS`
- Modify: `server/src/middleware/validate.ts` — add 'pilot' to billingUpgradeSchema
- Modify: `server/src/routes/billing.ts` — add `POST /api/billing/day-pass`
- Modify: `src/types/index.ts` — add `originalPriceInr?` to PlanDefinition
- Modify: `src/dashboard/pages/BillingPage.tsx` — show slashed prices + day pass CTA

### Step 1: Update PlanDefinition interface in server/src/db/index.ts

Find the `PlanDefinition` interface (around line 385). Add the new fields:

```typescript
export interface PlanDefinition {
  credits: number;
  priceUsd: number;
  priceInr: number;
  originalPriceInr?: number;  // shown as slashed price in UI
  intervalDays: number;
  intervalLabel: string;
  description: string;
  badge?: string;
  picoSlots: number;          // max Pico agents for this plan
}
```

### Step 2: Update PLAN_DEFINITIONS in server/src/db/index.ts

Replace the `PLAN_DEFINITIONS` object entirely:

```typescript
export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  free: {
    credits: 5000, priceUsd: 0, priceInr: 0,
    intervalDays: 30, intervalLabel: 'month',
    description: 'Local Engine only — try PicoClaw for $1/day',
    picoSlots: 0,
  },
  pilot: {
    credits: 100000, priceUsd: 4, priceInr: 299,
    intervalDays: 30, intervalLabel: 'month',
    description: 'Dual PicoClaw agents + all engines',
    badge: 'New',
    picoSlots: 2,
  },
  intro: {
    credits: 100000, priceUsd: 12, priceInr: 999, originalPriceInr: 1999,
    intervalDays: 60, intervalLabel: '2 months',
    description: 'All engines + personalities — best to start',
    badge: 'Best to start',
    picoSlots: 2,
  },
  halfyear: {
    credits: 700000, priceUsd: 35, priceInr: 2999, originalPriceInr: 3999,
    intervalDays: 180, intervalLabel: '6 months',
    description: 'Everything + priority support',
    badge: 'Most popular',
    picoSlots: 3,
  },
  yearly: {
    credits: 1500000, priceUsd: 60, priceInr: 4999, originalPriceInr: 5999,
    intervalDays: 365, intervalLabel: 'year',
    description: 'Everything + Kimi reasoning included',
    badge: 'Best value',
    picoSlots: 3,
  },
};
```

> **Note:** The old `monthly` key is replaced by `pilot`. Existing users with `plan = 'monthly'` in the DB will still work — the billing logic just won't find a matching definition. Add a fallback or migration:

After the `PLAN_DEFINITIONS` block, add:
```typescript
// Alias: 'monthly' maps to 'pilot' for existing users
PLAN_DEFINITIONS['monthly'] = { ...PLAN_DEFINITIONS['pilot'], badge: undefined };
```

### Step 3: Add day_passes table migration in server/src/db/index.ts

In the `initDatabase()` function (or wherever migrations run), add:

```typescript
// Day passes for free users — $1 for 24hr PicoClaw access
db.exec(`
  CREATE TABLE IF NOT EXISTS day_passes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    credits_granted INTEGER DEFAULT 2000,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_day_passes_user ON day_passes(user_id);
  CREATE INDEX IF NOT EXISTS idx_day_passes_expires ON day_passes(expires_at);
`);
```

### Step 4: Update validate.ts billingUpgradeSchema

Find `billingUpgradeSchema` in `server/src/middleware/validate.ts`. Add 'pilot' to the plan enum:

```typescript
export const billingUpgradeSchema = z.object({
  plan: z.enum(['free', 'pilot', 'intro', 'halfyear', 'yearly']),
  currency: z.enum(['USD', 'INR']).optional(),
});
```

### Step 5: Add day-pass endpoint to billing.ts

```typescript
// POST /api/billing/day-pass — $1 for 24hr PicoClaw access (free users only)
billingRouter.post('/day-pass', requireAuth, async (req: AuthRequest, res) => {
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(req.userId!) as { plan: string } | undefined;
  if (sub?.plan !== 'free') {
    res.status(400).json({ error: 'Day pass is only available on the free plan. Upgrade for full access.' });
    return;
  }

  // Check for active day pass
  const activePas = db.prepare(
    "SELECT id FROM day_passes WHERE user_id = ? AND expires_at > datetime('now')"
  ).get(req.userId!) as { id: string } | undefined;
  if (activePas) {
    res.status(400).json({ error: 'You already have an active day pass.' });
    return;
  }

  // In production, charge $1 here via payment gateway (Razorpay/Stripe)
  // For now: grant the pass immediately (payment hook to be added later)
  const id = uuid();
  db.prepare(`
    INSERT INTO day_passes (id, user_id, expires_at, credits_granted)
    VALUES (?, ?, datetime('now', '+1 day'), 2000)
  `).run(id, req.userId);

  // Grant 2000 bonus credits
  db.prepare(`
    UPDATE subscriptions SET credits_remaining = credits_remaining + 2000 WHERE user_id = ?
  `).run(req.userId!);

  res.json({ message: 'Day pass activated! You have 24 hours of PicoClaw access.', expiresAt: new Date(Date.now() + 86400000).toISOString() });
});

// GET /api/billing/day-pass — check if user has active day pass
billingRouter.get('/day-pass', requireAuth, (req: AuthRequest, res) => {
  const pass = db.prepare(
    "SELECT expires_at FROM day_passes WHERE user_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1"
  ).get(req.userId!) as { expires_at: string } | undefined;
  res.json({ active: !!pass, expiresAt: pass?.expires_at || null });
});
```

### Step 6: Invalidate billing cache after plan changes

Add `await cacheDel('billing:plans')` and `await import('../services/cache.js').then(c => c.cacheDel('billing:plans'))` in the upgrade handler — or just let the 1hr TTL expire. Since PLAN_DEFINITIONS is a constant, the cached value is always valid. No change needed.

### Step 7: Update frontend types in src/types/index.ts

Find `PlanDefinition` interface. Add:
```typescript
export interface PlanDefinition {
  id: string;
  credits: number;
  priceUsd: number;
  priceInr: number;
  originalPriceInr?: number;   // slashed original price
  intervalDays: number;
  intervalLabel: string;
  description: string;
  badge?: string;
  picoSlots?: number;
}
```

### Step 8: Update BillingPage.tsx to show slashed prices + Pilot + Day Pass CTA

In `src/dashboard/pages/BillingPage.tsx`:

1. Find where the price is displayed in the plan card. Add slashed price:
```tsx
{/* Inside the plan card price display */}
<div className="flex items-baseline gap-2">
  <span className="text-2xl font-bold text-[#F4F6FF]">{price(plan)}</span>
  {currency === 'INR' && plan.originalPriceInr && (
    <span className="text-sm text-[#A7ACB8] line-through">₹{plan.originalPriceInr.toLocaleString()}</span>
  )}
  <span className="text-sm text-[#A7ACB8]">/{plan.intervalLabel}</span>
</div>
```

2. Find where the `free` plan card is rendered. Add day pass CTA below the "Current Plan" badge (only show for free users):
```tsx
{subscription?.plan === 'free' && plan.id === 'free' && (
  <button
    onClick={() => handleDayPass()}
    className="w-full mt-2 py-1.5 px-3 rounded-lg border border-[#7B61FF]/30 text-[#7B61FF] text-xs hover:bg-[#7B61FF]/10 transition-colors"
  >
    Try PicoClaw for $1/day →
  </button>
)}
```

3. Add `handleDayPass` function:
```typescript
const handleDayPass = async () => {
  try {
    const { data } = await billingService.activateDayPass();
    setToast({ message: data.message, type: 'success' });
    const { data: sub } = await billingService.getPlan();
    setSubscription(sub);
  } catch (err: any) {
    setToast({ message: err.response?.data?.error || 'Day pass failed', type: 'error' });
  }
};
```

4. Add `activateDayPass` to `billingService` in `src/services/api.ts`:
```typescript
activateDayPass: () => api.post<{ message: string; expiresAt: string }>('/billing/day-pass'),
```

### Step 9: Build server and frontend

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```
Expected: zero TypeScript errors in both.

### Step 10: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/db/index.ts server/src/middleware/validate.ts server/src/routes/billing.ts \
        src/types/index.ts src/dashboard/pages/BillingPage.tsx src/services/api.ts
git commit -m "feat: billing restructure — Pilot plan, slashed prices, day pass for free users"
```

---

## Task 5: Wire Notification Settings to Backend

**Problem:** Notification toggles in Settings > Notifications are local state only — changes never save to the DB.

**Files:**
- Modify: `server/src/routes/users.ts` — add notification fields to directFields
- Modify: `src/dashboard/pages/SettingsPage.tsx` — auto-save notifications on toggle

### Step 1: Add notification fields to PATCH /me directFields

In `server/src/routes/users.ts`, find `directFields`. Add:

```typescript
const directFields: Record<string, string> = {
  name: 'name', username: 'username', bio: 'bio', avatar: 'avatar',
  location: 'location', website: 'website', role: 'role', company: 'company',
  theme_mode: 'theme_mode', theme_accent: 'theme_accent',
  // Notification preferences (booleans stored as 0/1)
  notification_email: 'notification_email',
  notification_push: 'notification_push',
  notification_telegram: 'notification_telegram',
  notification_agent: 'notification_agent',
  notification_reminders: 'notification_reminders',
  notification_weekly: 'notification_weekly',
};
```

### Step 2: Wire notification toggles in SettingsPage.tsx

Read the existing Notifications tab in SettingsPage.tsx. Find the toggles for `emailReminders`, `pushNotifications`, `weeklyDigest`, etc.

For each toggle's `onCheckedChange`, add an auto-save call. The key is to map local state keys to the server field names.

Add this helper at the top of the `SettingsPage` component:

```typescript
const saveNotification = async (field: string, value: boolean) => {
  try {
    await userService.updateProfile({ [field]: value ? 1 : 0 });
  } catch {
    // Silent fail — local state still updated
  }
};
```

Then update each toggle to call `saveNotification`:

```tsx
// emailReminders toggle:
onCheckedChange={(checked) => {
  setNotifications({ ...notifications, emailReminders: checked });
  void saveNotification('notification_email', checked);
}}

// weeklyDigest toggle:
onCheckedChange={(checked) => {
  setNotifications({ ...notifications, weeklyDigest: checked });
  void saveNotification('notification_weekly', checked);
}}
```

Map the local state keys to server fields:
- `emailReminders` → `notification_email`
- `pushNotifications` → `notification_push`
- `weeklyDigest` → `notification_weekly`
- `securityAlerts` → `notification_agent`

### Step 3: Initialize notification state from user store (not hardcoded)

In SettingsPage, the `notifications` state is initialized with hardcoded `true/false`. Fix to read from user:

```typescript
const [notifications, setNotifications] = useState({
  emailReminders: user?.notifications?.email ?? true,
  pushNotifications: user?.notifications?.push ?? false,
  weeklyDigest: user?.notifications?.weeklyDigest ?? true,
  marketingEmails: false,
  securityAlerts: user?.notifications?.agentUpdates ?? true,
});
```

### Step 4: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/users.ts src/dashboard/pages/SettingsPage.tsx
git commit -m "fix: notification settings save to backend on toggle change"
```

---

## Task 6: Theme Mode Actually Working

**Problem:** Theme tab dark/light/system buttons are hardcoded to always highlight "dark" — clicking them does nothing. `themeStore.setMode()` exists but is never called.

**Files:**
- Modify: `src/stores/themeStore.ts` — apply theme class to document on mode change
- Modify: `src/dashboard/pages/SettingsPage.tsx` — wire buttons to themeStore
- Modify: `src/App.tsx` (or root component) — apply theme on initial load
- Modify: `server/src/routes/users.ts` — theme_mode already in directFields (added in Task 5)

### Step 1: Update themeStore to apply theme to document

In `src/stores/themeStore.ts`, update `setMode` to actually apply the class:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'system' | 'light' | 'dark';

function applyTheme(mode: ThemeMode) {
  const effective = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.classList.remove('dark', 'light');
  if (effective === 'dark') document.documentElement.classList.add('dark');
}

interface ThemeStore {
  mode: ThemeMode;
  accentColor: string;
  accentPresets: string[];
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  applyTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      accentColor: '#7B61FF',
      accentPresets: [
        '#7B61FF', '#61FF7B', '#FF61DC', '#61B5FF',
        '#FFD761', '#FF6161', '#61FFD7', '#FF9B61',
      ],
      setMode: (mode) => {
        set({ mode });
        applyTheme(mode);
      },
      setAccentColor: (accentColor) => {
        set({ accentColor });
        document.documentElement.style.setProperty('--accent-dynamic', accentColor);
      },
      applyTheme: () => applyTheme(get().mode),
    }),
    { name: 'gs-theme' },
  ),
);
```

### Step 2: Apply theme on app load

Find the root App component (`src/App.tsx` or `src/main.tsx`). Add a one-time effect to apply the stored theme on load:

```typescript
// In App.tsx or the root component, add:
import { useThemeStore } from '@/stores/themeStore';

// Inside the component:
const applyTheme = useThemeStore((s) => s.applyTheme);
useEffect(() => { applyTheme(); }, [applyTheme]);
```

### Step 3: Wire theme mode buttons in SettingsPage.tsx

In SettingsPage, add `useThemeStore`:

```typescript
const { mode: themeMode, setMode: setThemeMode, accentColor, accentPresets, setAccentColor } = useThemeStore();
```

Find the theme mode buttons (dark/light/system). Replace the hardcoded active class logic:

```tsx
{(['dark', 'light', 'system'] as const).map((m) => (
  <button
    key={m}
    onClick={() => {
      setThemeMode(m);
      void userService.updateProfile({ theme_mode: m });
    }}
    className={`flex-1 p-4 rounded-xl border-2 capitalize transition-all ${
      themeMode === m
        ? 'border-[#7B61FF] bg-[#7B61FF]/10 text-[#7B61FF]'
        : 'border-[#7B61FF]/20 text-[#A7ACB8] hover:border-[#7B61FF]/40'
    }`}
  >
    {m}
  </button>
))}
```

### Step 4: Initialize theme from user preferences on login

In `src/stores/authStore.ts`, find where the user is set after login (`login()` action). After `set({ user, token })`, call `useThemeStore.getState().setMode(user.theme?.mode || 'dark')`.

Actually — don't cross-store in Zustand actions. Instead, in `DashboardApp.tsx`, add:

```typescript
const applyTheme = useThemeStore((s) => s.applyTheme);
const themeMode = user?.theme?.mode as 'dark' | 'light' | 'system' | undefined;
const setThemeMode = useThemeStore((s) => s.setMode);

useEffect(() => {
  if (themeMode) setThemeMode(themeMode);
}, [themeMode, setThemeMode]);
```

### Step 5: Build

```bash
cd /root/GeekSpace2.0 && npm run build
```

### Step 6: Commit

```bash
cd /root/GeekSpace2.0
git add src/stores/themeStore.ts src/dashboard/pages/SettingsPage.tsx src/App.tsx
git commit -m "fix: theme mode toggle actually applies dark/light/system to document"
```

---

# WAVE 2: Pico OS Core

---

## Task 7: PicoContext Loader Service

**Goal:** Create a shared `PicoContext.load(userId)` function that assembles full user context for injection into every Pico LLM call.

**Files:**
- Create: `server/src/services/pico-context.ts`
- Modify: `server/src/routes/agent.ts` — use PicoContext in `buildSystemPrompt()`

### Step 1: Create server/src/services/pico-context.ts

```typescript
// server/src/services/pico-context.ts
// Assembles full user context for PicoClaw — injected into every LLM call.
// Target: < 800 tokens for the context block.

import { db } from '../db/index.js';

export interface PicoContext {
  recentMemories: string;      // last 20 memories, summarized
  activeReminders: string;     // next 5 due reminders
  pendingTasks: string;        // in-progress/queued pico tasks
  portfolio: string;           // headline + skills
  integrations: string;        // connected channels
  personality: string;         // weebo/jarvis/edith
  modelPreference: string;     // local/cloud/premium/auto
  todaySummary: string;        // latest auto_summary memory
}

export function loadPicoContext(userId: string): PicoContext {
  // Recent memories (last 20, prefer auto_summary first)
  const memories = db.prepare(`
    SELECT content, tags FROM agent_memory
    WHERE user_id = ?
    ORDER BY CASE WHEN tags LIKE '%auto_summary%' THEN 0 ELSE 1 END ASC,
             created_at DESC
    LIMIT 20
  `).all(userId) as { content: string; tags: string }[];

  const todaySummary = memories.find(m => m.tags?.includes('auto_summary'))?.content || '';
  const recentMemories = memories
    .filter(m => !m.tags?.includes('auto_summary'))
    .slice(0, 10)
    .map(m => `• ${m.content}`)
    .join('\n') || 'No memories yet.';

  // Active reminders (next 5 due)
  const reminders = db.prepare(`
    SELECT text, datetime, category FROM reminders
    WHERE user_id = ? AND completed = 0
    ORDER BY datetime ASC LIMIT 5
  `).all(userId) as { text: string; datetime: string; category: string }[];

  const activeReminders = reminders.length > 0
    ? reminders.map(r => `• [${r.category}] ${r.text} — due ${r.datetime}`).join('\n')
    : 'No active reminders.';

  // Pending Pico tasks
  const tasks = db.prepare(`
    SELECT pt.description, pt.status, pa.name as agent_name
    FROM pico_tasks pt
    JOIN pico_agents pa ON pt.agent_id = pa.id
    WHERE pt.user_id = ? AND pt.status IN ('queued', 'running')
    ORDER BY pt.created_at DESC LIMIT 5
  `).all(userId) as { description: string; status: string; agent_name: string }[];

  const pendingTasks = tasks.length > 0
    ? tasks.map(t => `• [${t.agent_name}/${t.status}] ${t.description}`).join('\n')
    : 'No active tasks.';

  // Portfolio snapshot
  const portfolio = db.prepare(`
    SELECT headline, about, skills FROM portfolios WHERE user_id = ?
  `).get(userId) as { headline: string; about: string; skills: string } | undefined;

  const skillsList = (() => { try { return JSON.parse(portfolio?.skills || '[]').slice(0, 5).join(', '); } catch { return ''; } })();
  const portfolioSnap = portfolio
    ? `Headline: ${portfolio.headline || 'Not set'}\nSkills: ${skillsList || 'None listed'}`
    : 'Portfolio not set up yet.';

  // Connected integrations
  const integrations = db.prepare(`
    SELECT name FROM integrations WHERE user_id = ? AND status = 'connected'
  `).all(userId) as { name: string }[];

  const integrationsStr = integrations.length > 0
    ? integrations.map(i => i.name).join(', ')
    : 'None connected';

  // Agent config
  const agentConfig = db.prepare(
    'SELECT personality, model_preference FROM agent_configs WHERE user_id = ?'
  ).get(userId) as { personality: string; model_preference: string } | undefined;

  return {
    recentMemories,
    activeReminders,
    pendingTasks,
    portfolio: portfolioSnap,
    integrations: integrationsStr,
    personality: agentConfig?.personality || 'jarvis',
    modelPreference: agentConfig?.model_preference || 'auto',
    todaySummary,
  };
}

export function formatContextBlock(ctx: PicoContext): string {
  return `--- PICO CONTEXT ---
Today's Summary: ${ctx.todaySummary || 'No summary yet.'}

Recent Memories:
${ctx.recentMemories}

Active Reminders:
${ctx.activeReminders}

Pending Tasks:
${ctx.pendingTasks}

Portfolio:
${ctx.portfolio}

Connected: ${ctx.integrations}
--- END CONTEXT ---`;
}
```

### Step 2: Add model_preference column migration

In `server/src/db/index.ts`, in the migrations section, add:

```typescript
try {
  db.exec(`ALTER TABLE agent_configs ADD COLUMN model_preference TEXT DEFAULT 'auto'`);
} catch { /* column already exists */ }
```

### Step 3: Use PicoContext in buildSystemPrompt()

In `server/src/routes/agent.ts`, find `buildSystemPrompt()`. It already uses `buildMemoryContext()`. Replace or augment with `formatContextBlock()`:

```typescript
import { loadPicoContext, formatContextBlock } from '../services/pico-context.js';

// In buildSystemPrompt():
const picoCtx = loadPicoContext(userId);
const contextBlock = formatContextBlock(picoCtx);

// Add contextBlock to the returned system prompt string, after OPENCLAW_IDENTITY and personality
return `${OPENCLAW_IDENTITY}

--- PERSONALITY ---
${personalityPrompt}

${contextBlock}

--- USER SESSION ---
Name: ${userName}
Voice: ${voice} | Mode: ${mode}
${customPrompt ? `\nCustom instructions: ${customPrompt}` : ''}`;
```

### Step 4: Build server

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/pico-context.ts server/src/db/index.ts server/src/routes/agent.ts
git commit -m "feat: PicoContext loader — full user context injected into every Pico call"
```

---

## Task 8: Smart Model Router (User Preference + Speed Check)

**Goal:** PicoClaw picks the fastest appropriate model based on user preference + task complexity.

**Files:**
- Modify: `server/src/services/llm.ts` — add `pickProvider()` function
- Modify: `server/src/routes/agent.ts` — use `pickProvider()` in main chat handler

### Step 1: Add pickProvider() to server/src/services/llm.ts

Find the end of `llm.ts`. Add:

```typescript
// ---- Smart Provider Picker ----

export type UserModelPreference = 'local' | 'cloud' | 'premium' | 'auto';

export async function pickProvider(
  userId: string,
  messageText: string,
  userPlan: string,
): Promise<Provider> {
  // Read user preference
  const agentConfig = db.prepare('SELECT model_preference FROM agent_configs WHERE user_id = ?')
    .get(userId) as { model_preference: string } | undefined;
  const preference = (agentConfig?.model_preference || 'auto') as UserModelPreference;

  // Hard overrides by plan (free users can't use Kimi unless day pass)
  const isPremiumPlan = ['halfyear', 'yearly'].includes(userPlan);
  const isPaidPlan = ['pilot', 'intro', 'halfyear', 'yearly'].includes(userPlan);

  if (preference === 'local') return 'ollama';
  if (preference === 'cloud') return isPaidPlan ? 'openrouter-free' : 'ollama';
  if (preference === 'premium') return isPremiumPlan ? 'edith' : (isPaidPlan ? 'openrouter-free' : 'ollama');

  // Auto: check complexity + plan
  const intent = await classifyIntent(messageText);
  if (['planning', 'complex'].includes(intent)) {
    if (isPremiumPlan) return 'edith';
    if (isPaidPlan) return 'openrouter-free';
    return 'ollama';
  }

  // Simple queries: try Ollama first (fast on simple, slow on complex)
  // For now default to existing intent-based routing
  return 'ollama';
}
```

### Step 2: Use pickProvider() in the chat handler

In `server/src/routes/agent.ts`, find the `POST /chat` handler. Before the `routeChat()` call, add provider selection:

```typescript
// Get user plan
const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined;
const userPlan = sub?.plan || 'free';

// Pick provider based on user preference + complexity
const smartProvider = await pickProvider(userId, userMessage, userPlan);
// Pass as forceProvider only if not 'ollama' (let existing intent routing handle simple cases)
const providerOverride = smartProvider !== 'ollama' ? { forceProvider: smartProvider as Provider } : {};

const result = await routeChat(messages, providerOverride);
```

### Step 3: Build server

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 4: Expose model_preference in AgentSettingsPage

In `src/dashboard/pages/AgentSettingsPage.tsx`, add a model preference picker. Read the file first to understand existing structure, then add a section:

```tsx
{/* Model Preference */}
<div className="space-y-3">
  <h3 className="text-sm font-medium text-[#A7ACB8]">AI Engine Preference</h3>
  <div className="grid grid-cols-2 gap-2">
    {[
      { value: 'auto', label: 'Auto', desc: 'Pico decides best model' },
      { value: 'local', label: 'Local', desc: 'Always use Ollama (fastest for simple)' },
      { value: 'cloud', label: 'Cloud', desc: 'OpenRouter free tier' },
      { value: 'premium', label: 'Premium', desc: 'Kimi K2 reasoning (uses more credits)' },
    ].map((opt) => (
      <button
        key={opt.value}
        onClick={() => handleSavePreference('model_preference', opt.value)}
        className={`p-3 rounded-xl border text-left transition-all ${
          modelPreference === opt.value
            ? 'border-[#7B61FF] bg-[#7B61FF]/10'
            : 'border-[#7B61FF]/20 hover:border-[#7B61FF]/40'
        }`}
      >
        <div className="text-sm font-medium text-[#F4F6FF]">{opt.label}</div>
        <div className="text-xs text-[#A7ACB8]">{opt.desc}</div>
      </button>
    ))}
  </div>
</div>
```

Add `model_preference` to the agent config PATCH endpoint in `server/src/routes/agent.ts` `agentConfigUpdateSchema` if not already there:

```typescript
// In validate.ts, agentConfigUpdateSchema, add:
model_preference: z.enum(['auto', 'local', 'cloud', 'premium']).optional(),
```

And in the PATCH /config handler, add `model_preference` to the fields that get saved.

### Step 5: Build both

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 6: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/llm.ts server/src/routes/agent.ts \
        server/src/middleware/validate.ts src/dashboard/pages/AgentSettingsPage.tsx
git commit -m "feat: smart model router — user preference + plan-aware provider selection"
```

---

## Task 9: Worker Sleep/Wake Efficiency

**Goal:** Pico worker throttles to 5-min poll when idle, wakes immediately on new task.

**Files:**
- Modify: `server/src/services/pico-fleet.ts` — update `startPicoWorker()`
- Modify: `server/src/config.ts` — add `PICO_IDLE_INTERVAL_MS`

### Step 1: Add PICO_IDLE_INTERVAL_MS to config

In `server/src/config.ts`, add:
```typescript
picoIdleIntervalMs: optionalInt('PICO_IDLE_INTERVAL_MS', 300000), // 5 min
```

### Step 2: Update startPicoWorker() in pico-fleet.ts

Find `startPicoWorker()`. Replace the fixed `setInterval` with an adaptive polling loop:

```typescript
export function startPicoWorker(): void {
  let idleStreak = 0;           // consecutive ticks with no work
  const IDLE_THRESHOLD = 10;    // after 10 idle ticks → slow mode
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  async function tick() {
    const worked = await processPendingTasks();  // returns true if any task was processed
    if (worked) {
      idleStreak = 0;
    } else {
      idleStreak++;
    }

    const interval = idleStreak >= IDLE_THRESHOLD
      ? config.picoIdleIntervalMs   // 5 min when idle
      : config.picoWorkerIntervalMs; // 30s normally

    timeoutHandle = setTimeout(tick, interval);
  }

  // Start the loop
  tick();
  logger.info({ normal: config.picoWorkerIntervalMs, idle: config.picoIdleIntervalMs }, 'Pico worker started (adaptive)');
}

// Export a function to wake the worker immediately (call after task creation)
let _wakeCallback: (() => void) | null = null;
export function wakeWorker() {
  // Reset idle streak — next tick will be fast
  // Since we use setTimeout, we just let it run; the streak reset happens on next task processing
}
```

### Step 3: Call wakeWorker() after task creation

In `server/src/routes/pico.ts`, find the `POST /tasks/plan` endpoint. After inserting tasks, the worker will pick them up. Since the timeout handles this naturally, no explicit wake is needed — just ensure the worker interval is reasonable.

### Step 4: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/pico-fleet.ts server/src/config.ts
git commit -m "feat: Pico worker adaptive sleep — 30s active, 5min idle"
```

---

## Task 10: Weebo Quick Tasks — Routing + Escalation + Telegram Notify

**Goal:** Pico tasks use Ollama for simple, OpenRouter for medium, and ask user before Kimi for premium.

**Files:**
- Modify: `server/src/services/pico-fleet.ts` — `planTasks()` routing
- Modify: `server/src/routes/pico.ts` — `POST /tasks/plan` response with escalation prompt

### Step 1: Read current planTasks() in pico-fleet.ts

Find `planTasks()` — it currently calls `edithChat()` (Kimi) for all planning. Identify what it returns.

### Step 2: Add complexity estimator + cheap planner

In `pico-fleet.ts`, add:

```typescript
function estimateComplexity(request: string): 'simple' | 'medium' | 'complex' {
  const lower = request.toLowerCase();
  const complexKeywords = ['analyze', 'research', 'compare', 'generate report', 'multi-step', 'workflow'];
  const simpleKeywords = ['remind me', 'send', 'message', 'set reminder', 'notify', 'deploy portfolio'];
  if (complexKeywords.some(k => lower.includes(k))) return 'complex';
  if (simpleKeywords.some(k => lower.includes(k))) return 'simple';
  return request.split(' ').length > 15 ? 'medium' : 'simple';
}
```

Update `planTasks()` to use cheap model for simple tasks:

```typescript
export async function planTasks(userId: string, request: string, userPlan: string): Promise<PlannedTask[]> {
  const complexity = estimateComplexity(request);
  const isPremium = ['halfyear', 'yearly'].includes(userPlan);

  // For simple tasks: use a fast inline template parser (no LLM cost)
  if (complexity === 'simple') {
    return parseSimpleTask(request, userId);
  }

  // For medium complexity: use edith (Kimi) — it's fast and accurate for JSON
  // For complex on free plan: return a flag to ask user
  if (complexity === 'complex' && !isPremium) {
    // Return special marker — route handler will send escalation prompt to user
    throw Object.assign(new Error('ESCALATE'), { code: 'ESCALATE_TO_PREMIUM' });
  }

  // Medium or complex + premium: use Kimi
  return await planWithKimi(userId, request);
}

function parseSimpleTask(request: string, _userId: string): PlannedTask[] {
  const lower = request.toLowerCase();
  // Reminder pattern
  if (lower.includes('remind') || lower.includes('reminder')) {
    return [{
      task_type: 'create_reminder',
      description: request,
      config: { text: request, datetime: new Date(Date.now() + 86400000).toISOString() },
      agent_slot: 1,
    }];
  }
  // Telegram message pattern
  if (lower.includes('send') && (lower.includes('message') || lower.includes('telegram'))) {
    return [{
      task_type: 'telegram_message',
      description: request,
      config: { message: request },
      agent_slot: 1,
    }];
  }
  // Portfolio deploy
  if (lower.includes('deploy') || lower.includes('publish portfolio')) {
    return [{
      task_type: 'portfolio_deploy',
      description: 'Deploy portfolio',
      config: {},
      agent_slot: 1,
    }];
  }
  // Fallback to Kimi for anything unclear
  return planWithKimi(_userId, request) as unknown as PlannedTask[];
}

async function planWithKimi(userId: string, request: string): Promise<PlannedTask[]> {
  // Existing Kimi planning logic (moved from planTasks)
  // ... existing edithChat() call ...
}
```

### Step 3: Update POST /tasks/plan in pico.ts

```typescript
picoRouter.post('/tasks/plan', requireAuth, async (req: AuthRequest, res) => {
  const { request } = req.body;
  if (!request?.trim()) { res.status(400).json({ error: 'request is required' }); return; }

  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(req.userId!) as { plan: string } | undefined;
  const userPlan = sub?.plan || 'free';

  try {
    const planned = await planTasks(req.userId!, request, userPlan);
    // ... queue tasks as before ...
    res.json({ tasks: queued, message: `Queued ${queued.length} task(s) for your agents.` });
  } catch (err: any) {
    if (err.code === 'ESCALATE_TO_PREMIUM') {
      res.json({
        escalate: true,
        message: "This task looks complex. Want Edith (Kimi) to plan it? It costs ~10 credits but gets better results.",
        request,
      });
      return;
    }
    throw err;
  }
});

// New endpoint: force Kimi for escalated tasks
picoRouter.post('/tasks/plan-premium', requireAuth, async (req: AuthRequest, res) => {
  const { request } = req.body;
  const planned = await planWithKimi(req.userId!, request);
  // Queue and return as normal
});
```

### Step 4: Frontend — handle escalation response in PicoFleetPage

In `src/dashboard/pages/PicoFleetPage.tsx`, after `picoService.planTask()`:

```typescript
const { data } = await picoService.planTask(taskInput);
if (data.escalate) {
  // Show escalation dialog
  setEscalateRequest(data.request);
  setEscalateMessage(data.message);
  setShowEscalateDialog(true);
} else {
  // Normal success
  setTaskSuccess(`Queued ${data.tasks.length} task(s)!`);
}
```

### Step 5: Build both

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 6: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/pico-fleet.ts server/src/routes/pico.ts src/dashboard/pages/PicoFleetPage.tsx
git commit -m "feat: Weebo task routing — simple/Ollama, medium/Kimi, complex escalation for free users"
```

---

## Task 11: Onboarding Bio Magic — Single Kimi Call

**Goal:** Replace 2 parallel generate-content calls with 1 Kimi call returning JSON `{headline, bio}`.

**Files:**
- Modify: `src/onboarding/steps/BioStep.tsx`
- Modify: `src/onboarding/steps/PortfolioStep.tsx`
- Modify: `server/src/routes/agent.ts` — add a `generateBatch` type

### Step 1: Add 'batch-bio' type to generate-content server handler

In `server/src/routes/agent.ts`, find the `generate-content` handler. Add a new `type`:

```typescript
const prompts: Record<string, string> = {
  headline: `...`,
  bio: `...`,
  about: `...`,
  skills: `...`,
  // NEW: single call for both headline and bio
  'bio-batch': `You are helping a developer set up their GeekSpace AI profile.
Return ONLY valid JSON in this exact format, no other text:
{"headline": "string under 80 chars", "bio": "2-3 sentence professional summary"}

User's name: "${name || 'a developer'}"
Their skills/interests: ${tags.join(', ')}`,
  // NEW: single call for portfolio section
  'portfolio-batch': `You are helping a developer complete their portfolio.
Return ONLY valid JSON in this exact format, no other text:
{"headline": "string under 80 chars", "about": "2-3 sentence about section", "skills": ["skill1","skill2","skill3","skill4","skill5"]}

User's name: "${name || 'a developer'}"
Their skills/interests: ${tags.join(', ')}`,
};
```

For batch types, parse the JSON response before returning:

```typescript
const raw = result.text.trim();
// For batch types, parse and return structured data
if (type.endsWith('-batch')) {
  try {
    const parsed = JSON.parse(raw.replace(/^```json\n?|\n?```$/g, ''));
    res.json({ content: raw, parsed });
    return;
  } catch {
    res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' });
    return;
  }
}
res.json({ content: raw.replace(/^["']|["']$/g, '') });
```

### Step 2: Update BioStep.tsx to use single batch call

In `src/onboarding/steps/BioStep.tsx`, find the magic trick button handler:

```typescript
// Replace:
const [headline, bio] = await Promise.all([
  agentService.generateContent('headline', tags, name),
  agentService.generateContent('bio', tags, name),
]);

// With:
const { data } = await agentService.generateContent('bio-batch', tags, name);
const headline = data.parsed?.headline || '';
const bio = data.parsed?.bio || '';
```

Update `agentService.generateContent()` in `src/services/api.ts` to return the parsed field:

```typescript
generateContent: (type: string, tags: string[], name?: string) =>
  api.post<{ content: string; parsed?: Record<string, unknown> }>('/agent/generate-content', { type, tags, name }),
```

### Step 3: Update PortfolioStep.tsx similarly

Replace 3 parallel calls with 1 `portfolio-batch` call. Parse `data.parsed.headline`, `data.parsed.about`, `data.parsed.skills`.

### Step 4: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts src/onboarding/steps/BioStep.tsx \
        src/onboarding/steps/PortfolioStep.tsx src/services/api.ts
git commit -m "feat: onboarding magic trick uses single Kimi batch call — 2x faster"
```

---

## Task 12: Terminal Jarvis on OpenRouter Free

**Goal:** `ai "prompt"` in the terminal routes through Jarvis personality on best free OpenRouter model.

**Files:**
- Modify: `server/src/routes/agent.ts` — find terminal `ai` command handler
- Modify: `src/dashboard/pages/TerminalPage.tsx` — optionally show "Jarvis:" prefix

### Step 1: Find the terminal AI handler in agent.ts

Search for `terminal` in `server/src/routes/agent.ts`. Find the handler that processes `ai "prompt"` commands. It likely calls `agentService.chat(prompt, 'terminal')`.

### Step 2: Route terminal chat to openrouter-free with Jarvis

In the chat handler, when `req.body.context === 'terminal'`, force Jarvis personality on openrouter-free:

```typescript
// In the POST /chat handler, add:
const isTerminal = req.body.context === 'terminal';
if (isTerminal) {
  // Terminal always uses Jarvis on free tier (fast, cheap, butler-style)
  const terminalResult = await routeChat(messages, {
    forceProvider: 'openrouter-free' as Provider,
    systemPromptOverride: `${OPENCLAW_IDENTITY}\n\n${getPersonalityPrompt('jarvis')}\n\nYou are assisting via the GeekSpace terminal. Be concise. Format responses for terminal output — no markdown headers, use plain text or simple ASCII. Code examples are fine.`,
  });
  // Return with jarvis provider label
  res.json({ text: terminalResult.text, provider: 'jarvis-terminal', creditCost: terminalResult.creditCost });
  return;
}
```

> **Note:** Check if `routeChat()` supports `systemPromptOverride`. If not, build the messages array with a custom system message before calling `routeChat()`.

### Step 3: Build server

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 4: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts
git commit -m "feat: terminal AI uses Jarvis personality on OpenRouter free tier"
```

---

# WAVE 3: Networking & Themes

---

## Task 13: Portfolio Connection Counter + Visitor Memory

**Goal:** Every portfolio visitor interaction saves a memory for the owner, increments a connection counter, and sends a Telegram notification.

**Files:**
- Modify: `server/src/db/index.ts` — add `connection_count`, `last_connected_at` to portfolios
- Modify: `server/src/routes/agent.ts` — `POST /chat/public/:username` handler
- Modify: `src/portfolio/PortfolioView.tsx` — display connection counter

### Step 1: Add columns to portfolios table

In `server/src/db/index.ts` migrations:

```typescript
try { db.exec(`ALTER TABLE portfolios ADD COLUMN connection_count INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE portfolios ADD COLUMN last_connected_at TEXT`); } catch {}
```

### Step 2: Update POST /chat/public/:username handler in agent.ts

Find the public portfolio chat handler. After the LLM response is sent, add:

```typescript
// After: const reply = await routeChat(...)
// Before: res.json(...)

// Save visitor interaction to owner's memory
const snippet = userMessage.slice(0, 80);
const visitorName = 'Someone'; // anonymous unless authenticated
upsertMemory(portfolioOwner.id, `Visitor asked about: "${snippet}"`, ['visitor', 'portfolio-chat']);

// Increment connection counter
db.prepare(`
  UPDATE portfolios SET
    connection_count = connection_count + 1,
    last_connected_at = datetime('now')
  WHERE user_id = ?
`).run(portfolioOwner.id);

// Invalidate portfolio cache
await cacheDel(`portfolio:${req.params.username}`);

// Send Telegram notification if connected
const telegramLink = db.prepare(`
  SELECT cl.channel_data FROM channel_links cl
  WHERE cl.user_id = ? AND cl.channel_type = 'telegram'
  ORDER BY cl.created_at DESC LIMIT 1
`).get(portfolioOwner.id) as { channel_data: string } | undefined;

if (telegramLink) {
  try {
    const { chat_id } = JSON.parse(telegramLink.channel_data);
    await sendTelegramMessage(chat_id,
      `👋 Someone just chatted with your Weebo about: <i>"${snippet}"</i>\n\nCheck your dashboard for the full conversation.`
    );
  } catch { /* non-fatal */ }
}
```

### Step 3: Display connection count on portfolio page

In `src/portfolio/PortfolioView.tsx`, find where portfolio stats are displayed. Add:

```tsx
{portfolio.connectionCount > 0 && (
  <span className="text-xs text-[#A7ACB8] flex items-center gap-1">
    🔗 {portfolio.connectionCount} connection{portfolio.connectionCount !== 1 ? 's' : ''}
  </span>
)}
```

Also update the portfolio API response in `server/src/routes/portfolio.ts` to include `connection_count`:

```typescript
res.json({
  ...portfolioData,
  connectionCount: portfolio.connection_count || 0,
});
```

### Step 4: Build both

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/db/index.ts server/src/routes/agent.ts server/src/routes/portfolio.ts \
        src/portfolio/PortfolioView.tsx
git commit -m "feat: portfolio visitor saves memory, increments counter, notifies owner via Telegram"
```

---

## Task 14: AI-Generated Background (Kimi Gradient)

**Goal:** "Generate Background" button in Settings > Theme asks Kimi for a CSS gradient, previews it, and applies it on approval.

**Files:**
- Modify: `server/src/routes/agent.ts` — add `POST /api/agent/generate-background`
- Modify: `server/src/db/index.ts` — add `theme_background` column to users
- Modify: `server/src/routes/users.ts` — add `theme_background` to directFields
- Modify: `src/stores/themeStore.ts` — add `background` field
- Modify: `src/dashboard/pages/SettingsPage.tsx` — add Generate Background UI
- Modify: `src/dashboard/DashboardApp.tsx` — apply background gradient

### Step 1: Add generate-background endpoint

In `server/src/routes/agent.ts`:

```typescript
// POST /api/agent/generate-background
agentRouter.post('/generate-background', requireAuth, async (req: AuthRequest, res) => {
  const { vibe } = req.body as { vibe?: string };

  const prompt = `Generate a beautiful CSS gradient for a dark tech dashboard.
${vibe ? `Vibe: ${vibe}` : 'Make it feel like a dark, futuristic workspace — deep purples, dark blues, subtle teals.'}

Return ONLY valid JSON in this exact format:
{
  "gradient": "linear-gradient(135deg, #1a0533 0%, #0d1b4b 50%, #003d2b 100%)",
  "name": "Neon Jungle",
  "accent": "#7B61FF"
}

Rules:
- gradient must be a valid CSS gradient string
- All colors must be dark (no white or light backgrounds)
- name must be 2-3 words, evocative
- accent must be a single hex color that works as UI accent on dark backgrounds`;

  try {
    const result = await edithChat([{ role: 'user', content: prompt }], { maxTokens: 200 });
    const raw = result.text.trim().replace(/^```json\n?|\n?```$/g, '');
    const parsed = JSON.parse(raw);
    if (!parsed.gradient || !parsed.name || !parsed.accent) throw new Error('Invalid response');
    deductSubscriptionCredits(req.userId!, result.creditCost);
    res.json(parsed);
  } catch {
    // Fallback gradient if Kimi fails
    res.json({
      gradient: 'linear-gradient(135deg, #1a0533 0%, #0a0a1a 40%, #001a33 100%)',
      name: 'Deep Space',
      accent: '#7B61FF',
    });
  }
});
```

### Step 2: Add theme_background column to users

In `server/src/db/index.ts` migrations:
```typescript
try { db.exec(`ALTER TABLE users ADD COLUMN theme_background TEXT`); } catch {}
```

Add to `directFields` in `server/src/routes/users.ts`:
```typescript
theme_background: 'theme_background',
```

### Step 3: Update themeStore with background

In `src/stores/themeStore.ts`, add:
```typescript
background: null as string | null,
setBackground: (background: string | null) => set({ background }),
```

### Step 4: Add Generate Background UI in SettingsPage.tsx

At the bottom of the Theme tab, add:

```tsx
{/* AI Background Generator */}
<div className="space-y-3">
  <label className="text-sm text-[#A7ACB8] block">AI-Generated Background</label>
  <div className="flex gap-2">
    <input
      type="text"
      placeholder="Describe a vibe (optional)..."
      value={bgVibe}
      onChange={(e) => setBgVibe(e.target.value)}
      className="flex-1 px-3 py-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/20 text-[#F4F6FF] text-sm"
    />
    <Button onClick={handleGenerateBg} disabled={isGeneratingBg} size="sm" className="bg-[#7B61FF]">
      {isGeneratingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      Generate
    </Button>
  </div>
  {bgPreview && (
    <div className="space-y-2">
      <div
        className="h-24 rounded-xl border border-[#7B61FF]/20"
        style={{ background: bgPreview.gradient }}
      />
      <p className="text-xs text-[#A7ACB8]">"{bgPreview.name}" — click Apply to use this background</p>
      <div className="flex gap-2">
        <Button onClick={handleApplyBg} size="sm" className="bg-[#7B61FF]">Apply</Button>
        <Button onClick={handleGenerateBg} variant="outline" size="sm">Try another</Button>
      </div>
    </div>
  )}
</div>
```

Add state and handlers:
```typescript
const [bgVibe, setBgVibe] = useState('');
const [bgPreview, setBgPreview] = useState<{ gradient: string; name: string; accent: string } | null>(null);
const [isGeneratingBg, setIsGeneratingBg] = useState(false);
const setBackground = useThemeStore((s) => s.setBackground);

const handleGenerateBg = async () => {
  setIsGeneratingBg(true);
  try {
    const { data } = await agentService.generateBackground(bgVibe);
    setBgPreview(data);
  } finally {
    setIsGeneratingBg(false);
  }
};

const handleApplyBg = async () => {
  if (!bgPreview) return;
  setBackground(bgPreview.gradient);
  await userService.updateProfile({ theme_background: bgPreview.gradient });
};
```

Add `generateBackground` to `agentService` in `src/services/api.ts`:
```typescript
generateBackground: (vibe?: string) =>
  api.post<{ gradient: string; name: string; accent: string }>('/agent/generate-background', { vibe }),
```

### Step 5: Apply background in DashboardApp.tsx

In `DashboardApp.tsx`, read the background from themeStore and apply:
```typescript
const background = useThemeStore((s) => s.background);

// In the main wrapper div style:
style={{ background: background || undefined }}
```

### Step 6: Build both

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 7: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts server/src/db/index.ts server/src/routes/users.ts \
        src/stores/themeStore.ts src/dashboard/pages/SettingsPage.tsx \
        src/dashboard/DashboardApp.tsx src/services/api.ts
git commit -m "feat: AI-generated CSS gradient background via Kimi — preview and apply in theme settings"
```

---

# WAVE 4: Platform Completion

---

## Task 15: Recipes Actually Executing

**Goal:** Installed recipes trigger real actions on schedule via the Pico worker.

**Files:**
- Modify: `server/src/services/pico-fleet.ts` — add recipe execution tick to worker
- Modify: `server/src/services/recipes.ts` — add `executeRecipe()` function
- Modify: `server/src/db/index.ts` — add `last_run_at` to `installed_recipes`

### Step 1: Add last_run_at to installed_recipes

```typescript
try { db.exec(`ALTER TABLE installed_recipes ADD COLUMN last_run_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE installed_recipes ADD COLUMN config TEXT DEFAULT '{}'`); } catch {}
```

### Step 2: Add executeRecipe() to server/src/services/recipes.ts

```typescript
import { sendTelegramMessage } from './telegram.js';
import { generateDailyBriefing } from './daily-briefing.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export async function executeRecipe(recipeId: string, userId: string): Promise<void> {
  const config = (() => {
    const row = db.prepare('SELECT config FROM installed_recipes WHERE recipe_id = ? AND user_id = ?').get(recipeId, userId) as { config: string } | undefined;
    try { return JSON.parse(row?.config || '{}'); } catch { return {}; }
  })();

  const telegramLink = db.prepare(
    "SELECT channel_data FROM channel_links WHERE user_id = ? AND channel_type = 'telegram' LIMIT 1"
  ).get(userId) as { channel_data: string } | undefined;
  const chatId = telegramLink ? JSON.parse(telegramLink.channel_data).chat_id : null;

  const sendTelegram = async (msg: string) => {
    if (chatId) await sendTelegramMessage(chatId, msg);
  };

  switch (recipeId) {
    case 'morning-briefing':
      await generateDailyBriefing(userId);
      break;

    case 'deadline-enforcer': {
      const dueReminders = db.prepare(`
        SELECT text, datetime FROM reminders
        WHERE user_id = ? AND completed = 0 AND datetime <= datetime('now', '+1 day')
        ORDER BY datetime ASC LIMIT 5
      `).all(userId) as { text: string; datetime: string }[];
      if (dueReminders.length > 0) {
        const list = dueReminders.map(r => `• ${r.text} — ${r.datetime}`).join('\n');
        await sendTelegram(`⏰ <b>Upcoming Deadlines</b>\n${list}`);
      }
      break;
    }

    case 'weekly-review': {
      const memories = db.prepare(`
        SELECT content FROM agent_memory
        WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
        ORDER BY created_at DESC LIMIT 20
      `).all(userId) as { content: string }[];
      const summary = memories.map(m => `• ${m.content}`).join('\n') || 'No activity this week.';
      await sendTelegram(`📊 <b>Your Week in Review</b>\n\n${summary}`);
      break;
    }

    case 'portfolio-traffic': {
      const portfolio = db.prepare('SELECT connection_count FROM portfolios WHERE user_id = ?').get(userId) as { connection_count: number } | undefined;
      if (portfolio?.connection_count) {
        await sendTelegram(`📈 Your portfolio has <b>${portfolio.connection_count}</b> total connections.`);
      }
      break;
    }

    case 'api-health-monitor': {
      const endpoint = config.endpoint_url as string;
      if (!endpoint) break;
      try {
        const r = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) await sendTelegram(`🔴 API Health: <b>${endpoint}</b> returned ${r.status}`);
      } catch {
        await sendTelegram(`🔴 API Health: <b>${endpoint}</b> is unreachable`);
      }
      break;
    }

    case 'git-watcher': {
      // Basic: just notify that git watcher ran (full implementation needs user's git token)
      logger.info({ userId }, 'Git watcher recipe executed — requires user config');
      break;
    }
  }

  // Update last_run_at
  db.prepare('UPDATE installed_recipes SET last_run_at = datetime(\'now\') WHERE recipe_id = ? AND user_id = ?')
    .run(recipeId, userId);
}
```

### Step 3: Add recipe tick to Pico worker

In `server/src/services/pico-fleet.ts`, in the `processPendingTasks()` function (or the worker tick), add recipe checking:

```typescript
import { executeRecipe } from './recipes.js';

// In the worker tick, after processing tasks:
async function checkAndRunRecipes(): Promise<void> {
  // Get all installed recipes that are due to run
  const dueRecipes = db.prepare(`
    SELECT ir.user_id, ir.recipe_id
    FROM installed_recipes ir
    WHERE ir.last_run_at IS NULL
       OR (ir.recipe_id = 'morning-briefing' AND date(ir.last_run_at) < date('now') AND strftime('%H', 'now') >= '08')
       OR (ir.recipe_id = 'deadline-enforcer' AND date(ir.last_run_at) < date('now') AND strftime('%H', 'now') >= '07')
       OR (ir.recipe_id = 'weekly-review' AND date(ir.last_run_at) < date('now', '-7 days') AND strftime('%w', 'now') = '1')
       OR (ir.recipe_id = 'api-health-monitor' AND ir.last_run_at < datetime('now', '-15 minutes'))
       OR (ir.recipe_id = 'portfolio-traffic' AND date(ir.last_run_at) < date('now') AND strftime('%H', 'now') >= '09')
  `).all() as { user_id: string; recipe_id: string }[];

  for (const { user_id, recipe_id } of dueRecipes) {
    try {
      await executeRecipe(recipe_id, user_id);
    } catch (err) {
      logger.error({ err, recipe_id, user_id }, 'Recipe execution failed');
    }
  }
}
```

### Step 4: Build server

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 5: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/recipes.ts server/src/services/pico-fleet.ts server/src/db/index.ts
git commit -m "feat: recipes actually execute — morning briefing, deadline enforcer, portfolio traffic, api health"
```

---

## Task 16: Memory Auto-Summarization (Daily + Per-Session)

**Goal:** Pico auto-summarizes the day's activity at midnight and each conversation session after 5min inactivity.

**Files:**
- Create: `server/src/services/memory-summarizer.ts`
- Modify: `server/src/services/pico-fleet.ts` — call summarizer in worker
- Modify: `server/src/routes/agent.ts` — trigger session summarization

### Step 1: Create server/src/services/memory-summarizer.ts

```typescript
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { routeChat } from './llm.js';
import { upsertMemory } from './memory.js';

export async function summarizeUserDay(userId: string): Promise<void> {
  // Collect today's data
  const today = new Date().toISOString().split('T')[0];

  const conversations = db.prepare(`
    SELECT role, content FROM agent_conversations
    WHERE user_id = ? AND date(created_at) = ?
    ORDER BY created_at ASC LIMIT 30
  `).all(userId, today) as { role: string; content: string }[];

  const completedTasks = db.prepare(`
    SELECT description FROM pico_tasks
    WHERE user_id = ? AND date(completed_at) = ?
  `).all(userId, today) as { description: string }[];

  const completedReminders = db.prepare(`
    SELECT text FROM reminders
    WHERE user_id = ? AND completed = 1 AND date(updated_at) = ?
  `).all(userId, today) as { text: string }[];

  if (!conversations.length && !completedTasks.length && !completedReminders.length) return;

  const input = [
    conversations.length > 0 ? `Conversations: ${conversations.map(c => `${c.role}: ${c.content.slice(0, 100)}`).join(' | ')}` : '',
    completedTasks.length > 0 ? `Completed tasks: ${completedTasks.map(t => t.description).join(', ')}` : '',
    completedReminders.length > 0 ? `Completed reminders: ${completedReminders.map(r => r.text).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  try {
    const result = await routeChat([
      { role: 'user', content: `Summarize this user's day in 3 bullet points (very concise):\n${input}` },
    ], { forceProvider: 'ollama' }); // cheap local model

    await upsertMemory(userId, result.text, ['auto_summary', today]);
    logger.info({ userId, date: today }, 'Daily summary saved to memory');
  } catch (err) {
    logger.error({ err, userId }, 'Failed to summarize user day');
  }
}

export async function summarizeConversationSession(userId: string, messages: Array<{role: string; content: string}>): Promise<void> {
  if (messages.length < 3) return; // too short to summarize

  const formatted = messages.map(m => `${m.role}: ${m.content.slice(0, 150)}`).join('\n');
  try {
    const result = await routeChat([
      { role: 'user', content: `Summarize this conversation in 1 sentence for future context:\n${formatted}` },
    ], { forceProvider: 'ollama' });

    await upsertMemory(userId, `Conversation: ${result.text}`, ['conversation_summary']);
  } catch {
    // Non-fatal
  }
}
```

### Step 2: Call daily summarizer in Pico worker at midnight

In `server/src/services/pico-fleet.ts`, add a daily summarization check to the worker:

```typescript
import { summarizeUserDay } from './memory-summarizer.js';

// In the worker tick, once per day:
async function checkDailySummarization(): Promise<void> {
  const hour = new Date().getHours();
  if (hour !== 0) return; // only at midnight

  // Find users who haven't been summarized today
  const users = db.prepare(`
    SELECT DISTINCT user_id FROM agent_conversations
    WHERE date(created_at) = date('now', '-1 day')
    AND user_id NOT IN (
      SELECT user_id FROM agent_memory
      WHERE tags LIKE '%auto_summary%' AND date(created_at) = date('now')
    )
  `).all() as { user_id: string }[];

  for (const { user_id } of users) {
    await summarizeUserDay(user_id);
  }
}
```

### Step 3: Build

```bash
cd /root/GeekSpace2.0/server && npm run build
```

### Step 4: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/services/memory-summarizer.ts server/src/services/pico-fleet.ts
git commit -m "feat: Pico auto-summarizes user's day and conversation sessions into agent memory"
```

---

## Task 17: Reminders ↔ Pico Task Sync + "Created by Weebo" Badge

**Goal:** When Pico completes a task that created a reminder, mark that reminder done. Show "Created by Weebo" badge on Pico-created reminders.

**Files:**
- Modify: `server/src/db/index.ts` — add `pico_task_id` FK to reminders
- Modify: `server/src/services/pico-fleet.ts` — link task completion to reminder
- Modify: `src/dashboard/pages/RemindersPage.tsx` — show created_by badge

### Step 1: Add pico_task_id to reminders table

```typescript
try { db.exec(`ALTER TABLE reminders ADD COLUMN pico_task_id TEXT`); } catch {}
```

### Step 2: When Pico creates a reminder, store the task ID

In `pico-fleet.ts`, in the `create_reminder` task execution:

```typescript
case 'create_reminder': {
  const reminderId = uuid();
  db.prepare(`
    INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, pico_task_id)
    VALUES (?, ?, ?, ?, 'push', 'general', 'pico-fleet', ?)
  `).run(reminderId, task.user_id, cfg.text || task.description, cfg.datetime || new Date(Date.now() + 86400000).toISOString(), task.id);
  result = `Created reminder: ${cfg.text || task.description}`;
  break;
}
```

### Step 3: On task completion, mark linked reminder as complete

After a task is marked `completed` in the worker:
```typescript
// After updating task status to 'completed':
if (task.task_type === 'create_reminder') {
  // The reminder was created when the task ran — no auto-complete needed
} else {
  // For other task types, mark linked reminders complete if any
  db.prepare(`
    UPDATE reminders SET completed = 1 WHERE pico_task_id = ? AND user_id = ?
  `).run(task.id, task.user_id);
}
```

### Step 4: Show badge in RemindersPage

In `src/dashboard/pages/RemindersPage.tsx`, find where each reminder is rendered. Add:

```tsx
{reminder.created_by === 'pico-fleet' && (
  <span className="text-xs px-1.5 py-0.5 rounded bg-[#7B61FF]/10 text-[#7B61FF] border border-[#7B61FF]/20">
    💚 Weebo
  </span>
)}
```

### Step 5: Build both

```bash
cd /root/GeekSpace2.0/server && npm run build
cd /root/GeekSpace2.0 && npm run build
```

### Step 6: Commit

```bash
cd /root/GeekSpace2.0
git add server/src/db/index.ts server/src/services/pico-fleet.ts src/dashboard/pages/RemindersPage.tsx
git commit -m "feat: Pico-created reminders linked to tasks, show 'Created by Weebo' badge"
```

---

## Task 18: Deploy Wave 4 + Full Smoke Test

### Step 1: Build and deploy

```bash
cd /root/GeekSpace2.0
fuser -k 3001/tcp 2>/dev/null || true
docker compose up -d --build 2>&1 | tail -20
sleep 15
```

### Step 2: Health check

```bash
curl -s http://localhost:3001/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK:', d.get('ok'))"
```

### Step 3: Test billing plans include pilot

```bash
curl -s http://localhost:3001/api/billing/plans | python3 -c "
import sys, json
plans = json.load(sys.stdin)
ids = [p['id'] for p in plans]
print('Plans:', ids)
print('Pilot present:', 'pilot' in ids)
print('Monthly gone:', 'monthly' not in ids)
"
```

### Step 4: Test new user signup still works

```bash
curl -s -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"final_test@example.com","username":"finaltest99","password":"Test1234!","name":"Final Test"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Signup:', bool(d.get('token')))"
```

### Step 5: Verify Redis cache keys

```bash
docker exec geekspace-redis-1 redis-cli keys '*' | sort
```

### Step 6: Commit and tag

```bash
cd /root/GeekSpace2.0
git add -A
git commit -m "chore: Wave 4 complete — recipes, memory, reminders sync, themes, Pico OS"
git tag v2.2-pico-os
```

---

## Testing Checklist

After full deployment, verify:

**Wave 1:**
- [ ] New user signs up → portfolio loads (no 404)
- [ ] Telegram onboarding step shows deep link + "I've connected" button (no auto-advance to step 4)
- [ ] Avatar saved in Settings → appears in dashboard header
- [ ] Smoke test users gone (`smoketest*`, `smoke2test*`)
- [ ] Billing plans show: Free, Pilot (₹299), Intro (₹999 ~~₹1999~~), Half Year, Yearly
- [ ] Free plan shows "Try PicoClaw for $1/day" CTA
- [ ] Notification toggles save to DB
- [ ] Dark/light/system theme buttons actually switch appearance

**Wave 2:**
- [ ] Chat responses include user's memories and reminders in context
- [ ] Model preference in Agent Settings changes routing
- [ ] Onboarding bio/headline generates in ~3s (single Kimi call)
- [ ] Terminal `ai "prompt"` responds via Jarvis personality
- [ ] Complex Weebo tasks show escalation dialog for free users

**Wave 3:**
- [ ] Portfolio visitor chat → owner gets Telegram notification
- [ ] Connection count increments on each unique chat
- [ ] Theme > Generate Background → shows preview → Apply → dashboard background changes

**Wave 4:**
- [ ] Installed "deadline-enforcer" recipe triggers Telegram message for due reminders
- [ ] Memory page shows auto_summary entries after activity
- [ ] Pico-created reminders show "💚 Weebo" badge in RemindersPage

---

## Key Env Vars Required

```bash
OPENROUTER_API_KEY=     # required for openrouter-free (free tier)
OPENROUTER_FREE_MODEL=  # e.g. meta-llama/llama-3.3-70b-instruct:free
TELEGRAM_BOT_TOKEN=     # required for Telegram notifications
REDIS_URL=redis://redis:6379  # already set in docker-compose
PICO_IDLE_INTERVAL_MS=300000  # 5 min idle (optional, has default)
```
