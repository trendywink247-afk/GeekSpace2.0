# GeekSpace 2.0 — Developer Handoff

> Current-state overview for new developers joining the project.
> Last updated: 2026-02-16

---

## What Is GeekSpace?

A **Personal AI Operating System** — self-hosted platform where each user gets an AI agent, dashboard, terminal, portfolio, and automation engine. Live at [ai.geekspace.space](https://ai.geekspace.space).

## What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| AI Agent Chat | Production | Multi-engine routing (Ollama + Moonshot), credit tracking |
| 3 Personalities | Production | Edith (CTO), Jarvis (butler, default), Weebo (enthusiastic) |
| Dashboard | Production | Overview, usage analytics, activity charts |
| Billing System | Production | 5 plans, dual currency (USD/INR), credit deduction per call |
| Premium Agent | Production | Specialist sessions with Moonshot reasoning model |
| Portfolio | Production | Public profiles with AI-powered visitor chat |
| Terminal | Production | `gs` commands, `ai` inline queries |
| Reminders | Production | CRUD with categories, recurring, channels |
| Automations | Production | Trigger-action workflows (UI only, no execution engine yet) |
| Integrations | Production | Telegram, GitHub, Calendar (UI + seed data) |
| Explore | Production | User directory with search and filters |
| Settings | Production | Profile, notifications, security, API keys, theme |

## Known Issues

- **Ollama timeouts**: llama3.1:8b takes 50-70s on the VPS. Intermittent 500s are usually Ollama timeouts, not code bugs.
- **Automation execution**: UI exists but automations don't actually run yet — no BullMQ job processing.
- **Integration webhooks**: Connections page shows demo data. Real webhook processing not implemented.
- **Memory system**: Memory page exists but agent doesn't persist memory across sessions.
- **Unused UI components**: ~25 shadcn/ui components imported but never used. See `CLEANUP_REPORT.md`.
- **Legacy bridge code**: `bridge/edith-bridge/` is dead code from the old OpenClaw WebSocket bridge. Deprecated, not deployed.

## Architecture Overview

```
Caddy (:443) → Express API (:3001) → SQLite + Redis
                    │
                    ├── Ollama (local, free) — default for all queries
                    ├── OpenRouter (cloud) — fallback when Ollama is down
                    └── Moonshot (reasoning) — premium sessions, /premium prefix
```

**Key principle**: Ollama handles everything by default (free). Cloud only kicks in when Ollama fails or the user explicitly requests premium.

## Key Files

| File | What It Does |
|------|-------------|
| `server/src/services/llm.ts` | LLM routing, credit computation, provider calls |
| `server/src/routes/agent.ts` | Chat, commands, personalities, premium sessions |
| `server/src/routes/billing.ts` | Plans, subscriptions, upgrade, usage |
| `server/src/prompts/openclaw-system.ts` | Base system prompt, portfolio visitor prompt |
| `server/src/prompts/personalities.ts` | Edith/Jarvis/Weebo definitions |
| `server/src/services/premium-agent.ts` | Specialist session codenames, prompts |
| `server/src/db/index.ts` | Schema, migrations, seed data, plan definitions |
| `server/src/config.ts` | All environment variables with defaults |
| `server/src/middleware/validate.ts` | Zod schemas for every endpoint |

## How to Run Locally

```bash
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

# Install
npm install && cd server && npm install && cd ..

# Configure
cp .env.example .env
# Set OLLAMA_BASE_URL if Ollama is on a non-default port

# Run
npm run dev          # Frontend :5173
cd server && npm run dev  # API :3001
```

Demo login: `alex@example.com` / `demo123`

## How to Deploy

```bash
docker compose up -d --build
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full guide.

## Branch & Repo

- **Branch**: `live-production` (main working branch)
- **Repo**: `github.com:trendywink247-afk/GeekSpace2.0`
- **Production**: `ai.geekspace.space` via Caddy reverse proxy

## Gotchas

- `tsconfig.app.json` has `noUnusedLocals` and `noUnusedParameters` — builds fail on unused imports
- `vite.config.ts` must use `base: '/'` (not `'./'`) for SPA deep-route asset loading
- `.env` is gitignored — `dotenv.config()` loads from CWD, so run from project root
- Two DB files can exist: `server/data/geekspace.db` (correct) and `data/geekspace.db` (stale) — server uses `server/data/`
- Port 3001 conflicts: `fuser -k 3001/tcp` before restart — stale processes cause "Invalid token" errors
- Seed data can leak internal names if they appear in user skills/projects
- Sonner (toast lib) installed but uses `next-themes` — not usable in Vite; use inline toast state

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, LLM routing, billing, personalities |
| [docs/API.md](docs/API.md) | Full API reference with request/response examples |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | VPS deployment guide |
| [docs/ENV_VARS.md](docs/ENV_VARS.md) | Every environment variable documented |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |
| [RUNBOOK.md](RUNBOOK.md) | Operational procedures |
| [CLEANUP_REPORT.md](CLEANUP_REPORT.md) | Codebase audit findings |
