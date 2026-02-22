# Free OpenRouter Models — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give users visibility into available free AI models, let them pick a preferred model, sync model availability daily from OpenRouter, and notify via Telegram when models change.

**Architecture:** DB-driven model registry (`free_models` + `model_changelog` tables) populated by a daily server-side scheduler. New `/api/models/*` endpoints serve model data. Frontend shows a model showcase card on the Overview page. Telegram `/model` command for mobile users. Chat routing reads user's preferred model from `agent_configs`.

**Tech Stack:** TypeScript, Express, better-sqlite3, React, Tailwind, Zustand, Telegram Bot API

---

### Task 1: Database Schema — Tables + Migration

**Files:**
- Modify: `server/src/db/index.ts:266` (after schema block, before migrations)

**Step 1: Add `free_models` and `model_changelog` tables to the schema block**

In `server/src/db/index.ts`, add these tables inside the main `db.exec()` block (after line 265, before the closing backtick+semicolon):

```sql
  CREATE TABLE IF NOT EXISTS free_models (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    summary TEXT NOT NULL,
    context_length INTEGER DEFAULT 0,
    parameters TEXT,
    status TEXT DEFAULT 'active',
    curated INTEGER DEFAULT 0,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    last_checked TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    event TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    notified INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_free_models_status ON free_models(status);
  CREATE INDEX IF NOT EXISTS idx_model_changelog_timestamp ON model_changelog(timestamp);
```

**Step 2: Add `preferred_free_model` column migration**

After the existing migrations (around line 400, after the `model_preference` migration), add:

```typescript
try {
  db.exec("ALTER TABLE agent_configs ADD COLUMN preferred_free_model TEXT DEFAULT 'auto'");
} catch { /* already exists */ }
```

**Step 3: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile, no errors.

**Step 4: Commit**

```bash
git add server/src/db/index.ts
git commit -m "feat: add free_models and model_changelog tables, preferred_free_model column"
```

---

### Task 2: Model Sync Service — Curated Allowlist + Daily Fetch

**Files:**
- Create: `server/src/services/model-sync.ts`

**Step 1: Create the model sync service**

Create `server/src/services/model-sync.ts` with:

```typescript
// ============================================================
// Free Model Sync — Daily job that fetches available free models
// from OpenRouter and maintains the free_models registry.
// ============================================================

import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';

// ---- Curated Allowlist ----
// These models are known-good and get curated=1 + hand-written summaries.

export const CURATED_MODELS: Record<string, { displayName: string; summary: string; parameters?: string }> = {
  'deepseek/deepseek-r1-0528:free': {
    displayName: 'DeepSeek R1 0528',
    summary: 'Open-source 671B MoE reasoning model, performance on par with o1',
    parameters: '671B (37B active)',
  },
  'meta-llama/llama-3.3-70b-instruct:free': {
    displayName: 'Llama 3.3 70B',
    summary: 'Multilingual instruction model supporting 8 languages',
    parameters: '70B',
  },
  'qwen/qwen3-235b-a22b-thinking:free': {
    displayName: 'Qwen3 235B Thinking',
    summary: 'MoE reasoning model excelling at math, science and code',
    parameters: '235B (22B active)',
  },
  'qwen/qwen3-235b-a22b-thinking-2507:free': {
    displayName: 'Qwen3 235B Thinking 2507',
    summary: 'Latest Qwen3 MoE optimized for structured reasoning tasks',
    parameters: '235B (22B active)',
  },
  'openai/gpt-oss-120b:free': {
    displayName: 'GPT-OSS 120B',
    summary: 'Open-weight 117B MoE from OpenAI, runs on single H100',
    parameters: '117B (5.1B active)',
  },
  'openai/gpt-oss-20b:free': {
    displayName: 'GPT-OSS 20B',
    summary: 'Compact open-weight MoE from OpenAI for fast inference',
    parameters: '21B (3.6B active)',
  },
  'stepfun/step-3.5-flash:free': {
    displayName: 'Step 3.5 Flash',
    summary: 'Fast reasoning MoE model, speed-efficient at long contexts',
    parameters: '196B (11B active)',
  },
  'nvidia/nemotron-3-nano-30b-a3b:free': {
    displayName: 'Nemotron 3 Nano 30B',
    summary: 'NVIDIA MoE for efficient agentic AI systems',
    parameters: '30B (3B active)',
  },
  'arcee-ai/trinity-large-preview:free': {
    displayName: 'Arcee Trinity Large',
    summary: 'Frontier 400B MoE excelling at creative writing and agentic tasks',
    parameters: '400B (13B active)',
  },
  'arcee-ai/trinity-mini:free': {
    displayName: 'Arcee Trinity Mini',
    summary: 'Compact 26B MoE with robust function calling and agent workflows',
    parameters: '26B (3B active)',
  },
};

// ---- Types ----

interface OpenRouterModelEntry {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: { modality?: string };
}

// ---- Helpers ----

/** Derive a display name from an OpenRouter model ID like 'provider/model-name:free' */
function deriveDisplayName(modelId: string): string {
  const base = modelId.replace(/:free$/, '').split('/').pop() || modelId;
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/** Derive provider from model ID */
function deriveProvider(modelId: string): string {
  return modelId.split('/')[0] || 'unknown';
}

// ---- Core Sync Logic ----

export async function syncFreeModels(): Promise<{ added: string[]; removed: string[]; returned: string[]; discovered: string[] }> {
  const now = new Date().toISOString();
  const result = { added: [] as string[], removed: [] as string[], returned: [] as string[], discovered: [] as string[] };

  // 1. Fetch models from OpenRouter
  let fetchedModels: OpenRouterModelEntry[] = [];
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${config.openrouterFreeApiKey || config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'GeekSpace AI OS',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Model sync: OpenRouter API returned non-OK');
      return result;
    }

    const data = await response.json() as { data?: OpenRouterModelEntry[] };
    fetchedModels = (data.data ?? []).filter(m => m.id.endsWith(':free'));
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Model sync: fetch failed');
    return result;
  }

  if (fetchedModels.length === 0) {
    logger.warn('Model sync: no free models found in API response');
    return result;
  }

  const fetchedIds = new Set(fetchedModels.map(m => m.id));

  // 2. Get existing models from DB
  const existingRows = db.prepare('SELECT id, status FROM free_models').all() as Array<{ id: string; status: string }>;
  const existingMap = new Map(existingRows.map(r => [r.id, r.status]));

  const insertModel = db.prepare(`
    INSERT INTO free_models (id, display_name, provider, summary, context_length, parameters, status, curated, first_seen, last_seen, last_checked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSeen = db.prepare('UPDATE free_models SET last_seen = ?, last_checked = ?, status = ? WHERE id = ?');
  const insertChangelog = db.prepare('INSERT INTO model_changelog (model_id, event, timestamp) VALUES (?, ?, ?)');

  // 3. Process fetched models
  for (const model of fetchedModels) {
    const curated = CURATED_MODELS[model.id];
    const displayName = curated?.displayName || deriveDisplayName(model.id);
    const provider = deriveProvider(model.id);
    const summary = curated?.summary || 'Free model available on OpenRouter';
    const params = curated?.parameters || null;
    const contextLength = model.context_length || 0;
    const isCurated = curated ? 1 : 0;

    const existingStatus = existingMap.get(model.id);

    if (existingStatus === undefined) {
      // New model
      const status = isCurated ? 'active' : 'new';
      const event = isCurated ? 'added' : 'discovered';
      insertModel.run(model.id, displayName, provider, summary, contextLength, params, status, isCurated, now, now, now);
      insertChangelog.run(model.id, event, now);
      result[event === 'added' ? 'added' : 'discovered'].push(displayName);
    } else if (existingStatus === 'unavailable') {
      // Model returned
      updateSeen.run(now, now, 'active', model.id);
      insertChangelog.run(model.id, 'returned', now);
      result.returned.push(displayName);
    } else {
      // Still present — update timestamps
      updateSeen.run(now, now, existingStatus, model.id);
    }
  }

  // 4. Mark missing models as unavailable
  for (const [id, status] of existingMap) {
    if (!fetchedIds.has(id) && status !== 'unavailable' && status !== 'retired') {
      updateSeen.run(now, now, 'unavailable', id);
      insertChangelog.run(id, 'removed', now);
      const row = db.prepare('SELECT display_name FROM free_models WHERE id = ?').get(id) as { display_name: string } | undefined;
      result.removed.push(row?.display_name || id);
    }
  }

  const totalChanges = result.added.length + result.removed.length + result.returned.length + result.discovered.length;
  logger.info({ added: result.added.length, removed: result.removed.length, returned: result.returned.length, discovered: result.discovered.length }, 'Model sync complete');

  // 5. Send Telegram notifications if there are changes
  if (totalChanges > 0) {
    await notifyModelChanges(result);
  }

  return result;
}

// ---- Telegram Notification ----

async function notifyModelChanges(changes: { added: string[]; removed: string[]; returned: string[]; discovered: string[] }): Promise<void> {
  const lines: string[] = ['📢 Model Update:'];

  for (const name of changes.added) lines.push(`+ New: ${name}`);
  for (const name of changes.returned) lines.push(`↩ Returned: ${name}`);
  for (const name of changes.discovered) lines.push(`🔍 Discovered: ${name}`);
  for (const name of changes.removed) lines.push(`- Removed: ${name}`);

  lines.push('', 'Use /model to see all available models.');
  const message = lines.join('\n');

  // Get all users with connected Telegram
  const links = db.prepare(`
    SELECT cl.external_id FROM channel_links cl
    JOIN integrations i ON cl.user_id = i.user_id AND i.type = 'telegram' AND i.status = 'connected'
    WHERE cl.channel = 'telegram'
  `).all() as Array<{ external_id: string }>;

  for (const link of links) {
    try {
      await sendTelegramMessage(link.external_id, message);
    } catch (err) {
      logger.warn({ externalId: link.external_id, err: (err as Error).message }, 'Failed to notify user of model changes');
    }
  }

  // Mark changelog entries as notified
  db.prepare("UPDATE model_changelog SET notified = 1 WHERE notified = 0").run();
}

// ---- Scheduler ----

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function startModelSyncScheduler(): void {
  // Run once at startup (non-blocking)
  syncFreeModels().catch(err => logger.warn({ err: (err as Error).message }, 'Initial model sync failed'));

  // Then every 24 hours
  setInterval(() => {
    syncFreeModels().catch(err => logger.warn({ err: (err as Error).message }, 'Scheduled model sync failed'));
  }, SYNC_INTERVAL_MS);

  logger.info('Model sync scheduler started (24h interval)');
}
```

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile. (Note: `sendTelegramMessage` may need the right signature — verify it accepts `(chatIdOrExternalId: string | number, text: string)` from `telegram.ts`.)

**Step 3: Commit**

```bash
git add server/src/services/model-sync.ts
git commit -m "feat: add model sync service with curated allowlist and daily scheduler"
```

---

### Task 3: Wire Sync Scheduler into Server Startup

**Files:**
- Modify: `server/src/index.ts:45-46` (imports) and `server/src/index.ts:253` (startup block)

**Step 1: Add import**

In `server/src/index.ts`, after the existing `fetchFreeModels` import (line 45):

```typescript
import { startModelSyncScheduler } from './services/model-sync.js';
```

**Step 2: Replace fetchFreeModels call with model sync scheduler**

In the `app.listen` callback (around line 253), replace:

```typescript
  fetchFreeModels().catch(() => { logger.warn('OpenRouter model prefetch failed'); });
```

with:

```typescript
  startModelSyncScheduler();
```

**Step 3: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: wire model sync scheduler into server startup"
```

---

### Task 4: Models API Endpoints

**Files:**
- Create: `server/src/routes/models.ts`
- Modify: `server/src/index.ts` (add route mount)

**Step 1: Create models router**

Create `server/src/routes/models.ts`:

```typescript
// ============================================================
// Models API — Public endpoints for free model discovery
// ============================================================

import { Router } from 'express';
import { db } from '../db/index.js';

export const modelsRouter = Router();

// GET /api/models/free — All active/new free models
modelsRouter.get('/free', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, display_name, provider, summary, context_length, parameters, status, curated, first_seen
    FROM free_models
    WHERE status IN ('active', 'new')
    ORDER BY curated DESC, context_length DESC
  `).all() as Array<{
    id: string; display_name: string; provider: string; summary: string;
    context_length: number; parameters: string | null; status: string; curated: number; first_seen: string;
  }>;

  const lastChecked = db.prepare('SELECT MAX(last_checked) as t FROM free_models').get() as { t: string | null } | undefined;

  res.json({
    models: rows.map(r => ({
      id: r.id,
      displayName: r.display_name,
      provider: r.provider,
      summary: r.summary,
      contextLength: r.context_length,
      parameters: r.parameters,
      status: r.status,
      curated: r.curated === 1,
      isNew: r.status === 'new',
    })),
    lastUpdated: lastChecked?.t || null,
  });
});

// GET /api/models/changelog — Last 30 days of model changes
modelsRouter.get('/changelog', (_req, res) => {
  const rows = db.prepare(`
    SELECT mc.model_id, mc.event, mc.timestamp, fm.display_name
    FROM model_changelog mc
    LEFT JOIN free_models fm ON mc.model_id = fm.id
    WHERE mc.timestamp > datetime('now', '-30 days')
    ORDER BY mc.timestamp DESC
    LIMIT 100
  `).all() as Array<{
    model_id: string; event: string; timestamp: string; display_name: string | null;
  }>;

  res.json({
    entries: rows.map(r => ({
      modelId: r.model_id,
      displayName: r.display_name || r.model_id,
      event: r.event,
      timestamp: r.timestamp,
    })),
  });
});
```

**Step 2: Mount the router in index.ts**

In `server/src/index.ts`, add the import (after other route imports, around line 33):

```typescript
import { modelsRouter } from './routes/models.js';
```

And mount it (after line 216, near other route mounts):

```typescript
app.use('/api/models', modelsRouter);
```

**Step 3: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add server/src/routes/models.ts server/src/index.ts
git commit -m "feat: add /api/models/free and /api/models/changelog endpoints"
```

---

### Task 5: Extend Agent Config — preferred_free_model

**Files:**
- Modify: `server/src/middleware/validate.ts:114-132` (add field to schema)
- Modify: `server/src/routes/agent.ts:97-104` (add to allowedFields)

**Step 1: Add to Zod schema**

In `server/src/middleware/validate.ts`, inside `agentConfigUpdateSchema` (before the `}).strict()` closing), add:

```typescript
  preferred_free_model: z.string().max(200).optional(),
```

**Step 2: Add to allowedFields in agent route**

In `server/src/routes/agent.ts`, in the `allowedFields` object inside the `PATCH /config` handler, add:

```typescript
    preferred_free_model: 'preferred_free_model',
```

**Step 3: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add server/src/middleware/validate.ts server/src/routes/agent.ts
git commit -m "feat: accept preferred_free_model in agent config updates"
```

---

### Task 6: Chat Routing — Respect User's Preferred Model

**Files:**
- Modify: `server/src/services/llm.ts:265-326` (callOpenRouterFree)
- Modify: `server/src/services/openrouter-models.ts:42-82` (source from DB)

**Step 1: Add `getUserPreferredFreeModel` to openrouter-models.ts**

Add this function to `server/src/services/openrouter-models.ts` (after the imports, around line 11):

```typescript
import { db } from '../db/index.js';

/**
 * Get the user's preferred free model if it's currently available.
 * Returns null if preference is 'auto' or model is unavailable.
 */
export function getUserPreferredFreeModel(userId: string): string | null {
  const row = db.prepare('SELECT preferred_free_model FROM agent_configs WHERE user_id = ?')
    .get(userId) as { preferred_free_model: string | null } | undefined;

  const pref = row?.preferred_free_model;
  if (!pref || pref === 'auto') return null;

  // Check the model is still active
  const model = db.prepare("SELECT id FROM free_models WHERE id = ? AND status IN ('active', 'new')")
    .get(pref) as { id: string } | undefined;

  return model ? model.id : null;
}

/**
 * Get curated active models from DB for rotation fallback.
 * Falls back to DEFAULT_FREE_MODELS if DB is empty.
 */
export function getActiveModelsFromDb(): string[] {
  const rows = db.prepare("SELECT id FROM free_models WHERE status = 'active' AND curated = 1 ORDER BY context_length DESC")
    .all() as Array<{ id: string }>;

  return rows.length > 0 ? rows.map(r => r.id) : DEFAULT_FREE_MODELS;
}
```

**Step 2: Update `callOpenRouterFree` in llm.ts to accept optional userId**

In `server/src/services/llm.ts`, update the import (line 16) to include the new function:

```typescript
import { getCurrentFreeModel, switchToNextFreeModel, getUserPreferredFreeModel } from './openrouter-models.js';
```

Then update `callOpenRouterFree` signature (line 265) to accept an optional userId:

```typescript
async function callOpenRouterFree(messages: ChatMessage[], userId?: string): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
```

Inside the function, before the retry loop (after line 268), add:

```typescript
  // Check user's preferred model first
  const preferredModel = userId ? getUserPreferredFreeModel(userId) : null;
```

Then in the loop (line 273), replace:
```typescript
    const model = await getCurrentFreeModel();
```
with:
```typescript
    const model = (attempt === 0 && preferredModel) ? preferredModel : await getCurrentFreeModel();
```

**Step 3: Pass userId through routeChat**

In `routeChat` (line 445), the `opts` parameter already exists. Add `userId?: string` to the opts type:

```typescript
  opts?: {
    forceProvider?: Provider;
    userCredits?: number;
    systemPrompt?: string;
    agentName?: string;
    userId?: string;
  },
```

Then in the `openrouter-free` case (line 526-533), pass userId:

```typescript
      case 'openrouter-free': {
        const result = await callOpenRouterFree(fullMessages, opts?.userId);
```

**Step 4: Pass userId from the caller in agent.ts**

In `server/src/routes/agent.ts`, find where `routeChat()` is called and ensure `userId` is passed in opts. Search for `routeChat(` calls and add `userId: req.userId` to the opts object.

**Step 5: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 6: Commit**

```bash
git add server/src/services/llm.ts server/src/services/openrouter-models.ts server/src/routes/agent.ts
git commit -m "feat: respect user's preferred free model in chat routing"
```

---

### Task 7: Telegram `/model` Command

**Files:**
- Modify: `server/src/routes/webhooks.ts:187-430` (add /model case)

**Step 1: Add /model command handler**

In `server/src/routes/webhooks.ts`, inside the `handleTelegramCommand` switch statement, before the `default:` case (around line 422), add:

```typescript
    case '/model': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.');
        return;
      }

      // Get available models
      const models = db.prepare(`
        SELECT id, display_name, summary, status FROM free_models
        WHERE status IN ('active', 'new') ORDER BY curated DESC, context_length DESC
      `).all() as Array<{ id: string; display_name: string; summary: string; status: string }>;

      if (models.length === 0) {
        await sendTelegramMessage(chatId, 'No free models available right now. Check back later.');
        return;
      }

      // Get user's current preference
      const agentCfg = db.prepare('SELECT preferred_free_model FROM agent_configs WHERE user_id = ?')
        .get(link.user_id) as { preferred_free_model: string | null } | undefined;
      const currentPref = agentCfg?.preferred_free_model || 'auto';

      if (!cmd.args.trim()) {
        // List all models
        const lines = models.map((m, i) => {
          const check = m.id === currentPref ? ' ✅' : '';
          const badge = m.status === 'new' ? ' 🆕' : '';
          return `${i + 1}. ${m.display_name}${badge}${check}\n   ${m.summary}`;
        });

        const autoCheck = currentPref === 'auto' ? ' ✅' : '';
        await sendTelegramMessage(chatId,
          `🤖 Available Free Models:\n\n` +
          `0. Auto-select${autoCheck}\n   Let the system pick the best model\n\n` +
          `${lines.join('\n\n')}\n\n` +
          `Reply /model <number> to switch, or /model auto`
        );
        return;
      }

      // Handle /model auto
      if (cmd.args.trim().toLowerCase() === 'auto') {
        db.prepare("UPDATE agent_configs SET preferred_free_model = 'auto' WHERE user_id = ?").run(link.user_id);
        await sendTelegramMessage(chatId, '✅ Switched to auto-select. The system will pick the best available model.');
        return;
      }

      // Handle /model <number>
      const num = parseInt(cmd.args.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= models.length) {
        const chosen = models[num - 1];
        db.prepare('UPDATE agent_configs SET preferred_free_model = ? WHERE user_id = ?').run(chosen.id, link.user_id);
        await sendTelegramMessage(chatId, `✅ Switched to ${chosen.display_name}.\n${chosen.summary}`);
        return;
      }

      // Handle /model <partial name>
      const search = cmd.args.trim().toLowerCase();
      const match = models.find(m =>
        m.display_name.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search)
      );

      if (match) {
        db.prepare('UPDATE agent_configs SET preferred_free_model = ? WHERE user_id = ?').run(match.id, link.user_id);
        await sendTelegramMessage(chatId, `✅ Switched to ${match.display_name}.\n${match.summary}`);
      } else {
        await sendTelegramMessage(chatId, `Model not found: "${cmd.args.trim()}"\nUse /model to see available models.`);
      }
      break;
    }
```

**Step 2: Add /model to the /help text**

In the `/help` case (around line 295-312), add `/model` to the command list:

```
        `/model — View and switch AI models\n` +
```

Insert this line after the `/credits` line.

**Step 3: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add server/src/routes/webhooks.ts
git commit -m "feat: add /model Telegram command for model selection"
```

---

### Task 8: Frontend Types + API Service

**Files:**
- Modify: `src/types/index.ts` (add types)
- Modify: `src/services/api.ts` (add model service)

**Step 1: Add types**

In `src/types/index.ts`, add after the existing interfaces (e.g., after the `DailyUsage` interface):

```typescript
export interface FreeModel {
  id: string;
  displayName: string;
  provider: string;
  summary: string;
  contextLength: number;
  parameters: string | null;
  status: string;
  curated: boolean;
  isNew: boolean;
}

export interface FreeModelsResponse {
  models: FreeModel[];
  lastUpdated: string | null;
}

export interface ModelChangelogEntry {
  modelId: string;
  displayName: string;
  event: string;
  timestamp: string;
}
```

**Step 2: Add model service to api.ts**

In `src/services/api.ts`, add the import for the new types (in the existing import from `@/types`), then add:

```typescript
export const modelService = {
  getFreeModels: () => api.get<FreeModelsResponse>('/models/free'),
  getChangelog: () => api.get<{ entries: ModelChangelogEntry[] }>('/models/changelog'),
};
```

**Step 3: Build and verify**

Run: `cd /root/GeekSpace2.0 && npm run build`
Expected: Clean compile. (Frontend uses `tsc -b && vite build`)

**Step 4: Commit**

```bash
git add src/types/index.ts src/services/api.ts
git commit -m "feat: add FreeModel types and modelService to frontend API"
```

---

### Task 9: Dashboard Model Showcase Card

**Files:**
- Modify: `src/dashboard/pages/OverviewPage.tsx` (add card at bottom)

**Step 1: Add imports and state**

At the top of `OverviewPage.tsx`, add to the existing lucide-react import:

```typescript
import { Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react';
```

(Keep existing icons, add `Sparkles`, `ChevronDown`, `ChevronUp`, `Check` if not already imported.)

Add imports for the new types and service:

```typescript
import { modelService, agentService } from '@/services/api';
import type { FreeModel, ModelChangelogEntry } from '@/types';
```

Inside the component function, add state:

```typescript
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
  const [changelog, setChangelog] = useState<ModelChangelogEntry[]>([]);
  const [modelsLastUpdated, setModelsLastUpdated] = useState<string | null>(null);
  const [preferredModel, setPreferredModel] = useState<string>('auto');
  const [showChangelog, setShowChangelog] = useState(false);
  const [modelSaving, setModelSaving] = useState<string | null>(null);
```

Add a useEffect to fetch model data:

```typescript
  useEffect(() => {
    modelService.getFreeModels().then(res => {
      setFreeModels(res.data.models);
      setModelsLastUpdated(res.data.lastUpdated);
    }).catch(() => {});
    modelService.getChangelog().then(res => {
      setChangelog(res.data.entries);
    }).catch(() => {});
  }, []);

  // Get current preference from agent config
  useEffect(() => {
    if (agent.preferred_free_model) {
      setPreferredModel(agent.preferred_free_model);
    }
  }, [agent]);
```

**Step 2: Add the model selection handler**

```typescript
  const handleSelectModel = async (modelId: string) => {
    setModelSaving(modelId);
    try {
      await agentService.updateConfig({ preferred_free_model: modelId } as Partial<AgentConfig>);
      setPreferredModel(modelId);
    } catch { /* ignore */ }
    setModelSaving(null);
  };
```

**Step 3: Add the card JSX**

Before the closing `</div>` tags at the bottom of the component (line 612 — after the Agent Status card's parent `</div>`), add:

```tsx
        {/* Available AI Models */}
        {freeModels.length > 0 && (
          <div className="col-span-full">
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#7B61FF]" />
                    <CardTitle className="text-lg font-semibold">Available AI Models</CardTitle>
                  </div>
                  {modelsLastUpdated && (
                    <span className="text-xs text-[#A7ACB8]">
                      Updated {new Date(modelsLastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#A7ACB8] mt-1">Free models powered by OpenRouter — updated daily</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {/* Auto-select option */}
                  <button
                    onClick={() => handleSelectModel('auto')}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      preferredModel === 'auto'
                        ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                        : 'border-[#1E1E2A] bg-[#0F0F18] hover:border-[#7B61FF]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-[#F4F6FF]">Auto-select</span>
                        <p className="text-xs text-[#A7ACB8] mt-0.5">System picks the best available model for each request</p>
                      </div>
                      {preferredModel === 'auto' && <Check className="w-4 h-4 text-[#7B61FF]" />}
                    </div>
                  </button>

                  {/* Model cards */}
                  {freeModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model.id)}
                      disabled={modelSaving === model.id}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        preferredModel === model.id
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                          : 'border-[#1E1E2A] bg-[#0F0F18] hover:border-[#7B61FF]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-[#1E1E2A] flex items-center justify-center text-xs font-bold text-[#7B61FF] shrink-0">
                            {model.provider.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#F4F6FF] truncate">{model.displayName}</span>
                              {model.isNew && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFD761]/20 text-[#FFD761] font-medium shrink-0">NEW</span>
                              )}
                              {model.parameters && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E1E2A] text-[#A7ACB8] font-mono shrink-0">{model.parameters}</span>
                              )}
                            </div>
                            <p className="text-xs text-[#A7ACB8] mt-0.5 truncate">{model.summary}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E1E2A] text-[#A7ACB8] font-mono">
                            {model.contextLength >= 1000 ? `${Math.round(model.contextLength / 1000)}K` : model.contextLength} ctx
                          </span>
                          {preferredModel === model.id && <Check className="w-4 h-4 text-[#7B61FF]" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Tip */}
                <p className="text-xs text-[#A7ACB8] mt-4">
                  Tip: Use <code className="text-[#7B61FF] bg-[#1E1E2A] px-1 rounded">/model</code> in Telegram to switch models, or let auto-select pick the best one.
                </p>

                {/* Collapsible changelog */}
                {changelog.length > 0 && (
                  <div className="mt-4 border-t border-[#1E1E2A] pt-3">
                    <button
                      onClick={() => setShowChangelog(!showChangelog)}
                      className="flex items-center gap-1 text-xs text-[#A7ACB8] hover:text-[#F4F6FF] transition-colors"
                    >
                      {showChangelog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Recent changes ({changelog.length})
                    </button>
                    {showChangelog && (
                      <div className="mt-2 space-y-1">
                        {changelog.slice(0, 10).map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={
                              entry.event === 'added' || entry.event === 'returned' ? 'text-[#61FF7B]' :
                              entry.event === 'removed' ? 'text-[#FF6161]' : 'text-[#FFD761]'
                            }>
                              {entry.event === 'added' ? '+' : entry.event === 'removed' ? '-' : entry.event === 'returned' ? '↩' : '🔍'}
                            </span>
                            <span className="text-[#A7ACB8]">{entry.displayName}</span>
                            <span className="text-[#555] ml-auto">{new Date(entry.timestamp).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
```

**Step 4: Build and verify**

Run: `cd /root/GeekSpace2.0 && npm run build`
Expected: Clean compile. Check for unused import warnings (`noUnusedLocals`).

**Step 5: Commit**

```bash
git add src/dashboard/pages/OverviewPage.tsx
git commit -m "feat: add model showcase card to dashboard overview"
```

---

### Task 10: Chat Panel — Show Model Name in Response

**Files:**
- Modify: `src/components/AgentChatPanel.tsx`

**Step 1: Find where provider label is displayed**

The chat panel already receives `provider` and `model` in the response. Find where `providerLabels[provider]` is used and add the model display name next to it.

After the provider label display, add a small "via ModelName" text. The `model` field from the response contains the OpenRouter model ID — we need to show a readable name. Add a helper:

```typescript
function formatModelName(model: string): string {
  if (!model || model === 'builtin-fallback' || model === 'error-fallback' || model === 'picoclaw-haiku') return '';
  // Turn 'deepseek/deepseek-r1-0528:free' into 'DeepSeek R1 0528'
  const base = model.replace(/:free$/, '').split('/').pop() || '';
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}
```

Where the message metadata is shown (provider label area), add below it:

```tsx
{msg.model && formatModelName(msg.model) && (
  <span className="text-[10px] text-[#555]">via {formatModelName(msg.model)}</span>
)}
```

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0 && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "feat: show model name in chat responses"
```

---

### Task 11: Update openrouter-models.ts to Source from DB

**Files:**
- Modify: `server/src/services/openrouter-models.ts`

**Step 1: Update `getModelList` to prefer DB**

In `server/src/services/openrouter-models.ts`, update `getModelList()` (line 87) to check the DB first:

```typescript
import { db } from '../db/index.js';

async function getModelList(): Promise<string[]> {
  // Prefer DB-sourced active curated models
  try {
    const rows = db.prepare("SELECT id FROM free_models WHERE status = 'active' AND curated = 1 ORDER BY context_length DESC")
      .all() as Array<{ id: string }>;
    if (rows.length > 0) return rows.map(r => r.id);
  } catch { /* DB not ready — fall through */ }

  // Fallback to Redis cache
  try {
    const cached = await cacheGet(CACHE_KEY_MODELS);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as string[];
      }
    }
  } catch { /* Cache miss — fall through */ }

  return DEFAULT_FREE_MODELS;
}
```

**Step 2: Build and verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add server/src/services/openrouter-models.ts
git commit -m "feat: source model rotation list from DB, fall back to Redis/defaults"
```

---

### Task 12: Integration Test — Build + Manual Verify

**Step 1: Full build**

```bash
cd /root/GeekSpace2.0/server && npm run build && cd /root/GeekSpace2.0 && npm run build
```

Expected: Both server and frontend compile cleanly.

**Step 2: Start server and verify endpoints**

```bash
cd /root/GeekSpace2.0
fuser -k 3001/tcp
OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b OLLAMA_TIMEOUT_MS=120000 node server/dist/index.js &
sleep 3
# Test endpoints
curl -s http://localhost:3001/api/models/free | head -c 500
curl -s http://localhost:3001/api/models/changelog | head -c 500
```

Expected: JSON responses with model data (may be empty initially until sync runs).

**Step 3: Verify sync ran**

Check server logs for "Model sync complete" or "Model sync scheduler started" messages.

**Step 4: Kill server**

```bash
fuser -k 3001/tcp
```

**Step 5: Commit final state**

```bash
git add -A
git status
# If any remaining changes, commit
git commit -m "chore: final integration verification"
```
