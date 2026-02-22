# Weebo Ecosystem — Design Document

> Date: 2026-02-17 | Branch: `release/v3.0.0` | Scope: P0–P3

## Overview

Deploy and activate the Weebo ecosystem: a multi-tier AI agent system where Weebo Engine (fast, cheap, local 1.5b model) handles triage and simple tasks, while Kimi (cloud reasoning) handles complex multi-step work. Includes fleet management dashboard, daily briefings, enhanced terminal, active memory, automation recipes, and portfolio intelligence.

**User-facing naming:**
- Fleet page sidebar label: "Weebo's"
- Sidecar container/service: "Weebo Engine"
- Fleet agents: Weebo-1, Weebo-2, Weebo-3
- Internal code: remains `pico-*` (no file/route renames)

## P0 — Quick Fixes

### 1. Commit the require() fix
- `server/src/routes/agent.ts` already has the ESM import fix in working tree
- Just commit it

### 2. Add 4GB swap
- `fallocate -l 4G /swapfile`, `mkswap`, `swapon`, fstab entry
- Prevents OOM kills when Ollama (6.7 GiB) + Node.js run concurrently

### 3. Fix git remote URL
- Strip PAT from remote URL: `git remote set-url geekbase https://github.com/trendywink247-afk/GeekSpace2.0.git`
- User handles PAT rotation in GitHub settings

## P1 — Weebo Engine Container + Bridge + Dashboard

### Weebo Engine Container

**Architecture:** Minimal Node.js Express HTTP service in Docker that proxies to Ollama's `qwen2.5-coder:1.5b`.

**Files to create:**
```
picoclaw/
  index.js       — Express server, GET /health + POST /api/chat
  Dockerfile     — Node 20 Alpine, ~20MB image
  package.json   — express only
```

**Behavior:**
- `POST /api/chat` accepts `{ message, system }`, calls Ollama at `OLLAMA_BASE_URL/api/chat`
- Model: `qwen2.5-coder:1.5b` (already pulled, fast inference)
- `max_tokens: 256`, `temperature: 0.3`
- 5s timeout on Ollama calls
- Returns `{ response, tokens_in, tokens_out }`

**Docker Compose addition:**
```yaml
picoclaw:
  build: ./picoclaw
  container_name: geekspace-picoclaw
  restart: unless-stopped
  environment:
    - OLLAMA_BASE_URL=http://ollama-qtzz-ollama-1:11434
    - PICOCLAW_PORT=8080
  networks:
    - geekspace-net
    - geekspace-shared
  deploy:
    resources:
      limits:
        memory: 64M
```

**Env updates:**
- `PICOCLAW_URL=http://picoclaw:8080` (in Docker) / `http://localhost:8080` (on host)
- `PICOCLAW_ENABLED=true`
- Add `BRIDGE_ENABLED`, `BRIDGE_AUTO_ESCALATE`, `BRIDGE_MAX_WORKFLOW_STEPS` to `.env.example`

### Bridge Activation — Auto-routing

**Current state:** `bridgeChat()` only runs when user types `/bridge` or `/agent:` prefix.

**New behavior:** When `BRIDGE_ENABLED=true` AND `PICOCLAW_ENABLED=true`, ALL messages route through `bridgeChat()` by default. This creates the 3-tier system:

- Tier 1: Weebo Engine (local 1.5b, <1s, 1 credit) — trivial/simple messages
- Tier 2: Ollama (local 7b, 2-5s, 1 credit) — moderate tasks via single-agent dispatch
- Tier 3: Moonshot Kimi (cloud, 5-15s, 10+ credits) — complex/multi-step

**Implementation:** In the `POST /api/agent/chat` handler in `agent.ts`, add a check before the existing `forceRoute` logic:

```
if bridge+picoclaw enabled AND no explicit forceRoute:
  set forceRoute = 'bridge'
```

This reuses the existing bridge call block. When bridge/picoclaw are disabled, everything falls back to `routeChat()` as before.

### Weebo's Dashboard Page

**New file:** `src/dashboard/pages/PicoFleetPage.tsx`

**Export:** `export function PicoFleetPage()` (named export, matching existing pattern)

**Layout (3 sections):**

1. **Agent Cards** (top) — 3 cards for slots 1-3
   - Shows: name, status badge (active/idle/disabled), tasks_completed, tasks_failed
   - Slot 1: permanent, can't delete
   - Slots 2-3: create/delete buttons
   - Style: `bg-[#0B0B10]`, `border-[#7B61FF]/20`, tilt effect

2. **Quick Task** (middle) — input bar + "Plan" button
   - Type natural language, click Plan
   - Shows Kimi's planned tasks as cards
   - "Queue All" button to execute

3. **Task History** (bottom) — table/list
   - Columns: status badge, agent, type, description, timestamps
   - Status colors: queued=blue, running=amber, completed=green, failed=red
   - Click row for detail panel with logs

**API client:** Add `picoService` to `src/services/api.ts`:
```ts
picoService = {
  getAgents, createAgent, updateAgent, deleteAgent,
  getTasks, getTask, planTask, cancelTask
}
```

**Sidebar:** Add `{ id: 'pico', label: "Weebo's", icon: Zap }` to menuItems. Add `'pico'` to PageType union.

## P2 — Smart Router, Daily Briefing, Terminal 2.0

### Smart Agent Router

**Goal:** Eliminate duplicate classification. The bridge's `classifyComplexity()` IS the smart router.

When bridge is active, the flow is:
1. Message arrives at `/api/agent/chat`
2. Bridge classifies complexity (trivial/simple/moderate/complex/multi-step)
3. Routes to appropriate tier automatically
4. Response includes `{ tier, credits_used, provider }` metadata

When bridge is NOT active, falls back to existing `routeChat()` with keyword-based intent classification.

**Add to response metadata:** `{ credits_used, provider, tier }` so the frontend can show cost indicators.

### Daily Briefing System

**New file:** `server/src/services/daily-briefing.ts`

**New table:**
```sql
CREATE TABLE briefings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT DEFAULT 'daily',
  content TEXT NOT NULL,
  channels_sent TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Scheduler:** `setInterval` every 60s, checks all users' `agent_configs.briefing_time` (default "08:00"). Fires once per day per user.

**Briefing content:** PicoClaw generates a concise summary from:
- Pending reminders due today
- Yesterday's task completion stats
- Failed tasks needing attention
- Integration statuses

**Delivery channels:**
- Always: store in `briefings` table (dashboard card reads it)
- If Telegram linked: send via Telegram bot

**Endpoint:** `GET /api/briefings` — returns recent briefings for authenticated user.

**Dashboard:** Add a "Daily Briefing" card to OverviewPage showing latest briefing with fade-in animation.

### Terminal 2.0

**Modify:** Existing `/command` route in `agent.ts` (or wherever terminal commands are handled).

**New command groups:**

Fleet commands:
- `gs pico status` / `gs pico agents` / `gs pico create <name>` / `gs pico delete <slot>`
- `gs pico task <request>` / `gs pico tasks` / `gs pico cancel <id>`

System commands:
- `gs health` / `gs credits` / `gs usage today`

Quick actions:
- `gs remind <text>` — direct insert, no Kimi planning overhead
- `gs deploy portfolio` / `gs brief`

**Output styling:** Return HTML spans with inline styles for colored output:
- Success: green (#61FF7B)
- Error: red (#FF6161)
- Info: cyan
- Headers: bold purple (#7B61FF)

## P3 — Memory, Recipes, Portfolio Intelligence

### Active Memory Extraction

**Enhance:** `server/src/services/memory.ts` (existing file)

**After each chat response:** Background call to PicoClaw with extraction prompt:
- Extract: preferences, facts, project context, behavioral patterns
- Store as typed entries in `agent_memory` table (already exists)
- Deduplicate: before insert, check existing memories for similarity (word overlap > 60%)

**System prompt injection:** `buildMemoryContext()` already exists — enhance it to:
- Query memories matching keywords from user's message
- Inject top 5 most relevant as "What I know about you" section
- Limit to keep within context windows

**Chat UI indicator:** Add `memoriesUsed: string[]` to response metadata. Frontend shows subtle indicator when memories were used.

**Memory management:** Enhance existing MemoryManagerPage with:
- Category filter tabs (preference/fact/project/pattern)
- Edit/delete controls per memory
- "Clear all memories" with confirmation dialog

### Automation Recipes

**New file:** `server/src/services/recipes.ts`

**New table:**
```sql
CREATE TABLE installed_recipes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  installed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, recipe_id)
);
```

**6 starter recipes:**
1. Morning Briefing — daily briefing at 8 AM via Telegram
2. Git Watcher — webhook for GitHub push events, creates summary reminder
3. Weekly Review — Sunday summary of completed tasks
4. Deadline Enforcer — overdue reminder escalation via Telegram
5. API Health Monitor — check URL every 5 min, alert on failure
6. Portfolio Traffic — weekly summary of portfolio page visits

**Each recipe:** id, name, description, icon, category, required_integrations, `setup()`, `teardown()`

**Endpoints:**
- `GET /api/recipes` — list all with install status
- `POST /api/recipes/:id/install`
- `DELETE /api/recipes/:id/uninstall`

**New page:** `RecipesPage.tsx` — card grid with install/uninstall buttons, active badges, integration requirement indicators.

**Sidebar:** `{ id: 'recipes', label: 'Recipes', icon: BookOpen }`

### Portfolio Intelligence

**Enhance:** Existing portfolio visitor chat flow.

**Visitor intent detection:** PicoClaw classifies visitor as recruiter/collaborator/curious. Classification happens on first message.

**Dynamic highlights:** Based on intent, response personality adjusts emphasis:
- Recruiters: skills, experience, notable projects
- Collaborators: open source, tech stack, GitHub
- Curious: friendly overview

**Abuse detection:** After 20 messages from same visitor (tracked by IP/session), switch to polite "Here's my contact info" response.

**Analytics (on existing PortfolioPage):**
- Visitor count, average messages per visitor
- Top intents distribution
- Stored in `activity_log` (already exists)

## Architecture Diagram (Post-deployment)

```
User → Caddy :443 → GeekSpace API :3001
                         │
                    ┌─────┴─────┐
                    │  Bridge    │ (auto-route when enabled)
                    └──┬────┬───┘
                 trivial  complex
                    │       │
              Weebo Engine  Kimi/Moonshot
              :8080 (1.5b)  (cloud)
                    │       │
                    └───┬───┘
                  Pico Fleet Worker
                  (3 slots/user, 10s interval)
                        │
            ┌───────┬───┴───┬──────────┐
         Reminders  Telegram  API Calls  Portfolio
```

## Non-goals (this session)

- Multi-channel presence (Discord, WhatsApp) — P4
- Evolving personality — P4
- Developer API / SDK — P5
- n8n integration testing
- Payment gateway integration

## Dependencies

- Ollama must be running with `qwen2.5-coder:1.5b` pulled (confirmed)
- Docker Compose for Weebo Engine container
- No new npm packages needed for backend (Express, uuid, better-sqlite3 already present)
- Frontend: no new packages (existing Lucide icons have Zap, BookOpen)
