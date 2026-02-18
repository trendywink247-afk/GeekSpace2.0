# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Frontend (Vite + React)
npm run build          # tsc -b && vite build
npm run dev            # Vite dev server
npm run lint           # eslint .

# Server (TypeScript + Express)
cd server && npm run build    # tsc
cd server && npm run dev      # tsx watch src/index.ts (hot reload)

# Production (Docker)
docker compose up -d --build geekspace    # Build and start
docker compose logs -f geekspace-app      # Tail logs

# Local dev server (from project root, NOT server/)
OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b node server/dist/index.js

# Deploy frontend to static host
npm run build && cp -r dist/* /var/www/geekspace/
```

**Port conflicts:** Kill stale processes with `fuser -k 3001/tcp` before starting. Stale Node processes cause "Invalid token" errors because JWT secret changes on restart.

## Architecture

### Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Shadcn/Radix UI + Zustand
- **Backend:** Express + TypeScript + better-sqlite3 + JWT + Pino logging
- **AI:** Multi-provider LLM routing (Ollama local, OpenRouter cloud, Moonshot reasoning, PicoClaw automation)
- **Infra:** Docker Compose (GeekSpace + Redis + PicoClaw sidecar), Caddy reverse proxy

### Server Layer Architecture
```
Request → Helmet/CORS/RateLimit → Auth middleware → Route handler
  → Service layer → LLM router (intent → provider selection)
  → Action parser (<<<ACTION blocks) → Action executor → Response
```

**Key server files:**
- `server/src/index.ts` — Express app, middleware stack, 20 route mounts, subsystem init
- `server/src/config.ts` — All env vars with defaults, crashes on missing required vars in production
- `server/src/db/index.ts` — SQLite schema, migrations (idempotent ALTER TABLE), seed data, plan definitions
- `server/src/services/llm.ts` — Intent classifier + multi-provider router with credit-based cost system
- `server/src/services/edith.ts` — Direct Moonshot/Kimi K2 HTTP client (OpenAI-compatible, 120s timeout, 1 retry). Used by premium sessions and pico-fleet. Shares `OPENROUTER_API_KEY`. `EDITH_GATEWAY_URL`/`EDITH_TOKEN` are deprecated config vars (old WebSocket bridge, now unused).
- `server/src/services/pico-kimi-bridge.ts` — Complexity classifier, routes trivial→PicoClaw, complex→Kimi
- `server/src/services/automations-engine.ts` — User-defined automations with cron/webhook/health_down triggers and call_api/log/send_message/create_reminder actions (separate from pico-kimi-bridge)
- `server/src/services/message-router.ts` — Unified Telegram/WhatsApp handler with task-intent detection
- `server/src/services/action-parser.ts` — Extracts `<<<ACTION {"tool":"...","params":{}} ACTION>>>` blocks from LLM output
- `server/src/services/action-executor.ts` — Executes parsed actions (portfolio, reminders, email, code gen)
- `server/src/services/model-sync.ts` — Daily sync of free OpenRouter models against live API; sends Telegram notification on changes
- `server/src/prompts/openclaw-system.ts` — Main agent identity, compact variant, portfolio visitor prompt
- `server/src/prompts/personalities.ts` — Edith (CTO), Jarvis (butler, default), Weebo (enthusiastic)

### Frontend Layer Architecture
```
App.tsx (BrowserRouter) → Auth gate (Zustand) → DashboardApp (sidebar + lazy pages)
  → Page components → Zustand store actions → API service (Axios + JWT interceptor)
```

**Key frontend files:**
- `src/App.tsx` — Root router, auth/onboarding gate
- `src/stores/authStore.ts` — User, token, onboarding state (persisted to localStorage)
- `src/stores/dashboardStore.ts` — All dashboard data, parallel fetch with `Promise.allSettled`
- `src/services/api.ts` — Typed Axios wrapper, all API services, JWT interceptor
- `src/dashboard/DashboardApp.tsx` — Sidebar layout (desktop) / bottom nav (mobile), 14 lazy-loaded pages
- `src/types/index.ts` — All TypeScript interfaces

### LLM Routing (how chat works)
1. `buildSystemPrompt()` combines: identity + personality + Pico context + memory + user session
2. `classifyIntent()` determines: simple, coding, planning, automation, complex
3. `routeChat()` selects provider: Ollama (free) → OpenRouter-free → OpenRouter paid → Moonshot
4. Response parsed for `<<<ACTION>>>` blocks → executed (portfolio updates, reminders, code gen, etc.)
5. Credits deducted from subscription after each call

### Action System (10 tools)
The LLM emits structured action blocks in its response. Tools: `generate_code`, `portfolio_add_project`, `portfolio_update_bio`, `portfolio_update_skills`, `portfolio_remove_project`, `portfolio_update_theme`, `send_email`, `set_reminder`, `crawl_url`, `trigger_workflow`. Schemas validated with Zod in `action-parser.ts`, executed in `action-executor.ts`.

### Pico-Kimi Bridge (orchestration)
Classifies message complexity (trivial→multi-step). Trivial/simple stay on PicoClaw (fast, 1 credit). Moderate+ escalate to bigger models. Multi-step tasks create workflows with plan→execute→review cycle. Agent registry defines 6 specialist roles (analyst, coder, planner, researcher, executor, reviewer).

### Pico Fleet (background tasks)
Per-user slot-based agents (up to 3). Task types: `create_reminder`, `telegram_message`, `call_api`, `n8n_webhook`, `portfolio_deploy`. In-process worker with round-robin scheduling. Tasks planned by Kimi or detected from chat via `detectTaskIntent()`.

## Critical Gotchas

**Database:** THREE DB files can exist. The running Docker server always uses `/app/data/geekspace.db` (volume mount). `server/data/geekspace.db` is for local dev. Direct DB changes for immediate production effect must go to `/app/data/geekspace.db`.

**TypeScript strictness:** `tsconfig.app.json` enforces `noUnusedLocals` and `noUnusedParameters`. Docker builds fail on unused imports. Always clean up imports.

**Vite base path:** `vite.config.ts` must use `base: '/'` (not `'./'`) for SPA deep-route asset loading.

**dotenv loading:** `dotenv.config()` loads `.env` from CWD. Run server from project root (`node server/dist/index.js`), not from `server/`.

**Ollama on this VPS:** Runs in Docker mapped to host port 32778 (not default 11434). Inside Docker network, it's at `http://ollama-qtzz-ollama-1:11434`. llama3.1:8b takes 50-70s — intermittent 500s are usually timeouts, not bugs.

**Helmet CSP:** Blocks inline `onclick` handlers (`script-src-attr 'none'`). Use `addEventListener` instead. The admin dashboard HTML (`admin-dashboard/index.html`) must follow this.

**Sonner toast:** Installed but depends on `next-themes` which isn't usable in this Vite app. Use inline toast state instead.

**Telegram messages:** `sanitizeForTelegram()` strips markdown before sending (no `parse_mode` set). LLM system prompt says "no markdown" but lightweight models ignore it — the sanitizer is the safety net.

## Environment

- `.env` is gitignored. `.env.example` is tracked with all variables documented.
- `OPENROUTER_API_KEY` — used for OpenRouter paid tier AND Moonshot/Kimi K2 (edith.ts). `OPENROUTER_FREE_API_KEY` is a separate key for the free-tier model rotation.
- `OPENAI_API_KEY` — Whisper STT + TTS for voice notes (`voice.ts`); optional.
- Production: `ai.geekspace.space` (frontend), `api.geekspace.space` (admin dashboard), via Caddy reverse proxy
- Demo users: alex/sarah/marcus (password: `demo123`)
- Branch: `live-production`
