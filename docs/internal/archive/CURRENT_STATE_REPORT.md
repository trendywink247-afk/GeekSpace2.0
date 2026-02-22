# GeekSpace 2.0 — Current State Report (main branch)

> Generated: 2026-02-16
> Branch: `main` @ `e3b8091`
> Purpose: Pre-merge integrity baseline — what exists, what must not break.

---

## 1. Services & Ports

| Service | Container | Image | Port | Network | Health Check |
|---------|-----------|-------|------|---------|-------------|
| **GeekSpace API** | `geekspace-app` | `geekspace20-geekspace` (Node 20 Alpine) | `:3001` → host | `geekspace-net`, `geekspace-shared` | `curl http://localhost:3001/api/health` every 30s |
| **Redis** | `geekspace-redis` | `redis:7-alpine` | `:6379` (internal only) | `geekspace-net` | `redis-cli ping` every 10s |
| **EDITH Bridge** | `geekspace-edith-bridge` | `bridge/edith-bridge` | `:8787` (internal) | `geekspace-net`, `geekspace-shared` | `curl http://localhost:8787/health` every 15s |

### Notes
- EDITH Bridge is gated behind Docker profile `edith` — does NOT start by default. Legacy dead code.
- Ollama runs externally (Hostinger-managed), reachable via `geekspace-shared` network or host port 32778.
- Caddy runs on host (:443), not in Docker.

---

## 2. Docker Compose Topology

```
docker-compose.yml
├── geekspace (API)         — builds from ./Dockerfile
│   ├── depends_on: redis (service_healthy)
│   ├── volumes: geekspace-data:/app/data (SQLite)
│   ├── memory limit: 512M
│   └── networks: geekspace-net + geekspace-shared (external)
│
├── edith-bridge [LEGACY]   — profile: "edith" (won't start unless explicit)
│   ├── networks: geekspace-net + geekspace-shared
│   └── memory limit: 128M
│
└── redis                   — redis:7-alpine
    ├── command: appendonly yes, maxmemory 128mb, allkeys-lru
    ├── volumes: redis-data:/data
    ├── memory limit: 256M
    └── network: geekspace-net

Networks:
  geekspace-net    — internal bridge (app ↔ redis)
  geekspace-shared — external (app ↔ Ollama containers)

Volumes:
  geekspace-data   — SQLite DB persistence
  redis-data       — Redis AOF persistence
```

---

## 3. Request Flow

```
Internet
    │
    ▼
Caddy (:443, auto-HTTPS)
    │
    ├── /api/*  →  geekspace-app (:3001)
    │                  │
    │                  ├── SQLite (WAL mode, /app/data/geekspace.db)
    │                  ├── Redis (:6379) — job queue / cache
    │                  │
    │                  ├── Ollama (:11434 / :32778)  ← Local Engine (free)
    │                  ├── OpenRouter API             ← Cloud Engine (credits)
    │                  ├── OpenRouter Free Tier        ← Free Cloud (2 credits/call)
    │                  ├── Moonshot via OpenRouter     ← Premium Engine (10/1K tokens)
    │                  └── PicoClaw (:8080)            ← Automation Engine (disabled by default)
    │
    └── /*  →  /var/www/geekspace (SPA, file_server)
```

### LLM Routing Logic (llm.ts)

| Intent | Primary Provider | Fallback Chain |
|--------|-----------------|----------------|
| `simple` | Ollama (local) | → PicoClaw → builtin |
| `automation` | PicoClaw (if enabled) | → Ollama → builtin |
| `coding` | OpenRouter Free | → OpenRouter Paid → Ollama → builtin |
| `planning` | OpenRouter Free | → OpenRouter Paid → Ollama → builtin |
| `complex` | OpenRouter Free | → Edith (Moonshot) → OpenRouter Paid → Ollama → builtin |

---

## 4. Environment Variables

### Required in Production (crash if missing)
| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Token signing |
| `ENCRYPTION_KEY` | AES encryption for stored API keys |

### Core Configuration
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API server port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_PATH` | `./data/geekspace.db` | SQLite path |
| `CORS_ORIGINS` | `localhost:5173,localhost:4173` | Allowed origins |
| `PUBLIC_URL` | `http://localhost:5173` | Used in OpenRouter headers |
| `JWT_EXPIRES_IN` | `7d` | Token TTL |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Pino log level |

### LLM Providers
| Variable | Default | Provider |
|----------|---------|----------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local engine |
| `OLLAMA_MODEL` | `qwen2.5-coder:1.5b` | Local model |
| `OLLAMA_TIMEOUT_MS` | `120000` | |
| `OLLAMA_MAX_TOKENS` | `512` | |
| `OPENROUTER_API_KEY` | (empty) | Cloud engine key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4-5-20250929` | |
| `OPENROUTER_FREE_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Free cloud |
| `OPENROUTER_FREE_API_KEY` | (empty) | |
| `MOONSHOT_REASONING_MODEL` | `kimi-k2-thinking` | Premium engine |
| `MOONSHOT_TIMEOUT_MS` | `120000` | |
| `PICOCLAW_URL` | `http://localhost:8080` | Automation engine |
| `PICOCLAW_ENABLED` | `false` | Must opt-in |

### Deprecated (still in config.ts, not used for API calls)
| Variable | Status |
|----------|--------|
| `EDITH_GATEWAY_URL` | Only used in health check display |
| `EDITH_TOKEN` | Only used in health check display |

---

## 5. API Route Map

### Public Endpoints (no auth)
| Method | Path | Rate Limit | Purpose |
|--------|------|-----------|---------|
| `GET` | `/api/health` | global (200/15m) | Health + component probes |
| `POST` | `/api/auth/signup` | 10/15m | Registration |
| `POST` | `/api/auth/login` | 10/15m | Login |
| `POST` | `/api/auth/demo` | 10/15m | Demo login |
| `GET` | `/api/agent/personalities` | global | List 3 personalities |
| `POST` | `/api/agent/chat/public/:username` | 10/15m | Portfolio visitor chat |
| `GET` | `/api/billing/plans` | global | Plan definitions |
| `POST` | `/api/dashboard/contact` | 10/15m | Contact form |
| `GET` | `/api/directory` | global | User directory |
| `GET` | `/api/portfolio/:username` | global | Public portfolio |
| `GET` | `/api/users/:username/public` | global | Public profile |
| `POST` | `/api/automations/webhook/:id` | global | Webhook trigger |

### Authenticated Endpoints (requireAuth)
| Method | Path | Rate Limit | Purpose |
|--------|------|-----------|---------|
| `GET` | `/api/agent/config` | global | Agent config |
| `PATCH` | `/api/agent/config` | global | Update agent config |
| `POST` | `/api/agent/chat` | 30/15m | Main AI chat |
| `POST` | `/api/agent/chat/stream` | 30/15m | SSE streaming chat |
| `POST` | `/api/agent/command` | global | Terminal commands |
| `GET/POST/PUT/DELETE` | `/api/agent/memory*` | global | Memory CRUD |
| `GET` | `/api/agent/conversations` | global | Chat history |
| `POST` | `/api/agent/deploy-premium` | global | Deploy specialist |
| `POST` | `/api/agent/premium-chat/:sessionId` | global | Premium chat |
| `DELETE` | `/api/agent/premium-session/:sessionId` | global | End session |
| `GET` | `/api/billing/plan` | global | Current subscription |
| `POST` | `/api/billing/upgrade` | global | Upgrade plan |
| `GET` | `/api/billing/usage` | global | Usage history |
| `GET/PATCH` | `/api/users/me` | global | Profile |
| `GET` | `/api/usage/*` | global | Usage analytics |
| `GET/POST/PATCH/DELETE` | `/api/reminders*` | global | Reminders CRUD |
| `GET/POST/PATCH/DELETE` | `/api/integrations*` | global | Integrations |
| `GET/POST/PATCH/DELETE` | `/api/automations*` | global | Automations |
| `GET/POST/DELETE` | `/api/api-keys*` | global | API key management |
| `GET/POST` | `/api/portfolio` | global | Own portfolio |
| `GET/POST` | `/api/features` | global | Feature flags |
| `GET` | `/api/dashboard/stats` | global | Dashboard overview |

---

## 6. Health Checks & Probes

### Docker-Level
| Service | Check | Interval | Start Period | Retries |
|---------|-------|----------|-------------|---------|
| geekspace-app | `curl -f http://localhost:3001/api/health` | 30s | 30s | 3 |
| redis | `redis-cli ping` | 10s | 0s | 5 |
| edith-bridge | `curl -f http://localhost:8787/health` (dormant) | 15s | 10s | 3 |

### Dockerfile-Level
- `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3`
- Note: Dockerfile uses 10s start_period, compose uses 30s (compose wins at runtime)

### Application-Level (`GET /api/health`)
Probes 4 components live:
1. **Database**: `SELECT 1` — required for 200 status
2. **Ollama**: `GET /api/tags` with 3s timeout
3. **Edith/Moonshot**: `GET /models` via OpenRouter with 5s timeout
4. **PicoClaw**: `GET /health` with 3s timeout (only if enabled)

Returns `200 ok` if DB is up, `503 degraded` if DB is down. Other components are informational only.

---

## 7. Database Schema (14 tables)

| Table | Key Columns | Indexed |
|-------|-------------|---------|
| `users` | id, email, username, plan, credits | email, username |
| `agent_configs` | user_id (unique), name, personality, mode, voice | user_id |
| `api_keys` | user_id, provider, key_encrypted | user_id |
| `reminders` | user_id, text, datetime, completed | user_id |
| `integrations` | user_id, type, status, health | user_id |
| `portfolios` | user_id (PK), skills (JSON), projects (JSON) | username |
| `automations` | user_id, trigger_type, action_type, enabled | user_id |
| `usage_events` | user_id, provider, tokens_in/out, cost_usd | user_id, created_at, (user_id+created_at) |
| `features` | user_id (PK), feature toggles | — |
| `contact_submissions` | name, email, message | — |
| `activity_log` | user_id, action, details | user_id |
| `premium_sessions` | user_id, agent_codename, task, status | user_id |
| `subscriptions` | user_id (unique), plan, credits_remaining | user_id |
| `agent_memory`* | user_id, category, key, value, confidence | (created by memory.ts at init) |
| `conversation_log`* | user_id, role, content, provider | (created by memory.ts at init) |

*Tables created at runtime by `initMemoryTables()`, not in main schema block.

---

## 8. Known Issues (Pre-Merge)

### CRITICAL — Credit Deduction Inconsistency

**Two credit ledgers exist and are updated inconsistently:**

| Endpoint | `users.credits` | `subscriptions.credits_remaining` |
|----------|:---:|:---:|
| `POST /agent/chat` (premium route) | Deducted | Deducted |
| `POST /agent/chat` (main route) | Deducted | Deducted |
| `POST /agent/chat/stream` (complex) | Deducted | **MISSING** |
| `POST /agent/command` (ai subcommand) | Deducted | **MISSING** |
| `POST /agent/premium-chat/:sessionId` | Not touched | Deducted |
| `POST /billing/upgrade` | Not touched | Reset (plan change) |

**Impact**: `users.credits` and `subscriptions.credits_remaining` drift apart. Billing page reads from `subscriptions`; chat quota check reads from `subscriptions`; but some paths only deduct from `users`. Terminal `ai` commands bypass subscription limits entirely.

### HIGH — Automations Engine Risks
- `JSON.parse()` on `trigger_config` / `action_config` without try/catch — malformed JSON crashes engine
- `healthCheckTimer` interval never cleared on graceful shutdown (timer leak)
- `checkKeywordTriggers()` called fire-and-forget with `.catch(() => {})` — errors silently swallowed

### MEDIUM — Memory Extraction Pollution
- Regex pattern `/(?:my name is|i'm|i am)\s+([A-Z][a-zA-Z]+)/i` matches "I am happy" → stores "happy" as user's name
- No semantic validation on extracted facts
- Memory values stored in plaintext (no encryption for PII)

### MEDIUM — Build Fragility
- `tsconfig.app.json` has `noUnusedLocals: true` + `noUnusedParameters: true` — any unused import fails Docker build
- Main bundle: 534 kB (152 kB gzip), chart chunk: 420 kB — no dynamic imports for heavy pages

### LOW — Dead Config
- `config.edithGatewayUrl` and `config.edithToken` still exist in config.ts (deprecated, only used in health check display)
- EDITH bridge service in docker-compose.yml (gated behind profile, harmless)

### LOW — Frontend Dependencies
- `next-themes` in package.json — Next.js-only library, dead code in Vite app
- `sonner.tsx` imports `useTheme` from `next-themes` — fails silently, returns "system" default

---

## 9. Duplicated Logic

### Credit Deduction (3 code paths)
1. **agent.ts:172** — `UPDATE users SET credits = MAX(0, credits - ?)` + `deductSubscriptionCredits()`
2. **agent.ts:220** — Same dual deduction
3. **agent.ts:411** — Only `UPDATE users`, missing subscription deduction
4. **agent.ts:467** — Only `UPDATE users`, missing subscription deduction

**Root cause**: The billing system was added (subscriptions table) alongside the original `users.credits` column. Both were kept, creating two sources of truth.

### Ollama Availability Check (2 code paths)
1. `llm.ts:87` — `isOllamaAvailable()` with 30s cache
2. `index.ts:113` — Inline `fetch(ollamaBaseUrl/api/tags)` in health check (no cache)

Not a bug, but if behavior changes in one, it should change in both.

### Moonshot API Call (2 code paths)
1. `llm.ts:305` — `callMoonshotReasoning()` in the main LLM router
2. `edith.ts:41` — `tryMoonshot()` called by `edithChat()`

Both hit the same endpoint with the same model/key but different retry logic:
- `callMoonshotReasoning`: No retry, uses `AbortSignal.timeout()`
- `edithChat`: 1 retry with 500ms delay, uses custom `fetchWithTimeout()`

The router uses path 1 for auto-routed `edith` provider; `agent.ts` calls path 2 directly for `/premium` and `/edith` prefix routes.

---

## 10. Conflicting Routes

**No conflicts found.** All 13 route prefixes are unique:
```
/api/auth, /api/users, /api/agent, /api/usage, /api/integrations,
/api/reminders, /api/portfolio, /api/automations, /api/dashboard,
/api/directory, /api/api-keys, /api/features, /api/billing
```

The `/api/agent/chat/public/:username` and `/api/agent/chat` routes don't conflict because Express matches the more specific path first.

---

## 11. Production Risks (Hidden)

### Risk 1: SQLite Under Concurrent Load
- WAL mode helps, but better-sqlite3 is synchronous — long writes block the event loop
- No connection pooling (single `db` instance)
- High-traffic scenarios (multiple simultaneous chat requests) could bottleneck on DB writes

### Risk 2: No Request Timeout on LLM Proxy
- Ollama timeout: 120s. Moonshot timeout: 120s.
- Express has no global request timeout — a stalled upstream keeps the connection open indefinitely
- 30 concurrent users hitting chat = 30 pending 120s requests = potential resource exhaustion

### Risk 3: Redis Not Actually Used
- Redis is deployed and healthy, but no BullMQ jobs are queued
- `automations-engine.ts` executes synchronously, not via Redis queue
- Redis is essentially an idle 128MB process

### Risk 4: Graceful Shutdown Incomplete
- `index.ts:171` closes DB on SIGTERM/SIGINT
- But: no HTTP server `.close()`, no drain of in-flight requests, no Redis disconnect
- Docker stop with 10s grace period could kill mid-request

### Risk 5: JWT Secret Rotation = Session Wipe
- No token refresh endpoint
- Rotating `JWT_SECRET` (or restarting with a new one) invalidates ALL sessions
- Stale node processes on port 3001 cause "Invalid token" errors (different JWT secret)

### Risk 6: Seed Data in Production
- `seedDemoData()` guarded by `NODE_ENV !== 'production'`
- But `SEED_DEMO_DATA` env var defaults to `'true'` in non-production — accidental seeding possible if NODE_ENV is misconfigured

---

## 12. Pre-Merge Checklist — MUST NOT BREAK

### Core Functionality
- [ ] `GET /api/health` returns 200 with all component statuses
- [ ] `POST /api/auth/login` + `POST /api/auth/signup` work with JWT
- [ ] `POST /api/agent/chat` routes to Ollama by default, falls back gracefully
- [ ] `POST /api/agent/chat/stream` delivers SSE events
- [ ] `POST /api/agent/chat/public/:username` works without auth (portfolio)
- [ ] `GET /api/agent/personalities` returns 3 personalities
- [ ] `PATCH /api/agent/config` accepts `personality` field
- [ ] `POST /api/agent/deploy-premium` guards free users (403)
- [ ] `POST /api/agent/premium-chat/:sessionId` uses Moonshot
- [ ] Credit deduction occurs on every LLM call
- [ ] `GET /api/billing/plans` returns 5 plans with dual currency
- [ ] `GET /api/billing/plan` returns current subscription
- [ ] `POST /api/billing/upgrade` changes plan + resets credits

### Database Integrity
- [ ] All 14+ tables exist with correct schema
- [ ] Migrations (ALTER TABLE) are idempotent (try/catch)
- [ ] `agent_memory` and `conversation_log` created by `initMemoryTables()`
- [ ] `automation_logs` created by `initAutomationsEngine()`
- [ ] Indexes on: users(email, username), usage_events(user_id, created_at), etc.
- [ ] Foreign keys ON DELETE CASCADE for all child tables

### Security
- [ ] `JWT_SECRET` required in production (crashes if missing)
- [ ] `ENCRYPTION_KEY` required in production
- [ ] Helmet security headers on all responses
- [ ] CORS restricted to configured origins
- [ ] Auth rate limit: 10/15m on login/signup/demo
- [ ] Chat rate limit: 30/15m on `/api/agent/chat`
- [ ] Public rate limit: 10/15m on portfolio chat + contact
- [ ] Body size limit: 1MB
- [ ] All SQL uses parameterized queries (no injection vectors)

### Docker / Infrastructure
- [ ] Dockerfile multi-stage build (builder → production)
- [ ] Container runs as `node` user (non-root)
- [ ] Redis health check (service_healthy) gates app startup
- [ ] `geekspace-shared` network is external (must exist before `docker compose up`)
- [ ] Volume `geekspace-data` persists SQLite across rebuilds
- [ ] EDITH bridge stays dormant (profile `edith`)

### Frontend
- [ ] `base: '/'` in vite.config.ts (SPA deep routing)
- [ ] API URL: `VITE_API_URL` or `/api` fallback in production
- [ ] All dashboard pages lazy-loaded
- [ ] 401 response → clear token → redirect to /login

---

## 13. Branches Pending Merge

| Branch | Location | Status |
|--------|----------|--------|
| `development-roadmap` | local + remote | Unmerged |
| `fix/portfolio-chat-info-leak` | local + remote | Unmerged |
| `claude/ai-os-api-integration-yFb9T` | remote only | Unmerged |
| `claude/docker-edith-ollama-setup-Yt3Z1` | remote only | Unmerged |
| `update/2026-02-15-three-agent-architecture` | remote only | Unmerged |

**User's goal**: Merge two feature branches into main. Need to identify which two and assess their diff against this baseline.

---

*End of Current State Report.*
