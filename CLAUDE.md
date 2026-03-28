# GeekSpace 2.0 — Claude Code Instructions

## Architecture

Modular monolith with 18 domain modules in `server/src/modules/`. Each module has:
- `index.ts` — barrel exports + `AppModule` (registerRoutes, initialize, shutdown)
- `types.ts` — domain types
- `swagger.ts` — OpenAPI JSDoc annotations
- `routes.ts` or `routes/` — Express routers
- `services.ts` or `services/` — business logic
- `repositories/` — DB query abstractions (some modules)

Shared infrastructure lives in `server/src/shared/` (module.ts, swagger.ts).

Some old `routes/`, `services/` files remain as thin re-export shims. Safe shims have been removed; remaining ones are still imported by module barrel exports.

## Agentic Experience (v3.3)

The agent module (`server/src/modules/agent/`) is the core. Key subsystems:

### Goal System
- `services/goal-service.ts` — CRUD + AI planning + autonomous step execution
- `routes/goals.ts` — REST API at `/api/agent/goals` + `/api/agent/workspace`
- `types/goals.ts` — Goal, GoalStep, GoalEvent, WorkspaceArtifact types
- DB tables: `goals`, `goal_steps`, `goal_events`, `workspace_artifacts`, `delegation_log`

### Delegation Pipeline
- `services/delegation-pipeline.ts` — Inter-agent handoff with chain delegation
- Agents detect when a task needs a specialist and delegate autonomously
- Full audit trail in `delegation_log` table

### Deep Reasoning Engine
- `services/deep-reasoning.ts` — Enhanced ReAct with plan-then-execute + self-reflection
- 10 iterations (vs 5 in standard ReAct), mid-loop delegation detection
- Auto-routes for complex queries via `classifyMessageComplexity()`

### Proactive Goal Engine
- `services/proactive-goals.ts` — Background scheduler (30min cycles)
- Auto-executes pending goal steps, nudges stale goals, sends daily summaries
- Respects user autonomy level: manual | suggest | semi_auto | full_auto

### Notifications
- `services/agent-notifications.ts` — SSE + Telegram + in-app bell
- `routes/notifications.ts` — REST API at `/api/agent/notifications`
- Honors `notif_agents` preference + quiet hours (timezone-aware)

## Module Focus Workflow

To reduce context when working on a single module:

```bash
./scripts/focus-module.sh agent      # Focus Claude on agent module
./scripts/focus-module.sh billing    # Focus on billing
./scripts/focus-module.sh reset      # Show everything again
```

This modifies `.claudeignore` to hide other modules. Restart Claude Code after running.

## Key Files

- `server/src/app.ts` — Composition root, mounts all 18 modules
- `server/src/index.ts` — Server startup, scheduler init, graceful shutdown
- `server/src/config.ts` — Environment config
- `server/src/db/index.ts` — SQLite schema (centralized, not split per module)
- `server/src/modules/agent/services/llm.ts` — 7-tier LLM router
- `server/src/modules/agent/services/react-loop.ts` — Standard ReAct loop (5 iterations)
- `server/src/modules/agent/services/deep-reasoning.ts` — Deep reasoning (10 iterations)
- `server/src/modules/agent/services/goal-service.ts` — Goal system core
- `server/src/modules/agent/services/delegation-pipeline.ts` — Agent-to-agent delegation
- `server/src/modules/agent/services/message-router.ts` — Unified channel message handling

## TypeScript

- `NODE_ENV=production` skips devDependencies (including @types). Use `NODE_ENV=development npm install` for type checking.
- Check: `cd server && npx tsc --noEmit`
- Module resolution: `bundler` mode, strict: true, skipLibCheck: true

## Conventions

- Swagger UI at `/api/docs`
- All routes mount under `/api/` prefix
- SQLite via better-sqlite3 (synchronous)
- JWT auth via `middleware/auth.ts` (requireAuth, optionalAuth, requireAdminToken)
- User ID accessed as `req.userId!` (set by requireAuth middleware), NOT `req.user.id`
- Limit params: always clamp with `Math.max(1, Math.min(value, MAX))`
- Goal ownership: always verify `goal.user_id === userId` before mutations
- Notifications: route through `sendAgentNotification()` to honor preferences + quiet hours

## Quick Reference

| Task | Command |
|------|---------|
| Frontend dev | `npm run dev` |
| Backend dev | `cd server && npm run dev` |
| Typecheck (frontend) | `npx tsc --noEmit` |
| Typecheck (server) | `cd server && npx tsc --noEmit` |
| Lint | `npm run lint` |
| Format check | `npx prettier --check .` |
| Unit tests | `cd server && npm test` |
| E2E tests | `npx playwright test` |
| Docker build | `docker compose build` |
| Docker run | `docker compose up -d` |

## Common Pitfalls

- **Import extensions**: Server uses ES modules — imports need `.js` extensions (e.g., `'../db/index.js'`)
- **Unused imports**: Frontend enforces `noUnusedLocals` — unused imports break Docker builds
- **req.user.id vs req.userId!**: Always use `req.userId!` (set by requireAuth middleware)
- **Production npm install**: `NODE_ENV=production` skips devDependencies including @types
- **Test mode**: Tests run with `TEST_MODE=true` which mocks LLM calls and Telegram
- **Database**: SQLite is synchronous (better-sqlite3) — no async/await needed for DB calls
- **Staging Redis**: `STAGING_REDIS_PASSWORD` must be set in `.env.staging` (no default fallback)
