<div align="center">

# GeekSpace 2.0

### Your AI. Your Space. Your Rules.

[![Live](https://img.shields.io/badge/LIVE-ai.geekspace.space-7B61FF?style=for-the-badge)](https://ai.geekspace.space)
[![Version](https://img.shields.io/badge/v2.3-platform-61FF7B?style=for-the-badge)](https://github.com/trendywink247-afk/GeekSpace2.0)
[![Stack](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-SQLite-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-61FF7B?style=for-the-badge)](LICENSE)

*A self-hosted AI OS — your agent, your dashboard, your portfolio.*

</div>

---

## What Is This?

GeekSpace 2.0 is a personal AI platform that gives every user their own intelligent agent, public portfolio, built-in terminal, and automation engine. Swap personalities, route queries across local and external AI, set reminders, automate workflows, and share your work with the world — all from a single self-hosted dashboard.

No vendor lock-in. No data leaving your infra unless you choose it.

---

## Features

- **3 AI Personalities** — Edith (the CTO), Jarvis (the butler), Weebo (your enthusiastic AI sidekick)
- **Smart AI Routing** — Local AI → Cloud AI → Premium AI with automatic fallback and free-tier model switching
- **Weebo Engine** — Background agent that handles tasks, recipes, reminders, and automations while you work
- **Personal Dashboard** — Real-time stats, credit usage, daily briefings, activity feed
- **Developer Portfolio** — Public profile with personality-aware AI visitor chat and connection tracking
- **Built-in Terminal** — `gs` commands, `ai "..."` natural language queries, shell-style shortcuts
- **Reminders & Recipes** — Time-based reminders and automated recurring workflows (morning briefings, weekly reviews)
- **Telegram Integration** — Chat with your agent from Telegram via one-click account linking
- **Credit-based Billing** — Free (5K) / Pilot (₹299/mo) / Intro ($12) / Half-Year ($35) / Yearly ($60) with INR/USD pricing
- **Specialist Sessions** — Deploy a dedicated premium AI session for deep, complex tasks (100 credits)
- **Memory & Context** — Agent remembers conversations, extracts facts, auto-summarizes your day
- **AI Background Generator** — Generate CSS gradient backgrounds from natural language descriptions

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- A local AI model via [Ollama](https://ollama.ai) (optional but recommended)

### Docker (Recommended)

```bash
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY at minimum

docker compose up -d --build
```

Open `http://localhost:3001` — sign up or use demo login (`alex@example.com` / `demo123`).

### Local Development

```bash
npm install && cd server && npm install && cd ..

# Terminal 1 — Frontend (:5173)
npm run dev

# Terminal 2 — API (:3001)
cd server && npm run dev
```

---

## Architecture

```
                        Internet
                           |
                      +---------+
                      |  Caddy  |  :443 (auto-HTTPS)
                      |  Proxy  |
                      +---------+
                     /           \
           ai.geekspace.space   api.geekspace.space
                    |                   |
                    v                   v
           +------------------+    /admin (ops dashboard)
           |  GeekSpace API   |  :3001 (Express + JWT)
           |  (Node.js)       |
           +------------------+
             |    |    |    |
             |    |    |    +-----> SQLite (better-sqlite3)
             |    |    |
             |    |    +---------> Redis :6379
             |    |                (rate limiting, cache, model list)
             |    |
             |    +--------------> Local AI (Ollama)
             |                      llama3.1:8b / qwen2.5-coder
             |
             +------ AI Router ----+----------+-----------+
                     |              |          |           |
                 Cloud AI       External AI  Weebo       Multi-agent
                 (OpenRouter)   (Kimi K2)   Engine       Bridge
                 free/paid      premium      local        workflows
```

### AI Routing

| Engine | Backend | Credits | Use Case |
|--------|---------|---------|----------|
| **Local AI** | Ollama | 1 credit | Default — fast, private, offline-capable |
| **Cloud AI (Free)** | OpenRouter free tier | 2 credits | Fallback; auto-switches models on quota |
| **Cloud AI** | OpenRouter | 5 cr / 1K tokens | Explicit cloud requests |
| **External AI** | Kimi K2 (Moonshot) | 10 cr / 1K tokens | Specialist sessions, `/premium` prefix |
| **Weebo Engine** | Local agent sidecar | 1 credit | Background tasks, recipes, heartbeat |
| **Multi-agent Bridge** | 6 specialists | 1–5 LLM calls | `/bridge`, `/workflow`, `/agent:<role>` |

Queries route to Local AI by default. If unavailable, Cloud AI picks up automatically. The Weebo Engine handles background automation (recipes, reminders, memory summarization) independently. OpenRouter free-tier models auto-switch when quota is exhausted — no manual intervention.

### Multi-Agent Bridge

The AI Bridge classifies request complexity and routes accordingly:

| Complexity | Route | Agents | Latency |
|------------|-------|--------|---------|
| Trivial | Weebo Engine direct | 0 | ~1s |
| Simple | Single specialist | 1 | ~60s |
| Moderate | Single specialist | 1 | ~60s |
| Complex | Multi-agent workflow | 3–5 | ~3–5 min |
| Multi-step | Full pipeline | 3–5 | ~3–5 min |

Use `/agent:coder`, `/agent:analyst`, `/agent:planner`, `/agent:researcher`, `/agent:executor`, or `/agent:reviewer` to force a specific specialist.

---

## Tech Stack

### Frontend

React 19 · TypeScript · Vite 7 · Tailwind CSS · shadcn/ui · Zustand · Recharts · Lucide Icons

### Backend

Express 4 · TypeScript · SQLite (better-sqlite3, WAL mode) · JWT (HS256) · Zod · Pino logger · Helmet · AES-256-GCM encryption

### Infrastructure

Docker (Node 20 Alpine) · Caddy (reverse proxy, auto-HTTPS) · Redis 7 · Ollama (local AI) · Kimi K2 / OpenRouter (external AI) · n8n (optional automation)

---

## Project Structure

```
GeekSpace2.0/
├── src/                              # React frontend
│   ├── dashboard/pages/              #   Overview, Usage, Billing, Settings, Terminal, Pico Fleet
│   ├── landing/                      #   Public landing page
│   ├── portfolio/                    #   Public portfolio + AI visitor chat
│   ├── explore/                      #   User directory
│   ├── components/                   #   Shared UI components
│   ├── services/api.ts              #   Typed HTTP client
│   └── stores/                       #   Zustand state (auth, dashboard, theme)
│
├── server/                           # Express API
│   └── src/
│       ├── routes/                   #   auth, agent, reminders, billing, admin, ...
│       ├── services/
│       │   ├── llm.ts               #   AI router + credit deduction
│       │   ├── pico-fleet.ts        #   Weebo Engine — background agent worker
│       │   ├── pico-context.ts      #   Full user context for AI calls
│       │   ├── openrouter-models.ts #   Free-tier model list + auto-switching
│       │   ├── memory.ts            #   Conversation memory + extraction
│       │   ├── recipes.ts           #   Recurring automation recipes
│       │   ├── telegram.ts          #   Telegram Bot API
│       │   └── premium-agent.ts     #   Specialist session logic
│       ├── prompts/                  #   System prompts + personalities
│       ├── middleware/               #   JWT auth, Zod validation
│       ├── db/index.ts              #   SQLite schema, seeds, migrations
│       └── config.ts                #   Environment config
│
├── picoclaw/                         # Weebo Engine sidecar (local model inference)
├── bridge/edith-bridge/              # [Legacy] WebSocket bridge — kept for reference
├── docker-compose.yml                # GeekSpace + Redis + Weebo Engine + optional profiles
├── Dockerfile                        # Multi-stage production build
├── Caddyfile                         # Reverse proxy config (ai + api subdomains)
├── docs/                             # Architecture, deployment, env vars, runbook
└── .env.example                      # Environment template with all variables
```

---

## Configuration

Copy `.env.example` to `.env`. Only `JWT_SECRET` and `ENCRYPTION_KEY` are required for production.

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | JWT signing secret (64-byte hex) |
| `ENCRYPTION_KEY` | Production | AES key for API key storage (32-byte hex) |
| `OLLAMA_BASE_URL` | No | Local AI endpoint (default: `localhost:11434`) |
| `OLLAMA_MODEL` | No | Local model name (default: `qwen2.5-coder:1.5b`) |
| `OPENROUTER_API_KEY` | No | External AI API key (enables cloud routing) |
| `REDIS_URL` | No | Redis connection (default: `localhost:6379`) |
| `ADMIN_TOKEN` | No | Secret for `/admin` ops dashboard access |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `PICOCLAW_ENABLED` | `false` | Enable Weebo Engine sidecar |
| `BRIDGE_ENABLED` | `false` | Enable multi-agent bridge routing |
| `BRIDGE_AUTO_ESCALATE` | `true` | Auto-detect complex requests |
| `TELEGRAM_BOT_TOKEN` | *(empty)* | Enables Telegram integration |
| `N8N_BASE_URL` | `http://n8n:5678` | n8n endpoint (Docker profile only) |

---

## Deployment

```bash
# Build and launch
docker compose up -d --build

# Deploy frontend assets
cp -r dist/* /var/www/geekspace/

# Verify
curl https://ai.geekspace.space/api/health
```

### Optional Services

```bash
# Enable n8n workflow automation
docker compose --profile n8n up -d
```

### Operations Dashboard

The admin dashboard at `https://api.geekspace.space/admin` shows real-time Weebo Engine activity, system health, task counters, and a live event stream. Protected by `ADMIN_TOKEN`.

### Health Monitoring

A cron job runs every 4 hours to verify all system components:

```bash
# /root/GeekSpace2.0/scripts/health-check.sh
# Added automatically to system cron
```

---

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with component status |
| GET | `/api/agent/personalities` | List AI personalities |
| GET | `/api/billing/plans` | List billing plans |
| GET | `/api/directory` | User directory |
| GET | `/api/portfolio/:username` | Public portfolio |
| POST | `/api/agent/chat/public/:username` | Portfolio visitor chat |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Sign up |

### Authenticated (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/chat` | Chat with agent (supports `/bridge`, `/premium`, `/local` prefixes) |
| POST | `/api/agent/chat/stream` | SSE streaming chat |
| POST | `/api/agent/command` | Terminal commands |
| GET/PATCH | `/api/agent/config` | Agent configuration |
| GET | `/api/pico/tasks` | Weebo Engine task history |
| POST | `/api/pico/tasks/plan` | Queue a Weebo task |
| POST | `/api/agent/deploy-premium` | Deploy specialist session |
| GET | `/api/billing/plan` | Current subscription |
| POST | `/api/billing/upgrade` | Upgrade plan |
| GET | `/api/billing/usage` | 30-day usage history |

### Admin (ADMIN_TOKEN required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/health` | System component health |
| GET | `/api/admin/stats` | User + task counters |
| GET | `/api/admin/tasks` | All Weebo tasks across users |
| GET | `/api/admin/stream` | SSE live event feed |
| GET | `/admin` | Self-contained ops dashboard UI |

---

## Security

- JWT with HS256 algorithm pinning
- bcrypt password hashing
- AES-256-GCM + scrypt for stored API keys
- Zod validation on all mutating endpoints
- Helmet security headers with CSP
- CORS restricted to configured origins
- Rate limiting (200 req/15min global, 10 auth/15min, 30 chat/15min)
- Telegram webhook secret verification
- Admin dashboard protected by `ADMIN_TOKEN`
- Non-root Docker user

---

## License

MIT — see [LICENSE](LICENSE) for details.

<div align="center">

Built by [trendywink247](https://github.com/trendywink247-afk)

</div>

