# Free OpenRouter Models — Design Document

**Date:** 2026-02-18
**Status:** Approved

## Problem

GeekSpace already rotates through free OpenRouter models for cloud chat, but users have zero visibility into what models are available. They see "Cloud Engine" and nothing else. There's no way to choose a model, no daily refresh, and no communication about model availability.

## Solution

A DB-driven model registry with daily sync from OpenRouter, a dashboard showcase card, Telegram `/model` command, and hybrid user control (auto-select by default, pin a model if desired).

## Database Schema

### `free_models` table

```sql
CREATE TABLE IF NOT EXISTS free_models (
  id TEXT PRIMARY KEY,              -- OpenRouter model ID e.g. 'deepseek/deepseek-r1-0528:free'
  display_name TEXT NOT NULL,       -- 'DeepSeek R1 0528'
  provider TEXT NOT NULL,           -- 'deepseek'
  summary TEXT NOT NULL,            -- 'Open-source 671B MoE reasoning model, on par with o1'
  context_length INTEGER DEFAULT 0,
  parameters TEXT,                  -- '671B (37B active)' — human-readable
  status TEXT DEFAULT 'active',     -- 'active' | 'new' | 'retired' | 'unavailable'
  curated INTEGER DEFAULT 0,       -- 1 = on allowlist, 0 = auto-discovered
  first_seen TEXT NOT NULL,         -- ISO timestamp
  last_seen TEXT NOT NULL,          -- ISO timestamp, updated by daily job
  last_checked TEXT NOT NULL        -- ISO timestamp of last daily run
);
```

### `model_changelog` table

```sql
CREATE TABLE IF NOT EXISTS model_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  event TEXT NOT NULL,              -- 'added' | 'removed' | 'returned' | 'discovered'
  timestamp TEXT NOT NULL,
  notified INTEGER DEFAULT 0       -- 1 = Telegram notification sent
);
```

### `agent_configs` column addition

```sql
ALTER TABLE agent_configs ADD COLUMN preferred_free_model TEXT DEFAULT 'auto';
```

## Daily Sync Job

New `startModelSyncScheduler()` in `server/src/services/model-sync.ts`. Runs once at startup + every 24 hours via `setInterval`.

### Sync logic

1. Fetch `GET https://openrouter.ai/api/v1/models` — filter for `:free` suffix
2. Compare against `free_models` table:
   - **New + curated**: Insert `status='active'`, `curated=1`. Changelog: `'added'`
   - **New + not curated**: Insert `status='new'`, `curated=0`. Changelog: `'discovered'`
   - **Known + still present**: Update `last_seen`, `last_checked`. Keep status.
   - **Known + missing**: Set `status='unavailable'`. Changelog: `'removed'`
   - **Previously unavailable + returned**: Set `status='active'`. Changelog: `'returned'`
3. If any changelog entries were created, send one daily Telegram notification to users with Telegram connected, summarizing changes. Mark as `notified=1`.

### Curated allowlist

Hardcoded array of known-good model IDs in the sync service:

```typescript
const CURATED_MODELS: Record<string, { displayName: string; summary: string; parameters?: string }> = {
  'deepseek/deepseek-r1-0528:free': {
    displayName: 'DeepSeek R1 0528',
    summary: 'Open-source 671B MoE reasoning model, on par with o1',
    parameters: '671B (37B active)',
  },
  'meta-llama/llama-3.3-70b-instruct:free': {
    displayName: 'Llama 3.3 70B',
    summary: 'Multilingual instruction model, 8 languages, 128K context',
    parameters: '70B',
  },
  'qwen/qwen3-235b-a22b-thinking:free': {
    displayName: 'Qwen3 235B Thinking',
    summary: 'MoE reasoning model, 22B active, excels at math and code',
    parameters: '235B (22B active)',
  },
  // ... ~10 total from the list
};
```

Auto-discovered models get display name derived from ID and a generic summary until manually curated.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/models/free` | Public | All active/new free models with summaries |
| `GET` | `/api/models/changelog` | Public | Last 30 days of model changes |
| `PATCH` | `/api/agent/config` | Auth | Extended — accepts `preferred_free_model` |

### `GET /api/models/free` response

```json
{
  "models": [
    {
      "id": "deepseek/deepseek-r1-0528:free",
      "displayName": "DeepSeek R1 0528",
      "provider": "deepseek",
      "summary": "Open-source 671B MoE reasoning model, on par with o1",
      "contextLength": 164000,
      "parameters": "671B (37B active)",
      "status": "active",
      "curated": true,
      "isNew": false
    }
  ],
  "lastUpdated": "2026-02-18T06:00:00Z"
}
```

## Chat Routing Changes

In `llm.ts`, updated `callOpenRouterFree()` flow:

1. Check user's `preferred_free_model` from `agent_configs`
2. If set and `status='active'` in `free_models` → use it
3. If `'auto'` or unavailable → pick from curated active models (existing rotation)
4. Existing Redis rotation + quota fallback stays for runtime failover
5. Chat response now includes `model` field alongside `provider`

## Frontend — Dashboard Model Showcase

New card at bottom of Overview page:

- **Header:** "Available AI Models" with sparkle icon + "Free models powered by OpenRouter — updated daily"
- **Model grid:** Compact cards with:
  - Provider letter badge
  - Display name
  - One-line summary
  - Context length badge
  - "New" badge for `curated=0` models
  - "Use this model" button (sets `preferred_free_model`)
  - Checkmark on currently selected model
- **"Auto-select" option** at top (default)
- **Instruction text:** "Tip: Use `/model` in Telegram to switch models, or let auto-select pick the best available one."
- **Collapsible changelog** showing recent additions/removals

### Chat panel enhancement

Show actual model name below response: "via DeepSeek R1" in muted text.

## Telegram `/model` Command

In `message-router.ts`:

- `/model` — List all available free models with numbers, show current selection
- `/model auto` — Reset to auto-select
- `/model <number>` or `/model <name>` — Set preferred model by number or partial name match

### Daily notification format

```
📢 Model Update:
+ New: OpenAI gpt-oss-120b — 117B MoE, runs on single H100
- Removed: Google Gemma 3 27B

Use /model to see all available models.
```

Only sent when there are changes. Once per day. Only to users with Telegram connected.

## Credit Impact

No change to credit costs. Free OpenRouter models remain 2 credits per call regardless of which model is selected.

## Files to Create/Modify

**New files:**
- `server/src/services/model-sync.ts` — Daily sync scheduler + allowlist
- `server/src/routes/models.ts` — Model listing endpoints
- `src/dashboard/pages/OverviewPage.tsx` — Add model showcase card (or new component)

**Modified files:**
- `server/src/db/index.ts` — Add tables + migration + seed data
- `server/src/index.ts` — Start model sync scheduler
- `server/src/services/llm.ts` — Read preferred model, include model in response
- `server/src/services/openrouter-models.ts` — Source models from DB instead of hardcoded
- `server/src/services/message-router.ts` — Handle `/model` command
- `server/src/routes/agent.ts` — Accept `preferred_free_model` in config update
- `server/src/middleware/validate.ts` — Add to agentConfigUpdateSchema
- `src/components/AgentChatPanel.tsx` — Show model name in response
- `src/services/api.ts` — Add model service
- `src/types/index.ts` — Add FreeModel, ModelChangelog types
