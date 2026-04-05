# GeekSpace 2.0 — Full System Audit
**Date**: 2026-04-05
**VPS**: 8 cores, 31GB RAM, 387GB disk (59% used), Ubuntu 24.04

---

## CRITICAL BUGS (blocking everything)

### BUG 1: STAGING AUTH BROKEN — NOTHING WORKS
- `.env.staging` has `NODE_ENV=production`
- `server/src/config.ts`: `isProduction = NODE_ENV === 'production'`
- Demo endpoint in `server/src/modules/auth/routes/auth.ts` skips `seedDemoData()` when `isProduction=true`
- Demo user `demo-1` never gets created in staging DB
- **Result**: Demo login returns 500, real login untested, ALL dashboard features inaccessible
- **Fix**: Change `NODE_ENV=staging` in `.env.staging` OR modify demo endpoint to also seed on `staging`

### BUG 2: OLLAMA TIMEOUTS
- Staging logs: repeated "The operation was aborted due to timeout" for AI memory extraction
- PicoClaw returns 504 with 5000ms timeout
- Ollama IS accessible (5 models loaded: qwen3:8b, qwen3:14b, gemma4, nomic-embed-text, qwen2.5-coder:3b)
- **Likely cause**: PicoClaw timeout too low, or Ollama overloaded (390% CPU)
- **Fix**: Increase OLLAMA_TIMEOUT_MS, or reduce concurrent requests

### BUG 3: DOCKER SANDBOX UNAVAILABLE
- "SandboxService: Docker unavailable - connect ENOENT /var/run/docker.sock"
- Staging container doesn't have Docker socket mounted
- **Fix**: Add `/var/run/docker.sock:/var/run/docker.sock` volume mount to staging in docker-compose.yml (security risk — evaluate)

---

## Infrastructure

### Docker Services (11 containers)
| Service | Container | Port | Status | Memory |
|---------|-----------|------|--------|--------|
| Production app | geekspace-app | 3001 | ✅ healthy | 190MB/1GB |
| Staging app | geekspace-staging | 3002 | ✅ healthy | 223MB/512MB |
| Redis (prod) | geekspace-redis | 6379 | ✅ healthy | 3MB/256MB |
| Redis (staging) | geekspace-staging-redis | 6379 | ✅ healthy | 2MB/256MB |
| PicoClaw | geekspace-picoclaw | 8080 | ✅ healthy | 16MB/64MB |
| Browser | geekspace-browser | 3010 | ✅ healthy | 40MB/256MB |
| Meilisearch | geekspace-meilisearch | 7700 | ✅ healthy | 22MB/1GB |
| Qdrant | geekspace-qdrant | 6333 | ✅ healthy | 9MB/1GB |
| SearXNG | geekspace-searxng | 8080 | ✅ healthy | — |
| Uptime Kuma | geekspace-uptime-kuma | 3100 | ✅ healthy | 116MB/256MB |
| Ollama | ollama-qtzz-ollama-1 | 11434 | ✅ running | 5.7GB/18GB |

Also running: Grafana, Prometheus, Promtail, Loki, cAdvisor, node-exporter (monitoring stack)

### Caddy Reverse Proxy
- Config: `/etc/caddy/Caddyfile`
- Static files: `/srv/` (frontend dist)
- SPA fallback: `try_files {path} /index.html`
- **CRITICAL**: After building frontend, MUST clean `/srv/` and copy fresh dist, or stale chunks break navigation

### Domains
| Domain | Target |
|--------|--------|
| ai.geekspace.space | staging (:3002) |
| api.geekspace.space | staging (:3002) |
| ai.agentin.chat | production (geekspace:3001 via Docker network) |
| api.agentin.chat | production (geekspace:3001) |
| staging.agentin.chat | staging (:3002) |
| status.agentin.chat | Uptime Kuma (:3100) |
| agent.agentin.chat | Claude bridge (:32769) |
| monitor.geekspace.space | Grafana (:3000) |

### Deployment Flow
```bash
# 1. Build + start staging container
DOCKER_BUILDKIT=1 docker compose up -d --build staging

# 2. Wait for health
sleep 12

# 3. CLEAN /srv/ (prevents stale chunk bug)
rm -rf /srv/assets /srv/*.html /srv/*.js /srv/*.json /srv/*.png /srv/*.ico /srv/*.svg /srv/*.webp /srv/*.ts

# 4. Copy fresh dist
docker cp geekspace-staging:/app/dist/. /srv/

# 5. Reload Caddy
caddy reload --config /etc/caddy/Caddyfile
```

---

## Database (SQLite)
- Location: `/app/data/geekspace.db` inside containers
- 108 tables (including FTS indexes)
- Key tables: users (3), conversation_log (122), reminders, automations, agent_configs, integrations, habits, focus_sessions, generated_artifacts, etc.

---

## Backend Architecture

### 18 Domain Modules (`server/src/modules/`)
| Module | Files | Routes | Tests | Purpose |
|--------|-------|--------|-------|---------|
| agent | 42 | 1 | 0 | AI core: LLM router, ReAct, goals, delegation |
| auth | 8 | 1 | 1 | Login, signup, demo, OAuth, JWT |
| integrations | 13 | 1 | 1 | Telegram, Gmail, Calendar, custom bots |
| memory | 12 | 1 | 0 | Agent memory, embeddings, entities |
| media | 11 | 1 | 1 | Images, video, voice, TTS/STT |
| billing | 8 | 1 | 1 | Stripe, Razorpay, credits, plans |
| content | 8 | 1 | 1 | Content planning, social posts |
| health | 5 | 1 | 1 | Health checks, SSE streaming |
| reminders | 5 | 1 | 1 | CRUD, snooze, recurring, dead letters |
| portfolio | 5 | 1 | 0 | Public portfolios, contacts |
| users | 3 | 0 | 1 | User profiles, settings |
| admin | 3 | 0 | 0 | Admin panel |
| automation | 3 | 0 | 0 | Automation engine |
| comms | 3 | 0 | 0 | Agent-to-agent communication |
| dashboard | 3 | 0 | 0 | Dashboard data endpoints |
| focus | 3 | 0 | 0 | Focus sessions, habits |
| geekos | 3 | 0 | 0 | GeekOS bridge |
| office | 3 | 0 | 0 | Office canvas data |

### LLM Tier Order (7 tiers)
1. Ollama (local: qwen3:8b, qwen3:14b)
2. OpenRouter (claude-sonnet-4-6, llama-3.3-70b)
3. Groq (llama-3.3-70b-versatile)
4. Moonshot/Kimi (kimi-k2-thinking)
5. Gemini (flash-2.0)
6. Together AI (Llama 4 Maverick, Qwen3.5)
7. Anthropic/OpenAI (final fallback)

### Key Backend Files
- `server/src/app.ts` — composition root (all middleware + route mounting)
- `server/src/config.ts` — all env vars, isProduction flag
- `server/src/db/index.ts` — SQLite schema + migrations
- `server/src/modules/agent/services/llm.ts` — 7-tier LLM router
- `server/src/modules/agent/services/react-loop.ts` — standard ReAct (5 iterations)
- `server/src/modules/agent/services/deep-reasoning.ts` — deep ReAct (10 iterations)
- `server/src/modules/agent/services/goal-service.ts` — goal CRUD + AI planning
- `server/src/modules/auth/routes/auth.ts` — login, signup, demo, OAuth

---

## Frontend Architecture

### Stack
React 19 + TypeScript + Vite 7 + Tailwind 3.4 + Zustand + React Router 6 + Framer Motion + shadcn/ui + Radix UI

### File Counts
- 362 frontend source files
- 480 backend source files
- 245 test files

### Routing
- `src/App.tsx` — top-level BrowserRouter, 14 public routes + `/dashboard/*` catch-all
- `src/dashboard/DashboardApp.tsx` (571 lines) — dashboard shell: sidebar + header + tabs + page router
- `src/dashboard/DashboardRouter.tsx` (167 lines) — lazy page imports + switch/case (41 pages)
- `src/dashboard/DashboardSidebar.tsx` (434 lines) — sidebar nav with 4 groups / 15 items
- `src/dashboard/MobileTabBar.tsx` (106 lines) — 6 bottom tabs
- `src/dashboard/types.ts` (17 lines) — shared PageType union

### Dashboard Pages (41)
Full list: Overview, Chat, Settings, Reminders, Portfolio, PicoFleet, SocialMedia, Calendar, Automations, VideoGen, Analytics, Focus, Connections, Gmail, ImageCreator, WebsiteBuilder, Roadmap, Planner, Proactive, Capabilities, AgentSettings, CreativeStudio, DocsWorkspace, Billing, UsageAnalytics, Workflows, Terminal, Inbox, DesignAssistant, MemoryHub, Artifacts, Activity, AISpecialist, Goals, VoiceChat, HealthDashboard, Recipes, TemplateGallery, MemoryHubComponents, ConversationRating, ConnectInbox

### Office Module (15 files, 6040 lines)
The Office is the main dashboard landing page with:
- OfficeHomePage.tsx — main layout (canvas + smart sidebar + insight cards + quick access)
- OfficeStage.tsx — pixel-art canvas with 9 animated agents
- SmartSidebar.tsx — tabbed sidebar (Today/Timeline/Tasks/Goals/Insights)
- SpotlightHUD.tsx — agent spotlight on click
- AgentProfileFlyout.tsx — agent detail flyout
- Various tabs: GoalsTab, TasksTab, TimelineTab, MetricsTab, InsightToast

### Design System
- Brand: violet #8B5CF6 primary, soft violet #A78BFA accent
- Background: #06061a base, glassmorphism
- Fonts: Syne (headings), Space Grotesk (body), JetBrains Mono (code)
- CSS tokens: `src/styles/agentin-tokens.css`
- Glass cards: `bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)]`
- Shared wrappers: DashboardPageWrapper, PageHeader, PageShell, SectionCard

### State Management
- `src/stores/authStore.ts` — auth, user, token, onboarding (persisted to localStorage key `gs-auth`)
- `src/stores/dashboardStore.ts` — agent config, reminders, integrations
- `src/stores/themeStore.ts` — dark/light mode, accent color
- `src/stores/terminalStore.ts` — terminal command history

### ENV Files
| File | Purpose |
|------|---------|
| .env | Production config (NOT in git) |
| .env.staging | Staging config (NOT in git) |
| .env.production | Minimal production overrides |
| .env.example | Template for new deployments |
| .env.staging.example | Template for staging |

### CI/CD
- GitHub Actions: `ci.yml`
- Pipeline: Lint → Typecheck (frontend + server) → Build → Unit Tests → Deploy Staging (SSH)
- Deploy staging via SSH fails (firewall blocks GitHub Actions IPs)
- Docker build treats TS6133 (unused imports) as FATAL
- Lint treats warnings as errors (max-warnings: 0)

---

## What's Actually Broken Right Now (prioritized)

1. **STAGING AUTH** — NODE_ENV=production blocks demo seeding → can't login → nothing works
2. **Ollama timeouts** — AI memory extraction failing, chat may be slow
3. **Docker sandbox** — no Docker socket → code execution tools broken
4. **Office canvas on desktop** — overflow/height issue from our layout changes
5. **SmartSidebar scroll** — feed tab not constrained
6. **Navigation edge cases** — some sidebar links may still misbehave
