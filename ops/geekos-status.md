# GeekOS Container Status Report

**Date:** 2026-03-26
**Reported by:** Infrastructure hardening sprint 7

## Container Status

| Container | Image | Status | Exit Code | Stopped At |
|---|---|---|---|---|
| `geekspace-geekos` | `geekspace20-geekos` | **Exited** | 1 (error) | 2026-03-23 00:51:05 UTC |
| `geekspace-geekos-postgres` | `pgvector/pgvector:pg16` | **Exited** | 0 (clean) | 2026-03-23 00:51:36 UTC |

## Observations

1. **GeekOS crashed (exit code 1)** on 2026-03-23. The Postgres container then shut down cleanly (exit code 0), likely because it had no remaining clients.

2. **Last known logs** from GeekOS show it successfully initialized all 9 agent SQL database adapters (Cal, Echo, Edith, Forge, GeekOS, Jarvis, Nova, Pulse, Weebo) before crashing. The crash likely occurred shortly after plugin initialization.

3. **Both containers have been down for ~3 days** without being restarted. This suggests GeekOS is not critical to current operations (the main `geekspace-app` container handles agent routing independently).

4. **No Docker restart policy** appears to be keeping these containers up — they stayed in "Exited" state.

## Running Containers (Healthy)

| Container | Status |
|---|---|
| `geekspace-app` (main backend) | Up, healthy |
| `geekspace-staging` | Up, healthy |
| `geekspace-picoclaw` | Up, healthy |
| `geekspace-redis` | Up, healthy |
| `geekspace-staging-redis` | Up, healthy |
| `geekspace-searxng` | Up, healthy |
| `geekspace-qdrant` | Up, healthy |
| `geekspace-meilisearch` | Up, healthy |
| `geekspace-browser` | Up, healthy |
| `geekspace-uptime-kuma` | Up, healthy |

## Recommendations

1. **Investigate GeekOS crash**: Run `docker logs geekspace-geekos 2>&1 | tail -50` to see the actual error
2. **Consider restart policy**: Add `restart: unless-stopped` to the GeekOS service in `docker-compose.yml` if it should auto-recover
3. **If GeekOS is not needed**: Remove it from `docker-compose.yml` to reduce resource usage and eliminate the stale Postgres container
4. **If restarting**: Run `docker compose up -d geekos geekos-postgres` to bring both back up
