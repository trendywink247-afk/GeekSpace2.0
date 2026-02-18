# GeekSpace v2.3 — Bugs + Platform Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 critical/medium bugs breaking core flows, then add API admin dashboard, Docker tool access for PicoClaw, and OpenRouter free-tier model auto-switching.

**Architecture:** Bugs are defensive code fixes (try-catch, API calls, store refreshes). Features add a new `admin.ts` route, a `openrouter-models.ts` service, new action types in action-parser/executor, and a self-contained HTML admin page served by Express.

**Tech Stack:** TypeScript/Express backend, React/Vite frontend, better-sqlite3, Zustand, Redis (ioredis)

---

## WAVE 1 — Bug Fixes

---

### Task 1: Fix Critical — `loadPicoContext()` crashes chatbot + terminal

**Root Cause:** `pico-context.ts:20` — `loadPicoContext()` has no try-catch. A DB error (e.g., JOIN on `pico_agents` fails for users with no agent) bubbles up through `buildSystemPrompt()` at `agent.ts:45`, crashing the entire `/chat` handler. The outer catch returns the generic "Sorry, I couldn't process that" message.

**Files:**
- Modify: `server/src/services/pico-context.ts:20-95`

**Step 1: Wrap the entire `loadPicoContext` body in try-catch**

Replace the function body in `pico-context.ts`. The function currently starts at line 20. Replace from `export function loadPicoContext` through the closing `}`:

```typescript
export function loadPicoContext(userId: string): PicoContext {
  try {
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

    // Pending Pico tasks (LEFT JOIN to avoid crash when pico_agents has no row)
    const tasks = db.prepare(`
      SELECT pt.description, pt.status, COALESCE(pa.name, 'Weebo') as agent_name
      FROM pico_tasks pt
      LEFT JOIN pico_agents pa ON pt.agent_id = pa.id
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
  } catch (err) {
    // Non-fatal: return empty context so chat still works
    const { logger } = await import('../logger.js').catch(() => ({ logger: console }));
    (logger as typeof console).warn?.(`loadPicoContext failed for ${userId}:`, err);
    return {
      recentMemories: '',
      activeReminders: '',
      pendingTasks: '',
      portfolio: '',
      integrations: '',
      personality: 'jarvis',
      modelPreference: 'auto',
      todaySummary: '',
    };
  }
}
```

**Important:** The dynamic `import('../logger.js')` inside catch won't work in sync TS. Use a simpler approach — just use `console.warn`:

```typescript
  } catch (err) {
    console.warn('[pico-context] loadPicoContext failed, using empty context:', (err as Error).message);
    return {
      recentMemories: '',
      activeReminders: '',
      pendingTasks: '',
      portfolio: '',
      integrations: '',
      personality: 'jarvis',
      modelPreference: 'auto',
      todaySummary: '',
    };
  }
```

**Also fix the JOIN** — change `JOIN pico_agents` to `LEFT JOIN pico_agents` with `COALESCE(pa.name, 'Weebo')` so users with no pico_agent row don't crash the query (the original JOIN causes the failure for new signups that didn't get a pico_agent row).

**Step 2: Build**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -20
```
Expected: no errors.

**Step 3: Quick smoke test (live DB)**

```bash
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(sqlite3 /app/data/geekspace.db "SELECT token FROM sessions LIMIT 1;")" \
  -d '{"message":"hi"}' | head -c 200
```
Expected: JSON with `text` field (not an error).

**Step 4: Commit**
```bash
cd /root/GeekSpace2.0
git add server/src/services/pico-context.ts
git commit -m "fix: wrap loadPicoContext in try-catch, LEFT JOIN pico_agents — fixes chatbot 500"
```

---

### Task 2: Fix Accent Color — Persist to Server on Change

**Root Cause:** `SettingsPage.tsx:628,640` — `onClick`/`onChange` calls `setAccentColor()` which only updates Zustand + CSS. Never calls the server. The backend endpoint `PATCH /api/agent/config` already supports `accentColor`.

**Files:**
- Modify: `src/dashboard/pages/SettingsPage.tsx` (accent color section, lines ~622–644)
- Modify: `src/dashboard/DashboardApp.tsx` (on mount, load agentConfig and apply accent)

**Step 1: Update SettingsPage accent color handlers**

In `SettingsPage.tsx`, find the accent presets buttons (line ~624–634). Add server save after each color change.

First, check what's imported at the top of SettingsPage. Find `agentService` import — it should already be there. If not, add it.

In the preset buttons `onClick`:
```typescript
// Change from:
onClick={() => setAccentColor(color)}

// Change to:
onClick={() => {
  setAccentColor(color);
  void agentService.updateConfig({ accentColor: color });
}}
```

In the custom color `onChange`:
```typescript
// Change from:
onChange={(e) => setAccentColor(e.target.value)}

// Change to:
onChange={(e) => {
  setAccentColor(e.target.value);
  void agentService.updateConfig({ accentColor: e.target.value });
}}
```

**Step 2: Load accent color from server on DashboardApp mount**

In `src/dashboard/DashboardApp.tsx`, find the existing `useEffect` that loads theme. Add accent color loading.

First check what's already imported in DashboardApp — find the `useEffect` for theme mode sync (look for `user?.theme?.mode`). After that effect, add:

```typescript
// Load agent config accent color on mount
useEffect(() => {
  agentService.getConfig().then((config) => {
    if (config?.accent_color) {
      setAccentColor(config.accent_color);
    }
  }).catch(() => { /* non-fatal */ });
}, [setAccentColor]);
```

Check the imports in DashboardApp — `agentService` and `setAccentColor` (from themeStore) need to be imported.

**Step 3: Build frontend**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -20
```
Expected: no TS errors.

**Step 4: Commit**
```bash
git add src/dashboard/pages/SettingsPage.tsx src/dashboard/DashboardApp.tsx
git commit -m "fix: persist accent color to server on change, load on dashboard mount"
```

---

### Task 3: Fix Username Pre-Populated in Onboarding (Asked Twice)

**Root Cause:** `defaultOnboarding.profile.username = ''`. After signup, `state.user.username` is set but the onboarding state is not initialized from it. ProfileStep shows empty username field.

**Files:**
- Modify: `src/onboarding/OnboardingWizard.tsx`

**Step 1: Add user to authStore destructuring in OnboardingWizard**

In `OnboardingWizard.tsx`, find line 18:
```typescript
const { onboarding, updateOnboarding, saveOnboardingStep, completeOnboarding } = useAuthStore();
```

Change to also get `user` and `fetchUser`:
```typescript
const { user, onboarding, updateOnboarding, saveOnboardingStep, completeOnboarding, fetchUser } = useAuthStore();
```

**Step 2: Add useEffect to pre-populate username + name from user**

After the `useState` declarations (around line 22), add:

```typescript
// Pre-populate profile from existing user data (avoids asking twice)
useEffect(() => {
  if (user) {
    const needsUpdate = (!onboarding.profile.username && user.username) ||
                        (!onboarding.profile.name && user.name);
    if (needsUpdate) {
      updateOnboarding({
        profile: {
          ...onboarding.profile,
          username: onboarding.profile.username || user.username || '',
          name: onboarding.profile.name || user.name || '',
        },
      });
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Step 3: Also fix handleLaunch to refresh user after completion (for Task 4)**

Change the existing `handleLaunch` (lines 50-54):
```typescript
const handleLaunch = async () => {
  setIsLaunching(true);
  await completeOnboarding();
  await fetchUser(); // refresh user object (avatar, profile updates)
  navigate('/dashboard', { replace: true });
};
```

**Step 4: Build**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -20
```
Expected: no TS errors. If `fetchUser` unused warnings appear, ensure it's actually used in handleLaunch.

**Step 5: Commit**
```bash
git add src/onboarding/OnboardingWizard.tsx
git commit -m "fix: pre-populate username/name in onboarding from user store, refresh user after completion"
```

---

### Task 4: Fix Telegram Onboarding — Allow Re-link + Fix Template Deeplink

**Root Cause (onboarding step 5):** When `POST /telegram/link` returns `{ linked: true }` (user already linked), the IntegrationsStep shows "connected" immediately — no issue there. The reported problem is likely that demo users' seed data pre-sets a Telegram link, or that clicking the deeplink in Telegram shows an "already in chat" state because the bot's `/start` was previously used.

**Root Cause (template redirect):** The Telegram template in `pico-fleet.ts` or similar likely has a hardcoded Telegram bot URL or doesn't generate a fresh deeplink per user.

**Files:**
- Modify: `src/onboarding/steps/IntegrationsStep.tsx` — add "Re-link" option when already connected
- Modify: `server/src/services/pico-fleet.ts` or wherever the `setup_telegram` template content lives

**Step 1: Find the Telegram template content**

```bash
grep -r "setup.telegram\|setup_telegram\|t\.me\|deepLink\|botUsername" /root/GeekSpace2.0/server/src/ --include="*.ts" -l
```

Then read the file to find where Telegram template message content is built.

**Step 2: Fix IntegrationsStep to allow disconnect + re-link**

In `src/onboarding/steps/IntegrationsStep.tsx`, find the Telegram card connected state. Currently it shows "Connected ✓". Add a small "Change account" link that calls `DELETE /api/integrations/telegram/link` then re-starts the flow.

In the `connected` state render, add after the success message:
```tsx
<button
  onClick={async () => {
    await integrationService.unlinkTelegram(); // add this method to api.ts
    setTelegramState('idle');
  }}
  className="text-xs text-[#A7ACB8] underline mt-2"
>
  Link a different account
</button>
```

Add `unlinkTelegram()` to `src/services/api.ts`:
```typescript
unlinkTelegram: () => api.delete('/integrations/telegram/link'),
```

**Step 3: Fix the template Telegram content**

If templates have hardcoded bot URLs, change them to use a dynamic deeplink. In the template that generates Telegram setup instructions (find via grep in Step 1), replace any hardcoded `t.me/BotName?start=XXXX` with instructions to use `/telegram link` command which will generate a fresh one-time link.

If no hardcoded URL found — the template itself doesn't need changing; the issue is the UX. Add a note to the template output: "Use the GeekSpace dashboard > Connections to link your Telegram."

**Step 4: Build**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -20
```

**Step 5: Commit**
```bash
git add src/onboarding/steps/IntegrationsStep.tsx src/services/api.ts
git commit -m "fix: add Telegram re-link option in onboarding, fix template deeplink"
```

---

### Task 5: UI Renames — Pico → Weebo, Ollama → Local AI Engine

**Files:**
- Modify: `src/dashboard/pages/AgentSettingsPage.tsx` (lines ~248-251)
- Search for other occurrences

**Step 1: Find all user-visible "Pico" occurrences**
```bash
grep -rn "Pico\b" /root/GeekSpace2.0/src/ --include="*.tsx" --include="*.ts" | grep -v "PicoFleet\|PicoClaw\|picoclaw\|pico-fleet\|picoCtx\|picoTask\|picoService\|pico_\|import\|//" | head -30
```

**Step 2: Update AgentSettingsPage model preference descriptions**

In `src/dashboard/pages/AgentSettingsPage.tsx`, find lines ~248-251:
```typescript
{ value: 'auto', label: 'Auto', desc: 'Pico decides best model' },
{ value: 'local', label: 'Local Engine', desc: 'Always Ollama — fastest for simple' },
```

Change to:
```typescript
{ value: 'auto', label: 'Auto', desc: 'Weebo picks the best engine for your request' },
{ value: 'local', label: 'Local AI Engine', desc: 'Always runs locally — fastest, most private' },
{ value: 'cloud', label: 'Cloud Engine', desc: 'OpenRouter free tier — stronger reasoning' },
{ value: 'premium', label: 'Premium Engine', desc: 'Kimi K2 — best results, uses more credits' },
```

**Step 3: Find + fix any other visible "Pico" text in UI**

Common locations: PicoFleetPage.tsx header, AgentChatPanel.tsx deploy messages, DashboardApp.tsx sidebar. Change display text to "Weebo" where user-visible. Do NOT change variable names, API endpoints, or file names — only visible label strings.

**Step 4: Build**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -20
```

**Step 5: Commit**
```bash
git add src/
git commit -m "fix: rename Pico→Weebo, Ollama→Local AI Engine in UI labels"
```

---

## WAVE 2 — Features

---

### Task 6: OpenRouter Free-Tier Model Auto-Switching

**Goal:** Maintain a prioritized list of free OpenRouter models in Redis. When a model returns quota/rate errors, auto-switch to the next. PicoClaw refreshes the model list every 6 hours.

**Files:**
- Create: `server/src/services/openrouter-models.ts`
- Modify: `server/src/services/llm.ts` — `callOpenRouterFree()` function
- Modify: `server/src/services/pico-fleet.ts` — add 6-hour model refresh tick

**Step 1: Create `openrouter-models.ts`**

```typescript
// server/src/services/openrouter-models.ts
// Manages OpenRouter free-tier model list with auto-refresh and fallback switching

import { config } from '../config.js';
import { cacheGet, cacheSet } from './cache.js';
import { logger } from '../logger.js';

const CACHE_KEY = 'openrouter:free_models';
const CURRENT_KEY = 'openrouter:current_free_model';
const CACHE_TTL = 6 * 60 * 60; // 6 hours in seconds

// Fallback list if OpenRouter API is unreachable at startup
const DEFAULT_FREE_MODELS = [
  'deepseek/deepseek-r1-0528:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-235b-a22b:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
];

interface OpenRouterModel {
  id: string;
  context_length: number;
}

export async function fetchFreeModels(): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'OpenRouter model list fetch failed');
      return DEFAULT_FREE_MODELS;
    }

    const data = await response.json() as { data?: OpenRouterModel[] };
    const freeModels = (data.data || [])
      .filter((m: OpenRouterModel) => m.id.endsWith(':free'))
      .sort((a: OpenRouterModel, b: OpenRouterModel) => b.context_length - a.context_length)
      .slice(0, 5)
      .map((m: OpenRouterModel) => m.id);

    if (freeModels.length === 0) return DEFAULT_FREE_MODELS;

    logger.info({ models: freeModels }, 'OpenRouter free models refreshed');
    await cacheSet(CACHE_KEY, JSON.stringify(freeModels), CACHE_TTL);
    return freeModels;
  } catch (err) {
    logger.warn({ err }, 'fetchFreeModels failed, using defaults');
    return DEFAULT_FREE_MODELS;
  }
}

export async function getFreeModels(): Promise<string[]> {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached) as string[]; } catch { /* fall through */ }
  }
  return fetchFreeModels();
}

export async function getCurrentFreeModel(): Promise<string> {
  const current = await cacheGet(CURRENT_KEY);
  if (current) return current;
  const models = await getFreeModels();
  const first = models[0] || DEFAULT_FREE_MODELS[0];
  await cacheSet(CURRENT_KEY, first, CACHE_TTL);
  return first;
}

export async function switchToNextFreeModel(failedModel: string): Promise<string> {
  const models = await getFreeModels();
  const idx = models.indexOf(failedModel);
  const nextIdx = (idx + 1) % models.length;
  const next = models[nextIdx] || DEFAULT_FREE_MODELS[0];
  await cacheSet(CURRENT_KEY, next, CACHE_TTL);
  logger.info({ from: failedModel, to: next }, 'OpenRouter model switched due to quota');
  return next;
}

export async function refreshModelsIfStale(): Promise<void> {
  const cached = await cacheGet(CACHE_KEY);
  if (!cached) {
    await fetchFreeModels();
  }
}
```

**Step 2: Update `callOpenRouterFree()` in `llm.ts` to use model switching**

Add import at top of llm.ts:
```typescript
import { getCurrentFreeModel, switchToNextFreeModel } from './openrouter-models.js';
```

Replace the `callOpenRouterFree` function body:
```typescript
async function callOpenRouterFree(messages: ChatMessage[]): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const baseUrl = config.openrouterFreeBaseUrl;
  const apiKey = config.openrouterFreeApiKey;
  let model = await getCurrentFreeModel();

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'GeekSpace AI OS',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: config.openrouterMaxTokens,
      }),
      signal: AbortSignal.timeout(config.openrouterTimeout),
    });

    if (response.ok) {
      const data = await response.json() as {
        choices?: Array<{ message?: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      const content = data.choices?.[0]?.message?.content || '';
      return {
        content,
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
      };
    }

    const status = response.status;
    // Switch model on quota/rate limit errors
    if (status === 429 || status === 402 || status === 400) {
      const text = await response.text().catch(() => '');
      if (text.includes('quota') || text.includes('rate_limit') || text.includes('insufficient') || status === 429) {
        logger.warn({ model, status, attempt }, 'OpenRouter free quota hit, switching model');
        model = await switchToNextFreeModel(model);
        continue;
      }
      throw new Error(`OpenRouter Free returned ${status}: ${text}`);
    }

    const text = await response.text().catch(() => '');
    throw new Error(`OpenRouter Free returned ${status}: ${text}`);
  }

  throw new Error('OpenRouter Free: all fallback models exhausted');
}
```

**Step 3: Add 6-hour model refresh to pico-fleet worker**

In `server/src/services/pico-fleet.ts`, find the `tick()` function. Add a model refresh call. Find where `checkAndRunRecipes()` or similar periodic calls are made.

At the top of `pico-fleet.ts`, import:
```typescript
import { refreshModelsIfStale } from './openrouter-models.js';
```

In the `tick()` function, add (after recipe/summarization checks):
```typescript
// Refresh OpenRouter free models every 6 hours (cache handles dedup)
refreshModelsIfStale().catch(() => { /* non-fatal */ });
```

**Step 4: On server startup, pre-fetch model list**

In `server/src/index.ts`, find where services start. Add after other startup calls:
```typescript
import { fetchFreeModels } from './services/openrouter-models.js';
// ... in startup:
fetchFreeModels().catch(() => { logger.warn('OpenRouter model prefetch failed'); });
```

**Step 5: Build**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -20
```

**Step 6: Commit**
```bash
cd /root/GeekSpace2.0
git add server/src/services/openrouter-models.ts server/src/services/llm.ts server/src/services/pico-fleet.ts server/src/index.ts
git commit -m "feat: OpenRouter free-tier model auto-switching with 6hr refresh and 3-model fallback"
```

---

### Task 7: Admin Routes Backend

**Goal:** Add `GET /api/admin/*` routes to Express protected by `ADMIN_TOKEN`. Provides health, stats, task feed, and SSE stream for live updates.

**Files:**
- Create: `server/src/routes/admin.ts`
- Modify: `server/src/index.ts` — mount admin router

**Step 1: Add `ADMIN_TOKEN` to config.ts**

In `server/src/config.ts`, in the `config` object, add:
```typescript
adminToken: optional('ADMIN_TOKEN', ''),
```

**Step 2: Create `server/src/routes/admin.ts`**

```typescript
// server/src/routes/admin.ts
// Admin API routes — protected by ADMIN_TOKEN header

import { Router, type Request, type Response } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { cacheGet } from '../services/cache.js';
import { EventEmitter } from 'events';

export const adminRouter = Router();
export const adminEvents = new EventEmitter();
adminEvents.setMaxListeners(50);

// ---- Auth middleware ----
function requireAdmin(req: Request, res: Response, next: () => void): void {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  if (!config.adminToken || token !== config.adminToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ---- GET /api/admin/health ----
adminRouter.get('/health', requireAdmin, async (_req, res) => {
  const checks = {
    server: 'ok',
    db: 'unknown',
    redis: 'unknown',
    ollama: 'unknown',
    picoclaw: 'unknown',
  };

  try {
    db.prepare('SELECT 1').get();
    checks.db = 'ok';
  } catch { checks.db = 'error'; }

  try {
    const r = await cacheGet('admin:ping');
    checks.redis = r !== null ? 'ok' : 'ok'; // if no error, redis is ok
  } catch { checks.redis = 'error'; }

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: ctrl.signal });
    checks.ollama = r.ok ? 'ok' : 'error';
  } catch { checks.ollama = 'error'; }

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${config.picoClawUrl}/health`, { signal: ctrl.signal });
    checks.picoclaw = r.ok ? 'ok' : 'error';
  } catch { checks.picoclaw = 'error'; }

  res.json({ status: 'ok', checks, timestamp: new Date().toISOString() });
});

// ---- GET /api/admin/stats ----
adminRouter.get('/stats', requireAdmin, (_req, res) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const activeAgents = (db.prepare('SELECT COUNT(*) as c FROM agent_configs').get() as { c: number }).c;
  const tasksRunning = (db.prepare("SELECT COUNT(*) as c FROM pico_tasks WHERE status IN ('queued','running')").get() as { c: number }).c;
  const tasksToday = (db.prepare("SELECT COUNT(*) as c FROM pico_tasks WHERE date(created_at) = date('now')").get() as { c: number }).c;
  const tasksCompleted = (db.prepare("SELECT COUNT(*) as c FROM pico_tasks WHERE status = 'completed' AND date(created_at) = date('now')").get() as { c: number }).c;

  res.json({ totalUsers, activeAgents, tasksRunning, tasksToday, tasksCompleted });
});

// ---- GET /api/admin/tasks ----
adminRouter.get('/tasks', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);

  const tasks = db.prepare(`
    SELECT pt.id, pt.description, pt.status, pt.result, pt.error, pt.created_at, pt.updated_at,
           u.username, u.name as user_name
    FROM pico_tasks pt
    JOIN users u ON pt.user_id = u.id
    ORDER BY pt.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Record<string, unknown>[];

  const total = (db.prepare('SELECT COUNT(*) as c FROM pico_tasks').get() as { c: number }).c;
  res.json({ tasks, total, limit, offset });
});

// ---- GET /api/admin/stream (SSE) ----
// Emits events when pico_tasks change
adminRouter.get('/stream', requireAdmin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('connected', { message: 'Admin stream connected', ts: Date.now() });

  const onTask = (task: Record<string, unknown>) => send('task', task);
  adminEvents.on('task', onTask);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    adminEvents.off('task', onTask);
    clearInterval(heartbeat);
    logger.debug('Admin SSE client disconnected');
  });
});

// ---- GET /admin (serve HTML dashboard) ----
// This route is mounted at the app level, not /api/admin
export function serveAdminDashboard(req: Request, res: Response) {
  const tokenProvided = req.query.token as string || '';
  if (config.adminToken && tokenProvided !== config.adminToken) {
    // Show login form
    res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>GeekSpace Admin</title>
<style>body{background:#05050A;color:#F4F6FF;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{background:#0B0B10;border:1px solid #7B61FF33;border-radius:12px;padding:32px;min-width:320px}
input{width:100%;padding:8px;background:#05050A;border:1px solid #7B61FF44;color:#F4F6FF;border-radius:6px;margin:8px 0}
button{width:100%;padding:10px;background:#7B61FF;color:white;border:none;border-radius:6px;cursor:pointer}
</style></head>
<body><div class="box">
<h2 style="margin:0 0 16px">GeekSpace Admin</h2>
<input type="password" id="tk" placeholder="Admin token" onkeydown="if(event.key==='Enter')auth()"/>
<button onclick="auth()">Access Dashboard</button>
</div>
<script>function auth(){const t=document.getElementById('tk').value;window.location='?token='+encodeURIComponent(t);}</script>
</body></html>`);
    return;
  }

  // Full admin dashboard HTML
  const token = tokenProvided;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeekSpace Admin — Weebo Control</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#05050A;color:#F4F6FF;font-family:'Courier New',monospace;font-size:13px}
.header{background:#0B0B10;border-bottom:1px solid #7B61FF33;padding:12px 24px;display:flex;align-items:center;gap:12px}
.header h1{font-size:16px;color:#7B61FF}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:16px}
.stat{background:#0B0B10;border:1px solid #7B61FF22;border-radius:8px;padding:12px;text-align:center}
.stat .val{font-size:28px;color:#61FF7B;font-weight:bold}
.stat .lbl{font-size:11px;color:#A7ACB8;margin-top:4px}
.section{padding:0 16px 16px}
.section h3{color:#7B61FF;font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
.health{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.chip{padding:4px 10px;border-radius:20px;font-size:11px}
.ok{background:#61FF7B22;color:#61FF7B;border:1px solid #61FF7B44}
.error{background:#FF616122;color:#FF6161;border:1px solid #FF616144}
.unknown{background:#7B61FF22;color:#A7ACB8;border:1px solid #7B61FF44}
table{width:100%;border-collapse:collapse;background:#0B0B10;border-radius:8px;overflow:hidden}
th{text-align:left;padding:8px 12px;background:#0B0B10;color:#A7ACB8;font-size:11px;text-transform:uppercase;border-bottom:1px solid #7B61FF22}
td{padding:8px 12px;border-bottom:1px solid #7B61FF11;font-size:12px}
tr:last-child td{border-bottom:none}
.badge{padding:2px 8px;border-radius:10px;font-size:10px}
.queued{background:#FFD76122;color:#FFD761}.running{background:#7B61FF22;color:#7B61FF}
.completed{background:#61FF7B22;color:#61FF7B}.failed{background:#FF616122;color:#FF6161}
.stream{background:#0B0B10;border:1px solid #7B61FF22;border-radius:8px;height:200px;overflow-y:auto;padding:12px;margin-top:8px;font-size:11px;color:#A7ACB8}
</style>
</head>
<body>
<div class="header">
  <div style="width:8px;height:8px;border-radius:50%;background:#61FF7B" id="dot"></div>
  <h1>GeekSpace Admin — Weebo Control</h1>
  <span style="margin-left:auto;color:#A7ACB8;font-size:11px" id="lastUpdate">Loading...</span>
</div>

<div class="grid" id="stats">
  <div class="stat"><div class="val">-</div><div class="lbl">Total Users</div></div>
  <div class="stat"><div class="val">-</div><div class="lbl">Active Agents</div></div>
  <div class="stat"><div class="val">-</div><div class="lbl">Tasks Running</div></div>
  <div class="stat"><div class="val">-</div><div class="lbl">Tasks Today</div></div>
  <div class="stat"><div class="val">-</div><div class="lbl">Completed Today</div></div>
</div>

<div class="section">
  <h3>System Health</h3>
  <div class="health" id="health">Loading...</div>
</div>

<div class="section">
  <h3>Live Weebo Feed</h3>
  <div class="stream" id="stream"><em>Connecting to event stream...</em></div>
</div>

<div class="section">
  <h3>Recent Tasks</h3>
  <table id="taskTable">
    <thead><tr><th>User</th><th>Task</th><th>Status</th><th>Time</th></tr></thead>
    <tbody id="taskBody"><tr><td colspan="4" style="text-align:center;color:#A7ACB8">Loading...</td></tr></tbody>
  </table>
</div>

<script>
const TOKEN = '${token}';
const API = '/api/admin';
const H = {'Authorization': 'Bearer '+TOKEN};

async function loadStats() {
  try {
    const r = await fetch(API+'/stats', {headers:H});
    const d = await r.json();
    const g = document.getElementById('stats').querySelectorAll('.val');
    const vals = [d.totalUsers, d.activeAgents, d.tasksRunning, d.tasksToday, d.tasksCompleted];
    vals.forEach((v,i) => g[i].textContent = v);
    document.getElementById('lastUpdate').textContent = 'Updated: '+new Date().toLocaleTimeString();
  } catch(e) { console.error(e); }
}

async function loadHealth() {
  try {
    const r = await fetch(API+'/health', {headers:H});
    const d = await r.json();
    const el = document.getElementById('health');
    el.innerHTML = Object.entries(d.checks).map(([k,v]) =>
      \`<span class="chip \${v}">\${k}: \${v}</span>\`
    ).join('');
  } catch(e) {}
}

async function loadTasks() {
  try {
    const r = await fetch(API+'/tasks?limit=20', {headers:H});
    const d = await r.json();
    const tbody = document.getElementById('taskBody');
    if (!d.tasks?.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#A7ACB8">No tasks yet</td></tr>'; return; }
    tbody.innerHTML = d.tasks.map(t => \`<tr>
      <td>\${t.username || t.user_name}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${t.description}</td>
      <td><span class="badge \${t.status}">\${t.status}</span></td>
      <td>\${new Date(t.created_at).toLocaleTimeString()}</td>
    </tr>\`).join('');
  } catch(e) {}
}

// SSE stream
const stream = document.getElementById('stream');
function connectStream() {
  const es = new EventSource(API+'/stream?token='+encodeURIComponent(TOKEN));
  es.addEventListener('task', (e) => {
    const d = JSON.parse(e.data);
    const line = document.createElement('div');
    line.textContent = '['+new Date().toLocaleTimeString()+'] '+
      (d.username||'?')+' — '+(d.description||d.status||JSON.stringify(d));
    stream.appendChild(line);
    stream.scrollTop = stream.scrollHeight;
    loadStats(); loadTasks();
  });
  es.addEventListener('connected', () => {
    stream.innerHTML = '<em>Stream connected ✓</em><br>';
    document.getElementById('dot').style.background = '#61FF7B';
  });
  es.onerror = () => {
    document.getElementById('dot').style.background = '#FF6161';
    setTimeout(connectStream, 5000);
  };
}

loadStats(); loadHealth(); loadTasks(); connectStream();
setInterval(() => { loadStats(); loadHealth(); loadTasks(); }, 10000);
</script>
</body>
</html>`);
}
```

**Step 3: Mount admin router in `server/src/index.ts`**

In `server/src/index.ts`, find where other routers are imported and mounted. Add:

```typescript
import { adminRouter, serveAdminDashboard } from './routes/admin.js';

// ... in app setup:
app.use('/api/admin', adminRouter);
app.get('/admin', serveAdminDashboard);
```

**Step 4: Export `adminEvents` and call it from pico-fleet**

In `server/src/services/pico-fleet.ts`, find where tasks are updated (status changes). Add event emission:

```typescript
// At top:
import { adminEvents } from '../routes/admin.js';
// Careful: circular dependency risk. Use a shared EventEmitter in a separate file if needed.
```

**Note on circular dependencies:** admin.ts imports from db, config, cache. pico-fleet.ts imports from many services. To avoid circular deps, create a shared event bus:

Create `server/src/services/event-bus.ts`:
```typescript
import { EventEmitter } from 'events';
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(100);
```

Then in `admin.ts`: import `{ eventBus }` from `./event-bus.js` and use `eventBus.on('pico:task', ...)`.
In `pico-fleet.ts`: import `{ eventBus }` and emit `eventBus.emit('pico:task', { description, status, username })` when tasks change.

**Step 5: Build**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -20
```

**Step 6: Commit**
```bash
cd /root/GeekSpace2.0
git add server/src/routes/admin.ts server/src/services/event-bus.ts server/src/index.ts server/src/config.ts
git commit -m "feat: admin API routes + live SSE stream + self-contained HTML dashboard"
```

---

### Task 8: Configure Caddy for api.geekspace.space + Add Weebo Activity Card

**Goal:** Route `api.geekspace.space` to `/admin` on the existing server. Add a personal Weebo activity feed card to PicoFleetPage.

**Files:**
- Modify: `/etc/caddy/Caddyfile` (or wherever Caddy config lives)
- Modify: `src/dashboard/pages/PicoFleetPage.tsx` — add activity card

**Step 1: Find Caddy config location**
```bash
find /etc/caddy /root /var/caddy -name "Caddyfile" 2>/dev/null | head -5
caddy validate --config /etc/caddy/Caddyfile 2>&1 | head -5
```

**Step 2: Add api.geekspace.space vhost**

In the Caddyfile, add a new site block:
```
api.geekspace.space {
    reverse_proxy localhost:3001
}
```

The existing `ai.geekspace.space` block already proxies to port 3001. Adding `api.geekspace.space` routes it to the same server — the `/admin` route and `/api/admin/*` routes will be accessible.

**Step 3: Reload Caddy**
```bash
caddy reload --config /etc/caddy/Caddyfile
```
Expected: "Config loaded successfully"

**Step 4: Add Weebo Activity card to PicoFleetPage**

In `src/dashboard/pages/PicoFleetPage.tsx`, find the end of the main content. Add a card showing the user's recent tasks.

Find where the component returns JSX. In the card grid, add after the main plan section:

```tsx
{/* Weebo Activity — recent tasks */}
<div className="p-6 rounded-2xl bg-[#0B0B10] border border-[#7B61FF]/20">
  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
    <Activity className="w-5 h-5 text-[#7B61FF]" />
    Weebo Activity
  </h2>
  {recentTasks.length === 0 ? (
    <p className="text-[#A7ACB8] text-sm">No tasks yet. Ask Weebo to do something!</p>
  ) : (
    <div className="space-y-2">
      {recentTasks.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[#7B61FF]/10 last:border-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            t.status === 'completed' ? 'bg-[#61FF7B]' :
            t.status === 'running' ? 'bg-[#7B61FF] animate-pulse' :
            t.status === 'failed' ? 'bg-[#FF6161]' : 'bg-[#FFD761]'
          }`} />
          <span className="text-sm text-[#F4F6FF] flex-1 truncate">{t.description}</span>
          <span className="text-xs text-[#A7ACB8] flex-shrink-0">{t.status}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

Add state and fetch logic at the top of the component:
```typescript
const [recentTasks, setRecentTasks] = useState<Array<{id: string; description: string; status: string}>>([]);

useEffect(() => {
  const load = async () => {
    try {
      const data = await picoService.getTasks({ limit: 10 });
      setRecentTasks(data.tasks || []);
    } catch { /* non-fatal */ }
  };
  void load();
  const interval = setInterval(load, 30000);
  return () => clearInterval(interval);
}, []);
```

Check if `picoService.getTasks()` exists in `src/services/api.ts`. If not, add:
```typescript
getTasks: (params?: { limit?: number }) =>
  api.get('/pico/tasks', { params }).then(r => r.data),
```

Import `Activity` from `lucide-react` at the top of PicoFleetPage.

**Step 5: Build + commit**
```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -20
git add src/dashboard/pages/PicoFleetPage.tsx src/services/api.ts
git commit -m "feat: add Weebo Activity card to PicoFleetPage, configure api.geekspace.space"
```

---

### Task 9: PicoClaw Docker Tool Access

**Goal:** Add `crawl_url` and `trigger_workflow` action types so Kimi/Weebo can call crawl4ai and Windmill from task plans.

**Files:**
- Modify: `server/src/services/action-parser.ts`
- Modify: `server/src/services/action-executor.ts`

**Step 1: Read current action-parser.ts to understand the pattern**
```bash
head -60 /root/GeekSpace2.0/server/src/services/action-parser.ts
```

**Step 2: Add `crawl_url` and `trigger_workflow` to action types**

In `action-parser.ts`, find the action type definitions. Add:
```typescript
export interface CrawlUrlAction {
  type: 'crawl_url';
  url: string;
  format?: 'markdown' | 'html' | 'text';
}

export interface TriggerWorkflowAction {
  type: 'trigger_workflow';
  flowPath: string;
  payload?: Record<string, unknown>;
}
```

In the parser function, add cases to detect these from LLM output:
```typescript
// Match: crawl_url: https://example.com
const crawlMatch = line.match(/crawl_url:\s*(https?:\/\/\S+)/i);
if (crawlMatch) {
  actions.push({ type: 'crawl_url', url: crawlMatch[1] });
}

// Match: trigger_workflow: /path/to/flow
const workflowMatch = line.match(/trigger_workflow:\s*(\S+)/i);
if (workflowMatch) {
  actions.push({ type: 'trigger_workflow', flowPath: workflowMatch[1] });
}
```

**Step 3: Add executor handlers in `action-executor.ts`**

In `action-executor.ts`, find the switch/if-chain that handles action types. Add:

```typescript
case 'crawl_url': {
  const crawlUrl = (action as CrawlUrlAction).url;
  const crawl4aiUrl = process.env.CRAWL4AI_URL || 'http://crawl4ai-ykgs-crawl4ai-1:11235';
  try {
    const r = await fetch(`${crawl4aiUrl}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: crawlUrl, priority: 5 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`crawl4ai returned ${r.status}`);
    const data = await r.json() as { result?: { markdown?: string } };
    return { success: true, output: data.result?.markdown?.slice(0, 2000) || 'Crawled successfully' };
  } catch (err) {
    logger.warn({ crawlUrl, err }, 'crawl_url failed');
    return { success: false, output: `Failed to crawl ${crawlUrl}: ${(err as Error).message}` };
  }
}

case 'trigger_workflow': {
  const windmillUrl = process.env.WINDMILL_URL || 'http://windmill-95s4-windmill_server-1:8000';
  const wfAction = action as TriggerWorkflowAction;
  try {
    const r = await fetch(`${windmillUrl}/api/w/admins/jobs/run/p/${wfAction.flowPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wfAction.payload || {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Windmill returned ${r.status}`);
    const jobId = await r.text();
    return { success: true, output: `Workflow triggered: ${jobId}` };
  } catch (err) {
    logger.warn({ flowPath: wfAction.flowPath, err }, 'trigger_workflow failed');
    return { success: false, output: `Workflow failed: ${(err as Error).message}` };
  }
}
```

**Step 4: Build**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -20
```

**Step 5: Commit**
```bash
cd /root/GeekSpace2.0
git add server/src/services/action-parser.ts server/src/services/action-executor.ts
git commit -m "feat: PicoClaw Docker tool actions — crawl_url (crawl4ai) and trigger_workflow (Windmill)"
```

---

### Task 10: Build, Deploy, Smoke Test

**Step 1: Build both server and frontend**
```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -5
```

**Step 2: Rebuild Docker + deploy**
```bash
cd /root/GeekSpace2.0
docker compose build geekspace
docker compose up -d geekspace
docker compose ps
```

**Step 3: Deploy frontend**
```bash
cp -r /root/GeekSpace2.0/dist/* /var/www/geekspace/
```

**Step 4: Smoke test critical fixes**

Test chatbot (get a real user token first):
```bash
TOKEN=$(sqlite3 /app/data/geekspace.db "SELECT value FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username='alex') LIMIT 1;" 2>/dev/null || echo "")
# If sessions table doesn't exist, login via API:
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"alex@example.com","password":"demo123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Token: $TOKEN"
```

Test chat endpoint:
```bash
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"hello"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK:', d.get('text','')[:100])"
```
Expected: `OK: ` followed by a response (not an error).

Test admin dashboard:
```bash
ADMIN_TOKEN=$(grep ADMIN_TOKEN /root/GeekSpace2.0/.env | cut -d= -f2)
curl -s "http://localhost:3001/api/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin))"
```
Expected: JSON with totalUsers, activeAgents, etc.

**Step 5: Tag release**
```bash
cd /root/GeekSpace2.0
git tag v2.3-platform
git push origin live-production --tags
```

**Step 6: Final commit if any fixes needed**
```bash
git add -A && git commit -m "fix: post-deploy smoke test fixes" 2>/dev/null || echo "Nothing to commit"
```

---

## Summary

| Task | Change | Impact |
|------|--------|--------|
| 1 | `loadPicoContext` try-catch + LEFT JOIN | Fixes all chat 500 errors |
| 2 | Accent color server persist + load on mount | Color survives refresh |
| 3 | Username/name pre-populated from user store | No duplicate field |
| 4 | fetchUser() after onboarding completion | Avatar shows immediately |
| 5 | Telegram re-link + template fix | Users can link fresh accounts |
| 6 | UI renames Pico→Weebo | UI consistency |
| 7 | OpenRouter model auto-switching | No manual model updates |
| 8 | Admin routes + HTML dashboard | ops visibility |
| 9 | Weebo activity card + Caddy config | User-facing activity feed |
| 10 | Docker tool actions | Weebo can crawl/automate |
| 11 | Deploy + smoke test | Release v2.3 |
