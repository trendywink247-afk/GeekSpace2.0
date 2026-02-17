# GeekSpace 2.0 — Project Structure

> File and directory map. Updated 2026-02-17.

```
GeekSpace2.0/
│
├── src/                                 # React frontend (Vite + TypeScript)
│   ├── components/                      #   Shared components
│   │   └── ui/                          #   shadcn/ui primitives (button, card, dialog, etc.)
│   ├── dashboard/                       #   Authenticated dashboard app
│   │   └── pages/                       #   Dashboard pages (Overview, Usage, Billing, Settings, Terminal, Health, Connections, Agent)
│   ├── landing/                         #   Public landing page
│   │   └── sections/                    #   Landing page sections (Hero, Features, CTA, etc.)
│   ├── portfolio/                       #   Public user portfolio view + AI visitor chat
│   ├── explore/                         #   Public user directory / explore page
│   ├── onboarding/                      #   New-user onboarding wizard
│   ├── pages/                           #   Top-level route pages (Login, Signup, NotFound)
│   ├── hooks/                           #   Custom React hooks
│   ├── services/                        #   API client (api.ts — all HTTP calls)
│   ├── stores/                          #   Zustand state stores
│   ├── types/                           #   TypeScript type definitions
│   └── lib/                             #   Utility functions
│
├── server/                              # Express API (TypeScript)
│   └── src/
│       ├── routes/                      #   Route handlers
│       │   ├── auth.ts                  #     Login, signup, me
│       │   ├── agent.ts                 #     Chat, config, premium, bridge, portfolios
│       │   ├── billing.ts              #     Plans, subscription, usage
│       │   ├── health.ts               #     Health check + SSE stream
│       │   ├── reminders.ts            #     CRUD reminders
│       │   ├── webhooks.ts             #     Telegram + n8n webhooks
│       │   └── users.ts               #     User profile, notification settings
│       ├── services/                    #   Business logic
│       │   ├── llm.ts                  #     LLM router + credit deduction
│       │   ├── premium-agent.ts        #     Specialist sessions
│       │   ├── pico-kimi-bridge.ts     #     Multi-agent orchestration
│       │   ├── agent-registry.ts       #     Specialist agent definitions
│       │   ├── workflow-engine.ts      #     Multi-step workflow tracking
│       │   ├── telegram.ts             #     Telegram Bot API
│       │   ├── message-router.ts       #     Cross-channel message routing
│       │   ├── memory.ts              #     Conversation memory
│       │   ├── email.ts               #     Resend email integration
│       │   └── daily-briefing.ts      #     Scheduled daily briefings
│       ├── prompts/                     #   System prompts
│       │   ├── openclaw-system.ts      #     Main agent identity + portfolio prompt
│       │   └── personalities.ts        #     Edith / Jarvis / Weebo definitions
│       ├── middleware/                  #   Express middleware
│       │   ├── auth.ts                 #     JWT authentication
│       │   └── validate.ts             #     Zod request validation schemas
│       ├── db/
│       │   └── index.ts               #     SQLite schema, seeds, migrations, plan definitions
│       ├── utils/                       #   Server utilities
│       └── config.ts                   #     Environment variable configuration
│
├── picoclaw/                            # PicoClaw automation sidecar
│   ├── Dockerfile                       #   Lightweight Node.js container
│   └── src/                             #   Express server for fast triage via small model
│
├── bridge/edith-bridge/                 # [DEPRECATED] OpenClaw WebSocket bridge
│   ├── index.js                         #   WS-to-HTTP bridge for OpenClaw
│   └── Dockerfile
│
├── scripts/                             # Operational scripts
│   ├── bootstrap.sh                     #   First-time setup (secrets, networks, build)
│   ├── healthcheck.sh                   #   System health check
│   ├── repair.sh                        #   Diagnose & fix common issues
│   └── cleanup.sh                       #   Docker cleanup
│
├── nginx/                               # [LEGACY] Nginx config (not used — Caddy is active)
│   └── default.conf
│
├── docs/                                # Documentation
│   ├── ARCHITECTURE.md                  #   System architecture reference
│   ├── DEPLOYMENT.md                    #   Deployment & operations guide
│   ├── ENV_VARS.md                      #   Environment variables reference
│   ├── TROUBLESHOOTING.md              #   Common issues & fixes
│   ├── RUNBOOK.md                       #   Operational runbook
│   ├── API.md                           #   API endpoint reference
│   ├── plans/                           #   Design & implementation plans
│   └── archive/                         #   Archived release notes & reports
│
├── docker-compose.yml                   # Container orchestration
├── Dockerfile                           # Multi-stage production build
├── Caddyfile                            # Caddy reverse proxy config
├── .env.example                         # Environment variable template
├── package.json                         # Frontend dependencies
├── server/package.json                  # Backend dependencies
├── tsconfig.json                        # Root TypeScript config
├── vite.config.ts                       # Vite build config
├── tailwind.config.js                   # Tailwind CSS config
└── README.md                            # Project overview
```

## Routing Architecture

| URL Pattern | Handled By | Notes |
|-------------|------------|-------|
| `https://ai.geekspace.space/api/*` | Caddy -> Express (:3001) | API reverse proxy |
| `https://ai.geekspace.space/assets/*` | Caddy -> `/var/www/geekspace/` | Static assets (immutable cache) |
| `https://ai.geekspace.space/*` | Caddy -> `/var/www/geekspace/index.html` | SPA fallback |

## Database

- **Engine**: SQLite with WAL mode via better-sqlite3
- **Production path**: `/app/data/geekspace.db` (inside Docker container)
- **Volume**: `geekspace20_geekspace-data` -> `/app/data/`
- **Host path**: `/var/lib/docker/volumes/geekspace20_geekspace-data/_data/`

## Network Topology

```
geekspace-net (internal bridge)
  ├── geekspace-app
  ├── geekspace-redis
  └── geekspace-picoclaw

geekspace-shared (external bridge)
  ├── geekspace-app
  ├── geekspace-picoclaw
  ├── geekspace-edith-bridge
  ├── ollama-qtzz-ollama-1
  └── openclaw-e3n5-openclaw-1
```
