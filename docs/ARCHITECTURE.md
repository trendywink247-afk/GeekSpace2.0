# GeekSpace 2.0 — System Architecture

This document is the authoritative reference for how GeekSpace works internally. It is written so that AI agents and human developers can understand the full system.

## 1. High-Level Overview

GeekSpace is a **Personal AI Operating System** — a self-hosted platform where each user gets their own AI agent with a dashboard, terminal, portfolio, and automation engine.

```
User (Browser)
    |
    v
[Caddy :443] ── reverse proxy + auto HTTPS
    |
    v
[Express API :3001] ── serves built SPA + API
    |
    +-- JWT auth
    +-- Zod validation
    +-- Rate limiting
    +-- SQLite (better-sqlite3, WAL mode)
    |
    +-- Three-Agent LLM Router
    |       |
    |       +-- Edith: OpenClaw via bridge / Moonshot fallback (premium)
    |       +-- Jarvis: OpenRouter free-tier models (cloud)
    |       +-- Weebo: Ollama local inference (included)
    |
    +-- Redis (job queue, cache)
```

## 2. Request Lifecycle

1. Browser sends request to Caddy (:443, auto-HTTPS)
2. Caddy reverse-proxies all traffic to Express (:3001), which serves the React SPA and API
3. Express middleware chain: helmet -> CORS -> body parser -> request logger -> rate limiter
4. Route handler authenticates via JWT (`Authorization: Bearer <token>`)
5. Zod schema validates request body/query
6. Business logic executes (DB queries, LLM calls, etc.)
7. Response returned as JSON
8. Global error handler catches any unhandled errors

## 3. Three-Agent LLM Router

**Source:** `server/src/services/llm.ts`

The router classifies each message's intent, then picks the best agent.

### 3.1 Intent Classification

```typescript
type Intent = 'simple' | 'greeting' | 'meta' | 'planning' | 'coding' | 'automation' | 'complex' | 'analysis';
```

Classification rules (in order of precedence):
1. Word count > 80 -> `complex`
2. 2+ coding keywords -> `coding`
3. 1+ automation keywords -> `automation`
4. 2+ planning keywords -> `planning`
5. 2+ complex keywords OR word count > 40 -> `complex`
6. Greeting patterns -> `greeting`
7. Meta patterns -> `meta`
8. Otherwise -> `simple`

**Coding keywords:** code, function, class, debug, error, bug, implement, refactor, typescript, javascript, python, react, api, sql, query, regex, algorithm, data structure

**Planning keywords:** plan, schedule, roadmap, timeline, milestone, goal, project, workflow, step by step, outline, organize

**Complex keywords:** explain, analyze, compare, design, architect, strategy, pros and cons, trade-off, deep dive, in detail, comprehensive

**Automation keywords:** automate, automation, cron, trigger, webhook, workflow, schedule task, batch, pipeline, n8n, zapier

### 3.2 Agent Selection

```typescript
type AgentName = 'edith' | 'jarvis' | 'weebo';
```

```
if forceAgent is set -> use that agent
else:
  simple / greeting / meta -> Weebo (local)
  coding / planning        -> Jarvis (cloud)
  complex / analysis       -> Edith (premium)
  automation               -> Weebo (local)
```

### 3.3 Agent Details

| Agent | Provider | URL | Timeout | Auth | Model |
|-------|----------|-----|---------|------|-------|
| Weebo | Ollama | `OLLAMA_BASE_URL/api/chat` | 120s | None | `OLLAMA_MODEL` (default: qwen2.5-coder:1.5b) |
| Jarvis | OpenRouter | `OPENROUTER_BASE_URL/chat/completions` | 120s | Bearer `OPENROUTER_API_KEY` | `OPENROUTER_FREE_MODEL` |
| Edith | OpenClaw (bridge) | `EDITH_GATEWAY_URL/v1/chat/completions` | 120s | Bearer `EDITH_TOKEN` | Configurable |
| Edith (fallback) | Moonshot | `api.moonshot.ai/v1/chat/completions` | 120s | Bearer `MOONSHOT_API_KEY` | `MOONSHOT_REASONING_MODEL` |
| Builtin | N/A | N/A | N/A | N/A | Static fallback message |

### 3.4 EDITH Service

**Source:** `server/src/services/edith.ts`

The dedicated EDITH client handles premium reasoning requests:

- Primary: EDITH Bridge (`/v1/chat/completions` via HTTP)
- `edithProbe()` checks bridge `/health` endpoint with 15s TTL cache
- 2 retries on transient failure
- Fallback: Moonshot direct API call
- HTML detection (rejects if the response is a web UI page, not an API)
- Supports OpenAI-format responses AND flat `{ content, response }` formats

### 3.5 Fallback Chains

If an agent's primary provider fails:
1. Edith fails -> Jarvis -> Weebo -> builtin
2. Jarvis fails -> Weebo -> builtin
3. Weebo fails -> Jarvis -> builtin

The builtin fallback returns a message explaining that AI backends are unreachable and suggests using terminal commands.

## 4. Chat Handler — Prefix Routing

**Source:** `server/src/routes/agent.ts`, `POST /api/agent/chat`

The chat handler supports force-routing and auto-routing:

### 4.1 Force-Routing Commands

- **`/edith <message>`** — Force route to Edith (premium reasoning)
- **`/premium <message>`** — Alias for /edith
- **`/jarvis <message>`** — Force route to Jarvis (cloud assistant)
- **`/weebo <message>`** — Force route to Weebo (local)
- **`/local <message>`** — Alias for /weebo

### 4.2 Auto-Routing (no prefix)

1. Classify intent via `classifyIntent()`
2. Resolve agent via `resolveAgent(intent)`
3. Route to the selected agent's provider
4. If provider fails, walk the fallback chain

### 4.3 Response Format

```json
{
  "text": "The AI response",
  "agent": "edith",
  "tier": "premium",
  "route": "premium",
  "provider": "openclaw",
  "model": "openclaw",
  "latencyMs": 1420,
  "creditsUsed": 45,
  "creditsRemaining": 14955
}
```

## 5. System Prompt Architecture

**Source:** `server/src/prompts/openclaw-system.ts`

### 5.1 Three Built-In Personas

| Persona | Personality | Style |
|---------|------------|-------|
| **EDITH_PERSONA** | Competent, direct, efficient | "Consider it handled." |
| **JARVIS_PERSONA** | Formal but warm, like a butler | "At your service." |
| **WEEBO_PERSONA** | Playful, enthusiastic, helpful | "On it!" |

`getPersonaPrompt(agentName, voice)` resolves the correct persona based on the active agent.

### 5.2 Portfolio Persona

`buildPortfolioPersona(agentName, ownerName, ownerData)` creates a specialized prompt for public portfolio chat, enriched with the portfolio owner's bio, skills, projects, and social links.

### 5.3 Response Sanitization

`sanitizeResponse(text)` strips internal terms from all AI output:
- OpenClaw, codename EDITH, Brain 1-4, Tri-Brain, Quad-Brain
- Ollama, qwen2.5-*, OpenRouter, Moonshot, kimi-k2-*, PicoClaw

Users never see internal provider names or architecture details.

### 5.4 Formatting Rules

`FORMATTING_RULES` constant is appended to all prompts, enforcing consistent markdown formatting across all agents.

## 6. Database Schema

**Source:** `server/src/db/index.ts`

SQLite with WAL mode + foreign keys enabled.

### Tables

| Table | Primary Key | Key Columns |
|-------|-------------|-------------|
| `users` | `id` (TEXT/UUID) | email, username, password_hash, plan, credits |
| `agent_configs` | `id` | user_id (FK unique), name, mode, voice, system_prompt, primary_model, creativity, formality |
| `api_keys` | `id` | user_id (FK), provider, key_encrypted, masked_key, is_default |
| `reminders` | `id` | user_id (FK), text, datetime, channel, category, recurring, completed |
| `integrations` | `id` | user_id (FK), type, name, status, health, requests_today |
| `portfolios` | `user_id` (FK) | username, headline, about, skills (JSON), projects (JSON), social (JSON) |
| `automations` | `id` | user_id (FK), name, trigger_type, action_type, enabled, run_count |
| `usage_events` | `id` | user_id (FK), provider, model, tokens_in, tokens_out, cost_usd, channel, tool |
| `features` | `user_id` (FK) | social_discovery, portfolio_chat, automation_builder, etc. |
| `contact_submissions` | `id` | name, email, company, message |
| `activity_log` | `id` | user_id (FK), action, details, icon |

### Indexes

Performance-critical indexes on: users(email), users(username), reminders(user_id), integrations(user_id), usage_events(user_id, created_at), activity_log(user_id), portfolios(username), api_keys(user_id), automations(user_id), agent_configs(user_id).

## 7. Authentication

**Source:** `server/src/middleware/auth.ts`

- JWT-based. Tokens signed with `JWT_SECRET`, expire per `JWT_EXPIRES_IN` (default 7d).
- Algorithm pinned to HS256 (prevents algorithm-none attacks).
- `requireAuth` middleware extracts `sub` claim as `userId`.
- Passwords hashed with bcryptjs (10 rounds).
- Rate-limited: 10 attempts per 15 minutes on login/signup.

## 8. Request Validation

**Source:** `server/src/middleware/validate.ts`

Zod schemas for all input:
- `signupSchema` — email, password (8-128 chars), username (regex), name
- `loginSchema` — email, password
- `chatSchema` — message (1-4000 chars)
- `commandSchema` — command (1-500 chars)
- `reminderCreateSchema` — text, datetime, channel, recurring, category, completed
- `automationCreateSchema` — name, description, triggerType, actionType, config, enabled
- `apiKeyCreateSchema` — provider, key, label, isDefault
- `contactSchema` — name, email, company, message

## 9. Terminal Command System

**Source:** `server/src/routes/agent.ts`, `POST /api/agent/command`

Server-side command execution (not a real shell). Commands:

| Command | What it does |
|---------|-------------|
| `gs me` | Reads user profile from DB |
| `gs reminders list` | Lists all reminders as formatted table |
| `gs reminders add "text"` | Inserts reminder + logs activity |
| `gs credits` | Shows credit balance + total usage |
| `gs usage today` | Today's API calls, tokens, cost |
| `gs usage month` | 30-day usage by provider |
| `gs integrations` | Lists integration status/health |
| `gs connect <svc>` | Sets integration status to connected |
| `gs disconnect <svc>` | Sets integration status to disconnected |
| `gs automations` | Lists automations with run counts |
| `gs status` | Shows agent config (name, mode, voice, model) |
| `gs portfolio` | Shows portfolio URL |
| `gs deploy` | Sets portfolio to public |
| `gs profile set <f> <v>` | Updates user profile field |
| `gs export` | Dumps all user data as JSON |
| `ai "prompt"` | Routes through three-agent router, returns AI response |
| `/edith "prompt"` | Force route to Edith (premium) |
| `/jarvis "prompt"` | Force route to Jarvis (cloud) |
| `/weebo "prompt"` | Force route to Weebo (local) |

## 10. Health Check

**Source:** `server/src/index.ts`, `GET /api/health`

Live probing of all components:

```json
{
  "ok": true,
  "status": "ok",
  "timestamp": "2026-02-15T12:00:00.000Z",
  "version": "2.2.0",
  "uptime": 3600,
  "edith": true,
  "ollama": true,
  "components": {
    "database": "ok",
    "ollama": "reachable | unreachable | not_configured",
    "openrouter": "configured | not_configured",
    "edith": "reachable | unreachable | not_configured"
  }
}
```

- `ok` = true only if database is healthy (core requirement)
- `edith` / `ollama` booleans for quick checks
- Ollama probed via `GET /api/tags` (3s timeout)
- EDITH probed via `GET /health` on the bridge (3s timeout), checks `ws_connected: true`

## 11. Docker Architecture

### Containers

| Container | Image | Port | Network |
|-----------|-------|------|---------|
| `geekspace-app` | Custom (multi-stage Node 20) | 3001 (exposed) | geekspace-net, geekspace-shared |
| `geekspace-redis` | redis:7-alpine | 6379 (internal) | geekspace-net |
| `geekspace-edith-bridge` | Custom (Node 20, profile: edith) | 8787 (internal) | geekspace-net, geekspace-shared |

### Networks

- **`geekspace-net`** — Internal bridge. All GeekSpace containers.
- **`geekspace-shared`** — External. Allows DNS resolution of Ollama and OpenClaw containers on the same Docker host.

### Reaching External Services

- **Ollama (Weebo):** Via container name on shared network (e.g. `ollama-qtzz-ollama-1:11434`) or `host.docker.internal:11434`
- **OpenClaw (Edith):** Via `edith-bridge:8787` (bridge handles WS connection to OpenClaw)

### Volumes

- `geekspace-data` — SQLite database (`/app/data/geekspace.db`)
- `redis-data` — Redis AOF persistence

## 12. Credits System

| Agent | Provider | Cost | Notes |
|-------|----------|------|-------|
| Weebo | Ollama | Included | Local inference |
| Jarvis | OpenRouter | 5 cr/1K tokens | Cloud API |
| Edith | OpenClaw/Moonshot | 10 cr/1K tokens | Premium reasoning |
| Builtin | N/A | Included | Static fallback |

Credits: Starting balance 15,000. Premium plan: 50,000 credits/month. Trial: 10,000 credits for 3 days.

Minimum per premium call: 10 credits (prevents zero-cost micro-queries).

## 13. Security

- **Helmet** security headers (CSP in production)
- **CORS** restricted to configured origins
- **Rate limiting:** 200 req/15min global, 10 req/15min on auth
- **JWT** HS256 algorithm-pinned with configurable expiry
- **bcryptjs** password hashing (10 rounds)
- **AES-256-GCM** encryption for stored API keys
- **Input validation** via Zod on all endpoints
- **Body size limit** (1MB default)
- **Non-root Docker user** (node)
- **WAL mode** SQLite for safe concurrent reads
- **Response sanitization** — strips internal model/provider names from AI output
