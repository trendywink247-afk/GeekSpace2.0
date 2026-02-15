<div align="center">

# GeekSpace 2.0

### Your Personal AI Operating System

[![Live](https://img.shields.io/badge/LIVE-ai.geekspace.space-7B61FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0ibTggMTIgMyAzIDUtNSIvPjwvc3ZnPg==)](https://ai.geekspace.space)
[![Stack](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-SQLite-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![AI](https://img.shields.io/badge/Three--Agent_AI-Edith_|_Jarvis_|_Weebo-FF6B35?style=for-the-badge)](https://ollama.com)
[![License](https://img.shields.io/badge/License-MIT-61FF7B?style=for-the-badge)](LICENSE)

**A self-hosted AI-OS where every user gets a personal AI agent, dashboard, terminal, portfolio, and automation engine.**

Built with a **Three-Agent Architecture** — Edith (premium reasoning), Jarvis (cloud assistant), Weebo (fast local) — with intent-based routing, automatic fallbacks, and real credit tracking.

[Live Demo](https://ai.geekspace.space) | [Architecture](#architecture) | [API Reference](#api-endpoints) | [Deploy](#production-docker--caddy)

</div>

---

## What Is This?

GeekSpace 2.0 is a full-stack AI platform that gives every user:

- **Three AI Personas** — Edith (premium), Jarvis (cloud), Weebo (local) with distinct personalities
- **Intent-Based Routing** — messages automatically route to the best agent for the task
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
     +---------+---------+---------+
     |         |         |         |
   Edith    Jarvis     Weebo    PicoClaw
  (Premium) (Cloud)   (Local)  (Sidecar)
     |         |         |
   OpenClaw  OpenRouter Ollama
   via Bridge  API     (local)
     |         |
   Redis 7   Credits
  (cache)    System
```

### Three-Agent System

Every message is classified by intent and routed to the best agent:

| Agent | Provider | Model | Cost | Best For |
|-------|----------|-------|------|----------|
| **Edith** | OpenClaw (bridge) / Moonshot fallback | Configurable | 10 cr/1K tokens | Complex reasoning, architecture, deep analysis |
| **Jarvis** | OpenRouter | Free-tier models | 5 cr/1K tokens | Daily tasks, writing, planning, coding |
| **Weebo** | Ollama (local) | `qwen2.5-coder:1.5b` | Included | Quick answers, brainstorming, simple Q&A |

**Routing logic:**

```
/edith <msg>    -->  Force Edith (premium, credit check)
/jarvis <msg>   -->  Force Jarvis (cloud)
/weebo <msg>    -->  Force Weebo (local)
/premium <msg>  -->  Alias for /edith
/local <msg>    -->  Alias for /weebo
<msg> (default) -->  Intent classifier picks best agent
```

**Intent classification:**
- `simple` / `greeting` / `meta` -> Weebo
- `coding` / `planning` -> Jarvis
- `complex` / `analysis` -> Edith

**Fallback chains:**
- Edith -> Jarvis -> Weebo -> built-in response
- Jarvis -> Weebo -> built-in response
- Weebo -> Jarvis -> built-in response

### Response Contract

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
| Ollama | Local LLM inference (Weebo) |
| OpenRouter | Cloud LLM API (Jarvis) |
| EDITH Bridge | WebSocket-RPC bridge to OpenClaw (Edith) |

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
# Edit .env -- set JWT_SECRET, ENCRYPTION_KEY at minimum

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
│   ├── components/                   # Shared components + shadcn/ui
│   ├── dashboard/pages/              # Dashboard views
│   │   ├── OverviewPage.tsx          #   Charts, stats, activity
│   │   ├── RemindersPage.tsx         #   Calendar + list view
│   │   ├── ConnectionsPage.tsx       #   Integration health
│   │   ├── AgentSettingsPage.tsx     #   Persona picker + personality config
│   │   ├── AutomationsPage.tsx       #   Trigger -> action workflows
│   │   ├── SettingsPage.tsx          #   Profile, security, billing
│   │   ├── UsageAnalyticsPage.tsx    #   Token usage charts
│   │   ├── MemoryManagerPage.tsx     #   Conversation memory
│   │   ├── PortfolioPage.tsx         #   Portfolio editor
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
│       │   ├── agent.ts              # AI chat (three-agent), streaming, commands
│       │   ├── reminders.ts          # Reminder CRUD
│       │   ├── automations.ts        # Automation CRUD + triggers
│       │   ├── integrations.ts       # Service connections
│       │   ├── portfolio.ts          # Public profile management
│       │   ├── usage.ts              # Token/cost tracking
│       │   ├── dashboard.ts          # Stats + contact form
│       │   └── apiKeys.ts            # Encrypted API key storage
│       ├── services/
│       │   ├── llm.ts                # Three-agent LLM router + fallbacks
│       │   ├── edith.ts              # EDITH client (bridge + Moonshot fallback)
│       │   └── picoclaw.ts           # Lightweight automation sidecar
│       └── prompts/
│           └── openclaw-system.ts    # Persona system (Edith/Jarvis/Weebo)
│
├── bridge/edith-bridge/              # WebSocket-RPC bridge for OpenClaw
├── docker-compose.yml                # GeekSpace + Redis + Bridge
├── Dockerfile                        # Multi-stage production build
├── RUNBOOK.md                        # Operations runbook
└── .env.example                      # Environment template
```

---

## Credits System

| Action | Cost | Notes |
|--------|------|-------|
| Weebo queries (Ollama) | **Included** | Local inference, no limits |
| Jarvis queries (OpenRouter) | **5 credits / 1K tokens** | Cloud fallback |
| Edith queries (OpenClaw/Moonshot) | **10 credits / 1K tokens** | Premium reasoning |
| Minimum per premium call | **10 credits** | Prevents zero-cost micro-queries |

**Starting balance:** 15,000 credits

Check balance: `gs credits` in terminal or `GET /api/usage/billing`

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check (probes all providers) |
| `POST` | `/api/auth/signup` | No | Create account |
| `POST` | `/api/auth/login` | No | Login, returns JWT |
| `POST` | `/api/auth/demo` | No | Demo login with seed data |
| `GET` | `/api/auth/me` | JWT | Current user profile |
| `POST` | `/api/agent/chat` | JWT | AI chat (three-agent routed) |
| `POST` | `/api/agent/chat/stream` | JWT | SSE streaming chat |
| `POST` | `/api/agent/command` | JWT | Terminal command execution |
| `POST` | `/api/agent/chat/public/:user` | No | Public portfolio chat |
| `GET/PATCH` | `/api/agent/config` | JWT | Agent persona config |
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
gs automations              List automations
gs status                   Agent status
gs portfolio                Portfolio URL
gs deploy                   Deploy portfolio (make public)
gs export                   Export all data as JSON
ai "prompt"                 Ask your AI agent
/edith "prompt"             Use Edith (premium reasoning)
/jarvis "prompt"            Use Jarvis (cloud assistant)
/weebo "prompt"             Use Weebo (fast local)
clear                       Clear terminal
help                        Show help
```

---

## Security

- **JWT HS256 algorithm pinning** -- prevents algorithm-none attacks
- **bcryptjs** password hashing (10 rounds, async)
- **AES-256-GCM + scrypt** encryption for stored API keys
- **Zod validation** on every mutating endpoint
- **Helmet** security headers with CSP in production
- **CORS** restricted to configured origins
- **Rate limiting** -- 200 req/15min global, 10 auth/15min
- **1MB body size limit** on all requests
- **Trust proxy** for correct client IP behind Caddy
- **Non-root Docker user** (node)
- **Response sanitization** -- strips internal model/provider names from AI output
- **Secrets never committed** -- `.env` is gitignored

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#7B61FF` | Purple accent (Edith) |
| Jarvis | `#61B3FF` | Blue accent |
| Weebo | `#61FF7B` | Green accent |
| Background | `#05050A` | Dark base |
| Surface | `#0B0B10` | Card/panel bg |
| Warning | `#FFD761` | Yellow alerts |
| Error | `#FF6161` | Red errors |
| Heading | Space Grotesk | Headings + display |
| Body | Inter | Body text |
| Mono | IBM Plex Mono | Code + terminal |

---

## Environment Variables

See [docs/ENV_VARS.md](docs/ENV_VARS.md) for the complete reference.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Prod | dev fallback | JWT signing secret (64-byte hex) |
| `ENCRYPTION_KEY` | Prod | dev fallback | AES key for API keys (32-byte hex) |
| `CORS_ORIGINS` | No | `localhost:5173` | Allowed origins (comma-separated) |
| `OLLAMA_BASE_URL` | No | `localhost:11434` | Ollama endpoint (Weebo) |
| `OLLAMA_MODEL` | No | `qwen2.5-coder:1.5b` | Local model |
| `OPENROUTER_API_KEY` | No | -- | Cloud API key (Jarvis) |
| `OPENROUTER_FREE_MODEL` | No | `llama-3.3-70b:free` | Free-tier cloud model |
| `EDITH_GATEWAY_URL` | No | `edith-bridge:8787` | EDITH bridge endpoint |
| `EDITH_TOKEN` | No | -- | EDITH bridge auth token |
| `MOONSHOT_REASONING_MODEL` | No | `kimi-k2-thinking` | Premium reasoning model |
| `REDIS_URL` | No | `localhost:6379` | Redis connection |

---

<div align="center">

**Built by [trendywink247](https://github.com/trendywink247-afk)**

MIT License

</div>
