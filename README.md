<div align="center">

# GeekSpace 2.0

### Your AI, Your Domain

[![Live](https://img.shields.io/badge/LIVE-ai.geekspace.space-7B61FF?style=for-the-badge)](https://ai.geekspace.space)
[![Version](https://img.shields.io/badge/v2.4.0-stable-61FF7B?style=for-the-badge)](docs/archive/RELEASE_v2.4.0.md)
[![Stack](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-SQLite-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-61FF7B?style=for-the-badge)](LICENSE)

*Your AI-powered dashboard with personality.*

</div>

---

## Overview

GeekSpace 2.0 is a personal AI operating system that gives every user their own AI agent, dashboard, terminal, and public portfolio. The agent adapts to your work style with swappable personalities, routes queries through a multi-engine LLM pipeline (local, cloud, and premium), and ties everything together — reminders, automations, integrations, billing, and multi-agent workflows — in one self-hosted platform.

---

## Features

- **AI Agent with 3 Personalities** — Edith (the CTO), Jarvis (the butler), Weebo (the enthusiast)
- **Multi-Agent Bridge** — 6 specialist agents (analyst, coder, planner, researcher, executor, reviewer) with automatic complexity-based routing
- **Personal Dashboard** — Real-time stats, usage charts, activity feed, and quick actions
- **Developer Portfolio** — Public profile with AI-powered visitor chat
- **Smart LLM Routing** — Local (Ollama) + Cloud (OpenRouter) + Premium (Moonshot/Kimi) with automatic fallback
- **Built-in Terminal** — `gs` commands for profile, reminders, credits, integrations, and more
- **Reminders & Automations** — Scheduled tasks and trigger-action workflows
- **Telegram Bot** — Chat with your agent from Telegram via secure account linking
- **n8n Workflow Automation** — Agentic pipelines via optional n8n integration
- **Integrations** — Telegram, GitHub, Google Calendar, n8n, and more
- **Credit-based Billing** — Free (5K) / Intro ($10/2mo) / Monthly ($10) / Half-Year ($30) / Yearly ($50) with dual USD/INR pricing
- **Premium Specialist Agent** — Deploy a dedicated cloud-powered agent session for complex tasks

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)

### Docker (recommended)

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
                           |
              +------------+-------------+
              |                          |
        /api/* routes             /* (SPA assets)
              |                   /var/www/geekspace/
              v
     +------------------+
     |  GeekSpace API   |  :3001 (Express + JWT)
     |  (Node.js)       |
     +------------------+
       |    |    |    |
       |    |    |    +-----> SQLite (better-sqlite3)
       |    |    |            server/data/geekspace.db
       |    |    |
       |    |    +---------> Redis :6379
       |    |                 (rate limiting, cache)
       |    |
       |    +--------------> Ollama (local LLM)
       |                      llama3.1:8b
       |
       +------ LLM Router ----+------+------+------+
               |               |      |      |      |
           OpenRouter     OpenClaw  Edith  PicoClaw  Bridge
           (cloud)        (WS)     (Kimi)  (auto)   (multi-agent)
           free/paid      legacy   premium  local    workflows

     +------------------+     +------------------+
     |  Telegram Bot    |     |  n8n             |  :5678
     |  (in-process)    |     |  (Docker profile)|  [optional]
     +------------------+     +------------------+
```

### LLM Routing

| Engine | Provider | Cost | Use Case |
|--------|----------|------|----------|
| **Local** | Ollama | 1 credit | Default for all queries |
| **Cloud Free** | OpenRouter (free tier) | 2 credits | Fallback when Ollama is down |
| **Cloud** | OpenRouter | 5 cr / 1K tokens | Explicit cloud requests |
| **Premium** | Moonshot / Kimi | 10 cr / 1K tokens | Specialist sessions, `/premium` or `/edith` |
| **Automation** | PicoClaw | 1 credit | Trivial tasks, heartbeat |
| **Bridge** | Multi-agent pipeline | 1-5 LLM calls | `/bridge`, `/workflow`, `/agent:<role>` |

Queries route to Ollama by default. If Ollama is unavailable and the user has credits, cloud fallback kicks in automatically. The bridge orchestrates multi-agent workflows for complex tasks when enabled.

### Multi-Agent Bridge

The Pico-Kimi Bridge classifies request complexity and routes accordingly:

| Complexity | Route | Agents | Latency |
|------------|-------|--------|---------|
| Trivial | PicoClaw direct | 0 | ~1s |
| Simple | Single specialist | 1 | ~60s (Ollama) |
| Moderate | Single specialist | 1 | ~60s |
| Complex | Multi-agent workflow | 3-5 | ~3-5min |
| Multi-step | Full pipeline | 3-5 | ~3-5min |

Use `/agent:coder`, `/agent:analyst`, `/agent:planner`, `/agent:researcher`, `/agent:executor`, or `/agent:reviewer` to force a specific specialist.

---

## Tech Stack

### Frontend

React 19 · TypeScript · Vite 7 · Tailwind CSS · shadcn/ui · Zustand · Recharts · Lucide Icons

### Backend

Express 4 · TypeScript · SQLite (better-sqlite3, WAL mode) · JWT (HS256) · Zod · Pino logger · Helmet · AES-256-GCM encryption

### Infrastructure

Docker (Node 20 Alpine) · Caddy (reverse proxy, auto-HTTPS) · Redis 7 · Ollama · Moonshot/Kimi API · OpenRouter · n8n (optional)

---

## Project Structure

```
GeekSpace2.0/
├── src/                              # React frontend
│   ├── dashboard/pages/              #   Overview, Usage, Billing, Settings, Terminal, ...
│   ├── landing/                      #   Public landing page + sections
│   ├── portfolio/                    #   Public portfolio view + AI chat
│   ├── explore/                      #   User directory
│   ├── components/                   #   Shared UI components
│   ├── services/api.ts              #   Typed HTTP client
│   └── stores/                       #   Zustand state management
│
├── server/                           # Express API
│   └── src/
│       ├── routes/                   #   auth, agent, reminders, webhooks, billing, ...
│       ├── services/
│       │   ├── llm.ts               #   LLM router + credit deduction
│       │   ├── pico-kimi-bridge.ts  #   Multi-agent orchestration
│       │   ├── agent-registry.ts    #   6 specialist agent definitions
│       │   ├── workflow-engine.ts   #   Multi-step workflow tracking
│       │   ├── telegram.ts          #   Telegram Bot API wrapper
│       │   ├── message-router.ts    #   Unified cross-channel message routing
│       │   ├── premium-agent.ts     #   Specialist session logic
│       │   └── memory.ts            #   Conversation memory + extraction
│       ├── prompts/                  #   System prompts + personalities
│       ├── middleware/               #   JWT auth, Zod validation
│       ├── db/index.ts              #   SQLite schema, seeds, migrations
│       └── config.ts                #   Environment config
│
├── picoclaw/                         # PicoClaw automation sidecar
├── bridge/edith-bridge/              # [DEPRECATED] OpenClaw WebSocket bridge
├── docker-compose.yml                # GeekSpace + Redis + PicoClaw + profiles
├── Dockerfile                        # Multi-stage production build
├── Caddyfile                         # Reverse proxy config
├── docs/                             # Architecture, deployment, env vars, troubleshooting
└── .env.example                      # Environment template
```

---

## Configuration

See `.env.example` for the full environment variable reference.

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | JWT signing secret (64-byte hex) |
| `ENCRYPTION_KEY` | Production | AES key for API key storage (32-byte hex) |
| `OLLAMA_BASE_URL` | No | Ollama endpoint (default: `localhost:11434`) |
| `OLLAMA_MODEL` | No | Local model (default: `qwen2.5-coder:1.5b`) |
| `OPENROUTER_API_KEY` | No | Cloud LLM API key |
| `REDIS_URL` | No | Redis connection (default: `localhost:6379`) |

### Feature Flags (all disabled by default)

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_ENABLED` | `false` | Enable Pico-Kimi multi-agent bridge |
| `PICOCLAW_ENABLED` | `false` | Enable PicoClaw automation engine |
| `BRIDGE_AUTO_ESCALATE` | `true` | Auto-detect complex requests for bridge routing |
| `BRIDGE_MAX_WORKFLOW_STEPS` | `6` | Max agents per workflow pipeline |
| `TELEGRAM_BOT_TOKEN` | *(empty)* | Telegram bot token (empty = disabled) |
| `TELEGRAM_WEBHOOK_SECRET` | *(empty)* | Required for webhook verification |
| `N8N_BASE_URL` | `http://n8n:5678` | n8n endpoint (only active with Docker profile) |
| `N8N_WEBHOOK_SECRET` | *(empty)* | Secret for n8n callback verification |

---

## Deployment

```bash
# Build and deploy
docker compose up -d --build

# Copy frontend assets
docker cp geekspace-app:/app/dist/. /var/www/geekspace/

# Verify
curl https://yourdomain.com/api/health
```

### Optional services

```bash
# Enable n8n workflow automation
docker compose --profile n8n up -d

# Enable EDITH bridge (legacy, deprecated)
docker compose --profile edith up -d
```

### Kill switches

```bash
# Disable bridge orchestration
echo "BRIDGE_ENABLED=false" >> .env && docker compose up -d --build geekspace

# Disable Telegram
# Clear TELEGRAM_BOT_TOKEN in .env and restart

# Stop n8n
docker compose --profile n8n down
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full operational runbook.

---

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with component status |
| GET | `/api/agent/personalities` | List personalities |
| GET | `/api/agent/agents` | List specialist agent definitions |
| GET | `/api/billing/plans` | List billing plans |
| GET | `/api/directory` | User directory |
| GET | `/api/portfolio/:username` | Public portfolio |
| POST | `/api/agent/chat/public/:username` | Portfolio visitor chat |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/signup` | Sign up |

### Authenticated (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/chat` | Chat with agent (supports `/bridge`, `/workflow`, `/agent:<role>`, `/premium`, `/local`, `/pico` prefixes) |
| POST | `/api/agent/chat/stream` | SSE streaming chat |
| POST | `/api/agent/command` | Terminal commands |
| GET | `/api/agent/config` | Get agent config |
| PATCH | `/api/agent/config` | Update agent config (name, personality, etc.) |
| GET | `/api/agent/workflows` | Workflow history |
| GET | `/api/agent/bridge-events` | Bridge routing log |
| POST | `/api/agent/bridge-preview` | Dry-run bridge classification |
| POST | `/api/agent/deploy-premium` | Deploy specialist session |
| GET | `/api/billing/plan` | Current subscription |
| POST | `/api/billing/upgrade` | Upgrade plan |
| GET | `/api/billing/usage` | 30-day usage history |

See server source for the full route list.

---

## Security

- JWT with HS256 algorithm pinning
- bcrypt password hashing
- AES-256-GCM + scrypt for stored API keys
- Zod validation on all mutating endpoints
- Helmet security headers with CSP
- CORS restricted to configured origins
- Rate limiting (200 req/15min global, 10 auth/15min, 30 chat/15min, 10 public/15min)
- Telegram webhook secret verification (rejects if unconfigured)
- n8n callback secret verification
- Agent role validation (400 on invalid `/agent:<role>`)
- Non-root Docker user

---

## License

MIT — see [LICENSE](LICENSE) for details.

<div align="center">

Built by [trendywink247](https://github.com/trendywink247-afk)

</div>
