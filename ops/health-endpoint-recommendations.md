# Health Endpoint Recommendations

## Current State (as of 2026-03-26)

### Public endpoint: `GET /api/health`
- Location: `server/src/app.ts` (inline handler)
- Returns: `{ "status": "ok" | "degraded" }` with 200/503
- Checks: SQLite DB connectivity only
- Auth: None (public)

### Detailed endpoint: `GET /api/health/detailed`
- Location: `server/src/routes/health.ts`
- Returns: per-service status with latency for DB, Redis, Ollama, OpenRouter, Edith, fal.ai
- Auth: Admin token required

### SSE stream: `GET /api/health/stream`
- Location: `server/src/routes/health.ts`
- Pushes: cached probe results every 15s (delta-only)
- Auth: Admin token (via header or query param)
- Features: 25 max connections, 30-min auto-close, fingerprinting to skip duplicate pushes

### Background probe cache
- Runs every 30s in parallel
- Probes: DB, Ollama, Edith, PicoClaw, SearXNG, Meilisearch, Qdrant, Browser Agent
- Alerts: Telegram notifications to admin users on state transitions (rate-limited 1/hour/service)

## Assessment

The health system is comprehensive. The following items are already covered:

| Requirement | Status |
|---|---|
| Status field | Present (`ok` / `degraded`) |
| Uptime | Present (via SSE metrics `system.uptime`) |
| DB connectivity | Present (both public and detailed) |
| Version | **Missing from public endpoint** |
| Service-level probes | Present (12 services) |
| Alerting | Present (Telegram on state transitions) |

## Recommendations (Optional Enhancements)

### 1. Add version to public health endpoint
The public `GET /api/health` returns only `{ status }`. Adding a `version` field would help with deployment verification:
```json
{ "status": "ok", "version": "3.1.0" }
```
This would require a one-line change in `server/src/app.ts` at line 368.

### 2. Add a `/api/health/ready` endpoint
Useful for container orchestration (Kubernetes readiness probes):
- Returns 200 only when all critical services (DB, Redis) are healthy
- Returns 503 during startup or when critical deps are down
- The Docker HEALTHCHECK already uses `/api/health`, but a separate readiness check would be cleaner

### 3. Add cache age to public endpoint
The public endpoint runs a live DB query. Consider using the cached probe result instead, and including `cacheAgeMs` so monitors can detect stale probes.

### 4. Consider /api/health/live vs /api/health/ready split
- `/api/health/live` (liveness) — process is running, return 200 always
- `/api/health/ready` (readiness) — DB + critical services are up

### Priority
These are nice-to-haves. The existing health system is already production-grade with background probing, SSE streaming, detailed per-service breakdown, and Telegram alerting.
