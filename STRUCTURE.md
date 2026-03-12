# GeekSpace 2.0 — Project Structure

> File and directory map. Updated 2026-03-12.

```
GeekSpace2.0/
│
├── src/                                 # React frontend (Vite + TypeScript)
│   ├── components/                      #   Shared components
│   │   └── ui/                          #   shadcn/ui primitives (button, card, dialog, etc.)
│   ├── dashboard/                       #   Authenticated dashboard app
│   │   └── pages/                       #   Dashboard pages (Overview, Usage, Billing, Settings, Terminal, Health, Connections, Agent, MediaGallery, MemoryManager, TrainingRatings)
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
│       │   ├── auth.ts                  #     Login, signup, me, delete-account
│       │   ├── oauth.ts                 #     Google + GitHub OAuth (Passport.js)
│       │   ├── agent.ts                 #     Chat, config, premium, bridge, portfolios
│       │   ├── billing.ts               #     Plans, subscription, usage
│       │   ├── health.ts                #     Health check + SSE stream
│       │   ├── reminders.ts             #     CRUD reminders + snooze
│       │   ├── webhooks.ts              #     Telegram webhooks, slash commands, callback_query
│       │   └── users.ts                 #     User profile, notification settings
│       ├── services/                    #   Business logic
│       │   ├── llm.ts                  #     6-tier LLM router + credit deduction
│       │   ├── react-loop.ts           #     ReAct tool loop (max 5 iterations)
│       │   ├── action-parser.ts        #     Tool call parsing (<<<ACTION>>> format)
│       │   ├── action-executor.ts      #     Tool execution (17 tools)
│       │   ├── multi-agent-orchestrator.ts # Parallel 3-agent fan-out (launch mode)
│       │   ├── message-router.ts       #     Cross-channel message routing + fast-paths
│       │   ├── pico-kimi-bridge.ts     #     PicoClaw/Kimi bridge for simple queries
│       │   ├── premium-agent.ts        #     Specialist sessions
│       │   ├── agent-registry.ts       #     Specialist agent definitions
│       │   ├── workflow-engine.ts      #     Multi-step workflow tracking
│       │   ├── proactive-engine.ts     #     Scheduled nudges (reminders, habits, briefing)
│       │   ├── habits.ts               #     Habit Intelligence V2 (streaks, insights)
│       │   ├── telegram.ts             #     Telegram Bot API + file/photo handling
│       │   ├── memory.ts               #     Conversation memory + context window
│       │   ├── email.ts                #     Resend email integration
│       │   ├── daily-briefing.ts       #     Daily briefings with habit insights
│       │   ├── tavily.ts               #     Tavily web search integration
│       │   ├── web-research.ts         #     fetchAndExtract + smartSearch
│       │   └── cache.ts                #     Redis cache wrapper (TTL-aware)
│       ├── prompts/                     #   System prompts
│       │   ├── openclaw-system.ts      #     Main agent identity + portfolio prompt
│       │   └── personalities.ts        #     9 personalities: Weebo/Edith/Jarvis/Aria/Forge/Pulse/Echo/Cal/Nova
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
| `https://ai.agentin.chat/api/*` | Caddy → Express (:3001) | API reverse proxy |
| `https://api.agentin.chat/*` | Caddy → Express (:3001) | API-only subdomain |
| `https://ai.agentin.chat/assets/*` | Caddy → `/var/www/geekspace/` | Static assets (immutable cache) |
| `https://ai.agentin.chat/*` | Caddy → `/var/www/geekspace/index.html` | SPA fallback |
| `https://ai.geekspace.space/*` | 301 → ai.agentin.chat | Legacy domain redirect |

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
