<div align="center">

# GeekSpace 2.0

### Your Personal AI Operating System

[![Live](https://img.shields.io/badge/LIVE-ai.geekspace.space-7B61FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0ibTggMTIgMyAzIDUtNSIvPjwvc3ZnPg==)](https://ai.geekspace.space)
[![Stack](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-SQLite-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![AI](https://img.shields.io/badge/Ollama-Moonshot-FF6B35?style=for-the-badge)](https://ollama.com)
[![License](https://img.shields.io/badge/License-MIT-61FF7B?style=for-the-badge)](LICENSE)

**A self-hosted AI-OS where every user gets a personal AI agent, dashboard, terminal, portfolio, and automation engine.**

Built with a **Two-Tier LLM Architecture** — free local inference via Ollama, premium cloud reasoning via Moonshot Kimi — with real credit tracking and intent-based routing.

[Live Demo](https://ai.geekspace.space) | [Architecture](#architecture) | [API Reference](#api-endpoints) | [Deploy](#production-docker--caddy)

</div>

---

## What Is This?

GeekSpace 2.0 is a full-stack AI platform that gives every user:

- **Personal AI Agent** — configurable personality, voice, mode (builder/researcher/creative)
- **Two-Tier Intelligence** — unlimited free local AI + opt-in premium reasoning
- **Dashboard** — real-time stats, usage charts, activity feed, credit tracking
- **Terminal** — built-in CLI (`gs` commands) with AI integration
- **Portfolio** — public developer profile with AI chat assistant
- **Automations** — trigger-action workflows with run tracking
- **Integrations** — connect Telegram, GitHub, Calendar, n8n, and more
- **Credits System** — transparent token-based billing for premium features

---

## Architecture

```
                    +-----------+
                    |   Caddy   |  :443 (auto-HTTPS)
                    |  Reverse  |
                    |   Proxy   |
                    +-----+-----+
                          |
               +----------+----------+
               |                     |
         /api/*                  /*  (SPA)
               |                     |
      +--------v---------+  +-------v-----------+
      |   Express API    |  | /var/www/geekspace |
      |   :3001          |  |  React 19 + Vite   |
      |   JWT + SQLite   |  |  Tailwind + shadcn |
      +--------+---------+  +-------------------+
               |
     +---------+---------+
     |                   |
   Ollama             Moonshot API
   (local)            (cloud / direct HTTP)
   FREE TIER          PREMIUM TIER
   qwen2.5-coder:7b   kimi-k2.5 / kimi-k2-thinking
     |                   |
   Redis 7           Credits System
   (queue/cache)     (per-token billing)
```

### Two-Tier LLM Router

No more broken WebSocket bridges. Direct HTTP to every provider.

| Tier | Provider | Models | Timeout | Cost | Use Case |
|------|----------|--------|---------|------|----------|
| **Free** | Ollama (local) | `qwen2.5-coder:7b` | 60s | 0 credits | All queries by default |
| **Premium** | Moonshot (cloud) | `kimi-k2.5` | 90s | 5 cr/1K tokens | Cloud fallback |
| **Premium+** | Moonshot (cloud) | `kimi-k2-thinking` | 120s | 10 cr/1K tokens | Deep reasoning, `/premium` |

**Routing logic:**

```
/premium <msg>  -->  Credit check --> Moonshot kimi-k2-thinking (8192 max tokens)
/local <msg>    -->  Force Ollama (free, always)
<msg> (default) -->  Ollama first --> if Ollama down + credits > 0 --> cloud fallback
```

- Users start with **15,000 credits** (free tier)
- Minimum **10 credits** per premium call
- Local Ollama is **always free, unlimited**

### Response Contract

```json
{
  "text": "The AI response",
  "tier": "local | premium",
  "route": "local | premium",
  "provider": "ollama | edith | openrouter | builtin",
  "model": "qwen2.5-coder:7b",
  "latencyMs": 342,
  "creditsUsed": 0,
  "creditsRemaining": 15000
}
```

---

## Tech Stack

### Frontend
| Tech | Version | Purpose |
|------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7 | Build tool |
| Tailwind CSS | 3 | Utility-first styling |
| shadcn/ui + Radix | -- | Component library |
| Zustand | -- | State management |
| Recharts | -- | Dashboard charts |
| Lucide React | -- | Icon system |

### Backend
| Tech | Purpose |
|------|---------|
| Express 4 | HTTP framework |
| SQLite (better-sqlite3) | Database (WAL mode) |
| JWT (HS256 pinned) | Authentication |
| Zod | Request validation |
| Pino | Structured JSON logging |
| Helmet | Security headers |
| AES-256-GCM + scrypt | API key encryption |

### Infrastructure
| Service | Role |
|---------|------|
| Docker (Node 20 Alpine) | Multi-stage container build |
| Caddy | Reverse proxy, auto-HTTPS |
| Redis 7 | Job queue + cache |
| Ollama | Local LLM inference |
| Moonshot API | Cloud LLM (kimi-k2.5, kimi-k2-thinking) |

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### Development

```bash
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

# Install
npm install && cd server && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env — set JWT_SECRET, ENCRYPTION_KEY at minimum

# Run (frontend :5173, API :3001)
npm run dev                       # Frontend
cd server && npm run dev          # API
```

### Production (Docker + Caddy)

```bash
cp .env.example .env
# Fill production values (JWT_SECRET, ENCRYPTION_KEY, CORS_ORIGINS, etc.)

# Build and deploy
docker compose up -d --build
docker cp geekspace-app:/app/dist/. /var/www/geekspace/

# Verify
docker compose ps
curl https://yourdomain.com/api/health
```

See [RUNBOOK.md](RUNBOOK.md) for the full VPS deployment guide.

---

## Project Structure

```
GeekSpace2.0/
├── src/                              # React frontend
│   ├── App.tsx                       # Root with routing
│   ├── components/ui/                # shadcn/ui components
│   ├── dashboard/pages/              # Dashboard views
│   │   ├── OverviewPage.tsx          #   Charts, stats, activity
│   │   ├── RemindersPage.tsx         #   Calendar + list view
│   │   ├── ConnectionsPage.tsx       #   Integration health
│   │   ├── AgentSettingsPage.tsx     #   AI personality config
│   │   ├── AutomationsPage.tsx       #   Trigger -> action workflows
│   │   ├── SettingsPage.tsx          #   Profile, security, billing
│   │   └── TerminalPage.tsx          #   CLI interface
│   ├── landing/                      # Public landing page
│   ├── onboarding/                   # Login + onboarding flow
│   ├── portfolio/                    # Public portfolio view + AI chat
│   ├── explore/                      # User directory
│   ├── services/api.ts               # Typed HTTP client
│   └── stores/                       # Zustand state management
│
├── server/                           # Express API
│   └── src/
│       ├── index.ts                  # Server entry + health check
│       ├── config.ts                 # Validated env config
│       ├── db/index.ts               # SQLite schema + seed data
│       ├── middleware/
│       │   ├── auth.ts               # JWT verify + sign (HS256 pinned)
│       │   └── validate.ts           # Zod schemas for all endpoints
│       ├── routes/
│       │   ├── auth.ts               # Login, signup, demo, onboarding
│       │   ├── agent.ts              # AI chat (two-tier), terminal commands
│       │   ├── reminders.ts          # Reminder CRUD
│       │   ├── automations.ts        # Automation CRUD + triggers
│       │   ├── integrations.ts       # Service connections
│       │   ├── portfolio.ts          # Public profile management
│       │   ├── usage.ts              # Token/cost tracking
│       │   ├── dashboard.ts          # Stats + contact form
│       │   └── apiKeys.ts            # Encrypted API key storage
│       ├── services/
│       │   ├── llm.ts                # Two-Tier LLM router + credit math
│       │   └── edith.ts              # Moonshot API client (direct HTTP)
│       └── prompts/
│           └── openclaw-system.ts    # System prompt template
│
├── bridge/edith-bridge/              # Legacy WS bridge (unused)
├── docker-compose.yml                # GeekSpace + Redis
├── Dockerfile                        # Multi-stage production build
├── RUNBOOK.md                        # Operations runbook
└── .env.example                      # Environment template
```

---

## Credits System

| Action | Cost | Notes |
|--------|------|-------|
| Any local query (Ollama) | **0** | Always free, unlimited |
| Cloud query (kimi-k2.5) | **5 credits / 1K tokens** | Auto-fallback when Ollama down |
| Premium query (kimi-k2-thinking) | **10 credits / 1K tokens** | Explicit `/premium` prefix |
| Minimum per premium call | **10 credits** | Prevents zero-cost micro-queries |

**Starting balance:** 15,000 credits (free tier)

Check balance: `gs credits` in terminal or `GET /api/usage/billing`

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check (Ollama + Moonshot probing) |
| `POST` | `/api/auth/signup` | No | Create account (15K credits) |
| `POST` | `/api/auth/login` | No | Login, returns JWT |
| `POST` | `/api/auth/demo` | No | Demo login with seed data |
| `GET` | `/api/auth/me` | JWT | Current user profile |
| `POST` | `/api/agent/chat` | JWT | AI chat (two-tier routed) |
| `POST` | `/api/agent/command` | JWT | Terminal command execution |
| `POST` | `/api/agent/chat/public/:user` | No | Public portfolio chat |
| `GET/PATCH` | `/api/agent/config` | JWT | Agent personality config |
| `GET/POST/PATCH/DELETE` | `/api/reminders` | JWT | Reminder CRUD |
| `GET/POST/PATCH/DELETE` | `/api/automations` | JWT | Automation CRUD |
| `GET` | `/api/integrations` | JWT | List connections |
| `GET/PATCH` | `/api/portfolio/me` | JWT | Portfolio management |
| `GET` | `/api/portfolio/:username` | No | Public portfolio |
| `GET` | `/api/usage/summary` | JWT | Usage statistics |
| `GET` | `/api/usage/billing` | JWT | Credits + billing |
| `GET/POST/DELETE` | `/api/api-keys` | JWT | Encrypted key storage |
| `GET` | `/api/directory` | JWT | User discovery |

---

## Terminal Commands

```
gs me                       Show your profile
gs reminders list           List reminders
gs reminders add "text"     Create a reminder
gs credits                  Check credit balance
gs usage today              Today's usage stats
gs usage month              Monthly usage breakdown
gs integrations             List integrations
gs connect <service>        Connect integration
gs disconnect <service>     Disconnect integration
gs automations              List automations
gs status                   Agent status
gs portfolio                Portfolio URL
gs deploy                   Deploy portfolio (make public)
gs profile set <field> <v>  Update profile field
gs export                   Export all data as JSON
ai "prompt"                 Ask your AI agent (free local LLM)
/premium "prompt"           Use premium cloud model (costs credits)
clear                       Clear terminal
help                        Show help
```

---

## Security

- **JWT HS256 algorithm pinning** — prevents algorithm-none attacks
- **bcryptjs** password hashing (10 rounds, async)
- **AES-256-GCM + scrypt** encryption for stored API keys
- **Zod validation** on every mutating endpoint
- **Helmet** security headers with CSP in production
- **CORS** restricted to configured origins
- **Rate limiting** — 200 req/15min global, 10 auth/15min, 30 chat/15min
- **1MB body size limit** on all requests
- **Trust proxy** for correct client IP behind Caddy
- **Non-root Docker user** (node)
- **Secrets never committed** — `.env` is gitignored

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#7B61FF` | Purple accent |
| Background | `#05050A` | Dark base |
| Surface | `#0B0B10` | Card/panel bg |
| Success | `#61FF7B` | Green indicators |
| Warning | `#FFD761` | Yellow alerts |
| Error | `#FF6161` | Red errors |
| Heading | Space Grotesk | Headings + display |
| Body | Inter | Body text |
| Mono | IBM Plex Mono | Code + terminal |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Prod | dev fallback | JWT signing secret (64-byte hex) |
| `ENCRYPTION_KEY` | Prod | dev fallback | AES key for API keys (32-byte hex) |
| `CORS_ORIGINS` | No | `localhost:5173` | Allowed origins (comma-separated) |
| `OLLAMA_BASE_URL` | No | `localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | No | `qwen2.5-coder:7b` | Local model |
| `OLLAMA_TIMEOUT_MS` | No | `60000` | Ollama request timeout |
| `OLLAMA_MAX_TOKENS` | No | `2048` | Max generation tokens |
| `OPENROUTER_API_KEY` | No | -- | Moonshot/cloud API key |
| `OPENROUTER_BASE_URL` | No | `openrouter.ai` | Cloud API base URL |
| `OPENROUTER_MODEL` | No | `kimi-k2.5` | Standard cloud model |
| `OPENROUTER_TIMEOUT_MS` | No | `90000` | Cloud request timeout |
| `MOONSHOT_REASONING_MODEL` | No | `kimi-k2-thinking` | Premium reasoning model |
| `MOONSHOT_TIMEOUT_MS` | No | `120000` | Reasoning request timeout |
| `MOONSHOT_MAX_TOKENS` | No | `8192` | Reasoning max tokens |
| `REDIS_URL` | No | `localhost:6379` | Redis connection |

---

<div align="center">

**Built by [trendywink247](https://github.com/trendywink247-afk)**

MIT License

</div>
