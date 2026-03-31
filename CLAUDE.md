# GeekSpace 2.0 — Claude Code Instructions

## Architecture

Modular monolith with 18 domain modules in `server/src/modules/`. Each module has:
- `index.ts` — barrel exports + `AppModule` (registerRoutes, initialize?, shutdown?)
- `types.ts` — domain types
- `swagger.ts` — OpenAPI JSDoc annotations
- `routes.ts` or `routes/` — Express routers
- `services.ts` or `services/` — business logic
- `repositories/` — DB query abstractions (some modules)
- `__tests__/` — unit tests (some modules)

Shared infrastructure lives in `server/src/shared/` (module.ts, swagger.ts).

### Module Map

| Module | Purpose |
|--------|---------|
| **admin** | Admin dashboard, dev tools, routing debug, model discovery |
| **agent** | Core AI agent: LLM routing, ReAct loops, goal system, delegation, proactive engine, notifications |
| **auth** | JWT, OAuth (Google/GitHub), sessions, password reset, login guard, refresh tokens |
| **automation** | Automation CRUD, triggers, workflows, planner, async jobs, dead-letter queue |
| **billing** | Stripe + Razorpay payments, credit management, subscriptions, plan definitions, day passes |
| **comms** | Briefings, suggestions (with clustering), recipes, rewards |
| **content** | Artifacts (code/HTML/websites), templates, deployment (Netlify/Vercel), custom domains |
| **dashboard** | Dashboard data feeds, activity streams, analytics, reports, inbox, recommendations |
| **focus** | Focus sessions with notifications, habit tracking, deferred messages |
| **geekos** | GeekOS bridge (agent CRUD, rooms, memory, plugins), LLM proxy, Gate API (public) |
| **health** | Health probes, service monitoring, component status, cached health checks |
| **integrations** | Telegram, Gmail, Google Calendar, social media, custom bots, OAuth sync |
| **media** | Image/video generation (FLUX, Seedance), voice (TTS: Kokoro/Piper, STT: Whisper) |
| **memory** | Semantic search (Qdrant), full-text search (Meilisearch), graph memory, conversation logs, summaries |
| **office** | Docs, files, sandbox, skills, logo AI, unified dashboard |
| **portfolio** | Public profile pages, analytics, AI suggestions, portfolio chat |
| **reminders** | Scheduling, recurrence patterns, multi-channel delivery, SMS/push/email/Telegram |
| **users** | User CRUD, usage reporting, API key management, feature flags |

Modules are mounted in `server/src/app.ts` in this order:
auth, health, portfolio, reminders, media, billing, integrations, content, memory, agent, users, admin, automation, dashboard, focus, comms, geekos, office.
Plus standalone routers: directory, webhooks, pico, artifacts preview.

## Frontend

**Stack:** React 19 + TypeScript + Vite 7 + Tailwind CSS 3.4

**Key directories in `src/`:**
- `components/` — Radix UI + shadcn/ui components
- `dashboard/` — Dashboard pages/components
- `pages/` — Route pages (React Router 7)
- `hooks/` — Custom React hooks
- `services/` — API client services (axios)
- `stores/` — Zustand state management
- `styles/` — Tailwind + custom CSS
- `lib/`, `utils/` — Utilities and helpers
- `types/` — TypeScript interfaces
- Feature directories: `image-tools/`, `logo-studio/`, `explore/`, `landing/`, `onboarding/`, `portfolio/`

**UI libraries:** Radix UI (20+ components), Framer Motion, Recharts, Chart.js, Three.js + React Three Fiber, BlockNote (rich text editor), React Hook Form + Zod validation, Sonner (toasts), SweetAlert2, Vaul (drawer)

### Design System CSS Classes (`src/index.css`)

Utility classes defined in global CSS (not Tailwind — used as plain class names):
- `.gs-card` — Standard card (glassmorphism, border, hover glow)
- `.gs-btn-primary`, `.gs-btn-ghost` — Button variants
- `.gs-input` — Styled input field
- `.gs-tab-bar` — Tab navigation bar
- `.gs-pill` — Filter pill / tag
- `.gs-icon-pill`, `.gs-icon-pill-violet` — Icon pill variants
- `.gs-compact` — Compact layout modifier
- `.glass-card`, `.glass-card-v2` — Glassmorphism cards (blur + border)
- `.text-gradient`, `.text-gradient-violet`, `.text-gradient-lime` — Text gradients
- `.neon-border` — Animated multi-color border
- `.glow-accent` — Cyan glow shadow

**Agent brand color CSS vars:** `--ag-weebo`, `--ag-edith`, `--ag-jarvis`, `--ag-aria`, `--ag-forge`, `--ag-pulse`, `--ag-echo`, `--ag-cal`, `--ag-nova`

### Agent Office (Pixel-Art Canvas Simulation)

`src/dashboard/pages/office/` — Full pixel-art office with 9 animated agents on a 27×25 grid (864×800px, 32px tiles) rendered on HTML5 Canvas at ~30fps.

**Core files:**
- `OfficeStage.tsx` — Canvas container, SSE event processing, agent state machine, render loop
- `OfficeCanvasRenderer.ts` — Pure canvas renderer (sprites, beams, bubbles, environmental overlays)
- `agentBehavior.ts` — Idle behavior FSM (wandering, socializing, resting, group meetings, avoidance)
- `types.ts` — `AgentId`, `CanvasAgent`, `SSEEvent`, `ParticleBeam`, `SpeechBubble`
- `constants.ts` — Grid dims, collision map, agent colors/meta, desk positions, design tokens
- `navigation.ts` — BFS pathfinding, walkability validation (single source of truth)
- `roomZones.ts` — Room definitions (patio, pantry, lounge, workspace, meeting_room)
- `smartObjects.ts` — Interactive furniture with interaction points and occupancy
- `occupancy.ts` — Reserved point tracking (`reservePoint`, `releasePoint`)
- `perception.ts` — Agent perception (nearby agents, objects, rooms)
- `collisionLoader.ts` — Pixel-accurate collision mask from webp alpha channel
- `useOfficeData.ts` — SSE hook subscribing to `/api/agent-state/stream`

**Agent hierarchy (3 core + 6 specialists):**

| Agent | Role | Color | Type | Parent |
|-------|------|-------|------|--------|
| weebo | Creative Assistant | #00F0FF | core | — |
| edith | Strategic Engine | #8B5CF6 | core | — |
| jarvis | Operations | #ADFF2F | core | — |
| aria | Creative Director | #FF6B9D | specialist | weebo |
| echo | Coach | #6366F1 | specialist | weebo |
| forge | Tech Lead | #F59E0B | specialist | edith |
| pulse | Data Analyst | #10B981 | specialist | edith |
| cal | Scheduler | #84CC16 | specialist | jarvis |
| nova | Researcher | #EC4899 | specialist | jarvis |

**Sprite sheets:** 16×32 frames, 3 rows (down/up/right), 7 columns (walk×3, type×2, read×2). No additional sprite frames exist — all visual effects beyond sprites must be code-rendered on canvas.

**Key constraints:**
- All interaction points must be on walkable tiles (verify against `COLLISION_MAP`)
- Agent facing directions must face toward furniture (not away)
- Room zone bounds can overlap — `getRoomAt()` returns first match, so more specific zones must come first in ROOMS array
- Specialists are dormant until activated by delegation from their parent core agent

## Agentic Experience (v3.3)

The agent module (`server/src/modules/agent/`) is the core. Key subsystems:

### Goal System
- `services/goal-service.ts` — CRUD + AI planning + autonomous step execution
- `routes/goals.ts` — REST API at `/api/agent/goals` + `/api/agent/workspace`
- `types/goals.ts` — Goal, GoalStep, GoalEvent, WorkspaceArtifact types
- DB tables: `goals`, `goal_steps`, `goal_events`, `workspace_artifacts`, `delegation_log`

### Delegation Pipeline
- `services/delegation-pipeline.ts` — Inter-agent handoff with chain delegation
- Agents detect when a task needs a specialist and delegate autonomously
- Full audit trail in `delegation_log` table

### Deep Reasoning Engine
- `services/deep-reasoning.ts` — Enhanced ReAct with plan-then-execute + self-reflection
- 10 iterations (vs 5 in standard ReAct), mid-loop delegation detection
- Auto-routes for complex queries via `classifyMessageComplexity()`

### Proactive Goal Engine
- `services/proactive-goals.ts` — Background scheduler (30min cycles)
- Auto-executes pending goal steps, nudges stale goals, sends daily summaries
- Respects user autonomy level: manual | suggest | semi_auto | full_auto

### Notifications
- `services/agent-notifications.ts` — SSE + Telegram + in-app bell
- `routes/notifications.ts` — REST API at `/api/agent/notifications`
- Honors `notif_agents` preference + quiet hours (timezone-aware)

### LLM 7-Tier Routing (`services/llm.ts`)

Fallback chain in order:
1. **Ollama** — Local (qwen3:8b, qwen3:14b for complex)
2. **OpenRouter** — claude-sonnet-4-6 + free llama-3.3-70b
3. **Groq** — llama-3.3-70b-versatile (free tier)
4. **Moonshot/Kimi** — kimi-k2-thinking (reasoning tasks)
5. **Gemini** — Flash 2.0 (1M tokens/day free)
6. **Together AI** — Llama 4 Maverick + Qwen3.5
7. **Anthropic/OpenAI** — Final fallback

## Infrastructure

### Docker Services (`docker-compose.yml`)

| Service | Purpose | Port | Memory |
|---------|---------|------|--------|
| **geekspace** | Main API + frontend (Node 22 alpine) | 3001 | 1G |
| **redis** | Job queue + caching | 6379 | 256M |
| **picoclaw** | Weebo triage engine | 8080 | 64M |
| **searxng** | Free metasearch (replaces Tavily) | 8888 | 256M |
| **meilisearch** | Full-text search (v1.12) | 7700 | 128M |
| **qdrant** | Vector DB for semantic memory (v1.13.2) | 6333 | 256M |
| **browser** | Browser automation sidecar (Playwright) | 3010 | 1.5G |
| **n8n** | Workflow automation (optional profile) | 5678 | — |
| **uptime-kuma** | Status monitoring | 3100 | 128M |
| **staging** | Staging API instance | 3002 | — |

Networks: `geekspace-net` (internal), `geekspace-shared` (external Ollama/Moonshot)

### Sidecar Services (separate directories at root)

| Directory | Purpose | Port |
|-----------|---------|------|
| `kokoro-tts/` | Text-to-speech (Python) | 5101 |
| `piper-tts/` | Fallback TTS (Piper, Python) | 5100 |
| `whisper-stt/` | Speech-to-text (Whisper.cpp, Python) | 5102 |
| `browser-agent/` | Browser automation sidecar | 3010 |
| `picoclaw/` | Weebo triage engine (Node.js) | 8080 |
| `searxng/` | Free metasearch engine config | 8080 |
| `geekos/` | GeekOS agent container (character data) | — |

### Other Root Directories

| Directory | Purpose |
|-----------|---------|
| `caddy/` | Reverse proxy config (security headers, CSP, HTTPS) |
| `infra/` | Monitoring config (Loki + Promtail log aggregation) |
| `ops/` | Operational scripts, systemd units, Cronicle job configs, CI/CD helpers |
| `docs/` | Documentation (API reference, business features, developer guide) |
| `openapi/` | OpenAPI spec (`openapi.yaml`) |
| `scripts/` | Dev/ops scripts (focus-module, deploy, health-check, load-test, repair, smoke tests) |

## Database

SQLite via better-sqlite3 (synchronous). Schema centralized in `server/src/db/index.ts`.

### Core Tables
- `users` — Accounts (email, username, password_hash, plan, credits, onboarding, prefs)
- `agent_configs` — Agent personality (voice, system_prompt, model, creativity)
- `subscriptions` — Billing (plan, credits, cycle dates, Stripe/Razorpay IDs)
- `reminders` — Scheduled tasks (text, datetime, channel, recurring pattern)
- `automations` — Automation rules (trigger_type/config, action_type/config)
- `integrations` — OAuth configs (Telegram, Gmail, Calendar, custom bots)
- `portfolios` — User public pages (username, about, projects, social, layout)
- `activity_log` — User activity audit trail
- `usage_events` — LLM usage tracking (tokens, cost, provider, model, channel)
- `api_keys` — Encrypted user API keys (provider, key_encrypted, masked_key)
- `features` — Feature flags per user
- `channel_links` — Telegram/WhatsApp external ID mapping
- `link_codes` — Temporary account linking codes
- `free_models` — Free LLM model registry
- `model_changelog` — Model lifecycle events
- `briefings` — Daily briefing content
- `installed_recipes` — Recipe installations
- `generated_artifacts` — Temporary HTML/CSS/JS artifacts (expires_at)
- `premium_sessions` — Premium session tracking
- `contact_submissions` — Landing page form submissions

### Agent/Memory Tables (added dynamically)
- `goals`, `goal_steps`, `goal_events`, `workspace_artifacts`, `delegation_log`
- `pico_agents`, `pico_tasks`, `pico_fleet_state`
- `conversation_log`, `memory_entries`, `entities`, `relations`

## Rate Limiting

| Scope | Limit |
|-------|-------|
| Global | 500 req / 15 min |
| Auth | 10 attempts / 15 min |
| Signup | 5 attempts / 15 min |
| Chat | 60 req / 15 min |
| Billing | 5 req / hour |
| Password change | 3 req / hour |

## Security

- Helmet (CSP disabled, relying on Caddy)
- Permissions-Policy (restrict camera, microphone, geolocation)
- HSTS in production
- CORS with credentials
- JWT auth via `middleware/auth.ts` (requireAuth, optionalAuth, requireAdminToken)
- `GATE_PASSWORD_HASH` — Optional frontend access gate
- `INVITE_REQUIRED` — Registration mode (false = open)

## Module Focus Workflow

To reduce context when working on a single module:

```bash
./scripts/focus-module.sh agent      # Focus Claude on agent module
./scripts/focus-module.sh billing    # Focus on billing
./scripts/focus-module.sh reset      # Show everything again
```

This modifies `.claudeignore` to hide other modules. Restart Claude Code after running.

## Key Files

- `server/src/app.ts` — Composition root, mounts all 18 modules
- `server/src/index.ts` — Server startup, scheduler init, graceful shutdown
- `server/src/config.ts` — Environment config (all env vars + LLM provider keys)
- `server/src/db/index.ts` — SQLite schema (centralized, not split per module)
- `server/src/modules/agent/services/llm.ts` — 7-tier LLM router
- `server/src/modules/agent/services/react-loop.ts` — Standard ReAct loop (5 iterations)
- `server/src/modules/agent/services/deep-reasoning.ts` — Deep reasoning (10 iterations)
- `server/src/modules/agent/services/goal-service.ts` — Goal system core
- `server/src/modules/agent/services/delegation-pipeline.ts` — Agent-to-agent delegation
- `server/src/modules/agent/services/message-router.ts` — Unified channel message handling
- `server/src/modules/agent/services/proactive-goals.ts` — Background goal scheduler
- `src/dashboard/pages/office/OfficeStage.tsx` — Agent Office canvas container + SSE processing
- `src/dashboard/pages/office/OfficeCanvasRenderer.ts` — Canvas renderer (sprites, effects, overlays)
- `src/dashboard/pages/office/agentBehavior.ts` — Agent idle behavior FSM
- `src/dashboard/pages/office/constants.ts` — Grid, collision map, agent config, desk positions
- `src/dashboard/pages/office/navigation.ts` — BFS pathfinding + walkability (single source of truth)
- `.github/workflows/ci.yml` — CI/CD pipeline (lint, typecheck, build, test, deploy)
- `eslint.config.js` — ESLint flat config with strict React hooks rules

## CI/CD Pipeline (`.github/workflows/ci.yml`)

| Job | Trigger | What it does |
|-----|---------|-------------|
| **Static Checks** | PRs + push to main | ESLint (`--max-warnings=0`), typecheck (root + server), Vite build, server build, OpenAPI validation |
| **Unit Tests** | After Static Checks | Server tests + frontend tests |
| **Deploy Staging** | Push to main (auto) | Docker build + deploy to `staging.agentin.chat:3002` |
| **Deploy Production** | Manual dispatch only | Docker build, health check, rollback on failure, sync Caddy assets |
| **Summary** | Always | Aggregates check results for branch protection |

**Key CI rules:**
- Zero-warning ESLint policy — `--max-warnings=0` on changed files only
- Node 22 LTS
- Concurrency: one CI run per branch (cancel in progress)
- Staging auto-deploys from main; production requires manual `workflow_dispatch`

### ESLint Strict React Hooks Rules

The project uses ESLint flat config (`eslint.config.js`) with strict React hooks enforcement:

| Rule | Level | What it catches |
|------|-------|----------------|
| `react-hooks/purity` | error | Impure calls during render (e.g., `Date.now()`, `Math.random()`) |
| `react-hooks/set-state-in-effect` | error | `setState` called synchronously inside `useEffect` |
| `react-hooks/immutability` | error | Variables accessed before declaration in hooks |

**Common patterns to satisfy these rules:**
- Move `Date.now()` into a function called from `useState(fn)` lazy initializer, not `useMemo`
- Sync refs via `useLayoutEffect(() => { ref.current = value; }, [value])` instead of `ref.current = value` in render
- Declare `useCallback` functions before any `useEffect` that references them
- Compute derived state outside the component in pure functions, pass to `useState(fn)`

## TypeScript

- `NODE_ENV=production` skips devDependencies (including @types). Use `NODE_ENV=development npm install` for type checking.
- Check: `cd server && npx tsc --noEmit`
- Module resolution: `bundler` mode, strict: true, skipLibCheck: true
- Server uses ES modules — imports need `.js` extensions

## Conventions

- Swagger UI at `/api/docs`
- All routes mount under `/api/` prefix
- SQLite via better-sqlite3 (synchronous — no async/await for DB calls)
- JWT auth via `middleware/auth.ts` (requireAuth, optionalAuth, requireAdminToken)
- User ID accessed as `req.userId!` (set by requireAuth middleware), NOT `req.user.id`
- Limit params: always clamp with `Math.max(1, Math.min(value, MAX))`
- Goal ownership: always verify `goal.user_id === userId` before mutations
- Notifications: route through `sendAgentNotification()` to honor preferences + quiet hours

## Testing

| Layer | Location | Runner |
|-------|----------|--------|
| Frontend unit | `tests/` | Vitest (`npm test` from root) |
| Backend unit | `server/src/modules/*/__tests__/` | Vitest (`cd server && npm test`) |
| E2E | `e2e/` | Playwright (`npx playwright test`) |

Tests run with `TEST_MODE=true` which mocks LLM calls and Telegram.

## Quick Reference

| Task | Command |
|------|---------|
| Frontend dev | `npm run dev` |
| Backend dev | `cd server && npm run dev` |
| Typecheck (frontend) | `npx tsc --noEmit` |
| Typecheck (server) | `cd server && npx tsc --noEmit` |
| Lint | `npm run lint` |
| Format check | `npx prettier --check .` |
| Unit tests (frontend) | `npm test` |
| Unit tests (server) | `cd server && npm test` |
| E2E tests | `npx playwright test` |
| Docker build | `docker compose build` |
| Docker run | `docker compose up -d` |
| Focus module | `./scripts/focus-module.sh <module>` |
| Health check | `./scripts/health-check.sh` |
| Smoke test (dev) | `./scripts/smoke-dev.sh` |

## Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `JWT_SECRET` | Token signing (required in prod) | dev fallback |
| `ENCRYPTION_KEY` | 64 hex chars (required in prod) | dev fallback |
| `DB_PATH` | SQLite file path | `./data/geekspace.db` |
| `PUBLIC_URL` | Frontend URL | `http://localhost:5173` |
| `API_URL` | Backend URL | `http://localhost:3001` |
| `REDIS_URL` | Job queue + caching | `redis://localhost:6379` |
| `MEILISEARCH_URL` | Full-text search | `http://geekspace-meilisearch:7700` |
| `QDRANT_URL` | Vector DB | `http://geekspace-qdrant:6333` |
| `PICOCLAW_URL` | Triage engine | `http://localhost:8080` |
| `BRIDGE_ENABLED` | Pico-Kimi orchestration | `true` |
| `OLLAMA_BASE_URL` | Local LLM | `http://localhost:11434` |
| `OPENROUTER_API_KEY` | OpenRouter provider | — |
| `GROQ_API_KEY` | Groq provider | — |
| `GEMINI_API_KEY` | Google Gemini | — |
| `TOGETHER_API_KEY` | Together AI | — |
| `STRIPE_SECRET_KEY` | Stripe payments | — |
| `TELEGRAM_BOT_TOKEN` | Telegram integration | — |
| `STAGING_REDIS_PASSWORD` | Required in `.env.staging` | no fallback |

## Common Pitfalls

- **Import extensions**: Server uses ES modules — imports need `.js` extensions (e.g., `'../db/index.js'`)
- **Unused imports**: Frontend enforces `noUnusedLocals` — unused imports break Docker builds
- **req.user.id vs req.userId!**: Always use `req.userId!` (set by requireAuth middleware)
- **Production npm install**: `NODE_ENV=production` skips devDependencies including @types
- **Test mode**: Tests run with `TEST_MODE=true` which mocks LLM calls and Telegram
- **Database**: SQLite is synchronous (better-sqlite3) — no async/await needed for DB calls
- **Staging Redis**: `STAGING_REDIS_PASSWORD` must be set in `.env.staging` (no default fallback)
- **Vite proxy**: Frontend dev server proxies `/api` to `:3001` — backend must be running
- **Chunk size**: Vite warns on chunks >600KB — keep imports lean
- **ESLint zero-warning CI**: GitHub Actions runs `eslint --max-warnings=0` on changed files — even warnings fail CI
- **React hooks strict mode**: No `Date.now()` in render/useMemo, no ref.current reads/writes in render, no setState in useEffect body — see ESLint rules section above
- **Vercel vs GitHub Actions**: Vercel only runs `tsc -b && vite build` (no lint). GitHub Actions runs lint + typecheck + build + tests — code can pass Vercel but fail Actions
- **Office collision map**: All agent desk positions and smart object interaction points must be on walkable tiles in `COLLISION_MAP`. Use `isWalkable()` from `navigation.ts` to verify
- **Room zone ordering**: `getRoomAt()` returns first matching room. More specific zones (e.g., pantry) must come before overlapping broader zones (e.g., patio) in the ROOMS array
