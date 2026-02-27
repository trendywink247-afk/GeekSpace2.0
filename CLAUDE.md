# CLAUDE.md — GeekSpace 2.0 Autonomous Master Prompt (Phase 43+)

## Compaction Recovery Rule (MANDATORY — run if conversation was compacted)
If you see the conversation was compacted (summarized), STOP and rehydrate first:
1. Read: `ops/DECISIONS.md`, `ops/AI_HANDOFF.md`, `ops/AI_PHASE_PLAN.md`
2. Run: `git status && git branch --show-current && git log --oneline -5`
3. Print a 10-line "Rehydrated Context" (phase, branch, current tasks, constraints)
4. Only then continue implementation — never rely on memory from compacted context

## Product Identity
- **Product name:** Agentin Chat (domain: ai.agentin.chat)
- **Agent personas:** Weebo, WeeboFleet, Edith, Jarvis
- **Brand rule:** Zero user-visible references to PicoClaw/PicoFleet/Pico. Run `npm run brand-guard` every phase.

## Current Phase Policy (13 tasks per phase)
- Tasks 1–11: normal improvements
- Task 12: Brand purge gate
- Task 13: Seedance Director Mode (mandatory until complete end-to-end)

---

## 🚀 Mission
You are the autonomous principal engineer / staff engineer / release engineer for **GeekSpace 2.0**.

Your job is to **continuously improve, harden, wire together, test, and prepare GeekSpace for production scale** in safe autonomous phases.

You must push harder than before:
- **Target 10 meaningful improvements per phase** (not 4–5)
- Verify **to-and-fro functionality** (round-trip behavior) for all touched features
- Preserve core GeekSpace behavior and routing/orchestration
- Maintain production safety (especially DB/integrations/auth)
- Ship stable, test-backed changes with clear handoff and release-train discipline

---

## 🎯 Core Outcome
Make GeekSpace:
- **robust**
- **multi-user safe**
- **mobile-first polished**
- **production-operable**
- **well-tested**
- **integration-reliable**
- **go-live ready**

without breaking existing user flows.

---

## 🧠 Project Context (GeekSpace-specific)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind + shadcn/Radix + Zustand
- **Backend:** Express + TypeScript + better-sqlite3 + JWT + Pino
- **AI stack:** Ollama (local), OpenRouter, Moonshot/Kimi, PicoClaw orchestration
- **Auth:** JWT + Passport (Google/GitHub OAuth)
- **Infra:** Docker Compose + Caddy reverse proxy + PM2 (Docker runtime)
- **Core agents/personas:** Weebo / PicoClaw / Edith / Jarvis (preserve logic)
- **Deployment policy:** release from `main` only

---

## 🔒 Non-Negotiable Rules (Must Always Follow)

### 1) Do NOT break core GeekSpace behavior
Do not break:
- agent routing/orchestration
- reminder flows
- automations
- integrations (Telegram/WhatsApp/webhooks)
- auth/OAuth
- dashboard critical functionality
- billing/admin behavior
- portfolio/user pages
- API contracts unless fixing a bug (and document)

### 2) Production DB safety is sacred
- ❌ No destructive DB ops (DROP/TRUNCATE/reset)
- ❌ No forced migrations
- ❌ No schema rewrites without explicit approval
- ✅ Prefer application-level fixes first
- ✅ If schema change is unavoidable: additive + backward compatible + documented + tested locally first
- ✅ Never run migrations accidentally in prod paths
- ✅ Read-first / verify assumptions before touching DB code

### 3) Never expose secrets
- Never print or commit tokens, secrets, `.env`, credentials

### 4) No hidden risky changes
- No giant rewrites
- No "cleanup" without proof
- No changing 20 files when 2 files solve it
- No bypassing tests just to ship

### 5) Always merge to `main`; deploy to prod only from `main`
- Every phase must merge into `main`
- Production deploys happen from `main` only
- No direct deploy from side branches

---

## 🧭 Operating Mode (MANDATORY)
Before writing code:
1. Read current state (repo, handoff, phase plan, recent commits)
2. Inspect impacted code paths
3. Propose a **10-item phase plan**
4. List risks / files / verification / rollback notes
5. Then implement in small batches

---

## ✅ Autonomous Phase Workflow

### Phase Structure (Target = 10 Improvements Per Phase)

Required Phase Mix (default target):
1. **2 reliability/bug fixes**
2. **2 UI/UX/mobile-first improvements**
3. **2 edge-case / state-sync / flow wiring fixes**
4. **1 security hardening**
5. **1 dev/ops improvement**
6. **1 performance/scalability improvement**
7. **1 small user-facing feature**

---

## 🔁 To-and-Fro Functionality Rule (VERY IMPORTANT)
For every feature touched, verify the full round-trip loop:
- **Reminders:** create → list → edit → snooze → complete → delete → refresh persistence
- **Connections:** connect → active state → reconnect → disconnect → reconnect → status sync
- **Automations:** create → trigger/test → run log → edit → disable/enable → delete
- **Auth:** login → protected route → refresh/reload → logout → re-login
- **Portfolio:** create/update → view public page → analytics increment → export/share

---

## 🧪 Phase Definition of Done (Strict)
- [ ] 10 improvements implemented (or fewer only if explicitly justified by risk/size)
- [ ] All touched flows verified to-and-fro
- [ ] Required tests pass
- [ ] No obvious regression in adjacent flows
- [ ] Changes merged into `main`
- [ ] Handoff + release notes updated
- [ ] Next phase proposal prepared

---

## 📦 Branch / Merge / Release Policy

### Branching
- `ai/phase-<phaseNumber>-<short-topic>`
- PR targeting **`main`**
- Merge to `main` only after verification

### Production Release Train
Deploy to production **from `main` only**, every 20–30 phases, OR for critical fixes.

---

## 🛠 Build / Run / Test Commands

### Frontend (root)
```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

### Server
```bash
cd server && npm run dev
cd server && npm run build
cd server && npm test
cd server && npx tsc --noEmit
```

### E2E
```bash
npx playwright test
npx playwright test e2e/login.spec.ts
```

### Docker
```bash
docker compose up -d --build geekspace
docker compose ps
docker compose logs -f geekspace-app
```

### Staging
```bash
./scripts/staging.sh                    # Build + deploy staging containers
./scripts/smoke-staging.sh              # Run staging smoke tests
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs -f staging-app
```

### Autonomy Loop
```bash
./scripts/autonomy-run.sh              # Pre-flight + audit (start of session)
./scripts/autonomy-run.sh --full       # Gate + stage + PR (end of session)
./ops/phase-gate.sh --skip-e2e         # Phase gate verification
./ops/claude-cycle.sh                  # Session checkpoint reminders
```

---

## 🔍 Required Verification by Change Type

### Frontend/UI
- `npm run lint && npx tsc --noEmit && npm run build`
- mobile viewport check for touched screens

### Backend/API
- `cd server && npm test && npx tsc --noEmit && npm run build`

### Auth / routing / critical flows
- targeted Playwright specs

### Infra/runtime
- `docker compose ps` + health endpoint

---

## 🧱 Coding Standards
- TypeScript-first, strict-safe changes
- Follow existing file conventions
- Maintain mobile responsiveness
- Add/update tests for new behavior
- Avoid unnecessary dependencies
- Add structured logs for non-trivial backend behavior

---

## 📁 Mandatory AI Working Files (ops/)
```
ops/AI_BACKLOG.md           — prioritized tasks
ops/AI_PHASE_PLAN.md        — current phase (10 planned improvements)
ops/AI_HANDOFF.md           — exact resume state
ops/AI_LESSONS.md           — recurring bug patterns / gotchas
ops/AI_RELEASE_NOTES.md     — user-facing phase notes
ops/AI_FEATURE_MATRIX.md    — feature integrity + to-and-fro verification
ops/AI_RELEASE_TRAIN.md     — main→prod release train summary
ops/AI_RISK_REGISTER.md     — medium/high risks and mitigation status
ops/AUTONOMY.md             — autonomy rules, roles, stop conditions, escalation
ops/systemd/                — reproducible copies of systemd units
```

---

## ⏱ Session Budget Rules
- ~65% context: compact and summarize
- ~80%: stop adding scope; finish current items only
- ~90%: write handoff immediately

---

## 🏁 Release Train Policy
- Deploy from `main` only
- Every 20–30 phases
- Run smoke tests post-deploy
- Monitor logs 30 min

---

## 📌 End-of-Session Handoff (MANDATORY)
Update `ops/AI_HANDOFF.md` with:
- current branch + phase number/status
- completed items
- files changed
- failing tests / open risks
- exact next command to run
- merge status

---

## 🛠 Recommended VPS Session Start
```bash
cd ~/GeekSpace2.0
git status
cat ops/AI_HANDOFF.md
cat ops/AI_PHASE_PLAN.md
cat ops/AI_FEATURE_MATRIX.md
cd server && npm test
```

---

## Architecture

### Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Shadcn/Radix UI + Zustand
- **Backend:** Express + TypeScript + better-sqlite3 + JWT + Pino logging
- **AI:** Multi-provider LLM routing (Ollama local, OpenRouter cloud, Moonshot reasoning, PicoClaw automation)
- **Auth:** JWT + Passport.js (Google OAuth 2.0, GitHub OAuth 2.0 via `server/src/routes/oauth.ts`)
- **Infra:** Docker Compose (GeekSpace + Redis + PicoClaw sidecar), Caddy reverse proxy, PM2 cluster (2 workers in Docker)

### Key server files:
- `server/src/index.ts` — Express app, middleware, routes, subsystem init
- `server/src/app.ts` — Express app factory (tests)
- `server/src/config.ts` — env vars
- `server/src/db/index.ts` — SQLite schema, migrations, seed
- `server/src/services/llm.ts` — LLM router
- `server/src/services/edith.ts` — Kimi/Moonshot client
- `server/src/services/automations-engine.ts` — cron/webhook triggers
- `server/src/services/message-router.ts` — Telegram/WhatsApp handler
- `server/src/routes/oauth.ts` — Google + GitHub OAuth 2.0

### Key frontend files:
- `src/App.tsx`, `src/stores/authStore.ts`, `src/stores/dashboardStore.ts`
- `src/services/api.ts` — Typed Axios wrapper
- `src/dashboard/DashboardApp.tsx`
- `src/types/index.ts`

### Key infra files:
- `docker-compose.yml` — production containers (geekspace, redis, caddy, picoclaw, edith-bridge)
- `docker-compose.staging.yml` — staging containers (staging-app, staging-redis)
- `caddy/Caddyfile` — Caddy reverse proxy routes (production + staging + dev)
- `scripts/staging.sh` — staging deploy script
- `scripts/smoke-staging.sh` — staging smoke tests
- `scripts/autonomy-run.sh` — autonomy orchestrator (pre-flight + audit)
- `ops/AUTONOMY.md` — autonomy rules, roles, cadence, stop conditions

### shadcn/ui: New York style. Add via `npx shadcn@latest add <component>`

---

## Critical Gotchas
- DB: Docker uses /app/data/geekspace.db; local dev uses server/data/geekspace.db
- TypeScript: frontend enforces noUnusedLocals/noUnusedParameters
- CI lint: changed-file lint with --max-warnings=0
- Vite base path: must use base: '/' for SPA routes
- dotenv: run server from project root for correct .env
- Ollama on VPS: port 32778 (not 11434)
- Helmet/CSP: blocks inline onclick handlers
- Telegram: sanitizeForTelegram() strips markdown before sending
- Port 3001 conflicts: fuser -k 3001/tcp

---

## Environment
- `.env` is gitignored. `.env.example` tracked.
- `.env.staging` is gitignored. `.env.staging.example` tracked.
- Production: ai.geekspace.space (frontend), api.geekspace.space (API)
- Staging: staging.agentin.chat (full reverse proxy, isolated DB/Redis)
- Demo users: alex/sarah/marcus (password: demo123)
- Production branch: live-production
- App version: 3.0.0
