# GeekSpace v2.3 — Bug Fixes + Platform Features Design

**Date:** 2026-02-18
**Status:** Approved

---

## Overview

Two-wave release:
- **Wave 1 (Bugs):** Fix 6 critical/medium bugs breaking core flows
- **Wave 2 (Features):** API dashboard, Docker tool access for PicoClaw, OpenRouter auto-switching, UI renames

---

## Wave 1: Bug Fixes

### Bug #1 + #2 — Chatbot + Terminal Returning "Sorry, I couldn't process that" (CRITICAL)

**Root cause:** `loadPicoContext()` in `pico-context.ts` has no error handling. Any DB query failure (missing column, constraint error, stale migration) throws inside `buildSystemPrompt()`. The outer catch block in the chat handler returns the generic 500 message.

**Fix:**
- Wrap `loadPicoContext()` body in try-catch, return empty context `{}` on failure with a warning log
- Both regular chat and terminal path share the same `buildSystemPrompt()`, so fixing `loadPicoContext()` fixes both

### Bug #3 — Accent Color Not Persisting

**Root cause:** `setAccentColor()` in `themeStore.ts` only updates Zustand state + CSS variable. Never calls the server. The backend has `accent_color` in `agent_configs` and the PATCH `/api/agent/config` endpoint already maps `accentColor → accent_color`.

**Fix:**
- In `SettingsPage.tsx` theme tab: after `setAccentColor(value)`, call `agentService.updateConfig({ accentColor: value })`
- On app init (DashboardApp): read `agentConfig.accentColor` and call `setAccentColor()` to apply from server

### Bug #4 — Username Asked Twice in Onboarding

**Root cause:** `ProfileStep.tsx` has a username field, but signup already collected username. User sees it twice.

**Fix:**
- Pre-populate `ProfileStep` username from auth store `user.username`
- The field remains editable (user may want to change it), but defaults to their existing username

### Bug #5 — Avatar Blank After Onboarding

**Root cause:** `completeOnboarding()` in authStore returns `{ success: true }` and the user object is never refreshed. Any avatar set during onboarding is in the DB but not reflected in the frontend store.

**Fix:**
- After `completeOnboarding()` succeeds, call `GET /api/auth/me` (or equivalent `fetchUser()`) to refresh the user in the auth store before navigating to dashboard

### Bug #6/#7 — Telegram "Already Linked Bot" in Onboarding + Templates

**Root cause:** To be confirmed from code investigation, but likely:
- `linkTelegram()` returns a bot deeplink that routes to the same geekspace bot regardless of user
- If a demo user previously linked, subsequent new-user flows see the same bot state
- Template `setup_telegram` redirects to the same deeplink without a fresh one-time token

**Fix:**
- Ensure `POST /api/integrations/telegram/link` always generates a fresh one-time start token per request
- Store token with TTL in Redis; Telegram bot webhook validates token to identify user
- IntegrationsStep always calls `linkTelegram()` fresh (do not cache old link URL)

### Bug #8 — Rename UI Labels

**Scope:** Text-only changes in the frontend:
- "Pico" → "Weebo" in AgentSettingsPage and any remaining UI references
- "Ollama" → "Local AI Engine" in AgentSettingsPage model preference buttons
- Any "PicoClaw" user-facing text → "Weebo"

---

## Wave 2: Features

### Feature A — API Dashboard (api.geekspace.space)

**Admin view** protected by `ADMIN_TOKEN` env var:

**Backend:**
- New Express router `server/src/routes/admin.ts`
- Auth middleware: checks `Authorization: Bearer <ADMIN_TOKEN>` header
- Endpoints:
  - `GET /api/admin/health` — Redis ping, Ollama status, PicoClaw status, uptime
  - `GET /api/admin/stats` — total users, active Weebo count (agent_configs rows), tasks running/completed today
  - `GET /api/admin/tasks` — paginated list of all pico_tasks across all users with user info
  - `GET /api/admin/logs` — last 100 server log lines (from in-memory ring buffer)
  - `GET /api/admin/stream` — SSE stream: emits on every pico_task insert/update (EventEmitter pattern)

**Frontend:**
- Static HTML admin page served at `GET /admin` by Express (no React build dependency)
- Shows: stats counters, task feed (auto-refresh 10s), SSE live stream of task events, health indicators
- Auth: prompts for ADMIN_TOKEN in-page (localStorage for session)

**Caddy config:** Add `api.geekspace.space` vhost → `localhost:3001` (same server, different hostname)

**User personal feed:**
- Add "Weebo Activity" card to PicoFleetPage (or as a collapsible section)
- Shows user's own last 10 pico_tasks with status badges, model used, duration
- Polls `GET /api/pico/tasks?limit=10` every 30s

### Feature B — PicoClaw Docker Tool Access

Tools added to `pico-fleet.ts` callable during task planning:

| Tool | Service | Endpoint | Purpose |
|------|---------|----------|---------|
| `crawl_url` | crawl4ai | `http://crawl4ai-ykgs-crawl4ai-1:11235/crawl` | Scrape/crawl a URL, returns markdown |
| `ping_health` | healthchecks | Internal HTTP | Check if a service is alive |
| `trigger_workflow` | windmill | Webhook URL | Trigger a Windmill flow with payload |

**Integration:**
- Action types `crawl_url` and `trigger_workflow` added to `action-parser.ts` + `action-executor.ts`
- Kimi (edith) can emit these actions in task plans
- Tools only work in Docker (geekspace-shared network); graceful fallback in dev (log + skip)

### Feature C — OpenRouter Free-Tier Model Auto-Switching

**Current:** Single hardcoded model (e.g. `deepseek-chat:free`)
**New:** Priority-ordered fallback chain with automatic switching on quota errors

**Implementation:**
- `server/src/services/openrouter-models.ts` (new):
  - `fetchFreeModels()` — GET `https://openrouter.ai/api/v1/models` filtered to `:free` suffix, ordered by context length descending, top 5 stored in Redis as `openrouter:free_models` (TTL 6hr)
  - `getNextModel(currentModel)` — returns next model in list, cycling back to start if exhausted
  - `refreshModelsIfStale()` — called by PicoClaw worker every 6hrs
- In `callOpenRouterWithModel()` in `llm.ts`:
  - On 429 / `insufficient_quota` / `rate_limit` error: call `getNextModel()`, retry once with new model
  - Track current model in Redis (`openrouter:current_free_model`) so all requests use same model
- PicoClaw worker: add 6-hour tick using `lastModelRefresh` timestamp check
- On startup: call `fetchFreeModels()` to populate initial list

**Model refresh flow:**
1. Startup: fetch + cache top-5 free models
2. Every 6hr PicoClaw tick: re-fetch and update cache
3. On quota error: switch to next model in cached list
4. If all 5 exhausted: fall back to Ollama (local)

---

## Implementation Order

1. Bug fixes (Wave 1) — all independent, can be parallelized
2. Feature A (API dashboard) — new route + static HTML
3. Feature B (Docker tools) — additive to pico-fleet + action-parser
4. Feature C (OpenRouter switching) — new service + llm.ts changes
