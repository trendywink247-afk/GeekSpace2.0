# DEPLOYMENT RUNBOOK — GeekSpace 2.0

**Date:** 2026-02-23
**Branch:** `refactor/industry-grade-hardening-2026-02-23`

---

## Current Deploy Steps

### Standard Deployment (Docker Compose)

```bash
# 1. SSH into VPS
ssh root@srv1317618

# 2. Pull latest code
cd ~/GeekSpace2.0
git pull origin live-production

# 3. Build and restart
docker compose up -d --build geekspace

# 4. Verify health
curl -s http://localhost:3001/api/health | jq .

# 5. Check logs for errors
docker compose logs -f geekspace --tail=50

# 6. Verify frontend loads
curl -s -o /dev/null -w "%{http_code}" https://ai.geekspace.space
```

### Full Stack Restart (all services)

```bash
docker compose up -d --build
# This rebuilds: geekspace, redis, picoclaw, caddy
# Does NOT touch: ollama, openclaw (externally managed)
```

### Zero-Downtime Notes

| Step | Downtime Risk | Mitigation |
|------|---------------|------------|
| `git pull` | None | Code only, no restart |
| `docker compose build` | None | Builds new image |
| `docker compose up -d` | ~5-15s | PM2 graceful restart inside container |
| DB migrations | None | All migrations are additive `ALTER TABLE ADD COLUMN` |
| Caddy reload | None | Caddy hot-reloads config |

### Risks

1. **JWT secret change** — If `.env` JWT_SECRET changes, all active sessions invalidate. Users see "Invalid token" errors.
   - **Mitigation:** Never change JWT_SECRET unless rotating for security. Warn users.

2. **PM2 cluster restart** — 2 workers restart sequentially. Brief period where only 1 worker handles requests.
   - **Mitigation:** PM2 `kill_timeout: 5000` allows graceful shutdown.

3. **SQLite write lock** — During restart, pending writes may fail.
   - **Mitigation:** WAL mode + busy_timeout. Clients retry on 503.

4. **Docker network disconnect** — External containers (Ollama, OpenClaw) may lose network after restart.
   - **Mitigation:** Run `/root/geekspace-network-fix.sh` after restart.

---

## Pre-Deployment Checklist

```
[ ] Tests pass locally: cd server && npm test
[ ] Frontend builds: npm run build
[ ] Server builds: cd server && npm run build
[ ] No lint errors in changed files
[ ] .env.example updated if new env vars added
[ ] CLAUDE.md updated if architecture changed
[ ] No secrets committed (check git diff for API keys, tokens)
[ ] Docker build succeeds locally: docker compose build geekspace
```

## Post-Deployment Checklist

```
[ ] Health check passes: curl localhost:3001/api/health
[ ] Frontend loads: https://ai.geekspace.space
[ ] Login works (test with demo account)
[ ] Chat endpoint responds
[ ] Ollama reachable: curl http://localhost:32778/api/tags
[ ] Docker networks connected: docker network inspect geekspace-shared
[ ] No error spikes in logs: docker compose logs --tail=100 geekspace
```

---

## Rollback Procedure

```bash
# 1. Find previous working commit
git log --oneline -10

# 2. Checkout previous version
git checkout <commit-hash>

# 3. Rebuild and restart
docker compose up -d --build geekspace

# 4. Verify health
curl -s http://localhost:3001/api/health | jq .
```

### DB Rollback
- SQLite backups at `/root/backups/` (7-day retention, daily at 3am)
- To restore:
```bash
# Stop app
docker compose stop geekspace

# Restore from backup
docker cp /root/backups/geekspace-YYYY-MM-DD.db geekspace-app:/app/data/geekspace.db

# Restart
docker compose start geekspace
```

---

## Environment Variables (Critical)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `JWT_SECRET` | PROD | dev fallback | 64-byte hex, never change post-deploy |
| `ENCRYPTION_KEY` | PROD | dev fallback | 32-byte hex for API key encryption |
| `DB_PATH` | No | `/app/data/geekspace.db` | Docker volume mount |
| `REDIS_URL` | No | `redis://redis:6379` | Internal Docker network |
| `OPENROUTER_API_KEY` | No | empty | Needed for cloud LLM + Moonshot |
| `TELEGRAM_BOT_TOKEN` | No | empty | Needed for Telegram integration |
| `ADMIN_TOKEN` | PROD | empty | Admin API access |

---

## Monitoring

| Check | Frequency | Location |
|-------|-----------|----------|
| Docker healthcheck | 30s | Container-level, restarts on failure |
| Health cron | 4 hours | `/var/log/geekspace-health.log` |
| DB backup | Daily 3am | `/root/backups/` |
| Log rotation | Automatic | Docker json-file, 50MB x 5 |

---

## Hardening Deployment Notes

For Phase 2 commits on `refactor/industry-grade-hardening-2026-02-23`:

1. **No schema changes** — All changes are application-level code
2. **No new env vars required** — Unless feature-flagged
3. **Backward compatible** — Old app version can still run against same DB
4. **Test before merge** — Run full `npm test` + `npx playwright test` before merging to `live-production`
5. **Deploy via PR** — Create PR from hardening branch → `main` → `live-production`
