# GeekSpace 2.0 — Integrity Baseline Report

**Date:** 2026-02-19
**Branch:** `claude/weebo-ecosystem-k2_5`
**Audited by:** Claude Code (Kimi K2.5)
**Scope:** Full codebase diagnostic before Weebo Ecosystem implementation

---

## Executive Summary

| Category | Status |
|----------|--------|
| Frontend Build | PASS (with warnings) |
| Backend Build | PASS |
| Docker Config | PASS |
| ESLint | FAIL (config error) |
| Type Safety | PASS |
| Critical Issues | 5 found |
| High Issues | 5 found |
| Medium Issues | 12 found |

---

## Build & Lint Results

### Frontend Build
```bash
$ npm run build
> tsc -b && vite build
✓ 2523 modules transformed.
✓ built in 11.20s
```
**Status:** PASS

**Warnings:**
- Chunk size warnings (>500KB): `AreaChart` (420KB), `index` (577KB)
- NODE_ENV warning: `.env` contains `NODE_ENV=production` which Vite doesn't support

### Backend Build
```bash
$ cd server && npm run build
> tsc
```
**Status:** PASS (clean compile, no errors)

### ESLint
```bash
$ npm run lint
TypeError: Error while loading rule '@typescript-eslint/no-unused-expressions'
Cannot read properties of undefined (reading 'allowShortCircuit')
```
**Status:** FAIL — ESLint config has incompatibility with @typescript-eslint plugin

### Docker Config
```bash
$ docker compose config
name: geekspace20
services:
  geekspace:
    build: ...
```
**Status:** PASS (valid configuration)

---

## Critical Issues (P0 — Must Fix Before Feature Work)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| C1 | ESLint config broken | `eslint.config.js` | Cannot run linting, potential quality issues |
| C2 | API contract mismatch: Pico planTask response | `api.ts:372-376` vs `pico.ts:106-112` | Frontend expects `tasks/creditCost`, backend sends `planned/credits_used` |
| C3 | Missing WhatsApp implementation | `message-router.ts:338-341` | WhatsApp channel declared but not implemented |
| C4 | Health stream SSE unauthenticated | `health.ts:55` | Exposes server metrics publicly |
| C5 | n8n webhook open without secret | `webhooks.ts:263-272` | Security risk if N8N_WEBHOOK_SECRET not set |

---

## High Issues (P1 — Fix During Implementation)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| H1 | `automation_logs` table missing FK | `automations-engine.ts:322` | Orphan rows on user delete |
| H2 | Demo login sets fake 'demo-token' | `authStore.ts:132-141` | Security risk in dev mode |
| H3 | Streaming endpoint not rate limited | `index.ts:103` | `/api/agent/chat/stream` not covered by chat rate limiter |
| H4 | 4 routes missing Zod validation | `billing.ts:33`, `users.ts:74`, etc. | Input validation gaps |
| H5 | 8 empty `.catch(() => {})` blocks | Multiple frontend pages | Silent error swallowing |

---

## Medium Issues (P2 — Address During Polish)

| ID | Issue | Location | Recommended Fix |
|----|-------|----------|-----------------|
| M1 | Missing index on `installed_recipes.user_id` | `db/index.ts` | Add CREATE INDEX |
| M2 | Missing composite index on `automations(trigger_type, enabled)` | `db/index.ts` | Add CREATE INDEX |
| M3 | Blanket `catch {}` in migrations | `db/index.ts:271+` | Log migration errors |
| M4 | Schema fragmented across 4 files | Multiple | Consider consolidation |
| M5 | API: `updateNotificationEmail` wrong path | `api.ts:206` | Change to `/api/users/` |
| M6 | 401 interceptor clears token on any 401 | `api.ts:56-62` | Distinguish auth vs other 401s |
| M7 | PUT missing from CORS methods | `index.ts:61` | Add 'PUT' to methods array |
| M8 | Usage events pagination mismatch | `api.ts:155` vs `usage.ts:161` | Align param names |
| M9 | 5 optimistic updates diverge on failure | `dashboardStore.ts` | Add rollback on error |
| M10 | 6 fire-and-forget catches | `agent.ts`, `message-router.ts` | Add error logging |
| M11 | Model default mismatch | `config.ts`, `docker-compose.yml` | Align all defaults |
| M12 | Large WAL file (646KB > 536KB main DB) | Runtime | Add WAL checkpoint |

---

## Existing Audit Backlog (from docs/AUDIT-2026-02-17.md)

Consolidated from previous audit:

### Already Fixed (in current branch)
- [x] Require() bug in agent.ts — ESM import fixed
- [x] Version bump to 3.0.0 in index.ts

### Still Open
- [ ] Post-auth navigate() missing `{ replace: true }` (4 calls in LoginPage.tsx)
- [ ] Post-onboarding navigate missing `{ replace: true }` (OnboardingPage.tsx:54)
- [ ] Dead `?redirect=` query params (LandingPage.tsx)
- [ ] No onboarding enforcement on /dashboard route
- [ ] Logout navigate should use `{ replace: true }`

---

## Environment Configuration

### Current .env Status
| Variable | Status |
|----------|--------|
| JWT_SECRET | Set (64-byte hex) |
| ENCRYPTION_KEY | Set (32-byte hex) |
| PICOCLAW_ENABLED | true |
| BRIDGE_ENABLED | true |
| TELEGRAM_BOT_TOKEN | Set |
| WHATSAPP_* | NOT IMPLEMENTED |

### Docker Environment (from docker compose config)
All required production variables are configured correctly.

---

## Plan of Action

### P0 (Pre-Feature — Must Fix)
1. **Fix ESLint configuration** — Update @typescript-eslint plugin or config
2. **Fix API contract mismatch** — Align pico planTask response shape
3. **Add authentication to health stream** — Protect `/api/admin/stream`
4. **Secure n8n webhook** — Enforce N8N_WEBHOOK_SECRET validation
5. **Document WhatsApp gap** — Note missing implementation for Phase C

### P1 (During Phase A — Generic Fixes)
1. Fix navigation replace issues (4 locations)
2. Add FK to automation_logs table
3. Add rate limiting to streaming endpoint
4. Add Zod validation to 4 missing routes
5. Fix error handling (empty catches)

### P2 (During Polish Phase)
1. Add missing database indexes
2. Fix optimistic update rollback
3. Align model defaults
4. Add WAL checkpoint handling

---

## Architecture Observations

### Current Routing Logic (as understood)
```
User Message → Intent Classify → Provider Selection
  ├── simple → Ollama (local)
  ├── automation → PicoClaw
  ├── coding/planning/complex → OpenRouter Free → OpenRouter Paid → Edith (Moonshot)
  └── fallback → builtin
```

### Current Token Budget System
- Credits per plan: Free (5K), Intro (100K), Monthly (100K), Half-Year (700K), Yearly (1.5M)
- No monthly token budget enforcement yet
- No warnings at 70/90/100% thresholds

### Current Agent Slots
- Free: 1 agent (slot 1)
- Paid: Up to 3 agents
- Plan enforcement in code but not strictly tied to subscription tier

### Telegram Integration
- Fully implemented
- Bot token configured
- Link/unlink/status endpoints working
- Message routing through message-router.ts

### WhatsApp Integration
- Types defined (`whatsapp` channel in NormalizedMessage)
- Router has placeholder (line 338-341)
- **NOT IMPLEMENTED** — needs full Phase C work

---

## Files to Touch (Comprehensive)

### Phase A (Fixes)
- `server/src/index.ts` — CORS methods, rate limiting
- `server/src/routes/health.ts` — Auth on stream endpoint
- `server/src/routes/webhooks.ts` — n8n secret validation
- `server/src/routes/pico.ts` — Fix response shape
- `server/src/db/index.ts` — Add FK, indexes
- `src/services/api.ts` — Fix navigation, error handling
- `src/pages/LoginPage.tsx` — Add replace: true
- `src/dashboard/DashboardApp.tsx` — Logout replace

### Phase B (Weebo Orchestrator)
- `server/src/services/llm.ts` — Token budget, tier routing
- `server/src/services/pico-fleet.ts` — Plan enforcement
- `server/src/db/index.ts` — Token usage tables
- `server/src/prompts/personalities.ts` — Soul instructions
- `soul.md` (create) — Documentation

### Phase C (Connections)
- `server/src/services/whatsapp.ts` (create)
- `server/src/routes/integrations.ts` — WhatsApp endpoints
- `src/dashboard/pages/ConnectionsPage.tsx` — WhatsApp UI

### Phase D (Portfolio)
- `server/src/routes/portfolio.ts` — Magic generate, social chat
- `server/src/services/memory.ts` — Portfolio suggestions
- `src/dashboard/pages/PortfolioPage.tsx` — Generate buttons
- `src/dashboard/pages/DirectoryPage.tsx` — Chat with agent

### Phase E (Automations)
- `server/src/services/recipes.ts` — Expand recipes
- `server/src/routes/recipes.ts` — CRUD endpoints
- `src/dashboard/pages/RecipesPage.tsx` — Recipe hub
- `scripts/smoke/` (create) — Smoke tests

### Phase F (Billing)
- `src/dashboard/pages/BillingPage.tsx` — Sale UI

### Phase G (Mobile UI)
- All `src/dashboard/pages/*.tsx` — Mobile polish
- `src/dashboard/DashboardApp.tsx` — Safe area padding

---

## Dependencies

### Current Versions
- Node.js: 20 (Alpine in Docker)
- React: 19
- TypeScript: 5.7
- Vite: 7.3.0
- Express: 4.21.0
- better-sqlite3: 12.6.2

### Security Vulnerabilities (from npm audit)
- Frontend: 11 vulnerabilities (1 moderate, 10 high)
- Backend: 1 low severity
**Recommendation:** Run `npm audit fix` after feature work

---

## Sign-off

This baseline establishes the current state of the codebase before beginning the Weebo Ecosystem major update. All P0 issues must be resolved before proceeding to feature implementation.

**Next Step:** Proceed to Phase A — Generic Fixes
