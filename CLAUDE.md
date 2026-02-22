# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Run & Test Commands

```bash
# Frontend (Vite + React)
npm run build          # tsc -b && vite build → dist/
npm run dev            # Vite dev server (port 5173)
npm run lint           # eslint .

# Server (TypeScript + Express)
cd server && npm run build    # tsc → server/dist/
cd server && npm run dev      # tsx watch src/index.ts (hot reload, port 3001)

# Unit tests (Vitest, server only)
cd server && npm test                              # vitest run (one-shot, sets TEST_MODE=true)
cd server && npm run test:watch                    # vitest watch mode
cd server && npx vitest run src/test/api/auth.test.ts  # single test file

# E2E tests (Playwright)
npx playwright test                        # all tests (requires dev servers or CI build)
npx playwright test e2e/login.spec.ts      # single spec
npx playwright test --project=chromium     # single browser
npx playwright test --headed               # visible browser

# Production (Docker)
docker compose up -d --build geekspace    # build and start
docker compose logs -f geekspace-app      # tail logs

# Local dev server (from project root, NOT server/)
OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b node server/dist/index.js
```

**Port conflicts:** Kill stale processes with `fuser -k 3001/tcp` before starting. Stale Node processes cause "Invalid token" errors because JWT secret changes on restart.

## CI/CD Pipelines

Two GitHub Actions workflows run on push/PR to `main`, `master`, `live-production`:

**CI workflow** (`ci.yml`): Static checks → Unit tests → E2E tests → Smoke tests (sequential pipeline). Static checks lint **only changed files** with `--max-warnings=0` (warnings fail CI). Also runs typecheck + build for both root and server.

**Test workflow** (`test.yml`): Single job that runs full lint (`eslint .`), typecheck, unit tests, E2E tests, and smoke tests sequentially. Errors fail it; warnings alone do not.

Both workflows cancel in-progress runs on the same branch. E2E tests install only chromium (not all browsers). Smoke tests start the server and hit `/api/health`.

**Key difference:** CI lints only changed files but treats warnings as errors. Test workflow lints everything but only fails on errors. Both must pass before merging.

## Architecture

### Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Shadcn/Radix UI + Zustand
- **Backend:** Express + TypeScript + better-sqlite3 + JWT + Pino logging
- **AI:** Multi-provider LLM routing (Ollama local, OpenRouter cloud, Moonshot reasoning, PicoClaw automation)
- **Auth:** JWT + Passport.js (Google OAuth 2.0, GitHub OAuth 2.0 via `server/src/routes/oauth.ts`)
- **Infra:** Docker Compose (GeekSpace + Redis + PicoClaw sidecar), Caddy reverse proxy, PM2 cluster (2 workers in Docker)

### Server Layer Architecture
```
Request → Helmet/CORS/RateLimit → Auth middleware → Route handler
  → Service layer → LLM router (intent → provider selection)
  → Action parser (<<<ACTION blocks) → Action executor → Response
```

**Key server files:**
- `server/src/index.ts` — Express app, middleware stack, 25+ route mounts, subsystem init
- `server/src/app.ts` — Express app factory (used by tests to create isolated app instances)
- `server/src/config.ts` — All env vars with defaults, crashes on missing required vars in production
- `server/src/db/index.ts` — SQLite schema, migrations (idempotent ALTER TABLE), seed data, plan definitions
- `server/src/services/llm.ts` — Intent classifier + multi-provider router with credit-based cost system
- `server/src/services/edith.ts` — Direct Moonshot/Kimi K2 HTTP client (OpenAI-compatible, 120s timeout, 1 retry). Shares `OPENROUTER_API_KEY`.
- `server/src/services/pico-kimi-bridge.ts` — Complexity classifier, routes trivial→PicoClaw, complex→Kimi
- `server/src/services/automations-engine.ts` — User-defined automations with cron/webhook/health_down triggers and call_api/log/send_message/create_reminder actions
- `server/src/services/message-router.ts` — Unified Telegram/WhatsApp handler with task-intent detection
- `server/src/services/action-parser.ts` — Extracts `<<<ACTION {...} ACTION>>>` blocks from LLM output (Zod-validated)
- `server/src/services/action-executor.ts` — Executes parsed actions (portfolio, reminders, email, code gen)
- `server/src/prompts/openclaw-system.ts` — Main agent identity, compact variant, portfolio visitor prompt
- `server/src/prompts/personalities.ts` — Edith (CTO), Jarvis (butler, default), Weebo (enthusiastic)
- `server/src/routes/oauth.ts` — Google + GitHub OAuth 2.0 with Passport.js strategies

### Frontend Layer Architecture
```
App.tsx (BrowserRouter) → Auth gate (Zustand) → DashboardApp (sidebar + lazy pages)
  → Page components → Zustand store actions → API service (Axios + JWT interceptor)
```

**Path alias:** `@/*` → `./src/*` (configured in `tsconfig.json` and `vite.config.ts`). Use `import { X } from '@/components/...'`.

**Vite dev proxy:** Both `server` and `preview` modes proxy `/api` to `http://localhost:3001`.

**Key frontend files:**
- `src/App.tsx` — Root router, auth/onboarding gate
- `src/stores/authStore.ts` — User, token, onboarding state (persisted to localStorage)
- `src/stores/dashboardStore.ts` — All dashboard data, parallel fetch with `Promise.allSettled`
- `src/services/api.ts` — Typed Axios wrapper, all API services, JWT interceptor
- `src/dashboard/DashboardApp.tsx` — Sidebar layout (desktop) / bottom nav (mobile), lazy-loaded pages
- `src/types/index.ts` — All TypeScript interfaces
- `src/utils/reminderParser.ts` — Natural language reminder parsing (e.g. "tomorrow at 3pm call mom" → structured data)

**shadcn/ui:** New York style, configured in `components.json`. Add components via `npx shadcn@latest add <component>`. Components land in `src/components/ui/`.

### PWA Infrastructure
- `public/manifest.json` — Full PWA manifest with icons, shortcuts (Chat, Remind, Portfolio), categories
- `public/sw.ts` — Service worker with static asset caching, push notification handling, background sync for reminders/messages, offline support
- `src/hooks/usePWA.ts` — Manages PWA state (install prompt, offline detection, push notifications, service worker registration)
- `src/components/PWAInstallPrompt.tsx` — Install prompt UI

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

## Testing

### Unit Tests (Vitest)
Tests live in `server/src/test/api/*.test.ts`. Run via `cd server && npm test`. Uses `supertest` against `createApp()` from `server/src/app.ts`.

**Test infrastructure (`server/src/test/`):**
- `setup.ts` — Creates temp DB, exports `resetDatabase()`, `createTestUser()`, `generateTestToken()`, `makeAuthHeader()`
- `test-mode.ts` — When `TEST_MODE=true`, mocks LLM calls, Telegram, PicoClaw with deterministic responses based on message content keywords. Exports `mockLLMCall()`, `getTestState()`, `resetTestState()`.

Tests run with `pool: 'forks'` and `singleFork: true` (sequential) to avoid SQLite conflicts.

### E2E Tests (Playwright)
Tests live in `e2e/*.spec.ts`. Config in `playwright.config.ts`.

- **Auth setup:** `e2e/auth.setup.ts` seeds a test user via `/api/test/seed`, logs in, saves auth state to `playwright/.auth/user.json`
- **Base fixture:** `e2e/base.ts` provides `resetTestState`, `seedTestUser`, `getTestState` helpers
- **Browser projects:** chromium, pixel5 (Android) — iphone13 disabled in CI for speed
- **CI mode:** Builds production first, runs with 1 worker, 2 retries
- **Local mode:** Reuses running dev servers (`npm run dev` + `cd server && npm run dev`)

### Docker Build
Multi-stage (`node:20-alpine`): installs deps → builds frontend (`dist/`) + server (`server/dist/`) → production image with `npm ci --omit=dev`. Runs as non-root `node` user via `pm2-runtime` (2 cluster workers). Server `tsconfig.json` excludes `**/*.test.ts` and `**/test/**` from build output.

## Critical Gotchas

**Database:** THREE DB files can exist. The running Docker server always uses `/app/data/geekspace.db` (volume mount). `server/data/geekspace.db` is for local dev. Direct DB changes for immediate production effect must go to `/app/data/geekspace.db`.

**TypeScript strictness:** `tsconfig.app.json` (frontend) enforces `noUnusedLocals` and `noUnusedParameters`. Docker builds fail on unused imports. Always clean up imports. Server `tsconfig.json` does not enforce these.

**Package.json duplication:** Root `package.json` is a copy of `server/package.json` (both named `geekspace-api`). Frontend dependencies are installed at root via `npm ci` but are not listed in a separate manifest — they live in `package-lock.json`.

**ESLint + React Compiler:** The project uses `eslint-plugin-react-hooks` with `flat.recommended` config, which includes React Compiler rules like `react-hooks/preserve-manual-memoization`. These rules reject `useCallback`/`useMemo` patterns that the compiler can't optimize. **Fix:** Remove manual memoization and use plain functions — the React Compiler optimizes automatically. Several React hooks rules (`purity`, `set-state-in-effect`, `immutability`) are temporarily disabled. `no-unused-vars` and `no-explicit-any` are also **off**.

**CI lint strictness:** The CI workflow lints only changed files with `--max-warnings=0`, meaning even warnings in your changed files will fail CI. The Test workflow runs `eslint .` on the entire codebase but only fails on errors. Both must pass.

**Vite plugins:** `kimi-plugin-inspect-react` (`inspectAttr()`) adds `code-path` attributes to React elements for debugging. This runs before the React plugin.

**Vite base path:** `vite.config.ts` must use `base: '/'` (not `'./'`) for SPA deep-route asset loading.

**dotenv loading:** `dotenv.config()` loads `.env` from CWD. Run server from project root (`node server/dist/index.js`), not from `server/`.

**Ollama on this VPS:** Runs in Docker mapped to host port 32778 (not default 11434). Inside Docker network, it's at `http://ollama-qtzz-ollama-1:11434`. llama3.1:8b takes 50-70s — intermittent 500s are usually timeouts, not bugs.

**Helmet CSP:** Blocks inline `onclick` handlers (`script-src-attr 'none'`). Use `addEventListener` instead.

**Sonner toast:** Installed but depends on `next-themes` which isn't usable in this Vite app. Use inline toast state instead.

**Telegram messages:** `sanitizeForTelegram()` strips markdown before sending (no `parse_mode` set). The sanitizer is the safety net since lightweight models ignore "no markdown" in the system prompt.

## Project Files

- `README.md` — Public-facing docs with Mermaid architecture, badges, feature grid
- `CONTRIBUTING.md` — Dev setup, coding standards, PR process
- `SECURITY.md` — Vulnerability reporting policy
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- `LICENSE` — MIT
- `docs/` — Public reference docs (API, DEPLOYMENT, ENV_VARS, RUNBOOK, TROUBLESHOOTING, ARCHITECTURE)
- `docs/internal/` — Internal plans, audit reports, archive (not public-facing)
- `docs/assets/` — SVG banner and visual assets
- `.github/` — CI workflows + issue/PR templates

## Environment

- `.env` is gitignored. `.env.example` is tracked with all variables documented.
- `OPENROUTER_API_KEY` — used for OpenRouter paid tier AND Moonshot/Kimi K2 (edith.ts). `OPENROUTER_FREE_API_KEY` is a separate key for the free-tier model rotation.
- `OPENAI_API_KEY` — Whisper STT + TTS for voice notes (`voice.ts`); optional.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth 2.0; optional.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth 2.0; optional.
- Production: `ai.geekspace.space` (frontend), `api.geekspace.space` (API + admin dashboard), via Caddy reverse proxy
- Demo users: alex/sarah/marcus (password: `demo123`)
- Production branch: `live-production`
- App version: `3.0.0` (in `server/src/app.ts`)
