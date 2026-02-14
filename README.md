# GeekSpace 2.0 — Personal AI Operating System

A self-hosted AI-OS platform where every user gets a personal AI agent (codename **OpenClaw / EDITH**), a customizable dashboard, terminal CLI, portfolio, and automation engine.

Built with React 19 + TypeScript frontend, Express + SQLite backend, and a **Tri-Brain LLM router** that intelligently routes queries across local (Ollama), cloud (OpenRouter), and gateway (EDITH/OpenClaw) providers.

## Architecture Overview

```
                   +-----------+
                   |  Nginx    |  :80 / :443
                   |  Reverse  |
                   |  Proxy    |
                   +-----+-----+
                         |
              +----------+----------+
              |                     |
        /api/*                  /*  (SPA)
              |                     |
     +--------v--------+   +-------v-------+
     |  Express API     |   |  React 19     |
     |  :3001           |   |  Vite 7       |
     |  JWT + SQLite    |   |  Tailwind     |
     +--------+---------+   +---------------+
              |
    +---------+---------+---------+
    |         |         |         |
  Ollama   OpenRouter  EDITH    Redis
  (local)  (cloud)   (OpenClaw) (queue)
  Brain 1  Brain 2    Brain 3
```

### Tri-Brain LLM Router

The chat endpoint (`POST /api/agent/chat`) classifies user intent and routes to the best provider:

| Brain | Provider | Use Case | Cost |
|-------|----------|----------|------|
| Brain 1 | **Ollama** (local) | Simple queries, quick tasks | Free |
| Brain 2 | **OpenRouter** (cloud) | Mid-tier fallback when Ollama is down | Credits |
| Brain 3 | **EDITH / OpenClaw** (gateway) | Complex reasoning, coding, planning, architecture | Free (self-hosted) |

**Routing logic:**
- `/edith <message>` — Force route to EDITH/OpenClaw
- `/local <message>` — Force route to Ollama
- No prefix — Auto-classify intent via keyword heuristic + word count, then route accordingly
- If EDITH fails, silently falls back to tri-brain (Ollama -> OpenRouter -> builtin)

### Response Contract

```json
{
  "text": "The AI response",
  "route": "edith | local",
  "latencyMs": 342,
  "provider": "edith | ollama | openrouter | builtin",
  "debug": { "intent": "coding", "forceRoute": null }
}
```

The `debug` field is only included when `LOG_LEVEL=debug`.

## Tech Stack

### Frontend
- **React 19** + TypeScript 5.9
- **Vite 7** build tool
- **Tailwind CSS 3** + shadcn/ui + Radix UI
- **Recharts** for dashboard charts
- **Lucide React** icons

### Backend
- **Express** + TypeScript
- **SQLite** via better-sqlite3 (WAL mode)
- **JWT** authentication (jsonwebtoken)
- **Zod** request validation
- **Pino** structured logging
- **Helmet** security headers
- **Rate limiting** (express-rate-limit)

### Infrastructure
- **Docker** multi-stage build (Node 20 Alpine)
- **Nginx** reverse proxy with gzip, security headers, WebSocket support
- **Redis** for job queue + cache
- **Ollama** for local LLM inference
- **OpenClaw** (EDITH gateway) for premium AI reasoning

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### Development

```bash
# Clone
git clone <repo-url>
cd GeekSpace2.0

# Install dependencies (frontend + server)
npm install
cd server && npm install && cd ..

# Copy env and configure
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and ENCRYPTION_KEY

# Start dev servers
npm run dev          # Frontend on :5173
cd server && npm run dev  # API on :3001
```

### Production (Docker)

```bash
cp .env.example .env
# Fill in production values (JWT_SECRET, ENCRYPTION_KEY, CORS_ORIGINS, etc.)

docker compose up -d --build
# App available at http://localhost (nginx :80)
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full VPS deployment guide.

## Project Structure

```
GeekSpace2.0/
├── src/                          # React frontend
│   ├── App.tsx                   # Root with routing
│   ├── main.tsx                  # Entry point
│   ├── components/ui/            # shadcn/ui components
│   ├── dashboard/pages/          # Dashboard views
│   │   ├── OverviewPage.tsx      # Charts, stats, activity
│   │   ├── RemindersPage.tsx     # Calendar + list view
│   │   ├── ConnectionsPage.tsx   # Integration health
│   │   ├── AgentSettingsPage.tsx  # AI personality config
│   │   ├── AutomationsPage.tsx   # Trigger -> action workflows
│   │   ├── SettingsPage.tsx      # Profile, security, billing
│   │   └── TerminalPage.tsx      # CLI interface
│   ├── landing/                  # Public landing page
│   ├── portfolio/                # Public portfolio view
│   ├── services/                 # API client layer
│   ├── stores/                   # State management
│   └── hooks/                    # Custom React hooks
│
├── server/                       # Express API
│   └── src/
│       ├── index.ts              # Server entry, health check, route mounting
│       ├── config.ts             # Validated env config
│       ├── db/index.ts           # SQLite schema + seed data
│       ├── middleware/
│       │   ├── auth.ts           # JWT verify + sign
│       │   ├── validate.ts       # Zod request validation
│       │   └── errors.ts         # Global error handler
│       ├── routes/
│       │   ├── agent.ts          # /api/agent — chat, commands, config
│       │   ├── auth.ts           # /api/auth — login, signup
│       │   ├── reminders.ts      # /api/reminders — CRUD
│       │   ├── automations.ts    # /api/automations — CRUD
│       │   ├── integrations.ts   # /api/integrations — manage
│       │   ├── portfolio.ts      # /api/portfolio — public profile
│       │   ├── users.ts          # /api/users — profile
│       │   ├── usage.ts          # /api/usage — token/cost tracking
│       │   ├── dashboard.ts      # /api/dashboard — stats
│       │   ├── apiKeys.ts        # /api/api-keys — encrypted storage
│       │   ├── directory.ts      # /api/directory — user discovery
│       │   └── features.ts       # /api/features — feature flags
│       ├── services/
│       │   ├── llm.ts            # Tri-Brain router (Ollama/OpenRouter/EDITH)
│       │   └── edith.ts          # Dedicated EDITH/OpenClaw service
│       └── prompts/
│           └── openclaw-system.ts # OpenClaw master system prompt
│
├── docker-compose.yml            # GeekSpace + Redis + Nginx
├── Dockerfile                    # Multi-stage production build
├── nginx/default.conf            # Reverse proxy config
├── .env.example                  # Environment template
└── docs/
    ├── ARCHITECTURE.md           # Deep-dive system architecture
    ├── API.md                    # Full API reference
    └── DEPLOYMENT.md             # Docker + VPS deployment guide
```

## EDITH / OpenClaw Integration

OpenClaw (codename EDITH) is Brain 3 of the Tri-Brain router — the premium reasoning engine for complex tasks.

### How It Works

1. **Dedicated service** (`server/src/services/edith.ts`):
   - Tries three endpoint paths in order: `/v1/chat/completions`, `/api/v1/chat/completions`, `/api/chat`
   - 10-second timeout per attempt
   - 1 retry on the primary endpoint for transient failures
   - Detects HTML responses (UI pages) and skips to next endpoint
   - Supports both OpenAI-format and flat-response gateways

2. **Routing** (`server/src/routes/agent.ts`):
   - `/edith <msg>` prefix forces EDITH
   - Auto-routes to EDITH when intent is `complex`, `coding`, or `planning`
   - Keyword heuristic: `code`, `debug`, `analyze`, `architecture`, `refactor`, `algorithm`, etc.
   - Falls back to tri-brain on EDITH failure

3. **Health probing** (`GET /api/health`):
   - Live-probes EDITH gateway (3s timeout)
   - Returns `"edith": true/false` in health response

### Docker Networking

GeekSpace reaches OpenClaw via two paths:
- **`host.docker.internal:59259`** — through host port mapping (default)
- **`openclaw-gtzk_default` network** — direct container DNS resolution (joined in docker-compose)

### Environment Variables

```env
EDITH_GATEWAY_URL=http://host.docker.internal:59259
EDITH_TOKEN=                    # Optional bearer token
```

### System Prompt

The OpenClaw identity prompt lives in `server/src/prompts/openclaw-system.ts`. It defines:
- Personality: competent, loyal, direct, adaptive to voice config
- Role: Brain 3 of the Tri-Brain (premium reasoning)
- Capabilities: coding, planning, debugging, analysis, content drafting
- Agent modes: minimal, builder, operator
- Terminal command awareness (`gs` command system)

Per-user context (name, mode, voice, reminders, integrations) is appended dynamically by `buildSystemPrompt()`.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check with live Ollama + EDITH probing |
| POST | `/api/auth/signup` | No | Create account |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/agent/config` | JWT | Get agent personality config |
| PATCH | `/api/agent/config` | JWT | Update agent personality |
| POST | `/api/agent/chat` | JWT | AI chat (tri-brain routed) |
| POST | `/api/agent/command` | JWT | Terminal command execution |
| POST | `/api/agent/chat/public/:username` | No | Public portfolio chat |
| GET/POST/PATCH/DELETE | `/api/reminders` | JWT | Reminder CRUD |
| GET/POST/PATCH/DELETE | `/api/automations` | JWT | Automation CRUD |
| GET/PATCH | `/api/integrations` | JWT | Integration management |
| GET/PATCH | `/api/portfolio` | JWT | Portfolio management |
| GET | `/api/usage` | JWT | Usage statistics |
| GET | `/api/dashboard` | JWT | Dashboard stats |
| GET/POST/DELETE | `/api/api-keys` | JWT | Encrypted API key storage |
| GET | `/api/directory` | JWT | User discovery |
| GET/PATCH | `/api/features` | JWT | Feature flags |

See [docs/API.md](docs/API.md) for full request/response schemas.

## Terminal Commands

The built-in CLI (`gs` command system) available in the Terminal page and via `POST /api/agent/command`:

```
gs me                       Show your profile
gs reminders list           List reminders
gs reminders add "text"     Create a reminder
gs credits                  Check credit balance
gs usage today|month        Usage reports
gs integrations             List integrations
gs connect <service>        Connect integration
gs disconnect <service>     Disconnect integration
gs automations              List automations
gs status                   Agent status
gs portfolio                Portfolio URL
gs deploy                   Deploy portfolio (make public)
gs profile set <field> <v>  Update profile field
gs export                   Export all data as JSON
ai "prompt"                 Ask your AI agent (real LLM)
clear                       Clear terminal
help                        Show help
```

## Database Schema

SQLite with WAL mode. Tables:

| Table | Purpose |
|-------|---------|
| `users` | Accounts, profile, plan, credits, preferences |
| `agent_configs` | Per-user AI personality (name, voice, mode, model, colors) |
| `reminders` | Tasks with datetime, category, recurring, channel |
| `integrations` | Service connections (Telegram, GitHub, Calendar, etc.) |
| `portfolios` | Public profiles with skills, projects, milestones |
| `automations` | Trigger -> action workflows |
| `usage_events` | Token/cost tracking per provider per channel |
| `api_keys` | Encrypted API key storage |
| `features` | Per-user feature flags |
| `contact_submissions` | Landing page contact form |
| `activity_log` | User activity tracking |

## Environment Variables

See [`.env.example`](.env.example) for the complete list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Prod | JWT signing secret |
| `ENCRYPTION_KEY` | Prod | AES key for API key encryption |
| `OLLAMA_BASE_URL` | No | Ollama endpoint (default: `localhost:11434`) |
| `OLLAMA_MODEL` | No | Model name (default: `qwen2.5:1.5b`) |
| `OPENROUTER_API_KEY` | No | OpenRouter API key for cloud fallback |
| `EDITH_GATEWAY_URL` | No | OpenClaw gateway URL |
| `EDITH_TOKEN` | No | OpenClaw bearer token |
| `REDIS_URL` | No | Redis connection string |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot integration |
| `CORS_ORIGINS` | No | Allowed origins (comma-separated) |

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#7B61FF` | Purple accent |
| Background | `#05050A` | Dark base |
| Surface | `#0B0B10` | Card backgrounds |
| Success | `#61FF7B` | Green indicators |
| Warning | `#FFD761` | Yellow alerts |
| Error | `#FF6161` | Red errors |
| Heading font | Space Grotesk | |
| Body font | Inter | |
| Mono font | IBM Plex Mono | |

## License

MIT
