# VPS Recovery Runbook

GeekSpace2.0 / Agentin — Hostinger VPS (`ai.agentin.chat`).

## Quick reference

| Service | Port | Health | Container |
|---------|------|--------|-----------|
| GeekSpace prod | 3001 | `/api/health` | `geekspace-app` |
| GeekSpace staging | 3002 | `/api/health` | `geekspace-staging` |
| Paperclip server | 3033 | `/health` | `docker-server-1` |
| Uptime Kuma | 3100 | — | `geekspace-uptime-kuma` |
| Grafana | 3000 | — | `grafana` |

---

## 1. Cold-kernel restart procedure

After an unplanned reboot or kernel upgrade, follow this order to bring everything back up cleanly.

### 1a. Verify the kernel is healthy
```bash
uptime && dmesg | tail -20 && free -h && df -h /
```
Look for OOM kills (`oom-killer`) or filesystem errors in `dmesg`.

### 1b. Start the GeekSpace stack
```bash
cd /root/GeekSpace2.0
docker compose up -d --remove-orphans
docker compose ps
```
Wait ~60 s for the healthchecks to stabilise, then:
```bash
curl -sf http://localhost:3001/api/health
```

### 1c. Start the logging/monitoring stack
```bash
cd /root/GeekSpace2.0
docker compose -f docker-compose.logging.yml up -d --remove-orphans
```

### 1d. Start the Paperclip stack
```bash
cd /root/paperclip
docker compose up -d --remove-orphans   # adjust path as needed
curl -sf http://localhost:3033/health
```

### 1e. Verify Ollama (systemd)
```bash
systemctl status ollama
# If stopped:
systemctl start ollama
```

### 1f. Verify Litestream (systemd)
```bash
systemctl status litestream
# If stopped:
systemctl start litestream
journalctl -u litestream -n 50
```

### 1g. Full health sweep
```bash
./scripts/health-check.sh
```

---

## 2. docker-compose auto-start on reboot (systemd)

Install once to ensure the GeekSpace stack starts automatically after any reboot:

```bash
# Install the unit
cp /root/GeekSpace2.0/ops/systemd/geekspace-autostart.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable geekspace-autostart.service
systemctl start  geekspace-autostart.service
systemctl status geekspace-autostart.service
```

To verify after a reboot:
```bash
journalctl -u geekspace-autostart -n 30
docker compose -f /root/GeekSpace2.0/docker-compose.yml ps
```

---

## 3. Paperclip server watchdog

The watchdog polls `http://localhost:3033/health` every 30 s. If the server is unreachable for more than **5 minutes** it restarts the `docker-server-1` container.

### Install
```bash
cp /root/GeekSpace2.0/ops/systemd/paperclip-watchdog.service /etc/systemd/system/
cp /root/GeekSpace2.0/ops/systemd/paperclip-watchdog.sh      /root/GeekSpace2.0/ops/systemd/
chmod +x /root/GeekSpace2.0/ops/systemd/paperclip-watchdog.sh

systemctl daemon-reload
systemctl enable paperclip-watchdog.service
systemctl start  paperclip-watchdog.service
systemctl status paperclip-watchdog.service
```

### Override defaults (optional)
Create `/etc/systemd/system/paperclip-watchdog.service.d/override.conf`:
```ini
[Service]
Environment="PAPERCLIP_HEALTH_URL=http://localhost:3033/health"
Environment="PAPERCLIP_CONTAINER=docker-server-1"
```

### View watchdog logs
```bash
journalctl -u paperclip-watchdog -f
```

---

## 4. Backup strategy

### Primary backup — R2 (nightly)
Litestream replicates the SQLite WAL to Cloudflare R2 in real-time. See `docs/LITESTREAM.md` for config.

A compressed local snapshot also runs at **03:00 UTC** via cron:
```
0 3 * * * /root/GeekSpace2.0/scripts/backup-db.sh
```

Offsite sync to the primary rclone remote (`offsite`) runs at **03:30 UTC**:
```
30 3 * * * /root/GeekSpace2.0/scripts/offsite-backup.sh >> /root/backups/offsite-sync.log 2>&1
```

### Secondary backup — Backblaze B2 (weekly)
A second rclone remote (`offsite-b2`) syncs at **04:00 UTC every Sunday**:
```
0 4 * * 0 /root/GeekSpace2.0/scripts/secondary-backup.sh >> /root/backups/secondary-sync.log 2>&1
```

#### Set up the B2 remote
```bash
# Install rclone (if not present)
curl https://rclone.org/install.sh | bash

# Configure the B2 remote (name it exactly "offsite-b2")
rclone config
# type: b2
# account: <Backblaze account ID>
# key: <application key>

# Create the bucket
rclone mkdir offsite-b2:geekspace-backups

# Test sync
/root/GeekSpace2.0/scripts/secondary-backup.sh --dry-run

# Install the weekly cron
(crontab -l 2>/dev/null; echo "0 4 * * 0 /root/GeekSpace2.0/scripts/secondary-backup.sh >> /root/backups/secondary-sync.log 2>&1") | crontab -
```

### Backup drill
Run the integrity drill after any restore, or at least monthly:
```bash
./scripts/backup-drill.sh
cat ops/reports/backup-drill-$(date +%Y%m%d).txt
```

---

## 5. Container memory limits

Current limits (as of AGE-44). The sum of limits across all GeekSpace containers is ~12.4 GB against a 32 GB VPS, leaving ≥ 8 GB headroom for the kernel, Ollama (6 GB systemd), and the Paperclip stack.

| Container | Limit |
|-----------|-------|
| geekspace-app | 2 GB |
| geekspace-staging | 2 GB |
| geekspace-redis | 1 GB |
| geekspace-browser | 1.5 GB |
| geekspace-kokoro-tts | 1 GB |
| geekspace-piper-tts | 1 GB |
| geekspace-whisper-stt | 1 GB |
| geekspace-qdrant | 256 MB |
| geekspace-searxng | 256 MB |
| geekspace-meilisearch | 128 MB |
| geekspace-uptime-kuma | 128 MB |
| geekspace-picoclaw | 64 MB |
| geekspace-staging-redis | 64 MB |
| **ollama** (systemd) | **6 GB** (no container limit — systemd managed) |

**Paperclip containers** (`docker-server-1`, `docker-db-1`) each target **2 GB** — apply via their own compose file (not in this repo).

Check live usage:
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

---

## 6. Common failure modes

### GeekSpace app OOM
```bash
docker logs geekspace-app --tail 100 | grep -i "oom\|killed\|fatal"
# If container exited:
docker compose up -d geekspace
```

### Redis OOM / eviction storm
Redis uses `allkeys-lru` so it evicts under pressure — this is expected. If the container itself is OOM-killed (not Redis eviction), increase the container limit in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 1G   # current floor — do not go below this
```

### Litestream not replicating
```bash
journalctl -u litestream -n 100
# Check R2 credentials in /etc/default/litestream
# Manual restore test:
litestream restore -config /etc/litestream.yml /tmp/test-restore.db
```

### Paperclip server down
The watchdog restarts it automatically after 5 min. To manually restart:
```bash
docker restart docker-server-1
curl -sf http://localhost:3033/health
```

### Full disk
```bash
df -h /
# Clean Docker build cache:
docker builder prune -f
# Clean unused images:
docker image prune -a --filter "until=48h"
# Rotate logs:
journalctl --vacuum-time=7d
```
