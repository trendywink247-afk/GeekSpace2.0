# GeekSpace 2.0 — Repository Workflow Guide

> Branching strategy, CI/CD pipeline, local development setup, deployment,
> and contribution guidelines.

---

## Branch Strategy

| Branch | Purpose | Protected | Auto-deploy |
|--------|---------|-----------|-------------|
| `main` | Production-ready code | Yes | Staging (on push) |
| `staging` | Mirrors main post-staging deploy | No | — |
| `live-production` | Mirrors main post-production deploy | No | — |
| `feature/*` | Feature branches | No | — |
| `fix/*` | Bug fix branches | No | — |
| `claude/*` | AI-generated branches | No | — |

### Workflow

1. Create feature branch from `main`
2. Develop and push to feature branch
3. Open PR against `main`
4. CI runs: static checks → unit tests
5. Review and merge to `main`
6. Staging auto-deploys on merge
7. Production deploys via manual workflow dispatch

---

## CI/CD Pipeline (`.github/workflows/ci.yml`)

### Job 1: Static Checks (10 min timeout)

Runs on: PRs + pushes to `main`

| Step | Command | Notes |
|------|---------|-------|
| Lint changed files | `npx eslint --max-warnings=0 <changed>` | Only JS/TS files in diff |
| Typecheck (frontend) | `npx tsc --noEmit` | Root tsconfig |
| Typecheck (server) | `npm --prefix server run typecheck` | Server tsconfig |
| Build frontend | `npx vite build` | `VITE_TEST_MODE=true` |
| Build server | `npm --prefix server run build` | |
| Validate OpenAPI | `npx @redocly/cli lint openapi/openapi.yaml` | Continue on error |
| Audit dependencies | `npm audit --audit-level=critical` | Continue on error |

### Job 2: Unit Tests (10 min timeout, needs Job 1)

| Step | Command |
|------|---------|
| Backend tests | `npm --prefix server run test` (`TEST_MODE=true vitest run`) |
| Frontend tests | `npm test` (`vitest run`) |

### Job 3: Deploy Staging (self-hosted, on merge to main)

1. Pull latest `main`
2. Build staging container via `docker compose up -d --build staging`
3. Health check on port 3002 (30 retries, 2s interval)
4. Live at `https://staging.agentin.chat`

### Job 4: Deploy Production (self-hosted, manual dispatch only)

1. Tag previous image for rollback (`geekspace2.0-geekspace:previous`)
2. Build production container with BuildKit
3. Deploy via `docker compose up -d geekspace`
4. Sync static files to Caddy (`/srv/assets/`, `/srv/index.html`)
5. Health check on port 3001 (30 retries)
6. **Auto-rollback** on health check failure
7. Sync staging to match production
8. Prune Docker images older than 72h
9. Live at `https://ai.agentin.chat`

### Job 5: Summary (required status check)

Reports all job results to GitHub step summary.

### Job 6: Promote Branches (after production deploy)

Force-pushes `main` to `staging` and `live-production` branches.

---

## Local Development Setup

### Prerequisites

- Node.js 22+
- Docker + Docker Compose (for services)
- Git

### Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd GeekSpace2.0
npm install
cd server && npm install && cd ..

# 2. Start infrastructure services
docker compose up -d redis meilisearch qdrant

# 3. Start backend (with hot reload)
cd server && npm run dev

# 4. Start frontend (separate terminal)
npm run dev

# 5. Open http://localhost:5173
```

### Environment

Copy `.env.example` to `.env` and set required variables. Minimum for local dev:

```env
JWT_SECRET=any-dev-secret
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Most variables have sensible dev defaults. See [ENV_VARS.md](./ENV_VARS.md) for the full list.

### Dev Server Proxy

The Vite dev server proxies `/api` requests to `http://localhost:3001`. The backend
must be running for API calls to work.

---

## Pre-Push Checklist

Before pushing, run these checks:

```bash
# Lint
npm run lint

# Typecheck (both)
npx tsc --noEmit
cd server && npx tsc --noEmit && cd ..

# Unit tests
npm test                          # Frontend
cd server && npm test && cd ..    # Backend

# E2E (optional, requires running servers)
npx playwright test
```

### Common Issues

| Issue | Fix |
|-------|-----|
| Unused imports | Remove them — `noUnusedLocals` breaks Docker builds |
| Missing `.js` extension | Server uses ES modules — add `.js` to imports |
| `req.user.id` | Use `req.userId!` instead |
| `NODE_ENV=production npm install` | Skips `@types/*` — use `development` for typechecking |
| Vite chunk >600KB | Lazy-load heavy imports |

---

## Deployment

### Docker Build

```bash
# Build all services
docker compose build

# Build + deploy specific service
docker compose up -d --build geekspace

# Staging
docker compose up -d --build staging
```

### Caddy Reverse Proxy

Caddy (`caddy/` directory) handles:
- HTTPS termination and certificates
- Security headers (CSP, HSTS)
- Static file serving (`/srv/assets/`)
- API proxy to port 3001
- Access gate (if `GATE_PASSWORD_HASH` set)

### Rollback

If production deploy fails:

```bash
# Automatic rollback (in CI):
# Previous image tagged as geekspace2.0-geekspace:previous
docker tag geekspace2.0-geekspace:previous geekspace2.0-geekspace:latest
docker compose up -d geekspace
```

---

## Adding a New Module

1. Create directory: `server/src/modules/<name>/`
2. Create files:
   - `index.ts` — Export `AppModule` with `name` and `registerRoutes`
   - `types.ts` — Domain types
   - `routes.ts` or `routes/` — Express routers
   - `services.ts` or `services/` — Business logic
   - `swagger.ts` — OpenAPI annotations
3. Register in `server/src/app.ts`:
   ```typescript
   import { module as myModule } from './modules/<name>/index.js';
   // Add to modules array
   ```
4. Add DB tables to `server/src/db/index.ts` if needed
5. Add tests in `server/src/modules/<name>/__tests__/`

---

## Testing

### Test Layers

| Layer | Command | Location |
|-------|---------|----------|
| Frontend unit | `npm test` | `tests/`, `src/**/__tests__/` |
| Backend unit | `cd server && npm test` | `server/src/modules/*/__tests__/` |
| E2E | `npx playwright test` | `e2e/` |
| Smoke | `./scripts/smoke-test.sh` | Shell script, curl-based |

### Test Mode

Backend tests run with `TEST_MODE=true`, which:
- Mocks LLM calls (returns canned responses)
- Mocks Telegram webhook delivery
- Enables `/api/test/reset` and `/api/test/seed` endpoints

### E2E Test Setup

Playwright uses:
- **Desktop Chrome** and **Mobile Pixel 5** viewports
- Shared auth state via `playwright/.auth/user.json`
- Test fixtures in `e2e/base.ts` (console capture, user seeding, state reset)
- Auth setup in `e2e/auth.setup.ts` (health check → reset → seed → login)

### Coverage

```bash
npm run test:coverage                    # Frontend
cd server && npm run test:coverage       # Backend
```

---

## Operational Scripts

| Script | Purpose |
|--------|---------|
| `scripts/focus-module.sh <module>` | Focus Claude on single module (modifies .claudeignore) |
| `scripts/health-check.sh` | Quick health probe |
| `scripts/smoke-test.sh` | Full endpoint validation |
| `scripts/deploy-and-test.sh` | CI/CD deployment + testing |
| `scripts/repair.sh` | Database repair utilities |
| `scripts/load-test.sh` | Load testing |
| `scripts/bootstrap.sh` | Initial project setup |
| `scripts/audit-all.sh` | Full codebase audit |

---

## Related Documentation

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — Detailed development guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment procedures
- [ENV_VARS.md](./ENV_VARS.md) — Environment variable reference
- [TESTING.md](./TESTING.md) — Testing guide
- [INTEGRATIONS.md](./INTEGRATIONS.md) — External service integration map
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — Frontend design system reference
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guidelines
