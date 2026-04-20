# Architecture: GeekSpace2.0 Repository

> Sub-document of [AGE-64](/AGE/issues/AGE-64) (architecture audit). See also `ARCHITECTURE.md` (umbrella, authored by CTO in [AGE-68](/AGE/issues/AGE-68)) and `CLAUDE.md` (module map, conventions, quick-reference).
>
> <!-- snapshot: 2026-04-20T00:30:00Z -->

---

## 1. Monorepo Layout

Tree to depth 2. Each entry notes its running artifact or build output.

```text
GeekSpace2.0/
├── admin-dashboard/       # Mission Control: single static HTML served at /admin
├── browser-agent/         # Browser automation sidecar (Playwright-based, port 3010)
├── caddy/                 # Caddy reverse-proxy config (Caddyfile, TLS termination)
├── docs/                  # Developer + architecture reference markdown
├── e2e/                   # Playwright end-to-end test specs
├── geekos/                # GeekOS container data (character configs, plugin registry)
├── infra/                 # Loki + Promtail + Alertmanager log/alert configs
├── kokoro-tts/            # Kokoro TTS sidecar (Python, port 5101)
├── openapi/               # OpenAPI 3.1 spec — openapi.yaml (source of truth for /api/docs)
├── ops/                   # Cronicle job configs, ops reports, launch checklists
├── picoclaw/              # PicoClaw triage engine (Node.js sidecar, port 8080)
├── piper-tts/             # Piper TTS fallback sidecar (Python, port 5100)
├── public/                # Static frontend assets (favicon, robots.txt)
├── scripts/               # Dev/ops shell scripts (see §5 in arch-ci.md)
├── searxng/               # SearxNG metasearch config (port 8888)
├── server/                # Express 4 backend (TypeScript, ES modules, Node 22)
│   ├── dist/              # Compiled JS output (tsc → server/dist/)
│   ├── ecosystem.config.cjs  # PM2 config (2 cluster workers in production)
│   ├── package.json
│   └── src/
│       ├── app.ts         # Composition root — wires all 18 modules + middleware
│       ├── config.ts      # All env-var configuration (single source of truth)
│       ├── db/            # SQLite schema declaration + migration runner
│       ├── errors/        # Domain error classes
│       ├── logger.ts      # Pino structured logger
│       ├── middleware/    # Auth, errors, metrics, rate-limit helpers
│       ├── modules/       # 18 domain modules (see §2)
│       ├── repositories/  # Cross-module DB query helpers
│       ├── routes/        # Non-module routes (test helpers only)
│       ├── services/      # Cross-module services (output-generator, chat-to-project)
│       ├── shared/        # AppModule base class, Swagger wiring
│       └── tracing.ts     # OpenTelemetry trace init
├── src/                   # React 19 frontend (TypeScript, Vite 7)
│   ├── App.tsx            # Root component → DashboardRouter (41 lazy pages)
│   ├── components/        # Radix UI + shadcn/ui primitives
│   ├── dashboard/         # Dashboard pages and sub-components
│   ├── explore/           # Explore / discovery feature
│   ├── hooks/             # Custom React hooks
│   ├── image-tools/       # Image-generation UI feature
│   ├── landing/           # Marketing landing pages
│   ├── logo-studio/       # Logo-AI UI feature
│   ├── onboarding/        # User onboarding flow
│   ├── pages/             # React Router 7 route pages
│   ├── portfolio/         # Portfolio builder UI
│   ├── services/          # Axios API client services
│   ├── stores/            # Zustand state slices
│   ├── styles/            # Tailwind + agentin-tokens.css design tokens
│   └── types/             # TypeScript interfaces
├── tests/                 # Frontend Vitest unit tests
├── whisper-stt/           # Whisper.cpp STT sidecar (Python, port 5102)
├── Dockerfile             # Multi-stage production build (see §3)
├── docker-compose.yml     # Stack: prod + staging + Redis × 2 + sidecars
├── docker-compose.staging.yml  # Legacy isolated staging compose (rarely used)
├── docker-compose.logging.yml  # Logging stack overlay (Loki + Promtail)
├── package.json           # Frontend build scripts + root dev scripts
├── turbo.json             # Turborepo pipeline graph (optional mono-repo caching)
├── vite.config.ts         # Vite 7 bundler config
└── vitest.config.ts       # Frontend test config (Vitest)
```

---

## 2. 18 Domain Modules

Modules live under `server/src/modules/`. Each follows the standard layout: `index.ts` (barrel + `AppModule`), `types.ts`, `swagger.ts`, `routes.ts` or `routes/`, `services.ts` or `services/`. The table in `CLAUDE.md §Module Map` gives a one-line summary; paragraphs below add operational and data-flow context.

### admin
Groups operations-facing tooling: the Mission Control admin dashboard (a single static HTML file served at `/admin` via `serveAdminDashboard`), a dev-bridge endpoint for agent introspection and command dispatch, a routing-debugger that returns the full live Express route list, a routes-reference UI, and a model-discovery service that polls Ollama and OpenRouter to enumerate available LLMs. All `/api/admin` and `/api/dev` routes are gated behind `requireAdminToken` (header or query-string). `/api/models` is read-only and also admin-only.

### agent
The AI core — the largest module (~42 files). Handles chat ingestion, intent-based LLM routing (Groq → Ollama → OpenRouter, see `services/llm.ts`), the standard 5-iteration ReAct loop (`react-loop.ts`), a 10-iteration deep-reasoning variant with mid-loop delegation detection (`deep-reasoning.ts`), human-in-the-loop tool confirmations (`confirm-action.ts`), conversation threading (`conversation-threads.ts`), file uploads and processing, the goal system (CRUD + AI planning + autonomous step execution), inter-agent delegation pipeline, the proactive-goals background scheduler (30-min cycles), an MCP server with 10 tools, SSE-based agent-state streaming, and Telegram/in-app notifications. Routes are split across `routes/chat.ts`, `routes/agent-state.ts`, `routes/agent-tasks.ts`, and `routes/agent-comms.ts`.

### auth
JWT issuance and verification, Google and GitHub OAuth via Passport.js strategies, session management, password reset with time-limited HMAC tokens, brute-force protection on the login endpoint, and a token-refresh endpoint. The middleware exported here (`requireAuth`, `optionalAuth`, `requireAdminToken`) is used by every other module. Routes split across `routes/auth.ts` and `routes/oauth.ts`.

### automation
CRUD for user-defined automation rules (each rule is a trigger + action pair), a workflow execution engine that chains actions, an async job queue (Bull/BullMQ backed by Redis) with dead-letter tracking for failed jobs, a planner API that drafts multi-step plans via LLM, and a proactive outbound endpoint. Automations can be triggered by time schedules, inbound webhooks, or other automation outputs. Route prefixes: `/api/automations`, `/api/workflows`, `/api/planner`, `/api/jobs`, `/api/proactive`.

### billing
Stripe checkout session creation and webhook processing, Razorpay order creation and payment verification, credit balance management, subscription lifecycle (plan upgrades, renewals, credit top-ups), and one-time day-pass purchases. Webhooks from both providers are received raw (no JSON body parsing applied before signature verification) and update the `subscriptions` table and user credit balance. Plan limits are defined here and consulted by the agent module's usage gates. Route prefix: `/api/billing`.

### comms
Personalized AI-generated daily briefings (sent each morning, stored in `briefings` table), an AI-powered suggestion engine with semantic clustering (groups related nudges to avoid notification fatigue), and a recipe system where users can browse, install, and invoke reusable prompt workflows. All three systems are user-scoped. Route prefixes: `/api/briefings`, `/api/suggestions`, `/api/recipes`.

### content
Artifact lifecycle management: the app generates code snippets, HTML pages, and full deployable websites, storing them in `generated_artifacts` with a configurable TTL. Artifacts are previewed via the `/preview/:userId/:artifactId` route (served by Caddy under custom subdomains when `artifact_domains` is populated) and can be deployed to Netlify or Vercel via deployment service helpers. Template CRUD is also housed here. Route prefixes: `/api/artifacts`, `/api/templates`, `/preview` (public).

### dashboard
Aggregated UI data feeds for the main React dashboard: a KPI overview endpoint, the activity stream (SSE), per-dimension analytics breakdowns, report generation (PDF/markdown output), a cross-channel inbox aggregator, and an AI-recommendations feed. These are read-heavy endpoints backed by DB queries and cached where appropriate. Route prefixes: `/api/dashboard`, `/api/activity`, `/api/analytics`, `/api/report`, `/api/inbox`, `/api/recommendations`.

### focus
Focus session lifecycle (start, pause, complete, abandon) with Telegram/push notifications at session boundaries, habit tracking with streak calculation and weekly summaries, and deferred message handling (hold a message in a queue until the current focus session ends). The module adds `/api/focus` and `/api/habits`.

### geekos
The character/agent bridge layer: CRUD for Pico agents (personality-driven AI personas with per-agent memory and plugin sets), room management (shared conversation spaces), plugin installation and lifecycle, and an internal LLM proxy that routes to Ollama with GeekOS-aware system prompts. The public Gate API (`/api/gate/v1`) allows external clients to interact with GeekOS agents without user-level authentication for whitelisted endpoints, using a separate key scheme. Route prefixes: `/api/geekos`, `/api/geekos-llm`, `/api/gate/v1`.

### health
Liveness and readiness probes beyond the inline `/api/health` in `app.ts`: component-status polling (checks Redis, Meilisearch, Qdrant, Ollama, PicoClaw reachability), cached aggregate health state for the admin dashboard, and an SSE endpoint (`/api/health/stream`) that pushes component status changes in real time. The module also reports uptime percentages used by the landing page.

### integrations
OAuth token storage and refresh for Telegram bots (personal bot + custom bot registration), Gmail read/compose via Google OAuth, Google Calendar read/write, social-media connectors (LinkedIn, Twitter — stubbed), and the inbound webhooks router (receives and dispatches custom webhook payloads to automation triggers). All OAuth tokens are stored in the `integrations` table and synced/revoked by the sync service. Route prefixes: `/api/integrations`, `/api/integrations/telegram/custom`, `/api/gmail`, `/api/calendar`, `/api/social-media`, `/api/webhooks`.

### media
Image generation (FLUX model via OpenRouter) with an async job queue and status polling, video generation (Seedance), and the voice stack: TTS via Kokoro (primary, port 5101) or Piper (fallback, port 5100) sidecars with streaming audio output; STT via Whisper.cpp sidecar (port 5102) with file-upload endpoint. Generated images are cached at `/app/data/img-cache` and served as static files under `/api/images/cache`. Route prefixes: `/api/images`, `/api/image` (async), `/api/videos`, `/api/voice`.

### memory
Semantic search over user conversations using Qdrant vector DB (embeddings generated by `nomic-embed-text` via Ollama), full-text search via Meilisearch, graph memory (entity + relation extraction from conversations stored as `entities`/`relations` tables), conversation log CRUD and pagination, automatic conversation summarization, and the cognitive-memory layer that distills high-salience events into persistent user facts (`memory_entries`). Route prefixes: `/api/memory`, `/api/search`.

### office
Productivity suite: rich-text document CRUD stored as BlockNote JSON (route `/api/docs`), file upload/download with per-user storage quotas (`/api/files`), a sandboxed code-execution environment that runs snippets in a subprocess (`/api/sandbox`), user-defined skill-card management (`/api/skills`), Logo AI (FLUX-powered logo generation at `/api/logo`), and an office-state SSE endpoint (`/api/office/state`) that the frontend polls every 3 seconds for unified dashboard state.

### portfolio
Public profile pages at `/u/:username` with bio, project cards, social links, and a user-controlled layout config stored in the `portfolios` table. A per-profile analytics collector records page views. An AI suggestion service generates copy improvement recommendations. A portfolio chat endpoint lets anonymous visitors send messages to the profile owner. The public directory lists all opted-in profiles. Route prefixes: `/api/portfolio`, `/api/directory` (public).

### reminders
Full reminder CRUD with natural-language datetime parsing, recurrence patterns (daily/weekly/monthly/custom RRULE), and multi-channel delivery: Telegram, email (SMTP), SMS (Twilio), and web push. The scheduler runs inside the server process using `node-cron` and fires reminders within ±1 minute of their target time. Route prefix: `/api/reminders`.

### users
User profile CRUD (`/api/users/me`), password change, usage-event recording (LLM token consumption logged per request into `usage_events`), API key management (keys stored AES-256 encrypted in `api_keys`, exposed only as masked previews), and feature-flag reads/writes per user. Authentication itself lives in **auth**; this module handles the user data plane. Route prefixes: `/api/users`, `/api/usage`, `/api/api-keys`, `/api/features`.

---

## 3. Build Pipeline

### Frontend (`npm run build` from repo root)

```text
tsc -b          # TypeScript compile (strict, noEmit=false, bundler resolution)
  └─ outputs type-checked JS into tsconfig build graph
vite build      # Vite 7 bundles React app → dist/
  └─ entry: src/main.tsx
  └─ output: dist/ (hashed asset filenames, chunks ≤600 KB before warning)
```

The frontend is **not** served from inside the Docker container at runtime. Caddy serves `dist/` directly from the host at `/srv/prod/` (synced via `rsync --delete` during deploy). The container only serves the API.

### Server (`npm run build` from `server/`)

```text
tsc             # TypeScript ES-module compile
  └─ input:  server/src/**/*.ts
  └─ output: server/dist/**/*.js  (ES modules, .js extensions preserved)
```

### Docker (two-stage, see `Dockerfile`)

| Stage | Base image | What it does |
|-------|-----------|--------------|
| **builder** (`AS builder`) | `node:22-alpine` | `npm ci` (root + server) → `npm run build` (frontend → `dist/`) → `cd server && npm run build` (server → `server/dist/`) |
| **production** (`AS production`) | `node:22-slim` | Installs runtime OS packages (ca-certs, curl, git, gpg, python3, ffmpeg, `gh` CLI). Creates Python venv + `edge-tts`. Copies `server/dist/`, `admin-dashboard/`, and `dist/` from builder. Installs server prod deps (`npm ci --omit=dev`). Optionally installs `ruflo` (agent bridge). Runs as `node` (non-root). |

**Key Dockerfile behaviors:**
- `GIT_SHA` build-arg is baked into `ENV GIT_SHA` at production deploy time so `/api/version` reports the live commit.
- PM2 starts two cluster workers (`pm2-runtime server/ecosystem.config.cjs`).
- `HEALTHCHECK`: `curl -f http://localhost:3001/api/health` every 30s, 20s start-period.
- Data directories `/app/data` and `/app/server/data` are created and chowned to `node` inside the image; the actual SQLite file lives in a Docker volume mounted at `/app/data`.

---

## 4. Data Stores

### SQLite (`geekspace.db`)

The primary application database. Location:

| Environment | Path |
|-------------|------|
| Production (container) | `/app/data/geekspace.db` (Docker volume `geekspace-data`) |
| Development | `./data/geekspace.db` (repo-relative, from `DB_PATH` env) |

Schema is declared centrally in `server/src/db/index.ts` — not split per module. Run `cd server && npm run migrate` after schema changes. better-sqlite3 is synchronous (no `async/await` on DB calls).

**Backup cadence (two independent mechanisms):**

| Mechanism | RPO | How |
|-----------|-----|-----|
| **Litestream** (continuous) | ~1 second | Streams WAL changes to Cloudflare R2 (`geekspace-backups/litestream/geekspace/`). Retention: 72h WAL + snapshot every 6h. Runs as `litestream.service` on the VPS host. Config: `ops/litestream/litestream.yml`. See `docs/LITESTREAM.md`. |
| **`scripts/backup-db.sh`** (daily) | 24 hours | SQLite `.backup` command → `/root/backups/geekspace/geekspace-YYYY-MM-DD-HHMMSS.db.gz`. Local retention: 30 daily + 4 weekly. Off-site: `scripts/offsite-backup.sh` (primary rclone remote) + `scripts/secondary-backup.sh` (secondary Backblaze B2). |

Backup verification drills run nightly via Cronicle (`scripts/backup-drill.sh`): restore to temp path + `PRAGMA integrity_check`.

### Redis

Two Redis 7-alpine instances in `docker-compose.yml`:

| Instance | Container | Max memory | Used by |
|----------|-----------|-----------|---------|
| `geekspace-redis` | `geekspace-redis` | 256 MB (`allkeys-lru`) | Prod: automation job queue (BullMQ), rate-limiter counters, session caching |
| `geekspace-staging-redis` | `geekspace-staging-redis` | 64 MB (`allkeys-lru`) | Staging: same purposes |

Both use AOF persistence (`appendonly yes`). Password required (`REDIS_PASSWORD` env var).

### Postgres

This application has **no direct dependency on Postgres**. A `geekspace-postgres` container exists in the stack to back the Paperclip control plane, but the GeekSpace2.0 Express server has no migrations, queries, or schema against it. All application state lives in SQLite.

---

## 5. API Surface

Most API endpoints are mounted under the `/api/` prefix. Notable exceptions:

- `/preview/*` — the `content` module serves raw artifact previews (HTML/CSS/JS) directly.
- `/admin` — single static admin dashboard HTML (see `admin-dashboard/`).

Auth tiers:

- **Public** — no token required
- **`requireAuth`** — valid JWT (`Authorization: Bearer <token>`) required; sets `req.userId`
- **`requireAdminToken`** — admin password header or `ADMIN_TOKEN` env required
- **`optionalAuth`** — JWT parsed if present, request proceeds either way

The full machine-readable route list is available at runtime from `/api/routes` (admin-gated) and in `openapi/openapi.yaml`. Root `CLAUDE.md` is the authoritative architecture reference.

### Route prefix summary

| Prefix | Module / source | Auth tier |
|--------|----------------|-----------|
| `GET /api/health` | `app.ts` (inline) | Public |
| `GET /api/ready` | `app.ts` (inline) | Public |
| `GET /api/version` | `app.ts` (inline) | Public |
| `GET /api/metrics` | `app.ts` (inline) | Public (internal network only) |
| `GET /api/stats/public` | `app.ts` (inline) | Public |
| `POST /api/gate-verify` | `app.ts` (inline) | Public |
| `POST /api/csp-report` | `app.ts` (inline) | Public |
| `GET /api/images/cache/*` | `app.ts` (static) | Public |
| `/preview/*` | `content` module | Public |
| `/api/health/*` | `health` module | Public (probes) / `requireAuth` (component status) |
| `/api/auth/*` | `auth` module | Public (login/signup/OAuth) |
| `/api/oauth/*` | `auth` module | Public (OAuth callbacks) |
| `/api/portfolio/*` | `portfolio` module | `optionalAuth` (public profile reads) / `requireAuth` (writes) |
| `/api/directory` | `portfolio` module | Public |
| `/api/reminders/*` | `reminders` module | `requireAuth` |
| `/api/images/*` | `media` module | `requireAuth` |
| `/api/image/*` | `media` module | `requireAuth` |
| `/api/videos/*` | `media` module | `requireAuth` |
| `/api/voice/*` | `media` module | `requireAuth` |
| `/api/billing/*` | `billing` module | `requireAuth` (user endpoints) / Public (webhooks, raw body) |
| `/api/integrations/*` | `integrations` module | `requireAuth` |
| `/api/gmail/*` | `integrations` module | `requireAuth` |
| `/api/calendar/*` | `integrations` module | `requireAuth` |
| `/api/social-media/*` | `integrations` module | `requireAuth` |
| `/api/webhooks/*` | `integrations` module | Public (inbound webhooks — verified by HMAC signature) |
| `/api/artifacts/*` | `content` module | `requireAuth` (mutations) / Public (public previews) |
| `/api/templates/*` | `content` module | `requireAuth` |
| `/api/memory/*` | `memory` module | `requireAuth` |
| `/api/search/*` | `memory` module | `requireAuth` |
| `/api/agent/*` | `agent` module | `requireAuth` |
| `/api/agent/chat/public` | `agent` module | Public (rate-limited) |
| `/api/agent-state/*` | `agent` module | `requireAuth` |
| `/api/agent-tasks/*` | `agent` module | `requireAuth` |
| `/api/agent-comms/*` | `agent` module | `requireAuth` |
| `/api/pico/*` | `agent` module | `requireAuth` |
| `/api/users/*` | `users` module | `requireAuth` |
| `/api/usage/*` | `users` module | `requireAuth` |
| `/api/api-keys/*` | `users` module | `requireAuth` |
| `/api/features/*` | `users` module | `requireAuth` |
| `/api/admin/*` | `admin` module | `requireAdminToken` |
| `/api/dev/*` | `admin` module | `requireAdminToken` |
| `/api/debug/*` | `admin` module | `requireAdminToken` |
| `/api/routes` | `admin` module | `requireAdminToken` |
| `/api/models/*` | `admin` module | `requireAdminToken` |
| `/admin` | `admin` module | `requireAdminToken` |
| `/api/automations/*` | `automation` module | `requireAuth` |
| `/api/workflows/*` | `automation` module | `requireAuth` |
| `/api/planner/*` | `automation` module | `requireAuth` |
| `/api/jobs/*` | `automation` module | `requireAuth` |
| `/api/proactive/*` | `automation` module | `requireAuth` |
| `/api/dashboard/*` | `dashboard` module | `requireAuth` |
| `/api/activity/*` | `dashboard` module | `requireAuth` |
| `/api/analytics/*` | `dashboard` module | `requireAuth` |
| `/api/report/*` | `dashboard` module | `requireAuth` |
| `/api/inbox/*` | `dashboard` module | `requireAuth` |
| `/api/recommendations/*` | `dashboard` module | `requireAuth` |
| `/api/focus/*` | `focus` module | `requireAuth` |
| `/api/habits/*` | `focus` module | `requireAuth` |
| `/api/briefings/*` | `comms` module | `requireAuth` |
| `/api/suggestions/*` | `comms` module | `requireAuth` |
| `/api/recipes/*` | `comms` module | `requireAuth` |
| `/api/geekos/*` | `geekos` module | `requireAuth` |
| `/api/geekos-llm/*` | `geekos` module | `requireAuth` |
| `/api/gate/v1/*` | `geekos` module | Public (Gate API key scheme) |
| `/api/office/*` | `office` module | `requireAuth` |
| `/api/docs/*` | `office` module | `requireAuth` |
| `/api/files/*` | `office` module | `requireAuth` |
| `/api/sandbox/*` | `office` module | `requireAuth` |
| `/api/skills/*` | `office` module | `requireAuth` |
| `/api/logo/*` | `office` module | `requireAuth` |
| `/api/outputs/*` | `app.ts` (inline) | `requireAuth` |
| `/api/chat/detect-project` | `app.ts` (inline) | `requireAuth` |
| `/api/chat/create-project` | `app.ts` (inline) | `requireAuth` |
| `/api/docs` | Swagger UI | Public |

> **Note on `/api/v1/*`:** The app rewrites `/api/v1/` → `/api/` at the middleware layer (added for forward compatibility). Unversioned `/api/` calls receive `Deprecation: true` + `Sunset: 2027-03-28` response headers.

---

*Cross-links: [AGE-64](/AGE/issues/AGE-64) (parent audit) · `ARCHITECTURE.md` (umbrella, [AGE-68](/AGE/issues/AGE-68)) · `CLAUDE.md` (module map + conventions)*
