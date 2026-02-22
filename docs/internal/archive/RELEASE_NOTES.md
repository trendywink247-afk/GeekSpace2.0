# GeekSpace 2.0 — Release Notes

---

## v2.2.0 — 2026-02-16

### Personality System
- **3 AI personalities**: Edith (The Boss — CTO energy), Jarvis (The Helper — warm butler, default), Weebo (The Darling — enthusiastic)
- Personality selection via Agent Settings page (3-card picker with instant save)
- `buildSystemPrompt()` injects personality prompt between base identity and user session context
- Portfolio visitor chat adapts greeting, suggested questions, and emoji per personality
- `GET /api/agent/personalities` public endpoint returns all personality definitions

### Credit & Billing System
- **5 plans**: Free (5K credits), Intro ($10/₹999/2mo, 100K), Monthly ($10/₹999, 100K), Half-Year ($30/₹2999, 700K), Yearly ($50/₹4999, 1.5M)
- Dedicated Billing page with USD/INR currency toggle, current plan card, credit progress bar, 5-plan comparison grid
- Per-call credit deduction: Ollama=1, OpenRouter Free=2, PicoClaw=1, OpenRouter=5/1K tokens, Moonshot=10/1K tokens (min 10)
- Chat handler blocks when `credits_remaining <= 0` with friendly message
- Signup auto-creates free subscription

### Premium Specialist Agent
- Deploy a dedicated cloud-powered agent session (100 credits)
- Random codenames (Agent-7, Nova, Cipher, etc.) with personality-flavored deploy messages
- Uses Moonshot reasoning model for deep analysis
- Amber/orange UI header during active session, "End Session" button
- Paid plans only — free users get 403

### Codebase Cleanup
- Renamed `AlexButton` → `AgentChatButton` (removed demo user name leak)
- Marked `bridge/edith-bridge/` as legacy (replaced by direct Moonshot API)
- Deprecated EDITH env vars in config.ts and `.env.example`
- Converted `console.log` → `logger.info` in db/index.ts
- Moved `src/sections/` → `src/landing/sections/` for cleaner structure
- Fixed all `@/` import paths, verified zero TypeScript errors

### Bug Fixes
- Fixed Usage page crash: guarded all `.toFixed()` calls against undefined values in Recharts formatters
- Fixed Connections page NaN: mapped snake_case DB columns to camelCase in `parseIntegration()`
- Fixed AgentChatPanel TS error: extracted `data.message` before closure to satisfy strict mode
- Fixed `healthcheck.sh` bash arithmetic with `set -e` (`((PASS++))` → `PASS=$((PASS + 1))`)

### Infrastructure
- Updated `.env.example` with deprecated EDITH section
- Created `Caddyfile` matching production config
- Added legacy header to `nginx/default.conf`
- Rewrote `scripts/healthcheck.sh` (7 checks: API, Redis, Ollama, Docker, Caddy, disk, memory)
- Rewrote `scripts/prod.sh` for current deploy flow
- Rewrote `README.md` — clean, modern, under 200 lines, no Brain/OpenClaw references
- Updated all documentation files for current architecture

---

## v2.1.0 — 2026-02-13

### Security Hardening
- Centralized environment config (`server/src/config.ts`) — crashes on missing required vars in production
- Helmet security headers on all responses
- CORS origins configurable via env (no longer hardcoded to localhost)
- Zod input validation on all API endpoints
- Global error handler with request ID tracking — no stack traces leak to clients
- AES encryption for stored API keys
- Auth-specific rate limiting (10 attempts / 15 min)
- Structured logging with Pino (JSON in production, pretty in dev)
- 6 missing database indices added

### Multi-Engine LLM Router
- Real AI responses — agent chat no longer uses canned keyword matching
- Intent classifier routes messages to the optimal provider
- Ollama integration via HTTP API (`/api/chat`)
- OpenRouter integration (OpenAI-compatible)
- Fallback chain: preferred provider → Ollama → graceful error message
- Usage logging: provider, model, tokens, latency, estimated cost
- Context-aware system prompts with user data
- Public portfolio chat forced to Ollama (free)

### Mobile-First UI Revamp
- Lazy loading all dashboard pages
- Mobile bottom tab bar, sidebar drawer
- 44px minimum touch targets, ARIA attributes
- Responsive layout

### Docker Deployment
- Multi-stage Dockerfile (Node 20 Alpine)
- Docker Compose with GeekSpace + Redis
- Health checks on all services
- Caddy reverse proxy setup

---

## Breaking Changes (v2.1.0)

- **JWT expiry changed** from 30 days to 7 days (configurable via `JWT_EXPIRES_IN`)
- **JWT_SECRET required in production** — server will not start without it
- **ENCRYPTION_KEY required in production** — for API key encryption
- Agent chat responses are now real LLM output (requires Ollama running)
