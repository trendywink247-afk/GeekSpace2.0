# GeekSpace 2.0 — Backend Configuration Guide

> Complete reference for backend setup, service dependencies, database,
> API structure, scaling, monitoring, and security.

---

## Server Architecture

- **Runtime:** Node.js 22 (Alpine in Docker)
- **Framework:** Express 4.21
- **Language:** TypeScript 5.9, ES modules (`.js` imports required)
- **Database:** SQLite via better-sqlite3 (synchronous)
- **Process Manager:** PM2 6.0 (production)
- **Job Queue:** Redis + BullMQ (via ioredis)

Entry points:
- `server/src/index.ts` — Server startup, scheduler initialization, graceful shutdown
- `server/src/app.ts` — Express app composition, middleware, module mounting
- `server/src/config.ts` — Environment variable validation and defaults
- `server/src/db/index.ts` — SQLite schema (centralized)

---

## Module Architecture

### AppModule Interface

Every module implements the `AppModule` interface (`server/src/shared/module.ts`):

```typescript
interface AppModule {
  name: string;
  registerRoutes(app: Express): void;
  initialize?(): Promise<void>;   // Run at startup
  shutdown?(): Promise<void>;     // Run at graceful shutdown
}
```

### Module Mounting Order

Modules are registered in `server/src/app.ts` in this specific order:

1. auth → 2. health → 3. portfolio → 4. reminders → 5. media →
6. billing → 7. integrations → 8. content → 9. memory → 10. agent →
11. users → 12. admin → 13. automation → 14. dashboard → 15. focus →
16. comms → 17. geekos → 18. office

Plus standalone routers: directory, webhooks, pico, artifacts preview.

### API Route Prefixes

All routes mount under `/api/`. Each module registers at:

| Module | Prefix | Auth Required |
|--------|--------|--------------|
| auth | `/api/auth/*` | Mixed (login/signup public) |
| health | `/api/health/*` | Public (detailed = admin) |
| portfolio | `/api/portfolio/*` | Mixed (public view, auth for edit) |
| reminders | `/api/reminders/*` | Yes |
| media | `/api/media/*` | Yes |
| billing | `/api/billing/*` | Mixed (plans public) |
| integrations | `/api/integrations/*` | Yes |
| content | `/api/content/*` | Yes |
| memory | `/api/memory/*` | Yes |
| agent | `/api/agent/*` | Yes |
| users | `/api/users/*` | Yes |
| admin | `/api/admin/*` | Admin token |
| automation | `/api/automations/*` | Yes |
| dashboard | `/api/dashboard/*` | Yes |
| focus | `/api/focus/*` | Yes |
| comms | `/api/comms/*` | Yes |
| geekos | `/api/geekos/*` | Mixed |
| office | `/api/office/*` | Yes |

---

## Database

### Setup

```
DB_PATH=./data/geekspace.db   (default)
```

SQLite via better-sqlite3 — **synchronous** (no async/await for DB calls).
Schema is centralized in `server/src/db/index.ts` with `CREATE TABLE IF NOT EXISTS` statements.
Tables are created at startup automatically.

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Accounts | email, username, password_hash, plan, credits |
| `agent_configs` | Agent personality | user_id, voice, system_prompt, model, creativity |
| `subscriptions` | Billing state | plan, credits, cycle_start, stripe_id, razorpay_id |
| `reminders` | Scheduled tasks | text, datetime, channel, recurrence_pattern |
| `automations` | Automation rules | trigger_type, trigger_config, action_type, action_config |
| `integrations` | OAuth connections | type, access_token, refresh_token, config |
| `portfolios` | Public profiles | username, about, projects, social_links, layout |
| `activity_log` | Audit trail | user_id, action, details, timestamp |
| `usage_events` | LLM usage tracking | tokens, cost, provider, model, channel |
| `api_keys` | Encrypted API keys | provider, key_encrypted, masked_key |
| `features` | Feature flags | user_id, feature_name, enabled |
| `free_models` | LLM model registry | display_name, provider, status |

### Dynamic Tables (created by services)

| Table | Created By | Purpose |
|-------|-----------|---------|
| `goals`, `goal_steps`, `goal_events` | Goal service | Goal system |
| `workspace_artifacts`, `delegation_log` | Goal service | Workspace & delegation |
| `pico_agents`, `pico_tasks`, `pico_fleet_state` | Pico fleet | Agent orchestration |
| `conversation_log`, `memory_entries` | Memory service | Conversation & memory |
| `entities`, `relations` | Memory service | Knowledge graph |

---

## Environment Variables

### Required in Production

| Variable | Description | Validation |
|----------|-------------|------------|
| `JWT_SECRET` | JWT signing key | Hard exit if missing |
| `ENCRYPTION_KEY` | API key encryption | Must be 64 hex chars |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | HTTP port |
| `DB_PATH` | `./data/geekspace.db` | SQLite file path |
| `PUBLIC_URL` | `http://localhost:5173` | Frontend URL |
| `API_URL` | `http://localhost:3001` | Backend URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Comma-separated origins |
| `LOG_LEVEL` | `debug` (dev), `info` (prod) | Pino log level |
| `MAX_REQUEST_BODY_BYTES` | `1048576` (1MB) | Request body limit |
| `SESSION_IDLE_TIMEOUT_MS` | `1800000` (30min) | Session idle timeout |

### Auth & Security

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRES_IN` | `15m` | Token expiry |
| `ADMIN_TOKEN` | — | Admin API token |
| `ADMIN_DASHBOARD_PASSWORD` | — | Admin dashboard password |
| `GATE_PASSWORD_HASH` | — | Frontend access gate |
| `GATE_COOKIE_VALUE` | `dev-gate-cookie` | Gate cookie value |
| `INVITE_REQUIRED` | `false` | Invite-gated registration |
| `SEED_DEMO_DATA` | `true` (dev only) | Seed demo data on startup |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15min) | Rate limit window |
| `RATE_LIMIT_MAX` | `500` | Max requests per window |
| `RATE_LIMIT_AUTH_MAX` | `10` | Auth endpoint limit |

### Billing

| Variable | Default | Description |
|----------|---------|-------------|
| `PREMIUM_MONTHLY_CREDITS` | `50000` | Credits per premium month |
| `TRIAL_DAYS` | `3` | Trial period length |
| `TRIAL_PREMIUM_CREDITS` | `10000` | Credits during trial |

> For all LLM provider, payment, integration, and media service variables,
> see [INTEGRATIONS.md](./INTEGRATIONS.md).

---

## Service Dependencies

### Required for Core Functionality

| Service | Purpose | Variable | Default |
|---------|---------|----------|---------|
| **Redis** | Job queue, caching | `REDIS_URL` | `redis://localhost:6379` |

### Required for Full Features

| Service | Purpose | Variable | Fallback |
|---------|---------|----------|----------|
| **Qdrant** | Semantic memory | `QDRANT_URL` | Graceful degradation |
| **Meilisearch** | Full-text search | `MEILISEARCH_URL` | Graceful degradation |
| **Ollama** | Local LLM | `OLLAMA_BASE_URL` | Cloud LLM fallback |

### Optional Sidecars

| Service | Purpose | Port | Enable |
|---------|---------|------|--------|
| Kokoro TTS | Text-to-speech | 5101 | `KOKORO_TTS_ENABLED` |
| Piper TTS | Fallback TTS | 5100 | `PIPER_TTS_ENABLED` |
| Whisper STT | Speech-to-text | 5102 | `WHISPER_LOCAL_ENABLED` |
| PicoClaw | Triage engine | 8080 | `PICOCLAW_ENABLED` |
| Browser | Web automation | 3010 | Always available |
| SearXNG | Meta-search | 8888 | Always available |
| n8n | Workflow automation | 5678 | Optional Docker profile |

---

## Docker Configuration

### Memory Limits

| Service | Memory | CPU |
|---------|--------|-----|
| geekspace (main) | 1G | — |
| browser | 1.5G | — |
| redis | 256M | — |
| searxng | 256M | — |
| qdrant | 256M | — |
| meilisearch | 128M | — |
| uptime-kuma | 128M | — |
| picoclaw | 64M | — |

### Networks

- `geekspace-net` — Internal network for all services
- `geekspace-shared` — External network for Ollama/Moonshot access

### Ports

| Port | Service | Exposed |
|------|---------|---------|
| 3001 | Main API (production) | Yes |
| 3002 | Staging API | Yes |
| 3010 | Browser sidecar | Internal |
| 5678 | n8n | Yes (optional) |
| 6333 | Qdrant | Internal |
| 6379 | Redis | Internal |
| 7700 | Meilisearch | Internal |
| 8080 | PicoClaw | Internal |
| 8888 | SearXNG | Internal |

---

## Scaling Considerations

### SQLite

- Single-writer model — only one write transaction at a time
- WAL mode recommended for concurrent reads during writes
- Suitable for single-server deployment up to ~100 concurrent users
- For higher scale, consider migrating to PostgreSQL

### Redis

- Single instance handles job queue + caching
- Connection pooling via ioredis defaults
- Memory limited to 256M in Docker — monitor with `redis-cli info memory`

### Job Queue

- BullMQ for async jobs (email delivery, scheduled tasks, proactive goals)
- Workers run in-process (not separate containers)
- Proactive goal engine runs 30-minute cycles

### LLM Routing

- 7-tier fallback ensures availability even when providers go down
- Together AI has a daily budget cap (`TOGETHER_DAILY_BUDGET_CENTS`) to prevent overspend
- Ollama runs locally for zero-cost inference when available
- Groq provides free tier (14,400 req/day) as reliable middle fallback

---

## Health Monitoring

### Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | Public | Basic health check (returns `{ status: 'ok' }`) |
| `GET /api/health/detailed` | Admin token | Comprehensive service status |
| `GET /api/health/stream` | Admin | SSE stream of health updates |

### External Monitoring

- **Uptime Kuma** at port 3003 — HTTP polling for uptime tracking
- **Loki + Promtail** (`infra/` directory) — Log aggregation
- **Docker logging** — JSON-file driver, 50M per file, 5 file rotation

### Health Check Script

```bash
./scripts/health-check.sh          # Quick check
./scripts/smoke-test.sh             # Full endpoint validation
```

---

## Security Configuration

### Middleware Stack (applied in app.ts)

1. **Helmet** — Security headers (CSP disabled, handled by Caddy)
2. **Permissions-Policy** — Restricts camera, microphone, geolocation, payment
3. **HSTS** — Strict Transport Security in production
4. **CORS** — Credentials enabled, origins from `CORS_ORIGINS`
5. **Rate limiting** — Express-rate-limit per scope
6. **Body parsing** — JSON limited to `MAX_REQUEST_BODY_BYTES`

### Authentication

- JWT tokens via `middleware/auth.ts`
- Three middleware functions:
  - `requireAuth` — Rejects unauthenticated requests (sets `req.userId`)
  - `optionalAuth` — Sets `req.userId` if token present, continues otherwise
  - `requireAdminToken` — Validates `ADMIN_TOKEN` header
- **Important:** Access user ID as `req.userId!`, NOT `req.user.id`

### Encryption

- API keys encrypted with `ENCRYPTION_KEY` (AES-256)
- Must be 64 hex characters in production
- Dev fallback: `dev-encryption-key-32-chars-long!`

### Access Gate

- Optional frontend password gate via `GATE_PASSWORD_HASH`
- Cookie-based verification via `GATE_COOKIE_VALUE`
- Caddy handles the gate check at the reverse proxy level

---

## Logging

### Pino Logger

- JSON structured logging
- Level controlled by `LOG_LEVEL` env var
- Default: `debug` in development, `info` in production

### Docker Log Configuration

```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"
```

### Log Aggregation

Loki + Promtail configured in `infra/` for centralized log collection.
Promtail scrapes Docker container logs and ships to Loki.
