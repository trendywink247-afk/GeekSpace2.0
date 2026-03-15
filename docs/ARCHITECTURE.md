# Agentin — System Architecture

> Authoritative reference for how Agentin works internally.

## 1. High-Level Overview

Agentin is a **Personal AI Operating System** — a self-hosted platform where each user gets their own AI agent with a dashboard, terminal, portfolio, and automation engine.

```
User (Browser)
    │
    ▼
┌─────────────────────┐
│  Caddy :443         │  auto-HTTPS, reverse proxy
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Express API :3001  │  serves built SPA + API
│                     │
│  ├── JWT auth       │
│  ├── Zod validation │
│  ├── Rate limiting  │
│  ├── SQLite (WAL)   │
│  │                  │
│  ├── Multi-Engine LLM Router
│  │   ├── Free:    Ollama → Groq → Gemini Flash → OpenRouter Free → builtin
│  │   ├── Paid:    Ollama → Together AI → Gemini Flash → Edith/Kimi K2 → builtin
│  │   └── Auto:    sidecar → Ollama → builtin
│  │
│  ├── Personality System (Edith / Jarvis / Weebo)
│  ├── Credit & Billing System
│  └── Redis (cache, job queue)
└─────────────────────┘
```

## 2. Request Lifecycle

1. Browser sends request to Caddy (:443, auto-HTTPS)
2. Caddy reverse-proxies `/api/*` to Express (:3001), serves SPA for everything else
3. Express middleware chain: helmet → CORS → body parser → request logger → rate limiter
4. Route handler authenticates via JWT (`Authorization: Bearer <token>`)
5. Zod schema validates request body/query
6. Business logic executes (DB queries, LLM calls, etc.)
7. Response returned as JSON
8. Global error handler catches any unhandled errors

## 3. Multi-Engine LLM Router

**Source:** `server/src/services/llm.ts`

The router classifies each message's intent, then picks the best provider.

### 3.1 Intent Classification

```typescript
type Intent = 'simple' | 'planning' | 'coding' | 'automation' | 'complex';
```

Classification rules (in order of precedence):
1. Word count > 80 → `complex`
2. 2+ coding keywords → `coding`
3. 1+ automation keywords → `automation`
4. 2+ planning keywords → `planning`
5. 2+ complex keywords OR word count > 40 → `complex`
6. Otherwise → `simple`

### 3.2 Provider Selection

```
if forceProvider is set → use that provider
else:
  simple       → Ollama (fallback: Groq → Gemini Flash → OpenRouter Free → builtin)
  coding       → Ollama → Groq → Together AI (fallback: Edith/Kimi K2 → builtin)
  complex      → Together AI (fallback: Edith/Kimi K2 → Groq → builtin)
  planning     → Together AI (fallback: Edith/Kimi K2 → Groq → builtin)
  automation   → sidecar → Ollama (fallback: builtin)
```

### 3.3 Provider Details

| Provider | Endpoint | Timeout | Auth | Cost |
|----------|----------|---------|------|------|
| Ollama (Local) | `OLLAMA_BASE_URL/api/chat` | 120s | None | 1 credit/call |
| OpenRouter (Cloud) | `OPENROUTER_BASE_URL/chat/completions` | 90s | Bearer API key | 5 cr/1K tokens |
| OpenRouter Free | `OPENROUTER_FREE_BASE_URL/chat/completions` | 90s | Bearer API key | 2 credits/call |
| Groq | `GROQ_BASE_URL/chat/completions` | 30s | Bearer API key | 2 credits/call (free tier) |
| Gemini Flash | `GEMINI_BASE_URL/models/...` | 30s | API key query param | 2 credits/call |
| Together AI | `TOGETHER_BASE_URL/chat/completions` | 30s | Bearer API key | 5 cr/1K tokens |
| Edith / Kimi K2 | `EDITH_BASE_URL` | 120s | Bearer API key | 10 cr/1K tokens (min 10) |
| Automation sidecar | `PICOCLAW_URL` | 5s | None | 1 credit/call |
| Builtin | N/A | N/A | N/A | 0 (static fallback) |

### 3.4 Fallback Chain

If a provider fails:
1. Together AI / Edith fails → try Groq → try Ollama → try builtin
2. OpenRouter fails → try Ollama → try builtin
3. Ollama fails → try builtin (static error message)

The builtin fallback returns a message explaining that AI backends are unreachable.

### 3.5 Credit Cost Computation

**Source:** `server/src/services/llm.ts` → `computeCreditCost()`

| Provider | Calculation |
|----------|-------------|
| Ollama | 1 credit flat |
| OpenRouter Free | 2 credits flat |
| Automation sidecar | 1 credit flat |
| Builtin | 0 credits |
| OpenRouter (paid) | `totalTokens / 1000 * 5` |
| Together AI / Edith / Premium | `totalTokens / 1000 * 10` (minimum 10) |

Credits deducted via `deductSubscriptionCredits()` after each call.

### 3.6 Tool Calling Compatibility

| Provider | Tool Format | Notes |
|----------|-------------|-------|
| Groq | OpenAI tools ✅ | Llama 3.3 70B native |
| Together AI | OpenAI tools ✅ | Llama 3.1 70B native |
| Gemini Flash | functionDeclarations ⚠️ | normalizer handles (llm-tool-normalizer.ts) |
| OpenRouter | OpenAI tools ✅ | allowlist filtered |
| Edith / Kimi K2 | OpenAI tools ✅ | via edith-bridge |

## 4. Chat Handler — Prefix Routing

**Source:** `server/src/routes/agent.ts`, `POST /api/agent/chat`

### 4.1 Prefix Commands
- **`/premium <message>`** — Force route to Moonshot reasoning model
- **`/local <message>`** — Force route to Ollama via LLM router

### 4.2 Auto-Routing (no prefix)
1. Classify intent via `classifyIntent()`
2. Check credit balance — if `credits_remaining <= 0`, return friendly error
3. Route based on intent (see §3.2)
4. Deduct credits after response

### 4.3 Response Format

```json
{
  "text": "AI response text",
  "route": "premium | local",
  "latencyMs": 342,
  "provider": "ollama | openrouter | edith | builtin",
  "tier": "local | premium",
  "creditsUsed": 10,
  "creditsRemaining": 14990
}
```

## 5. Personality System

**Source:** `server/src/prompts/personalities.ts`

Nine built-in personalities that change the agent's tone, greeting, and behavior (Weebo, Edith, Jarvis, Aria, Forge, Pulse, Echo, Cal, Nova):

| Personality | Codename | Tone | Greeting Style |
|-------------|----------|------|----------------|
| **Edith** | The Boss | Professional CTO. Direct, efficient. | "What do you need?" |
| **Jarvis** | The Helper | Warm, capable butler. Default. | "Good day. How may I assist you?" |
| **Weebo** | The Darling | Enthusiastic, cute, excited to help. | "Hi hi! What are we doing today?" |

### How Personalities Work

1. User selects personality via `PATCH /api/agent/config` with `{"personality": "edith"}`
2. Stored in `agent_configs.personality` column
3. `buildSystemPrompt()` injects the personality prompt between the base system prompt and user session context
4. Portfolio visitor chat is personality-aware — greeting, suggested questions, and emoji adapt

### Prompt Assembly Order

```
1. OPENCLAW_IDENTITY (base system prompt — ~800 tokens)
2. Personality prompt (Edith/Jarvis/Weebo — ~100 tokens)
3. USER SESSION block (name, mode, voice, reminders, integrations)
4. Conversation history
```

**Source:** `server/src/prompts/openclaw-system.ts` for base prompt, `buildPortfolioVisitorPrompt()` for portfolio chat.

## 6. Credit & Billing System

**Source:** `server/src/db/index.ts` (PLAN_DEFINITIONS), `server/src/routes/billing.ts`, `server/src/services/llm.ts`

### Plans

| Plan | Credits | Price (USD) | Price (INR) | Interval |
|------|---------|-------------|-------------|----------|
| Free | 5,000 | $0 | ₹0 | — |
| Intro | 100,000 | $10 | ₹999 | 2 months |
| Monthly | 100,000 | $10 | ₹999 | 1 month |
| Half-Year | 700,000 | $30 | ₹2,999 | 6 months |
| Yearly | 1,500,000 | $50 | ₹4,999 | 12 months |

### Billing Flow

1. Signup creates a free subscription (`server/src/routes/auth.ts`)
2. Each chat/command call checks `credits_remaining > 0` before processing
3. After LLM response, `deductSubscriptionCredits()` updates the subscription
4. `POST /api/billing/upgrade` changes plan and resets credits
5. Cycle dates tracked via `cycle_start` and `cycle_end` columns

### Database Table: `subscriptions`

Key columns: `user_id`, `plan`, `credits_remaining`, `credits_total`, `price_usd`, `price_inr`, `interval_days`, `cycle_start`, `cycle_end`.

## 7. Premium Agent (Specialist Sessions)

**Source:** `server/src/services/premium-agent.ts`, `server/src/routes/agent.ts`

Users on paid plans can deploy a dedicated specialist agent session:

1. `POST /api/agent/deploy-premium` — costs 100 credits, creates a `premium_sessions` row
2. Agent gets a random codename (Agent-7, Nova, Cipher, etc.) and personality-flavored deploy message
3. `POST /api/agent/premium-chat/:sessionId` — uses Moonshot reasoning model, costs 10 cr/1K tokens
4. `DELETE /api/agent/premium-session/:sessionId` — ends the session

Guards: free users blocked (403), insufficient credits blocked.

## 8. Database Schema

**Source:** `server/src/db/index.ts`

SQLite with WAL mode + foreign keys enabled.

### Tables

| Table | Primary Key | Key Columns |
|-------|-------------|-------------|
| `users` | `id` (UUID) | email, username, password_hash, plan, credits |
| `agent_configs` | `id` | user_id (FK), name, mode, voice, personality, system_prompt |
| `subscriptions` | `id` | user_id (FK), plan, credits_remaining, credits_total, cycle dates |
| `premium_sessions` | `id` | user_id, agent_codename, task, status, credits_used, model_used |
| `api_keys` | `id` | user_id (FK), provider, key_encrypted, masked_key |
| `reminders` | `id` | user_id (FK), text, datetime, channel, category, recurring |
| `integrations` | `id` | user_id (FK), type, name, status, health, requests_today |
| `portfolios` | `user_id` (FK) | username, headline, about, skills (JSON), projects (JSON) |
| `automations` | `id` | user_id (FK), name, trigger_type, action_type, enabled, run_count |
| `usage_events` | `id` | user_id (FK), provider, model, tokens_in, tokens_out, cost_usd |
| `features` | `user_id` (FK) | social_discovery, portfolio_chat, automation_builder |
| `activity_log` | `id` | user_id (FK), action, details, icon |
| `contact_submissions` | `id` | name, email, company, message |

Migrations run automatically (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` for new columns).

## 9. Authentication

**Source:** `server/src/middleware/auth.ts`

- JWT-based. Tokens signed with `JWT_SECRET` (HS256 algorithm pinned), expire per `JWT_EXPIRES_IN` (default 7d).
- `requireAuth` middleware extracts `sub` claim as `userId`.
- Passwords hashed with bcryptjs (10 rounds).
- Rate-limited: 10 attempts per 15 minutes on login/signup.

## 10. Request Validation

**Source:** `server/src/middleware/validate.ts`

Zod schemas for all input:
- `signupSchema`, `loginSchema` — auth
- `chatSchema` — message (1-4000 chars)
- `commandSchema` — command (1-500 chars)
- `agentConfigUpdateSchema` — personality, name, mode, voice, etc.
- `deployPremiumSchema` — task description for specialist session
- `premiumChatSchema` — message for premium chat
- `reminderCreateSchema`, `automationCreateSchema`, `apiKeyCreateSchema`, `contactSchema`

## 11. Docker Architecture

### Containers

| Container | Image | Port | Network | Memory Limit |
|-----------|-------|------|---------|--------------|
| `geekspace-app` | Custom (multi-stage Node 20) | 3001 (exposed) | geekspace-net, geekspace-shared | 512MB |
| `geekspace-redis` | redis:7-alpine | 6379 (internal) | geekspace-net | 256MB |
| `geekspace-caddy` | caddy:2-alpine | 80, 443 (exposed) | geekspace-net | 128MB |
| `geekspace-picoclaw` | Custom (Node 20) | 8080 (localhost only) | geekspace-net, geekspace-shared | 64MB |
| `geekspace-browser` | Custom (Playwright) | 3100 (internal) | geekspace-net | 512MB |
| `geekspace-searxng` | searxng/searxng | 8888 (internal) | geekspace-net | 256MB |
| `geekspace-meilisearch` | getmeili/meilisearch | 7700 (internal) | geekspace-net | 256MB |
| `geekspace-qdrant` | qdrant/qdrant | 6333 (internal) | geekspace-net | 512MB |
| `geekspace-uptime-kuma` | louislam/uptime-kuma | 3200 (internal) | geekspace-net | 128MB |
| `ollama-qtzz-ollama-1` | ollama/ollama | 32778→11434 | geekspace-shared | — (external) |
| `openclaw-e3n5-openclaw-1` | hostinger/hvps-openclaw | 52325 | geekspace-shared | — (external) |

### Networks

- **`geekspace-net`** — Internal bridge. Agentin app, Redis, automation sidecar.
- **`geekspace-shared`** — External. Shared with Ollama and OpenClaw containers for DNS resolution.

### Volumes

- `geekspace20_geekspace-data` — SQLite database (`/app/data/geekspace.db`)
- `geekspace20_redis-data` — Redis AOF persistence
- `ollama-qtzz_ollama` — Ollama model storage

### EDITH Bridge (Legacy but Active)

The `edith-bridge` service (`bridge/edith-bridge/`) is a WebSocket-to-HTTP bridge for the OpenClaw inference gateway. While the primary premium path now uses direct Edith/Kimi K2 API calls, the bridge remains **deployed and running** for fallback/compatibility.

## 12. Security

- **Helmet** security headers (CSP in production)
- **CORS** restricted to configured origins
- **Rate limiting:** 200 req/15min global, 10 req/15min on auth, 30 req/15min on chat
- **JWT** with HS256 algorithm pinning (prevents algorithm-none attacks)
- **bcryptjs** password hashing (10 rounds)
- **AES-256-GCM + scrypt** encryption for stored API keys
- **Input validation** via Zod on all endpoints
- **Body size limit** (1MB default)
- **Non-root Docker user** (node)
- **WAL mode** SQLite for safe concurrent reads
- **Secrets never committed** — `.env` is gitignored
