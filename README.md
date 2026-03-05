<div align="center">

<img src="docs/assets/banner.svg" alt="GeekSpace 2.0" width="100%" />

<br />
<br />

[![Live](https://img.shields.io/badge/LIVE-ai.geekspace.space-7B61FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTEyIDJMMTUuMDkgOC4yNiAyMiA5LjI3IDE3IDEzLjE0IDE4LjE4IDIxLjAyIDEyIDE3LjI3IDUuODIgMjEuMDIgNyAxMy4xNCAyIDkuMjcgOC45MSA4LjI2IDEyIDJaIi8+PC9zdmc+)](https://ai.geekspace.space)
[![Version](https://img.shields.io/badge/v3.1-platform-61FF7B?style=for-the-badge)](https://github.com/trendywink247-afk/GeekSpace2.0/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/trendywink247-afk/GeekSpace2.0/ci.yml?branch=main&style=for-the-badge&label=CI&logo=github)](https://github.com/trendywink247-afk/GeekSpace2.0/actions)
[![License](https://img.shields.io/badge/License-MIT-61FF7B?style=for-the-badge)](LICENSE)

[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](#)
[![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat-square&logo=ollama&logoColor=white)](https://ollama.ai)

**A self-hosted AI OS — your agent, your dashboard, your portfolio.**

[Live Demo](https://ai.geekspace.space) · [Documentation](docs/) · [Report Bug](.github/ISSUE_TEMPLATE/bug_report.yml) · [Request Feature](.github/ISSUE_TEMPLATE/feature_request.yml)

</div>

---

## What Is GeekSpace?

GeekSpace is a personal AI platform that gives every user their own intelligent agent, public developer portfolio, built-in terminal, and automation engine. Route queries across local and cloud AI, swap personalities, automate workflows, and share your work — all from a single self-hosted dashboard.

**No vendor lock-in. No data leaving your infra unless you choose it.**

### What makes it different

- **Local-first AI** — Ollama runs on your hardware. Cloud is optional fallback, not the default.
- **One platform, not 10 tools** — Agent, portfolio, reminders, automations, billing, terminal — unified.
- **Personality system** — Three distinct AI personalities with different expertise and tone.
- **Background agents** — Weebo Engine runs tasks while you sleep (briefings, recipes, memory).
- **Credit economy** — Fair usage with transparent per-call costs and multiple pricing tiers.

---

## Features

<table>
<tr>
<td width="50%">

**AI Agent & Chat**
- 3 Personalities — Edith (CTO), Jarvis (butler), Weebo (sidekick)
- Smart routing: Local → Free Cloud → Paid Cloud → Premium
- SSE streaming responses
- Specialist sessions for deep tasks
- Long-term memory — per-user fact store, auto-injected into prompts
- Context extraction, chat summarization
- Chat search (filter messages by keyword)
- Chat export (download full conversation history as JSON)
- Message reactions (emoji reactions on any message)
- AI model preference setting (per-user routing override)

</td>
<td width="50%">

**Developer Portfolio**
- Public profile at `username.geekspace.space`
- AI-powered visitor chat (talk to someone's agent)
- Project showcase with AI-generated descriptions
- Connection tracking and social links
- Multiple layout themes
- Portfolio public sharing with visit analytics

</td>
</tr>
<tr>
<td>

**Automations & Background**
- Weebo Engine — up to 3 background agents per user
- Recipes: morning briefings, weekly reviews, auto-summaries
- Cron, webhook, and health-check triggers
- Telegram & WhatsApp integration
- Multi-agent workflows — chain Weebo/Jarvis/Edith in sequence
- Reminders via push, email, or Telegram
- Recurring reminders (daily, weekly, monthly schedules)

</td>
<td>

**Dashboard & Tools**
- Real-time stats, credit usage, activity feed
- Built-in terminal with `gs` commands and `ai "..."` queries
- API key management with AES-256-GCM encryption
- Billing with INR/USD pricing (Free → Yearly plans)
- PWA — installable on mobile and desktop
- Google Calendar sync — OAuth integration, schedule-aware briefings
- Focus mode, habits tracker, personal analytics
- Auth session management (view and revoke active sessions)
- Activity notification log

</td>
</tr>
</table>

<details>
<summary><strong>Full feature list</strong></summary>

- AI background generator (CSS gradients from natural language)
- Multi-agent bridge (6 specialist roles: analyst, coder, planner, researcher, executor, reviewer)
- OpenRouter free-tier model auto-rotation on quota exhaustion
- Artifact builder with custom subdomain hosting
- Template gallery for quick-start artifacts
- Admin ops dashboard with live SSE event stream
- OAuth signup (GitHub, Google) — framework ready
- Password reset via OTP (email + Telegram)
- Daily briefings via Telegram
- Voice notes (Whisper STT + TTS)
- Image generation (HuggingFace FLUX) with per-user gallery
- Google Calendar OAuth sync with briefing integration
- Multi-agent workflow builder (chain Weebo/Jarvis/Edith)
- Long-term agent memory with context injection

</details>

---

## Architecture

```mermaid
graph TB
    Internet((Internet)) --> Caddy[Caddy :443<br/>auto-HTTPS]

    Caddy -->|ai.geekspace.space| App
    Caddy -->|api.geekspace.space| App

    subgraph Docker["Docker Compose"]
        App["GeekSpace :3001<br/>Express + React"]
        Redis[(Redis :6379)]
        Pico["Weebo Engine<br/>PicoClaw sidecar"]
        App <--> Redis
        App <--> Pico
    end

    App --> SQLite[(SQLite<br/>WAL mode)]
    App --> Router{"AI Router"}

    Router -->|"1 credit"| Ollama["Ollama<br/>llama3.1:8b"]
    Router -->|"2 credits"| Free["OpenRouter<br/>Free Tier"]
    Router -->|"5 cr/1K tok"| Cloud["OpenRouter<br/>Paid"]
    Router -->|"10 cr/1K tok"| Kimi["Kimi K2<br/>Moonshot"]

    style App fill:#7B61FF,stroke:#7B61FF,color:#fff
    style Router fill:#FF61DC,stroke:#FF61DC,color:#fff
    style Caddy fill:#1A1A2E,stroke:#7B61FF,color:#F4F6FF
    style Docker fill:#0D0D1A,stroke:#7B61FF,color:#F4F6FF
    style SQLite fill:#1A1A2E,stroke:#61FF7B,color:#F4F6FF
    style Redis fill:#1A1A2E,stroke:#FF6161,color:#F4F6FF
    style Pico fill:#1A1A2E,stroke:#FFD761,color:#F4F6FF
    style Ollama fill:#1A1A2E,stroke:#61FF7B,color:#F4F6FF
    style Free fill:#1A1A2E,stroke:#61FF7B,color:#F4F6FF
    style Cloud fill:#1A1A2E,stroke:#FFD761,color:#F4F6FF
    style Kimi fill:#1A1A2E,stroke:#FF61DC,color:#F4F6FF
```

### AI Routing

| Engine | Backend | Cost | Use Case |
|--------|---------|------|----------|
| **Local AI** | Ollama | 1 credit | Default — fast, private, offline-capable |
| **Cloud Free** | OpenRouter free tier | 2 credits | Auto-fallback; models rotate on quota |
| **Cloud Paid** | OpenRouter | 5 cr / 1K tokens | Explicit `/cloud` requests |
| **Premium** | Kimi K2 (Moonshot) | 10 cr / 1K tokens | Specialist sessions, `/premium` prefix |
| **Weebo** | PicoClaw sidecar | 1 credit | Background tasks, recipes, heartbeat |
| **Bridge** | 6 specialists | 1–5 LLM calls | `/bridge`, `/agent:coder`, `/agent:analyst` |

### Request Flow

```
Chat → classifyIntent() → routeChat() → [provider] → parseActions() → executeActions() → Response
                                                        ↓
                                              <<<ACTION blocks>>>
                                    (portfolio updates, reminders, code gen, email)
```

---

## Quick Start

### Docker (Recommended)

```bash
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

cp .env.example .env
# Set JWT_SECRET and ENCRYPTION_KEY at minimum

docker compose up -d --build
```

Open **http://localhost:3001** — sign up or demo login (`alex@example.com` / `demo123`).

### Local Development

```bash
npm install && cd server && npm install && cd ..

# Terminal 1 — Frontend (port 5173)
npm run dev

# Terminal 2 — Backend (port 3001)
cd server && npm run dev
```

### Run Tests

```bash
cd server && npm test              # Unit tests (Vitest)
npx playwright test                # E2E tests (needs dev servers)
npm run lint                       # ESLint
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS, shadcn/ui, Zustand, Recharts, Lucide Icons |
| **Backend** | Express 4, TypeScript, SQLite (better-sqlite3, WAL), JWT (HS256), Zod, Pino, Helmet |
| **AI** | Ollama (local), OpenRouter (cloud), Kimi K2 (premium), PicoClaw (background) |
| **Infra** | Docker (Node 20 Alpine), Caddy (auto-HTTPS), Redis 7, PM2 (2 cluster workers) |
| **Testing** | Vitest, Playwright, supertest |
| **CI/CD** | GitHub Actions (lint, unit, E2E, smoke tests) |

---

## Configuration

Copy `.env.example` → `.env`. See [`docs/ENV_VARS.md`](docs/ENV_VARS.md) for the full list.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes (prod) | 64-byte hex signing secret |
| `ENCRYPTION_KEY` | Yes (prod) | 32-byte hex AES key |
| `OLLAMA_BASE_URL` | No | Local AI endpoint |
| `OPENROUTER_API_KEY` | No | Enables cloud AI routing |
| `TELEGRAM_BOT_TOKEN` | No | Enables Telegram integration |
| `REDIS_URL` | No | Cache + rate limiting |
| `ADMIN_TOKEN` | No | Ops dashboard access |

---

## API

> Full reference: [`docs/API.md`](docs/API.md)

<details>
<summary><strong>Key endpoints</strong></summary>

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/signup` | — | Create account |
| `POST` | `/api/auth/login` | — | Sign in |
| `POST` | `/api/auth/forgot-password` | — | Request password reset OTP |
| `POST` | `/api/agent/chat` | JWT | Chat with AI agent |
| `POST` | `/api/agent/chat/stream` | JWT | SSE streaming chat |
| `GET` | `/api/portfolio/:username` | — | Public portfolio |
| `POST` | `/api/pico/tasks/plan` | JWT | Queue background task |
| `GET` | `/api/billing/plans` | — | List pricing plans |
| `GET` | `/api/health` | — | System health check |
| `GET` | `/admin` | Admin | Ops dashboard |

</details>

---

## Security

- JWT with HS256 algorithm pinning + bcrypt (cost 12)
- AES-256-GCM + scrypt for stored API keys
- Helmet with strict CSP + HSTS + X-Frame-Options DENY
- Zod validation on all mutating endpoints
- Rate limiting: 200/15min global, 10/15min auth, 30/15min chat
- OTP-based password reset with rate limiting and audit logging
- Non-root Docker user, CORS restricted, Telegram webhook verification

> See [`SECURITY.md`](SECURITY.md) for reporting vulnerabilities.

---

## Contributing

We welcome contributions! See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup instructions, coding standards, and PR guidelines.

---

## License

[MIT](LICENSE) — build whatever you want.

---

<div align="center">

Built with obsession by [@trendywink247](https://github.com/trendywink247-afk)

<sub>

[Live App](https://ai.geekspace.space) · [Documentation](docs/) · [Report Bug](https://github.com/trendywink247-afk/GeekSpace2.0/issues/new?template=bug_report.yml) · [Request Feature](https://github.com/trendywink247-afk/GeekSpace2.0/issues/new?template=feature_request.yml)

</sub>

</div>
