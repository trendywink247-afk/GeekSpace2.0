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

Old `routes/`, `services/`, `repositories/` files are thin re-export shims pointing to their module locations.

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

## TypeScript

- `NODE_ENV=production` skips devDependencies (including @types). Use `NODE_ENV=development npm install` for type checking.
- Check: `cd server && npx tsc --noEmit`
- Module resolution: `bundler` mode, strict: true, skipLibCheck: true

## Conventions

- Shim-first migration: old import paths preserved via re-exports, nothing breaks
- Swagger UI at `/api/docs`
- All routes mount under `/api/` prefix
- SQLite via better-sqlite3 (synchronous)
- JWT auth via `middleware/auth.ts` (requireAuth, optionalAuth, requireAdminToken)
