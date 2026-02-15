# GeekSpace 2.0 — Phase 1 Release Notes

**Version**: 2.1.0
**Date**: 2026-02-13

---

## What's New

### Security Hardening
- Centralized environment config (`server/src/config.ts`) — crashes on missing required vars in production
- Helmet security headers on all responses
- CORS origins configurable via env (no longer hardcoded to localhost)
- Zod input validation on all API endpoints (auth, chat, commands, reminders, automations, API keys)
- Global error handler with request ID tracking — no stack traces leak to clients
- AES encryption for stored API keys (`crypto-js`)
- Auth-specific rate limiting (10 attempts / 15 min, skips successful requests)
- Request body size limit (1 MB default)
- Structured logging with Pino (JSON in production, pretty in dev)
- 6 missing database indices added (users email/username, foreign keys)
- Demo seed data gated behind `NODE_ENV !== 'production'`

### Tri-Brain LLM Router
- **Real AI responses** — agent chat no longer uses canned keyword matching
- Intent classifier routes messages to the optimal provider:
  - `simple` → Ollama (free, local)
  - `planning` / `coding` / `complex` → OpenRouter or EDITH
  - `automation` → Ollama with tool prompt
- Ollama integration via HTTP API (`/api/chat`)
- OpenRouter integration (OpenAI-compatible `/chat/completions`)
- EDITH/OpenClaw gateway placeholder for future Phase 3
- Fallback chain: preferred provider → Ollama → graceful error message
- Ollama availability cached for 30 seconds
- Usage logging: provider, model, tokens, latency, estimated cost
- Credit deduction for paid providers ($0.00001 = 1 credit)
- Context-aware system prompts with user data (reminders, integrations)
- Public portfolio chat forced to Ollama (free, no credits needed)

### Mobile-First UI Revamp
- Lazy loading all 7 dashboard pages via `React.lazy()` + `Suspense`
- Mobile bottom tab bar (5 tabs: Home, Terminal, Reminders, Agent, Settings)
- Mobile sidebar drawer with slide animation and dark overlay
- Desktop sidebar preserved (hidden on mobile)
- Hamburger menu on mobile header
- 44px minimum touch targets on all interactive elements
- ARIA attributes: `role="navigation"`, `role="tablist"`, `aria-selected`, `aria-current`
- Responsive credits badge and welcome text
- Main content padding to clear bottom tabs
- Alex orb repositioned above bottom tabs on mobile

### Docker Deployment
- Multi-stage Dockerfile (Node 20 Alpine, build → slim production image)
- `docker-compose.yml` with geekspace + Redis + Nginx services
- Private bridge network, persistent volumes for data + Redis
- Health checks on all services
- Nginx reverse proxy with gzip, security headers, WebSocket support, SPA fallback
- SSL/HTTPS setup guide (Certbot)
- `.env.example` with all configuration variables documented
- `RUNBOOK.md` — deploy, update, backup/restore, secret rotation, monitoring, troubleshooting

---

## Breaking Changes

- **JWT expiry changed** from 30 days to 7 days (configurable via `JWT_EXPIRES_IN`)
- **JWT_SECRET required in production** — server will not start without it
- **ENCRYPTION_KEY required in production** — for API key encryption
- Agent chat responses are now real LLM output (requires Ollama running)

---

## Migration from v2.0

1. Install Ollama and pull a model: `ollama pull qwen2.5-coder:1.5b`
2. Copy `.env.example` to `.env` and generate secrets
3. Run `docker compose up -d --build`
4. Existing users will need to log in again (JWT secret changed)
