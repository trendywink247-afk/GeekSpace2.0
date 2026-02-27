# Release Checklist — Industry-Grade Hardening Branch

**Branch:** `refactor/industry-grade-hardening-2026-02-23`
**Commits:** 8 (from `44c37a9` to `63ab542`)
**Date:** 2026-02-24

---

## Pre-Deploy Backup

```bash
# 1. Snapshot the production database
docker cp geekspace-app:/app/data/geekspace.db ~/backups/geekspace-pre-hardening-$(date +%Y%m%d).db

# 2. Backup current .env
cp ~/GeekSpace2.0/.env ~/backups/.env-pre-hardening-$(date +%Y%m%d)

# 3. Tag the current production state
cd ~/GeekSpace2.0
git stash  # if any uncommitted local changes
git tag pre-hardening-$(date +%Y%m%d) main
```

## Deploy

```bash
cd ~/GeekSpace2.0

# 1. Merge the hardening branch into main
git checkout main
git merge --no-ff refactor/industry-grade-hardening-2026-02-23

# 2. Rebuild and restart all containers
docker compose up -d --build

# 3. Wait for health checks to pass (~30s)
sleep 35
docker compose ps   # all should show "healthy"
```

## Smoke Tests

Run these immediately after deploy:

```bash
# 1. Health endpoint
curl -s http://localhost:3001/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('HEALTH:', d.get('status','FAIL'))"

# 2. Auth flow (login with demo user)
TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@demo.com","password":"demo123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token','FAIL'))")
echo "AUTH TOKEN: ${TOKEN:0:20}..."

# 3. Billing plans (public, no auth)
curl -s http://localhost:3001/api/billing/plans | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'PLANS: {len(d)} available')"

# 4. Reminders (authed)
curl -s http://localhost:3001/api/reminders \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'REMINDERS: {len(d)} found')"

# 5. Pico agents (authed)
curl -s http://localhost:3001/api/pico/agents \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'AGENTS: {len(d)} found')"

# 6. Automations (authed)
curl -s http://localhost:3001/api/automations \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'AUTOMATIONS: {len(d)} found')"

# 7. SSRF protection (should fail)
echo "SSRF block test:"
curl -s http://localhost:3001/api/pico/agents -H "Authorization: Bearer $TOKEN" > /dev/null && echo "  Agents endpoint OK"

# 8. Unauthenticated rejection
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/reminders)
echo "UNAUTH: $STATUS (expect 401)"

# 9. Docker health status
echo "CONTAINERS:"
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

## Log Monitoring

```bash
# Tail application logs (watch for errors after deploy)
docker compose logs -f --tail=100 geekspace-app

# Check for startup errors
docker compose logs geekspace-app 2>&1 | grep -iE '(error|fatal|crash|uncaught)' | tail -20

# Check Caddy proxy logs
docker compose logs -f --tail=50 caddy

# Check Redis connectivity
docker compose logs redis 2>&1 | tail -10

# Check PicoClaw sidecar
docker compose logs picoclaw 2>&1 | tail -10

# Monitor health check results
watch -n 10 'curl -s http://localhost:3001/api/health | python3 -m json.tool'
```

## Rollback

### Option A: Full rollback (revert entire branch)
```bash
cd ~/GeekSpace2.0
git checkout main
git revert --no-commit HEAD   # if merged as single commit
# OR
git reset --hard pre-hardening-$(date +%Y%m%d)   # if tagged before deploy

# Restore database if needed
docker cp ~/backups/geekspace-pre-hardening-*.db geekspace-app:/app/data/geekspace.db

# Redeploy
docker compose up -d --build
sleep 35
curl http://localhost:3001/api/health
```

### Option B: Selective rollback (revert individual commits)
```bash
# Each commit is independently revertable:
git revert 63ab542  # Caddy healthcheck (ops)
git revert aec8a76  # billing/automation tests (test-only)
git revert bb501fe  # stale file cleanup
git revert d19da22  # a11y fixes (frontend-only)
git revert c1f0040  # 404 status codes (routes)
git revert d3f269c  # weebo at-least-one rule
git revert 8044449  # isolation tests (test-only)
git revert 44c37a9  # SSRF protection + webhook hardening

# After reverting, redeploy:
docker compose up -d --build
```

### Option C: Database restore only (if data corruption suspected)
```bash
# Stop the app
docker compose stop geekspace

# Restore the backup
docker cp ~/backups/geekspace-pre-hardening-*.db geekspace-app:/app/data/geekspace.db

# Restart
docker compose start geekspace
sleep 20
curl http://localhost:3001/api/health
```

---

## What This Release Does NOT Do

- No database schema changes (no CREATE/ALTER/DROP TABLE)
- No new database migrations
- No seed data changes
- No dependency version bumps
- No API contract changes (only status code corrections: 400 → 404 for not-found)
- No environment variable changes required
