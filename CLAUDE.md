# CLAUDE.md — GeekSpace 2.0

This file provides guidance to Claude Code when working with this repository.

---

## 🚀 Autonomous Engineering Mode

Claude operates as the **autonomous senior engineer** for GeekSpace 2.0, working in safe phases with minimal user interruption.

### Core Goals
- Evolve the product in **phases** (4–5 improvements per phase, balanced across fix/UX/hardening/ops/feature)
- Preserve core GeekSpace logic (Weebo / PicoClaw / Edith / Jarvis behavior)
- Ship verifiable improvements with tests, PRs, and handoff notes
- Stay session-safe (context-aware; write handoff before limits)

### Never Do This
- Do NOT break core routing/orchestration behavior unless explicitly asked
- Do NOT commit secrets, tokens, `.env`, or credentials
- Do NOT force-push shared branches unless explicitly instructed
- Do NOT do destructive DB/schema changes without explicit approval

### Operating Mode (MANDATORY)
1. Read `ops/AI_HANDOFF.md` at session start
2. Research impacted files before touching anything
3. Propose plan: scope, risks, files, verification
4. Implement in small batches
5. Run required checks before every commit
6. Commit + open/update PR
7. Update `ops/AI_HANDOFF.md` before context limits

### Phase Definition of Done
- [ ] Code implemented
- [ ] Required verification passed
- [ ] No obvious regression in touched flows
- [ ] PR opened/updated (draft allowed)
- [ ] `ops/AI_HANDOFF.md` updated
- [ ] Next phase proposed

### Autonomous Phase Workflow
Each phase has 4–5 improvements, balanced:
- 1 critical bug fix / reliability improvement
- 1 UI/UX refinement
- 1 edge-case hardening
- 1 dev/ops improvement (tests/logging/docs/CI/observability)
- 1 optional small feature (if capacity allows)

### Session Budget (Context Awareness)
- ~65% context: compact and summarize current work
- ~80% context: stop expanding scope; finish current task only
- ~90% context: write handoff immediately, push, update PR

### Required Verification by Change Type
- **Frontend/UI:** `npm run lint && npx tsc --noEmit && npm run build`
- **Backend/API:** `cd server && npm test && npx tsc --noEmit && npm run build`
- **Auth/routing/critical flows:** run relevant Playwright spec(s)
- **Infra/runtime:** `docker compose ps` + logs + health endpoint

### Git / PR Workflow
- Feature branches: `ai/phase-YYYYMMDD-short-topic`
- Never commit directly to `main` / `live-production` unless explicitly instructed
- Commit style: `fix(scope): message`, `feat(scope): message`, `refactor(scope): message`
- Each phase → draft PR with: summary, risks/rollback, verification evidence, remaining items

### Mandatory AI Working Files (ops/)
```
ops/AI_BACKLOG.md       — prioritized tasks
ops/AI_PHASE_PLAN.md    — current phase (4–5 items)
ops/AI_HANDOFF.md       — progress + exact resume steps
ops/AI_LESSONS.md       — recurring bugs / decisions / gotchas
ops/AI_RELEASE_NOTES.md — user-facing release notes
```

### Ops Scripts
```bash
./ops/claude-cycle.sh          # session start + checkpoint reminders
./ops/capture-handoff.sh       # write/update handoff snapshot
./ops/phase-gate.sh            # full verification gate (lint + typecheck + build + test)
./ops/phase-gate.sh --skip-e2e # skip E2E for speed
./ops/pr-phase.sh              # push branch + create/update draft PR
```

### Recommended Session Start
```bash
cd ~/GeekSpace2.0
git worktree list
./ops/claude-cycle.sh          # or: cat ops/AI_HANDOFF.md
cat ops/AI_PHASE_PLAN.md
cd server && npm test          # verify baseline
```

### PicoClaw Coordination Contract
PicoClaw supports: backlog orchestration, checkpoint reminders, health monitoring, release checklist.
Claude is responsible for: architecture decisions, code changes, verification evidence, PR quality.

---

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

**Port conflicts:** Kill stale processes with `fuser -k 3001/tcp` before starting.

---

## CI/CD Pipelines

Two GitHub Actions workflows run on push/PR to `main`, `master`, `live-production`:

**CI workflow** (`ci.yml`): Static checks → Unit tests → E2E tests → Smoke tests. Lints **only changed files** with `--max-warnings=0` (warnings fail CI). Also runs typecheck + build for both root and server.

**Test workflow** (`test.yml`): Full lint (`eslint .`), typecheck, unit tests, E2E tests, smoke tests. Errors fail it; warnings alone do not.

**Key difference:** CI lints only changed files but treats warnings as errors. Test workflow lints everything but only fails on errors. Both must pass before merging.

---

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
- `server/src/services/edith.ts` — Direct Moonshot/Kimi K2 HTTP client (OpenAI-compatible, 120s timeout, 1 retry)
- `server/src/services/pico-kimi-bridge.ts` — Complexity classifier, routes trivial→PicoClaw, complex→Kimi
- `server/src/services/automations-engine.ts` — cron/webhook/health_down triggers
- `server/src/services/message-router.ts` — Unified Telegram/WhatsApp handler
- `server/src/services/action-parser.ts` — Extracts `<<<ACTION {...} ACTION>>>` blocks (Zod-validated)
- `server/src/services/action-executor.ts` — Executes parsed actions
- `server/src/prompts/openclaw-system.ts` — Main agent identity, compact variant
- `server/src/prompts/personalities.ts` — Edith (CTO), Jarvis (butler), Weebo (enthusiastic)
- `server/src/routes/oauth.ts` — Google + GitHub OAuth 2.0

### Frontend Layer Architecture
```
App.tsx (BrowserRouter) → Auth gate (Zustand) → DashboardApp (sidebar + lazy pages)
  → Page components → Zustand store actions → API service (Axios + JWT interceptor)
```

**Path alias:** `@/*` → `./src/*`. Use `import { X } from '@/components/...'`.

**Key frontend files:**
- `src/App.tsx` — Root router, auth/onboarding gate
- `src/stores/authStore.ts` — User, token, onboarding state (persisted to localStorage)
- `src/stores/dashboardStore.ts` — All dashboard data, parallel fetch with `Promise.allSettled`
- `src/services/api.ts` — Typed Axios wrapper, all API services, JWT interceptor
- `src/dashboard/DashboardApp.tsx` — Sidebar layout (desktop) / bottom nav (mobile), lazy-loaded pages
- `src/types/index.ts` — All TypeScript interfaces

**shadcn/ui:** New York style. Add components via `npx shadcn@latest add <component>`. Components in `src/components/ui/`.

### Action System (11 tools)
Tools: `generate_code`, `generate_image`, `portfolio_add_project`, `portfolio_update_bio`, `portfolio_update_skills`, `portfolio_remove_project`, `portfolio_update_theme`, `send_email`, `set_reminder`, `crawl_url`, `trigger_workflow`. Schemas in `action-parser.ts`, executed in `action-executor.ts`.

### LLM Routing
1. `buildSystemPrompt()` combines: identity + personality + Pico context + memory + user session
2. `classifyIntent()` determines: simple, coding, planning, automation, complex
3. `routeChat()` selects provider: Ollama (free) → OpenRouter-free → OpenRouter paid → Moonshot
4. Response parsed for `<<<ACTION>>>` blocks → executed
5. Credits deducted from subscription after each call

---

## Testing

### Unit Tests (Vitest)
Tests in `server/src/test/api/*.test.ts`. Run via `cd server && npm test`.

- `setup.ts` — Creates temp DB, exports `resetDatabase()`, `createTestUser()`, `generateTestToken()`
- `test-mode.ts` — `TEST_MODE=true` mocks LLM/Telegram/PicoClaw with deterministic responses

Tests run with `pool: 'forks'` and `singleFork: true` (sequential) to avoid SQLite conflicts.

### E2E Tests (Playwright)
Tests in `e2e/*.spec.ts`. Auth state saved to `playwright/.auth/user.json`. CI uses chromium only.

### Docker Build
Multi-stage (`node:20-alpine`): installs deps → builds frontend + server → production image with `npm ci --omit=dev`. Runs as non-root `node` user via `pm2-runtime` (2 cluster workers).

---

## Critical Gotchas

**Database:** THREE DB files can exist. Docker always uses `/app/data/geekspace.db` (volume). `server/data/geekspace.db` is for local dev. Direct DB changes must go to Docker volume for immediate production effect.

**TypeScript strictness:** `tsconfig.app.json` (frontend) enforces `noUnusedLocals` and `noUnusedParameters`. Docker builds fail on unused imports. Verify every import is used in JSX AND data arrays.

**ESLint + React Compiler:** Rules reject `useCallback`/`useMemo` patterns the compiler can't optimize. Remove manual memoization and use plain functions. `no-unused-vars` and `no-explicit-any` are **off**.

**CI lint strictness:** Changed-file lint with `--max-warnings=0` — even warnings fail CI. Never add new warnings to touched files.

**Vite base path:** Must use `base: '/'` for SPA deep-route asset loading.

**dotenv loading:** `dotenv.config()` loads `.env` from CWD. Run server from project root, not from `server/`.

**Ollama on this VPS:** Runs at host port 32778 (not 11434). Inside Docker network: `http://ollama-qtzz-ollama-1:11434`. llama3.1:8b takes 50–70s cold start — intermittent 500s are usually timeouts, not bugs.

**Helmet CSP:** Blocks inline `onclick`. Use `addEventListener` instead.

**Telegram messages:** `sanitizeForTelegram()` strips markdown. Always sanitize — don't rely on model instructions.

**Package.json duplication:** Root `package.json` is a copy of `server/package.json`. Frontend deps live in root `package-lock.json`.

---

## Environment

- `.env` is gitignored. `.env.example` tracked with all variables documented.
- `OPENROUTER_API_KEY` — OpenRouter paid + Moonshot/Kimi K2 (edith.ts). `OPENROUTER_FREE_API_KEY` — free tier.
- `OPENAI_API_KEY` — Whisper STT + TTS; optional.
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — Google OAuth 2.0; optional.
- `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` — GitHub OAuth 2.0; optional.
- Production: `ai.geekspace.space` (frontend), `api.geekspace.space` (API + admin)
- Demo users: alex/sarah/marcus (password: `demo123`)
- Production branch: `live-production`
- App version: `3.0.0` (in `server/src/app.ts`)

---

## Project Files

- `README.md` — Public docs with architecture, badges, feature grid
- `CONTRIBUTING.md` — Dev setup, coding standards, PR process
- `SECURITY.md` — Vulnerability reporting policy
- `docs/` — Public reference docs (API, DEPLOYMENT, ENV_VARS, RUNBOOK, TROUBLESHOOTING)
- `docs/internal/` — Internal plans, audit reports (not public-facing)
- `ops/` — AI working files + automation scripts
- `.github/` — CI workflows + issue/PR templates
