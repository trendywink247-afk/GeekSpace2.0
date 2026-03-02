# 🚀 Agentin Chat — Pre-Launch Checklist

> **Purpose:** Final gate before opening to beta users / public launch.
> **Run:** `./scripts/launch-check.sh` to execute all automated checks.
> **Owner:** Principal engineer + DevOps
> **Last Updated:** 2026-03-02 (Phase 83)

---

## How to Use

Each item has a status column. Mark as:
- `✅` — verified and passing
- `❌` — failing / needs fix
- `⏭️` — not applicable for this deployment
- `🔲` — not yet checked

Run `./scripts/launch-check.sh` for all automated checks.
Manual items are marked `[MANUAL]`.

---

## Section 1 — Infrastructure & Uptime

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 1.1 | Production health endpoint returns 200 | 🔲 | `curl -sf https://api.agentin.chat/api/health` |
| 1.2 | All Docker containers running (geekspace-app, redis, caddy) | 🔲 | `docker compose ps` |
| 1.3 | Ollama sidecar container running | 🔲 | `docker ps \| grep ollama` |
| 1.4 | OpenClaw container running | 🔲 | `docker ps \| grep openclaw` |
| 1.5 | No container restarts in last 24h | 🔲 | `docker inspect --format '{{.RestartCount}}' geekspace-app` |
| 1.6 | Disk space > 10GB free | 🔲 | `df -h / \| awk 'NR==2{print $4}'` |
| 1.7 | Memory usage < 85% | 🔲 | `free -m \| awk 'NR==2{printf "%.0f%%\n", $3/$2*100}'` |

## Section 2 — SSL & Networking

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 2.1 | SSL certificate valid on ai.agentin.chat | 🔲 | `curl -sv https://ai.agentin.chat 2>&1 \| grep 'SSL certificate verify ok'` |
| 2.2 | SSL certificate valid on api.agentin.chat | 🔲 | `curl -sv https://api.agentin.chat 2>&1 \| grep 'SSL certificate verify ok'` |
| 2.3 | SSL certificate not expiring within 30 days | 🔲 | `echo \| openssl s_client -connect api.agentin.chat:443 2>/dev/null \| openssl x509 -noout -dates` |
| 2.4 | HTTP → HTTPS redirect working | 🔲 | `curl -sI http://ai.agentin.chat \| grep -i location` |
| 2.5 | Caddy proxy routing correctly (frontend + API) | 🔲 | `curl -sf https://ai.agentin.chat/ \| grep -i agentin` |

## Section 3 — Database & Backups

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 3.1 | Database file accessible and healthy | 🔲 | `./scripts/backup-drill.sh` |
| 3.2 | Latest backup exists and is < 24h old | 🔲 | `ls -lt /root/backups/*.db \| head -3` |
| 3.3 | Backup retention: ≥ 7 days of backups exist | 🔲 | `ls /root/backups/*.db \| wc -l` |
| 3.4 | DB WAL mode enabled (safe concurrent reads) | 🔲 | `docker exec geekspace-app sqlite3 /app/data/geekspace.db 'PRAGMA journal_mode;'` |
| 3.5 | DB integrity check passes | 🔲 | `docker exec geekspace-app sqlite3 /app/data/geekspace.db 'PRAGMA integrity_check;'` |

## Section 4 — Tests & Quality

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 4.1 | Server unit tests: all 1043+ passing | 🔲 | `cd server && npm test` |
| 4.2 | Frontend TypeScript: zero errors | 🔲 | `npx tsc --noEmit` |
| 4.3 | Server TypeScript: zero errors | 🔲 | `cd server && npx tsc --noEmit` |
| 4.4 | Brand guard: 0 violations | 🔲 | `npm run brand-guard` |
| 4.5 | Phase gate: 7/7 checks pass | 🔲 | `./ops/phase-gate.sh --skip-e2e` |
| 4.6 | Staging smoke: 11/11 checks pass | 🔲 | `./scripts/smoke-staging.sh` |
| 4.7 | Load test: p95 latency < 2000ms | 🔲 | `./scripts/load-test.sh https://api.agentin.chat` |

## Section 5 — Features & Integrations

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 5.1 | Demo login works (`POST /api/auth/demo`) | 🔲 | `curl -sX POST https://api.agentin.chat/api/auth/demo \| jq .token` |
| 5.2 | Telegram bot active (sends test message) | 🔲 | `[MANUAL]` Send `/start` to the bot |
| 5.3 | AI chat responds (with builtin fallback) | 🔲 | Login → type message → verify response |
| 5.4 | Invite codes working (generate + use) | 🔲 | `curl -sX POST .../api/admin/invite -H 'Authorization: Bearer $ADMIN_TOKEN'` |
| 5.5 | Registration via /invite page succeeds | 🔲 | `[MANUAL]` Visit https://ai.agentin.chat/invite with a valid code |
| 5.6 | Password reset flow end-to-end | 🔲 | `[MANUAL]` Trigger reset, receive email/Telegram OTP, reset |
| 5.7 | OAuth login (Google / GitHub) functional | 🔲 | `[MANUAL]` Test OAuth login flow in browser |

## Section 6 — Security & Compliance

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 6.1 | Admin token is strong (64+ char hex) | 🔲 | `[MANUAL]` Verify `.env` ADMIN_TOKEN |
| 6.2 | JWT secret is strong (64-char hex) | 🔲 | `[MANUAL]` Verify `.env` JWT_SECRET |
| 6.3 | No secrets in git history | 🔲 | `git log --all --full-history -- '*.env'` (should be empty) |
| 6.4 | Rate limiting active on auth endpoints | 🔲 | `curl -X POST https://api.agentin.chat/api/auth/login` (11th request = 429) |
| 6.5 | Content Security Policy headers present | 🔲 | `curl -sI https://api.agentin.chat/api/health \| grep -i 'content-security-policy'` |
| 6.6 | Privacy policy page accessible | 🔲 | `curl -sf https://ai.agentin.chat/privacy \| grep -i privacy` |
| 6.7 | Terms of service page accessible | 🔲 | `curl -sf https://ai.agentin.chat/terms \| grep -i terms` |

## Section 7 — Monitoring & Alerting

| # | Check | Status | Command / How to Verify |
|---|-------|--------|------------------------|
| 7.1 | Cronicle health-check job running (4h cadence) | 🔲 | `[MANUAL]` Check Cronicle dashboard |
| 7.2 | Cronicle pre-launch daily check running (08:00 IST) | 🔲 | `[MANUAL]` Check Cronicle dashboard |
| 7.3 | Pino logs flowing to stdout (visible in docker logs) | 🔲 | `docker compose logs --tail=50 geekspace-app` |
| 7.4 | Error rate < 1% in last 24h | 🔲 | `[MANUAL]` Check pino logs for ERROR level |
| 7.5 | Admin dashboard accessible | 🔲 | `curl -sf https://api.agentin.chat/admin -H 'Authorization: Bearer $ADMIN_TOKEN'` |

---

## Final Sign-off

| Role | Name | Date | Signed |
|------|------|------|--------|
| Principal Engineer | | | 🔲 |
| DevOps | | | 🔲 |
| Product Owner | | | 🔲 |

---

## Automated Execution

Run all automatable checks:
```bash
./scripts/launch-check.sh
```

Cronicle pre-launch daily check (08:00 IST) uses this same script and posts results to Telegram.
Results written to: `ops/reports/launch-check-YYYYMMDD.txt`
