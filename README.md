<div align="center">

# GeekSpace 2.0

### Your AI, Your Domain

[![Live](https://img.shields.io/badge/LIVE-ai.geekspace.space-7B61FF?style=for-the-badge)](https://ai.geekspace.space)
[![Stack](https://img.shields.io/badge/React_18-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-SQLite-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-61FF7B?style=for-the-badge)](LICENSE)

*Your AI-powered dashboard with personality.*

</div>

---

## Overview

GeekSpace 2.0 is a personal AI operating system that gives every user their own AI agent, dashboard, terminal, and public portfolio. The agent adapts to your work style with swappable personalities, routes queries through cost-optimized local and cloud LLMs, and ties everything together — reminders, automations, integrations, and billing — in one self-hosted platform.

---

## Features

- 🤖 **AI Agent with 3 Personalities** — Edith (the CTO), Jarvis (the butler), Weebo (the enthusiast)
- 📊 **Personal Dashboard** — Real-time stats, usage charts, activity feed, and quick actions
- 💼 **Developer Portfolio** — Public profile with AI-powered visitor chat
- ⚡ **Smart LLM Routing** — Local (Ollama) + cloud (Moonshot), cost-optimized with automatic fallback
- 🔧 **Built-in Terminal** — `gs` commands for profile, reminders, credits, integrations, and more
- ⏰ **Reminders & Automations** — Scheduled tasks and trigger-action workflows
- 🔗 **Integrations** — Telegram, GitHub, Google Calendar, and more
- 💳 **Credit-based Plans** — Free / Starter $4/mo / Pro $9/mo with transparent per-token billing
- 🚀 **Premium Specialist Agent** — Deploy a dedicated cloud-powered agent session for complex tasks

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
                    ┌───────────┐
                    │   Caddy   │  :443 (auto-HTTPS)
                    │  Reverse  │
                    │   Proxy   │
                    └─────┬─────┘
                          │
               ┌──────────┴──────────┐
               │                     │
          /api/*                 /*  (SPA)
               │                     │
      ┌────────▼─────────┐  ┌───────▼───────────┐
      │   Express API    │  │  React + Vite      │
      │   :3001          │  │  /var/www/geekspace │
      │   JWT + SQLite   │  │  Tailwind + shadcn  │
      └────────┬─────────┘  └───────────────────┘
               │
     ┌─────────┴─────────┐
     │                   │
   Ollama             Moonshot API
   (local LLM)        (cloud LLM)
   Free tier          Premium tier
     │                   │
   Redis 7           Credits System
   (cache/queue)     (per-token billing)
```

### LLM Routing

| Tier | Provider | Cost | Use Case |
|------|----------|------|----------|
| **Free** | Ollama (local) | 0 credits | Default for all queries |
| **Cloud** | Moonshot | 5 cr / 1K tokens | Fallback when Ollama is down |
| **Premium** | Moonshot (reasoning) | 10 cr / 1K tokens | Specialist sessions, `/premium` |

Queries route to Ollama by default. If Ollama is unavailable and the user has credits, cloud fallback kicks in automatically.

---

## Tech Stack

### Frontend

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Zustand · Recharts · Lucide Icons

### Backend

Express 4 · TypeScript · SQLite (better-sqlite3, WAL mode) · JWT (HS256) · Zod · Pino logger · Helmet · AES-256-GCM encryption

### Infrastructure

Docker (Node 20 Alpine) · Caddy (reverse proxy, auto-HTTPS) · Redis 7 · Ollama · Moonshot API

---

## Project Structure

```
GeekSpace2.0/
├── src/                          # React frontend
│   ├── dashboard/pages/          #   Overview, Usage, Billing, Settings, Terminal, ...
│   ├── landing/                  #   Public landing page + sections
│   ├── portfolio/                #   Public portfolio view + AI chat
│   ├── explore/                  #   User directory
│   ├── components/               #   Shared UI components
│   ├── services/api.ts           #   Typed HTTP client
│   └── stores/                   #   Zustand state management
│
├── server/                       # Express API
│   └── src/
│       ├── routes/               #   auth, agent, reminders, automations, ...
│       ├── services/llm.ts       #   LLM router + credit deduction
│       ├── services/premium-agent.ts  # Specialist session logic
│       ├── prompts/              #   System prompts + personalities
│       ├── middleware/            #   JWT auth, Zod validation
│       ├── db/index.ts           #   SQLite schema, seeds, migrations
│       └── config.ts             #   Environment config
│
├── docker-compose.yml            # GeekSpace + Redis
├── Dockerfile                    # Multi-stage production build
├── Caddyfile                     # Reverse proxy config
└── .env.example                  # Environment template
```

---

## Configuration

See **[docs/ENV_VARS.md](docs/ENV_VARS.md)** for the full environment variable reference.

Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | JWT signing secret (64-byte hex) |
| `ENCRYPTION_KEY` | Production | AES key for API key storage (32-byte hex) |
| `OLLAMA_BASE_URL` | No | Ollama endpoint (default: `localhost:11434`) |
| `OLLAMA_MODEL` | No | Local model (default: `qwen2.5-coder:7b`) |
| `OPENROUTER_API_KEY` | No | Cloud LLM API key |
| `REDIS_URL` | No | Redis connection (default: `localhost:6379`) |

---

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full production deployment guide.

```bash
# Build and deploy
docker compose up -d --build

# Copy frontend assets
docker cp geekspace-app:/app/dist/. /var/www/geekspace/

# Verify
curl https://yourdomain.com/api/health
```

See also: [RUNBOOK.md](RUNBOOK.md) for VPS operations and troubleshooting.

---

## Security

- JWT with HS256 algorithm pinning
- bcrypt password hashing
- AES-256-GCM + scrypt for stored API keys
- Zod validation on all mutating endpoints
- Helmet security headers with CSP
- CORS restricted to configured origins
- Rate limiting (200 req/15min global, 10 auth/15min, 30 chat/15min)
- Non-root Docker user

---

## License

MIT — see [LICENSE](LICENSE) for details.

<div align="center">

Built by [trendywink247](https://github.com/trendywink247-afk)

</div>
