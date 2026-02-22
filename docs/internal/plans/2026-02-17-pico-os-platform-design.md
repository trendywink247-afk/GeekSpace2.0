# GeekSpace 2.0 — PicoClaw OS Platform Design

**Date:** 2026-02-17
**Status:** Approved
**Scope:** PicoClaw as unified AI OS across all features + platform-wide UX improvements

---

## Vision

PicoClaw is the user's **personal AI OS** — not a chatbot, not a background worker, but the face, the worker, and the router for every interaction in GeekSpace. Every chat, every task, every notification goes through the user's Pico agent. Pico knows who the user is, what they're doing, and what they care about — always.

---

## Section 1: Pico OS Core Architecture

### 1.1 Context Loader

On every Pico interaction (chat, task, terminal, portfolio visitor), load full user context:

```
PicoContext.load(userId) →
  agent_memory       — last 20 entries (includes auto_summary tags)
  active reminders   — next 5 due
  pico_tasks         — in-progress / queued
  portfolio          — headline, about, skills
  integrations       — which channels are linked (telegram, n8n, etc.)
  user preferences   — personality (weebo/jarvis/edith), model preference
  today's summary    — latest auto_summary from agent_memory
```

Context is assembled as a compact system prompt block injected before every LLM call. Target: < 800 tokens for the context block.

### 1.2 Smart Model Router

Two signals combined:

**User preference** (set in Agent Settings):
- `local` → prefer Ollama always
- `cloud` → prefer OpenRouter free
- `premium` → prefer Kimi (Edith)
- `auto` (default) → Pico decides

**Pico runtime decision** (when preference is `auto`):
```
1. Ping Ollama response time vs OpenRouter latency
2. Check task complexity:
   - Simple (chat, reminder, status) → whichever is faster (Ollama usually wins)
   - Generation (bio, headline, about) → Kimi (single call, JSON response)
   - Planning (multi-step tasks) → Kimi
   - Complex reasoning → Kimi
3. Check user plan:
   - Free → Ollama or OpenRouter-free only (no Kimi unless day pass active)
   - Pilot/Intro → can use Kimi but check credits
   - Half Year / Yearly → Kimi unrestricted
```

For Weebo Quick Tasks complexity escalation:
```
Task submitted →
  Pico estimates complexity (keyword scan) →
  Simple: Ollama plans (~2s)
  Medium: OpenRouter free plans (~3s)
  Complex: if user is premium → auto-use Kimi
           if user is free/pilot → ask: "This looks complex. Want Edith (10 credits) to handle it?"
```

### 1.3 Sleep / Wake Cycle

```
Pico Worker runs every 30s (configurable PICO_WORKER_INTERVAL_MS)
If no tasks queued for 5 consecutive minutes → throttle to 5-min poll (PICO_IDLE_INTERVAL_MS)
On new task created or user message → immediately reset to 30s interval
On worker completion → log to pico_task_logs, update reminder if applicable, send Telegram if configured
```

New env var: `PICO_IDLE_INTERVAL_MS` (default: 300000 = 5 min)

---

## Section 2: Bug Fixes + Billing + Cleanup

### 2.1 Telegram Onboarding Bug

**Root cause:** `IntegrationsStep.tsx` (step 5) immediately polls for telegram status after showing the deep link, causing a premature step advance. Fix: show deep link + "I've connected it" manual confirm button. Remove auto-polling on step 5. Status check only on button click.

### 2.2 Avatar Not Reflecting on Dashboard

**Investigate:** The `SettingsPage.handleSave()` now calls `setUser(updatedUser)`. Verify the `PATCH /api/users/me` response actually includes `avatar` field. Check if `DashboardApp` header re-renders on store change (selector may not be reactive if user object is replaced vs mutated).

### 2.3 Smoke Test User Cleanup

Delete rows from live DB (`/app/data/geekspace.db`) where `username LIKE 'smoketest%' OR username LIKE 'smoke2test%'`. These were created during deploy testing.

### 2.4 Billing — New Plan Structure

Replace `PLAN_DEFINITIONS` in `server/src/db/index.ts`:

| Key | Name | Price INR | Was | Price USD | Credits | Pico Slots | Interval | Badge |
|-----|------|-----------|-----|-----------|---------|------------|----------|-------|
| `free` | Free | ₹0 | — | $0 | 5,000 | 0 | month | — |
| `pilot` | Pilot | ₹299 | new | $4 | 100,000 | 2 | month | New |
| `intro` | Intro | ₹999 | ~~₹1999~~ | $12 | 100,000 | 2 | 2 months | Best to start |
| `halfyear` | Half Year | ₹2999 | ~~₹3999~~ | $35 | 700,000 | 3 | 6 months | Most popular |
| `yearly` | Yearly | ₹4999 | ~~₹5999~~ | $60 | 1,500,000 | 3 | year | Best value |

**Day Pass** (new): `POST /api/billing/day-pass` — $1 charge, creates a `day_passes` DB record with `expires_at = NOW + 24hrs`, grants 1 temporary Pico slot and 2,000 bonus credits. Free users only. Frontend: "Try PicoClaw for $1/day" CTA on the free plan card.

**`originalPriceInr`** field added to `PlanDefinition` to show slashed prices on billing UI.

---

## Section 3: AI Speed Everywhere

### 3.1 Onboarding Screen 2 — Single Kimi Call

Current: 2 parallel calls to generate headline + bio separately.
Fix: 1 Kimi call with prompt `"Return JSON: { headline: string, bio: string }"` using the user's tags and name. Parse JSON, fill both fields. Halves latency.

Same fix for Step 4 (portfolio): 1 call returning `{ headline, about, skills: string[] }`.

### 3.2 Dashboard Chat — Streaming

Wire frontend `AgentChatPanel.tsx` to use `GET /api/agent/stream-chat` (SSE endpoint, already built) instead of `POST /api/chat`. Text streams in word-by-word. Show typing indicator until first token arrives. Pico context block injected into every stream call.

Personality is the face: greeting, name, emoji all come from Weebo/Jarvis/Edith definition. User is always talking to their Pico, not a generic AI.

### 3.3 Weebo Quick Tasks — Pico Routing

See Section 1.2 routing logic. Additional changes:
- Task completion updates the linked reminder if one was created (`pico_tasks.reminder_id` FK)
- Telegram notification on completion if channel linked
- Task history in PicoFleetPage shows model used per task

### 3.4 Terminal — Jarvis on OpenRouter Free

Terminal `ai "prompt"` command: route through Jarvis personality on best available OpenRouter free model. Model list checked daily (stored in `config.openrouterFreeModel`). A cron job (or manual `GET /api/admin/refresh-free-model`) fetches OpenRouter's model list, filters `context_length > 8000 AND pricing.prompt == "0"`, picks highest-context option, updates config.

---

## Section 4: User-to-User Networking

### 4.1 Portfolio Visitor Interaction

When anyone chats with a portfolio owner's agent:

```
Visitor sends message →
  Owner's Pico responds (existing behavior) →
  Pico saves to owner's agent_memory:
    { content: "Visitor [name/anon] asked about [topic]", tags: ["visitor", "portfolio-chat"] }
  portfolio.connection_count incremented in DB

  If owner has Telegram linked:
    Send: "👋 Someone just chatted with your Weebo about [topic snippet].
           Check your GeekSpace inbox."

  If visitor is authenticated GeekSpace user:
    Create/update DM thread in `portfolio_dms` table
    Owner sees thread in new Inbox tab in dashboard
```

### 4.2 New DB Tables

```sql
-- Portfolio DMs (authenticated visitor to owner)
CREATE TABLE portfolio_dms (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,      -- portfolio owner
  visitor_user_id TEXT,    -- authenticated visitor
  created_at TEXT,
  last_message_at TEXT
);

CREATE TABLE portfolio_dm_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  sender TEXT,             -- 'visitor' | 'pico' | 'owner'
  content TEXT,
  created_at TEXT
);

-- Visitor connection counter (unique per IP/user)
ALTER TABLE portfolios ADD COLUMN connection_count INTEGER DEFAULT 0;
ALTER TABLE portfolios ADD COLUMN last_connected_at TEXT;
```

### 4.3 Dashboard Inbox Tab

New sidebar item: **Inbox** (envelope icon, shows badge count for unread threads).
Page: `InboxPage.tsx` — lists DM threads, click to open thread, see conversation history, Pico can draft reply.

### 4.4 Portfolio Connections Display

Portfolio public page shows: `🔗 47 connections` badge. Clicking shows nothing (privacy) — just a social proof counter.

---

## Section 5: Themes, Settings & Notifications

### 5.1 Theme Mode (Actually Working)

Fix `SettingsPage.tsx` Theme tab:
- Wire dark/light/system buttons to `themeStore.setMode()`
- `themeStore` applies class to `document.documentElement` on change
- Save to `PATCH /api/users/me` field `theme_mode`
- On app load, read `user.theme_mode` from auth store and apply

### 5.2 AI-Generated Background (Pico + Kimi)

In Theme tab, new "Generate Background" section:
```
Optional text input: "describe a vibe (optional)"
Click "Generate with Pico" →
  POST /api/agent/generate-background { vibe?: string }
  Server: Kimi generates CSS gradient JSON:
    { gradient: "...", name: "Neon Jungle", accent: "#7B61FF" }
  Frontend: shows animated preview in a rounded card
  "Apply" button → saves to user's theme preferences
  "Try another" → calls again
```

Background renders as an animated CSS `conic-gradient` or `mesh-gradient` on the dashboard. No external image CDN needed.

### 5.3 Notifications Settings Saving

Wire all toggles in Settings > Notifications to `PATCH /api/users/me` on change (debounced 500ms). Fields: `notification_email`, `notification_push` (future), `notification_telegram`. Show a subtle "Saved" indicator.

### 5.4 Agent Settings

Verify `AgentSettingsPage.tsx` persists:
- Personality (edith/jarvis/weebo) → `agent_configs.personality` ✓
- Model preference (local/cloud/premium/auto) → `agent_configs.model_preference` (add column if missing)
- Agent name → `agent_configs.name`
- Chat mode → `agent_configs.mode`
All changes should be reflected immediately in the chat panel and sidebar.

---

## Section 6: Platform Features

### 6.1 Recipes Actually Running

Each installed recipe maps to a trigger in the Pico worker. On worker tick, check `installed_recipes` table. If recipe conditions met, execute:

| Recipe | Trigger | Config needed | Action |
|--------|---------|---------------|--------|
| morning-briefing | Daily 8am | timezone | Call existing `generateDailyBriefing()`, send via Telegram/email |
| git-watcher | Every 30min | repo URL, token | GET /repos/{owner}/{repo}/commits, compare last seen SHA, Telegram if new |
| weekly-review | Monday 9am | — | Summarize week's memories + tasks, send briefing |
| deadline-enforcer | Daily 7am | — | Scan reminders due in 24hrs, send Telegram reminder |
| api-health-monitor | Every 15min | endpoint URL | HTTP GET, alert on non-200 or timeout |
| portfolio-traffic | Daily 9am | — | Send `connection_count` delta since yesterday via Telegram |

Recipe config stored in new `recipe_configs` column (JSON) on `installed_recipes` table. UI: on install, show config modal for recipes that need it.

### 6.2 Memory Auto-Summarization

New Pico worker job: **daily summarizer** (runs at midnight per user timezone):
```
Collect:
  - Today's chat messages (from agent_conversations or activity_log)
  - Completed tasks (pico_tasks where completed_at = today)
  - Completed reminders (reminders where completed = 1 AND updated_at = today)
Summarize via Ollama (cheap):
  prompt: "In 3 bullet points, summarize this user's day: [data]"
Save to agent_memory:
  { content: "• Built portfolio • Set 3 reminders • Asked about TypeScript generics",
    tags: ["auto_summary", "2026-02-17"] }
```

Also: after every chat session (5min inactivity = session end), summarize the conversation and save to memory with tag `conversation_summary`.

### 6.3 Reminders ↔ Pico Task Sync

When Pico completes a task that created a reminder → mark that reminder complete.
When a reminder is created via Pico task → `reminders.created_by = 'pico-fleet'`, `reminders.pico_task_id = taskId` (add FK column).
RemindersPage shows "Created by Weebo" badge on Pico-created reminders.

### 6.4 Automations — WHEN/THEN Builder

Simple automation rule format:
```
WHEN  [trigger]
AND   [condition] (optional)
THEN  [action]
```

**Triggers (user provides):**
- Webhook received at `/api/webhooks/user/{userId}/custom`
- Daily at time (cron)
- New portfolio visitor
- Credit balance below threshold
- Reminder due

**Actions (platform provides):**
- Send Telegram message (template with variables)
- Create reminder
- Call external URL (webhook)
- Post to n8n workflow
- Generate and send AI summary

**What user provides:** trigger selection, action selection, any config values (time, message template, URL).
**What platform provides:** webhook endpoints, Pico evaluation engine, delivery (Telegram/email/n8n).

UI: `AutomationsPage.tsx` gets a "New Automation" button that opens a step-by-step wizard. Pico can also create automations from natural language: `/task "remind me every Monday at 9am to review my goals"`.

---

## Section 7: Cross-Cutting Concerns

### 7.1 PicoClaw Availability by Plan

| Feature | Free | Pilot | Intro | Half Year | Yearly |
|---------|------|-------|-------|-----------|--------|
| Pico slots | 0 (day pass for $1) | 2 | 2 | 3 | 3 |
| Pico model | — | Ollama/OR-free | Ollama/OR-free | + Kimi | + Kimi |
| Task escalation to Kimi | No | Ask user | Ask user | Auto | Auto |
| Memory summarization | No | Yes | Yes | Yes | Yes |
| Recipe execution | No | 2 recipes | 3 recipes | All | All |

### 7.2 Remove Smoke Test Users

```sql
-- Run directly on /app/data/geekspace.db
DELETE FROM users WHERE username LIKE 'smoketest%' OR username LIKE 'smoke2test%';
-- Cascading deletes handle related records (subscriptions, portfolios, etc.)
```

### 7.3 OpenRouter Free Model Refresh

New scheduled job (weekly): GET `https://openrouter.ai/api/v1/models`, filter `pricing.prompt = "0"` AND `context_length >= 8000`, sort by context_length DESC, take first result, write to a `system_config` table row `openrouter_free_model`. Terminal Jarvis and Weebo tasks read from this.

---

## Implementation Order (Wave Plan)

**Wave 1 — Critical Fixes (1-2 days):**
1. Telegram onboarding step 4 bug
2. Avatar reflection on dashboard
3. Smoke user cleanup
4. Billing plan restructure (Pilot plan, day pass, slashed prices)
5. Notifications settings save to backend
6. Agent settings model preference persisted

**Wave 2 — Pico OS Core (2-3 days):**
7. PicoContext loader (shared context function)
8. Smart model router (user preference + speed check)
9. Sleep/wake worker efficiency
10. Dashboard chat → streaming SSE
11. Weebo task routing (Ollama → OR-free → Kimi escalation)
12. Terminal → Jarvis on OpenRouter free

**Wave 3 — Networking & Themes (2-3 days):**
13. Portfolio connection counter
14. Visitor interaction → memory save + Telegram notify
15. Portfolio DM system + Inbox tab
16. Theme mode (actually working) + persistence
17. AI-generated background (Kimi gradient)

**Wave 4 — Platform Completion (3-4 days):**
18. Recipes actually executing (with config modal)
19. Memory auto-summarization (daily + per-session)
20. Reminders ↔ Pico task sync
21. Automations WHEN/THEN builder UI
22. Recipe configs + platform-provided triggers/actions
23. OpenRouter free model refresh job

---

## Key Files to Touch

| Area | Files |
|------|-------|
| Pico context | `server/src/services/pico-fleet.ts`, new `server/src/services/pico-context.ts` |
| Model router | `server/src/services/llm.ts`, `server/src/routes/agent.ts` |
| Billing | `server/src/db/index.ts`, `server/src/routes/billing.ts`, `src/dashboard/pages/BillingPage.tsx` |
| Streaming chat | `server/src/routes/agent.ts`, `src/components/AgentChatPanel.tsx` |
| Portfolio DMs | new `server/src/routes/inbox.ts`, new `src/dashboard/pages/InboxPage.tsx` |
| Themes | `src/dashboard/pages/SettingsPage.tsx`, `src/stores/themeStore.ts` |
| Recipes | `server/src/services/pico-fleet.ts` (worker), `server/src/services/recipes.ts` |
| Memory | `server/src/services/memory.ts`, `server/src/services/pico-fleet.ts` |
| Onboarding | `src/onboarding/steps/BioStep.tsx`, `src/onboarding/steps/PortfolioStep.tsx` |
| Terminal | `src/dashboard/pages/TerminalPage.tsx` |
| Notifications | `src/dashboard/pages/SettingsPage.tsx`, `server/src/routes/users.ts` |
| Agent settings | `src/dashboard/pages/AgentSettingsPage.tsx`, `server/src/routes/agent.ts` |
