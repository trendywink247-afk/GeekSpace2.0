# GeekSpace 2.0 -- Release Notes

---

## v2.2.0 -- Three-Agent Architecture

**Date**: 2026-02-15

### New Features

#### Three Named AI Agents
- **Edith** -- Premium reasoning agent. Competent, direct, efficient. Routes through OpenClaw bridge with Moonshot API fallback. Best for complex reasoning, code architecture, and deep analysis.
- **Jarvis** -- Cloud assistant agent. Formal but warm, like a trusted butler. Routes through OpenRouter free-tier models. Best for daily tasks, writing, planning, and coding.
- **Weebo** -- Fast local agent. Playful, enthusiastic, helpful. Routes through Ollama local inference. Best for quick answers, brainstorming, and casual chat.

#### Intent-Based Routing
- Messages are classified by intent (simple, coding, planning, complex, etc.) and automatically routed to the best agent
- Force-routing commands: `/edith`, `/jarvis`, `/weebo`, `/premium`, `/local`
- Automatic fallback chains: Edith -> Jarvis -> Weebo -> built-in response

#### Persona-Aware Frontend
- Chat panel shows persona-specific greetings, icons, and accent colors
- Typing indicator shows "{Agent} is thinking..."
- Agent badges on response messages (Edith/Jarvis/Weebo)
- Per-persona suggested prompts
- New persona picker in Agent Settings (three cards with descriptions and tier labels)

#### Portfolio Chat Enrichment
- Portfolio chat now includes owner's bio, skills, projects, and social links in context
- Agent name returned from API and displayed in chat header
- Routes to Jarvis (cloud) instead of Ollama for better quality

#### Response Sanitization
- All AI responses stripped of internal terms (OpenClaw, Ollama, OpenRouter, Moonshot, Brain, etc.)
- Users never see provider/model internals

### Changes
- `edith.ts` -- Rewired to use EDITH Bridge (HTTP) with Moonshot direct as fallback
- `llm.ts` -- Complete rewrite for three-agent routing with proper fallback chains
- `agent.ts` -- Updated routing, streaming, portfolio chat, force-routing commands
- `openclaw-system.ts` -- Three built-in personas + custom persona builder + portfolio persona
- Tier labels use "Included" (never "free")
- Terminal shows "GeekSpace AI Engine" and "Starter" plan
- Credit display uses "Credits Used" (not dollar amounts)

### Cleanup
- Removed `nginx/` directory (Caddy handles reverse proxy)
- Removed 37 unused shadcn/ui components
- Removed orphaned `use-mobile.ts` hook
- Cleaned "Brain 1-4" references from code comments and config

---

## v2.1.0 -- Security Hardening + LLM Router

**Date**: 2026-02-13

### What's New

#### Security Hardening
- Centralized environment config (`server/src/config.ts`) -- crashes on missing required vars in production
- Helmet security headers on all responses
- CORS origins configurable via env (no longer hardcoded to localhost)
- Zod input validation on all API endpoints
- Global error handler with request ID tracking -- no stack traces leak to clients
- AES-256-GCM encryption for stored API keys
- Auth-specific rate limiting (10 attempts / 15 min)
- Request body size limit (1 MB default)
- Structured logging with Pino (JSON in production)
- 6 missing database indices added
- Demo seed data gated behind `NODE_ENV !== 'production'`

#### LLM Router
- Real AI responses -- agent chat no longer uses canned keyword matching
- Intent classifier routes messages to optimal provider
- Ollama integration via HTTP API
- OpenRouter integration (OpenAI-compatible)
- EDITH/OpenClaw gateway integration
- Fallback chain with graceful error handling
- Ollama availability cached for 30 seconds
- Usage logging: provider, model, tokens, latency, cost
- Credit deduction for paid providers

#### Mobile-First UI Revamp
- Lazy loading all dashboard pages via `React.lazy()` + `Suspense`
- Mobile bottom tab bar (5 tabs)
- Mobile sidebar drawer with slide animation
- 44px minimum touch targets on all interactive elements
- ARIA attributes for accessibility

#### Docker Deployment
- Multi-stage Dockerfile (Node 20 Alpine)
- Docker Compose with health checks on all services
- EDITH bridge optional via Docker profiles
- Caddy reverse proxy configuration
- Operations runbook (RUNBOOK.md)

### Breaking Changes
- JWT expiry changed from 30 days to 7 days (configurable via `JWT_EXPIRES_IN`)
- `JWT_SECRET` required in production
- `ENCRYPTION_KEY` required in production
- Agent chat requires Ollama running (no more canned responses)

### Migration from v2.0
1. Install Ollama and pull a model: `ollama pull qwen2.5-coder:1.5b`
2. Copy `.env.example` to `.env` and generate secrets
3. Run `docker compose up -d --build`
4. Existing users will need to log in again (JWT secret changed)
